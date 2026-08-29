# 项目规则

## 构建和测试
- 本地开发：`npm run dev`（前置自动执行内容准备与图片同步）
- 类型检查：`npm run check`（执行 Astro 与 TypeScript 检查）
- 单元测试：`npm test`（执行 `node --test tests/*.test.mjs`）
- 格式与校验：`npm run check:encoding`（UTF-8 编码）、`npm run check:content-ids`（文章 ID 与 slug）
- 生产构建：`npm run build`（自动执行内容准备、翻译、封面快照、图片同步与校验打包）
- 本地 Worker 联调：`npm run cf:dev`

## 编码规范
- 基础格式：2 空格缩进，LF 换行符，UTF-8 编码且无 BOM。
- 组件选型：页面与静态标记优先使用 Astro 组件（`.astro`）；仅交互/状态/动效岛屿使用 React（`.tsx`）。
- 目录职责：UI 原语放 `src/components/ui/`，业务组件按角色放 `src/components/{site,sections,cards,domain,links}/`。
- Slug 命名：统一小写 kebab-case，日期文章格式为 `YYYYMMDD-NN`（如 `20260803-01`）。
- 测试编写：必须断言输入、输出与副作用等具体行为，严禁对源码文件正则匹配；统一扩展 `tests/*.test.mjs`。
- 开发隔离：新功能开发统一使用独立 Git Worktree（位于 `.worktrees/`），开发完成后解决冲突并合并入主分支

## 禁止事项
- 严禁在代码、日志、组件或仓库中硬编码任何 Secret（如 `COMMENT_HASH_SALT`、`NETEASE_COOKIE_KEY`、`WAKA_TIME_API_KEY` 等），本地仅存未追踪的 `.env`。
- 禁止将国内可直连稳定的上游 HTTPS 资源（网易云 `p*.music.126.net`、豆瓣 `*.doubanio.com`）重复搬运/上传至 R2。
- 禁止在默认分支 `master` 存在未提交更改时未经确认直接覆盖代码。
- 禁止在 `new-blog-ssr` 中重复声明生产域名 `blog.muelsyse.us/*`（由 `blog-preferred-proxy` 统一持有）。
- 禁止在 Markdown 正文中引用本地绝对路径图片，必须统一使用 `https://img.muelsyse.us/bed/...`。

## 联动规则
- 改动数据库表结构：同步修改 `schema/*.sql`，并分别执行 `npm run db:migrate:local` 与 `npm run db:migrate:remote`。
- 改动环境变量或密钥：本地修改 `.env` 后，执行 `npm run cf:secrets:sync` 同步至 Cloudflare Secrets。
- 修改已发布文章 Slug：必须同步配置旧 URL 301 重定向并在 D1 迁移历史互动数据。
- 内容、封面与新图片资产：均由 `npm run build` 自动编排；新图片衍生图与 manifest 同步由 GitHub Actions 在部署时自动处理并回写仓库，无需本地手动同步。
