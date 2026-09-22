#!/usr/bin/env node
// tools/indexnow/linkcheck.mjs
// 站内链接守卫：确认站内链接不指向会 308 跳转的 .html 地址。
//
// 背景：本站的 *.html 会被服务器 308 跳转到无扩展名地址（如 /scientist.html → /scientist）。
// 任何指向 .html 的站内链接都等于让访问者与爬虫多走一次跳转。本工具把这条不变量
// 变成可复跑的检查，防止后续编辑时改回去。
//
// 用法：
//   node tools/indexnow/linkcheck.mjs            静态检查（读本地文件，无需联网）
//   node tools/indexnow/linkcheck.mjs --live     线上检查（抓真实页面并实测状态码）
//
// 退出码：0 全部通过 / 1 存在违规链接

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { collectFromSite, collectFromSitemap, normalizeUrl } from './lib/urls.mjs';
import { resolveFinal } from './lib/live.mjs';
import { createLogger, mapLimit, readJson } from './lib/util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const HREF_RE = /href="([^"]+)"/g;
const NON_HTTP = /^(#|mailto:|tel:|javascript:|data:)/i;

// Cloudflare 在响应期注入的邮箱保护链接，href 形如
//   /cdn-cgi/l/email-protection#<hex>
// 「#」之后是 URL 片段，服务端只能看到 /cdn-cgi/l/email-protection，因此必然 404；
// 真正的解码由 CF 注入的 email-decode.min.js 在浏览器端读取片段完成。
// 这既不是站点自身的链接，也不是可达性问题，跳过检查。
const IGNORED_PATHS = ['/cdn-cgi/'];

function walkHtml(dir, skip, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      walkHtml(abs, skip, out);
    } else if (/\.html?$/i.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

/** 仓库文件 → 该文件在线上对应的规范 URL（用作解析相对链接的基准）。 */
function baseUrlOf(file, root, config) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  return normalizeUrl(`${config.origin}/${rel}`, config);
}

/** 站内链接的判定：非协议外链、非锚点/伪协议、非 CDN 注入路径。 */
function collectHrefs(html, baseUrl) {
  const out = [];
  for (const m of html.matchAll(HREF_RE)) {
    const href = m[1].trim();
    if (NON_HTTP.test(href)) continue;
    let resolved;
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const { pathname } = new URL(resolved);
    if (IGNORED_PATHS.some((p) => pathname.startsWith(p))) continue;
    out.push({ href, resolved });
  }
  return out;
}

async function fetchPage(url, config, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': config.userAgent ?? 'linkcheck', accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text().catch(() => '') };
  } catch (err) {
    return { status: 0, error: err?.name === 'AbortError' ? '请求超时' : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const live = process.argv.includes('--live');
  const config = await readJson(path.join(HERE, 'config.json'));
  const logger = createLogger({ tag: 'linkcheck' });

  logger.step(`站内链接检查（${live ? '线上实测' : '静态解析'}）— origin=${config.origin}`);

  const skip = new Set(['node_modules', ...(config.exclude?.dirs ?? [])]);
  const files = walkHtml(ROOT, skip);
  const pages = await collectFromSitemap(config, ROOT);

  // 以 sitemap 的页面为主，外加本地扫描到的页面，确保覆盖线上全部可索引页
  const siteItems = await collectFromSite(config, ROOT);
  const pageUrls = [...new Set([...pages.map((p) => p.url), ...siteItems.map((i) => i.url)])];

  logger.info(`本地 HTML 文件 ${files.length} 个；页面 URL ${pageUrls.length} 个`);

  const violations = [];
  const probed = new Map();

  if (!live) {
    // ---------- 静态：解析本地文件里的站内链接 ----------
    for (const file of files) {
      const base = baseUrlOf(file, ROOT, config);
      if (!base) continue;
      const html = await readFile(file, 'utf8');
      for (const { href, resolved } of collectHrefs(html, base)) {
        if (!resolved.startsWith(config.origin)) continue;
        if (new URL(resolved).pathname.endsWith('.html')) {
          violations.push({ file: path.relative(ROOT, file).split(path.sep).join('/'), href, resolved, reason: '仍指向 .html（会被 308 跳转）' });
        }
      }
    }
  } else {
    // ---------- 线上：抓真实页面并实测每个站内链接 ----------
    const targets = new Map(); // resolved -> 首次出现的来源页

    for (const pageUrl of pageUrls) {
      const res = await fetchPage(pageUrl, config);
      if (res.status !== 200) {
        violations.push({ file: '线上', href: pageUrl, resolved: pageUrl, reason: `页面本身不可达（${res.status}${res.error ? ` ${res.error}` : ''}）` });
        continue;
      }
      for (const { href, resolved } of collectHrefs(res.body, pageUrl)) {
        if (!resolved.startsWith(config.origin)) continue;
        if (!targets.has(resolved)) targets.set(resolved, pageUrl);
      }
    }

    logger.info(`线上提取到站内链接目标 ${targets.size} 个，开始逐个实测`);

    const entries = [...targets.entries()];
    const results = await mapLimit(entries, 6, async ([resolved, from]) => ({
      resolved,
      from,
      result: await resolveFinal(resolved, config, { timeoutMs: 20000 }),
    }));

    for (const { resolved, from, result } of results) {
      const key = `${result.status}`;
      probed.set(key, (probed.get(key) ?? 0) + 1);
      if (result.ok && result.final === resolved) continue;
      if (result.ok && result.final !== resolved) {
        violations.push({ file: from, href: resolved, resolved: result.final, reason: '发生重定向（链路过期）' });
      } else {
        violations.push({ file: from, href: resolved, resolved, reason: `不可达（${result.status} ${result.reason ?? result.error ?? ''}）`.trim() });
      }
    }
  }

  logger.step(`检查完成：共发现 ${violations.length} 处问题`);
  for (const v of violations.slice(0, 40)) {
    logger.warn(`${v.href}  →  ${v.reason}${v.file ? `（来源：${v.file}）` : ''}`);
  }
  if (violations.length > 40) logger.warn(`…另有 ${violations.length - 40} 处未逐条列出`);

  if (!violations.length) logger.ok('全部站内链接均为无扩展名规范地址，无重定向。');
  return violations.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`\n✗ 执行失败：${err?.stack ?? err}\n`);
    process.exit(1);
  });
