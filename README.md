# Astro 内容博客模板

## 功能
- 站点路由：`/`、`/blogs/`、`/blog/[slug]/`、`/series/`、`/series/[slug]/`、`/art/*`、`/about/`
- 内容管理：`Astro Content Collections`
- 样式系统：Tailwind + 全局设计 Token
- 明暗主题切换：跟随系统 + 本地持久化
- 博客文章匿名评论：名称、纯文本内容、北京时间、设备系统和大致地区
- Cloudflare Access 保护的评论管理后台：`/admin/comments/`

## 快速开始
```bash
npm install
npm run dev
```

## 评论与环境变量
评论数据使用现有 Cloudflare D1。部署评论 API 前必须先执行迁移：

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

必须配置以下运行时变量：

- `COMMENT_HASH_SALT`：用于为提交限频生成 IP HMAC。请使用足够长的随机密钥；缺少时 API 会拒绝写入评论。
- `CF_ACCESS_TEAM_DOMAIN`：Cloudflare Zero Trust 团队域名，例如 `https://example.cloudflareaccess.com`。
- `CF_ACCESS_AUD`：保护评论后台的 Access Application Audience 标签。

评论表不保存完整 IP 或原始 User-Agent。短期限频表只保存带密钥的 IP HMAC 和最后提交时间，评论记录只保存粗粒度设备、地区标签和 UTC 时间。

本地完整 API 调试前，在 `.env` 中配置变量，然后运行：

```bash
npm run build
npm run cf:dev
```

本地 API 启动命令会把 Pages Functions 的 `DB` 绑定指向与迁移脚本相同的 D1 数据库 ID。可用 `npm run test:comments:smoke` 对真实本地 D1 执行分页、隐藏/恢复和限频冒烟测试。

## Cloudflare Access

在 Zero Trust 中创建 Self-hosted Access Application，同时保护以下路径，只允许站长邮箱访问：

- `blog.muelsyse.us/admin/comments/*`
- `blog.muelsyse.us/api/admin/comments/*`

Access 应用的 Audience 必须与 `CF_ACCESS_AUD` 一致。应用内部还会验证 `Cf-Access-Jwt-Assertion` 的签名、Issuer、过期时间和 Audience，因此公开的 `pages.dev` 源站不能绕过后台鉴权。先执行远程 D1 迁移，再发布包含评论 API 的版本。

## 部署
本地发布到 Cloudflare Pages：
```bash
npm run deploy
```

平时更新使用 GitHub Actions：把改动提交并推送到 `master`，即会自动构建并发布。GitHub 仓库需要配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` Secrets，自定义域名需将 `blog.muelsyse.us` 的 CNAME 指向 `new-blog-c0s.pages.dev`。

## 编码规范
- 全项目使用 UTF-8。
- 含中文的 Markdown 文档使用 UTF-8 BOM，避免 Windows PowerShell 中出现 mojibake。
- 构建前自动执行 `npm run check:encoding`。

## 内容目录
- 博客：`src/content/blog/*.md`
- 专题：通过博客 frontmatter 的 `series` 字段组织
- 关于：`src/content/about/profile.md`
- 站点配置：`src/content/site/settings.md`
