// tools/indexnow/lib/state.mjs
// 提交状态：去重缓存 + 审计记录。
// 结构：{ version, updatedAt, urls: { [url]: { lastSubmittedAt, lastStatus, count } } }

import { readJson, writeJson } from './util.mjs';

const EMPTY = { version: 1, updatedAt: null, urls: {} };

export async function loadState(file) {
  const state = await readJson(file, null);
  if (!state || typeof state !== 'object' || !state.urls) return structuredClone(EMPTY);
  return state;
}

export async function saveState(file, state) {
  state.updatedAt = new Date().toISOString();
  await writeJson(file, state);
  return state;
}

/**
 * 去重：过滤掉 TTL 窗口内已成功提交过的 URL。
 * 返回 { keep, skipped }。
 */
export function filterByTtl(items, state, ttlHours) {
  const ttlMs = Math.max(0, (ttlHours ?? 0) * 3600 * 1000);
  const now = Date.now();
  const keep = [];
  const skipped = [];
  for (const item of items) {
    const record = state.urls[item.url];
    const submittedAt = record?.lastSubmittedAt ? Date.parse(record.lastSubmittedAt) : NaN;
    const fresh = Number.isFinite(submittedAt) && now - submittedAt < ttlMs;
    if (fresh && record.lastStatus >= 200 && record.lastStatus < 300) skipped.push({ url: item.url, lastSubmittedAt: record.lastSubmittedAt });
    else keep.push(item);
  }
  return { keep, skipped };
}

export function recordSuccess(state, urls, status) {
  const now = new Date().toISOString();
  for (const url of urls) {
    const prev = state.urls[url] ?? { count: 0 };
    state.urls[url] = { lastSubmittedAt: now, lastStatus: status, count: (prev.count ?? 0) + 1 };
  }
  return state;
}

/** 清理超过保留期的历史条目，避免状态文件无限增长。 */
export function pruneState(state, pruneAfterDays = 90) {
  const cutoff = Date.now() - pruneAfterDays * 86400 * 1000;
  let removed = 0;
  for (const [url, record] of Object.entries(state.urls)) {
    const at = record?.lastSubmittedAt ? Date.parse(record.lastSubmittedAt) : NaN;
    if (!Number.isFinite(at) || at < cutoff) {
      delete state.urls[url];
      removed += 1;
    }
  }
  return removed;
}
