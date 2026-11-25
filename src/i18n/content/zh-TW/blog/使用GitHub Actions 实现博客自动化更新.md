---
title: 使用 GitHub Actions 實現部落格自動化更新
createdAt: 2026-08-13T00:00:00.000Z
published: true
updatedAt: 2026-08-13T00:00:00.000Z
description: 將部落格的檢查、建置與 Cloudflare 部署全部交由 GitHub Actions 自動化流程處理。
tags:
  - 自動化
  - Actions
  - Cloudflare
slug: 20260813-01
---

## 自動化流程

所有驗證、資源處理與部署都在 GitHub Actions 中完成，並自動同步至 Cloudflare。

![部落格的 GitHub Actions 部署流程](https://img.muelsyse.us/bed/paper-20261110-actions-pipeline-b4436589c249.png)

*圖 1：測試、建置與部署依序執行；前置步驟失敗後不會繼續部署。建置產生的清單會在部署後由 Action 回寫至儲存庫。*

1. **從本機推送**：透過 Git 將 Markdown 內容推送到 GitHub 儲存庫。
2. **CI 觸發**：GitHub Actions 捕獲`master`分支的`push`事件，或接受手動觸發，然後啟動建置環境。
3. **自動化處理**：安裝相依套件並執行測試，接著執行內容準備、圖片同步、翻譯同步、建置驗證及 SSR 產物打包。
4. **CF 部署**：呼叫 Cloudflare Wrangler，更新線上服務。
5. **回寫建置產物清單**：將圖片 manifest、內容 ID 對應和翻譯等自動產生的變更提交回儲存庫。

## GitHub Actions 設定

工作流程放在儲存庫根目錄的`.github/workflows/deploy.yml`。以下展示核心步驟；目前儲存庫還設定了併發控制、建置清單回寫以及歷史部署清理，完整設定請以該檔案為準：

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - master
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Chrome for diagram rendering
        run: npx puppeteer browsers install chrome

      - name: Run checks
        run: npm test

      - name: Build and deploy
        run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          OPENAI_BASE_URL: ${{ secrets.OPENAI_BASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
          MODEL: ${{ secrets.MODEL }}
          PUBLIC_BUILD_ID: ${{ github.sha }}
```

### 重要設定說明
在 GitHub 儲存庫設定中的`Secrets and variables -> Actions`新增`CLOUDFLARE_API_TOKEN`和`CLOUDFLARE_ACCOUNT_ID`。本專案的建置還會呼叫翻譯服務，因此需要相應的`OPENAI_BASE_URL`、`API_KEY`和`MODEL`設定。金鑰只放在 Secrets 中。

`npm run deploy`會先執行建置；建置的前置腳本再依序準備內容、同步圖片和翻譯。清單回寫需要工作流程具有`contents: write`權限，提交訊息使用`[skip ci]`，避免提交建置產物時重複觸發部署。