// tools/indexnow/lib/submit.mjs
// IndexNow 提交：状态码解释、分批、退避重试、密钥预检。
//
// 状态码语义（依据 IndexNow 官方协议）：
//   200 成功 / 202 已受理（密钥校验待完成）/ 400 格式错误 /
//   403 密钥无效或 keyLocation 不可访问 / 422 host 与 key 不匹配 /
//   429 请求过频 / 5xx 服务端错误
// 只有 429 与 5xx（含网络异常）可重试；400/403/422 属于配置或数据错误，
// 重试无意义，必须人工修复后重跑。

import { backoffDelay, parseRetryAfter, sleep } from './util.mjs';

export function interpretStatus(status) {
  if (status === 0) return { level: 'network', retryable: true, fatal: false, note: '网络异常或超时' };
  if (status === 200) return { level: 'ok', retryable: false, fatal: false, note: '成功：URL 已提交至全部参与引擎' };
  if (status === 202) return { level: 'accepted', retryable: false, fatal: false, note: '已受理：密钥校验待完成（首次提交常见，无需处理）' };
  if (status === 400) return { level: 'bad-request', retryable: false, fatal: true, note: '请求格式无效：JSON 结构或字段有误' };
  if (status === 403) return { level: 'forbidden', retryable: false, fatal: true, note: '密钥无效，或 keyLocation 无法访问' };
  if (status === 422) return { level: 'unprocessable', retryable: false, fatal: true, note: 'URL 不属于该 host，或密钥与 keyLocation 不匹配' };
  if (status === 429) return { level: 'throttled', retryable: true, fatal: false, note: '请求过于频繁，按 Retry-After 退避' };
  if (status >= 500) return { level: 'server-error', retryable: true, fatal: false, note: `服务端错误 ${status}` };
  return { level: 'unexpected', retryable: false, fatal: false, note: `未预期的状态码 ${status}` };
}

