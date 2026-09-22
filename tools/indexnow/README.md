# IndexNow 接入方案 · ddw-science.com

> 适用站点：https://ddw-science.com（Cloudflare 托管的纯静态站，源仓库 `18922864434/ddw-science`）
> 工具位置：`tools/indexnow/`　密钥文件：`<key>.txt`（站点根目录）

---

## 0. 结论摘要

| 项目 | 结论 |
| --- | --- |
| 站点形态 | 纯静态 HTML，27 个可索引页面（13 个主页面 + 15 篇论文页，排除 `404`） |
| 托管方式 | Cloudflare；`*.html` 自动 **308** 跳转到无扩展名地址 |
| 提交地址 | `https://api.indexnow.org/indexnow`（单次请求最多 10000 条 URL） |
| 密钥 | `5c3ba58f7e6bfd43cda9374ce850898a`，公开文件 `https://ddw-science.com/5c3ba58f7e6bfd43cda9374ce850898a.txt` |
| 全量触发 | 手动 `workflow_dispatch` / 每周一 09:00 定时兜底 / 本地 CLI |
| 增量触发 | `push` 到 master，基于 `git diff` + `sitemap lastmod` |
| 去重 | URL 归一化（剥离 `.html`、丢弃查询串、排序）→ Set 合并 → 状态文件 TTL 窗口 |
| 重试 | 429 / 5xx / 网络异常指数退避（5 次、上限 30s、含抖动、尊重 `Retry-After`）；400/403/422 不重试 |
| 落地状态 | **已上线**。canonical / sitemap / llms.txt 修正与 693 处站内相对链接统一均已部署生效（线上链接实测零重定向）；工具链已完成多轮真实推送，`api.indexnow.org` 返回 **200**，27 个 URL 全部提交 |

---

## 1. 现状核实（在线实测，非推断）

在写方案前对代码库与线上行为做了实测，以下结论直接决定设计：

| 观测项 | 实测结果 | 对方案的影响 |
| --- | --- | --- |
| `https://ddw-science.com/scientist` | `200` | 无扩展名地址是**最终可索引形态** |
| `https://ddw-science.com/scientist.html` | `308` → `/scientist` | 提交 `.html` 地址会被跳转，属于无效提交 |
| `https://ddw-science.com/videos.html?c=icdd-lectures` | `308` → `/videos?c=icdd-lectures` | 参数变体与主文档同源 |
| `sitemap.xml` 的 URL 形态 | 无扩展名（`/scientist`） | sitemap 形态正确，可直接作为 URL 源头 |
| 26 个页面的 `canonical`（及同类自引用共 140 处） | 原指向 `*.html`（会被 308），已改为无扩展名并上线 | 见 §12.1（已修复） |
| `videos.js` 的 `?c=` / `?v=` | 纯前端 `location.search` 过滤，同一份 HTML | 参数变体不产生可索引的独立内容，不应单独提交 |
| `Server` / `Cache-Control` | `cloudflare` / `public, max-age=0, must-revalidate` | 特征符合 Cloudflare Pages，部署为异步构建 |
| `robots.txt` | 已放行全部主流爬虫，含 `GPTBot`、`PerplexityBot`、`CCBot`、`anthropic-ai` | 抓取许可已就绪，无需改动 |

**由此得出三条硬性设计约束：**

1. 提交的 URL 必须剥离 `.html` 后缀；
2. 必须丢弃 `?c=` 查询参数变体，只提交 `/videos`；
3. 推送必须发生在 Cloudflare 部署生效**之后**，否则引擎抓到的是旧内容。

---

## 2. IndexNow 的能力边界（重要澄清）

你的判断「IndexNow 是该站唯一可用的主动提交通道」在**主动提交**这个范畴内是准确的，但需要精确区分它覆盖什么、不覆盖什么，以免对效果产生错误预期：

**IndexNow 直接覆盖的引擎**：Bing、Yandex、Seznam、Naver、Yep。提交到 `api.indexnow.org` 会由协议层分发到全部参与引擎，无需逐个提交。

**IndexNow 不覆盖的**：

- **Google 不参与 IndexNow**。Google 侧主动提交只能走 Search Console 的 Sitemap 提交与 URL Inspection，不存在 HTTP 提交接口。
- **AI 爬虫（GPTBot / ClaudeBot / PerplexityBot / CCBot）不消费 IndexNow**。它们是独立爬虫，不读取该协议，也不读 `sitemap.xml` 的推送语义，只按自己的调度周期抓取。

因此，「对 AI 引擎最直接的途径」这一表述需要修正为：IndexNow 解决的是 **Bing 系索引时效性**（进而影响 Copilot 这类以 Bing 索引为底座的答案引擎），对 OpenAI / Anthropic / Perplexity 的自有爬虫则**没有直接作用**。针对这部分，本仓库已具备的三个杠杆才是关键，且都无需改动：

