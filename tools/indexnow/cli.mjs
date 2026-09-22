#!/usr/bin/env node
// tools/indexnow/cli.mjs
// IndexNow 提交入口：全量推送 / 增量推送 / 指定 URL 推送。
//
// 用法：
//   node tools/indexnow/cli.mjs --full
//   node tools/indexnow/cli.mjs --changed --base <sha> --head <sha>
//   node tools/indexnow/cli.mjs --urls https://ddw-science.com/research
//   node tools/indexnow/cli.mjs --full --dry-run
//   node tools/indexnow/cli.mjs --verify-key
//
// 退出码：0 成功 / 1 配置或密钥错误（不可重试）/ 2 部分失败（重试耗尽）

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, readJson, writeJson } from './lib/util.mjs';
import {
  collectFromGit,
  collectFromSite,
  collectFromSitemap,
  commitDate,
  dedupe,
  isExcluded,
  normalizeUrl,
} from './lib/urls.mjs';
import { filterByTtl, loadState, pruneState, recordSuccess, saveState } from './lib/state.mjs';
import { submitAll, verifyKey } from './lib/submit.mjs';
import { validateUrls, waitForDeployLive } from './lib/live.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CONFIG_PATH = path.join(HERE, 'config.json');

const USAGE = `IndexNow 提交工具

模式（互斥，默认 --changed）：
  --full                 全量推送：sitemap ∪ 站点扫描
  --changed              增量推送：git 变更文件 ∪ sitemap lastmod 变化
  --urls <url,url,...>   仅推送指定 URL

选项：
  --base <sha>           git 增量起点（默认 HEAD~1）
  --head <sha>           git 增量终点（默认 HEAD）
  --since <YYYY-MM-DD>   sitemap lastmod 起始日期（默认取 base 提交日期）
  --force                忽略去重 TTL，强制重推
  --dry-run              仅输出计划，不发起提交
  --no-live-check        跳过部署等待与线上校验
  --verify-key           仅执行密钥预检
  --report <path>        输出 JSON 报告到指定路径
  --help                 显示本帮助`;

function parseArgs(argv) {
  const args = { mode: null, urls: null, flags: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--full':
      case '--changed':
      case '--verify-key':
        args.mode = token.slice(2);
        break;
      case '--urls':
        args.mode = 'urls';
        args.urls = (argv[++i] ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--base':
        args.base = argv[++i];
        break;
      case '--head':
        args.head = argv[++i];
        break;
      case '--since':
        args.since = argv[++i];
        break;
      case '--report':
        args.report = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (token.startsWith('--')) args.flags.add(token.slice(2));
        break;
    }
  }
  if (!args.mode && !args.help) args.mode = 'changed';
  return args;
}

