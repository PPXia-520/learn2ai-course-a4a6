# 02 · Git 与 GitHub 协作

## 一、版本控制解决什么问题

没有版本控制时，常见做法是 `最终版.zip`、`最终版-改2.zip`。Git 用一条**有向无环图**记录每次变化的快照，于是你能：

- 回到任意历史版本，知道每一行是谁、什么时候、为什么改的；
- 多人并行开发，各写各的分支，最后合并；
- 出问题时用 `git bisect` 定位是哪次提交引入的；
- 让部署与回滚变成一条命令。

## 二、三个区域与一条提交链

| 区域 | 含义 | 相关命令 |
| --- | --- | --- |
| 工作区（Working Directory） | 你正在编辑的文件 | `git status` 观察变化 |
| 暂存区（Staging Area） | 准备提交的改动清单 | `git add` 挑选改动 |
| 本地仓库（Repository） | 已提交的历史快照 | `git commit` 写入历史 |
| 远程仓库（Remote） | GitHub 上的副本 | `git push` / `git fetch` |

`git status` 中每个文件的三种常见状态：**untracked**（Git 还不认识）、**modified**（改了但没暂存）、**staged**（已暂存待提交）。

## 三、高频命令速查

| 目的 | 命令 | 备注 |
| --- | --- | --- |
| 初始化仓库 | `git init` | 生成 `.git/` 目录 |
| 克隆仓库 | `git clone <url>` | 会自动设置 origin |
| 查看状态 | `git status` | 最常用的命令 |
| 暂存改动 | `git add <文件>` / `git add -p` | `-p` 按块挑选，粒度更细 |
| 提交 | `git commit -m 'feat: 添加登录'` | 提交信息写清「做了什么」 |
| 查看历史 | `git log --oneline --graph --all` | 图形化看分支结构 |
| 看差异 | `git diff` / `git diff --staged` | 分别看工作区与暂存区 |
| 新建并切换分支 | `git switch -c feat/login` | 新版推荐 `switch` |
| 合并分支 | `git merge feat/login` | 在目标分支上执行 |
| 变基 | `git rebase main` | 让历史变直，慎用于共享分支 |
| 暂存现场 | `git stash` / `git stash pop` | 临时切分支时用 |
| 拉取远程 | `git fetch` + `git merge` | 等价于 `git pull`，但更可控 |
| 推送 | `git push -u origin feat/login` | 首次要指定上游分支 |
| 撤销暂存 | `git restore --staged <文件>` | 保留改动，只取消暂存 |
| 撤销改动 | `git restore <文件>` | **会丢弃未提交改动，小心** |
| 反做某次提交 | `git revert <commit>` | 生成一次新提交来抵消，安全 |

## 四、团队协作的标准流程

见 `assets/git-workflow.svg`。典型流程：

```powershell
git switch main
git fetch origin
git merge origin/main            # 保持本地 main 最新
git switch -c feat/user-profile
# ... 写代码 ...
git add -p
git commit -m 'feat: 用户资料页展示与编辑'
git push -u origin feat/user-profile
# 在 GitHub 上开 Pull Request，等评审通过后合并
```

**为什么推荐「短分支 + 频繁合并」**：分支活得越久，冲突越大、评审越难、风险越高。

## 五、冲突是怎么产生的，怎么解决

冲突的本质：**两个分支改了同一文件的同一位置**，Git 无法替你决定保留哪个。

```powershell
git merge feat/login
# 提示 CONFLICT (content): Merge conflict in src/auth.ts
```

文件里会出现这样的标记：

```text
<<<<<<< HEAD
const timeout = 3000;
=======
const timeout = 5000;
>>>>>>> feat/login
```

解决步骤：

1. 逐个打开冲突文件，**理解双方为什么这么改**（必要时找作者确认），不要盲目删一侧。
2. 改成最终想要的样子，并删掉 `<<<<<<<`、`=======`、`>>>>>>>` 三行标记。
3. `git add <冲突文件>` 标记为已解决。
4. `git commit` 完成合并（Git 已准备好合并信息）。
5. **合并后必须重新跑一遍测试与构建**，冲突解决常常引入逻辑错误。

想中途放弃：`git merge --abort` 回到合并前状态。

## 六、提交信息规范（Conventional Commits）

| 前缀 | 含义 | 例子 |
| --- | --- | --- |
| `feat` | 新功能 | `feat: 支持手机号登录` |
| `fix` | 修复缺陷 | `fix: 修复分页越界导致的空列表` |
| `docs` | 文档 | `docs: 补充接口鉴权说明` |
| `refactor` | 重构（不改行为） | `refactor: 抽离查询构造逻辑` |
| `test` | 测试 | `test: 补充登录失败用例` |
| `chore` | 构建／依赖／杂项 | `chore: 升级 vite 到 5.4` |

一条好的提交信息 = **做了什么 + 为什么**。`fix: bug` 这样的信息等于没写。

## 七、`.gitignore`：什么不该进仓库

必忽略：依赖目录（`node_modules/`）、构建产物（`dist/`）、环境变量文件（`.env`）、编辑器与系统文件、日志与临时文件。

**绝不提交**：密钥、令牌、证书、数据库导出、任何真实用户数据。一旦 push 就视为泄露，必须立刻作废并更换密钥。

## 八、安全地回滚

| 场景 | 用哪个 | 说明 |
| --- | --- | --- |
| 撤销还没提交的改动 | `git restore <文件>` | 不可恢复，确认后再执行 |
| 撤销刚提交但未推送的内容 | `git reset --soft HEAD~1` | 保留改动回到暂存区 |
| 已推送的错误提交 | `git revert <commit>` | 生成反向提交，历史保留，**共享分支唯一正确做法** |
| 想整理本地历史 | `git rebase -i HEAD~3` | 仅限未推送的个人分支 |

**红线**：永远不要对共享分支（main、他人正在用的分支）执行 `git push --force`。

## 九、Pull Request 怎么写

一份合格的 PR 描述包含四段：

1. **做了什么**：一句话概述，附关联 issue 编号。
2. **怎么验证**：列出评审者可以照着做的步骤。
3. **影响范围**：涉及哪些模块、是否有数据库变更或破坏性接口变更。
4. **截图／日志**：有界面的改动附前后对比图。

## 十、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 推送被拒 `rejected` | 远程有新提交 | 先 `git fetch` + `git merge`，再推送 |
| 提交里混进无关文件 | 用了 `git add .` | 改用 `git add -p` 按块挑选 |
| 误把 `.env` 提交了 | `.gitignore` 写晚了 | 从历史移除并**轮换所有泄露的密钥** |
| 切换分支报错说有未提交改动 | 工作区脏 | 先提交或 `git stash` |
| 合并后功能坏了 | 冲突解决引入逻辑错误 | 合并后必须跑测试与构建 |
| 拉取后出现意外提交 | 用了 `git pull` 且配置了 rebase/merge 策略 | 用 `git fetch` 后自己决定合并方式 |

## 小结

- 工作区 → 暂存区 → 本地仓库 → 远程仓库，是理解所有 Git 命令的主线。
- 分支短、合并勤、提交信息规范，是团队协作的三条纪律。
- 共享分支只 `revert`，不 `reset`、不 `force push`。
