# 01 · SQL 与关系型数据库

## 一、关系模型的基本概念

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| 表（Table） | 同类实体的集合 | `users`、`posts` |
| 行（Row） | 一条记录 | 某个用户 |
| 列（Column） | 一个字段，有明确类型 | `email text not null` |
| 主键（Primary Key） | 唯一标识一行 | `id bigserial primary key` |
| 外键（Foreign Key） | 引用另一张表的行 | `author_id references users(id)` |
| 约束（Constraint） | 数据库层的规则 | `unique`、`check`、`not null` |

**把规则写进数据库**：应用层校验会被绕过（脚本、迁移、其他服务），数据库约束是最后一道防线。

## 二、查询基础

```sql
-- 建表：显式约束、时间戳默认值、外键级联策略
create table posts (
  id          bigserial primary key,
  author_id   bigint not null references users(id) on delete cascade,
  title       text not null,
  slug        text not null unique,
  content     text not null default '',
  status      text not null default 'draft'
              check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 条件、排序、分页（游标分页更稳）
select id, title, published_at
from posts
where status = 'published' and author_id = 7
order by published_at desc
limit 20;
```

## 三、连接（JOIN）

| 类型 | 含义 | 用途 |
| --- | --- | --- |
| `inner join` | 两边都匹配才出现 | 查「有评论的文章」 |
| `left join` | 左表全保留，右表可为空 | 查「所有文章及其评论数（含 0）」 |
| `right join` | 右表全保留 | 少见，通常调换顺序 |
| `full join` | 两边都保留 | 对账场景 |

```sql
-- 每篇文章的评论数与最新评论时间（含 0 评论的文章）
select p.id, p.title, count(c.id) as comment_count, max(c.created_at) as last_comment_at
from posts p
left join comments c on c.post_id = p.id
where p.status = 'published'
group by p.id, p.title
order by comment_count desc
limit 10;
```

**常见错误**：把过滤条件写在 `where` 里会把 `left join` 变成 `inner join`（空值行被过滤掉）。需要保留空行时把条件写进 `on` 子句。

## 四、聚合与分组

```sql
select
  date_trunc('month', created_at) as month,
  count(*)                        as total,
  count(*) filter (where status = 'published') as published,
  round(avg(length(content)))     as avg_len
from posts
group by month
order by month desc;

-- having：对分组结果过滤（where 过滤的是行）
select author_id, count(*) as n
from posts
group by author_id
having count(*) > 5;
```

## 五、子查询与 CTE

```sql
-- CTE（with）让复杂查询分步可读
with monthly as (
  select date_trunc('month', created_at) as month, count(*) as n
  from posts group by month
),
ranked as (
  select month, n,
         lag(n) over (order by month) as prev_n
  from monthly
)
select month, n, prev_n, n - coalesce(prev_n, 0) as growth
from ranked
order by month desc
limit 12;
```

## 六、窗口函数：不折叠行的聚合

```sql
-- 每个作者内部按发布时间排名
select
  id, author_id, title, published_at,
  row_number() over (partition by author_id order by published_at desc) as rn,
  count(*)     over (partition by author_id)                          as author_total
from posts
where status = 'published';

-- 取每个作者最新的一篇：套一层子查询过滤 rn = 1
```

| 函数 | 作用 |
| --- | --- |
| `row_number()` | 组内序号，无并列 |
| `rank()` / `dense_rank()` | 有并列的排名 |
| `lag()` / `lead()` | 取前／后一行，用于环比 |
| `sum() over (... order by ...)` | 累计求和 |

## 七、写入与更新

```sql
insert into posts (author_id, title, slug) values (7, '第一篇文章', 'first-post')
returning id, created_at;

-- upsert：存在则更新
insert into tags (name) values ('typescript')
on conflict (name) do update set name = excluded.name
returning id;

update posts set status = 'published', published_at = now(), updated_at = now()
where id = 101 and status = 'draft';

delete from posts where id = 101;
```

**更新前先 `select` 确认影响行数**：生产环境里一条漏了 `where` 的 `update` 是灾难。

## 八、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 查询慢 | 全表扫描 | 加索引并用 `explain analyze` 验证 |
| 统计数字偏大 | 多表连接产生笛卡尔积 | 先用 CTE 各自聚合再连接 |
| `left join` 结果变少 | 过滤条件写在 `where` 里 | 条件移到 `on` |
| 金额出现精度误差 | 用了 `float` | 用 `numeric(12,2)` 或整数分 |
| 时区错乱 | 用 `timestamp` 存本地时间 | 统一 `timestamptz` + UTC |
| 删除父行报外键错误 | 无级联策略 | 明确 `on delete cascade` 或 `restrict` |

## 九、动手练习

1. 建 users／posts／comments／tags 四张表，插 50 条测试数据。
2. 写出「每篇文章的标签列表」与「标签使用次数排行」两个查询。
3. 用窗口函数取每个作者最新的一篇文章。
4. 写一个查询统计「某月发布量环比增长」，用 `lag()` 实现。