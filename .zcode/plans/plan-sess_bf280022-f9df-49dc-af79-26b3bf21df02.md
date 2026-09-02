# Preventa 学术站完成度对齐与内容完善 · 实施方案

## 总览：修正后的真实工作范围

审计核对后，你评估清单中以下项**实际已完成**（`_patch_meta.py` 已注入但未提交），不重复做：
- robots.txt：7 个 AI 爬虫白名单全到位 + `Disallow: /admin/`、`/tmp/` ✅
- 每页 `meta author=HYD LLC`、`meta robots=index,follow,max-snippet:-1,max-image-preview:large` ✅
- 每页 canonical 指向自身绝对 URL、`lang=zh-CN` ✅
- FAQPage 已有 2 处（index.html 5 Q&A + about-ddw.html 6 Q&A）✅
- 内容红线全守住（站点 .html/.js/.json/.css 零 Preventa、零购买/价格、零疗效承诺）✅
- CSS 无 Preventa 痕迹 ✅

**真实缺口**集中在以下 8 类，按 P0→P1→P2 顺序实施。

---

## P0 · 合规与 GEO 技术修复

### 1. hreflang en 修正（11 页 + sitemap.xml）
- **11 页 head**：删除 `<link rel="alternate" hreflang="en" href="https://ddw-science.com/en/...">`，替换为 HTML 注释 `<!-- hreflang en 预留：英文版上线后启用 -->`；保留 `hreflang="zh-CN"` 自指向。
- **sitemap.xml**：删除全部 11 条 `<xhtml:link rel="alternate" hreflang="en" ...>`，仅保留 zh-CN self alternate 或直接去掉 alternate（纯中文站可不要 alternate）。
- 理由：`/en/` 路径不存在，指向它会让搜索引擎抓到 404 损害 SEO；注释预留符合规范"直接启用"本意。

### 2. 补 BreadcrumbList（scientist.html、contact.html）
- scientist.html、contact.html 当前缺 BreadcrumbList，按其他页模板补（首页→本页）。

### 3. Gábor 残留处理（publications.html:401、papers.json:380）
- 残留在 1993 FEBS 论文合著者 "Gábor Jancsó" 名中。
- **处理**：保留合著者学术本名 Gábor Jancsó（改论文原作者名属学术不端），在 §07 检查清单口径里注明"全站无 Gábor 指的是 Somlyai 品牌名标准化，不影响论文合著者本名"。若你坚持字面"全站无 Gábor"，则改为 Gabor Jancso，请在执行时告知。

### 4. experts.html 姓名归一
- `Boros G. László 教授` → `László G. Boros 教授`（顺序归正，保留 László 重音为学术本名）
- `Cong Fengsong 教授` → `丛峰松 教授`（表格行 + 证言卡片 + 任何 `data-` 属性，全页替换）

### 5. scientist.html 首段博士名
- H1 已是"高博·索姆利艾博士 (Gábor Somlyai)"，但首段正文第一次出现是纯英文 "Gábor Somlyai"。
- 改首段首提为"高博·索姆利艾博士 (Gábor Somlyai)"，后续可用"索姆利艾"或"高博·索姆利艾博士"。

### 6. 计数动画死代码
- `assets/js/jquery.counterup.min.js`、`assets/js/jquery.waypoints.min.js` 存在但未被任何 HTML 引入；`ddw-main.js` 有计数逻辑但无 `data-count` 钩子。
- **方案**：在 index.html（计数器所在页）`</body>` 前补引入 waypoints + counterUp 脚本，并给计数 `<div class="num">` 加 `data-count` 属性 + 类钩子，激活动画。若你倾向轻量化，改为移除死代码文件 + 删 ddw-main.js 计数段，数字静态显示。默认执行前者（激活动画）。

### 7. 图片 lazy loading
- 全站 12 张 `<img>`（scientist 1 + experts 8 + index 3）均无 `loading="lazy"`。
- 为所有 `<img>` 补 `loading="lazy"` + `decoding="async"`。
- WebP 转换为可选项（89 张 jpg），本次默认不强制做，若你要求再批量转。

### 8. 临时文件清理
- 删除 `_tmp_spec.txt`、`_tmp_kb_toc.txt`、`_patch_meta.py`、`_filter_check.js`（含品牌词与硬编码 en URL 的补丁逻辑，不上线）。
- 保留 `llms.txt` 但修正其中"60 篇"为统一口径（见 P0 第 2 节）。

