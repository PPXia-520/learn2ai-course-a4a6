# 02 · Web 安全与 OWASP Top 10

## 一、威胁模型：先想「谁会怎么攻击我」

| 攻击者 | 动机 | 典型手段 |
| --- | --- | --- |
| 脚本小子 | 炫技、批量扫描 | 撞库、自动化扫描漏洞 |
| 恶意用户 | 越权拿数据、刷接口 | 改 id、重放请求、绕过限流 |
| 内鬼 | 窃取或篡改数据 | 滥用权限、导出数据 |
| 供应链 | 植入后门 | 恶意依赖包、被劫持的构建流程 |

**先问三个问题**：我要保护什么资产？谁能接触它？被攻破的后果是什么？答案决定你投入多少。

## 二、OWASP Top 10（2021）与对应措施

| 风险 | 一句话说明 | 主要防御 |
| --- | --- | --- |
| A01 权限控制失效 | 越权访问他人数据或管理功能 | 服务端逐次校验归属与角色，默认拒绝 |
| A02 加密机制失效 | 明文传输、弱哈希、硬编码密钥 | 全站 HTTPS、bcrypt/argon2、密钥入环境变量 |
| A03 注入 | SQL／命令／模板注入 | 参数化查询、白名单校验、避免拼接 |
| A04 不安全设计 | 设计层面就缺少防滥用 | 限流、业务规则约束、威胁建模 |
| A05 安全配置错误 | 默认口令、开放调试、错误信息过详 | 生产环境最小化配置，关闭调试 |
| A06 易受攻击的组件 | 依赖有已知漏洞 | 定期 `npm audit`，及时升级 |
| A07 身份认证失效 | 弱口令、会话不失效 | 强密码策略、限流、登出即撤销 |
| A08 数据完整性失效 | 反序列化、CI 被篡改 | 校验来源与签名，锁定依赖版本 |
| A09 日志与监控不足 | 被攻击了也不知道 | 记录关键安全事件，设置告警 |
| A10 服务端请求伪造 | 让服务器去访问内网 | 白名单域名、禁止访问内网地址 |

## 三、注入攻击

```ts
// 危险：字符串拼接，`' or 1=1 --` 就能绕过
const q = `select * from users where email = '${email}'`;
db.raw(q);

// 安全：参数化查询（ORM 内部就是这么做的）
const user = await db.query('select * from users where email = $1', [email]);
const user2 = await prisma.user.findUnique({ where: { email } });
```

**防御要点**：
- 一切数据库访问走参数化查询或 ORM，不拼接字符串。
- 动态排序字段不能用用户输入：用白名单映射（`{ createdAt: 'created_at', title: 'title' }`）。
- 命令执行类功能（如调用外部工具）尽量不开放；必须开放时用白名单参数，禁止拼接 shell 命令。

## 四、XSS（跨站脚本）

| 类型 | 注入位置 | 例子 |
| --- | --- | --- |
| 存储型 | 数据被存库，别人查看时执行 | 评论里塞 `<script>` |
| 反射型 | 通过 URL 参数立即回显 | 搜索结果页面 |
| DOM 型 | 前端脚本把不可信数据写入 DOM | `innerHTML = location.hash` |

**防御层次**：
1. **输出转义**：前端用 `textContent`，框架默认转义（React 的 JSX 会自动转义）。
2. **危险 API 慎用**：`dangerouslySetInnerHTML`、`innerHTML` 必须配合净化库（如 DOMPurify）。
3. **CSP 内容安全策略**：通过响应头限制脚本来源，兜底降低危害。

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'
```

4. **Cookie 加 `HttpOnly`**：即便被注入脚本，也读不到会话。

## 五、CSRF（跨站请求伪造）

攻击原理：用户已登录站点 A，访问了恶意站点 B，B 自动向 A 发出带 Cookie 的请求。防御组合拳：

| 措施 | 说明 |
| --- | --- |
| `SameSite=Lax`（或 `Strict`） | 跨站请求默认不带 Cookie |
| CSRF Token | 表单与请求头带一次性令牌，服务端校验 |
| 校验 Origin／Referer | 拒绝来源不明的写操作 |
| 密钥类接口不用 Cookie 鉴权 | 改用 `Authorization` 头（不受 CSRF 影响） |

> 只对「写操作」防护即可；`GET` 应保持幂等且无副作用。

## 六、其他高频风险

| 风险 | 场景 | 防御 |
| --- | --- | --- |
| 敏感信息泄露 | 接口返回了整个用户对象（含密码哈希、身份证） | 显式挑选返回字段（`select`） |
| 越权（IDOR） | `/api/orders/123` 改成别人的 id | 每次校验归属 |
| 大体积请求 | 上传 1GB 的 JSON 打满内存 | 限制请求体大小 |
| 暴力破解 | 无限次尝试登录 | 限流 + 失败锁定 + 验证码 |
| 目录遍历 | 文件名参数传 `../../etc/passwd` | 校验并规范化路径，禁止绝对路径 |
| SSRF | 让服务端请求内网地址 | 域名白名单，禁止内网 IP 段 |
| 依赖漏洞 | 老版本库存在 RCE | 定期审计与升级 |
| 日志注入 | 用户输入带换行伪造日志行 | 结构化日志与字段转义 |

## 七、安全响应头清单

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: geolocation=(), camera=()
Content-Security-Policy: default-src 'self'
```

用 `helmet` 一行接入，再按业务放开必要的来源。

## 八、自查清单（可以直接拿去做报告）

- [ ] 全站 HTTPS，HTTP 自动跳转，HSTS 已启用。
- [ ] 密码用 bcrypt／argon2 存储，cost 参数合理。
- [ ] 登录与敏感写接口有限流与失败锁定。
- [ ] 所有数据库访问参数化，无字符串拼接 SQL。
- [ ] 前端不渲染未净化的 HTML；CSP 已配置。
- [ ] Cookie 带 `HttpOnly`、`Secure`、`SameSite`。
- [ ] 每个资源接口都做归属校验，返回字段显式挑选。
- [ ] 依赖无高危漏洞（`npm audit` 无 high／critical）。
- [ ] 生产环境关闭调试，错误响应不含堆栈与内部路径。
- [ ] 关键安全事件有日志（登录失败、权限拒绝、限流触发）与告警。

## 九、动手练习

1. 在本地故意实现一个字符串拼接的登录查询，用 `' or 1=1 --` 绕过它，再改成参数化查询验证修复。
2. 写一个留言板并在页面上用 `innerHTML` 渲染，注入脚本复现 XSS，再用 `textContent` 修复。
3. 关掉 `SameSite` 复现 CSRF，再开启并加 CSRF Token 修复。
4. 用 `npm audit` 找出一个高危依赖并升级，记录前后版本与影响。