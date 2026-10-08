# 服务器部署

部署日期：2026-10-08。

- 访问地址：http://121.196.165.152:3001
- HTTP 端口：3001；数据库仅监听服务器本机 5432。
- Ubuntu 22.04，Node.js 24.15.0，已有 PostgreSQL。
- 应用目录：`/home/pp/campus-open-day`。
- systemd 服务：`campus-open-day`，已启用开机自启和异常退出重启。
- 独立数据库和数据库角色均为 `campus_open_day`。
- 原有 80 端口网站及其他应用继续使用原有配置。

## 登录

学生测试学号：20260001 至 20260005，无需密码。

管理员账号：admin。服务器管理员密码单独随机生成，不能使用页面预填的本地示例密码。部署者本机的 `app/.local/server-access.txt` 保存访问凭据，该文件被 Git 忽略；不要将密码提交到仓库。服务器 `.env` 权限为 600。

## 运行配置

生产环境设置 `NODE_ENV=production` 和随机 `SESSION_SECRET`。当前按课程 IP + HTTP 方式访问，明确设置 `COOKIE_SECURE=false`，保留 HttpOnly 和 SameSite=Lax。以后配置 HTTPS 时改为 `COOKIE_SECURE=true` 并重启服务。

数据库连接地址、管理员密码和会话密钥仅保存在服务器 `.env`。数据库角色不需要超级用户权限。迁移和默认测试身份在启动时初始化；启动时会按环境配置更新活动、管理员和测试身份。

## 运维

```bash
sudo systemctl status campus-open-day
sudo systemctl restart campus-open-day
sudo systemctl stop campus-open-day
sudo journalctl -u campus-open-day -n 100 --no-pager
curl -f http://127.0.0.1:3001/api/health
```

构建在开发机执行 `npm ci && npm run typecheck && npm run build`，然后上传 `package.json`、`package-lock.json`、`server/package.json`、`server/dist/`、`server/public/` 和 `server/migrations/`。服务器执行 `npm ci --omit=dev`，保留现有 `.env`，再重启服务并检查健康接口。Node 路径固定为 `/home/pp/.nvm/versions/node/v24.15.0/bin/node`，升级 Node 时需同步修改 systemd 的 ExecStart。

## 备份与恢复

`/usr/local/bin/campus-open-day-backup` 对应仓库的 `scripts/backup-server.sh`，由 postgres 用户每日 03:15 执行。备份位于 `/var/backups/campus-open-day/`，每日备份保留约 7 天。部署时另保留 `initial.dump`。这是同机备份，尚未配置异地备份。

```bash
sudo -u postgres /usr/local/bin/campus-open-day-backup
sudo -u postgres pg_restore --list /var/backups/campus-open-day/initial.dump
```

恢复时先停止应用，并额外备份当前数据；建议将选定 dump 恢复到新数据库核验，确认后再切换 `.env` 的数据库地址并启动服务。不要直接覆盖仍在使用的数据库。应用回滚时恢复上一版构建产物；本次为首次部署，尚无上一版服务器发布包。

## 验收范围

本次公网接口测试记录见 `test-report.md`。这是课程演示部署，尚未完成完整产品需求验收，分页、登录限流等仍待完善。服务器约 1.6 GiB 内存，当前可运行；未进行峰值容量压测。
