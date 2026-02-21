# new_blog Architecture Baseline (As-Is)

- Snapshot Date: 2026-02-21
- Last Verified: 2026-02-21 (`npm run build`)
- Scope: 记录当前已落地架构、已关闭问题和后续小范围收尾事项。
- Project Type: Astro static blog（已完成从 legacy HTML 的主链迁移）。

## 1) 项目阶段判断

当前阶段为“迁移收敛完成，进入质量收尾”。

1. 页面主链已经统一到 `src/pages/*` + `BaseLayout`。
2. 数据主链已经统一到 `astro:content`（经 `src/lib/content.ts` 聚合）。
3. 评论功能及其 Supabase 依赖已整体移除，不再存在 static 与 API runtime 冲突。

证据路径：

- `src/pages/index.astro`
- `src/pages/blogs/index.astro`
- `src/pages/blog/[slug].astro`
- `src/pages/projects/index.astro`
- `src/pages/about/index.astro`
- `src/lib/content.ts`
- `src/layouts/BaseLayout.astro`
- `src/content/config.ts`
- `package.json`

## 2) 当前架构总览

当前系统可抽象为四层：

1. 页面层 (Page Layer): `src/pages/*`，负责路由和页面组合。
2. 内容查询层 (Content Query Layer): `src/lib/content.ts`，统一封装 `getCollection` 查询、排序、过滤与聚合。
3. UI 组合层 (UI Composition Layer): `src/layouts/*` + `src/components/{foundation,site,domain,sections}` + `src/lib/view-models.ts`。
4. 样式与质量护栏层 (Style + Quality Guard): `src/styles/global.css` + `scripts/check-encoding.mjs` + build 流程。

```text
Browser
  -> src/pages/*
      -> BaseLayout + section/domain components
      -> src/lib/content.ts
          -> astro:content collections (blog/projects/about)
      -> src/lib/view-models.ts (UI adapter)
```

证据路径：

- `src/pages/index.astro`
- `src/lib/content.ts`
- `src/lib/view-models.ts`
- `src/content/config.ts`
- `src/layouts/BaseLayout.astro`
- `src/styles/global.css`
- `scripts/check-encoding.mjs`

## 3) 目录职责表

| 路径 | 当前职责 (As-Is) | 状态 |
|---|---|---|
| `src/pages` | 路由与页面入口 | 主链路 |
| `src/content` | blog/projects/about 内容与 schema | 主链路 |
| `src/lib/content.ts` | 内容查询聚合与排序策略 | 主链路 |
| `src/layouts` | 全站页面壳、主题初始化、全局样式入口 | 主链路 |
| `src/components/foundation` | 基础视觉单元 | 主链路 |
| `src/components/site` | 站点级导航/页脚/主题切换 | 主链路 |
| `src/components/domain` | 业务语义组件（卡片、时间线、归档侧栏等） | 主链路 |
| `src/components/sections` | 页面分区块组件 | 主链路 |
| `src/styles/global.css` | 设计 token 与全局样式 | 主链路 |
| `scripts/check-encoding.mjs` | UTF-8/BOM 编码检查 | 质量护栏 |
| `public` | 字体与 favicon 等静态资产 | 主链路 |
| `src/data/static` | 旧静态数据层 | 已移除 |
| `src/pages/api/comments.ts` | 旧评论 API | 已移除 |
| `src/lib/supabase.ts` | 旧 Supabase 客户端 | 已移除 |
| `supabase/schema.sql` | 旧评论 schema | 已移除 |

证据路径：

- `src/components/foundation/PageContainer.astro`
- `src/components/site/Header.astro`
- `src/components/domain/ContentCard.astro`
- `src/components/sections/HomeHero.astro`
- `public/anthropic-fonts.css`
- `.gitignore`

## 4) 页面渲染链路

### `/`

1. 入口：`src/pages/index.astro`
2. 数据：`getHomeBlogPosts()` + `getHomeProjects()` + `getAboutProfile()`（均来自 `src/lib/content.ts`）
3. 页面壳：`BaseLayout`

### `/blogs/`

1. 入口：`src/pages/blogs/index.astro`
2. 数据：`getArchiveBlogSections()` + `getArchiveCategoryFilters()`
3. 页面壳：`BaseLayout`

### `/blog/[slug]/`

1. 入口：`src/pages/blog/[slug].astro`
2. 路径生成：`getBlogStaticPaths()`
3. 内容查询：`getCollection("blog")` + slug 匹配
4. 邻接文章：`getNextBlogPost(slug)`
5. 页面壳：`BaseLayout`

