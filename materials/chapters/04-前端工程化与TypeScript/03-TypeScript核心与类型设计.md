# 03 · TypeScript 核心与类型设计

## 一、TypeScript 解决了什么

JavaScript 的类型错误只在运行时暴露，且往往出现在用户那里。TypeScript 在编译期做静态检查，把「发现错误」提前到写代码的当下，同时让编辑器能提供准确的补全与重构。

**心智模型**：TS 类型是给编译器和同事看的注释，编译后全部消失，运行时行为仍由 JS 决定——所以运行时校验（接口入参、表单输入）依然必要。

## 二、基础类型与对象类型

```ts
type UserId = string;                 // 类型别名：让语义更清楚
type Role = 'admin' | 'editor' | 'viewer';   // 字面量联合，穷尽性最好

interface User {
  id: UserId;
  name: string;
  role: Role;
  email?: string;                     // 可选属性
  readonly createdAt: Date;           // 只读属性
}

const u: User = { id: 'u1', name: '张三', role: 'admin', createdAt: new Date() };
```

| 概念 | 含义 | 建议 |
| --- | --- | --- |
| `interface` | 描述对象形状，可被继承与合并 | 描述对象、公开 API |
| `type` | 任意类型别名，可组合 | 联合、交叉、映射类型 |
| `unknown` | 未知类型，用前必须收窄 | 替代 `any` |
| `never` | 不可能存在的值 | 穷尽检查 |
| `void` | 无返回值 | 函数返回 |

## 三、联合类型与收窄

```ts
type Result<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string; code: number };

function handle<T>(res: Result<T>): string {
  switch (res.status) {
    case 'ok':    return `成功：${JSON.stringify(res.data)}`;
    case 'error': return `失败(${res.code})：${res.message}`;
  }
}   // 不需要 default：所有分支覆盖后 TS 自动确认返回完整
```

常用收窄手段：`typeof`、`instanceof`、`in`、判别属性（如上例的 `status`）、自定义类型守卫：

```ts
const isUser = (v: unknown): v is User =>
  typeof v === 'object' && v !== null && 'id' in v && 'role' in v;
```

## 四、泛型：让类型随输入变化

```ts
function first<T>(list: readonly T[]): T | undefined {
  return list[0];
}

function groupBy<T, K extends string>(list: readonly T[], keyOf: (item: T) => K) {
  const out = {} as Record<K, T[]>;
  for (const item of list) {
    const key = keyOf(item);
    (out[key] ??= []).push(item);
  }
  return out;
}

const byRole = groupBy(users, u => u.role);   // Record<Role, User[]>
```

**约束泛型**：`<T extends { id: string }>` 表示只要满足这个形状的类型都能传，同时函数体里可以安全访问 `id`。

## 五、常用工具类型

| 工具类型 | 作用 | 例子 |
| --- | --- | --- |
| `Partial<T>` | 全部变可选 | 更新入参 |
| `Required<T>` | 全部变必需 | 校验后的配置 |
| `Pick<T, K>` | 挑选字段 | 列表项只取部分字段 |
| `Omit<T, K>` | 排除字段 | 排除密码字段后返回给前端 |
| `Record<K, V>` | 键值映射 | 权限表 |
| `Readonly<T>` | 全部只读 | 不可变状态 |
| `ReturnType<F>` | 函数返回值类型 | 复用已有实现的类型 |
| `Awaited<P>` | 解开 Promise | 异步返回类型 |

```ts
type PublicUser = Omit<User, 'createdAt'>;
type UserPatch = Partial<Pick<User, 'name' | 'email'>>;
```

## 六、类型设计原则

1. **让非法状态无法表示**：用判别联合代替「一堆可选字段 + 布尔开关」。
2. **在边界处收窄**：外部输入（接口、localStorage、`JSON.parse`）一律按 `unknown` 处理并校验。
3. **不要导出多余类型**：只暴露调用方需要的形状，内部实现细节用 `Omit` 屏蔽。
4. **避免 `any`**：确需逃逸时用 `unknown` 加断言，并写明原因。
5. **类型即文档**：`type OrderStatus = 'pending' | 'paid' | 'shipped' | 'closed'` 比注释更可靠。

## 七、tsconfig 关键项

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./src/*"] },
    "noEmit": true
  },
  "include": ["src"]
}
```

`strict: true` 是底线；`noUncheckedIndexedAccess` 能治好「数组越界访问」这类隐蔽 bug。

## 八、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 到处写 `as` 才过编译 | 类型设计不合理 | 回到数据形状，用判别联合重做 |
| 类型是 `any` 却查不出来 | 隐式 any 与第三方包缺失类型 | 开启 `strict`、安装 `@types/*` 或写 `.d.ts` |
| 运行时数据与类型不符 | 类型只在编译期 | 在边界用 zod 等做运行时校验 |
| 枚举写起来啰嗦 | 用了 TS `enum` | 优先用字面量联合，产物更小 |
| 改一个类型，全项目飘红 | 类型耦合过深 | 让组件只依赖需要的字段（`Pick`） |

## 九、动手练习

1. 用判别联合描述「订单状态」，写一个函数覆盖全部状态并保证漏掉分支会编译报错。
2. 用泛型实现 `pluck`、`groupBy`、`uniqueBy` 并保证返回值类型准确。
3. 把 `JSON.parse` 的结果用类型守卫收窄成 `User`。
4. 用工具类型派生出 `PublicUser`、`UserPatch`、`UserList` 三个类型。
5. 为项目开启 `noUncheckedIndexedAccess`，修复由此暴露的全部问题。