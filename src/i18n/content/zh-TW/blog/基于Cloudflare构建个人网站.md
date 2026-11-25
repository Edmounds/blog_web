---
title: 基於 Cloudflare 建構個人網站
description: 此站架構介紹：兩個 Worker、一個 SQL 資料庫、一個物件儲存空間
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

我的這個網站運作著兩個 Cloudflare Worker、一個 SQL 資料庫和一個物件儲存。評論、按讚、瀏覽量都是即時的，書影音收藏有自己的管理後台，聽歌排行每天凌晨自動同步。而帳單上除了網域之外，其他部分的成本幾乎等於零。

這篇文章介紹它的架構。目前由`muelsyse-blog`直接持有部落格網域；另一個`blog-art-cover-fetcher`負責封面抓取，透過服務繫結供應用程式呼叫。後台路徑由 Cloudflare Access 保護，定時同步任務也在應用程式 Worker 中執行。

![部落格的 Cloudflare 架構](https://img.muelsyse.us/bed/paper-20261110-cloudflare-architecture-e308f5492721.png)

*圖 1：應用程式 Worker 直接承接部落格網域，封面抓取 Worker 透過服務繫結呼叫；D1、R2 與靜態資源服務各自負責儲存與分發。*

## 單一請求鏈路

![部落格請求處理流程](https://img.muelsyse.us/bed/paper-20261110-cloudflare-request-34513a050cca.png)

*圖 2：請求依資源類型進入靜態資源服務或應用程式邏輯。需要資料的頁面與 API 再依業務需求存取 D1、R2 或外部服務。*

## 資料庫設計

D1 是 Cloudflare 託管的 SQLite 資料庫，用來儲存結構化資料：留言、按讚、瀏覽次數、書籍、影音收藏的中繼資料等等。

R2 負責文章內文的圖床，以及需要託管的圖片資源。之所以選用它，主要是因為出口流量免費；對圖床來說，最怕的就是流量費。對於穩定且可直接連線的上游封面，則保留原始網址，不重複搬到 R2。收藏中繼資料由 D1 管理；內文插圖的引用保存在 Markdown 中，衍生圖片的對應關係則由建置清單維護。

## 圖片處理管線

我在 Obsidian 裡寫文章，貼上圖片的瞬間，圖床外掛就會直接將圖片上傳到 R2，Markdown 裡留下的是一個線上 URL。內文透過 URL 引用原圖，避免每次寫作都把大圖加入 Git 歷史紀錄。

建置時，腳本會為需要最佳化的正文圖片產生 AVIF 與 WebP 衍生圖，目標寬度包括 640／1280／1920 像素，並根據原圖尺寸避免放大。衍生圖會上傳至 R2，對應關係寫入 manifest。渲染時，Markdown 裡的那個 URL 不變，輸出的 HTML 卻是完整的`<picture>`：瀏覽器會根據視窗大小與像素密度，選擇最小但足夠的檔案；正文中的第一張圖片以高優先順序載入，其餘圖片則延遲載入。保留原圖 URL 作為備援。

## 省錢小策略

> 如果你的網站是純靜態部落格，使用 Astro 搭配靜態資源託管就夠了，不需要執行應用程式的 Worker 程式碼。
如果需要留言、後台或排程工作，D1 搭配 SSR Worker 是一種成本較低的組合。

### Worker
命中靜態資源的請求不會執行程式碼，也不會計入 Workers 每天 10 萬次的免費請求額度。CSS、JS、字型、本地圖片都屬於這類資源，免費且不限量。真正會消耗每天 10 萬次免費額度的，是需要執行應用程式 Worker 程式碼的請求，例如動態 HTML 渲染和 API 呼叫。

所以我讓盡可能多的請求停留在靜態層，只有必須動態處理的路徑才設定為先經過 Worker。這樣一來，請求用量基本上都在免費額度範圍內。

### D1
留意 D1 的資料列讀取量。D1 每天提供 500 萬列的免費額度，但計算的是掃描列數，而不是回傳列數。一個回傳 20 則留言的查詢，如果沒有使用索引而掃描了整張資料表，計算的可能是幾萬列。為常用的篩選欄位建立索引，並對清單進行分頁，這些最佳化能最大限度地利用 D1 的免費額度。

###  注意免費額度限制
這裡所說的零成本需要加上限定條件：除了網域名稱之外，只要流量和資料量都在免費額度內，帳單就約等於零。具體額度如下（2026 年 7 月）：

| 項目           | 免費額度                   |
| -------------- | -------------------------- |
| Workers 動態請求 | 10 萬次／天，帳戶共用       |
| 靜態資源請求       | 免費，不限量             |
| D1           | 每天 500 萬行讀取，10 萬行寫入 |
| R2           | 10 GB 儲存空間，出口流量免費    |

注意，10 萬次是整個帳戶每天的免費上限，不是每個 Worker 各 10 萬次。D1 的全表掃描可能會迅速消耗讀取額度；是否產生費用還取決於方案和用量。表中的額度是當時的紀錄，啟用和擴充前仍要核對官方定價。

## 中國大陸存取加速

Cloudflare 的預設入口是 Anycast，路由由 BGP 決定，對中國大陸的三大電信業者不總是友善。同一個網站，電信可能很快，移動在晚間尖峰時段可能繞路並發生封包遺失。我的做法是使用優選 CNAME：將網域名稱 CNAME 到一個會持續測速、更新解析結果的目標網域名稱。

進站後的速度取決於快取分層，規則則依內容的變更頻率來設定：

- 含內容雜湊的 CSS／JS／字型：快取一年
- HTML：`no-cache`，重用快取前需要重新驗證
- 評論、統計這類動態 API：邊緣快取 15 秒，寫入請求一律`no-store`。
- GitHub 熱力圖快取 6 小時，WakaTime 快取 15 分鐘。

## 懶人包

靜態內容盡量直接回傳，動態邏輯放在應用程式 Worker；結構化資料交給 D1，內文圖片交給 R2。先釐清路由與快取的邊界，再根據實際用量判斷是否需要付費。

## 參考

- [Workers 平台限制](https://developers.cloudflare.com/workers/platform/limits/)
- [靜態資源計費規則](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [服務繫結](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [D1 定價](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 定價](https://developers.cloudflare.com/r2/pricing/)
- [MDN：Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cache-Control)