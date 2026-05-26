# Astro 内容博客模板

## 功能
- 站点路由：`/`、`/blogs/`、`/blog/[slug]/`、`/series/`、`/series/[slug]/`、`/projects/`、`/projects/[slug]/`、`/about/`
- 内容管理：`Astro Content Collections`
- 样式系统：Tailwind + 全局设计 Token
- 明暗主题切换：跟随系统 + 本地持久化
- 无评论系统（当前版本为纯内容展示）

## 快速开始
```bash
npm install
npm run dev
```

## 环境变量
当前版本无必填运行时环境变量。

## 编码规范
- 全项目使用 UTF-8。
- 含中文的 Markdown 文档使用 UTF-8 BOM，避免 Windows PowerShell 中出现 mojibake。
- 构建前自动执行 `npm run check:encoding`。

## 内容目录
- 博客：`src/content/blog/*.md`
- 专题：通过博客 frontmatter 的 `series` 字段组织
- 项目：`src/content/projects/*.md`
- 关于：`src/content/about/profile.md`
- 站点配置：`src/content/site/settings.md`