| 杠杆 | 现状 | 作用 |
| --- | --- | --- |
| `robots.txt` AI 爬虫白名单 | 已放行 | 取得抓取许可 |
| `llms.txt` | 已存在，含页面索引与关键概念 | 为 AI 引擎提供结构化摘要入口 |
| 纯静态 + 轻量 HTML | 单页 13–54 KB | 降低抓取成本，提高重访频率 |

结论：**应当做 IndexNow**（增量成本极低、Bing 系收益明确），但不要把它当作 AI 引擎抓取的唯一依赖。

---

## 3. 整体实现思路

单一数据流，三种输入来源收敛到同一条「归一化 → 校验 → 提交」管线：

```
                    ┌──────────────────────────────┐
  全量来源           │  sitemap.xml（28 条原始记录）  │
                    │  站点文件扫描（27 个 .html）   │
                    └──────────────┬───────────────┘
                                   │
  增量来源           ┌──────────────┴───────────────┐
                    │  git diff 变更文件 → URL       │
                    │  sitemap lastmod ≥ since       │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ ① 归一化 normalizeUrl          │
                    │   去 .html / 丢查询串 / 去尾斜杠 │
                    │   同域校验 / 排除规则            │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ ② 去重 dedupe（Set 语义）      │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ ③ 等待部署生效（内容指纹比对）   │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ ④ 线上校验（HEAD/GET 跟踪跳转） │
                    │   非 200 剔除 / 跳转地址纠正     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ ⑤ TTL 去重（state.json，24h）  │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ ⑥ 分批提交 + 退避重试          │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ ⑦ 状态回写 + JSONL 日志 + 报告 │
                    └──────────────────────────────┘
```

设计取舍说明：

- **为什么用 sitemap 而不是爬页面链接**：sitemap 已经是人工维护的权威清单，且形态正确（无扩展名）；页面内链接存在大量锚点与外部链接，解析成本高、噪声大。
- **为什么同时保留文件扫描**：sitemap 会漏（实测 `/videos` 就不在 sitemap 里，只有两个 `?c=` 变体）。文件扫描是兜底，保证「有页面就一定被推送」。
- **为什么用 git diff 而不是纯状态文件判增量**：无需维护「上次推送了什么」的复杂快照，变更集天然来自版本控制，可审计、可复现。状态文件只承担 24 小时 TTL 防抖，职责单一。

---

## 4. 接口与密钥配置

### 4.1 接口

| 项目 | 值 |
| --- | --- |
| 主端点 | `POST https://api.indexnow.org/indexnow` |
| 备用端点 | `https://www.bing.com/indexnow`（主端点故障时自动切换） |
| 请求头 | `Content-Type: application/json; charset=utf-8` |
| 请求体 | `{ host, key, keyLocation, urlList: [...] }` |
| 单请求上限 | 10000 条 URL（另受 1 MB 载荷约束，本工具两者同时校验） |
| 认证方式 | 无签名，仅靠**密钥文件可公开访问**完成归属校验 |

请求体示例：

```json
{
  "host": "ddw-science.com",
  "key": "5c3ba58f7e6bfd43cda9374ce850898a",
  "keyLocation": "https://ddw-science.com/5c3ba58f7e6bfd43cda9374ce850898a.txt",
  "urlList": [
    "https://ddw-science.com/",
    "https://ddw-science.com/research",
    "https://ddw-science.com/papers/2025-rwd-2649"
  ]
}
```

### 4.2 密钥

- **密钥不是机密**。IndexNow 的设计要求密钥文件必须能被公网匿名读取（`curl https://ddw-science.com/<key>.txt` 必须返回密钥本身），因此写入仓库是**正确且必要**的做法，无需放进 GitHub Secrets。
- 密钥格式：8–128 位，仅允许 `a-z A-Z 0-9`。本次生成 `5c3ba58f7e6bfd43cda9374ce850898a`（32 位十六进制）。
- 密钥文件：仓库根目录 `5c3ba58f7e6bfd43cda9374ce850898a.txt`，内容为 32 字节、**无换行符**（部分校验器对末尾空白敏感）。
- 部署后必须可达：`https://ddw-science.com/5c3ba58f7e6bfd43cda9374ce850898a.txt`
- 放置在仓库根目录即可，Cloudflare 会把根目录文件直接映射到域名根路径；`.txt` 不受 clean-URL 的 308 规则影响。

**轮换流程**（密钥泄露或需重置时）：生成新密钥 → 新增 `<新key>.txt` → 修改 `tools/indexnow/config.json` 的 `key` 与 `keyLocation` → 部署生效后删除旧文件 → 跑一次 `--verify-key`。

---

## 5. 全量推送

### 触发时机

| 场景 | 触发方式 | 说明 |
| --- | --- | --- |
| 首次接入 | 手动执行 `--full` | 建立完整索引基线 |
| 站点结构大改（新增栏目、批量新增论文页） | `workflow_dispatch` 选 `full` | 避免增量漏检 |
| 定期兜底 | 每周一 09:00（`cron: 0 1 * * 1`） | 防增量链路静默失效 |
| 本地即时推送 | `node tools/indexnow/cli.mjs --full` | 部署完成后手动执行 |

### 执行流程

