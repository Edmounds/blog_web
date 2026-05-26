# Human Tasks: Motion transition verification

这份清单只覆盖当前 Motion 动效任务。Cloudflare D1、点赞、浏览量、Giscus 评论不在当前验收范围内。

## 浏览器验证

- [ ] 验证桌面导航。
  - 打开 `/`，依次点击 `Blogs`、`Projects`、`About`、站点标题。
  - 确认 URL、active 状态、页面内容都正确。
  - 确认 active indicator 移动平滑，hover/focus 离开后回到当前页面。

- [ ] 验证移动导航。
  - 切到移动宽度。
  - 重复桌面导航流程。
  - 确认导航项不重叠，indicator 不错位。

- [ ] 验证 Blogs `Grid/List`。
  - 打开 `/blogs/`。
  - 切换 `Grid` 和 `List`。
  - 确认 `aria-pressed` 状态、列表显示、卡片显示、indicator 位置都正确。

- [ ] 验证 Blogs 搜索。
  - 输入一个有结果的关键词。
  - 输入一个无结果的关键词。
  - 确认 empty state 只在无结果时出现。

- [ ] 验证 reduced motion。
  - 在浏览器或系统设置中启用 `prefers-reduced-motion: reduce`。
  - 重复导航和 `Grid/List` 切换。
  - 确认位移动画被禁用或明显减少，功能保持可用。

## 代码验证

- [ ] 运行 `npm run check`。
- [ ] 运行 `npm run build`。
- [ ] 确认 `/projects/<slug>/` 静态页面已生成。

## 验收记录

- [ ] 桌面验证结果：`<待填写>`
- [ ] 移动验证结果：`<待填写>`
- [ ] reduced motion 验证结果：`<待填写>`
- [ ] `npm run check` 结果：`<待填写>`
- [ ] `npm run build` 结果：`<待填写>`