async function resolveItems(args, config, logger) {
  if (args.mode === 'urls') {
    const items = args.urls
      .map((raw) => normalizeUrl(raw, config))
      .filter((url) => url && !isExcluded(url, config))
      .map((url) => ({ url, source: 'manual', file: null, signature: null }));
    return { items: dedupe(items), detail: { mode: 'urls', requested: args.urls.length } };
  }

  const [site, sitemap] = await Promise.all([collectFromSite(config, ROOT), collectFromSitemap(config, ROOT)]);
  logger.info(`来源统计：站点扫描 ${site.length} 条，sitemap ${sitemap.length} 条`);

  if (args.mode === 'full') {
    return {
      items: dedupe([...site, ...sitemap]),
      detail: { mode: 'full', site: site.length, sitemap: sitemap.length },
    };
  }

  const gitInfo = collectFromGit({ base: args.base, head: args.head, config, root: ROOT });
  if (gitInfo.error) logger.warn(`git 差异读取失败（${gitInfo.error}），本次仅依赖 sitemap lastmod`);
  else logger.info(`git 增量范围 ${gitInfo.range}：变更文件 ${gitInfo.files.length} 个`);

  const since = args.since ?? (args.base ? commitDate(args.base, ROOT) : null) ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const sitemapChanged = sitemap.filter((entry) => entry.lastmod && entry.lastmod >= since);
  logger.info(`sitemap lastmod ≥ ${since} 的条目：${sitemapChanged.length} 条`);

  return {
    items: dedupe([...gitInfo.items, ...sitemapChanged]),
    detail: { mode: 'changed', range: gitInfo.range, changedFiles: gitInfo.files, since },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const config = await readJson(CONFIG_PATH);
  if (!config) throw new Error(`缺少配置文件：${CONFIG_PATH}`);

  const logger = createLogger({ logDir: path.resolve(ROOT, config.logDir ?? 'tools/indexnow/logs'), tag: 'indexnow' });
  const dryRun = args.flags.has('dry-run');
  const skipLive = args.flags.has('no-live-check');

  logger.step(`IndexNow ${args.mode}${dryRun ? '（dry-run）' : ''} — host=${config.host}`);

  // ---------- 密钥预检 ----------
  if (args.mode === 'verify-key') {
    const result = await verifyKey(config, logger);
    return result.ok ? 0 : 1;
  }
  if (!dryRun) {
    const result = await verifyKey(config, logger);
    if (!result.ok) {
      logger.error('密钥预检未通过，终止本次提交。请确认密钥文件已部署并可公开访问。');
      return 1;
    }
  } else {
    logger.info('[dry-run] 跳过密钥预检');
  }

  // ---------- URL 采集与去重 ----------
  const { items: collected, detail } = await resolveItems(args, config, logger);
  if (!collected.length) {
    logger.warn('没有需要推送的 URL，流程结束。');
    return 0;
  }
  logger.ok(`去重后待处理 ${collected.length} 个 URL`);

  // ---------- 等待部署生效 ----------
  let liveResult = { skipped: true };
  if (!skipLive && !dryRun) {
    liveResult = await waitForDeployLive(collected, config, logger);
  } else {
    logger.info('[跳过] 部署生效等待');
  }

  // ---------- 线上校验 ----------
  let valid = collected;
  let dropped = [];
  let replaced = [];
  let transient = [];
  if (!skipLive) {
    const result = await validateUrls(collected, config, logger);
    valid = result.items;
    dropped = result.dropped;
    replaced = result.replaced;
    transient = result.transient;
  } else {
    logger.info('[跳过] 线上可达性校验');
  }

  const afterValidate = dedupe(valid.map((item) => ({ ...item, source: item.source ?? 'validated' })));

  // ---------- 去重（TTL）----------
  const state = await loadState(path.resolve(ROOT, config.statePath));
  let finalItems = afterValidate;
  let skipped = [];
  if (!args.flags.has('force')) {
    const filtered = filterByTtl(afterValidate, state, config.dedupe?.ttlHours ?? 24);
    finalItems = filtered.keep;
    skipped = filtered.skipped;
    if (skipped.length) logger.info(`去重跳过 ${skipped.length} 个 TTL 内已提交的 URL`);
  } else {
    logger.warn('已启用 --force，忽略去重 TTL');
  }

  if (!finalItems.length) {
    logger.ok('本次无需提交（全部命中去重窗口）。');
    const report = buildReport({ args, detail, collected, dropped, replaced, transient, skipped, summary: null, liveResult });
    await emitReport(args, report);
    return 0;
  }

  // ---------- 提交 ----------
  const summary = await submitAll(finalItems, config, logger, { dryRun });

  if (!dryRun && summary.submitted.length) {
    recordSuccess(state, summary.submitted, summary.batches.find((b) => b.ok)?.status ?? 200);
  }
  pruneState(state, config.dedupe?.pruneAfterDays ?? 90);
  if (!dryRun) await saveState(path.resolve(ROOT, config.statePath), state);

  const report = buildReport({ args, detail, collected, dropped, replaced, transient, skipped, summary, liveResult });
  await emitReport(args, report);

  // ---------- 收尾 ----------
  logger.step(
    `完成：提交成功 ${summary.submitted.length}，失败 ${summary.failed.length}，确定剔除 ${dropped.length}，保留待观察 ${transient.length}，去重跳过 ${skipped.length}`,
  );

  if (summary.fatal) {
    logger.error('存在不可重试的协议级错误（400/403/422），请检查 host、key 与 keyLocation 配置。');
    return 1;
  }
  if (summary.failed.length) {
    logger.error('部分批次在重试耗尽后仍失败，返回码 2。');
    return 2;
  }
  return 0;
}

function buildReport({ args, detail, collected, dropped, replaced, transient, skipped, summary, liveResult }) {
  return {
    generatedAt: new Date().toISOString(),
    mode: args.mode,
    dryRun: args.flags.has('dry-run'),
    detail,
    counts: {
      collected: collected.length,
      submitted: summary?.submitted.length ?? 0,
      failed: summary?.failed.length ?? 0,
      dropped: dropped.length,
      replaced: replaced.length,
      transient: transient.length,
      deduped: skipped.length,
    },
    liveCheck: liveResult,
    dropped,
    replaced,
    transient,
    skipped,
    batches: summary?.batches?.map(({ urls, ...rest }) => ({ ...rest, sample: urls.slice(0, 5) })) ?? [],
    failedUrls: summary?.failed ?? [],
  };
}

async function emitReport(args, report) {
  const target = args.report ?? path.resolve(ROOT, 'tools/indexnow/logs', `report-${Date.now()}.json`);
  try {
    await writeJson(target, report);
    process.stdout.write(`  报告：${target}\n`);
  } catch (err) {
    process.stdout.write(`  ! 报告写入失败：${err.message}\n`);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`\n✗ 执行失败：${err?.stack ?? err}\n`);
    process.exit(1);
  });
