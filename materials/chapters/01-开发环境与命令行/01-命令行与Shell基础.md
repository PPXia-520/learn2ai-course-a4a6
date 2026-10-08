# 01 · 命令行与 Shell 基础

## 一、为什么全栈工程师必须会命令行

图形界面能做的事，命令行都能做；命令行能做的事，图形界面往往做不了。真实开发中的这些场景几乎没有图形替代：

- 启动开发服务器、跑测试、跑构建脚本；
- 用 Git 管理版本、处理冲突、查看历史；
- 连数据库、连服务器、看日志；
- 用 Docker 管理容器与镜像；
- 出问题时排查端口占用、进程、网络与文件权限。

## 二、四个容易混淆的概念

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| 终端（Terminal） | 你看到的那个窗口，负责输入输出 | Windows Terminal、iTerm2 |
| Shell | 解释你输入命令的程序 | PowerShell、bash、zsh |
| 命令（Command） | 一个可执行程序或 Shell 内置功能 | `git`、`node`、`Get-ChildItem` |
| PATH | 存着「去哪找命令」的目录列表 | `$env:Path` |

**「命令找不到」的通用排查顺序**：程序真的装了吗 → 装在哪 → 那个目录在 PATH 里吗 → 是不是需要重开终端 → 是不是版本管理器（nvm/volta）没初始化。

## 三、必备命令速查（PowerShell 为主）

### 1. 目录与文件

| 目的 | PowerShell | bash 对照 |
| --- | --- | --- |
| 当前路径 | `Get-Location` / `pwd` | `pwd` |
| 列出文件（含隐藏） | `Get-ChildItem -Force` / `ls` | `ls -la` |
| 切换目录 | `Set-Location 路径` / `cd 路径` | `cd` |
| 回到上一级 | `cd ..` | `cd ..` |
| 新建目录 | `New-Item -ItemType Directory 名字` | `mkdir` |
| 复制／移动／改名 | `Copy-Item` / `Move-Item` | `cp` / `mv` |
| 删除文件 | `Remove-Item 文件` | `rm` |
| 查看文件内容 | `Get-Content 文件` | `cat` |
| 新建空文件 | `New-Item -ItemType File 名字` | `touch` |
| 递归查找文件名 | `Get-ChildItem -Recurse -Filter *.ts` | `find . -name '*.ts'` |

> 含空格的路径一定加引号，PowerShell 用单引号更省心：`Set-Location 'C:\My Projects\demo'`。

### 2. 文本搜索与管道

```powershell
# 在项目里搜代码（推荐用 rg，见第 03 章工具清单）
rg 'TODO' --glob '*.ts'

# 没有 rg 时的替代
Get-ChildItem -Recurse -Filter *.md | Select-String -Pattern '待办'

# 管道：把上一步的输出交给下一步处理
Get-ChildItem | Where-Object { $_.Length -gt 1MB } | Sort-Object Length -Descending | Select-Object -First 5
```

**管道的意义**：每个命令只做一件小事，用 `|` 串起来完成复杂任务。这是命令行的核心思维，也是函数式风格的早期实践。

### 3. 重定向与退出码

```powershell
node build.js > build.log      # 标准输出写入文件（覆盖）
node build.js >> build.log     # 追加
node build.js 2> error.log     # 标准错误单独写文件
Get-Content build.log | Select-Object -Last 20
```

- 每个命令执行完都有**退出码**：`0` 表示成功，非 0 表示失败。CI 流水线就是靠它判断成败。
- PowerShell 中查看上一条命令的状态：`$LASTEXITCODE`（外部程序）或 `$?`（True/False）。

### 4. 环境变量

```powershell
$env:Path                                  # 查看 PATH
$env:NODE_ENV = 'development'              # 仅当前会话生效（推荐做法）
Get-ChildItem env: | Where-Object { $_.Name -like 'npm*' }
```

**规则**：临时配置用会话变量；长期配置写进系统设置或配置文件；**绝不**把密钥、密码硬编码进代码仓库（对应第 08 章安全）。

### 5. 进程、端口与网络

| 目的 | 命令 |
| --- | --- |
| 查看端口占用 | `Get-NetTCPConnection -LocalPort 3000` |
| 查看进程 | `Get-Process node` |
| 结束进程 | `Stop-Process -Id 12345` |
| 测试接口 | `curl.exe -sS http://localhost:3000/health` |
| 查看响应头 | `curl.exe -sS -I https://example.com` |
| 解析域名 | `Resolve-DnsName example.com` |

> **端口被占用的标准处理流程**：找到占用进程 → 确认是不是自己的服务 → 是就用 `Stop-Process` 结束，不是就换端口（如 3001）。

## 四、包管理器与软件安装

| 用途 | Windows 命令 | 说明 |
| --- | --- | --- |
| 系统级软件 | `winget install Git.Git` | Windows 自带，推荐 |
| 替代方案 | `scoop install nodejs` / `choco install nodejs` | 需先安装对应工具 |
| 项目级依赖 | `npm install` / `pnpm add axios` | 依赖记录在 `package.json` |
| 全局 CLI 工具 | `npm install -g typescript` | 谨慎使用，优先用 `npx` |

```powershell
npx tsc --version        # 不全局安装也能用，推荐
npm ls -g --depth=0      # 看看全局装了哪些东西
```

## 五、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `node: command not found` | PATH 没有 Node 目录 | 重开终端；确认 nvm/volta 已初始化 |
| 脚本无法执行（PowerShell） | 执行策略限制 | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| 中文输出乱码 | 终端编码不是 UTF-8 | 设置 `$OutputEncoding` 与终端为 UTF-8 |
| `rm -rf` 类命令误操作 | Unix 习惯直接套用 | PowerShell 用 `Remove-Item -Recurse`，并先 `ls` 确认路径 |
| 路径含空格报错 | 未加引号 | 用单引号包裹整个路径 |
| 改了环境变量不生效 | 只改了当前会话 | 新开终端，或改系统环境变量后重启终端 |

## 六、动手练习

在 `work/<你的用户UUID>/<作业UUID>/` 下建一个 `shell-practice/` 目录，完成：

1. 用命令行创建 `src/`、`docs/` 两个目录和 `README.md` 文件。
2. 用一行管道命令，找出当前目录下所有 `.md` 文件并按修改时间倒序排列。
3. 把一条命令的输出同时写入文件并显示在屏幕上（提示：`Tee-Object`）。
4. 故意制造一次「端口被占用」，找到占用进程并结束它。
5. 把上述 4 步的实际命令与输出整理成 `shell-practice/commands.md`。

## 小结

- 终端是窗口，Shell 是解释器，命令是程序，PATH 决定去哪找程序。
- 管道与重定向是命令行的核心思维；退出码是自动化判断成败的依据。
- 「命令找不到」「端口被占用」「路径有空格」三大高频问题的排查路径要背熟。