1. **密钥预检** — `GET keyLocation`，要求 `200` 且正文（trim 后）与 `key` 完全一致；首次会重试 6 次 × 15s，容忍部署延迟。失败即终止（退出码 1）。
2. **采集** — 并行读取 sitemap 与扫描站点 HTML。
3. **归一化 + 去重** — 见 §8。
4. **等待部署生效** — 对每个有本地文件对应的 URL，比对线上 HTML 的内容指纹（去注释、折叠空白后取 SHA-256）与仓库文件是否一致。上限 120s，且采用**收敛即退出**：连续 3 轮无新增匹配就结束等待，不再空耗窗口。`liveCheck.ignoreUrls` 中的页面直接排除（原因见 §12.4）。此步为尽力而为的增强，不阻断流程——真正的提交闸门是下一步的线上可达性校验。
5. **线上校验** — 逐个 `HEAD`（`405` 时降级 `GET`），手动跟踪跳转。剔除口径刻意收窄：**仅 4xx 构成「页面不存在」的证据**，予以剔除；网络异常（超时/连接失败）与 5xx 属传输层或服务端瞬时问题，**保留并告警**，不据此判定 URL 失效——否则部署抖动时会静默漏推页面（该口径来自一次 CI 实测，详见 §12.6）。发生跳转则用最终地址替换。
6. **TTL 去重** — 24 小时内已成功提交过的 URL 跳过（`--force` 可绕过）。
7. **分批提交** — 按 10000 条 / 1 MB 双约束分批，批间隔 1s。
8. **回写与报告** — 更新 `state.json`（含 `lastSubmittedAt` / `lastStatus` / 累计次数），写 JSONL 日志与 JSON 报告。

### 实测结果（dry-run，已对生产环境校验）

```
▶ IndexNow full（dry-run） — host=ddw-science.com
  · 来源统计：站点扫描 27 条，sitemap 28 条
  ✓ 去重后待处理 27 个 URL
  · 线上校验：可提交 27 / 剔除 0 / 纠正 0
  · 共 27 个 URL，拆分为 1 个批次（每批上限 10000）
```

27 个 URL 全部返回 `200`，无死链、无重定向待纠正。

---

## 6. 增量推送

### 触发时机

**主触发：`push` 到 `master`**（GitHub Actions）。这与 Cloudflare 的部署动作同源，是唯一能与「内容真的变了」严格对齐的时机点。

不采用其他触发方式的原因：

- ❌ 文件系统 `watch` — 本地编辑频繁保存，会产生大量无效提交，且 IndexNow 对重复提交有频率限制；
- ❌ 每天定时跑增量 — 无法区分「变了」和「没变」，等价于低配全量；
- ✅ `git push` — 变更集精确、可审计、与部署天然同步。

### 执行流程

1. 由 `github.event.before..github.sha` 得到本次推送的变更文件集（`--diff-filter=ACMR`，**排除删除**：IndexNow 无删除语义，提交已不存在的 URL 没有意义）。
2. 变更文件 → URL 映射：`scientist.html` → `/scientist`，`papers/x.html` → `/papers/x`，`index.html` → `/`。
3. **叠加** sitemap 中 `lastmod ≥ base 提交日期` 的条目（覆盖「只改 lastmod 不改正文」的场景）。
4. 与全量共用同一管线：归一化 → 去重 → 等待部署 → 线上校验 → TTL 去重 → 提交。
5. 无变更时直接退出（退出码 0），不发请求。

### 实测结果

```
▶ IndexNow changed（dry-run） — host=ddw-science.com
  · git 增量范围 HEAD~1..HEAD：变更文件 3 个
  · sitemap lastmod ≥ 2026-09-04 的条目：0 条
  ✓ 去重后待处理 3 个 URL
```

最近一次提交（`d700472 9.7 修改文案`）改动了 `index.html`、`conferences.html`、`about-ddw.html` 三个文件，工具精确识别为 3 个 URL，未产生任何额外噪声。

### 请求量估算

单次提交 1 个请求（27 个 URL 远低于 10000 上限）。日常增量为 1–5 个 URL，仍是 1 个请求。**请求量极低，不存在触发限流的风险**；429 分支仅为防御性设计。

---

## 7. 代码模块清单

### 7.1 新增文件