---

## P0 · 论文口径统一（最大数据矛盾）

### 现状
- papers.json：46 条
- publications.html 筛选按钮"全部 46 篇" + 46 个论文卡（一致）
- 但 ItemList `numberOfItems:60`、总览文案、正文标题、index.html、research.html、llms.txt 全写"60 篇"
- 知识库 60 篇分类：肿瘤 37 / 代谢 6 / 抗衰 6 / 运动 2 / 免疫 5 / 皮肤 3（=59，差 1 可能计数）
- publications.html 筛选按钮分类：肿瘤 34 / 代谢 8 / 抗衰 2 / 运动 1 / 免疫 1（与知识库分类数不符）

### 处理方案
1. **核对 papers.json**：以知识库"60 篇论文分类汇编"为基准，逐篇核对现有 46 条，补齐可核验 DOI/期刊/年份的缺失论文（目标补到接近 60，核不到出处的不硬凑）。
2. **数字口径统一**（全站）：
   - 对外表述："该领域全球已发表同行评议论文约 60 篇"
   - 站内索引/筛选按钮/ItemList：`numberOfItems` 与实际收录数 N 一致（N = papers.json 最终条数），文案改为"本站已收录并索引 N 篇"
   - index.html 数据条："60 篇" → "约 60 篇"（或"该领域已发表约 60 篇"）
   - research.html 六大方向统计：统一为知识库口径 37/6/6/2/5/3
   - publications.html 筛选按钮分类数：与 papers.json 实际分类数同步
   - llms.txt 同步修正
3. **publications.html 接线 papers.json**：将硬编码 46 个论文卡改为 JS `fetch('papers.json')` 动态生成列表，papers.json 为唯一数据源，避免双维护。保留 7 篇里程碑精选区（手动维护，链向单篇页）。
4. **ItemList 补 itemListElement**：publications.html 的 ItemList 当前是空壳（只有 numberOfItems），补全 itemListElement 数组（每项含 url/name/position），与实际收录数一致。
5. **去掉"PDF 与中文 DOCX 双格式"虚标**：核实 publications.html 是否标 DOCX，若标则改为实际情况（站内仅 PDF 链接或仅元数据，无 DOCX 则删该标注）。

---

## P1 · 单篇论文解读页（ScholarlyArticle 落地）

### 新建 papers/ 目录 + 15 篇单页
知识库给出 15 篇可核验 DOI/期刊/年份的核心论文清单，作为首批单篇解读页：

| # | 年份 | 论文 | 期刊 | DOI/PMID |
|---|---|---|---|---|
| 1 | 1993 | 天然存在的氘对于细胞正常生长速度至关重要 | FEBS Letters 317:1-4 | - |
| 2 | 2005 | 贫氘饮用水对运动员表现的影响（赛艇 12 人） | Sportorvosi Szemle 46/1:27-38 | - |
| 3 | 2011 | 氘耗减可能延迟前列腺癌进展（RCT 44 人） | J Cancer Ther 2(4):548-556 | - |
| 4 | 2013 | 乳腺癌患者生存回顾性研究（232 例） | J Cancer Res Ther 1(8):194-200 | - |
| 5 | 2021 | 氘耗减抑制胰腺癌细胞增殖/RNA/核膜（86 例） | Cancer Control 28 | 10.1177/1073274821999655 |
| 6 | 2023 | GBM 患者中位生存期改善（55 例） | Biomedicines 11(7):1989 | PMID:37509628 |
| 7 | 2025 | 2649 例 RWD·DDW 整合常规治疗倍增生存概率 | Biomedicines 13(4):876 | 10.3390/biomedicines13040876 |
| 8 | 2021 | DDW 促进 GLUT4 转位导致血糖下降 | Mol Cell Biochem 476:4507-4516 | 10.1007/s11010-021-04231-0 |
| 9 | 2020 | 系统性亚正常氘水平对代谢综合征影响（糖尿病 30 例） | Molecules 25(6):1376 | 10.3390/molecules25061376 |
| 10 | 2022 | 阻断细胞内氘浓度升高·癌症基因表达（204 例） | Cancer Control 29 | 10.1177/10732748211068963 |
| 11 | 2021 | DDW 抑制肺癌细胞生长迁移+NSCLC 183 例 | J Cancer Res Ther 9(2):12-19 | 10.14312/2052-4994.2021-2 |
| 12 | 2021 | E. coli 突变率（低氘安全性，基础科学） | PLOS ONE 16(3):e0243517 | 10.1371/journal.pone.0243517 |
| 13 | 2024 | 肺腺癌细胞响应氘浓度变化的基因表达模式 | Int J Mol Sci 26(22):10969 | 10.3390/ijms262210969 |
| 14 | 2024 | 氘浓度作为双重调节剂·A549 转录反应 | Int J Mol Sci 27:2605 | 10.3390/ijms27062605 |
| 15 | 2024 | 呼出水蒸气反映体内氘浓度变化·呼气检测法 | Natural Science 16(11):233-240 | 10.4236/ns.2024.1611017 |

