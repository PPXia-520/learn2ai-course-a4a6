# 01 · Node 运行时与服务端基础

## 一、Node 与浏览器的差异

| 维度 | 浏览器 | Node.js |
| --- | --- | --- |
| 全局对象 | `window`、`document` | `global`、`process` |
| 主要能力 | DOM、Web API | 文件、网络、进程 |
| 模块系统 | ESM | ESM 与 CJS 都支持 |
| 安全边界 | 沙箱，无文件访问 | 直接访问文件系统与网络 |
| 版本升级 | 用户浏览器决定 | 你决定，但要不破坏他人依赖 |

## 二、事件循环在服务端的表现

Node 把耗时操作（文件、网络、DNS）交给 libuv 的线程池或系统异步接口，主线程继续处理其他请求。这就是「单线程也能扛并发」的原因——**前提是你不写阻塞主线程的代码**。

```js
// 阻塞：同步读取大文件会卡住所有请求
const big = fs.readFileSync('huge.csv');

// 非阻塞：交给线程池，主线程继续服务其他请求
const big = await fs.promises.readFile('huge.csv');

// CPU 密集任务（哈希、压缩、复杂计算）应放进工作线程
import { Worker } from 'node:worker_threads';
```

**判断标准**：一段代码如果长时间占着主线程不放（超过几十毫秒），就是服务端性能事故。

## 三、模块系统与路径

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'config', 'default.json');
```

| 写法 | 含义 |
| --- | --- |
| `node:fs` | 内置模块加 `node:` 前缀，避免与第三方包同名冲突 |
| `./service.js` | 相对路径必须写扩展名（ESM 要求） |
| `#internal/*` | 用 `imports` 字段定义的私有别名 |

## 四、环境变量与配置

```js
const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requireEnv('DATABASE_URL'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  isProd: process.env.NODE_ENV === 'production',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少必需的环境变量：${name}`);
  return value;
}
```

**纪律**：配置从环境变量读，密钥不进仓库；启动时**一次性校验**必需变量并快速失败，不要等到第一个请求才发现连不上数据库。

## 五、文件与流

```js
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

// 流式压缩大文件：内存占用恒定，不随文件变大
await pipeline(
  createReadStream('access.log'),
  createGzip(),
  createWriteStream('access.log.gz'),
);
```

| 场景 | 选择 |
| --- | --- |
| 小文件、配置文件 | `readFile` |
| 大文件、日志、上传下载 | 流（`createReadStream`） |
| 需要随机读写 | `fs.open` + `read`／`write` |

## 六、错误处理模型

```js
// 业务错误用自定义类表达，便于统一映射成 HTTP 状态码
export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;          // 可预期的错误
  }
}

export const notFound = (what) => new AppError(`${what} 不存在`, 404, 'NOT_FOUND');
export const conflict = (what) => new AppError(`${what} 已存在`, 409, 'CONFLICT');
```

**两类错误**：可预期的业务错误（返回给用户，带明确信息）与不可预期的程序错误（记日志、返回 500、不暴露堆栈）。

## 七、进程与优雅关闭

```js
const server = app.listen(config.port);

async function shutdown(signal) {
  logger.info({ signal }, '开始优雅关闭');
  server.close(async () => {             // 不再接收新连接
    await db.destroy();                  // 关闭连接池
    logger.info('已关闭，进程退出');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();   // 兜底超时
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, '未处理的 Promise 拒绝');
  process.exit(1);
});
```

## 八、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 服务偶发卡死 | 主线程被同步代码阻塞 | 找 `*Sync` 调用与大循环，改异步或工作线程 |
| 进程崩溃后无人拉起 | 无进程管理 | 用容器编排或进程守护并配健康检查 |
| 内存持续上涨 | 全局缓存无上限、监听器未移除 | 给缓存设上限，检查监听器数量 |
| 关闭时请求被截断 | 未等待在途请求 | 优雅关闭 + 超时兜底 |
| 生产环境输出了堆栈 | 错误处理未区分环境 | 只在非生产环境返回详细错误 |

## 九、动手练习

1. 写一个脚本，用 `process.argv` 接收参数并输出统计结果。
2. 用流复制一个 100MB 文件，与 `readFile` 对比内存占用。
3. 实现一个带超时与重试的 `fetchJson` 工具函数。
4. 给一个 Express 应用加上优雅关闭，并用 `Ctrl+C` 验证日志顺序。