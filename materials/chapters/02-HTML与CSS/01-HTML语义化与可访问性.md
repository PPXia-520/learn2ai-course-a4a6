# 01 · HTML 语义化与可访问性

## 一、HTML 管结构，CSS 管外观

HTML 的职责是**描述内容是什么**，而不是看起来怎样。用 `<h1>` 表示「这是页面主标题」而不是「这行要大字」；用 `<button>` 表示「这是可点击的操作」而不是给 `div` 加圆角。这样浏览器、搜索引擎、读屏软件才能正确理解你的页面。

## 二、最小文档骨架

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>张三 · 前端开发工程师</title>
  <meta name="description" content="一句话说清这个页面是干什么的" />
</head>
<body>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header>
    <nav aria-label="主导航">
      <ul>
        <li><a href="#about">关于我</a></li>
        <li><a href="#projects">项目</a></li>
      </ul>
    </nav>
  </header>
  <main id="main">
    <h1>张三</h1>
    <section id="about" aria-labelledby="about-title">
      <h2 id="about-title">关于我</h2>
      <p>这里是正文段落。</p>
    </section>
  </main>
  <footer><p>© 2026 张三</p></footer>
</body>
</html>
```

必记三点：`charset` 必须在最前面、`viewport` 不加则移动端会缩放错乱、`lang` 影响读屏发音与断词。

## 三、语义标签对照

| 场景 | 该用 | 不要用 |
| --- | --- | --- |
| 页面头部／底部 | `header` / `footer` | `div class=top` |
| 主导航 | `nav` | `div class=menu` |
| 主体内容 | `main`（每页仅一个） | `div id=content` |
| 独立可复用的内容块 | `article` | `div class=post` |
| 带标题的主题分组 | `section` + 标题 | `div` + 伪标题 |
| 与主题相关的补充内容 | `aside` | `div class=sidebar` |
| 可点击操作 | `button` | 绑了 click 的 `div` |
| 图片配文字说明 | `figure` + `figcaption` | `img` + 相邻 `p` |
| 强调重要性 | `strong` / `em` | 用粗体代替语义 |

**判断口诀**：能用原生元素表达行为，就别用 `div` 加事件。原生元素自带键盘支持、焦点管理与辅助技术支持。

## 四、表单：可访问性重灾区

```html
<form novalidate>
  <fieldset>
    <legend>联系方式</legend>

    <label for="email">邮箱（必填）</label>
    <input id="email" name="email" type="email"
           autocomplete="email" required aria-describedby="email-hint" />
    <p id="email-hint">用于接收登录通知，不会公开。</p>

    <label for="topic">咨询主题</label>
    <select id="topic" name="topic">
      <option value="">请选择</option>
      <option value="job">求职</option>
      <option value="collab">合作</option>
    </select>

    <button type="submit">提交</button>
  </fieldset>
</form>
```

要点：
- `label` 的 `for` 必须与 `input` 的 `id` 一致；点文字能聚焦输入框是最基本的体验。
- 用正确的 `type`（`email`/`tel`/`number`/`date`）让移动端弹出合适的键盘。
- 必填与说明用 `required` 与 `aria-describedby` 表达，不要只在视觉上写个星号。
- 校验失败的错误信息要能被读屏读到，推荐把错误文案与输入框用 `aria-describedby` 关联。

## 五、可访问性（a11y）检查清单

| 检查项 | 做法 |
| --- | --- |
| 图片有替代文本 | 有意义用 `alt=描述`；纯装饰用 `alt=""` |
| 键盘可用 | 所有交互元素可 Tab 到达，Enter/Space 能触发，有可见 `:focus-visible` 样式 |
| 标题层级正确 | 只一个 `h1`，不跳级（h2 之后才 h3） |
| 颜色不是唯一信息 | 错误状态除红色外还有图标或文字 |
| 对比度达标 | 正文 ≥ 4.5:1，大号文字 ≥ 3:1 |
| 有跳过导航链接 | 页首放 skip link，减少键盘用户重复操作 |
| 语义正确 | 用 `nav`/`main`/`button` 而非 `div` 拼装 |

自查工具：浏览器 Lighthouse 的 Accessibility 面板、axe DevTools 插件、以及**只用键盘**完整走一遍页面。

## 六、SEO 基础（做对结构就自然拿到大半）

1. 每页唯一的 `<title>`，格式建议「页面主题 · 站点名」。
2. `<meta name=description>` 写 60–120 字，直接影响搜索结果摘要。
3. 用语义标签与正确的标题层级，爬虫据此判断内容重点。
4. 链接文字要有意义：写「查看项目详情」而不是「点击这里」。
5. 图片 `alt` 也是 SEO 素材，但不要堆砌关键词。

## 七、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 中文乱码 | 缺 `charset` 或不在前 1024 字节内 | 把 `<meta charset>` 放 head 第一行 |
| 移动端页面被缩小 | 少了 viewport meta | 加上 `width=device-width, initial-scale=1` |
| `div` 点击在手机上不灵 | 未处理触摸与键盘 | 换成 `button` |
| 表单提交后页面刷新丢失状态 | 默认提交行为 | 用 JS 阻止默认行为或让后端返回结果 |
| 读屏读不出图标按钮 | 只有图标没有文本 | 加 `aria-label` 或视觉隐藏的文本 |

## 八、动手练习

1. 把个人主页的结构改为全语义标签，并列出你替换掉的 `div` 及理由。
2. 只用键盘走完页面：记下每一个无法到达或没有焦点提示的元素并修复。
3. 给表单加上错误提示与 `aria-describedby` 关联。
4. 用 Lighthouse 跑一次，把 Accessibility 分数与未通过项记到笔记里。

## 小结

- HTML 描述含义，CSS 描述外观；混用是绝大多数前端坏味道的起点。
- 原生元素自带无障碍与键盘支持，优先用它。
- 可访问性不是额外工作，而是正确使用 HTML 的自然结果。