# 03 · ORM、迁移与缓存

## 一、ORM 的价值与边界

**价值**：类型安全的查询、参数化防注入、迁移管理、关系加载。
**边界**：复杂报表、批量操作、极致性能场景仍应写原生 SQL。ORM 是工具，不是教条。

```ts
// Prisma 示例：类型安全的查询
const posts = await prisma.post.findMany({
  where: { authorId: 7, status: 'published' },
  orderBy: { publishedAt: 'desc' },
  take: 20,
  select: { id: true, title: true, publishedAt: true },   // 只取需要的字段
});
```

## 二、N+1 查询：最典型的性能陷阱

```ts
// 坏：1 次查文章 + N 次查作者 = N+1 次查询
const posts = await prisma.post.findMany();
for (const post of posts) {
  post.author = await prisma.user.findUnique({ where: { id: post.authorId } });
}

// 好：一次联表查询或分批 IN 查询
const posts = await prisma.post.findMany({
  include: { author: { select: { id: true, name: true } } },
});

// 或用 batch loader 把 N 次查询合并成 1 次
const users = await userLoader.loadMany(posts.map(p => p.authorId));
```

**识别方法**：打开数据库查询日志，看一次接口请求产生了多少条 SQL。个位数正常，几十上百条就是 N+1。

## 三、迁移：让表结构变更可追溯

| 原则 | 说明 |
| --- | --- |
| 迁移文件只追加 | 已执行过的迁移不要改内容，否则团队环境会不一致 |
| 每个迁移做一件事 | 便于定位与回滚 |
| 生产环境变更要考虑锁 | 大表加索引用 `concurrently`，避免长时间锁表 |
| 破坏性变更分两步 | 先加新列并双写 → 再切读 → 最后删旧列 |
| 迁移前必须能回滚或演练 | 至少准备回滚脚本与备份策略 |

```bash
npx prisma migrate dev --name add_post_status     # 开发：生成并应用迁移
npx prisma migrate deploy                          # 生产：只应用已有迁移
npx prisma migrate status                          # 查看迁移状态
npx prisma studio                                  # 可视化查看数据
```

**无破坏性字段变更的经典做法**（改列名场景）：
1. 加新列 → 2. 双写新旧列 → 3. 回填历史数据 → 4. 切读新列 → 5. 停止写旧列 → 6. 删除旧列。每一步都可独立部署与回滚。

## 四、事务与 ORM

```ts
// 把一组写操作放进同一事务
await prisma.$transaction(async (tx) => {
  const post = await tx.post.create({ data: { title, slug, authorId } });
  await tx.auditLog.create({ data: { action: 'post.create', targetId: post.id } });
  await tx.user.update({
    where: { id: authorId },
    data: { postCount: { increment: 1 } },       // 原子自增，避免先查后写
  });
});
```

**要点**：事务里不要做网络请求、发邮件、调用外部 API——那会把锁持有时间拉长，制造阻塞。

## 五、缓存：先想清楚三件事

1. **缓存什么**：读多写少、计算昂贵、能容忍短暂过期的数据。
2. **何时失效**：数据变更时删除缓存，而不是更新缓存（delete 比 update 更不容易出现脏数据）。
3. **降级策略**：缓存挂了业务要能继续跑（直接查库）。

### Cache Aside（旁路缓存）

```ts
async function getPost(id: string) {
  const key = `post:v1:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const post = await repo.findById(id);
  if (post) await redis.set(key, JSON.stringify(post), { EX: 300 });   // 5 分钟过期
  return post;
}

async function updatePost(id: string, patch: Partial<Post>) {
  const updated = await repo.update(id, patch);
  await redis.del(`post:v1:${id}`);        // 写后删缓存，下次读自然回源
  return updated;
}
```

| 模式 | 说明 | 风险 |
| --- | --- | --- |
| Cache Aside | 读时回填、写时删除 | 首次读与并发读可能回源多次 |
| Write Through | 写时同时更新缓存 | 写放大，缓存内容可能冗余 |
| 加互斥锁回填 | 回源时加锁，避免缓存击穿 | 实现复杂 |

| 问题 | 现象 | 对策 |
| --- | --- | --- |
| 缓存穿透 | 查不存在的数据，每次都打库 | 缓存空值（短过期）或布隆过滤器 |
| 缓存击穿 | 热点 key 过期瞬间大量请求回源 | 互斥锁回填或逻辑过期 |
| 缓存雪崩 | 大量 key 同时过期 | 过期时间加随机抖动 |

**缓存键要带版本**：`post:v1:123`。结构变更时改版本号即可让旧数据自然失效，无需批量删除。

## 六、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 接口慢但 SQL 都很快 | N+1 导致请求数过多 | 用 include 或批处理合并 |
| 缓存与数据库不一致 | 只更新缓存未删除 | 写后删除，并设合理过期 |
| 迁移在别人机器上失败 | 改了已执行的迁移文件 | 只追加新迁移 |
| ORM 生成的 SQL 极慢 | 未看生成语句 | 打开 query log，必要时改原生 SQL |
| 单元测试互相污染 | 共用一个数据库 | 每个测试用独立事务或独立 schema |

## 七、动手练习

1. 用 ORM 实现博客的增删改查，只 `select` 需要的字段。
2. 制造一个 N+1 场景（看日志里的 SQL 条数），再用 `include` 消除它。
3. 写两条迁移：新增 `status` 列并回填默认值、为新列加索引。
4. 给文章详情加 Redis 缓存（TTL 5 分钟），实现写后删除，并演示一致性。