| 文件 | 职责 |
| --- | --- |
| `<key>.txt` | IndexNow 归属校验文件，必须位于站点根目录且公开可读 |
| `BingSiteAuth.xml` | Bing Webmaster Tools 站点验证文件，同样位于站点根目录（Bing 会逐字节比对，不可改动内容） |
| `tools/indexnow/config.json` | 唯一配置入口：host、origin、key、keyLocation、端点、批量与重试策略、去重与排除规则 |
| `tools/indexnow/cli.mjs` | 命令行编排：参数解析、模式分派、管线串联、退出码与报告 |
| `tools/indexnow/lib/urls.mjs` | URL 归一化、排除判定、文件↔URL 双向映射、sitemap 解析、`git diff` 增量采集 |
| `tools/indexnow/lib/submit.mjs` | 状态码语义化、分批策略、退避重试、备用端点切换、密钥预检 |
| `tools/indexnow/lib/state.mjs` | 状态加载/保存、TTL 去重、成功记账、过期条目清理 |
| `tools/indexnow/lib/live.mjs` | 线上可达性校验（跟踪跳转）、部署生效等待（内容指纹比对） |
| `tools/indexnow/lib/util.mjs` | SHA-256、内容指纹、同步日志器、指数退避与 `Retry-After` 解析、并发受限映射 |
| `tools/indexnow/state.json` | 提交状态存储，格式 `{ version, updatedAt, urls: { url: {...} } }` |
| `tools/indexnow/logs/` | JSONL 逐条日志 + JSON 报告。**已加入 `.gitignore`，不入库**：仅作为 CI artifact 归档 30 天，避免公网部署与额外的 Cloudflare 构建 |
| `tools/indexnow/linkcheck.mjs` | 站内链接守卫：确认站内链接不指向会被 308 跳转的 `.html` 地址。支持静态解析与 `--live` 线上逐链实测 |
| `.gitignore` | 排除运行日志目录 |
| `.github/workflows/indexnow.yml` | 触发编排：push 增量、手动全量、每周兜底、状态回写、报告归档 |

### 7.2 需改动的现有文件

| 文件 | 改动 | 必要性 |
| --- | --- | --- |
| 26 个 HTML 页面的 `canonical` 及同类自引用 | 去掉 `.html` 后缀，与 308 后的最终 URL 对齐 | 已完成，见 §12.1 |
| `sitemap.xml` | 两条 `videos.html?c=...` 替换为单条 `/videos` | 见 §12.2（已修复） |
| 28 个 HTML 文件的 693 处站内相对链接 | 统一改为无扩展名：`index.html`→`./`、`../index.html`→`../`，其余直接去后缀 | 已完成，见 §12.1 |
| `assets/js/videos.js` | 运行时拼接的合集切换链接 `videos.html?c=` → `videos?c=`（该处在 HTML 之外，纯文本检索无法覆盖） | 已完成 |

### 7.3 明确不改动的部分

不触碰站点 HTML 结构、CSS/JS、`robots.txt`、`llms.txt`、HTTP 契约与 Cloudflare 部署配置。IndexNow 是**旁路系统**，只读站点文件、只发外部请求，不参与页面渲染。

---

## 8. URL 的获取与去重

### 8.1 三个来源

| 来源 | 获取方式 | 用途 |
| --- | --- | --- |
| `sitemap.xml` | 正则提取 `<loc>` 与 `<lastmod>` | 全量主源；增量判 `lastmod` |
| 站点文件扫描 | 递归遍历 `*.html`，跳过 `.git`/`.zcode`/`.workbuddy`/`tools`/`assets` 等目录 | 全量兜底，补齐 sitemap 遗漏 |
| `git diff` | `git diff --name-only --diff-filter=ACMR <base>..<head>` | 增量主源 |

### 8.2 归一化规则（按顺序执行）

以 `normalizeUrl()` 为唯一入口，所有来源统一经过：

1. 解析失败 / 非 `http(s)` / 非本站域名（`www.` 视为同域）→ **丢弃**；
2. `pathname` 以 `/index.html` 结尾 → 折叠为 `/`；
3. **剥离 `.html` 后缀**（核心规则，对应线上 308 行为）；
4. 折叠重复斜杠 `//` → `/`；
5. 非根路径去掉尾部斜杠；
6. **丢弃整个查询串与 `#fragment`**（`include.queryVariants` 设为 `true` 时保留查询串，并剔除 `utm_*` / `fbclid` / `gclid` / `spm` 等追踪参数并按键排序）；
7. 拼回 `origin + pathname`。

排除规则（`config.exclude`）：

- `exact`: `/404`
- `prefixes`: `/admin`、`/tmp`、`/assets`、`/tools`
- 非页面扩展名黑名单：`.xml .txt .json .js .css .map .pdf .jpg .png .webp .svg .ico .woff .woff2 .mp4 .webm`
- 文件名黑名单：`404.html`

### 8.3 两层去重

| 层级 | 机制 | 解决的问题 |
| --- | --- | --- |
| 层一：集合去重 | `Map<url, {sources, file, signature}>`，同 URL 合并来源标记 | sitemap 与文件扫描的重叠（实测 28 + 27 → 27）；`?c=` 变体折叠为 `/videos` |
| 层二：时间去重 | `state.json` 中 24 小时内 `lastSubmittedAt` 且状态为 2xx 的 URL 跳过 | 短时间内反复推送同一 URL 被引擎判为垃圾提交 |

层二可通过 `--force` 绕过；超过 90 天的历史条目由 `pruneState()` 自动清理，状态文件不会无限增长。

### 8.4 关于 `?c=` 参数变体的处理决定

`sitemap.xml` 里有两条带参数的 URL（`/videos.html?c=icdd-lectures`、`?c=expert-interviews`）。经核实 `videos.js` 的 `c`/`v` 参数是**纯前端 `location.search` 过滤**，三个地址加载的是同一份 HTML 文档，且 canonical 统一指向 `/videos`。

