# DEPLOY PLAN (GitHub + Cloudflare, Free Tier)

## 目标
- 部署方式：GitHub + Cloudflare Pages
- 无自建服务器
- 尽量使用免费服务
- 当前站点为纯内容展示，不包含评论功能

## 总体方案
- 前端与站点：Astro 静态站点部署到 Cloudflare Pages
- 可选统计 API：Cloudflare Pages Functions
- 可选数据存储：Cloudflare D1（免费额度内）
- 防刷与风控：Cloudflare Turnstile + 基础限流（IP/时间窗）

## 组件与职责
### 1) 站点托管
- 代码托管在 GitHub
- Cloudflare Pages 自动构建并发布静态产物

### 2) 阅读数与点赞（可选）
- API 路由建议：
  - `POST /api/view`：按 `slug` 增加阅读数
  - `POST /api/like`：按 `slug` 增加点赞数
  - `GET /api/stats?slug=...`：返回阅读数与点赞数
- 使用 D1 存储文章统计数据（按 `slug` 聚合）

### 3) 防刷
- 写接口接入 Turnstile 校验
- 后端按 IP + 时间窗做限流
- 阅读数建议做短时间去重，避免重复刷新

## 部署流程
1. 代码托管在 GitHub。
2. Cloudflare Pages 连接 GitHub 仓库并自动构建部署。
3. （可选）在 Cloudflare 创建 D1 数据库并执行 schema。
4. （可选）在 Cloudflare Pages 绑定 D1 到项目环境。
5. 配置环境变量（例如 Turnstile key）。
6. 合并到主分支后自动发布。

## D1 表结构示例
```sql
CREATE TABLE IF NOT EXISTS post_stats (
  slug TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## API 设计建议
### `POST /api/view`
- 入参：`{ slug }`
- 行为：`views = views + 1`
- 返回：`{ ok: true, views }`

### `POST /api/like`
- 入参：`{ slug, turnstileToken }`
- 行为：校验 token、限流，再执行 `likes = likes + 1`
- 返回：`{ ok: true, likes }`

### `GET /api/stats?slug=...`
- 返回：`{ slug, views, likes }`

## 推荐实施顺序
1. 先完成静态站点稳定发布。
2. 上线 `GET /api/stats` + 页面展示阅读/点赞。
3. 接入 `POST /api/view` 自动计数。
4. 接入 `POST /api/like` + Turnstile + 限流。
