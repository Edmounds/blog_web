# 页面切换动画对比与移植分析（astro-arknights -> 当前项目）

## 1. 分析范围
- 参考动画素材：`PixPin_2026-02-23_22-43-01.gif` / `PixPin_2026-02-23_22-43-01.mp4`
- 参考源码：`astro-arknights`
- 对比目标：当前项目 `src/layouts/BaseLayout.astro` + `src/styles/global.css` 的 page transition
- 约束：本次只产出分析，不写实现代码

## 2. 动画观测（基于录屏抽帧）
从素材可稳定观察到的特征：

1. 主切换是**方向性擦除/推入**，不是简单淡入淡出。
2. 新内容通常从一侧“展开进入”，旧内容向相反侧“收缩离场”。
3. 顶部导航、右侧信息条、四边线框等“壳层元素”保持在场，且会有联动位移/显隐变化。
4. 单次切换时长体感约 0.8s~1.0s，且内容区与装饰层存在分层节奏（不是同一帧全部完成）。
5. 进入新页后，新页内部组件还有二级动效（列表项/标题/角色图等再次运动）。

## 3. astro-arknights 的实现机制（源码拆解）

### 3.1 不是 Astro View Transitions 路由切换
- `astro-arknights/src/pages/index.astro:15` 明确写了 TODO，表示未来才考虑 `<ViewTransitions />`。
- 当前主页是 `RootPageViews client:only="react"`（`astro-arknights/src/pages/index.astro:17`），属于**单页容器内切换**。

### 3.2 切换核心：同层绝对定位 + width 裁切
- 核心在 `astro-arknights/src/pages/_views/RootPageViewTemplate.tsx`：
  - 非激活页 `width: 0%`，激活页 `width: 100%`（第 8 行）
  - `transition-[width] duration-1000`（第 20 行）
  - 通过 `left` 在 `0 / auto` 间切换（第 12 行），决定“锚定左侧还是右侧”，从而得到前进/后退方向感
- 这是一种**真实 DOM 层**的裁切动画，不是浏览器快照伪元素动画。

### 3.3 状态与触发链
- 全局状态 `viewIndex` 在 `astro-arknights/src/components/store/rootLayoutStore.ts`。
- `RootPageViews.tsx` 通过 hash 同步索引（`hashchange` 在第 68 行），并在触摸手势里改写 `location.hash`（第 103、114 行）。
- 导航配置是 `#index/#blog/#operator...`（`astro-arknights/arknights.config.tsx:29-34`）。

### 3.4 观感“像官方”的关键不只主切换
除了主容器宽度切换，页面还有两层增强：

1. 壳层联动
- `LineDecorator` 通过 `directions` 做四边线位移与显隐，且也是 `duration-1000`（`astro-arknights/src/components/LineDecorator.tsx:6`）。
- 各大页在激活时都会设置不同 `directions.set(...)`（如 `00-Index.tsx:30`, `01-Blog.tsx:53`, `02-Operator.tsx:60`）。

2. 页内二级动效
- 每个大页都有自己的 active 动画（opacity/transform/delay、Framer Motion、Swiper 等）。
- 所以用户感知到的是“壳层切换 + 内容编排”的组合，而不是单一转场。

## 4. 当前项目实现（你现在这套）

### 4.1 基础架构
- 使用 Astro 路由转场：`<ViewTransitions fallback="animate" />`（`src/layouts/BaseLayout.astro:40`）。
- 主体是多路由页面，不是单页 hash 容器。

### 4.2 方向逻辑
- 通过 `getRouteRank/getMotion` 算 forward/backward/cross（`src/layouts/BaseLayout.astro:49-59`）。
- 在点击与 `astro:before-preparation` 阶段写入 `data-route-motion`（`src/layouts/BaseLayout.astro:88,103-111`）。

### 4.3 动画执行层
- 在 `src/styles/global.css` 同时对 `root` 和 `page-shell` 两组 `::view-transition-*` 伪元素做动画（第 51-54 行起）。
- 关键帧是 `clip-path + brightness + box-shadow`（第 123 行起）。
- 时长统一 `1000ms`（第 55 行）。

## 5. 关键差距（你“不满意”的根因）

1. **渲染层级不一致**
- 参考方案是“真实 DOM 容器裁切”。
- 你现在是“浏览器快照伪元素裁切”。
- 结果：边缘质感、层次真实感、内容可控性都不同。

2. **切换对象粒度不同**
- 参考方案切的是单一主视口容器（并让壳层独立联动）。
- 你现在 root 和 page-shell 同时参与快照动画，容易出现“整体都在动、质感偏糊”的观感。

3. **缺少壳层联动系统**
- 参考里有 `LineDecorator + PageTracker + 各页 active choreography`。
- 你现在主要只有主切换关键帧，页内进入编排弱很多。

4. **导航语义不同**
- 参考是同一路由内 hash 切换，状态连续。
- 你现在是跨路由跳转，虽有 rank 推断方向，但交互连续性不如单页容器。

5. **fallback/可达性路径与目标气质冲突**
- 你做了 `fallback="animate"` 和 `prefers-reduced-motion` 强制路径（`data-force-motion="true"`）。
- 这会让不同环境下动效表现分叉，调到“统一观感”会更难。

## 6. 可移植结论

可以移植，但不是“拷一套 keyframes”就能等价。

要还原到接近参考观感，最少要迁移三层思路：

1. 主切换层
- 用“容器裁切+方向锚点”思维替代纯快照转场（至少对主内容区单独建过渡层）。

2. 壳层联动层
- 独立维护线框/页码/侧栏等非内容层，并按页面状态联动，而不是跟着快照一起被裁。

3. 内容编排层
- 为首页/列表页/详情页分别定义进入节奏（延迟、位移、透明度、局部组件动画）。

## 7. 建议的迁移路线（不写代码版）

### Phase A（先把“主观像不像”拉上来）
1. 先确定保留“多路由”还是改为“单页分段（hash/状态）”。
2. 无论选哪条路，都先把“主内容切换层”与“壳层”剥离，避免 root 全局快照同动。
3. 先复刻方向行为：前进与后退要有明确相反方向。

### Phase B（补齐参考项目的高级感）
1. 增加壳层联动（边框、右侧索引、页码变化）。
2. 给每类页面定义入场编排，不同页面使用不同 secondary motion。
3. 再调细节：边缘高光、亮度过渡、遮罩速度曲线。

### Phase C（工程稳态）
1. 统一 reduced-motion 策略（避免“开发强制动效”和系统偏好冲突）。
2. 定义性能预算（低端机/移动端）和降级路径。
3. 最后再处理 fallback 动画一致性。

## 8. 一句话结论
你当前实现已经有“方向擦除”的表层形态，但与 `astro-arknights` 的核心差距不在 keyframes，而在**架构层（快照 vs 实时容器）+ 壳层联动 + 页内二级编排**三件事。只改 CSS 参数，效果提升会有限。