**决定：不单独提交查询变体，只提交 `/videos`。** 理由：它们不构成可索引的独立内容，提交后会与规范化地址形成竞争，属于负收益。若未来改为服务端渲染独立页面，把 `config.json` 的 `include.queryVariants` 改为 `true` 即可启用。

---

## 9. 推送结果的处理与错误重试

### 9.1 状态码处理策略

| 状态码 | 语义 | 处理 | 是否重试 |
| --- | --- | --- | --- |
| `200` | 全部 URL 提交成功 | 记账为成功 | 否 |
| `202` | 已受理，密钥校验待完成（首次提交常见） | 视为成功，日志标注 | 否 |
| `400` | 请求格式无效（JSON/字段有误） | 立即终止，退出码 1 | 否（重试无意义） |
| `403` | 密钥无效或 `keyLocation` 不可访问 | 立即终止，退出码 1 | 否 |
| `422` | URL 不属于该 host，或 key 与 keyLocation 不匹配 | 立即终止，退出码 1 | 否 |
| `429` | 请求过于频繁 | 按 `Retry-After` 退避（上限 120s） | 是 |
| `5xx` | 服务端错误 | 指数退避 | 是 |
| `0` | 网络异常 / 超时（30s） | 指数退避 | 是 |

`400/403/422` 一律**不重试**——这三类都是配置或数据错误，重试只会重复失败并浪费配额，直接失败暴露问题才是正确行为。

### 9.2 退避参数

`delay = min(base × 2^(n-1), 30000ms)`，叠加 ±30% 抖动；存在 `Retry-After` 时优先采用（上限 120s）。参数位于 `config.json` 的 `retry` 节：

```json
{ "maxAttempts": 5, "baseDelayMs": 1000, "maxDelayMs": 30000,
  "jitterRatio": 0.3, "respectRetryAfter": true, "maxRetryAfterMs": 120000 }
```

即实际等待序列约为 `1s → 2s → 4s → 8s → 16s`（含抖动），最长覆盖约 31 秒的服务端抖动窗口。

### 9.3 端点降级

每个批次先发主端点 `api.indexnow.org`；若返回可重试错误且重试耗尽，自动切换备用端点 `www.bing.com/indexnow` 再试。两者是同一协议的不同接入点。

### 9.4 退出码与告警

| 退出码 | 含义 | CI 表现 |
| --- | --- | --- |
| `0` | 成功或无需提交 | 绿色 |
| `1` | 配置/密钥错误，或协议级致命错误 | 红色，需人工修复 |
| `2` | 部分批次重试耗尽仍失败 | 红色，可先观察是否自愈（下一轮全量兜底） |

### 9.5 可观测性

- **JSONL 日志**：`tools/indexnow/logs/indexnow-YYYY-MM-DD.jsonl`，逐条含时间戳、级别、消息与结构化附加字段。
- **JSON 报告**：每次执行生成 `report-<ts>.json`，包含各来源计数、剔除/纠正清单、去重跳过清单、逐批状态与失败 URL 全量列表。**失败 URL 在报告中完整保留**（日志与控制台只打印前若干条，报告不截断）。
- **CI 归档**：`upload-artifact` 保留 30 天，执行后可在 Actions 页面直接下载（日志不入库，仓库不因此产生部署噪声）。
- **状态回写**：`state.json` 提交回仓库，形成跨运行的持久审计轨迹。

---

## 10. 分步操作步骤

### 阶段一：✅ 已完成 — 上线前置修复（2026-09-22）

> 理由：canonical 指向会被 308 的 `.html` 地址，与 IndexNow 要提交的最终 URL 冲突。不修则索引信号自相矛盾，提交效果打折。
> 本节保留完整命令，用于将来复现、回滚核查或站点重建。

**步骤 1.1 — 修正自引用 URL（canonical / hreflang / JSON-LD / llms.txt）**

```bash
cd /path/to/ddw-science
# 1) 全部 HTML 中的绝对自引用地址（140 处）
find . -name '*.html' -not -path './.git/*' -print0 \
  | xargs -0 sed -i -E 's#https://ddw-science\.com/([A-Za-z0-9/_.-]+)\.html#https://ddw-science.com/\1#g'
# 2) llms.txt 的页面清单
sed -i -E 's#https://ddw-science\.com/([A-Za-z0-9/_.-]+)\.html#https://ddw-science.com/\1#g' llms.txt
# 3) 相对链接中的 .html（如 conferences.html 指向 videos）
sed -i -E 's#href="videos\.html\?#href="videos?#g' conferences.html
# 4) 关键：sed 会把 CRLF 改写成 LF，必须按原始行尾还原，否则整文件被判定为重写
python - <<'PY'
import subprocess, pathlib
for name in subprocess.run(['git','diff','--name-only'],capture_output=True,text=True).stdout.split():
    p = pathlib.Path(name)
    if not p.exists(): continue
    head = subprocess.run(['git','show',f'HEAD:{name}'],capture_output=True).stdout
    crlf = head.count(b'\r\n'); lf = head.count(b'\n') - crlf
    target = b'\r\n' if crlf > lf else b'\n'
    p.write_bytes(p.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', target))
PY
```

