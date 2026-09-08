# 项目规则

> 本文件为 AI Agent 在当前代码库中开展编码、测试与重构的刚性准则。所有变更必须严格遵守以下约定。

## 核心目录与边界职责
- `src/components/ui/`: 基础 UI 原语组件（如 Button、Dialog、Toggle 等）。允许编写无业务状态的纯展现组件；严禁在此处直接读取业务数据、访问数据库或调用业务 API。
- `src/components/{site,sections,cards,domain,links}/`: 业务组件层。页面与静态标记优先使用 Astro 组件（`.astro`）；仅交互/状态/动效岛屿使用 React（`.tsx`）。
  - `site/`: 全局框架（Header、Footer、Navigation、ThemeToggle 等）。
  - `sections/`: 页面主要区块（Timeline、Hero、AboutBio 等）。
  - `cards/`: 卡片组件（PostCard、ProjectCard、FriendLinkCard 等）。
  - `domain/`: 业务领域组件（CommentSection、MarkdownEnhancements、ArtItem 等）。
  - `links/`: 友情链接专用展示组件。
- `src/pages/`: Astro 页面路由与 SSR 渲染入口。页面文件仅负责组合组件、获取数据并注入 Props，避免在此处堆砌复杂数据加工逻辑。
- `src/pages/api/`: 面向公网的 HTTP API 端点（如评论、点赞、访问量、音乐代理等）。必须负责参数验证、同源检查、Edge Cache 策略设定并返回统一 JSON 结构。
- `src/server/`: 服务端核心领域逻辑、Cloudflare 存储适配层（D1/R2）与第三方服务适配（Douban、NetEase、Steam、TMDB 等）。严禁在客户端代码或前端渲染脚本中直接引用。
- `src/lib/`: 前后端通用工具库（Markdown 插件、响应式图片算法、多语言辅助、通用校验等）。必须保持纯函数或无环境副作用，避免引入 Node 特有 API。
- `src/content/`: 博客文章、笔记、项目等 Markdown/MDX 原文源。所有媒体引用遵循统一格式；严禁引用本地文件系统绝对路径。
- `src/i18n/`: 国际化字典与翻译状态跟踪。子目录 `src/i18n/generated/` 为脚本自动生成目录，严禁手动修改其内容。
- `schema/`: Cloudflare D1 数据库的 SQL Schema 定义文件（如 `comments.sql`、`post_stats.sql` 等）。
- `scripts/`: 构建预处理、内容准备、图片优化与同步、自动翻译脚本（ESM 模块，后缀 `.mjs`）。
- `workers/`: 独立部署的边缘 Worker 服务（`art-cover-fetcher.js` 封面反代抓取、`blog-preferred-proxy.js` 生产路由反代）。
- `tests/`: 单元与集成测试（使用 Node.js 内置 test runner）。必须对输入、输出与副作用进行真实断言，严禁通过正则匹配源码文本冒充测试。
- `dist/`, `.astro/`, `.wrangler/`: 编译产物与本地调试运行时状态，由构建工具管理，严禁手动修改或提交至版本控制。
- `.worktrees/`: Git 独立开发工作树目录，新功能开发隔离区。

## 构建和测试
- 构建项目: `npm run build`（按序自动执行编码检查、文章 ID 校验、Astro 静态与 SSR 打包、构建包完整性校验）
- 本地开发服务: `npm run dev`（前置自动执行 `npm run content:prepare` 与 `npm run images:sync`）
- 本地 Worker 联调: `npm run cf:dev`（使用 Wrangler 模拟 Cloudflare 生产环境与 D1/R2 本地持久化状态）
- 静态类型检查: `npm run check`（执行 `astro check` 进行 Astro 与 TypeScript 严格类型诊断）
- 全量运行测试: `npm test`（调用 `node --test tests/*.test.mjs`）
- 单文件测试: `node --test tests/<file-name>.test.mjs`
  - 示例: `node --test tests/comments.test.mjs`
- 单测试用例过滤: `node --test --test-name-pattern="<pattern>" tests/<file-name>.test.mjs`
  - 示例: `node --test --test-name-pattern="validateCommentInput" tests/comments.test.mjs`
- 代码风格检查: `npm run check:encoding`（校验 UTF-8 编码且无 BOM 字符）
- 文章 ID 与 Slug 校验: `npm run check:content-ids`（确保内容库与 `src/lib/post-slugs.ts` 完全一致）
- 自动格式化: 严格遵循 `.editorconfig`（2 空格缩进、LF 换行符、UTF-8 编码、末尾保留一个换行）；内容 Slug 与 Frontmatter 自动化规范通过 `npm run content:prepare` 对齐。

