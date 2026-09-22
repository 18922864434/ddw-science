# ddw-science 项目长期记忆

## 站点事实
- 域名 https://ddw-science.com，纯静态 HTML 站，仓库 `git@github.com:18922864434/ddw-science.git`（主分支 master）
- 托管在 Cloudflare（Pages 形态）。关键行为：`*.html` 请求返回 **308** 跳转到无扩展名地址（`/scientist.html` → `/scientist`，`/404.html` → `/404`）；响应头特征 `Server: cloudflare`、`Cache-Control: public, max-age=0, must-revalidate`
- 可索引页面 27 个：13 个主页面 + 15 个 `papers/*.html` + `/videos`（排除 `404`）
- `papers/` 为论文详情页，列表数据源为 `papers.json`（`slug` 为空表示暂无详情页）
- 页面体量 13–54 KB，纯静态，仅依赖 jQuery + Bootstrap + video.js
- `robots.txt` 已放行 GPTBot / PerplexityBot / CCBot / anthropic-ai / Bytespider / Googlebot；站点已有 `llms.txt`

## URL 规范约定（重要）
- 站内规范 URL 一律**无扩展名、无尾斜杠**（根路径除外）、不带查询串
- 新增页面时必须同步更新 `sitemap.xml`
- ✅ 2026-09-22 已修复：canonical / hreflang / JSON-LD 自引用 / `llms.txt` 中的 `*.html` 全部去掉后缀（140 处），sitemap 中两条 `videos.html?c=` 合并为单条 `/videos`。sitemap 与 canonical 现已完全对齐（27 = 27）
- ⚠️ 未处理：站内约 670 处**相对导航链接**仍指向 `*.html`（如 `href="../publications.html"`），每次点击都会经一次 308。属独立优化项，待确认后统一改为无扩展名
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

## 工作习惯
- 站点改动以精修单个页面为主（文案、SEO、结构化数据），commit message 多为日期式短描述
- 改动前后需在线核实（`curl` 验证状态码与响应头），不依赖推断
