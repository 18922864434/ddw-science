// tools/indexnow/lib/live.mjs
// 线上校验：提交前确认 URL 可达且为最终形态；提交前等待 Cloudflare 部署生效。
//
// 为什么需要这两步：
//  1) 提交一个 308 跳转地址或 404 地址会浪费 IndexNow 配额，并可能让引擎把
//     非规范地址记入索引。
//  2) GitHub 推送后 Cloudflare Pages 是异步构建部署的（通常数十秒）。若在部署完成前
//     提交，引擎抓取到的可能仍是旧内容，等于一次无效提交。

import { contentSignature, mapLimit, sleep } from './util.mjs';
import { normalizeUrl } from './urls.mjs';

const MAX_HOPS = 5;

async function request(url, { method = 'GET', config, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      headers: {
        'user-agent': config.userAgent ?? 'indexnow-client',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    const location = res.headers.get('location');
    const body = method === 'GET' ? await res.text().catch(() => '') : null;
    return { status: res.status, location, body };
  } catch (err) {
    return { status: 0, error: err?.name === 'AbortError' ? '请求超时' : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

/** 手动跟踪重定向，返回最终 URL 与可达性。 */
export async function resolveFinal(url, config, { timeoutMs = 20000 } = {}) {
  let current = url;
  const chain = [];

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    let res = await request(current, { method: 'HEAD', config, timeoutMs });
    if (res.status === 0 || res.status === 405 || res.status === 501) {
      res = await request(current, { method: 'GET', config, timeoutMs });
    }

    if (res.status >= 300 && res.status < 400 && res.location) {
      let next;
      try {
        next = new URL(res.location, current).toString();
      } catch {
        return { ok: false, reason: 'bad-redirect-location', status: res.status, chain };
      }
      const normalized = normalizeUrl(next, config);
      if (!normalized) return { ok: false, reason: 'redirect-offsite', status: res.status, chain: [...chain, next] };
      chain.push(normalized);
      current = normalized;
      continue;
    }

    return {
      ok: res.status === 200,
      final: current,
      status: res.status,
      chain,
      error: res.error,
      reason: res.status === 0 ? 'unreachable' : undefined,
    };
  }

  return { ok: false, reason: 'redirect-loop', chain };
}

/**
 * 提交前校验：剔除死链，纠正重定向地址。
 * 返回 { items, dropped, replaced }。
 */
export async function validateUrls(items, config, logger) {
  const lc = config.liveCheck ?? {};
  if (lc.validateBeforeSubmit === false) return { items, dropped: [], replaced: [] };

  const results = await mapLimit(items, lc.concurrency ?? 6, async (item) => ({
    item,
    result: await resolveFinal(item.url, config, { timeoutMs: lc.timeoutMs ?? 20000 }),
  }));

  const kept = [];
  const dropped = [];
  const replaced = [];

  for (const { item, result } of results) {
    if (result.ok && result.final === item.url) {
      kept.push(item);
    } else if (result.ok && result.final !== item.url) {
      replaced.push({ from: item.url, to: result.final, chain: result.chain });
      kept.push({ ...item, url: result.final });
    } else {
      dropped.push({ url: item.url, status: result.status ?? 0, reason: result.reason ?? result.error ?? 'not-200' });
    }
  }

  if (replaced.length) {
    for (const r of replaced) logger.warn(`重定向已纠正：${r.from} → ${r.to}`);
  }
  if (dropped.length) {
    for (const d of dropped) logger.warn(`已剔除不可提交 URL：${d.url}（${d.status} ${d.reason}）`);
  }
  logger.info(`线上校验：可提交 ${kept.length} / 剔除 ${dropped.length} / 纠正 ${replaced.length}`);

  return { items: kept, dropped, replaced };
}

/**
 * 等待 Cloudflare Pages 部署生效。
 * 判据：线上 HTML 的内容指纹与仓库中对应文件一致。
 * 超时后走兜底延时，保证流程不中断。
 */
export async function waitForDeployLive(items, config, logger) {
  const lc = config.liveCheck ?? {};
  if (lc.enabled === false) return { skipped: true, matched: 0, timedOut: [] };

  const tracked = items.filter((item) => item.file && item.signature);
  const untracked = items.length - tracked.length;
  if (!tracked.length) {
    logger.info(`无本地文件可比对（${untracked} 个 URL 来自 sitemap），跳过部署等待`);
    return { skipped: true, matched: 0, timedOut: [] };
  }

  const deadline = Date.now() + (lc.maxWaitMs ?? 180000);
  const pollIntervalMs = lc.pollIntervalMs ?? 10000;
  const pending = new Map(tracked.map((item) => [item.url, item.signature]));

  logger.info(`等待部署生效：比对 ${pending.size} 个页面的内容指纹（上限 ${Math.round((lc.maxWaitMs ?? 180000) / 1000)}s）`);

  while (pending.size && Date.now() < deadline) {
    const urls = [...pending.keys()];
    const checks = await mapLimit(urls, lc.concurrency ?? 6, async (url) => {
      const res = await request(url, { method: 'GET', config, timeoutMs: lc.timeoutMs ?? 20000 });
      if (res.status !== 200 || !res.body) return { url, matched: false };
      return { url, matched: contentSignature(res.body) === pending.get(url) };
    });
    for (const check of checks) {
      if (check.matched) {
        pending.delete(check.url);
        logger.ok(`已上线：${check.url}`);
      }
    }
    if (!pending.size) break;
    logger.info(`仍有 ${pending.size} 个页面未匹配到新内容，${pollIntervalMs}ms 后重试`);
    await sleep(pollIntervalMs);
  }

  const timedOut = [...pending.keys()];
  if (timedOut.length) {
    const fallback = lc.fallbackDelayMs ?? 20000;
    logger.warn(`${timedOut.length} 个页面在超时内未确认，兜底等待 ${fallback}ms 后继续（可能受 CDN 缓存或多文件差异影响）`);
    await sleep(fallback);
  }

  return { skipped: false, matched: tracked.length - timedOut.length, timedOut };
}