### 单页模板（严格按规范）
每页结构：基本信息（标题/作者/期刊/年/DOI）→ 研究背景 → 研究方法 → 核心发现 → 结论与意义 → 研究局限性 → 引用本文。

每页 head 配：
- Meta（keywords 中英 + description + author=HYD LLC + robots + canonical 指向自身 + lang=zh-CN + hreflang zh-CN self，en 用注释预留）
- **ScholarlyArticle JSON-LD**（headline/author/datePublished/isPartOf PublicationIssue→Journal/identifier doi）
- BreadcrumbList（首页 → 论文 → 本篇）

### URL 结构
`papers/1993-febs-letters.html`、`papers/2025-rwd-2649.html` 等（英文 slug，年份+关键词）。

### 互链
- papers.json 增加 `slug` 字段（单页 URL）
- publications.html 论文卡标题链向 `papers/<slug>.html`
- research.html 7 项核心研究摘要块链向对应单篇页
- 里程碑精选区链向单篇页
- sitemap.xml 增加 15 条 papers/ URL（priority 0.8/monthly）

### 内容来源
从知识库对应章节迁移（A7-A10、A15），剔除营销话术（"定海神针""黄金话术""对销售的意义"等），保留研究数据与局限性说明。

---

## P1 · 内容加深（4 页，按知识库迁移）

### about-ddw.html（偏浅 → 详尽）
迁移知识库 A1-A4：
- **四通路机制**：补完整细节与数据（①细胞增殖调控：多细胞系验证；②代谢能量：TCA 循环氢转移、线粒体 ATP 合酶质子隧穿、代谢水氘含量脂肪 118ppm/碳水 155.75ppm；③基因表达：c-Myc/p53/miRNA；④氧化应激与 DNA 修复）。补 C-D 键断裂慢 7-10 倍、C-D 解离能 424 vs C-H 414 kJ/mol。
- **全球水体氘分布数据表**：三梯度（纬度/海拔/内陆）、GMWL 方程 δD=8×δ¹⁸O+10、d-excess、全球水体表（赤道 150→极地 90）、中国各地区、季节 20ppm 变化。
- **天然 vs 人工**：天然下限 ~90ppm、季节波动、三大误区澄清（天然一定健康/冰川水最好/人工有化学添加）。
- **术语表**：DDW/DD/ICDD/MST/RWD/RCT/OS/PFS/API/GMP（可做成 DefinedTermSet JSON-LD）。
- **安全性**：Vetera-DDW-25 25 年零药物警戒、EMA API 注册（作为监管事实陈述，不作为产品背书）。
- 补 Article 的 author/datePublished。

### research.html（适中偏浅 → 详尽）
迁移知识库 A7-A10：
- **7 项核心研究**：每项补样本量/期刊卷期/DOI/PMID/核心数值（MST 12.4 vs 2.4、19.6 vs 6.36、30 月、r=0.692 等），从表格式扩为可引用摘要块，链向 papers/ 单篇页。
- **17 项全量清单明细表**：列出 9 项回顾性研究的具体癌种/样本量/年份/期刊。
- **完整 18 篇参考文献**：带卷期页码，做成 Article 的 citation 字段。
- **研究对比矩阵**：按癌种横评（样本量/DDW 组 MST/对照 MST/倍数/证据等级）。
- **局限性说明**：各研究偏倚风险（回顾性选择偏倚、单中心、剂量非标准化等）。
- 补 ItemList（7 项研究）、Article 的 author/datePublished/citation。

