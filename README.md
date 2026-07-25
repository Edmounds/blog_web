# 个人网站

基于 Astro-star 0.16.25 视觉与页面结构重建的 Astro 内容站。默认语言为简体中文无前缀路径，英文、日文和繁体中文分别使用 `/en/`、`/ja/`、`/zh-TW/`。

## 站点结构

- 五页横向主界面：`/`、`/about/`、`/blog/`、`/note/`、`/project/`
- 内容详情：`/blog/[slug]/`、`/note/[slug]/`、`/project/[slug]/`
- Blog / Note 分类：`/[section]-archive/` 与 `.../[archiveSlug]/`
- Life 收藏：`/art/book/`、`/art/music/`、`/art/screen/`
- 管理后台：评论 `/admin/comments/`、收藏 `/admin/art/`
- RSS：`/rss.xml` 及三个语言前缀下的 `/rss.xml`

`Astro-star/` 是只读模板参考，不参与站点构建，也不发布模板示例内容。移植部分的 Apache-2.0 许可证和来源说明见根目录 `LICENSE-ASTRO-STAR` 与 `NOTICE`。

## 致谢与许可

本项目基于 [Astro-star 0.16.25](https://github.com/hanlife02/Astro-star) 修改与重建。感谢 [hanlife02](https://github.com/hanlife02) 开源原项目。

Astro-star 版权所有 © 2025 hanlife02，并以 [Apache License 2.0](./LICENSE-ASTRO-STAR) 授权。原项目来源及本项目的修改说明见 [NOTICE](./NOTICE)。除另有说明外，本站文章、图片等个人内容不因引用 Astro-star 的开源许可证而自动获得授权。

## 本地开发

需要 Node 22.12 或更高版本：

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

Blog、Note、Project 公共 frontmatter 为 `title`、`description`、`createdAt`、`updatedAt`、`published`、`order`、`tags`；Project 可额外使用 `projectUrl` 和 `docUrl`。文章 URL 和内容互动 ID 均直接使用文件名，例如 `first-note.md` 对应 `/blog/first-note/` 和 `blog/first-note`。

含中文的 Markdown 使用 UTF-8 BOM。`npm run translate` 会递归处理 `.md` 与 `.mdx`，保留目录和不可翻译字段。

## D1、R2 与迁移

互动数据和收藏元数据使用 Cloudflare D1，收藏封面通过 `ART_COVERS` binding 写入 `blog-images/art/`，并由 `https://img.muelsyse.us` 公开访问。部署前执行：

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

受控图片使用 AVIF 优先、WebP 回退。正文栅格图生成不放大的 `640 / 1280 / 1920 / 原图宽度` 版本，编码目标优先为 `SSIM >= 0.985`，必要时放宽至 `0.975`。常用命令：

```bash
npm run images:optimize   # 生成头像与 404 的本地 AVIF/WebP
npm run images:sync       # 上传 Typora 本地图片并改写 Markdown
npm run images:migrate    # 迁移已有、由 manifest 管理的 R2 栅格图
npm run images:verify     # 校验尺寸、质量、引用与 manifest 所有权
npm run images:verify -- --remote  # 额外校验 R2 对象和 MIME
```

同步与迁移只把旧对象加入 `pendingDeletion`，不会立即删除。现代格式部署通过生产检查后，才执行 `npm run images:cleanup -- --confirmed-production`；清理会逐个删除并通过 R2 直读确认对象确实不存在。PNG/JPEG 源文件在首次现代格式部署中保留，避免上线验证失败时失去回滚资源。

从旧 `blog-art-covers` 桶迁移已有封面时，先复制并逐个校验哈希：

```bash
npm run art:covers:migrate -- --remote
```

确认站点已部署并且所有图床 URL 正常后，再删除旧对象副本：

```bash
npm run art:covers:migrate -- --remote --delete-source
```

## 环境变量

运行时密钥只放在未跟踪的 `.env` 或 Cloudflare Secret 中：

- `COMMENT_HASH_SALT`
- `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`
- `GOOGLE_BOOKS_API_KEY`、`TMDB_API_KEY`
- `NETEASE_MUSIC_U`、`NETEASE_CSRF`
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

音乐页的“听歌排行”由 `new-blog-ssr` 每天北京时间 04:00 同步网易云账号近一周的前 20 首歌曲，并写入 D1。Worker 需要配置 `NETEASE_MUSIC_U` 与 `NETEASE_CSRF` 两个 Secret；同步失败时保留上一次成功排行。首次上线先运行 `npm run db:migrate:remote`，再通过本机环境执行 `npm run netease:sync -- --remote`，或等待下一次定时任务。

Cloudflare Access 必须同时保护 `blog.muelsyse.us/admin/*` 和 `blog.muelsyse.us/api/admin/*`。本地部署运行 `npm run deploy`；GitHub Actions 使用 Node 22，并需要 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。`npm run deploy` 只更新 `new-blog-ssr`；生产域名路由继续由 `blog-preferred-proxy` 持有，它通过 `ORIGIN` service binding 调用该 Astro SSR Worker，因此代理 Worker 只需在其配置或代码变化时单独执行 `npx wrangler deploy --config wrangler.preferred-proxy.jsonc`。不要让两个 Worker 同时声明 `blog.muelsyse.us/*`。

仓库保留的 `functions/` 目录只用于旧 Pages 兼容测试，不参与当前 SSR Worker 部署；实际运行路由在 `src/pages/`。
