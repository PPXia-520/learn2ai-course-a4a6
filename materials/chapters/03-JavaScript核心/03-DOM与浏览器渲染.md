# 03 · DOM 与浏览器渲染

## 一、浏览器渲染管线

```
HTML ──解析──▶ DOM 树 ┐
                      ├─▶ 渲染树 ──▶ 布局(Layout) ──▶ 绘制(Paint) ──▶ 合成(Composite) ──▶ 屏幕
CSS  ──解析──▶ CSSOM  ┘
```

| 阶段 | 做什么 | 代价高的操作 |
| --- | --- | --- |
| 解析 | 构建 DOM 与 CSSOM | 同步脚本阻塞解析 |
| 布局（重排） | 计算每个元素的位置与尺寸 | 读 `offsetWidth`、改 `width`／`font-size` |
| 绘制（重绘） | 填充颜色、边框、阴影 | 改 `color`、`background`、`box-shadow` |
| 合成 | 分层后交给 GPU 合成 | 改 `transform`、`opacity` 代价最低 |

**黄金法则**：动画与高频更新优先用 `transform` 与 `opacity`，避免「读—写—读—写」交替触发布局抖动。

```js
// 坏：每次循环都读写布局，强制同步重排
for (const el of items) {
  el.style.width = el.offsetWidth + 10 + 'px';
}

// 好：先批量读，再批量写
const widths = items.map(el => el.offsetWidth);
items.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });
```

## 二、选择与操作 DOM

```js
const list = document.querySelector('#todo-list');
const items = list.querySelectorAll('li[data-done=true]');

const li = document.createElement('li');
li.textContent = '新任务';           // 用 textContent 而非 innerHTML，天然防 XSS
li.dataset.id = 'a1';
li.classList.add('item', 'item--new');
list.append(li);
li.remove();

// 批量插入：用 DocumentFragment 减少重排次数
const frag = document.createDocumentFragment();
data.forEach(d => {
  const row = document.createElement('li');
  row.textContent = d.title;
  frag.append(row);
});
list.append(frag);
```

## 三、事件流与事件委托

事件流三个阶段：**捕获 → 目标 → 冒泡**。

```js
// 事件委托：只给父元素绑一个监听器，处理所有子项
list.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'remove') removeTodo(id);
  if (action === 'toggle') toggleTodo(id);
});
```

事件委托的三个好处：动态新增的元素自动生效、只占一个监听器、逻辑集中。**代价**：需要判断 `event.target` 是否是你关心的元素（`closest` 最好用）。

其他要点：

| 需求 | 写法 |
| --- | --- |
| 阻止默认行为 | `event.preventDefault()` |
| 阻止冒泡 | `event.stopPropagation()`（慎用，会破坏委托） |
| 只触发一次 | `{ once: true }` |
| 参与滚动的监听器 | `{ passive: true }` |
| 移除监听器 | 传入同一个函数引用，否则无效 |

## 四、键盘与无障碍

```js
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog();
  if (e.key === 'Enter' && e.target.matches('input[data-new-todo]')) addTodo(e.target.value);
});
```

- 优先使用原生可聚焦元素（`button`、`input`、`a`），不要用 `div` 加 `tabindex`。
- 状态变化后把焦点移到合理位置（打开弹窗后聚焦第一个可操作元素）。
- 动态区域用 `aria-live` 播报，例如「已添加 1 项任务」。

## 五、浏览器存储

| 方式 | 容量 | 生命周期 | 是否随请求发送 | 适用 |
| --- | --- | --- | --- | --- |
| `localStorage` | ~5MB | 永久，除非手动清除 | 否 | 免登录的偏好设置、草稿 |
| `sessionStorage` | ~5MB | 关闭标签页即失效 | 否 | 单次会话临时数据 |
| `Cookie` | ~4KB | 可设置过期时间 | 是 | 会话标识（应设 `HttpOnly`，见第 08 章） |
| `IndexedDB` | 很大 | 永久 | 否 | 离线数据、大量结构化数据 |

```js
const KEY = 'todo:v1';
const save = (todos) => localStorage.setItem(KEY, JSON.stringify(todos));
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? []; }
  catch { return []; }                     // 数据损坏时不要让应用崩掉
};
```

**安全提醒**：`localStorage` 中的数据可被同源脚本读取，**绝不要存令牌或敏感信息**。

## 六、性能工具

| 工具 | 用途 |
| --- | --- |
| `requestAnimationFrame` | 让视觉更新与帧同步，替代 `setTimeout(…,16)` |
| `IntersectionObserver` | 懒加载图片、曝光统计，替代滚动监听 |
| `ResizeObserver` | 监听元素尺寸变化（响应式组件） |
| Performance 面板 | 看长任务、布局抖动与帧率 |

## 七、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 动态元素点不动 | 监听器绑在了创建时还不存在的元素上 | 用事件委托 |
| 页面插入数据后卡顿 | 逐条 append 触发多次重排 | 用 `DocumentFragment` 批量插入 |
| `innerHTML` 被注入脚本 | XSS 风险 | 用 `textContent` 或转义 |
| 滚动监听导致掉帧 | 高频回调在主线程计算 | 用 `IntersectionObserver` 或加 `passive` |
| 刷新后数据丢失 | 只存在内存里 | 写入 `localStorage` 并处理解析异常 |

## 八、动手练习

1. 用 `DocumentFragment` 一次性插入 1000 条列表，并与逐条插入对比 `performance.now()` 耗时。
2. 用事件委托重写一个列表的删除按钮逻辑。
3. 用 `IntersectionObserver` 实现图片懒加载。
4. 用 `requestAnimationFrame` 写一个进度条动画，并对比 `setInterval` 的平滑度。