async function postOnce(endpoint, payload, config, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'user-agent': config.userAgent ?? 'indexnow-client',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.text().catch(() => '');
    return {
      status: res.status,
      retryAfter: res.headers.get('retry-after'),
      body: body.slice(0, 2000),
      endpoint,
    };
  } catch (err) {
    return {
      status: 0,
      endpoint,
      error: err?.name === 'AbortError' ? '请求超时' : String(err?.message ?? err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 单批提交，内置退避重试。 */
export async function submitBatch(urls, config, logger, { dryRun = false, endpoint } = {}) {
  const target = endpoint ?? config.endpoint;
  const retry = config.retry ?? {};
  const maxAttempts = Math.max(1, retry.maxAttempts ?? 5);

  const payload = {
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation,
    urlList: urls,
  };

  if (dryRun) {
    logger.info(`[dry-run] 将向 ${target} 提交 ${urls.length} 个 URL`);
    return { ok: true, dryRun: true, attempts: 0, status: null, requested: urls, endpoint: target };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await postOnce(target, payload, config);
    const verdict = interpretStatus(res.status);

    if (verdict.level === 'ok' || verdict.level === 'accepted' || (verdict.level === 'ok' && res.status === 200)) {
      logger.ok(`${target} 返回 ${res.status}（${verdict.note}），本次 ${urls.length} 个 URL，第 ${attempt} 次尝试`);
      return { ok: true, status: res.status, attempts: attempt, requested: urls, verdict, endpoint: target };
    }

    if (!verdict.retryable) {
      logger.error(`${target} 返回 ${res.status}（${verdict.note}）${res.body ? ` — ${res.body}` : ''}`);
      return { ok: false, status: res.status, attempts: attempt, requested: urls, verdict, endpoint: target, body: res.body, fatal: verdict.fatal };
    }

    if (attempt === maxAttempts) {
      logger.error(`${target} 连续 ${maxAttempts} 次失败（末次 ${res.status}：${verdict.note}），放弃该批次`);
      return { ok: false, status: res.status, attempts: attempt, requested: urls, verdict, endpoint: target, body: res.body, exhausted: true };
    }

    const retryAfterMs = retry.respectRetryAfter === false ? NaN : parseRetryAfter(res.retryAfter);
    const delay = backoffDelay(attempt, retry, retryAfterMs);
    logger.warn(`${target} 返回 ${res.status}（${verdict.note}），${delay}ms 后进行第 ${attempt + 1} 次尝试`);
    await sleep(delay);
  }

  return { ok: false, status: null, attempts: maxAttempts, requested: urls, endpoint: target, exhausted: true };
}

/** 按 URL 数量与载荷字节数分批。 */
export function planBatches(items, config) {
  const maxUrls = config.limits?.maxUrlsPerRequest ?? 10000;
  const maxBytes = config.limits?.maxPayloadBytes ?? 1048576;
  const overhead = Buffer.byteLength(
    JSON.stringify({ host: config.host, key: config.key, keyLocation: config.keyLocation, urlList: [] }),
    'utf8',
  );

  const batches = [];
  let current = [];
  let size = overhead;

  for (const item of items) {
    const add = Buffer.byteLength(item.url, 'utf8') + 4;
    if (current.length && (current.length >= maxUrls || size + add > maxBytes)) {
      batches.push(current);
      current = [];
      size = overhead;
    }
    current.push(item);
    size += add;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** 多批顺序提交，批间留出间隔以降低被限流概率。 */
export async function submitAll(items, config, logger, { dryRun = false, endpoints } = {}) {
  const targets = endpoints?.length ? endpoints : [config.endpoint];
  const batches = planBatches(items, config);
  const summary = { batches: [], submitted: [], failed: [], fatal: false, endpoint: targets[0] };

  logger.info(`共 ${items.length} 个 URL，拆分为 ${batches.length} 个批次（每批上限 ${config.limits?.maxUrlsPerRequest ?? 10000}）`);

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const urls = batch.map((item) => item.url);
    let result = null;

    for (const target of targets) {
      result = await submitBatch(urls, config, logger, { dryRun, endpoint: target });
      if (result.ok) break;
      if (result.fatal) break;
      if (targets.indexOf(target) < targets.length - 1) {
        logger.warn(`切换备用端点重试该批次：${targets[targets.indexOf(target) + 1]}`);
      }
    }

    summary.batches.push({
      index: i + 1,
      count: urls.length,
      status: result?.status ?? null,
      ok: Boolean(result?.ok),
      attempts: result?.attempts ?? 0,
      endpoint: result?.endpoint ?? null,
      urls,
    });

    if (result?.ok) summary.submitted.push(...urls);
    else {
      summary.failed.push(...urls);
      if (result?.fatal) summary.fatal = true;
    }

    if (i < batches.length - 1 && !dryRun) await sleep(config.limits?.batchDelayMs ?? 1000);
  }

  return summary;
}

/** 密钥预检：确认 keyLocation 已上线且内容与 key 完全一致。 */
export async function verifyKey(config, logger, { attempts = 6, intervalMs = 15000 } = {}) {
  const url = config.keyLocation;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': config.userAgent ?? 'indexnow-client' }, redirect: 'follow' });
    } catch (err) {
      logger.warn(`密钥文件不可访问（第 ${attempt}/${attempts} 次）：${err.message}`);
      if (attempt < attempts) await sleep(intervalMs);
      continue;
    }

    if (res.status === 200) {
      const text = (await res.text()).trim();
      if (text === config.key) {
        logger.ok(`密钥预检通过：${url}`);
        return { ok: true };
      }
      logger.error(`密钥文件内容不匹配：期望 "${config.key}"，实际 "${text.slice(0, 64)}"`);
      return { ok: false, reason: 'key-mismatch' };
    }

    logger.warn(`密钥文件返回 ${res.status}（第 ${attempt}/${attempts} 次）：${url}`);
    if (attempt < attempts) await sleep(intervalMs);
  }
  logger.error(`密钥预检失败：${url} 始终不可用。请确认密钥文件已部署到站点根目录。`);
  return { ok: false, reason: 'unreachable' };
}
