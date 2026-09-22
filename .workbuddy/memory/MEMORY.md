# ddw-science 项目长期记忆

## 站点事实
- 域名 https://ddw-science.com，纯静态 HTML 站，仓库 `git@github.com:18922864434/ddw-science.git`（主分支 master）
- 托管在 Cloudflare（Pages 形态）。关键行为：`*.html` 请求返回 **308** 跳转到无扩展名地址（`/scientist.html` → `/scientist`，`/404.html` → `/404`）；响应头特征 `Server: cloudflare`、`Cache-Control: public, max-age=0, must-revalidate`
- 可索引页面 27 个：13 个主页面 + 15 个 `papers/*.html` + `/videos`（排除 `404`）
- `papers/` 为论文详情页，列表数据源为 `papers.json`（`slug` 为空表示暂无详情页）
- 页面体量 13–54 KB，纯静态，仅依赖 jQuery + Bootstrap + video.js
- `robots.txt` 已放行 GPTBot / PerplexityBot / CCBot / anthropic-ai / Bytespider / Googlebot；站点已有 `llms.txt`
- 站点根目录另有两个校验文件：IndexNow 密钥 `.txt`、`BingSiteAuth.xml`（Bing Webmaster Tools 验证，用户 hash `DAAD366E6BEA97ACDDA9B37FC21D6300`，Bing 会逐字节比对，勿改动内容）
- 部署后验证方式：`curl -s -o /dev/null -w '%{http_code}' https://ddw-science.com/<文件名>`，约 20–60s 生效

## URL 规范约定（重要）
- 站内规范 URL 一律**无扩展名、无尾斜杠**（根路径除外）、不带查询串
- 新增页面时必须同步更新 `sitemap.xml`
- ✅ 2026-09-22 已修复：canonical / hreflang / JSON-LD 自引用 / `llms.txt` 中的 `*.html` 全部去掉后缀（140 处），sitemap 中两条 `videos.html?c=` 合并为单条 `/videos`。sitemap 与 canonical 现已完全对齐（27 = 27）
- ✅ 2026-09-22 已修复：站内 **693 处相对链接**统一为无扩展名（`index.html`→`./`、`../index.html`→`../`）。含 `assets/js/videos.js` 中**运行时 JS 拼接**的合集切换链接——该处在 HTML 之外，纯文本检索必漏，需审计自定义 JS。线上实测 61 个站内目标零重定向
- 守卫工具 `tools/indexnow/linkcheck.mjs`：`--live` 可线上逐链实测状态码，用于防止改回带后缀形式
- `videos.js` 的 `?c=` / `?v=` 是纯前端过滤，不产生独立可索引内容，canonical 统一为 `/videos`
- 批量改写 HTML 时注意：仓库内 HTML 为 **CRLF** 行尾，`sed -i` 会改写成 LF 导致整文件 diff。改完须按原始行尾还原

## IndexNow 接入（2026-09-22 落地）
- key `5c3ba58f7e6bfd43cda9374ce850898a`，密钥文件位于仓库根目录同名 `.txt`（32 字节、无换行）
- 端点 `https://api.indexnow.org/indexnow`，备用 `https://www.bing.com/indexnow`；单请求上限 10000 条 URL
- 工具目录 `tools/indexnow/`：`cli.mjs` 入口 + `lib/{urls,submit,state,live,util}.mjs`，配置集中在 `config.json`
- 全量推送：`node tools/indexnow/cli.mjs --full`（来源 = sitemap ∪ 站点文件扫描）
- 增量推送：push 到 master 时由 `.github/workflows/indexnow.yml` 触发（来源 = git diff ∪ sitemap lastmod）
- 去重两层：URL 归一化 + Map 合并；`state.json` 24 小时 TTL（`--force` 可绕过）
- 提交前置：必须 `--verify-key` 通过（keyLocation 可公开访问且内容一致），否则直接退出码 1
- 能力边界：IndexNow 覆盖 Bing/Yandex/Seznam/Naver/Yep，**不覆盖 Google**；GPTBot/ClaudeBot 等 AI 爬虫不消费该协议
- 响应码语义：**200 = 已接受**；**202 = 首次提交、密钥校验待处理**（正常，按成功处理）；400/403/422 为配置或数据错误不重试；429/5xx 退避重试
- ⚠️ **422 风险**：官方 FAQ 明确「重复提交未发生实质变更的 URL」可能返回 422。因此 `--force` 不可连续用于重推同一批未变更 URL；正确节奏是「内容变更 → 推送」，不要为了让 BWT 面板出数据而反复推送
- BWT 的 IndexNow 报告**只对已在账号中验证过的站点生效**，且报告本身有数小时至 24–48h 的处理延迟。提交发生在站点验证之前时，可能不被回溯归属
- 排查「BWT 无数据」的正确顺序：先确认站点已验证 → 看报告延迟是否足够 → 再考虑间隔较久后补推一次（而非密集重试）

## Cloudflare 响应期改写（做内容比对时必须知道）
- **RUM beacon 注入**：请求带 HTML `Accept` 头时，CF 会在 `</body>` 前注入 `static.cloudflareinsights.com/beacon.min.js`（实测 `/videos`: 8713 vs 8346 字节，差 367 字节）。不带该头则不注入。任何"线上内容 vs 仓库文件"的比对都必须先剥离它，否则全部页面确定性不匹配
- **邮箱地址混淆**：`/contact` 的 `info@hyd.hu`、`china-contact@ddw-science.com` 被就地改写为 `email-protection` 形式（12138 vs 11759 字节），无法通过剥离还原
- 两者均为 CF 侧既有行为，不应为了工具便利去关闭；正确做法是归一化剥离 + 忽略清单（`liveCheck.ignoreUrls`）
- 定位手法：同一 URL 换请求头后结果由不符变相符 → 先排除缓存与部署延迟，再看服务端内容协商

## 工作习惯
- 站点改动以精修单个页面为主（文案、SEO、结构化数据），commit message 多为日期式短描述
- 改动前后需在线核实（`curl` 验证状态码与响应头），不依赖推断
- 本机走 HTTP 代理（`127.0.0.1:7890`），偶发对特定域名 TLS 握手失败、`curl` 返回 **000**。遇到 000 先用 `curl --noproxy '*'`（或 `NO_PROXY=<域名>`）对照再下结论，勿误判为站点故障。Node 的 fetch 同样走该代理（会打印 UNDICI EnvHttpProxyAgent 警告）
- ⚠️ 批量改写 HTML 前先确认行尾符：本仓库 HTML 为 **CRLF**，`sed -i` 会改写成 LF 造成整文件 diff，必须按 HEAD 原始行尾还原
