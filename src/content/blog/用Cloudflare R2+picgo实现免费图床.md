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

```mermaid
flowchart LR
  A[Obsidian / Typora] -->|本地端口 36677| B[PicGo 本地服务]
  B -->|S3 API 上传| C[Cloudflare R2 Bucket]
```

1. 编辑器粘贴图片触发本地 PicGo 上传。
2. PicGo 通过 S3 兼容 API 将图片推送至 R2。
3. 接口返回 Custom Domain 链接并自动替换图片地址。

---
## 为什么选择 Cloudflare R2

都给你白嫖了那还说啥了呢？量大管饱，基本不会超出限额，而且彻底免除出口流量费用。对于大陆直连网络访问速度较慢。

| 资源项目                  | Cloudflare R2 免费月额度 | 超额计费单价          |
| :-------------------- | :------------------ | :-------------- |
| **存储空间**              | 10 GB / 月           | $0.015 / GB / 月 |
| **Class A 操作（写入/列出）** | 100 万次 / 月          | $4.50 / 百万次     |
| **Class B 操作（读取/下载）** | 1000 万次 / 月         | $0.36 / 百万次     |
| 出口流量                  | **永久免费，无上限**        | **$0.00**       |

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
创建Bucket、绑定Custom Domain这些操作都可以让Agent通过Wrangler这个cli去操作实现，只需要用Wrangler oauth一下绑定自己的cf账号即可

## PicGo 客户端配置

### 1. 安装插件
1. 打开 PicGo 界面，进入「插件设置」。
2. 搜索并安装 `picgo-plugin-cloudflare-r2`。

### 2. 配置参数
进入「图床设置」->「Cloudflare R2」，填写以下配置项：

| **Account ID**      | R2 概览页右下角查看      |
| :------------------ | :--------------- |
| **AccessKey ID**    | 生成的 API Token    |
| **SecretAccessKey** | 生成的 API Token    |
| **存储桶名称**           | 创建的 R2 Bucket    |
| **存储路径(可选)**        | 按需指定目录层级         |
| **自定义域名**           | R2 Custom Domain |

---

## 编辑器自动无感上传

### Obsidian 配置
利用本地 PicGo实现粘贴图片自动上传图床并替换：
1. 确保 PicGo 处于运行状态
2. 在 Obsidian 安装 `Image auto upload Plugin`插件。
3. 插件配置一下使用picgo上传服务
4. 在笔记直接粘贴或拖入图片，图片将上传至 R2图床，正文中的本地路径自动替换为远程图床链接。

### Typora 配置
按照图示配置即可，最后点击“验证图片上传选项”测试一下

![image.png](https://img.muelsyse.us/bed/20261025185635532.png)

---

## 缓存优化与防刷策略

虽然 R2 出口流量免费，但 Class B 读取请求超过 1000 万次/月仍会产生少量计费。建议开启 CDN 边缘缓存与防护。

在 Cloudflare Dashboard 中，进入域名的「Caching」->「Cache Rules」，添加规则：
- **匹配条件**：`Hostname equals img.yourdomain.com`
- **Edge Cache TTL**：替换源服务器并设为 1 年（31536000 秒）
- **Browser Cache TTL**：设为 1 年

所有热点图片将被 Cloudflare 全球 CDN 节点缓存，后续请求不再穿透到 R2 Bucket，Class B 操作消耗降至最低。