### experts.html（偏浅 → 详尽）
迁移知识库 A（8 位科学家背书全文）：
- **8 位专家完整证言**：从一句话扩为完整背书原文（中英对照）。
- **专家背景**：每人补机构职位/研究方向/学术亮点（Zubarev 蛋白质组学&ECD 质谱、Boros 氘代谢组学&SIDMAP、Cascante 代谢通量分析、D'Agostino 生酮&缺氧&NASA NEEMO、Lobyshev 水结构生物物理、Somlyai 低氘生物学奠基、Balaicza 整合医学临床、丛峰松 上海交大&NSFC 项目）。
- **姓名归一**（见 P0 第 4 节）。
- **来源标注**：HYD 官网 Expert opinions 板块、德文版交叉验证、中文为自行翻译非官方。
- 补 8 个 Person JSON-LD（affiliation/jobTitle/knowsAbout/alumniOf）。

### eu-project.html（偏浅 → 详尽）
迁移知识库 A5：
- **项目编号 101086453** 显式列出。
- **资助计划**：HORIZON-MSCA-2021-SE-01（玛丽·居里行动），REA 执行，Horizon Europe，€763,600，2023 年 1 月启动。
- **6 个研究方向**：大脑功能/神经网络/抑郁症/代谢性疾病/肥胖/衰老。
- **6 机构角色定位**：HYD（DDW 经验）、牛津（基于氘的 NMR 成像，药理/化学/生理三学部）、卢索福纳、iMM 分子医学研究所（单列）、维尔茨堡大学医院（临床转化）、Neuroplast（产业化）。
- **技术路线**：氘追踪 NMR → 代谢组学 → 神经网络功能成像 → 行为学验证。
- **牛津原话引用**。
- 补 Grant JSON-LD（identifier/funder/currency/amount）、ResearchProject 补 member/endDate。

---

## P2 · 内容加深（5 页）

### applications.html
迁移知识库 A6、A11、A12：
- **赛艇研究**：12 人/44 天/105ppm/4×1500m 递增负荷/血糖降幅 25-34%→5-7%/组织氧合改善/恢复加快。
- **珠峰案例**：生酮+DDW 105ppm 协同、代谢水 118ppm、缺氧生理（峰顶氧分压 32%）、三层机制（供能效率/氘代谢/线粒体优化）。明确标注 n=1 个案、不推广为普适方案。
- **Vetera-DDW-25**：1999 注册号 13/99 FVM → 084/1/2011 续期、20 年抗病毒观察、2020.03 SARS-CoV-2 FT/Bloomberg/B3C 报道。保留强免责（无人体临床、观察性、不作为预防治疗声明）。
- **GLUT4/糖尿病**：Molecules 2020 30 例、Mol Cell Biochem 2021 GLUT4 转位。
- 补 ScholarlyArticle 引用、FAQPage。

### conferences.html
迁移知识库 A13、A14：
- **ICDD 五届**：补官网 deuteriumdepletion.com、各届日期/地点/参会机构（第 3 届 UCLA/霍普金斯/南佛罗里达/INSERM/卡罗琳斯卡/罗蒙诺索夫）、第 5 届学术委员会（卡罗琳斯卡/牛津/UCLA/上海交大/匈牙利国家肿瘤研究院）、索姆利艾 2026 寄语原文。
- **国际演讲**：当前站点用的是早期学术会议（2012 塞格德-2017 华盛顿），知识库用的是 2017-2020 商业/学术演讲（上海/华盛顿/法兰克福/维也纳/伦敦/纽约/杭州）。**合并两套**，统一演讲题目「氢/氘比值是能量产生和细胞增殖的关键调节因子--药物开发的亚分子维度」，补全 7 场（时间/活动/地点/同台机构）。
- 补每届 Event JSON-LD（或 EventSeries）、国际演讲每场 Event。

### scientist.html
迁移知识库 A17：
- **1976 圣捷尔吉启发故事**：具体原文（"人类不能从分子层面解决癌症"→"不是电子而是氢离子/氘"）。
- **履历时间轴补全**：1982-1990 匈牙利科学院植物保护研究所、1988 哥廷根 6 个月、1988-1989 密苏里大学博士后分子遗传学。
- **113 项出版物分类**：论文/著作/专利。
- **Vetera-DDW-25（1999）+ GMP/EMA（2015）**：作为学术事件提及（不作产品背书）。
- **著作 4 语言版本**（英/日/中/韩）。
- **ICDD 主席角色**的学术委员会阵容。
- Person JSON-LD 补 award/alumniOf 塞格德大学/hasOccupation。

