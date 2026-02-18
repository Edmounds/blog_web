# 纯中文 Astro 博客模板

## 功能
- 中文站点路由：`/`、`/blogs/`、`/blog/[slug]/`、`/projects/`、`/about/`
- 内容管理：`Astro Content Collections`
- 样式系统：Tailwind + 全局设计 Token
- 明暗主题切换：跟随系统 + 本地持久化
- 评论系统：`/api/comments` + Supabase

## 快速开始
```bash
npm install
npm run dev
```

## 环境变量
复制 `.env.example` 为 `.env` 并填入：
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase 建表
在 Supabase SQL Editor 执行 `supabase/schema.sql`。

## 内容目录
- 博客：`src/content/blog/*.md`
- 项目：`src/content/projects/*.md`
- 关于：`src/content/about/profile.md`
