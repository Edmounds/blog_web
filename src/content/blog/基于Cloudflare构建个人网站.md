---
title: 基于Cloudflare构建个人网站
description: "此站架构介绍: 两个 Worker、一个 SQL 数据库、一个对象存储"
createdAt: 2026-08-13
updatedAt: 2026-08-13
published: true
tags:
  - 网络
  - 建站
  - 优化
slug: 20260813-02
---
## 引文

我的这个网站跑着两个 Cloudflare Worker、一个 SQL 数据库和一个对象存储。评论、点赞、浏览量是实时的，书影音收藏有自己的管理后台，听歌排行每天凌晨自动同步。而账单里除了域名，其他部分成本约等于零。

这篇文章介绍它的结构。当前由 `muelsyse-blog` 直接持有博客域名；另一个 `blog-art-cover-fetcher` 负责封面抓取，通过服务绑定供应用调用。后台路径由 Cloudflare Access 保护，定时同步任务也在应用 Worker 中执行。

![博客的 Cloudflare 架构](https://img.muelsyse.us/bed/paper-20261110-cloudflare-architecture-e308f5492721.png)

*图 1：应用 Worker 直接承接博客域名，封面抓取 Worker 通过服务绑定调用；D1、R2 与静态资源服务各自承担存储和分发职责。*

## 单个请求链路

![博客请求处理流程](https://img.muelsyse.us/bed/paper-20261110-cloudflare-request-34513a050cca.png)

*图 2：请求按资源类型进入静态资源服务或应用逻辑。需要数据的页面与 API 再按业务访问 D1、R2 或外部服务。*

## 数据库设计

D1 是 Cloudflare 的托管 SQLite 数据库，用来存结构化数据：评论、点赞、浏览量、书影音收藏的元数据等等。

R2 负责正文图床和需要托管的图片资源。选它的主要原因是出口流量免费，图床最怕的就是流量费。稳定可直连的上游封面则保留原地址，不重复搬进 R2。收藏元数据由 D1 管理；正文插图的引用保存在 Markdown 中，衍生图映射由构建清单维护。

## 图片Pipeline

我在 Obsidian 里写文章，粘贴图片的瞬间，图床插件把它直接传到 R2，Markdown 里留下的是一个在线 URL。正文通过 URL 引用原图，避免每次写作都把大图加入 Git 历史。

构建的时候，脚本会为需要优化的正文图片生成 AVIF 和 WebP 衍生图，目标宽度包括 640 / 1280 / 1920 像素，并根据原图尺寸避免放大。衍生图上传到 R2，映射写进 manifest。渲染时 Markdown 里那个 URL 不变，输出的 HTML 却是完整的 `<picture>`：浏览器按视口和像素密度挑最小够用的文件，正文第一张图高优先级加载，其余的懒加载。原图 URL 保留，作为兜底。

## 省米小策略

> 如果你的站是纯静态博客，Astro 加静态资源托管就够了，不需要运行应用 Worker 代码。
> 如果需要评论、后台、定时任务，D1 加 SSR Worker 是一种成本较低的组合。

### Worker
命中静态资源的请求不执行代码，也不计入 Workers 的每天10万次免费请求额度。CSS、JS、字体、本地图片都属于这类，它们免费且不限量。真正消耗每天 10 万次免费额度的，是需要执行应用 Worker 代码的请求，例如动态 HTML 渲染和 API 调用。

所以我让尽可能多的请求停在静态层。只有必须动态处理的路径才配置成先过 Worker。这样请求消耗基本都在免费额度范围内。

### D1
留意 D1 的行读取量。D1 免费额度每天 500 万行，但按的是扫描行数，不是返回行数。一个返回 20 条评论的查询，如果没走索引扫了全表，计的可能是几万行。给常用过滤字段建索引、列表分页，这些优化能最大程度利用D1免费额度。

###  注意免费额度限制
这里的零成本需要加限定：除域名外、访问量和数据量在免费额度内时，账单约等于零。额度具体是（2026 年 7 月）：

| 项目           | 免费额度               |
| ------------ | ------------------ |
| Workers 动态请求 | 10 万次/天，账户共享       |
| 静态资源请求       | 免费，不限量             |
| D1           | 500 万行读/天，10 万行写/天 |
| R2           | 10 GB 存储，出口流量免费    |

注意 10 万次是整个账户每天的免费上限，不是每个 Worker 各 10 万。D1 的全表扫描可能迅速消耗读额度；是否产生费用还取决于套餐和用量。表中额度是当时的记录，开通和扩容前仍要核对官方定价。

## 中国大陆访问加速

Cloudflare 的默认入口是 Anycast，路由由 BGP 决定，对国内三大运营商不总是友好。同一个站，电信可能很快，移动晚高峰可能绕路丢包。我的做法是优选 CNAME：把域名 CNAME 到一个会持续测速、更新解析结果的目标域名。

进站之后的速度靠缓存分层，规则按内容多久会变来定：

- 带内容哈希的 CSS / JS / 字体：缓存一年
- HTML：`no-cache`，复用缓存前需要重新验证
- 评论、统计这类动态 API：边缘缓存 15 秒，写请求一律 `no-store`。
- GitHub 热力图缓存 6 小时，WakaTime 缓存 15 分钟。

## 省流

静态内容尽量直接返回，动态逻辑放在应用 Worker；结构化数据交给 D1，正文图片交给 R2。先把路由和缓存边界理清楚，再根据实际用量判断是否需要付费。

## 参考

- [Workers 平台限制](https://developers.cloudflare.com/workers/platform/limits/)
- [静态资源计费规则](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 定价](https://developers.cloudflare.com/r2/pricing/)
- [MDN：Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cache-Control)
