# Life 页面恢复执行计划

> 执行目标：把当前 Life 改回独立页面策略。本文是给 Gemini 3.7 Flash 的执行指令，不是设计建议。
>
> 参考基线：
> - Life 导航的“桌面端向右展开、移动端下拉”以 `5843f1b` 中的 `src/components/site/Header.astro` 为视觉和交互基准。
> - 独立收藏页的页面结构以 `1256584^` 中的 `ArtSection.astro`、`GameSection.astro` 和页面路由为基准。
> - 当前用户明确确认的差异：规范路径使用 `/life/:type/`，不恢复 `/art/*`，不生成 `/life/` 索引，不保留首页缩略图快照；详情页标题使用英文大写。

## 1. 执行纪律

1. 先阅读本文件、仓库根目录 `AGENTS.md` 和当前 `git status`。
2. 当前工作区已有的 `src/content/.obsidian/workspace.json` 修改属于用户，禁止覆盖、清理或回滚。
3. 修改前保存基线：记录 `git diff --stat` 和 `git diff -- src/content/.obsidian/workspace.json`，不得把该文件纳入本任务改动。
4. 只执行本文列出的变更。不要重做视觉设计、不要调整颜色/间距/字体、不要改数据库表、不要改收藏管理后台、不要改文章内容。
5. 不要通过正则批量替换历史代码。需要恢复样式时，直接对照指定历史提交的文件逐段移植，再做最小的路径和标题适配。
6. 每完成一个阶段立刻运行该阶段的验证命令；出现失败先修复原因，不要跳过测试。
7. 不要创建 `/life/` 索引页，也不要为 `/life/` 选择默认子栏目或重定向目标。

## 2. 最终行为契约

### 页面和路由

- 保留并独立渲染四个页面：
  - `/life/book/`
  - `/life/music/`
  - `/life/screen/`
  - `/life/game/`
- 保留本地化版本：`/en/life/:type/`、`/ja/life/:type/`、`/zh-TW/life/:type/`。
- 四个页面使用普通 `BaseLayout`，不使用 `SpaLayout`，不参与嵌套滑页。
- `/life/`、`/en/life/`、`/ja/life/`、`/zh-TW/life/` 不生成页面，访问结果为现有 404 页面。
- 非法 Life 类型和非法 locale 使用现有 404 渲染，不跳转到 `/life/`、首页或 Books。
- 不生成、不恢复任何 `/art/*` 页面；删除当前 `/art/* -> /life/*` 的兼容重定向。

### 页面视觉和内容

- 页面标题固定使用：`BOOKS`、`MUSIC`、`MOVIES`、`GAMES`。
- 保留当前独立页面的数据读取、Screen 分类 tabs、Music tabs、网易云排行榜、游戏游玩时长和封面 fallback。
- 移除没有目标页面的 `LifeBackLink`。
- 独立页面的容器、标题分隔线、网格间距、tabs 结构以 `1256584^` 的独立页面实现为准；不要重新设计。

### 导航

- 主 SPA 导航只包含 Home、Blog、Note、Links、About。
- 桌面端恢复 Life 菜单：Life 为触发按钮，四个子项从 Life 右侧水平展开；不是下拉到下一行。
- 移动端恢复 Life 下拉：Life 在移动菜单中展开四个子项。
- 子项文案固定为 `Books / Music / Screen / Game`，不随语言切换。
- 子项链接分别为当前 locale 下的 `/life/book/`、`/life/music/`、`/life/screen/`、`/life/game/`。
- Life 触发按钮本身没有 `href`，不产生 `/life/` 链接，不带 `data-primary-route`。
- 保留旧版 hover、focus、Escape、点击外部关闭和移动端菜单行为。

## 3. 实施步骤

### A. 拆除 Life SPA 集成

修改 `src/layouts/SpaLayout.astro`：

- 删除 Life imports、Life props、Life slide、Life nested track、Life route 配置、Life cover clone/flight 动画和所有 Life-specific event handling。
- 将顶层 slide 恢复为五个主栏目；保留五栏目现有 SPA 导航、预加载、滚动和过渡行为。

修改 `src/layouts/BaseLayout.astro`：

- 删除对 Life nested index 的依赖。
- 页面方向计算只使用五个主栏目。

修改路由工具：

- `src/lib/spa-routes.ts` 只保留五个主栏目 SPA 所需的 route 常量和函数。
- 新建或整理一个 Life 专用模块，集中导出 `LIFE_TYPES`、`LifeType`、`LIFE_TITLES`、`isLifeType`。
- 不让 Life 类型常量继续伪装成 SPA nested route API。

### B. 恢复独立 Life 页面

修改两个动态页面：

- `src/pages/life/[type]/index.astro`
- `src/pages/[locale]/life/[type]/index.astro`

