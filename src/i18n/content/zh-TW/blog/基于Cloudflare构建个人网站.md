---
title: 基於 Cloudflare 建構個人網站
description: 此網站架構介紹：兩個 Worker、一個 SQL 資料庫、一個物件儲存空間
createdAt: 2026-08-13T00:00:00.000Z
updatedAt: 2026-08-13T00:00:00.000Z
published: true
tags:
  - 網路
  - 建立網站
  - 最佳化
slug: 20260813-02
---

## 引文

我的這個網站運行著兩個 Cloudflare Worker、一個 SQL 資料庫和一個物件儲存。留言、按讚和瀏覽量都是即時的，書影音收藏有自己的管理後台，聽歌排行每天凌晨自動同步。而在帳單中，除了網域之外，其他部分的成本幾乎等於零。

這篇文章介紹其架構

```mermaid
flowchart LR
  V[访客浏览器] --> D[DNS / 优选 CNAME]
  D --> E[入口 Worker]
  E -->|Service Binding| A[Astro SSR Worker]
  A --> S[静态资源]
  A --> Q[(D1 数据库)]
  A --> R[(R2 对象存储)]
  A --> X[外部 API]

  C[Cloudflare Access] -.保护后台.-> E
  K[Cron] -.每日定时同步.-> A
```
## 單一請求鏈路

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant E as 入口 Worker
  participant A as Astro SSR Worker
  participant D1 as D1 / R2

  B->>E: HTTPS 请求
  E->>A: 内部调用（Service Binding）
  alt 静态资源
    A-->>E: 直接返回带哈希的 CSS / JS / 图片
  else 页面或 API
    A->>D1: 查询或写入
    D1-->>A: 结果
    A-->>E: HTML / JSON
  end
  E-->>B: 补上安全响应头后返回
```

## 資料庫設計

D1 是 Cloudflare 託管的 SQLite 資料庫，用來儲存結構化資料：留言、按讚、瀏覽次數、書影音收藏的中繼資料等等。

R2 儲存所有圖片：內文插圖、收藏封面。選它的主要原因是出口流量免費，圖床最怕的就是流量費。R2 只儲存檔案，而與這些檔案對應的中繼資料在 D1 裡，兩邊透過物件鍵相互關聯。
## 圖片處理流程

我在 Obsidian 裡寫文章，貼上圖片的瞬間，圖床外掛就直接把它傳到 R2，Markdown 裡留下的是一個線上 URL。儲存庫裡從頭到尾都沒有圖片二進位檔案，git 歷史不會膨脹。

建置時，腳本會為每張首次出現的圖片產生 AVIF 和 WebP 的多個寬度版本（640 / 1280 / 1920），傳回 R2 的同一個目錄，並將對應關係寫入 manifest。渲染時，Markdown 裡的那個 URL 不變，輸出的 HTML 卻是完整的 `<picture>`：瀏覽器會依據視窗大小和像素密度，挑選最小且足夠的檔案，內文第一張圖片以高優先權載入，其餘圖片則延遲載入。原圖 URL 永遠有效，作為備援。

## 省錢小策略

>如果你的網站是純靜態部落格，Astro 加上靜態資源託管就夠了，連一個 Worker 都不需要。
如果需要留言、後台和排程工作，使用 D1 搭配 SSR Worker，成本會比較低。

### Worker
命中靜態資源的請求不會執行程式碼，也不會計入 Workers 每天 10 萬次的免費請求額度。CSS、JS、字型和本機圖片都屬於這類，不但免費，而且沒有用量限制。真正會消耗每天 10 萬次免費額度的，只有需要執行程式碼的 HTML 渲染和 API 呼叫。

所以我讓盡可能多的請求停留在靜態層。只有必須動態處理的路徑，才會設定為先經過 Worker。這樣一來，請求的用量基本上都能控制在免費額度內。

### D1
留意 D1 的讀取列數。D1 每天的免費額度是 500 萬列，但計算的是掃描的列數，而非回傳的列數。查詢若回傳 20 則留言，但沒有使用索引而是掃描整張資料表，計入的讀取列數可能高達數萬列。替常用的篩選欄位建立索引，並為列表分頁，這些最佳化都能充分利用 D1 的免費額度。

###  注意免費額度限制
這裡所說的零成本有個前提：除了網域費用之外，流量和資料量都在免費額度內時，帳單才約等於零。免費額度如下（2026 年 7 月）：

| 項目           | 免費額度               |
| ------------ | ------------------ |
| Workers 動態請求 | 10 萬次/天，帳戶共用       |
| 靜態資源請求       | 免費，不限量             |
| D1           | 500 萬行讀取/天，10 萬行寫入/天 |
| R2           | 10 GB 儲存空間，出口流量免費    |

注意，10 萬次是整個帳戶每天的免費上限，不是每個 Worker 各 10 萬次。

特別注意：D1 會按掃描的資料列計費，未建立索引的查詢可能會讓帳單暴增。

## 中國大陸訪問加速

Cloudflare 的預設入口是 Anycast，路由由 BGP 決定，對中國大陸三大電信業者不一定友善。同一個網站，透過電信可能很快，透過行動網路在尖峰時段則可能繞路或丟包。我的做法是優先選用 CNAME：將網域 CNAME 到一個會持續測速並更新解析結果的目標網域。

進站後的速度靠快取分層，規則依內容的變動頻率決定：
- 含內容雜湊的 CSS／JS／字型：快取一年
- HTML：`no-cache`，每次都要重新驗證，以確保使用的是最新的程式碼
- 留言、統計這類動態 API：邊緣快取 15 秒，寫入請求一律 `no-store`。
- GitHub 熱力圖快取 6 小時，WakaTime 快取 15 分鐘。

## 簡單說




## 參考

- [Workers 平台限制](https://developers.cloudflare.com/workers/platform/limits/)
- [靜態資源計費規則](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [D1 定價](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 定價](https://developers.cloudflare.com/r2/pricing/)
- [MDN：Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cache-Control)