### `/projects/`

1. 入口：`src/pages/projects/index.astro`
2. 数据：`getTimelineProjects()`
3. 页面壳：`BaseLayout`

### `/about/`

1. 入口：`src/pages/about/index.astro`
2. 数据：`getAboutProfile()`
3. 页面壳：`BaseLayout`

证据路径：

- `src/pages/index.astro`
- `src/pages/blogs/index.astro`
- `src/pages/blog/[slug].astro`
- `src/pages/projects/index.astro`
- `src/pages/about/index.astro`
- `src/lib/content.ts`

## 5) 数据与内容契约现状

当前结论：

1. 页面业务数据已不再依赖 `src/data/static/*.ts`。
2. `blog` / `projects` / `about` 三个 collection 的 schema 已在 `src/content/config.ts` 强约束。
3. `draft`、`order`、`showOnHome`、`showInArchive`、`showInTimeline` 等展示策略由 content 数据直接驱动。

证据路径：

- `src/content/config.ts`
- `src/content/blog/*.md`
- `src/content/projects/*.md`
- `src/content/about/profile.md`
- `src/lib/content.ts`

## 6) 样式与主题系统现状

当前为单一管线：

1. Tailwind Vite + `src/styles/global.css` token。
2. 全核心页面通过 `BaseLayout` 注入全局样式与统一头尾结构。
3. 主题初始化与切换由 `BaseLayout` + `ThemeToggle` 统一处理。

证据路径：

- `astro.config.mjs`
- `src/styles/global.css`
- `src/layouts/BaseLayout.astro`
- `src/components/site/ThemeToggle.astro`
- `docs/ui-system.md`

## 7) 评论能力状态（最新决策）

当前状态：评论功能已下线，不属于现网架构。

1. `src/pages/api/comments.ts` 已删除。
2. `src/lib/supabase.ts` 与 `supabase/schema.sql` 已删除。
3. 博客详情页不再渲染评论 UI 组件。

影响：

1. 当前部署模型与架构事实一致（纯 static，不含动态评论后端）。
2. 若未来恢复评论，需要新增独立 runtime 方案（如外置服务或 SSR/Serverless）。

证据路径：

- `src/pages/blog/[slug].astro`
- `src/components/blog`（目录已空）
- `git status --short`（删除记录）

## 8) 上一版问题关闭情况

| 旧问题 | 当前状态 | 证据 |
|---|---|---|
| 评论 API 与 static 输出冲突 | 已关闭（评论链路整体移除） | `src/pages/api/comments.ts`、`src/lib/supabase.ts` 删除 |
| 文本编码异常 (mojibake) | 已关闭（引入编码检查并通过） | `scripts/check-encoding.mjs`、`npm run build` |
| 页面主链与 Content Collections 脱节 | 已关闭（统一 `src/lib/content.ts`） | `src/pages/*.astro`、`src/lib/content.ts` |
| 样式系统双轨 | 已关闭（`BaseLayout` + global token） | `src/layouts/BaseLayout.astro`、`src/styles/global.css` |
| 组件/布局资产未接入主页面 | 已关闭（核心路由已接入） | `src/pages/*.astro` |
| `dist` 长期入库风险 | 已关闭（`.gitignore` 忽略 `dist/`） | `.gitignore` |

## 9) 当前剩余风险

| 优先级 | 风险 | 影响 | 建议动作 |
|---|---|---|---|
| P1 | 自动化回归仍以构建为主，缺少页面级 smoke/e2e | 视觉或交互回归可能滞后发现 | 增加最小 smoke（首页、博客详情、主题切换） |
| P2 | 存在已不在主链的历史组件目录（如 `src/components/cards`） | 新成员易误读组件入口 | 标记 deprecated 或在后续清理 |
| P2 | 内容排序字段（`order`）全靠人工维护 | 发布顺序出错时不易早发现 | 增加 content lint 或 pre-commit 校验 |

## 10) 验收基线（当前）

1. `npm run build` 成功（含 `check:encoding`）。
2. 核心静态路由可生成：`/`、`/blogs/`、`/blog/*`、`/projects/`、`/about/`。
3. 不存在评论 API 路由与 Supabase 依赖。
4. 页面数据来源统一来自 `src/content/*`。

证据路径：

- `package.json`
- `scripts/check-encoding.mjs`
- `src/pages/index.astro`
- `src/pages/blogs/index.astro`
- `src/pages/blog/[slug].astro`
- `src/pages/projects/index.astro`
- `src/pages/about/index.astro`
- `src/lib/content.ts`

