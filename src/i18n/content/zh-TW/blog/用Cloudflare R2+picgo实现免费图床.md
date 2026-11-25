---
title: 使用 Cloudflare R2 + PicGo 實現免費圖床
description: 基於 Cloudflare R2 物件儲存與 PicGo 建構零出口流量費的圖床，實現 Obsidian 與 Typora 寫作時即時自動上傳。
tags:
  - Cloudflare
  - 免費蹭用
  - 圖片託管服務
createdAt: 2026-10-25T00:00:00.000Z
published: true
slug: 20261025-01
---

## 方案架構

使用 Cloudflare R2 取代傳統物件儲存，作為圖床後端。

![PicGo 上傳到 R2 並回寫圖片連結](https://img.muelsyse.us/bed/paper-20261110-picgo-upload-5539b593dd45.png)

*圖 1：編輯器呼叫本機 PicGo，PicGo 上傳物件後依自訂網域產生公開 URL，再交由編輯器替換圖片引用。*

1. 編輯器貼上圖片會觸發本機 PicGo 上傳。
2. PicGo 透過 S3 相容 API 將圖片推送至 R2。
3. PicGo 外掛會根據設定的 Custom Domain 與物件路徑組合成公開連結，編輯器外掛再自動替換圖片網址。

---
## 為什麼選擇 Cloudflare R2

都免費給你用了，那還有什麼好說的呢？對我這種個人用的圖床來說，免費額度算是很充足，而且沒有出口流量費。不過，免費的是額度內的儲存空間和請求量，大量存取或頻繁上傳仍可能超出額度。中國大陸直連的速度也要看線路，不能只看帳單。

以下是撰寫時記錄的 Standard 儲存價格，實際開通前以[R2 官方定價](https://developers.cloudflare.com/r2/pricing/)為準：

| 資源項目                  | Cloudflare R2 每月免費額度 | 超額計費單價          |
| :-------------------- | :------------------ | :-------------- |
| **儲存空間**              | 10 GB / 月           | $0.015 / GB / 月 |
| **Class A 操作（寫入/列出）** | 100 萬次 / 月          | $4.50 / 百萬次     |
| **Class B 操作（讀取/下載）** | 1000 萬次 / 月         | $0.36 / 百萬次     |
| 出口流量                  | **出口流量不收費**        | **$0.00**       |

---
## Cloudflare R2 啟用與準備

### 先決條件
1. 登入 Cloudflare Dashboard，進入「R2 Object Storage」。
2. 綁定信用卡或 PayPal 完成帳戶驗證。在額度內不會產生費用。
> 沒有卡的話，可以去海鮮市場看看，10 RMB 以內就能搞定。

### 網頁手動設定
1. **建立 Bucket**：在 R2 頁面點選「Create bucket」，輸入名稱，Location 選 Automatic。
2. **綁定公開的 Custom Domain**：進入 Bucket ->「Settings」->「Public Access」-> 點選「Connect Domain」，輸入次網域（例如 `img.yourdomain.com`）。
3. **取得 API 憑證**：
   - **Account ID**：在 R2 概覽頁右下角的「Account Details」直接點擊複製。
   - **Access Key ID 與 Secret Access Key**：
	  1. 點選「Account Details」下方的「Manage API Tokens」進入權杖頁面。
	  2. 點選「Create Account API token」。
	  3. Permissions 選擇「Object Read & Write」，依需求指定 Bucket。
	  4. 點選建立，並在**最終成功頁面**立即複製並儲存 `Access Key ID` 與 `Secret Access Key`。
  > **注意**：`Secret Access Key` 僅在產生成功時顯示一次。若先前建立的 Token 未儲存密鑰，便無法再次查看，需重新點選「Create Account API token」產生新的密鑰。

### Agent
建立 Bucket 等操作可以讓 Agent 透過 Wrangler CLI 完成。先登入 Cloudflare 帳號，再確認執行具體操作所需的權限；自訂網域設定也可以透過 Dashboard 或 Cloudflare API 處理。Wrangler 的登入工作階段和 PicGo 所需的 S3 存取金鑰是兩套憑證，無法相互取代。

## PicGo 用戶端設定

### 1. 安裝外掛程式
1. 開啟 PicGo 介面，進入「外掛程式設定」。
2. 搜尋並安裝 `picgo-plugin-cloudflare-r2`。

### 2. 設定參數
進入「圖床設定」->「Cloudflare R2」，填寫以下設定項目：

| **Account ID**      | 在 R2 概覽頁右下角查看      |
| :------------------ | :--------------- |
| **AccessKey ID**| 建立 R2 權杖時產生的 Access Key ID |
|**SecretAccessKey**| 同一次產生的 Secret Access Key |
|**儲存桶名稱**           | 建立的 R2 Bucket    |
| **儲存路徑（可選）**        | 依需求指定目錄層級         |
| **自訂網域**           | R2 Custom Domain |

---

## 編輯器自動無感上傳

### Obsidian 設定
使用本機版 PicGo，貼上圖片後即可自動上傳至圖床並替換：
1. 確保 PicGo 處於執行狀態。
2. 在 Obsidian 安裝`Image auto upload Plugin`外掛程式。
3. 在外掛程式中設定使用 PicGo 上傳服務。
4. 在筆記中直接貼上或拖曳圖片，圖片就會上傳至 R2 圖床，內文中的本機路徑會自動替換為遠端圖床連結。

### Typora 設定
按照圖示設定即可，最後點選「驗證圖片上傳選項」測試一下。

![image.png](https://img.muelsyse.us/bed/20261025185635532.png)

---

## 快取最佳化與防刷策略

雖然 R2 出口流量免費，但 Class B 讀取請求超過 1000 萬次/月仍會產生少量費用。建議開啟 CDN 邊緣快取與防護。

在 Cloudflare Dashboard 中，進入網域的「Caching」->「Cache Rules」，新增規則：
- **匹配條件**：`Hostname equals img.yourdomain.com`
- **Edge Cache TTL**：覆寫來源伺服器並設為 1 年（31536000 秒）
- **Browser Cache TTL**：設為 1 年

命中 CDN 快取的請求不必再次讀取 R2，可減少 Class B 操作。首次存取、快取失效或節點淘汰後，仍會回源，因此較長的 TTL 無法保證讀取費用為零。瀏覽器快取設為一年時，更新圖片應使用新的物件名稱，避免讀者一直看到舊圖片。