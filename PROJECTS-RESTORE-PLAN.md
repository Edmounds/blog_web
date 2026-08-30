# Projects 恢复方案（Grill-me 已确认规格）

> 状态：需求访谈已完成。本文记录已从仓库确认的事实和用户确认的实施规格，可作为后续编码任务说明。

## 已确认的仓库事实

- 当前内容集合只有 `blog`、`note`、`about`、`site`、`translations`。
- 文章详情统一由 `src/components/domain/ContentDetail.astro` 渲染。
- 当前详情头部顺序是：标题、description、Type（tags）、创建/更新时间、阅读/字数信息。
- 历史版本曾有独立 `project` collection、`/project/:slug/` 路由和项目导航；项目 frontmatter 当时支持 `projectUrl`、`docUrl`。
- 当前仓库已有 GitHub 贡献热力图 API，但没有按仓库读取 GitHub star 数量的 API 或组件。

## 用户目标（已确认）

- 恢复 Projects，主要展示个人 GitHub 开源项目。
- 项目条目支持传入 GitHub 仓库链接。
- 根据仓库链接获取 star 数量，并渲染类似参考图的 GitHub 项目卡片；不显示头像。
- 卡片作为独立区块放在对应文章详情的 Read/Words 元信息之后、正文之前。

## 决策记录

### 1. GitHub 字段作用范围（已确认）

**已确定：仅允许 `project` 条目使用。**

建议项目 frontmatter 使用单个可选字段：

```yaml
github: https://github.com/Edmounds/robviz
```

这样只有 Projects 页面中的项目详情会自动显示仓库卡片，普通 Blog/Note 不会因为误填字段而改变布局；项目 schema 也能对 GitHub URL 做校验。

用户确认：`github` 参数只用于 `project` 条目；Blog/Note 不支持该字段。

### 2. Projects 规范路由（已确认）

仓库历史同时出现过 `/project/`（较新的 Astro 内容集合实现）和 `/projects/`（更早的静态项目页面）。

**已确定：统一使用 `/project/`、`/project/:slug/`，本地化版本使用 `/:locale/project/`。**

理由：这与最近一次被移除的 `project` collection、详情路由和内容 ID 约定一致；恢复时只需补回一套路由，不会让 `/project` 与 `/projects` 产生重复页面或 SEO 分叉。

用户确认：接受 `/project/` 作为唯一规范路径，不恢复 `/projects/`。

### 3. Star 数据获取时机（已确认）

当前项目详情页默认静态构建。可选方案：

- 构建时请求 GitHub：HTML 直接带 star，但数据要等下一次构建才更新，且构建依赖外部 API。
- 运行时请求站点 API：浏览器异步加载 star；API 使用 Cloudflare Cache（建议数小时级 TTL），页面不会因 GitHub 临时失败而构建失败。

**已确定：运行时 API + 缓存。** API 接收已校验的 GitHub 仓库 URL，服务端请求 GitHub REST 仓库接口，优先使用已有 `GITHUB_TOKEN`（不在代码中硬编码），返回仓库名、描述、star 数和仓库链接。前端在卡片内提供 loading、成功和不可用状态。

用户确认：采用运行时站点 API 获取，并使用 Cloudflare Cache 缓存；不在构建时抓取。

### 4. 卡片展示字段（已确认）

**推荐最小字段：** GitHub 图标、仓库名（`owner/name`）、GitHub 返回的 description、star 图标与数量；整个卡片链接到仓库。按用户要求不显示头像，也不额外展示 fork、语言、issue 等统计。

用户确认：采用上述最小字段和整卡片链接交互；不显示头像或额外统计。

### 5. 卡片渲染范围（已确认）

**已确定：只在项目详情页的头部元信息之后渲染。** Projects 列表页继续承担归档/入口职责，不为每个项目同时发起 GitHub 请求；点击进入详情后再加载对应仓库卡片，网络请求数量和失败面更小。

用户确认：只在项目详情页显示，Projects 列表页不显示 GitHub 卡片。

### 6. GitHub 异常时的降级行为（已确认）

**采用：保留最近一次成功数据，不直接报错。** API 请求失败时返回缓存中的最新可用仓库数据；没有任何成功缓存时才使用项目自身的标题/description，并将 star 显示为不可用占位符。卡片整体点击跳转到 frontmatter 中的 GitHub 仓库链接。

