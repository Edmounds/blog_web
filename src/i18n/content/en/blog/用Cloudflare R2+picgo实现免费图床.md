---
title: Build a Free Image Hosting Service with Cloudflare R2 + PicGo
description: Use Cloudflare R2 object storage and PicGo to set up an image host with zero egress fees, enabling instant, automatic uploads while writing in Obsidian and Typora.
tags:
  - Cloudflare
  - Get It for Free
  - Image hosting service
createdAt: 2026-10-25T00:00:00.000Z
published: true
slug: 20261025-01
---

## Solution Architecture

Use Cloudflare R2 instead of traditional object storage as the image hosting backend.

![Upload images to R2 with PicGo and write back the image links](https://img.muelsyse.us/bed/paper-20261110-picgo-upload-5539b593dd45.png)

*Figure 1: The editor invokes the local PicGo. After uploading the object, PicGo generates a public URL using the custom domain and passes it back to the editor to replace the image reference.*

1. Pasting an image into the editor triggers an upload via the local PicGo app.
2. PicGo uploads images to R2 via its S3-compatible API.
3. The PicGo plugin constructs a public URL by combining the configured Custom Domain with the object path, and the editor plugin then automatically replaces the image URL.

---
## Why Choose Cloudflare R2

They’re practically giving it away for free—what more is there to say? For a personal image-hosting service like mine, the free allowance is fairly generous, and there are no egress traffic fees. That said, the free tier only covers storage and requests within the quota; lots of traffic or frequent uploads can still push you over the limit. Speeds for direct connections from mainland China also depend on the network route, so you can’t judge it by the bill alone.

The following are the Standard storage prices recorded at the time of writing; before activating it, refer to[Official R2 Pricing](https://developers.cloudflare.com/r2/pricing/)shall prevail:

| Resource              | Cloudflare R2 Free Monthly Allowance | Overage Unit Price |
| :-------------------- | :------------------ | :-------------- |
|**Storage Space**| 10 GB / month           | $0.015 / GB / month |**Class A operations (write/list)**| 1 million requests / month | $4.50 / million requests     |
|**Class B operations (read/download)**| 10 million requests / month | $0.36 / million requests |
| Egress traffic                  |**No egress fees**|**$0.00**|

---
## Enabling and Preparing Cloudflare R2

### Prerequisites
1. Log in to the Cloudflare Dashboard and go to “R2 Object Storage.”
2. Link a credit card or PayPal account to verify your account. You won’t be charged as long as you stay within the usage limits.
> If you don’t have a card, you can check out the second-hand market—one for under RMB 10 will do the job.

### Manual Configuration via the Web Interface
1. **Create a Bucket**：On the R2 page, click “Create bucket,” enter a name, and set Location to “Automatic.”
2. **Bind a public Custom Domain**: Go to Bucket -> “Settings” -> “Public Access” -> click “Connect Domain” and enter a subdomain (e.g.`img.yourdomain.com`).
3. **Obtain API credentials**:
   - **Account ID**: On the bottom right of the R2 Overview page, click “Copy” in the “Account Details” section.
   - **Access Key ID and Secret Access Key**:
	  1. Click “Manage API Tokens” under “Account Details” to open the API token page.
	  2. Click “Create Account API Token.”
	  3. Select “Object Read & Write” under Permissions, and specify the Bucket as needed.
	  4. Click Create, and in**Final Success Page**Copy and save now`Access Key ID`and`Secret Access Key`.
  > **Note**:`Secret Access Key`The secret is displayed only once after successful generation. If you did not save the secret for a previously created token, you cannot view it again; click “Create Account API token” again to generate a new one.

### Agent
Operations such as creating a bucket can be completed by the agent via the Wrangler CLI. First, log in to your Cloudflare account, then verify that you have the permissions required for the specific operations. Custom domain configuration can also be handled through the Dashboard or the Cloudflare API. The Wrangler login session and the S3 access keys required by PicGo are separate sets of credentials and cannot be used interchangeably.

## PicGo Client Configuration

### 1. Install the Plugin
1. Open PicGo and go to “Plugin Settings.”
2. Search for and install`picgo-plugin-cloudflare-r2`.

### 2. Configure Parameters
Go to “Image Hosting Settings” → “Cloudflare R2” and fill in the following configuration fields:

|**Account ID**| View in the bottom-right corner of the R2 overview page      |
| :------------------ | :--------------- |
|**Access Key ID**| Access Key ID generated when creating the R2 token |
|**SecretAccessKey**| Secret Access Key generated at the same time |
|**Bucket name**| Created R2 Bucket    |
|**Storage path (optional)**| Specify directory levels as needed         |
|**Custom Domain**| R2 Custom Domain |

---

## Automatic, seamless uploads from the editor

### Obsidian Configuration
Use local PicGo to automatically upload pasted images to the image host and replace them:
1. Make sure PicGo is running.
2. Install in Obsidian`Image auto upload Plugin`Plugin.
3. Configure the plugin to use PicGo for image uploads.
4. Paste or drag images directly into your notes, and they’ll be uploaded to the R2 image host, with their local paths in the body text automatically replaced by remote image-host links.

### Typora Configuration
Configure it as shown in the diagram, then click “Verify image upload option” to test it.

![image.png](https://img.muelsyse.us/bed/20261025185635532.png)

---

## Cache Optimization and Anti-Abuse Strategies

Although R2 offers free egress traffic, more than 10 million Class B read requests per month will still incur a small charge. Enabling CDN edge caching and protection is recommended.

In the Cloudflare Dashboard, go to the domain’s “Caching” → “Cache Rules” and add a rule:
- **Matching conditions**:`Hostname equals img.yourdomain.com`
- **Edge Cache TTL**: Replace the origin server and set it to 1 year (31536000 seconds)
- **Browser Cache TTL**: Set to 1 year

Requests served from the CDN cache do not need to read from R2 again, which reduces Class B operations. However, the request still goes back to the origin on the first visit, after the cache expires, or when the object is evicted from a cache node, so a long TTL cannot guarantee zero read charges. When browser caching is set to one year, use a new object name when updating an image to prevent readers from continuing to see the old version.