要求：

- 以 `1256584^` 的数据加载逻辑为基准，继续从 D1 读取 Art/Game 数据和 Music rankings。
- 使用 `BaseLayout`；`game` 渲染 `GameSection`，其他类型渲染 `ArtSection`。
- 保留 `prerender = false`、缓存响应头和 locale 校验。
- 无效参数改为现有 404 页面，不返回 302 到 `/life/`。

删除四个索引页面文件：

- `src/pages/life/index.astro`
- `src/pages/[locale]/life/index.astro`

### C. 恢复旧导航样式

修改 `src/components/site/Header.astro`：

- 直接参考 `git show 5843f1b:src/components/site/Header.astro` 的 Life 菜单 markup、CSS 和交互脚本。
- 只做两处必要适配：Life 触发器改为无链接按钮；子项路径保持 `/life/:type/`。
- 保留当前 Header 的其他非 Life 改动，不做无关格式化。

### D. 恢复独立页脚本边界

- 删除 `src/components/sections/LifeSection.astro`、`src/components/sections/LifeHomeSection.astro`、`src/components/domain/LifeBackLink.astro`。
- 删除 `src/lib/life-behaviors.ts` 及其引用。
- `ArtSection.astro`、`GameSection.astro`、`ArtCard.astro`、`GameCard.astro` 恢复为普通页面可自包含运行的脚本边界：tabs 和封面 fallback 在独立页面加载时必须正常工作。
- 详情页保留英文大写标题，但不得保留 `data-life-cover`、nested slide、deck transition 等 SPA 专用标记。

### E. 删除首页缩略图快照链路

删除或修改：

- `src/data/life-covers.json`
- `scripts/snapshot-life-covers.mjs`
- 仅服务快照的 `scripts/lib/life-covers.mjs` 逻辑
- `tests/life-covers.test.mjs`
- `package.json` 中的 `life:covers` 命令和 `prebuild` 调用
- `.github/workflows/deploy.yml` 对 `src/data/life-covers.json` 的提交同步
- `astro.config.mjs` 中只针对 `/life/` 索引的 HTML early-hint 配置
- `README.md` 中首页封面快照、`/life/` 索引和旧 `/art/*` 重定向说明

注意：`tests/art-storage.test.mjs` 和 `tests/games.test.mjs` 仍需要封面来源选择函数。把 `artCoverSource`、`gameCoverSource`、`selectCoverSources` 迁移到中性的共享脚本后再更新 import；不要误删 Art/Game 存储测试覆盖的逻辑。

### F. 删除旧 Art 重定向

- 从 `src/lib/content-redirects.ts` 删除 `ART_PATH_PATTERN`、`getLegacyArtRedirect` 及 Life 类型依赖。
- 从 `src/middleware.ts` 删除 `getLegacyArtRedirect` 调用，只保留文章旧 slug 重定向。
- 删除 `tests/content-redirects.test.mjs` 中 `/art/* -> /life/*` 的断言，并补充确认 `/art/*` 不再被该重定向处理。

## 4. 验收标准

### 静态检查

- `rg` 搜索不到 `life-covers.json`、`snapshot-life-covers`、`life:covers`、`data-life-deck`、`life-flip-overlay`、`getLegacyArtRedirect` 的生产引用。
- `rg` 搜索不到把 `/life/` 当作有效索引或默认跳转目标的代码。
- `src/content/.obsidian/workspace.json` 仍保持用户原有修改，不能出现在本任务 diff 中。

### 自动化验证

按顺序执行并全部通过：

```bash
npm test
npm run check
npm run check:encoding
npm run check:content-ids
npm run build
```

如果 `npm run build` 因外部翻译或 Cloudflare 凭证失败，保留完整错误信息，先确认不是本次路由/导入错误；不得为了绕过失败修改密钥逻辑或提交 `.env`。

### 页面验收

- 四个 `/life/:type/` 页面均由 `BaseLayout` 独立返回正确内容。
- `/life/` 及三种本地化根路径为 404。
- `/art/book/` 等旧路径没有 301/302 到 `/life/`。
- 桌面端 Life 子菜单从右侧水平展开；移动端 Life 子菜单向下展开。
- Screen/Music tabs、Music rankings、Game cards 和封面 fallback 均可用。
- Home/Blog/Note/Links/About 的 SPA 滑动和导航行为没有回归。
- 构建输出不包含 Life 首页缩略图快照文件或快照生成步骤。

## 5. 交付格式

完成后只汇报：

1. 实际修改的文件类别和行为变化；
2. 通过的验证命令；
3. 未通过的命令及原始原因；
4. 明确说明没有修改用户已有的 `workspace.json` 变更。

不要提交额外的视觉优化、URL 兼容策略、索引页、默认栏目或新功能。
