# DEPLOY PLAN (GitHub + Cloudflare, Free Tier)

## 目标
- 部署方式：GitHub + Cloudflare Pages
- 无自建服务器
- 尽量使用免费服务
- 实现功能：评论、点赞、阅读人数

## 总体方案
- 前端与站点：Astro（静态站点）部署到 Cloudflare Pages
- 评论系统：Giscus（基于 GitHub Discussions，免费）
- 点赞/阅读数 API：Cloudflare Pages Functions
- 数据存储：Cloudflare D1（免费额度内使用）
- 防刷与风控：Cloudflare Turnstile + 基础限流（IP/时间窗）

## 组件与职责

### 1) 评论（Giscus）
- 在 GitHub 仓库开启 Discussions
- 使用 Giscus App 绑定仓库
- 在文章页嵌入 Giscus 组件
- 评论数据存储在 GitHub Discussions，不需要自建后端

### 2) 点赞与阅读数（Cloudflare Functions + D1）
- 新增 API 路由：
  - `POST /api/view`：按文章 `slug` 增加阅读数
  - `POST /api/like`：按文章 `slug` 增加点赞数
  - `GET /api/stats?slug=...`：返回阅读数与点赞数
- 使用 D1 表存储文章统计数据（按 `slug` 聚合）

### 3) 防刷
- 接入 Turnstile 校验（前端获取 token，后端校验）
- 点赞端增加简单去重：
  - 前端：`localStorage` 标记是否点赞过
  - 后端：IP + 时间窗限流
- 阅读数统计建议做短时间去重，避免重复刷新刷量

## 部署流程
1. 代码托管在 GitHub
2. Cloudflare Pages 连接 GitHub 仓库并自动构建部署
3. 在 Cloudflare 创建 D1 数据库并执行 schema
4. 在 Cloudflare Pages 绑定 D1 到项目环境
5. 配置环境变量（例如 Turnstile key、Giscus 配置）
6. 合并到主分支后自动发布

## 数据表示例（D1）
可使用如下最小表结构（后续可扩展）：

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
- 行为：校验 token，校验限流，`likes = likes + 1`
- 返回：`{ ok: true, likes }`

### `GET /api/stats?slug=...`
- 返回：`{ slug, views, likes }`

## 免费策略与注意事项
- Giscus 免费，但评论依赖 GitHub Discussions 可用性
- D1 免费额度足够个人博客起步
- Turnstile 免费，建议全站启用在关键写操作（点赞/评论提交）
- 若流量上升，先优化缓存与限流，再考虑升级套餐

## 推荐实施顺序
1. 先接入 Giscus（最快看到评论功能）
2. 上线 `GET /api/stats` + 页面展示阅读/点赞
3. 接入 `POST /api/view` 自动计数
4. 接入 `POST /api/like` + Turnstile + 去重限流
5. 观察数据后再做更细的反作弊策略
