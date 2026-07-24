# chasen

基于 Astro-star 0.16.25 视觉与页面结构重建的 Astro 内容站。默认语言为简体中文无前缀路径，英文、日文和繁体中文分别使用 `/en/`、`/ja/`、`/zh-TW/`。

## 站点结构

- 五页横向主界面：`/`、`/about/`、`/blog/`、`/note/`、`/project/`
- 内容详情：`/blog/[slug]/`、`/note/[slug]/`、`/project/[slug]/`
- Blog / Note 分类：`/[section]-archive/` 与 `.../[archiveSlug]/`
- Life 收藏：`/art/book/`、`/art/music/`、`/art/screen/`
- 管理后台：评论 `/admin/comments/`、收藏 `/admin/art/`
- RSS：`/rss.xml` 及三个语言前缀下的 `/rss.xml`

`Astro-star/` 是只读模板参考，不参与站点构建，也不发布模板示例内容。移植部分的 Apache-2.0 许可证和来源说明见根目录 `LICENSE-ASTRO-STAR` 与 `NOTICE`。

## 本地开发

需要 Node 22：

```bash
npm ci
npm run dev
```

完整检查：

```bash
npm test
npm run check:encoding
npm run check:content-ids
npm run check
npm run build
```

## 内容

- Blog：`src/content/blog/**/*.{md,mdx}`
- Note：`src/content/note/**/*.{md,mdx}`
- Project：`src/content/project/**/*.{md,mdx}`
- About：`src/content/about/profile.md`
- 翻译输出：`src/content/translations/<locale>/`

Blog、Note、Project 公共 frontmatter 为 `routeSlug`、`title`、`description`、`image`、`createdAt`、`updatedAt`、`published`、`type`；Project 可额外使用 `projectUrl` 和 `docUrl`。内容互动使用稳定 ID `contentId = "<section>/<slug>"`。

含中文的 Markdown 使用 UTF-8 BOM。`npm run translate` 会递归处理 `.md` 与 `.mdx`，保留目录和不可翻译字段。

## D1、R2 与迁移

互动数据和收藏元数据使用 Cloudflare D1，收藏封面使用 `ART_COVERS` R2 binding。部署前执行：

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

`schema/content_ids.sql` 会幂等地把旧 Blog 裸 slug 迁移为 `blog/<slug>`。URL 收藏封面由独立的 `blog-art-cover-fetcher` Worker 获取，并同时检查 IPv4/IPv6 DNS 结果；先执行 `wrangler deploy --config wrangler.art-cover-fetcher.jsonc`。

首次切换收藏数据时，使用归档的旧封面目录执行一次迁移：

```bash
LEGACY_ART_COVERS_DIR=/absolute/path/to/legacy-art-covers node --env-file-if-exists=.env scripts/migrate-art-to-d1.mjs --remote
```

博客、笔记和项目正文图片由 `npm run images:sync` 同步至 `blog-images` R2，历史 Blog 对象仍使用 `blog/<sha256>.<ext>`。Life 收藏封面与数据只通过 D1/R2 和 `/admin/art/` 管理。

## 环境变量

运行时密钥只放在未跟踪的 `.env` 或 Cloudflare Secret 中：

- `COMMENT_HASH_SALT`
- `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`
- `GOOGLE_BOOKS_API_KEY`、`TMDB_API_KEY`
- `WAKA_TIME_API_KEY`（推荐名称；`WAKATIME_API_KEY` 仅保留兼容）
- 翻译服务所需的 `SERVICE_TYPE`、`DEEPLX_*` 或 `OPENAI_BASE_URL`、`API_KEY`、`MODEL`

第一次创建 `new-blog-ssr` Worker 后，运行 `npm run cf:secrets:sync` 将本地 `.env` 中的变量批量上传为 Worker Secrets。脚本只把变量值通过标准输入交给 Wrangler，不会输出变量值或创建包含密钥的临时文件；也不会删除仅存在于 Cloudflare 的 Secret。`wrangler.astro.jsonc` 启用了 `keep_vars`，后续代码部署不会清除控制台中已配置的 secrets/vars。

WakaTime 密钥只由服务端 SVG 代理读取。曾在对话或日志中暴露的旧密钥必须先在 WakaTime 轮换，再将新值配置为 Cloudflare Secret：

```bash
npx wrangler secret put WAKA_TIME_API_KEY --name new-blog-ssr
```

不要把密钥写入组件、客户端脚本、仓库或构建产物。

## Cloudflare

本地完整 API 调试：

```bash
npm run build
npm run cf:dev
```

`cf:dev` 使用构建产物中的 Astro Worker 配置和本地 D1/R2 状态；先运行 `npm run db:migrate:local`。

Cloudflare Access 必须同时保护 `blog.muelsyse.us/admin/*` 和 `blog.muelsyse.us/api/admin/*`。本地部署运行 `npm run deploy`；GitHub Actions 使用 Node 22，并需要 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。`npm run deploy` 只更新 `new-blog-ssr`；生产域名路由继续由 `blog-preferred-proxy` 持有，它通过 `ORIGIN` service binding 调用该 Astro SSR Worker，因此代理 Worker 只需在其配置或代码变化时单独执行 `npx wrangler deploy --config wrangler.preferred-proxy.jsonc`。不要让两个 Worker 同时声明 `blog.muelsyse.us/*`。

仓库保留的 `functions/` 目录只用于旧 Pages 兼容测试，不参与当前 SSR Worker 部署；实际运行路由在 `src/pages/`。
