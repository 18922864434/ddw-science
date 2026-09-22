// tools/indexnow/lib/urls.mjs
// URL 采集、归一化、去重与文件↔URL 双向映射。
//
// 站点的关键事实（已在线核实）：
//   Cloudflare 对 *.html 返回 308 → 无扩展名地址，例如
//     /scientist.html  --308-->  /scientist
//   IndexNow 必须提交「最终可索引 URL」，因此归一化阶段强制剥离 .html 后缀，
//   否则提交的是会跳转的地址，配额被浪费且可能被判为非规范 URL。

import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { contentSignature } from './util.mjs';

const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^spm$/i, /^from$/i];

function isTrackingParam(name) {
  return TRACKING_PARAMS.some((re) => re.test(name));
}

/**
 * 将任意 URL 归一化为可提交的规范形态。
 * 返回 null 表示该 URL 不应被提交（跨域、非法、被排除）。
 */
export function normalizeUrl(input, config) {
  if (!input) return null;
  let parsed;
  try {
    parsed = new URL(String(input).trim(), config.origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== config.host.toLowerCase()) return null;

  let pathname = parsed.pathname;
  pathname = pathname.replace(/\/index\.html$/i, '/');
  pathname = pathname.replace(/\.html$/i, '');
  pathname = pathname.replace(/\/{2,}/g, '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  if (pathname === '') pathname = '/';

  const query = '';
  const keepQuery = config.include?.queryVariants === true;
  if (keepQuery && parsed.search) {
    const params = [...parsed.searchParams]
      .filter(([k]) => !isTrackingParam(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (params.length) {
      const usp = new URLSearchParams(params);
      return `${config.origin}${pathname}?${usp.toString()}`;
    }
  }

  return `${config.origin}${pathname}`;
}

/** 判断归一化后的 URL 是否命中所配置的排除规则。 */
export function isExcluded(url, config) {
  const { origin } = config;
  if (!url.startsWith(origin)) return true;
  const pathname = url.slice(origin.length) || '/';
  const excl = config.exclude ?? {};

  const bare = pathname.split('?')[0];
  if ((excl.exact ?? []).includes(bare)) return true;
  if ((excl.prefixes ?? []).some((p) => bare === p || bare.startsWith(p.endsWith('/') ? p : `${p}/`))) {
    return true;
  }
  const ext = path.extname(bare).toLowerCase();
  const nonPageExt = ['.xml', '.txt', '.json', '.js', '.css', '.map', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico', '.woff', '.woff2', '.mp4', '.webm'];
  if (nonPageExt.includes(ext)) return true;
  return false;
}

/** 仓库内 HTML 文件 → 规范 URL。返回 null 表示跳过。 */
export function repoFileToUrl(relPath, config) {
  const rel = relPath.split(path.sep).join('/').replace(/^\.\//, '');
  if (!/\.html?$/i.test(rel)) return null;
  if ((config.exclude?.files ?? []).includes(rel)) return null;

  let pathname = `/${rel.replace(/\.html?$/i, '')}`;
  if (pathname.endsWith('/index')) pathname = pathname.slice(0, -'index'.length) || '/';
  return normalizeUrl(`${config.origin}${pathname}`, config);
}

/** 规范 URL → 仓库相对文件路径（用于比对线上内容与本地内容）。 */
export function urlToRepoFile(url, config) {
  if (!url.startsWith(config.origin)) return null;
  let pathname = url.slice(config.origin.length).split('?')[0];
  if (pathname === '/' || pathname === '') return 'index.html';
  pathname = pathname.replace(/^\/|\/$/g, '');
  return `${pathname}.html`;
}

function walkHtml(dir, config, root, out) {
  const skipDirs = new Set(config.exclude?.dirs ?? []);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || skipDirs.has(rel) || entry.name.startsWith('.')) continue;
      walkHtml(abs, config, root, out);
    } else if (/\.html?$/i.test(entry.name)) {
      if (skipDirs.has(rel)) continue;
      out.push(rel);
    }
  }
}

/** 扫描站点目录，返回所有页面 URL（含来源标记）。 */
export async function collectFromSite(config, root) {
  const siteRoot = path.resolve(root, config.siteRoot ?? '.');
  const files = [];
  walkHtml(siteRoot, config, siteRoot, files);

  const items = [];
  for (const rel of files) {
    const url = repoFileToUrl(rel, config);
    if (!url || isExcluded(url, config)) continue;
    const html = await readFile(path.join(siteRoot, rel), 'utf8');
    items.push({ url, source: 'site', file: rel, signature: contentSignature(html) });
  }
  return items;
}

/** 解析 sitemap.xml，返回 { loc, lastmod } 列表。 */
export async function collectFromSitemap(config, root) {
  const file = path.resolve(root, config.sitemap ?? 'sitemap.xml');
  let xml;
  try {
    xml = await readFile(file, 'utf8');
  } catch {
    return [];
  }
  const items = [];
  const blocks = xml.split(/<url\b/i).slice(1);
  for (const block of blocks) {
    const locMatch = /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(block);
    if (!locMatch) continue;
    const url = normalizeUrl(locMatch[1], config);
    if (!url || isExcluded(url, config)) continue;
    const lastmodMatch = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(block);
    items.push({ url, source: 'sitemap', lastmod: lastmodMatch ? lastmodMatch[1] : null });
  }
  return items;
}

/**
 * 合并多来源并去重。
 * 同源多来源只是信息聚合，不计为冲突。
 */
export function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.url) continue;
    const existing = map.get(item.url);
    if (!existing) {
      map.set(item.url, { url: item.url, sources: new Set([item.source]), file: item.file ?? null, signature: item.signature ?? null, lastmod: item.lastmod ?? null });
      continue;
    }
    existing.sources.add(item.source);
    existing.file = existing.file ?? item.file ?? null;
    existing.signature = existing.signature ?? item.signature ?? null;
    if (item.lastmod && (!existing.lastmod || item.lastmod > existing.lastmod)) existing.lastmod = item.lastmod;
  }
  return [...map.values()]
    .map((v) => ({ ...v, sources: [...v.sources] }))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}

function git(args, root) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * 增量来源：git diff 得到的变更文件 → URL。
 * 删除的文件不参与提交（IndexNow 无删除语义），因此使用 --diff-filter=ACMR。
 */
export function collectFromGit({ base, head, config, root }) {
  let range;
  try {
    if (base && !/^0{40}$/.test(base)) range = `${base}..${head || 'HEAD'}`;
    else if (base) range = `${head || 'HEAD'}~1..${head || 'HEAD'}`;
    else range = 'HEAD~1..HEAD';
    const files = git(['diff', '--name-only', '--diff-filter=ACMR', range], root).split('\n').filter(Boolean);
    return { range, files, items: files.map((f) => ({ url: repoFileToUrl(f, config), source: 'git', file: f })).filter((i) => i.url && !isExcluded(i.url, config)) };
  } catch (err) {
    return { range: null, files: [], items: [], error: err.message };
  }
}

/** 读取某个 commit 的提交日期（YYYY-MM-DD）。 */
export function commitDate(ref, root) {
  try {
    return git(['show', '-s', '--format=%cs', ref], root);
  } catch {
    return null;
  }
}
