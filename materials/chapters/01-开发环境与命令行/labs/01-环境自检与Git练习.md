# Lab 01 · 环境自检与 Git 协作演练

## 目标

把本章的知识变成肌肉记忆：环境能自证可用，Git 的四种高频动作（提交、分支、冲突、回滚）各亲手做一次。

## 前置

- 已完成《03-本地开发环境搭建清单.md》中的工具安装。
- 已读完《02-Git与GitHub协作.md》。

## 任务一 · 环境自检（产出 `env-report.md`）

1. 逐个执行并记录输出：`node -v`、`pnpm -v`、`git --version`、`code --version`、`docker version`、`docker compose version`。
2. 用第三节 Docker Compose 起本地 PostgreSQL 与 Redis，执行 `docker compose ps` 确认两个容器都是 `Up`。
3. 执行 `docker exec -it local-db psql -U app -d app_dev -c 'select version();'`，把版本字符串记下来。
4. 制造并修复一个真实故障：用 `node -e 'setTimeout(()=>{},60000)'` 占住一个进程，然后找出它并结束。
5. 把以上所有命令、实际输出与故障处理过程写进 `env-report.md`。

## 任务二 · 三次规范提交

```powershell
New-Item -ItemType Directory git-practice
Set-Location git-practice
git init
'# Git 练习' | Out-File -Encoding utf8 README.md
git add README.md
git commit -m 'docs: 初始化练习仓库说明'
```

再完成两次提交，要求分别体现：新增一个功能文件（`feat:`）、修复该文件里的一处缺陷（`fix:`）。

**验收**：`git log --oneline` 输出的每行都能让人看懂做了什么。

## 任务三 · 分支协作与冲突解决（本章重点）

### 3.1 无冲突合并

```powershell
git switch -c feat/add-greeting
'console.log(1)' | Out-File -Encoding utf8 greet.js
git add greet.js
git commit -m 'feat: 新增问候脚本'
git switch main
git merge feat/add-greeting
git log --oneline --graph
```

### 3.2 故意制造冲突并解决

```powershell
git switch -c feat/timeout-a
'const timeout = 3000;' | Out-File -Encoding utf8 config.js
git add config.js
git commit -m 'feat: 超时改为 3 秒'

git switch main
'const timeout = 5000;' | Out-File -Encoding utf8 config.js
git add config.js
git commit -m 'feat: 超时改为 5 秒'

git merge feat/timeout-a        # 这里应当产生冲突
Get-Content config.js           # 观察冲突标记
```

解决要求：

1. 在笔记中写下你选择保留哪个值、理由是什么（真实工作中要问作者，这里自己说明理由）。
2. 编辑文件，删除 `<<<<<<<`、`=======`、`>>>>>>>` 标记，得到最终代码。
3. `git add config.js` 后 `git commit`，再用 `git log --oneline --graph` 截图或粘贴输出。

### 3.3 放弃合并演练

重复 3.2 的冲突步骤，然后在冲突状态下执行 `git merge --abort`，确认工作区回到合并前。

## 任务四 · 回滚三件套

| 场景 | 命令 | 你要记录的内容 |
| --- | --- | --- |
| 撤销未暂存的改动 | `git restore config.js` | 改动是否真的消失 |
| 反做一次已提交的改动 | `git revert <commit>` | 新提交的信息长什么样 |
| 临时切分支 | `git stash` / `git stash pop` | 改动是否完好回来 |

## 任务五 · 写一份 Pull Request 描述

把 `feat/add-greeting` 推到 GitHub 并开一个 PR，描述必须包含四段：做了什么、怎么验证、影响范围、截图或日志。
用 `git push` 成功**不等于**任务完成——PR 描述才是这一任务的验收物。

## 验收清单

- [ ] `env-report.md` 含六个工具的真实版本输出，不是「应该装了」。
- [ ] 能解释 `git status` 中 untracked / modified / staged 的区别，并给出对应命令。
- [ ] 完成一次无冲突合并与一次真实冲突解决，留下了 `git log --graph` 输出。
- [ ] 完成 `restore`、`revert`、`stash` 三项回滚演练。
- [ ] 提交信息全部符合 Conventional Commits 规范。
- [ ] 写出了一份含四段信息的 PR 描述。

## 常见卡点

| 卡点 | 提示 |
| --- | --- |
| `git commit` 报提示要配置身份 | `git config --global user.name` 与 `user.email` 各设一次 |
| 冲突文件里标记删不干净 | 搜索 `<<<`、`===`、`>>>` 三个关键字确认无残留 |
| 合并后出现 `MERGE_MSG` 编辑器卡住 | 输入合并信息后保存退出；想放弃用 `git merge --abort` |
| 推送提示要凭据 | 用 Git Credential Manager 登录，或配置 SSH key |
| `docker exec` 报容器不存在 | 用 `docker ps -a` 看容器名，确认没有拼错 |

## 提交要求

把 `env-report.md`、`git-practice/` 目录、冲突解决记录与 PR 描述一起放进
`work/<你的用户UUID>/<作业UUID>/labs/lab01/`，并在目录 README 中写下三条收获与一条仍不确定的问题。
