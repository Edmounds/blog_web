---
title: 使用 Cloudflare R2 + PicGo 打造免費圖床
description: 基於 Cloudflare R2 物件儲存與 PicGo 建立零出口流量費的圖床，實現 Obsidian 與 Typora 寫作時即時自動上傳。
tags:
  - Cloudflare
  - 免費使用
  - 圖片託管服務
createdAt: 2026-10-25T00:00:00.000Z
published: true
slug: 20261025-01
---

## 方案架構

使用 Cloudflare R2 取代傳統物件儲存，作為圖床後端。

```mermaid
flowchart LR
  A[Obsidian / Typora] -->|本地端口 36677| B[PicGo 本地服务]
  B -->|S3 API 上传| C[Cloudflare R2 Bucket]
```

1. 編輯器貼上圖片會觸發本機 PicGo 上傳。
2. PicGo 透過 S3 相容 API 將圖片推送至 R2。
3. 介面回傳 Custom Domain 連結，並自動替換圖片位址。

---
## 為什麼選擇 Cloudflare R2

都免費給你用了，還有什麼好說的？量大管飽，基本上不會超出限額，而且徹底免除出口流量費用。對中國大陸而言，唯一的缺點是如果不掛 VPN，存取速度會比較慢。

| 資源項目                  | Cloudflare R2 每月免費額度 | 超額計費單價          |
| :-------------------- | :------------------ | :-------------- |
| **儲存空間**              | 10 GB / 月           | $0.015 / GB / 月 |
| **Class A 操作（寫入/列出）** | 100 萬次 / 月          | $4.50 / 百萬次     |
| **Class B 操作（讀取/下載）** | 1000 萬次 / 月         | $0.36 / 百萬次     |
| 出口流量                  | **永久免費，無上限**        | **$0.00**       |

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
建立 Bucket、綁定 Custom Domain 等操作，都可以讓 Agent 透過 Wrangler 這個 cli 來完成，只需要用 Wrangler oauth 綁定自己的 cf 帳號即可。

## PicGo 用戶端設定

### 1. 安裝外掛程式
1. 開啟 PicGo 介面，進入「外掛程式設定」。
2. 搜尋並安裝 `picgo-plugin-cloudflare-r2`。

### 2. 設定參數
進入「圖床設定」->「Cloudflare R2」，填寫以下設定項目：

| **Account ID**      | 在 R2 概覽頁右下角查看      |
| :------------------ | :--------------- |
| **AccessKey ID**    | 產生的 API Token    |
| **SecretAccessKey** | 產生的 API Token    |
| **儲存桶名稱**           | 建立的 R2 Bucket    |
| **儲存路徑（可選）**        | 依需求指定目錄層級         |
| **自訂網域**           | R2 Custom Domain |

---

## 編輯器自動無感上傳

### Obsidian 設定
利用本機 PicGo 實現貼上圖片後自動上傳至圖床並替換：
1. 確保 PicGo 處於執行狀態。
2. 在 Obsidian 安裝`Image auto upload Plugin`外掛程式。
3. 在外掛程式中設定使用 PicGo 上傳服務。
4. 在筆記中直接貼上或拖曳圖片，圖片就會上傳至 R2 圖床，內文中的本機路徑會自動替換為遠端圖床連結。

### Typora 設定
依照圖示設定即可，最後點選「驗證圖片上傳選項」測試一下

![image.png](https://img.muelsyse.us/bed/20261025185635532.png)

---

## 快取最佳化與防刷策略

雖然 R2 出口流量免費，但 Class B 讀取請求超過 1000 萬次/月仍會產生少量費用。建議開啟 CDN 邊緣快取與防護。

在 Cloudflare Dashboard 中，進入網域的「Caching」->「Cache Rules」，新增規則：
- **匹配條件**：`Hostname equals img.yourdomain.com`
- **Edge Cache TTL**：覆寫來源伺服器並設為 1 年（31536000 秒）
- **Browser Cache TTL**：設為 1 年

所有熱門圖片都會由 Cloudflare 全球 CDN 節點快取，後續請求不會再穿透至 R2 Bucket，Class B 操作消耗降至最低。