校验：`grep -rho '<link rel="canonical" href="[^"]*"' --include=*.html . | grep -c '\.html"'` 应输出 `0`；且 `git diff --shortstat` 的变更行数应与改动处数量级一致（而非整文件行数）。

**步骤 1.2 — 修正 sitemap 的 videos 条目**

将

```xml
<url><loc>https://ddw-science.com/videos.html?c=icdd-lectures</loc>...</url>
<url><loc>https://ddw-science.com/videos.html?c=expert-interviews</loc>...</url>
```

替换为单条

```xml
<url><loc>https://ddw-science.com/videos</loc><lastmod>2026-08-31</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
```

### 阶段二：✅ 已完成 — 部署密钥与工具链（2026-09-22）

**步骤 2.1** — 确认以下文件已就位（已由本次工作创建）：`5c3ba58f7e6bfd43cda9374ce850898a.txt`、`tools/indexnow/**`、`.github/workflows/indexnow.yml`

**步骤 2.2** — 提交并推送

```bash
git add 5c3ba58f7e6bfd43cda9374ce850898a.txt tools/indexnow .github/workflows/indexnow.yml
git commit -m "feat(indexnow): 接入 IndexNow，支持全量/增量推送"
git push origin master
```

**步骤 2.3** — 等待 Cloudflare 部署完成，然后验证密钥文件（**这一步不通过，后续全部无效**）

```bash
curl -s https://ddw-science.com/5c3ba58f7e6bfd43cda9374ce850898a.txt
# 期望输出：5c3ba58f7e6bfd43cda9374ce850898a（32 个字符，无换行）
```

> 注意：本次推送会触发 workflow，但此时密钥文件可能尚未部署完成。工具已内置 6×15s 的重试容忍；若仍失败，重新触发一次即可。

### 阶段三：✅ 已完成 — 首次全量推送（2026-09-22）

**步骤 3.1 — 本地 dry-run 复核**（不产生外部提交）

```bash
node tools/indexnow/cli.mjs --full --dry-run
```

预期：`去重后待处理 27 个 URL`、`线上校验：可提交 27 / 剔除 0 / 纠正 0`。

**步骤 3.2 — 执行真实全量推送**

```bash
node tools/indexnow/cli.mjs --full
```

或走 CI：GitHub → Actions → **IndexNow 推送** → Run workflow → 模式选 `full`。

**步骤 3.3 — 核对结果**：控制台应出现 `api.indexnow.org 返回 200`；退出码为 `0`。

### 阶段四：✅ 已启用 — 增量推送

**步骤 4.1** — 增量随 `push` 自动触发，无需额外配置。验证方式：修改任一页面 → `git push` → Actions 中应出现一条成功运行，日志显示 `git 增量范围 <before>..<sha>：变更文件 N 个`。

**步骤 4.2** — 确认每周兜底已生效（`schedule` 已写入 `indexnow.yml`，每周一 09:00 全量）。

### 阶段五：验证与运维

| 检查项 | 方式 | 频率 |
| --- | --- | --- |
| 密钥文件可达 | `curl -s <keyLocation>` | 每月 |
| 全量推送成功率 | Actions 运行历史 + `report-*.json` | 每周 |
| 是否出现 403/422 | 日志中 `level=error` 条目 | 出现即查 |
| Bing 收录覆盖 | Bing Webmaster Tools（绑定后可看 IndexNow 提交量） | 每月 |
| sitemap 与站点是否同步 | `--full --dry-run` 对比「站点扫描 N 条」与 sitemap 条数 | 每次结构变更后 |

**建议**：在 Bing Webmaster Tools 中绑定站点并关联 IndexNow，可查看实际接收到的 URL 数量与抓取结果，这是唯一能获得闭环反馈的渠道。

---

## 11. 命令速查

```bash
# 全量推送（含部署等待与线上校验）
node tools/indexnow/cli.mjs --full

# 全量演练，不发请求
node tools/indexnow/cli.mjs --full --dry-run

# 增量推送（本地手动指定范围）
node tools/indexnow/cli.mjs --changed --base HEAD~1 --head HEAD

# 指定 URL
node tools/indexnow/cli.mjs --urls https://ddw-science.com/research,https://ddw-science.com/books

# 忽略 24h 去重窗口强制重推
node tools/indexnow/cli.mjs --full --force

# 仅做密钥预检
node tools/indexnow/cli.mjs --verify-key

# 跳过部署等待与线上校验（调试用，不推荐生产）
node tools/indexnow/cli.mjs --full --no-live-check
```

---

## 12. 已知风险与待确认项

### 12.1 ✅ 已修复 — canonical 与 308 跳转冲突

**现象**：26 个页面的 `<link rel="canonical">` 指向 `*.html`，而线上该地址会 308 跳转到无扩展名地址。