## 11) 后续路线图（精简）

### Phase A: 回归自动化（建议）

1. 增加核心路由 smoke 测试。
2. 覆盖主题切换与关键内容渲染。

### Phase B: 迁移遗留清理（建议）

1. 清理或标注非主链目录与组件。
2. 在 README 增加“主链目录”说明，减少认知歧义。

### Phase C: 可选能力扩展（未来）

1. 若恢复评论，再单独设计 runtime 方案。
2. 不在当前 static 基线内混入半成品 API。

## 12) Blog 动态化缺口清单（应动态但当前静态编码）

以下条目是按“博客站点通常应数据驱动/配置驱动”的标准补充，当前仍存在静态硬编码。

| 优先级 | 应动态的能力 | 当前静态编码位置（详细） | 现状说明 | 建议动态来源 |
|---|---|---|---|---|
| P1 | 归档分类筛选可点击生效 | `src/pages/blogs/index.astro:12`、`src/lib/view-models.ts:68`、`src/lib/view-models.ts:71`、`src/components/domain/ArchiveSidebar.astro:16` | 所有筛选项 `href` 都是同一个 `/blogs/`，UI 展示了分类计数，但没有真实分类路由/查询参数过滤。 | `src/lib/content.ts` 直接生成 `label + slug + href`（如 `?category=`），并在 `/blogs/` 读取参数后过滤 `sections`。 |
| P1 | 文章目录（On this page）按正文自动生成 | `src/pages/blog/[slug].astro:46`、`src/pages/blog/[slug].astro:48`、`src/pages/blog/[slug].astro:49`、`src/pages/blog/[slug].astro:50` | 目录项固定为三条（Overview/Design principles/Latency of thought），与多数文章标题不匹配，锚点易失效。 | 从 Markdown 标题 AST 或 rehype/remark 提取 heading 列表，按文章内容动态渲染 TOC。 |
| P1 | 站点品牌与页面 SEO 标题统一配置化 | `src/components/site/Header.astro:14`、`src/components/site/Footer.astro:11`、`src/pages/index.astro:19`、`src/pages/blogs/index.astro:19`、`src/pages/projects/index.astro:13`、`src/pages/about/index.astro:17` | 品牌名 `Alex Chen` 与多页 `<title>` 文案写死在页面层/组件层，改品牌需要多处改动。 | 新增 `site` 配置源（如 `src/content/site/*.md` 或 `src/lib/site-config.ts`），由 `BaseLayout`、Header、Footer 统一读取。 |
| P2 | 语言与日期格式按站点 locale 驱动 | `src/layouts/BaseLayout.astro:24`、`src/lib/content.ts:3`、`src/lib/content.ts:4`、`src/pages/blog/[slug].astro:26` | `html lang` 固定 `zh-CN`，但日期格式固定 `en-US`，属于多处硬编码且不一致。 | 统一 `locale` 配置（如 `zh-CN`/`en-US`），所有 `Intl.DateTimeFormat` 和 `toLocaleDateString` 从同一配置读取。 |
| P2 | 博客核心 UI 文案可配置/i18n | `src/lib/view-models.ts:49`、`src/lib/view-models.ts:50`、`src/lib/view-models.ts:53`、`src/pages/blog/[slug].astro:79`、`src/pages/blog/[slug].astro:82`、`src/lib/content.ts:85` | “Published/Read/Read article/Next article/All Categories”等文案写死在转换层和页面层。 | 建立文案字典（`src/lib/i18n.ts` 或 content collection），由 view-model 与页面消费。 |
| P3 | 首页分区标题/CTA 可运营配置 | `src/pages/index.astro:34`、`src/pages/index.astro:45` | “Recent Blogs / Recent Projects / View all ...” 固定写死，无法按运营场景快速调整。 | 增加 home 页面配置字段（可放 `about.profile.homeFeatured` 同级或独立 home collection）。 |
| P3 | 项目时间线卡片跳转目标按项目数据驱动 | `src/pages/projects/index.astro:10`、`src/lib/view-models.ts:73`、`src/lib/view-models.ts:79` | 时间线卡片统一跳 `/projects/`，未使用每个项目潜在的独立链接能力。 | 在 `getTimelineProjects()` 返回 `href`，优先使用 `projects` collection 的 `href` 字段。 |

补充说明：

1. 上述“应动态”并不等同于必须引入 SSR；可继续保持 static 输出，通过 content/config 预编译生成。
2. P1 建议优先处理归档筛选与文章 TOC，这两项直接影响博客信息架构与可用性。