用户确认：失败时保留最新可用数据；卡片点击跳转到对应 GitHub 仓库。

### 7. 缓存保留与首次加载（已确认）

**已确定：缓存分为刷新 TTL 和保留 TTL。** 6 小时内直接命中；过期后尝试刷新，刷新失败仍返回旧值并允许继续保留 7 天；超过保留期或从未成功时返回 fallback 状态。首次加载使用轻量 skeleton，不阻塞文章正文。

用户确认：接受“6 小时刷新、7 天保留、无缓存时 skeleton/fallback”的缓存策略。

### 8. GitHub 链接格式与安全边界（已确认）

**已确定：只接受公开 `https://github.com/{owner}/{repo}` 仓库 URL。** 服务端将 URL 解析为 owner/repo 后固定请求 `api.github.com/repos/{owner}/{repo}`，拒绝其他主机、额外路径和无法解析的输入；允许尾部斜杠及 query/hash 被规范化忽略。这样不会形成任意 URL 代理，也与“GitHub 开源项目”目标一致。

用户确认：只支持公开 GitHub 仓库，不支持 Enterprise 或其他镜像地址。

### 9. 项目内容迁移范围（已确认）

最近一次 `project` collection 主要只有空占位和交互测试条目；更早的 `src/content/projects/*` 属于另一套静态 Projects 页面，内容并非用户当前的 GitHub 项目。

**推荐：只恢复 project 内容模型、路由、列表/详情展示和 frontmatter 模板，不自动恢复旧演示项目；由用户新增真实项目 Markdown。** 这样不会把历史示例混入现有站点，也不需要猜测哪些项目仍然有效。

用户确认：不迁移旧演示项目内容。

### 10. Project 本地化（已确认）

现有站点为 `en`、`ja`、`zh-TW` 提供本地化路由和翻译集合。

**推荐：Project 沿用同一套本地化机制。** 每个项目可以有对应语言的翻译 Markdown；`github` URL 作为仓库标识在各语言版本保持一致，卡片标签（如 Stars、GitHub）从站点 copy 中本地化或保持产品名不翻译。

用户确认：Project 同步支持现有四种语言（中文、英文、日文、繁体中文）。

### 11. Projects 页面架构（已确认）

历史实现曾把 Project 作为 SPA 主栏目；当前 SPA 主栏目固定为 Home、Blog、Note、Links、About。

**采用：Project 恢复为 SPA 主栏目。** 主栏目顺序固定为 `Home → Blog → Project → Note → Links → About`；Project 列表页作为 SPA 中的一个 slide，项目详情继续使用项目详情路由。

用户确认：Project 放入 SPA 索引，位置在 Blog 后、Note 前。

### 12. Project 列表页呈现方式（已确认）

**推荐：沿用当前归档时间线结构，项目条目点击进入详情；GitHub 卡片只在详情头部渲染。** 这样 Projects 列表不会请求 GitHub API，也不会复制详情卡片的数据和交互。

用户确认：Project 列表沿用 Blog/Note 的归档时间线；GitHub 卡片只在详情页显示。

### 13. GitHub API 合同与凭证（已确认）

**推荐：服务端固定代理 GitHub REST 仓库接口。** 新增 `/api/github-repository.json?url=...`（或等价命名）仅接受已校验的仓库 URL，服务端解析后请求 `api.github.com/repos/{owner}/{repo}`；`GITHUB_TOKEN` 只从运行时环境读取、只用于服务端请求，不返回给浏览器。未配置 token 时允许匿名请求；缓存、旧值保留和 fallback 规则保持不变。

用户确认：采用固定服务端 GitHub REST API 合同；token 仅服务端读取，未配置时允许匿名请求。

### 14. 卡片交互与文案（已确认）

**采用：** 整张卡片使用单一外部链接，`target="_blank"` + `rel="noreferrer"` 打开 GitHub；仓库名称使用 GitHub 返回的原名，在所有语言版本保持一致；卡片 UI 文案统一英文；star 数使用 `Intl.NumberFormat` 的完整数字（例如 `1,234`），不做 `1.2k` 压缩。

用户确认：外部 GitHub 新标签页打开；仓库名称不翻译，使用原名。

### 15. 验收与测试范围（已确认）

