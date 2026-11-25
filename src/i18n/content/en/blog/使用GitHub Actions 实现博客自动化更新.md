---
title: Automate Blog Updates with GitHub Actions
createdAt: 2026-08-13T00:00:00.000Z
published: true
updatedAt: 2026-08-13T00:00:00.000Z
description: Automate blog checks, builds, and Cloudflare deployments with a GitHub Actions pipeline.
tags:
  - Automation
  - actions
  - Cloudflare
slug: 20260813-01
---

## Automated Pipeline Workflow

GitHub Actions handles all checks, asset processing, and deployment, automatically syncing everything to Cloudflare.

![GitHub Actions Deployment Pipeline for the Blog](https://img.muelsyse.us/bed/paper-20261110-actions-pipeline-b4436589c249.png)

*Figure 1: Testing, building, and deployment are executed in sequence; if a preceding step fails, deployment does not continue. The manifest generated during the build is written back to the repository by the Action after deployment.*

1. **Local Push**: Push Markdown content to a GitHub repository via Git.
2. **CI Trigger**: GitHub Actions Capture`master`of the branch`push`events or manual triggers, then start the build environment.
3. **Automation Workflow**: Install dependencies and run tests, then prepare the content, sync images and translations, validate the build, and package the SSR artifacts.
4. **CF Deployment**：Use Cloudflare Wrangler to update the production service.
5. **Write Back the Build Artifact Manifest**: Commit automatically generated changes—including the image manifest, content ID mappings, and translations—back to the repository.

## GitHub Actions Configuration

The workflow is placed in the repository root’s`.github/workflows/deploy.yml`The core steps are shown below; this repository also includes concurrency controls, build manifest write-back, and cleanup of previous deployments. Refer to this file for the complete configuration:

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

### Key Configuration Details
In the GitHub repository settings,`Secrets and variables -> Actions`Add`CLOUDFLARE_API_TOKEN`and`CLOUDFLARE_ACCOUNT_ID`. The build process for this project also calls a translation service, so the corresponding`OPENAI_BASE_URL`、`API_KEY`and`MODEL`Configuration. Store secrets only in Secrets.

`npm run deploy`The build runs first; its pre-build scripts then prepare the content, synchronize the images, and translations in sequence. Writing the manifest back requires the workflow to have`contents: write`permissions, commit messages use`[skip ci]`, preventing commits of build artifacts from triggering deployments again.