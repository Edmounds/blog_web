# 缪尔赛思加载动画实验记录

## 结论

这一版角色加载动画已停止使用。网页保留分阶段加载和 Life 路由加载遮罩，但前景改为普通加载图标。

实验生成的图片不会删除，方便以后参考或重新制作；站点代码不再引用这些角色图片。

## 原始目标

- 首次访问时先显示加载界面，主页可用后进入主页，再在后台加载其余 Canvas 内容。
- 进入 Life 页面时，在原页面上增加模糊遮罩和居中的加载动画。
- 角色参考 `tmp/立绘_缪尔赛思_1.png`。
- 动作参考 `tmp/斯卡蒂.mp4`，要求原地待机，不是行走动画。
- 双脚固定，上半身呼吸起伏和左右摆动，手臂轻微展开，后发和衣摆延迟摆动。

## 动作分析

参考视频为 30 FPS、204 帧、约 6.8 秒。观察到的单次循环约为 35 帧，即约 1.167 秒：

- 双脚固定在同一基线，保持外八站姿。
- 躯干围绕脚部锚点左右摆动，并进行垂直呼吸起伏。
- 一个左右摆动周期中约包含两次呼吸起伏。
- 头部跟随躯干产生轻微倾斜。
- 双臂从身体前方略微向两侧展开，再回到内侧。
- 后发横向摆幅最大，头发和衣摆比躯干延迟约 2 到 4 帧。

分析产物保存在：

- `tmp/video-motion-analysis/cycle-grid-label.png`
- `tmp/video-motion-analysis/cycle-18-grid.png`
- `tmp/video-motion-analysis/cycle-preview.gif`

## 尝试过的方案

### 整体图片动画

最初使用单张完整角色图片，通过 CSS 或图像处理产生起伏和摆动。这个方案会造成衣服和身体比例随帧变化，因此被放弃。

### 多帧完整角色

尝试生成多张完整角色帧，但生成模型无法稳定保持每一帧的服装尺寸、五官位置和身体比例，连续播放时仍有明显闪烁。

### Live2D 式独立图层

最后把角色拆为九个透明部件：

1. 左后发
2. 头部、面部、耳朵和前发
3. 右后发
4. 左臂、袖子和拳头
5. 躯干和黑色内搭
6. 右臂、袖子和拳头
7. 左侧外套衣摆
8. 骨盆、双腿和双靴
9. 右侧外套衣摆

网页仅对独立图层使用平移和旋转，没有对角色部件做缩放变形。虽然比例稳定性得到改善，但生成部件在肩部连接、衣服结构和静态组装精度方面仍未达到最终视觉要求，所以不再作为正式加载动画。

## 生成管线

图片通过私有环境变量管线生成：

- `OPENAI_IMAGE_BASE_URL`
- `OPENAI_IMAGE_API_KEY`
- 模型：`gpt-image-2`
- 脚本：`~/.config/agents/codex/skills/generate-images-with-env/scripts/generate_images.py`

透明背景使用纯色 `#ff00ff` 色键背景，再在本地转换为 Alpha 通道。任何文档和命令输出都不应记录 API Key。

## 保留文件

正式资源目录中的九个透明 WebP 继续保留，但已不再由加载组件引用：

- `public/images/loading/muelsyse-rear-hair-left.webp`
- `public/images/loading/muelsyse-rear-hair-right.webp`
- `public/images/loading/muelsyse-head.webp`
- `public/images/loading/muelsyse-arm-left.webp`
- `public/images/loading/muelsyse-arm-right.webp`
- `public/images/loading/muelsyse-torso.webp`
- `public/images/loading/muelsyse-coat-left.webp`
- `public/images/loading/muelsyse-coat-right.webp`
- `public/images/loading/muelsyse-legs.webp`

中间产物和图集位于：

- `tmp/imagegen/muelsyse-chibi/`
- `tmp/imagegen/muelsyse-idle/`
- `tmp/imagegen/muelsyse-live2d/`
- `tmp/loading-chibi-verify/`
- `tmp/loading-chibi-verify-v5/`

其中最后一次图集源文件为 `tmp/imagegen/muelsyse-live2d/parts-atlas-v4-source.png`。

## 当前替代方案

当前加载遮罩改用普通的几何加载图标。它不包含角色或缪尔赛思元素，仅沿用网站克制、黑白、细线和轻量动效的视觉气质。

首次访问、Life 路由遮罩、背景模糊、可访问性、超时恢复和减少动态效果设置仍由 `src/components/site/LoadingOverlay.astro` 负责。