**影响**：Google 与 Bing 看到「canonical 指向一个会重定向的地址」，产生自相矛盾的规范化信号，可能延迟收录或选错规范页；IndexNow 提交的最终 URL 与页面自报的 canonical 不一致，削弱提交效果。

**处理**：2026-09-22 已修复并上线。范围不止 canonical——同类的自引用地址共 140 处，含 `canonical`、`hreflang alternate`、JSON-LD 面包屑与条目、`llms.txt` 页面清单，全部改为无扩展名形态。校验：线上 `sitemap.xml` 与全站 canonical 完全对齐，均为 27 条。

**同类问题（第二轮）— 站内相对链接**：导航与正文里另有 **693 处相对链接**指向 `*.html`（如 `href="../publications.html"`、`href="index.html"`），意味着用户每次点击都要多走一次 308 跳转。已统一改为无扩展名形态：`index.html` → `./`、`../index.html` → `../`、其余直接去后缀。

其中 **`assets/js/videos.js` 的合集切换链接是运行时用 JS 拼接的**（`'<a href="videos.html?c=' + ... `），纯文本检索 HTML 无法覆盖，靠全站 JS 审计才捞出来——这类"代码生成链接"是链接检查最容易漏的盲区。

同时新增 `tools/indexnow/linkcheck.mjs` 把这条不变量固化为可复跑检查，避免后续编辑又改回带后缀形式：

```bash
node tools/indexnow/linkcheck.mjs          # 静态解析（无需联网）
node tools/indexnow/linkcheck.mjs --live   # 线上逐链实测状态码
```

线上实测结果：**61 个站内链接目标全部 200，零重定向**。（检查会跳过 Cloudflare 注入的 `/cdn-cgi/l/email-protection#...` 链接——`#` 之后是 URL 片段，服务端只看到路径、必然 404，其解码由 CF 的 `email-decode.min.js` 在浏览器端完成，不是站点自身链接。）

> 批量改写注意：仓库内 HTML 使用 **CRLF** 行尾，`sed -i` 会将其改写为 LF，导致整个文件被判定为改重写（实测 `publications.html` 曾产生 788 行 diff）。改动后必须按原始行尾还原，本项目使用的还原方式见 §10 步骤 1.1 之后的说明。

### 12.2 ✅ 已修复 — sitemap 与站点清单不同步

**原问题**：`/videos` 缺失（sitemap 里只有两个 `?c=` 变体），而它正是 canonical 的目标地址；站点文件 27 个页面与 sitemap 28 条记录口径不一致。

**处理**：2026-09-22 已修复并上线。两条 `?c=` 变体合并为单条 `/videos`，现 sitemap 与站点扫描均为 27 条，完全一致。

**仍建议**：把 `lastmod` 纳入日常维护（改页面时同步更新），因为增量推送的兜底分支依赖它。本轮未改动各页面 `lastmod`——canonical 属元数据调整而非内容变更，统一刷新会削弱 `lastmod` 作为信号的可信度。

### 12.3 待确认项

| 项 | 说明 | 建议 |
| --- | --- | --- |
| `papers.json` 中 2 条 `slug` 为空的 2026 年论文 | 尚无对应页面，不在推送范围内 | 待页面创建后由增量推送自动纳入 |
| ~~Cloudflare 注入导致指纹不匹配~~ | ✅ 已确认并解决：RUM beacon 注入影响全部页面，邮箱混淆影响 `/contact` | 见 §12.4 |
| `tools/` 目录会被部署到公网 | 工具与状态文件可被匿名访问（不含机密，密钥本就公开） | 如需隐藏，可在 Cloudflare 层对 `/tools/*` 加访问规则 |
| `master` 分支保护规则 | 若禁止 GitHub Actions 直推，状态回写步骤会失败（提交本身仍成功） | 为该 job 放开 `github-actions[bot]` 直推，或改为只归档 artifact 不回写 |
| AI 爬虫抓取频率 | IndexNow 不覆盖，无闭环反馈 | 通过 Cloudflare 日志观察 `GPTBot`/`ClaudeBot` 等 UA 的实际抓取频次 |

### 12.4 Cloudflare 响应期改写导致内容指纹不可比（已解决）

Cloudflare 会在**响应阶段**改写 HTML，使线上内容与仓库文件不再逐字节相等。实测确认存在两类，机理不同，处理方式也不同。

**（一）Web Analytics / RUM beacon —— 影响全部页面，已通过归一化剥离解决**

当请求携带 HTML `Accept` 头时，Cloudflare 会在 `</body>` 前注入一段 RUM 埋点脚本：

```html
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v31edd6df..." integrity="sha512-..." data-cf-beacon='{"token":"7d6edd1c16be46e79a96efd11f6b5e76","r":1,"spa":2}' crossorigin="anonymous"></script>
```

实测数据：带 `Accept: text/html` 请求 `/videos` 返回 **8713** 字节，不带该头返回 **8346** 字节（与仓库文件完全一致），差值 367 字节即这段脚本。

