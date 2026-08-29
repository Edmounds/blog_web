---
title: 基於 Cloudflare 建構個人網站
description: 此站架構介紹：兩個 Worker、一個 SQL 資料庫、一個物件儲存
createdAt: 2026-08-13T00:00:00.000Z
updatedAt: 2026-08-13T00:00:00.000Z
published: true
tags:
  - 網路
  - 網站建置
  - 優化
slug: 20260813-02
---

你現在看到的這個網站，表面上是個部落格，實際上跑著兩個 Cloudflare Worker、一個 SQL 資料庫和一個物件儲存。留言、按讚、瀏覽量都是即時的，書籍、影視、音樂收藏有自己的管理後台，聽歌排行每天凌晨自動同步。而帳單裡除了網域之外，其他部分的成本約等於零。

這篇文章介紹它的結構：請求從哪裡進來、資料放在哪裡、圖片怎麼處理。

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

這裡有一個對成本影響最大的細節：命中靜態資源的請求不會執行程式碼，也不會計入 Workers 的請求額度。CSS、JS、字型、本機圖片都屬於這類，它們免費且不限量。真正消耗每天 10 萬次免費額度的，只有需要執行程式碼的 HTML 渲染和 API 呼叫。

所以我的原則是讓盡可能多的請求停留在靜態層。只有 `/api/*`、`/admin/*` 這類必須動態處理的路徑，才設定為先經過 Worker。

## 雙 Worker 設計

入口 Worker 存在的意義不是效能，而是解耦。我的公開網域使用了中國大陸優選入口，這條鏈路以後可能會更換方案；應用程式 Worker 則幾乎每天都在部署。轉發使用的是 Service Binding，也就是 Worker 之間的內部呼叫，不經過公開 UR，應用程式 Worker 因此也不需要暴露任何可以繞過入口直接存取的位址。

如果你的網站不需要折騰入口鏈路，這一層完全可以省略。

## 資料庫

D1 是 Cloudflare 託管的 SQLite，儲存著這個網站所有的結構化資料：留言、按讚、瀏覽量、書籍、影視、音樂收藏的中繼資料等等。

使用 D1 之前，我從沒注意過一個指標：讀取行數。D1 每天有 500 萬行的免費額度，但計算的是掃描行數，不是回傳行數。一個回傳 20 則留言的查詢，如果沒有使用索引而掃描整張資料表，計算的可能是幾萬行。為常用的篩選欄位建立索引、對列表進行分頁，這些最佳化能最大程度地利用 D1 的免費額度。

R2 儲存所有圖片：正文插圖、收藏封面。選擇它的主要原因是出口流量免費，圖片託管最怕的就是流量費。R2 只儲存檔案，而這些檔案對應的中繼資料則在 D1 中，兩邊透過物件鍵關聯。
## 圖片 Pipeline

我在 Obsidian 裡寫文章，貼上圖片的瞬間，圖片託管外掛就會直接把圖片傳到 R2，Markdown 裡留下的是一個線上 URL。儲存庫從頭到尾都沒有圖片二進位檔案，git 歷史不會膨脹。

建置時，腳本會為每張首次出現的圖片產生 AVIF 和 WebP 的多個寬度版本（640 / 1280 / 1920），傳回 R2 的同一個目錄，並把對應關係寫入 manifest。渲染時，Markdown 裡的那個 URL 不變，但輸出的 HTML 卻是完整的 `<picture>`：瀏覽器會根據視窗大小和像素密度挑選最小但足夠使用的檔案，正文第一張圖片會以高優先級載入，其餘圖片則延遲載入。原圖 URL 永遠有效，作為備援。

## 注意免費額度限制

這裡所說的零成本需要加上限制條件：除了網域之外，當存取量和資料量都在免費額度內時，帳單約等於零。具體額度如下（2026 年 7 月查詢的官方數字）：

| 項目           | 免費額度               |
| ------------ | ------------------ |
| Workers 動態請求 | 每天 10 萬次，帳戶共用       |
| 靜態資源請求       | 免費，不限量             |
| D1           | 每天讀取 500 萬行、寫入 10 萬行 |
| R2           | 10 GB 儲存空間，出口流量免費    |

有兩個容易被誤解的地方：10 萬次是整個帳戶每天的免費上限，不是每個 Worker 各有 10 萬次；特別要注意：D1 依掃描行數計算，沒有索引的查詢會以你意想不到的速度消耗額度。

## 中國大陸訪問加速

Cloudflare 的預設入口是 Anycast，路由由 BGP 決定，對中國大陸三大電信業者不一定友善。同一個網站，電信可能很快，行動網路在尖峰時段則可能繞路並丟包。

我的做法是使用優選 CNAME：將網域 CNAME 到一個會持續測速並更新解析結果的目標網域。必須說清楚它的作用：它只改善「瀏覽器連到 Cloudflare 哪個入口」這第一段路徑，TLS 憑證仍然是我自己的，Host 仍然是我的網域，內容不會經過任何第三方解密。它不是中國大陸 CDN，不是備案節點，也不保證所有地區、所有時段都會更快。第三方服務隨時可能失效，所以我保留了能在一分鐘內切回預設 DNS 的備援方案。

進站之後的速度靠快取分層，規則則根據內容多久會變動來決定：

- 帶有內容雜湊的 CSS / JS / 字型：快取一年，`immutable`。檔案變更時 URL 就會變更，永遠不會讀到舊檔案。
- HTML：`no-cache`，可以儲存，但每次都要重新驗證，確保部署後不會拿著舊頁面引用已經消失的資源。
- 留言、統計這類動態 API：邊緣快取 15 秒，寫入請求一律 `no-store`。
- GitHub 熱力圖快取 6 小時，WakaTime 快取 15 分鐘。TTL 會跟著資料實際的變化頻率走。

最後是感知層面的最佳化。首頁是五個橫向頁面的 SPA：目前頁面直接輸出，相鄰頁面會在瀏覽器閒置時預先擷取，滑鼠懸停在某個導覽項目上時，則立即預先擷取對應頁面。首次載入時的遮罩只等待兩件事：頁面完成兩幀繪製、首屏第一張圖片完成解碼；不等待 `window.load`，因為後者會被延遲載入的圖片和統計請求拖慢。

## 節省流量

如果你的網站是純靜態部落格，Astro 加上靜態資源託管就夠了，甚至一個 Worker 都不需要。架構應該隨著需求成長，而不是隨著文章成長。

如果需要留言、後台、定時任務，D1 加上 SSR Worker 是我使用過的個人專案中維護成本最低的組合。記得留意讀取行數。



## 參考

- [Workers 平台限制](https://developers.cloudflare.com/workers/platform/limits/)
- [靜態資源計費規則](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [D1 定價](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 定價](https://developers.cloudflare.com/r2/pricing/)
- [MDN：Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cache-Control)