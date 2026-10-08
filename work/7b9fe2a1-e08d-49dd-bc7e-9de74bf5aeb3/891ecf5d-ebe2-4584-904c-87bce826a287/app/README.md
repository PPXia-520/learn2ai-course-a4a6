# 校园开放日 AI 实践工作坊

本地实现采用 React + Vite、Node.js + TypeScript、Express、PostgreSQL 和 GitHub 同步，不使用 Docker。

## 功能

- 学生测试学号登录、填写报名理由、查询本人状态。
- 同一活动同一学号唯一报名，重复提交不会创建第二条记录。
- 管理员登录、统计申请、筛选列表、通过或驳回。
- PostgreSQL 事务锁保证审核通过人数不超过 100 人。
- HttpOnly Cookie 会话、角色权限、请求 ID、健康检查和审计日志。

## 本地运行

要求：Node.js 20+、npm、PowerShell、PostgreSQL 客户端与服务端程序。

1. 安装依赖：

~~~powershell
npm install
~~~

2. 启动项目自带的本地 PostgreSQL 实例。它使用 .local 目录，不影响系统已有的 PostgreSQL 服务：

~~~powershell
.\scripts\start-local-postgres.ps1
~~~

3. 复制环境变量文件：

~~~powershell
Copy-Item .env.example .env
~~~

4. 在两个终端分别启动 API 和前端：

~~~powershell
npm run dev:server
npm run dev:client
~~~

5. 打开 http://localhost:5173。

## 测试账号

- 学生：20260001、20260002、20260003、20260004、20260005
- 管理员：账号 admin，密码 admin123!

测试账号仅用于课程验收，生产环境必须通过环境变量替换管理员密码和会话密钥。

## 构建和本地生产模式

~~~powershell
npm run typecheck
npm run build
npm start
~~~

构建后由 Node 服务在 3001 端口托管前端和 API。部署到服务器时只需要通过 GitHub 拉取代码、安装 Node 依赖、配置 PostgreSQL 环境变量并运行构建命令；不需要 Docker。

## 主要接口

- GET /api/health
- POST /api/auth/student/login
- POST /api/auth/admin/login
- GET /api/student/application
- POST /api/student/application
- GET /api/admin/dashboard
- GET /api/admin/applications
- POST /api/admin/applications/:id/approve
- POST /api/admin/applications/:id/reject

## 服务器演示

访问地址：http://121.196.165.152:3001 。服务器管理员密码与本地示例不同，详见 docs/deployment.md；验证范围见 docs/test-report.md。
