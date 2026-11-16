---
title: 用Cloudflare R2+picgo实现免费图床
description: 基于 Cloudflare R2 对象存储与 PicGo 构建零出口流量费的图床，实现 Obsidian 与 Typora 写作即时自动上传。
tags:
  - cloudflare
  - 白嫖
  - 图床
createdAt: 2026-10-25
published: true
slug: 20261025-01
---
## 方案架构

使用 Cloudflare R2 替代传统对象存储作为图床后端。

![PicGo 上传到 R2 并回写图片链接](https://img.muelsyse.us/bed/paper-20261110-picgo-upload-5539b593dd45.png)

*图 1：编辑器调用本地 PicGo，PicGo 上传对象后按自定义域名生成公开 URL，再交给编辑器替换图片引用。*

1. 编辑器粘贴图片触发本地 PicGo 上传。
2. PicGo 通过 S3 兼容 API 将图片推送至 R2。
3. PicGo 插件根据配置的 Custom Domain 和对象路径拼接公开链接，编辑器插件再自动替换图片地址。

---
## 为什么选择 Cloudflare R2

都给你白嫖了那还说啥了呢？对我这种个人图床，免费额度比较宽裕，而且没有出口流量费。不过免费的是额度内的存储和请求，大量访问或频繁上传仍可能超额。大陆直连的速度也要看线路，不能只看账单。

下面是写作时记录的 Standard 存储价格，实际开通前以 [R2 官方定价](https://developers.cloudflare.com/r2/pricing/) 为准：

| 资源项目                  | Cloudflare R2 免费月额度 | 超额计费单价          |
| :-------------------- | :------------------ | :-------------- |
| **存储空间**              | 10 GB / 月           | $0.015 / GB / 月 |
| **Class A 操作（写入/列出）** | 100 万次 / 月          | $4.50 / 百万次     |
| **Class B 操作（读取/下载）** | 1000 万次 / 月         | $0.36 / 百万次     |
| 出口流量                  | **出口流量不收费**        | **$0.00**       |

---
## Cloudflare R2 开通与准备

### 前置条件
1. 登录 Cloudflare Dashboard，进入「R2 Object Storage」。
2. 绑定信用卡或 PayPal 完成账户验证。额度内不会产生扣费。
> 没有卡的话可以去海鲜市场看看，10 RMB 以内就能搞定。

### 网页手动配置
1. **创建 Bucket**：在 R2 页面点击「Create bucket」，输入名称，Location 选 Automatic。
2. **绑定公开 Custom Domain**：进入 Bucket ->「Settings」->「Public Access」-> 点击「Connect Domain」，输入二级域名（例如 `img.yourdomain.com`）。
3. **获取 API 凭据**：
   - **Account ID**：在 R2 概览页右下角「Account Details」直接点击复制。
   - **Access Key ID 与 Secret Access Key**：
	  1. 点击「Account Details」下方的「Manage API Tokens」进入令牌页。
	  2. 点击「Create Account API token」。
	  3. Permissions 选择「Object Read & Write」，按需指定 Bucket。
	  4. 点击创建，在**最终成功页面**立即复制保存 `Access Key ID` 与 `Secret Access Key`。
  > **注意**：`Secret Access Key` 仅在生成成功时展示一次。若之前创建的 Token 未保存密钥，无法再次查看，需重新点击「Create Account API token」生成新密钥。

### Agent
创建 Bucket 等操作可以让 Agent 通过 Wrangler CLI 完成。先登录 Cloudflare 账号，再确认具体操作所需的权限；自定义域名配置也可以通过 Dashboard 或 Cloudflare API 处理。Wrangler 的登录会话和 PicGo 所需的 S3 访问密钥是两套凭据，不能互相替代。

## PicGo 客户端配置

### 1. 安装插件
1. 打开 PicGo 界面，进入「插件设置」。
2. 搜索并安装 `picgo-plugin-cloudflare-r2`。

### 2. 配置参数
进入「图床设置」->「Cloudflare R2」，填写以下配置项：

| **Account ID**      | R2 概览页右下角查看      |
| :------------------ | :--------------- |
| **AccessKey ID**    | 创建 R2 令牌时生成的 Access Key ID |
| **SecretAccessKey** | 同次生成的 Secret Access Key |
| **存储桶名称**           | 创建的 R2 Bucket    |
| **存储路径(可选)**        | 按需指定目录层级         |
| **自定义域名**           | R2 Custom Domain |

---

## 编辑器自动无感上传

### Obsidian 配置
利用本地 PicGo 实现粘贴图片自动上传图床并替换：
1. 确保 PicGo 处于运行状态
2. 在 Obsidian 安装 `Image auto upload Plugin`插件。
3. 插件配置一下使用picgo上传服务
4. 在笔记直接粘贴或拖入图片，图片将上传至 R2 图床，正文中的本地路径自动替换为远程图床链接。

### Typora 配置
按照图示配置即可，最后点击“验证图片上传选项”测试一下。

![image.png](https://img.muelsyse.us/bed/20261025185635532.png)

---

## 缓存优化与防刷策略

虽然 R2 出口流量免费，但 Class B 读取请求超过 1000 万次/月仍会产生少量计费。建议开启 CDN 边缘缓存与防护。

在 Cloudflare Dashboard 中，进入域名的「Caching」->「Cache Rules」，添加规则：
- **匹配条件**：`Hostname equals img.yourdomain.com`
- **Edge Cache TTL**：替换源服务器并设为 1 年（31536000 秒）
- **Browser Cache TTL**：设为 1 年

命中 CDN 缓存的请求无需再次读取 R2，可以减少 Class B 操作。首次访问、缓存失效或节点淘汰后仍会回源，所以长 TTL 不能保证零读取费用。浏览器缓存设为一年时，更新图片应使用新对象名，避免读者一直看到旧图。
