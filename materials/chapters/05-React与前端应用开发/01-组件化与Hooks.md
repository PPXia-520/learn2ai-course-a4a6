# 01 · 组件化与 Hooks

## 一、声明式渲染：思维方式的转变

命令式是「一步步告诉浏览器怎么改」；声明式是「描述界面与状态的关系」，由框架算出最小更新。

```jsx
// 声明式：UI = f(state)
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      点击了 {count} 次
    </button>
  );
}
```

React 的工作流程：状态变化 → 重新执行组件函数得到新的元素树 → 与上一次对比（协调／Diff）→ 只把差异应用到真实 DOM。

## 二、props 与 state

| 概念 | 来源 | 可变性 | 用途 |
| --- | --- | --- | --- |
| props | 父组件传入 | 只读 | 配置与数据输入 |
| state | 组件内部 | 用 setter 更新 | 会随时间变化的数据 |
| 派生值 | 由上面两者计算 | 不单独存 | 过滤列表、合计金额 |

**最常见的反模式**：把派生值也存成 state，然后手动同步。

```jsx
// 坏：两个状态可能不同步
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);

// 好：直接派生
const count = items.length;
```

## 三、核心 Hooks

### useState：状态更新是替换而非合并

```jsx
const [user, setUser] = useState({ name: '张三', age: 20 });
setUser({ ...user, age: 21 });              // 必须展开旧值
setCount(c => c + 1);                       // 新值依赖旧值时用函数式更新
```

### useEffect：与外部系统同步

```jsx
useEffect(() => {
  const controller = new AbortController();
  let alive = true;

  async function load() {
    try {
      const res = await fetch(`/api/users/${userId}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (alive) setUser(data);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err);
    }
  }
  load();

  return () => { alive = false; controller.abort(); };   // 清理：取消请求
}, [userId]);                                            // 依赖：userId 变化时重跑
```

`useEffect` 三条纪律：

| 纪律 | 说明 |
| --- | --- |
| 依赖数组要完整 | 用到的每个响应式值都应列入，漏掉会产生「读到旧值」的 bug |
| 必须有清理函数 | 请求、定时器、订阅、事件监听都要清理，否则内存泄漏与状态错乱 |
| 不是万能的 | 能用事件处理完成的就不要用 effect；能派生计算的就不要用 effect 存状态 |

### useRef：不触发渲染的可变容器与 DOM 引用

```jsx
const inputRef = useRef(null);
const timerRef = useRef(null);

useEffect(() => {
  inputRef.current?.focus();
  return () => clearInterval(timerRef.current);
}, []);
```

### useReducer：状态逻辑复杂时集中管理

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'add':    return { ...state, items: [...state.items, action.item] };
    case 'remove': return { ...state, items: state.items.filter(i => i.id !== action.id) };
    default:       return state;
  }
}
const [state, dispatch] = useReducer(reducer, { items: [] });
```

### useMemo / useCallback：只在测出问题时用

| Hook | 作用 | 何时用 |
| --- | --- | --- |
| `useMemo` | 缓存计算结果 | 计算确实昂贵，或作为依赖数组中的稳定引用 |
| `useCallback` | 缓存函数引用 | 传给 `memo` 子组件，或作为 effect 依赖 |

**先测量再优化**：多数组件不需要 memo。过早包裹只会增加心智负担与内存开销。

## 四、自定义 Hook：逻辑复用的正确方式

```jsx
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial; }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}
```

判断该不该抽 Hook：**两个以上组件需要同一段「状态 + 副作用」逻辑**时再抽。

## 五、列表渲染与 key

```jsx
<ul>
  {todos.map(todo => (
    <li key={todo.id}>{todo.title}</li>   // 必须是稳定且唯一的业务 id
  ))}
</ul>
```

**不要用数组下标当 key**：删除或排序时下标会变，React 会错误复用 DOM，导致输入框内容串位、动画错乱。

## 六、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 改了状态界面不更新 | 直接改了原对象／数组 | 用展开或 `map`／`filter` 生成新引用 |
| 效果无限循环 | effect 里更新了依赖数组中的状态 | 检查依赖，必要时用函数式更新或拆分 effect |
| 请求回来数据错乱 | 快速切换页面时旧请求后返回 | 用 `AbortController` 或挂载标记 |
| 输入框每次输入都卡 | 每次渲染都新建大对象/函数且传给 memo 子组件 | 用 `useMemo`／`useCallback` 稳定引用 |
| 组件卸载后报错 | 异步回调仍在执行 | 清理函数里取消 |
| 状态更新后立即读取拿到旧值 | 状态更新是异步批处理的 | 用函数式更新，或在 effect 中读取 |

## 七、动手练习

1. 把第 03 章的待办应用用 React 重写，体会两者代码量的差异。
2. 封装 `useDebouncedValue` 与 `useLocalStorage` 并在两处复用。
3. 用 `useReducer` 重写待办的状态逻辑，对比 `useState` 版本的可读性。
4. 故意用数组下标作 key，复现「删除后输入框串位」的 bug，再修复。