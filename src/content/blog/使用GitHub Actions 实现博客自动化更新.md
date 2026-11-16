---
title: 使用GitHub Actions 实现博客自动化更新
createdAt: 2026-08-13
published: true
updatedAt: 2026-08-13
description: 将博客的检查、构建和 Cloudflare 部署全部交由 GitHub Actions 自动化流水线处理。
tags:
  - 自动化
  - actions
  - cloudflare
slug: 20260813-01
---
## 自动化流水线流程

所有验证、资源处理与部署都在 GitHub Actions 完成，自动同步到 Cloudflare。

![博客的 GitHub Actions 部署流水线](https://img.muelsyse.us/bed/paper-20261110-actions-pipeline-b4436589c249.png)

*图 1：测试、构建和部署依次执行；前序步骤失败后不会继续部署。构建生成的清单在部署后由 Action 回写仓库。*

1. **本地推送**：通过 Git 推送 Markdown 内容到 GitHub 仓库。
2. **CI 触发**：GitHub Actions 捕获 `master` 分支的 `push` 事件，或接受手动触发，然后启动构建环境。
3. **自动化处理**：安装依赖并运行测试，再执行内容准备、图片同步、翻译同步、构建校验与 SSR 产物打包。
4. **CF 部署**：调用 Cloudflare Wrangler，更新线上服务。
5. **回写构建产物清单**：将图片 manifest、内容 ID 映射和翻译等自动生成的变更提交回仓库。

## GitHub Actions 配置

工作流放在仓库根目录的 `.github/workflows/deploy.yml`。下面展示核心步骤；当前仓库还配置了并发控制、构建清单回写和历史部署清理，完整配置以该文件为准：

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

### 关键配置说明
在 GitHub 仓库设置中的 `Secrets and variables -> Actions` 添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。本项目的构建还会调用翻译服务，因此需要对应的 `OPENAI_BASE_URL`、`API_KEY` 和 `MODEL` 配置。密钥只放在 Secrets 中。

`npm run deploy` 会先执行构建；构建的前置脚本再依次准备内容、同步图片和翻译。清单回写需要工作流具有 `contents: write` 权限，提交信息使用 `[skip ci]`，避免构建产物的提交重复触发部署。