**推荐至少覆盖：** GitHub URL 解析与非法主机拒绝；GitHub API 成功/404/限流响应；缓存命中、过期刷新失败返回旧值、无缓存 fallback；Project 条目只接受 `github` 字段；详情页卡片的链接、star 显示和失败降级；四种语言的 Project 路由与翻译路径；SPA 顺序为 Home → Blog → Project → Note → Links → About。

用户确认：按上述范围编写自动化测试，并以 `npm test`、`npm run check` 通过作为交付门槛。

### 16. 首页项目预览（已确认）

当前首页只展示 Blog/Note 的最新内容；Project 恢复到 SPA 后可以额外加入 Latest Projects 区块，也可以只在 Project slide 展示。

**已确定：不新增首页项目预览。** 这样首页布局保持稳定，Project 的入口和内容集中在自己的 slide，GitHub 数据请求也只发生在项目详情页。

用户确认：首页不增加 `Latest Projects` 区块，只在 Project SPA slide 展示项目。

### 17. 旧 Projects 路径兼容（已确认）

历史上曾出现过 `/projects/*`，但最近一次 Project 实现使用 `/project/*`，当前也没有可迁移的已发布项目内容。

**已确定：不新增 `/projects/*` 重定向。** 只生成确认过的 `/project/`、`/:locale/project/` 及其详情路由，避免为未确认发布过的旧路径建立额外兼容契约。

用户确认：不向下兼容，全部更新；不恢复 `/projects/*` 旧路径或重定向。

### 18. `github` 字段是否必填（已确认）

当前草案将 `github` 设为可选，但 Projects 的定位是 GitHub 开源项目。

**采用：`github` 在 `project` schema 中保持可选。** 有值时校验为公开 GitHub 仓库 URL并渲染卡片；无值时允许项目正常发布。

用户确认：`github` 不是必填字段。

### 19. 缺少 `github` 字段时的行为（已确认）

**已确定：不渲染 GitHub 卡片，也不请求 API。** 项目详情继续显示标题、description、Type、正文和互动模块，不显示空的仓库占位。

用户确认：无 `github` 时完全隐藏卡片且不请求 API，项目详情其余内容照常显示。

### 20. 详情头部插入点（已确认）

**采用：** GitHub 卡片独立于现有 Type/Created/Read 元信息行，放在 `Read/Words` 行之后、正文之前；卡片只在项目详情且存在 `github` 时插入。

用户确认：卡片放在 Read/Words 后、正文前，作为独立区块。

## 最终实施清单

1. 恢复 `project` 内容集合、SPA slide、四种语言列表/详情路由；SPA 顺序为 Home → Blog → Project → Note → Links → About。
2. 规范路径只保留 `/project/`、`/project/:slug/` 及对应本地化路径；不迁移旧演示项目，不兼容或重定向 `/projects/*`。
3. Project frontmatter 增加可选 `github` 字段；仅接受公开 `https://github.com/owner/repo`，无字段时隐藏卡片且不请求 API。
4. 新增服务端 GitHub 仓库 API，固定代理 `api.github.com/repos/{owner}/{repo}`；`GITHUB_TOKEN` 仅服务端读取，可匿名 fallback。
5. API 使用 6 小时刷新、7 天保留；刷新失败返回最近成功缓存，不直接报错；无缓存时返回 fallback。
6. 详情页在 Read/Words 后、正文前渲染独立卡片：GitHub 图标、原始仓库名、description、完整 star 数；不显示头像或其他统计。
7. 卡片整块新标签页打开 GitHub（`target="_blank"`、`rel="noreferrer"`）；卡片 UI 文案统一英文，仓库名不翻译。
8. Project 列表沿用 Blog/Note 归档时间线；首页不增加 Latest Projects；测试覆盖 URL 安全、API 状态、缓存回退、schema、详情卡片、四语言路由和 SPA 顺序。

## 交付门槛

- `npm test`
- `npm run check`
- 不修改用户已有的 `src/content/.obsidian/workspace.json` 变更。

## 访谈结论

- 所有路由、数据获取、缓存、错误状态、国际化、测试和迁移边界均已确认。
- 本文可直接作为后续实现任务说明；实现阶段仍需遵守根目录 `AGENTS.md` 的工作区和测试规则。