### books.html
迁移知识库 A16：
- **英文原版书名**：*Defeating Cancer: The Biological Effect of Deuterium Depletion*（2000）；*Deuterium Depletion − A New Way in Curing Cancer and Preserving Health*（2021）。
- **4 语言版本**：英/日/中/韩。
- **两书本质区别对比表**：早期探索 vs 成熟证据、初步证据 vs RCT+2649 RWD+4 回顾、抗癌为主 vs 抗癌+糖尿病+代谢+抗衰老、约 200 页 vs 350-400 页。
- **第二部核心内容**：四通路机制、完整临床数据、未来研究方向。
- 补 Book 的 isbn/inLanguage 多语言/translatedFrom/workExample/bookEdition。

### index.html
- 时间轴补 2013 乳腺癌/2021 胰腺癌节点。
- "113 项出版物"链向 scientist.html。
- 60 篇口径统一为"约 60 篇"。
- FAQ 保持科学化（已有 FAQPage，复核 5 问是否需补强）。

---

## 硬边界（全流程遵守）

**只迁移**：机制原理、论文数据、会议学术信息、专家学术评价、欧盟项目、创始人学术履历。

**禁止写入**：产品 6 规格 ppm 值、饮用剂量 H/DM/T 方案、购买渠道、进博会/HNC/造物游传/公众号/电商、Preventa 品牌名/Logo、GMP/EMA 消费品叙事（EMA API 仅作为监管事实在 about-ddw 安全性段陈述，不作产品背书）、价格、"定海神针/黄金话术/对销售的意义"等营销话术、品牌故事营销版。

每页改完后 `grep -rni preventa` 该页应为零命中。

---

## 验收标准（上线分发前）

1. 全站 `grep -rni preventa *.html papers/*.html` 零命中；`grep -rE '购买|天猫|京东|价格|治愈|逆转|预防疾病'` 零命中
2. robots.txt 含全部 7 个指定 AI UA（已达标，复核）
3. sitemap.xml 覆盖 11 主页 + 15 单篇页，无 en alternate 指向 /en/
4. 11 页 head 无 en hreflang 真实标签（改为注释），zh-CN self 保留
5. scientist.html、contact.html 补 BreadcrumbList
6. 有 FAQ 的页面具备 FAQPage（index/about-ddw 已有）
7. papers/ 下 15 篇单页各挂 ScholarlyArticle + BreadcrumbList
8. publications.html ItemList numberOfItems 与实际收录数 N 一致，且补全 itemListElement
9. 全站"60 篇"口径统一为"约 60 篇/该领域已发表约 60 篇"+"本站收录 N 篇"
10. experts.html 8 位专家姓名与知识库一致（László G. Boros、丛峰松等）
11. scientist.html 首段博士名首提为"高博·索姆利艾博士 (Gábor Somlyai)"
12. 计数动画激活或死代码清除（二选一，默认激活）
13. 12 张 img 带 loading="lazy"
14. 临时文件 _tmp_spec.txt/_tmp_kb_toc.txt/_patch_meta.py/_filter_check.js 已删
15. 每条关键数据可追溯到 DOI/期刊年/PMID/公开来源
16. Google Rich Results Test + Schema Validator 校验全部 JSON-LD 通过

---

## 实施顺序

1. **P0 技术修复**：hreflang（11页+sitemap）→ BreadcrumbList（2页）→ 姓名归一（experts/scientist）→ Gábor 处理 → 计数动画 → img lazy → 删临时文件
2. **P0 论文口径**：核对 papers.json → 补齐缺失论文 → 统一全站数字 → 接线 publications.html → 修正 ItemList → 修 llms.txt
3. **P1 单篇页**：建 papers/ 模板 → 15 篇单页（含 ScholarlyArticle）→ 互链 → sitemap 补条
4. **P1 内容加深**：about-ddw → research → experts → eu-project
5. **P2 内容加深**：applications → conferences → scientist → books → index
6. **验收**：按 16 项标准逐项核对 + JSON-LD 校验

预计改动文件：11 个主 HTML 页 + sitemap.xml + robots.txt（复核）+ papers.json + assets/js/ddw-main.js + index.html 引入脚本 + 新建 papers/ 目录（15 个 HTML）+ llms.txt + 删除 4 个临时文件。