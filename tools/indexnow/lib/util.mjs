// tools/indexnow/lib/util.mjs
// 通用工具：哈希、JSON 读写、同步日志器、退避计算。
// 说明：日志器刻意使用同步文件写入，保证 process.exit 前不丢日志。

import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function sha256(input) {
  return createHash('sha256').update(String(input), 'utf8').digest('hex');
}

/**
 * 归一化 HTML 内容指纹：忽略换行差异、注释与连续空白，用于判断"新版本是否已上线"。
 *
 * 关键：必须先剥离 Cloudflare 在响应期注入的内容，否则线上指纹永远无法与仓库文件一致。
 * 已实测确认的注入物（仅在请求带 HTML Accept 头时出现）：
 *   - Web Analytics / RUM beacon：
 *     <script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/vXXXX..."
 *      integrity="sha512-..." data-cf-beacon='{"token":"..."}'></script>
 *     注意其 src 路径带构建版本号、integrity 随版本变化，因此按域名与 data-cf-beacon 属性匹配。
 *   - 邮箱地址混淆解码头：/cdn-cgi/... 脚本
 * 本函数对仓库文件与线上内容对称调用，仓库文件不含上述片段时该步为无操作。
 */
const CF_INJECTED_SCRIPT = /<script\b[^>]*(?:cloudflareinsights\.com|data-cf-beacon|\/cdn-cgi\/)[^>]*>\s*<\/script>/gi;

export function contentSignature(html) {
  const normalized = String(html)
    .replace(/\r\n?/g, '\n')
    .replace(CF_INJECTED_SCRIPT, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  return sha256(normalized);
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    throw new Error(`读取 JSON 失败 ${file}: ${err.message}`);
  }
}

export async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * 指数退避 + 抖动。attempt 从 1 开始计数。
 * retryAfterMs 存在时优先使用（受 maxRetryAfterMs 上限约束）。
 */
export function backoffDelay(attempt, retry, retryAfterMs) {
  const base = retry?.baseDelayMs ?? 1000;
  const max = retry?.maxDelayMs ?? 30000;
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, retry?.maxRetryAfterMs ?? 120000);
  }
  const raw = Math.min(base * 2 ** (attempt - 1), max);
  const jitter = raw * (retry?.jitterRatio ?? 0);
  return Math.round(raw + (Math.random() * 2 - 1) * jitter);
}

export function parseRetryAfter(headerValue) {
  if (!headerValue) return NaN;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(headerValue);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : NaN;
}

/** 并发受限的映射。 */
export async function mapLimit(items, limit, worker) {
  const list = [...items];
  const results = new Array(list.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, async () => {
    while (cursor < list.length) {
      const index = cursor++;
      results[index] = await worker(list[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export function createLogger({ logDir, tag = 'indexnow' } = {}) {
  const entries = [];
  let logFile = null;
  if (logDir) {
    const day = new Date().toISOString().slice(0, 10);
    logFile = path.join(logDir, `${tag}-${day}.jsonl`);
    try {
      mkdirSync(logDir, { recursive: true });
    } catch {
      logFile = null;
    }
  }

  const prefix = { info: '  ·', ok: '  ✓', warn: '  !', error: '  ✗', step: '▶' };

  const emit = (level, message, extra = {}) => {
    const entry = { ts: new Date().toISOString(), level, message, ...extra };
    entries.push(entry);
    process.stdout.write(`${prefix[level] ?? '  '} ${message}\n`);
    if (logFile) {
      try {
        appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
      } catch {
        /* 日志写入失败不影响主流程 */
      }
    }
  };

  return {
    step: (m, e) => emit('step', m, e),
    info: (m, e) => emit('info', m, e),
    ok: (m, e) => emit('ok', m, e),
    warn: (m, e) => emit('warn', m, e),
    error: (m, e) => emit('error', m, e),
    entries: () => entries,
    logFile,
  };
}
