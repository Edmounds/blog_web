# 个人网站

基于 Astro-star 0.16.25 视觉与页面结构重建的 Astro 内容站。默认语言为简体中文无前缀路径，英文、日文和繁体中文分别使用 `/en/`、`/ja/`、`/zh-TW/`。

## 站点结构

- 四页横向主界面：`/`、`/about/`、`/blog/`、`/note/`
- 内容详情：`/blog/[slug]/`、`/note/[slug]/`
- Blog / Note 分类：`/[section]-archive/` 与 `.../[archiveSlug]/`
- Life 收藏：`/art/book/`、`/art/music/`、`/art/screen/`
- 管理后台：评论 `/admin/comments/`、收藏 `/admin/art/`
- RSS：`/rss.xml` 及三个语言前缀下的 `/rss.xml`

移植部分的 Apache-2.0 许可证和来源说明见根目录 `LICENSE-ASTRO-STAR` 与 `NOTICE`。

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
npm run content:prepare
npm run check:encoding
npm run check:content-ids
npm run check
npm run build
```

## 内容

- Blog：`src/content/blog/**/*.{md,mdx}`
- Note：`src/content/note/**/*.{md,mdx}`
- About：`src/content/about/profile.md`
- 站点配置：`src/config/site/settings.md`
- 翻译输出：`src/i18n/content/<locale>/`

Blog、Note 公共 frontmatter 为 `title`、`description`、`createdAt`、`updatedAt`、`published`、`slug`、`tags`。文件名不参与 URL，可以直接使用中文或按 Obsidian 中方便管理的方式命名。

About frontmatter 中的 `backgroundKeywords` 仅用于 About 页面背景动画，不会显示在正文、搜索、RSS 或 SEO 中；所有语言共用这组原始关键词。

已发布内容使用 frontmatter 的 `slug` 生成 URL 和互动 ID，例如 `slug: 20260803-01` 对应 `/blog/20260803-01/` 和 `blog/20260803-01`。也可以手写 `slug: cloudflare-architecture`，但只能使用小写字母、数字和连字符，同一栏目内不得重复。slug 发布后应视为永久 ID；如需修改，必须同时增加旧 URL 重定向并迁移 D1 互动数据。

草稿可以不写 `slug`。首次设为 `published: true` 后，`npm run content:prepare` 会按 `createdAt` 自动写入 `YYYYMMDD-NN`，编号在同一栏目、同一天内递增；已写入的 slug 不会因标题、文件名或其他文章变化而重新生成。自动写入的 frontmatter 应和文章一起提交。该命令还会根据已发布的 Blog、Note 更新互动内容 ID；`npm run dev` 和 `npm run build` 会自动先执行它。`npm run translate` 会递归处理 `.md` 与 `.mdx`，保留 `slug`、目录和其他不可翻译字段。

## D1、R2 与迁移

互动数据和收藏元数据使用 Cloudflare D1。网易云音乐封面和豆瓣图书封面直接使用经过域名校验的国内上游 HTTPS 地址；用户上传、TMDB 等不适合国内直连的封面通过 `ART_COVERS` binding 写入 `blog-images/art/`，并由 `https://img.muelsyse.us` 公开访问。部署前执行：

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

`schema/content_ids.sql` 会幂等地把旧 Blog 裸 slug 和历史文件名 slug 迁移为当前 contentId。URL 收藏封面由独立的 `blog-art-cover-fetcher` Worker 获取，并同时检查 IPv4/IPv6 DNS 结果；先执行 `wrangler deploy --config wrangler.art-cover-fetcher.jsonc`。

博客和笔记正文使用 Obsidian 图床插件直接上传至 `blog-images` R2，Markdown 始终保存原始 `https://img.muelsyse.us/bed/...` 在线地址。开发和构建会为首次出现的栅格图生成同目录的 AVIF/WebP 多分辨率版本，并把映射写入 manifest；Markdown URL 不变，渲染时自动输出响应式 `<picture>`。AVIF 对象使用 `.avif.webp` 存储键，但响应 MIME 仍为 `image/avif`，用于避开图床域名针对 `.avif` 后缀的错误拦截。Life 收藏元数据通过 D1 和 `/admin/art/` 管理；封面按上述国内源直连或 R2 策略保存。

历史 `blog/` 图片也通过同一套 manifest 渲染。旧的本地绝对路径仍会先上传并改写为在线地址；已有在线地址不会被改写。常用命令：

```bash
npm run images:optimize   # 生成头像与 404 的本地 AVIF/WebP
npm run images:sync       # 同步本地旧图，并为新的在线图生成响应式版本
npm run images:verify     # 校验尺寸、质量、引用与 manifest 所有权
npm run images:verify -- --remote  # 额外校验 R2 对象和 MIME
```

原始在线图片继续保留，既作为 Markdown 中的稳定地址，也作为响应式图片的回退来源。manifest 只跟踪生成的响应式对象；待删除对象仍需在生产验证后通过 `npm run images:cleanup -- --confirmed-production` 清理。

## 环境变量

运行时密钥只放在未跟踪的 `.env` 或 Cloudflare Secret 中：

- `COMMENT_HASH_SALT`
- `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`
- `GOOGLE_BOOKS_API_KEY`、`TMDB_API_KEY`
- `NETEASE_COOKIE_KEY`（至少 32 个字符，用于加密持久化的网易云登录 Cookie）
- `NETEASE_MUSIC_U`、`NETEASE_CSRF`（仅用于首次迁移的旧登录引导，可在扫码登录成功后移除）
- `WAKA_TIME_API_KEY`
- 翻译服务所需的 `OPENAI_BASE_URL`、`API_KEY`、`MODEL`

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

音乐页的“听歌排行”由 `new-blog-ssr` 每天北京时间 04:00 先续期网易云登录，再分别同步一周排行前 20 首和总排行前 50 首；单项失败时保留上一次成功排行。首次上线先配置至少 32 个字符的 `NETEASE_COOKIE_KEY` Secret 并运行 `npm run db:migrate:remote`。随后可在 Cloudflare Access 保护的 `/admin/music/` 扫码登录；页面会显示 Token 与排行刷新时间及最近错误，也可手动刷新。旧的 `NETEASE_MUSIC_U` 与 `NETEASE_CSRF` 只作为迁移引导，首次成功续期会将音乐 Cookie 白名单加密写入 D1。

Cloudflare Access 必须同时保护 `blog.muelsyse.us/admin/*` 和 `blog.muelsyse.us/api/admin/*`。本地部署运行 `npm run deploy`；GitHub Actions 使用 Node 22，并需要 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。`npm run deploy` 只更新 `new-blog-ssr`；生产域名路由继续由 `blog-preferred-proxy` 持有，它通过 `ORIGIN` service binding 调用该 Astro SSR Worker，因此代理 Worker 只需在其配置或代码变化时单独执行 `npx wrangler deploy --config wrangler.preferred-proxy.jsonc`。不要让两个 Worker 同时声明 `blog.muelsyse.us/*`。

生产 API 路由位于 `src/pages/`，可复用的 Worker 服务端逻辑位于 `src/server/`。