**根因定位过程值得记录**：同一 URL，用默认头请求指纹一致、用 HTML `Accept` 头请求指纹不符——这说明差异既不在 CDN 缓存、也不在部署延迟，而在服务端的内容协商行为。因此没有采用「换个请求头绕过去」这种依赖 Cloudflare 隐式行为的做法，而是在内容指纹归一化阶段按域名与 `data-cf-beacon` 属性剥离该脚本。注意其 `src` 路径含构建版本号（`/v31edd6df...`）、`integrity` 随版本变化，**不能按完整字符串匹配**，否则下次 CF 更新版本即失效。

**（二）邮箱地址混淆 —— 仅影响含邮箱的页面，已通过 ignoreUrls 排除**

`/contact` 带 Accept 头时线上 **12138** 字节、仓库文件 **11759** 字节。Cloudflare 把 `info@hyd.hu`、`china-contact@ddw-science.com` 改写为 CDN 的 `email-protection` 形式并注入解码脚本——这是**正文内容的就地改写**，剥离注入脚本无法还原，因此将 `https://ddw-science.com/contact` 列入 `liveCheck.ignoreUrls`。若后续新增含邮箱的页面并出现同样症状，追加到同一数组即可。

**为什么不直接关闭这两个 Cloudflare 功能**：RUM 埋点与邮箱混淆都是 Cloudflare 侧的既有线上行为，关闭等于改变站点对外契约与数据采集，不应由本工具单方面决定。归一化剥离 + 忽略清单是成本更低的正确解法。

**修复结果**：`等待部署生效` 从「26 个页面连续 12 轮全部未匹配、空耗 180s」变为「**26/26 在 1.6s 内确认**」。

### 12.5 部署在边缘节点间的传播延迟

**这是设计层面的考量，不是已观测到故障的原因。** Cloudflare Pages 的部署在各 colo 间异步传播，理论上存在「push 后部分节点仍在返回旧内容」的窗口，因此 `等待部署生效` 这一步有必要保留。

**注意不要误归因**：首次全量推送时观察到的「27 个页面连续 12 轮全部未匹配」，经逐层定位后确认由 §12.4 的 RUM beacon 注入造成——属于**确定性**的不匹配，与传播延迟无关。排除该因素后，同一批页面在 1.6s 内全部确认。这一点有实践意义：若当时按「传播延迟」去处理（例如单纯延长等待、增加重试次数），问题永远不会被解决，只会把无效等待拉得更长。

**仍保留的防护**：把「死等到超时」改为**收敛即退出**——连续 3 轮无新增匹配即结束等待（`liveCheck.stagnantLimit`），最坏情况下的空耗从约 180s 降到约 40s。等待本身不承担正确性：真正的提交闸门是随后的线上可达性校验（非 200 一律剔除）。这与「指纹校验只是尽力而为的增强」这一定位一致。

### 12.6 校验剔除口径：只有 4xx 才算「失效」（来自 CI 实测）

**发现过程**：首次推送触发的 CI 增量推送，其状态记录只有 **26** 个 URL，而同一批内容本地全量推送是 **27** 个。差异不是来源问题（两侧都识别出 27 条），而是 `validateUrls` 的判定口径过宽——它把**任何非 200**都剔除，包括网络异常（status 0，超时或连接失败）。

**为什么不合理**：探测超时是**传输层**问题，不能推出「页面不存在」。CI 运行时机恰逢 Cloudflare 部署窗口，一次并发探测超时就把一个正常页面静默丢出推送队列——而这类失败不会报错，只会让那个页面在后续 24 小时的去重窗口内被跳过。静默漏推是这类工具最危险的失败模式。

**修正后的口径**：

| 探测结果 | 处理 | 理由 |
| --- | --- | --- |
| `200` 且无跳转 | 提交 | 正常 |
| `3xx` 跳转 | 用最终地址替换后提交 | 纠正为规范地址 |
| `4xx`（含 404/410） | **剔除**并告警 | 明确否定，提交无意义且浪费配额 |
| 网络异常 / 超时（`0`） | **保留**并告警 | 传输层问题，非页面状态证据 |
| `5xx` | **保留**并告警 | 服务端瞬时问题 |

报告与日志中新增 `transient` 字段单独记录「保留待观察」的 URL，便于事后核对。当前已记录状态为 27 个 URL（本地全量推送补齐了 CI 漏掉的那一个）。

### 12.7 首次提交返回 202 而非 200 属正常

CI 的首次提交记录为 **202**（已受理），随后本地全量提交返回 **200**。202 表示密钥校验尚未完成，是**首次向该引擎提交时**的正常响应，工具按成功处理、不重试、不告警。若后续稳定出现 202 才需要检查 `keyLocation`。

### 12.8 明确的非目标

- 不实现 Google 侧索引提交（无可用接口，需人工用 Search Console）。
- 不实现站内链接爬取发现新页面（sitemap + 文件扫描已覆盖全部场景）。
- 不引入第三方 IndexNow SaaS（自建成本已足够低，且避免把站点清单交给外部服务）。
