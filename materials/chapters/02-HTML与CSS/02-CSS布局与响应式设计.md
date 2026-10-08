# 02 · CSS 布局与响应式设计

## 一、样式为什么没生效：先理解层叠与优先级

CSS 全称是层叠样式表。多条规则作用于同一元素时，按以下顺序决定胜负：

1. **来源与重要性**：`!important` > 普通作者样式 > 浏览器默认样式。
2. **优先级（权重）**：行内样式 > ID 选择器 > 类／属性／伪类 > 元素／伪元素。
3. **书写顺序**：权重相同时，后写的胜出。

```css
/* 权重 0,1,0 —— 一个类 */
.card { color: #334155; }

/* 权重 0,2,0 —— 两个类，胜出 */
.card.featured { color: #1d4ed8; }

/* 权重 0,0,1 —— 元素选择器，最容易输 */
article { color: #000; }
```

**调试顺序**：开发者工具 Elements 面板选中元素 → Styles 面板看哪条规则被划掉 → Computed 面板确认最终生效值。

## 二、盒模型：布局的最小单位

```
┌─────────────────────── margin ───────────────────────┐
│  ┌────────────────── border ──────────────────┐      │
│  │  ┌────────────── padding ──────────────┐   │      │
│  │  │          content (width × height)    │   │      │
│  │  └──────────────────────────────────────┘   │      │
│  └─────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────┘
```

```css
*, *::before, *::after { box-sizing: border-box; }
```

- 默认 `content-box`：`width` 只算内容，加了 padding 后总宽变大，容易撑破布局。
- `border-box`：`width` 包含 padding 与 border，计算更符合直觉。**建议全站开启**。

## 三、选择器与命名

| 写法 | 含义 | 建议 |
| --- | --- | --- |
| `.card` | 类选择器 | 主力，可复用 |
| `.card .title` | 后代选择器 | 嵌套层级不超过 3 层 |
| `.card > .title` | 直接子元素 | 比后代更可控 |
| `[disabled]` | 属性选择器 | 表达状态很合适 |
| `:hover` / `:focus-visible` | 伪类 | 交互反馈必备 |
| `:nth-child(2n)` | 结构化伪类 | 表格斑马纹 |

**BEM 命名**：`block__element--modifier`，如 `.card__title--highlight`。看名字就知道归属，且天然低权重。

## 四、Flexbox：一维布局

```css
.toolbar {
  display: flex;
  justify-content: space-between;  /* 主轴方向的分布 */
  align-items: center;             /* 交叉轴方向的对齐 */
  gap: 12px;                       /* 子项间距，替代 margin 补丁 */
}

.toolbar .grow { flex: 1 1 auto; min-width: 0; }
```

| 属性 | 作用 | 常用值 |
| --- | --- | --- |
| `flex-direction` | 主轴方向 | `row` / `column` |
| `justify-content` | 主轴对齐 | `flex-start` / `center` / `space-between` |
| `align-items` | 交叉轴对齐 | `stretch` / `center` / `flex-start` |
| `flex-wrap` | 是否换行 | `wrap` |
| `gap` | 子项间距 | 任意长度 |
| `flex`（写在子项） | 增长／收缩／基准 | `1 1 0` 表示等分 |

> 经典难题：Flex 子项内超长文本导致溢出。给子项加 `min-width: 0`，再配合 `overflow: hidden` 与 `text-overflow: ellipsis`。

## 五、Grid：二维布局

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    'sidebar header'
    'sidebar main'
    'sidebar footer';
  min-height: 100vh;
  gap: 16px;
}

.layout > header { grid-area: header; }
.layout > main   { grid-area: main; }
```

| 属性 | 作用 |
| --- | --- |
| `grid-template-columns` | 定义列，`repeat(3, 1fr)` 表示三等分 |
| `minmax(240px, 1fr)` | 弹性卡片墙的经典写法 |
| `auto-fit` 搭配 `minmax` | 自适应列数，无需媒体查询 |
| `grid-area` | 把元素放进命名区域 |

**一行实现响应式卡片墙**：

```css
.cards {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
```

## 六、响应式设计

### 1. 移动优先 + 媒体查询

```css
/* 默认：小屏样式 */
.page { padding: 16px; }

@media (min-width: 768px) {
  .page { padding: 32px; }
}

@media (min-width: 1200px) {
  .page { max-width: 1100px; margin: 0 auto; }
}
```

| 断点 | 目标设备 | 常见用途 |
| --- | --- | --- |
| 默认 | 手机竖屏 | 单列、紧凑间距 |
| `min-width: 768px` | 平板 | 双列、侧边栏出现 |
| `min-width: 1200px` | 桌面 | 多列、内容居中限宽 |

### 2. 单位选择

| 单位 | 相对于 | 适用 |
| --- | --- | --- |
| `rem` | 根元素字号 | 字号、间距（推荐主力） |
| `em` | 当前元素字号 | 组件内部按比例缩放 |
| `%` | 父元素 | 宽度、容器 |
| `vw` / `vh` | 视口 | 全屏区块 |
| `clamp(1rem, 2.5vw, 2rem)` | 区间 | 流式字号，减少断点 |

### 3. 现代 CSS 特性

```css
:root { --brand: #2563eb; --radius: 10px; }
.btn { background: var(--brand); border-radius: var(--radius); }

.hero { aspect-ratio: 16 / 9; }
.panel:is(.active, .hovered) { border-color: var(--brand); }

@media (prefers-color-scheme: dark) {
  :root { --brand: #60a5fa; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms; transition-duration: 0.001ms; }
}
```

## 七、过渡与动画

```css
.btn { transition: transform 150ms ease, box-shadow 150ms ease; }
.btn:hover { transform: translateY(-2px); }

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.fade-in { animation: fade-in 240ms ease-out both; }
```

**性能提醒**：优先动画 `transform` 与 `opacity`（走合成层，不触发重排）；避免动画 `width`、`top`、`margin`。

## 八、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 元素总宽超出预期 | 未设置 `border-box` | 全局设置 `box-sizing` |
| 外边距塌陷 | 相邻块级元素 margin 合并 | 用 `gap`，或触发 BFC（`overflow: hidden`） |
| 绝对定位跑到祖先之外 | 最近的非 static 祖先不是预期元素 | 给父元素加 `position: relative` |
| 移动端输入时页面被放大 | 表单字号小于 16px | 输入控件字号设为 16px 以上 |
| 图片撑破容器 | 未限制宽度 | `img { max-width: 100%; height: auto; }` |
| 本地正常、部署后样式丢失 | 构建压缩或路径大小写不一致 | 检查构建配置与文件名大小写 |

## 九、动手练习

1. 用 Grid 搭「侧边栏 + 主内容」两栏骨架，768px 以下变成上下堆叠。
2. 用 Flexbox 做工具栏：左标题、右按钮组、中间弹性搜索框。
3. 用 `repeat(auto-fit, minmax(240px, 1fr))` 做卡片墙，并解释为什么不需要媒体查询。
4. 用 `clamp()` 实现随视口变化的标题字号。
5. 用 `prefers-color-scheme` 支持深色模式，并截图对比。

## 小结

- 优先级决定谁生效，盒模型决定元素多大，二者是 CSS 调试的根。
- Flexbox 管一维、Grid 管二维，`gap` 替代 margin 补丁。
- 移动优先 + 相对单位 + 少量断点，是好维护的响应式方案。