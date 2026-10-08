# 01 · Docker 与容器化

## 一、四个概念的关系

| 概念 | 含义 | 类比 |
| --- | --- | --- |
| 镜像 Image | 只读的模板，分层存储 | 类 |
| 容器 Container | 镜像的运行实例，有可写层 | 对象 |
| 仓库 Registry | 存放与分发镜像 | 应用商店 |
| 编排 Orchestration | 管理多容器、扩缩与自愈 | 调度中心 |

**容器与虚拟机的区别**：容器共享宿主机内核，只隔离进程、文件系统与网络，因此更轻、启动更快；代价是隔离强度低于虚拟机。

## 二、Dockerfile：一条高效的多阶段写法

```dockerfile
# ---------- 依赖层：只在依赖变化时重建 ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- 构建层：需要全部依赖 ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- 运行层：只带必要产物 ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
```

**六条优化原则**：

| 原则 | 效果 |
| --- | --- |
| 多阶段构建 | 最终镜像不含构建工具与 devDependencies |
| 先拷依赖清单再拷源码 | 改代码不必重装依赖，充分利用缓存 |
| 固定基础镜像版本（含变体） | 构建可复现，避免「今天构建就坏了」 |
| 用 `npm ci` 而非 `npm install` | 严格按锁文件，结果一致 |
| 非 root 用户运行 | 降低容器逃逸后的危害 |
| 加 `.dockerignore` | 减少上下文体积，避免把 `.env`、`node_modules` 打进去 |

```text
# .dockerignore
node_modules
dist
.git
.env*
coverage
*.log
```

## 三、常用命令

```bash
docker build -t myapp:1.0.0 .
docker run --rm -p 3000:3000 --env-file .env myapp:1.0.0
docker ps                                  # 运行中的容器
docker logs -f <容器>                       # 跟踪日志
docker exec -it <容器> sh                   # 进容器排查
docker stats                               # 资源占用

docker image prune -a                      # 清理无用镜像
docker system df                           # 看磁盘占用构成
```

## 四、Compose：本地全套依赖

```yaml
services:
  app:
    build: .
    ports: [3000:3000]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://app:app_dev_only@db:5432/app_dev
      REDIS_URL: redis://cache:6379
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app_dev_only
      POSTGRES_DB: app_dev
    volumes: [db-data:/var/lib/postgresql/data]
    healthcheck:
      test: [CMD-SHELL, pg_isready -U app]
      interval: 5s
      retries: 10

  cache:
    image: redis:7
    command: [redis-server, --appendonly, 'yes']
    volumes: [cache-data:/data]

volumes:
  db-data:
  cache-data:
```

```bash
docker compose up -d --build      # 起全套
docker compose ps                 # 看状态
docker compose logs -f app        # 跟踪应用日志
docker compose down               # 停止（保留数据卷）
docker compose down -v            # 连数据一起删（谨慎）
```

**两点提醒**：容器之间用**服务名**互联（`db:5432`，不是 `localhost`）；数据必须放命名卷，否则容器重建即丢数据。

## 五、持久化与网络

| 类型 | 生命周期 | 用途 |
| --- | --- | --- |
| 命名卷（volume） | 由 Docker 管理，删除需显式操作 | 数据库数据、上传文件 |
| 绑定挂载（bind mount） | 直接映射宿主机目录 | 本地开发热重载 |
| 临时文件系统（tmpfs） | 容器停止即消失 | 缓存、敏感临时数据 |

## 六、安全与体积

| 检查项 | 做法 |
| --- | --- |
| 镜像里没有密钥 | 密钥只通过环境变量或密钥管理服务注入 |
| 最小权限运行 | 非 root 用户、只读根文件系统（可行时） |
| 基础镜像可信 | 用官方镜像并固定版本，定期更新 |
| 漏洞扫描 | `docker scout cves` 或 CI 中集成扫描 |
| 体积可控 | 用 alpine／slim 变体，清理包管理器缓存 |

## 七、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 容器起不来，日志说连不上数据库 | 用了 `localhost` | 改用服务名 |
| 改代码后镜像没变化 | 层缓存命中 | 调整 COPY 顺序，或加 `--no-cache` |
| 镜像 1GB 以上 | 单阶段 + 把 `node_modules` 全打进去 | 多阶段构建 |
| 重启后数据丢失 | 未挂卷 | 挂命名卷 |
| 本地能跑，容器里报缺文件 | `.dockerignore` 排除了必需文件，或大小写不一致 | 检查忽略规则与文件名 |
| 时间/时区不对 | 容器默认 UTC | 显式设置 `TZ` |

## 八、动手练习

1. 给项目写多阶段 Dockerfile，记录优化前后的镜像体积。
2. 加 `.dockerignore`，对比构建上下文大小。
3. 用 Compose 起应用 + PostgreSQL + Redis，验证数据在重启后仍在。
4. 用 `docker scout` 或同类工具扫一次镜像，记录发现与处理。