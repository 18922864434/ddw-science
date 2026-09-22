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
 * 提交前校验：剔除确定已失效的地址，纠正重定向地址。
 * 返回 { items, dropped, replaced, transient }。
 *
 * 剔除口径刻意收窄：只有 4xx 才构成「页面不存在」的证据，予以剔除；
 * 网络异常（status 0，超时/连接失败）与 5xx 属传输层或服务端的瞬时问题，
 * 不能据此判定 URL 失效——若一并剔除，会在部署抖动时静默漏推页面。
 * 该口径来自一次 CI 实测：首次推送因探测超时把 27 个 URL 中的 1 个静默丢弃。
 */
export async function validateUrls(items, config, logger) {
  const lc = config.liveCheck ?? {};
  if (lc.validateBeforeSubmit === false) return { items, dropped: [], replaced: [], transient: [] };

  const results = await mapLimit(items, lc.concurrency ?? 6, async (item) => ({
    item,
    result: await resolveFinal(item.url, config, { timeoutMs: lc.timeoutMs ?? 20000 }),
  }));

  const kept = [];
  const dropped = [];
  const replaced = [];
  const transient = [];

  for (const { item, result } of results) {
    if (result.ok && result.final === item.url) {
      kept.push(item);
    } else if (result.ok && result.final !== item.url) {
      replaced.push({ from: item.url, to: result.final, chain: result.chain });
      kept.push({ ...item, url: result.final });
    } else {
      const status = result.status ?? 0;
      const reason = result.reason ?? result.error ?? 'not-200';
      if (status >= 400 && status < 500) {
        dropped.push({ url: item.url, status, reason });
      } else {
        // 传输层/服务端瞬时问题：保留并告警，交由引擎侧自行判定
        transient.push({ url: item.url, status, reason });
        kept.push(item);
      }
    }
  }

  if (replaced.length) {
    for (const r of replaced) logger.warn(`重定向已纠正：${r.from} → ${r.to}`);
  }
  if (dropped.length) {
    for (const d of dropped) logger.warn(`已剔除确定失效的 URL：${d.url}（${d.status} ${d.reason}）`);
  }
  if (transient.length) {
    for (const t of transient) logger.warn(`探测未成功但非明确失效，予以保留：${t.url}（${t.status} ${t.reason}）`);
  }
  logger.info(`线上校验：可提交 ${kept.length} / 确定剔除 ${dropped.length} / 纠正 ${replaced.length} / 保留待观察 ${transient.length}`);

  return { items: kept, dropped, replaced, transient };
}

/**
 * 等待 Cloudflare Pages 部署生效。
 * 判据：线上 HTML 的内容指纹与仓库中对应文件一致。
 *
 * 两个已核实的现实约束：
 *  1) Cloudflare 会改写部分页面内容（如 contact 页的邮箱地址混淆会注入
 *     cdn-cgi/email-protection 标记），这类页面的指纹永远无法与仓库文件一致，
 *     必须通过 liveCheck.ignoreUrls 排除，否则会拖满整个等待窗口。
 *  2) 部署在各边缘节点间的传播有延迟，短时间内的不匹配可能只是命中了旧节点。
 *
 * 因此采用「收敛即退出」而非「死等到超时」：连续 stagnantLimit 轮没有新增匹配
 * 就结束等待。指纹校验是尽力而为的增强，真正的提交闸门是随后的线上可达性校验。
 */
export async function waitForDeployLive(items, config, logger) {
  const lc = config.liveCheck ?? {};
  if (lc.enabled === false) return { skipped: true, matched: 0, unmatched: [] };

  const ignored = new Set(lc.ignoreUrls ?? []);
  const ignoredItems = items.filter((item) => ignored.has(item.url));
  const tracked = items.filter((item) => item.file && item.signature && !ignored.has(item.url));
  const untracked = items.length - tracked.length - ignoredItems.length;

  if (ignoredItems.length) {
    logger.info(`按 ignoreUrls 排除 ${ignoredItems.length} 个页面（线上内容会被 Cloudflare 改写，指纹不可比对）：${ignoredItems.map((i) => i.url).join(', ')}`);
  }
  if (untracked > 0) logger.info(`${untracked} 个 URL 无本地文件可比对（来自 sitemap），不参与指纹等待`);
  if (!tracked.length) {
    logger.info('无可比对的页面，跳过部署等待');
    return { skipped: true, matched: 0, unmatched: [] };
  }

  const maxWaitMs = lc.maxWaitMs ?? 120000;
  const pollIntervalMs = lc.pollIntervalMs ?? 10000;
  const stagnantLimit = Math.max(1, lc.stagnantLimit ?? 3);
  const deadline = Date.now() + maxWaitMs;
  const pending = new Map(tracked.map((item) => [item.url, item.signature]));
  const total = pending.size;

  logger.info(`等待部署生效：比对 ${total} 个页面的内容指纹（上限 ${Math.round(maxWaitMs / 1000)}s，连续 ${stagnantLimit} 轮无进展则收敛退出）`);

  let bestMatched = 0;
  let stagnant = 0;
  let converged = false;

  while (pending.size && Date.now() < deadline) {
    const checks = await mapLimit([...pending.keys()], lc.concurrency ?? 6, async (url) => {
      const res = await request(url, { method: 'GET', config, timeoutMs: lc.timeoutMs ?? 20000 });
      if (res.status !== 200 || !res.body) return { url, matched: false, status: res.status };
      return { url, matched: contentSignature(res.body) === pending.get(url), status: res.status };
    });

    for (const check of checks) {
      if (check.matched) pending.delete(check.url);
    }
    if (!pending.size) break;

    const matchedNow = total - pending.size;
    if (matchedNow > bestMatched) {
      logger.info(`部署推进中：已确认 ${matchedNow}/${total}`);
      bestMatched = matchedNow;
      stagnant = 0;
    } else {
      stagnant += 1;
      if (stagnant >= stagnantLimit) {
        converged = true;
        break;
      }
      logger.info(`本轮无新增匹配（已确认 ${matchedNow}/${total}，第 ${stagnant}/${stagnantLimit} 轮）`);
    }
    await sleep(pollIntervalMs);
  }

  const unmatched = [...pending.keys()];
  if (!unmatched.length) {
    logger.ok(`部署已确认生效：${total} 个页面内容与仓库一致`);
  } else if (converged) {
    logger.warn(`${unmatched.length}/${total} 个页面未匹配到仓库内容，已收敛退出（不再等待）。后续线上校验仍会拦住不可达地址。`);
  } else {
    logger.warn(`${unmatched.length}/${total} 个页面在 ${Math.round(maxWaitMs / 1000)}s 内未确认，继续后续流程。`);
  }

  const fallback = lc.fallbackDelayMs ?? 0;
  if (unmatched.length && fallback > 0) await sleep(fallback);

  return { skipped: false, converged, matched: total - unmatched.length, total, unmatched };
}