## 编码规范
- 命名与结构契约:
  - Slug 命名: 统一小写 kebab-case，日期格式文章严格采用 `YYYYMMDD-NN`。
    - 正例: `slug: "20260803-01"`，路径为 `blog/20260803-01`
    - 反例: `slug: "2026_08_03_01"`，`slug: "MyFirstPost"`
  - API 返回结构:
    - 成功响应统一使用 `jsonResponse(data, init)` 工具函数，载荷规范为 `{ item: T }`、`{ items: T[] }` 或 `{ success: true, ... }`，自动携带 `Content-Type: application/json; charset=utf-8`。
    - 错误响应统一使用 `errorResponse(status, code, message)` 返回 `{ error: { code: string, message: string } }`。
    - 正例: `return jsonResponse({ item: result.comment }, { status: 201 });`
    - 正例: `return errorResponse(400, "INVALID_CONTENT_ID", "请选择一篇已发布的内容。");`
    - 反例: `return new Response("Invalid ID", { status: 400 });`
    - 反例: `return new Response(JSON.stringify({ msg: "fail" }));`
- 日志与调试约束:
  - 生产代码（`src/` 目录下）严禁遗留未封装的裸 `console.log()` 或测试用打印。
  - 仅在 Cron 定时任务、批处理脚本或捕获严重故障（如存储/数据库操作失败、外部第三方 API 熔断）时，允许使用结构化上下文参数调用 `console.error()`。
    - 正例: `console.error("Scheduled NetEase sync failed", { type, error: err.message });`
    - 反例: `console.log("params is:", params);`
    - 反例: `console.log("got here");`
- 异常与错误处理:
  - API 端点必须使用 `try ... catch` 捕获异常。
  - 若捕获的异常本身为 `Response` 实例（如前置校验函数 `requireDb()`、`requireSameOriginJson()` 抛出的阻断响应），必须直接返回该实例，严禁将其二次封装为 500 错误。
    - 正例: `catch (error) { if (error instanceof Response) return error; return errorResponse(500, "COMMENT_LIST_FAILED", "暂时无法加载评论，请稍后重试。"); }`
    - 反例: `catch (error) { return new Response(String(error), { status: 500 }); }`
  - 对外写操作（POST/PUT/DELETE）必须在首行显式调用 `requireSameOriginJson(request)` 进行同源校验与 Content-Type 检查。
- 核心技术栈特定规范:
  - 页面与静态标记必须使用 Astro 组件（`.astro`）；仅交互/状态/动效岛屿使用 React（`.tsx`），并按需声明客户端水合策略（如 `client:visible`、`client:idle`、`client:load`）。
  - 模块导入路径: 项目内通用模块统一使用路径别名 `@/*` 引用 `src/*`（如 `import { ... } from "@/lib/comments"`）。
  - 行为断言测试: 测试统一使用 `node:assert/strict` 搭配 `node:test`，严禁通过正则表达式匹配文件源码来伪造测试通过。

## 禁止事项
- 严禁手动修改自动生成目录及产物: `dist/`、`.astro/`、`.wrangler/`、`src/i18n/generated/*`。
- 严禁在代码、日志、组件或仓库中硬编码任何 Secret（如 `COMMENT_HASH_SALT`、`NETEASE_COOKIE_KEY`、`WAKA_TIME_API_KEY` 等），本地仅存未追踪的 `.env`。
- 禁止将国内可直连稳定的上游 HTTPS 资源（网易云 `p*.music.126.net`、豆瓣 `*.doubanio.com`）重复搬运/上传至 R2。
- 禁止在 Markdown 正文中引用本地绝对路径图片，必须统一使用 `https://img.muelsyse.us/bed/...`。
- 禁止在 `new-blog-ssr`（主 SSR Worker）中重复声明生产域名 `blog.muelsyse.us/*`（由 `blog-preferred-proxy` 统一持有）。
- 禁止在默认分支 `master` 存在未提交更改时未经确认直接覆盖代码；所有新功能开发必须在 `.worktrees/` 独立工作树中进行。
- 禁止私自引入重型运行时依赖，优先复用原生标准库或项目内现有依赖。

## 联动规则
- 数据库表结构联动: 修改 `schema/*.sql` 后，必须按序分别执行 `npm run db:migrate:local` 与 `npm run db:migrate:remote` 完成本地与远程 D1 数据库迁移。
- 环境变量与密钥联动: 本地修改 `.env` 中的密钥配置后，必须执行 `npm run cf:secrets:sync` 将变更同步至 Cloudflare Secrets。
- 文章 Slug 与 URL 重定向联动: 修改已发布文章 Slug 时，必须同步在 `src/lib/content-redirects.ts` 中维护旧 URL 301 重定向映射，并在 D1 数据库迁移历史互动及浏览统计数据。
- 内容库与 Slug 清单联动: 在 `src/content/` 中增删文章或修改元数据后，必须执行 `npm run content:prepare` 自动生成 Slug 并更新 `src/lib/post-slugs.ts` 中的 `CONTENT_IDS`，并通过 `npm run check:content-ids` 校验。
- 构建与静态资产编排联动: `npm run build` 会按流水线自动执行内容准备、翻译同步（`npm run translate`）、封面快照与图片同步校验；新图片衍生图与 `.blog-images-manifest.json` 同步由 GitHub Actions 在部署时自动处理并回写仓库，无需本地手动篡改 manifest。
