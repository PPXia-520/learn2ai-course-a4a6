# 02 · CI/CD 与部署运维

## 一、流水线的六个阶段

见 `assets/cicd-pipeline.svg`。

| 阶段 | 做什么 | 失败时 |
| --- | --- | --- |
| 校验 | typecheck、lint、格式检查 | 立刻失败，最快反馈 |
| 测试 | 单元 + 集成（必要时 E2E） | 阻止合并 |
| 构建 | 打包产物、构建镜像 | 阻止发布 |
| 发布 | 推镜像到仓库，打版本标签 | 可重试 |
| 部署 | 拉到目标环境并重启 | 自动回滚 |
| 验证 | 健康检查 + 冒烟测试 | 触发回滚 |

**核心原则**：同样的产物走过所有环境（构建一次，多处部署），只有配置不同。

## 二、一个完整的流水线

```yaml
name: ci-cd
on:
  push: { branches: [main] }
  pull_request:

env:
  IMAGE: ghcr.io/${{ github.repository }}

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: app_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test -- --coverage
        env: { DATABASE_URL: postgres://postgres:test@localhost:5432/app_test }
      - run: npm run build
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: reports, path: coverage/ }

  publish:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: |
            ${{ env.IMAGE }}:sha-${{ github.sha }}
            ${{ env.IMAGE }}:latest

  deploy:
    needs: publish
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production        # 可配置人工审批
    steps:
      - name: 触发部署
        run: ./scripts/deploy.sh sha-${{ github.sha }}
```

要点：**用 commit sha 作为镜像标签**，这样回滚就是「部署上一个 sha」。

## 三、环境与密钥管理

| 内容 | 存放 | 绝不能做 |
| --- | --- | --- |
| 非敏感配置 | 环境变量／配置文件（提交 `.env.example`） | — |
| 密钥、数据库密码 | CI 密钥存储／云密钥管理服务 | 写进仓库或镜像 |
| 不同环境的值 | 各环境独立配置 | 生产库连接串出现在本地文件 |

```bash
# 启动时校验必需配置，缺失就快速失败
node -e "['DATABASE_URL','JWT_SECRET'].forEach(k=>{if(!process.env[k]){console.error('缺少配置:'+k);process.exit(1)}})"
```

**密钥泄露的应急流程**：立刻作废并轮换 → 排查使用记录 → 清理 git 历史 → 复盘流入路径。

## 四、部署策略

| 策略 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 重建（Recreate） | 停旧起新 | 简单 | 有停机时间 |
| 滚动（Rolling） | 逐个替换实例 | 不停机 | 新旧版本短时共存 |
| 蓝绿（Blue-Green） | 两套环境切换流量 | 秒级回滚 | 资源占用翻倍 |
| 金丝雀（Canary） | 先给 1%–5% 流量 | 风险最小 | 需要流量治理能力 |

课程阶段推荐：**滚动 + 版本标签**，把回滚做成一条命令：

```bash
./scripts/deploy.sh sha-abc1234        # 部署指定版本
./scripts/deploy.sh sha-prev123        # 回滚同样的命令
```

## 五、上线后的观测

| 观测对象 | 内容 | 工具思路 |
| --- | --- | --- |
| 日志 | 结构化 JSON，含 requestId | 收集到统一平台并可按 id 检索 |
| 指标 | QPS、延迟分位（p50/p95/p99）、错误率、资源占用 | 时序数据库 + 看板 |
| 链路 | 一次请求跨服务的调用路径 | 分布式追踪 |
| 告警 | 错误率、延迟、健康检查失败 | 阈值触发通知 |
| 事故 | 时间线、影响面、根因、改进项 | 事后复盘文档 |

**四个黄金指标**：延迟（Latency）、流量（Traffic）、错误（Errors）、饱和度（Saturation）。

## 六、回滚与演练

1. 每次发布记录版本号与变更内容。
2. 部署后必须做冒烟测试（关键路径能走通）。
3. 出现异常优先回滚，再排查根因——**止血优先于找原因**。
4. 定期演练回滚，确认它真的能在 5 分钟内完成。
5. 数据库迁移要能向前兼容（旧代码能读新结构），否则回滚会失败。

## 七、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 部署成功但页面 404 | SPA 未配置回退到 index.html | 服务端加 history fallback |
| 环境变量未生效 | 构建期与运行期混淆 | 前端变量在构建期注入，服务端变量运行期读取 |
| 回滚后仍然报错 | 数据库结构已变更 | 迁移向前兼容，分两步发布 |
| 新旧版本同时在线出问题 | 会话／缓存格式不兼容 | 缓存键带版本，接口保持兼容 |
| 上线后才发现错误率升高 | 无监控告警 | 先接错误统计与告警再上线 |

## 八、动手练习

1. 为项目写完整流水线，含「构建镜像并推送到仓库」。
2. 用 commit sha 作为镜像标签，演示一次部署与一次回滚。
3. 给应用加 `/health` 与冒烟测试脚本。
4. 配置一个错误率告警（本地可用脚本模拟）。