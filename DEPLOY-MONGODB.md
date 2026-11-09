# MongoDB 部署指南（替代 KV）

用户无法在 Cloudflare 添加 KV，改用 **MongoDB Atlas 免费集群** 做持久化。
代码已改造成「存储抽象层 + MongoDB 后端」，**业务代码零改动**。

## 一、已完成改造

| 文件 | 作用 |
| --- | --- |
| [server/utils/storage.ts](server/utils/storage.ts) | 存储抽象层。Node→fs / Mongo→远程；含**过渡期内存缓冲**，避免 Mongo 就绪前误写磁盘 |
| [server/utils/mongodb.ts](server/utils/mongodb.ts) | MongoDB 后端：内存快照 + 异步回写 + 启动预热 |
| [server/plugins/storage.ts](server/plugins/storage.ts) | 启动时按 `MONGODB_URI` 挂载后端 |
| [server/api/storage.get.ts](server/api/storage.get.ts) | 健康检查：当前跑在哪个后端（**不返回连接串**） |
| [server/tasks/daily.ts](server/tasks/daily.ts) | 每日任务末尾加 `flushMongo()` 保证真落库 |
| [nuxt.config.ts](nuxt.config.ts) | 把 mongodb 的可选依赖标记 external，修复 CF 构建失败 |

## 二、数据结构

- 库名：**`vpsls`**（不是 test）
- 集合：**`documents`**
- 文档：`{ key: 'state.json', data: '<JSON字符串>', updatedAt: Date }`
- 已有索引：`key` 唯一

实际落库的 4 个 key：

```
state.json                  检测结果 + 最近一轮汇总
analytics.json              PV / 产品点击 / 搜索条件
rates.json                  USD→CNY 汇率缓存
official/plans.json         官方套餐抓取结果
official/html-cache.json    官方页 HTML 缓存（24h）
```

## 三、Cloudflare Pages 配置

**环境变量**（Settings → Environment variables，Production + Preview 都加上）：

| 变量 | 值 |
| --- | --- |
| `MONGODB_URI` | `mongodb://devops:u8yRO4OyhqXBhLjW@ac-eqksaup-shard-00-00.utlbkzb.mongodb.net:27017,ac-eqksaup-shard-00-01.utlbkzb.mongodb.net:27017,ac-eqksaup-shard-00-02.utlbkzb.mongodb.net:27017/?ssl=true&replicaSet=atlas-ofsrbz-shard-0&authSource=admin&appName=devops` |
| `MONGODB_DB` | `vpsls` |
| `CRON_SECRET` | 你自己定一个随机串 |
| `NODE_VERSION` | `20` |
| `PNPM_VERSION` | `9` |

**构建配置**：
- Build command：`pnpm exec nuxi build --preset cloudflare_pages`
- Output directory：`dist`

> **不需要 KV 绑定了**，Settings → Functions → KV namespace bindings 可以留空。

## 四、Atlas 网络白名单（必做）

Cloudflare Workers 出口 IP 是动态的，必须放行所有来源：

Atlas → Network Access → Add IP Address → **Allow Access from Anywhere**（`0.0.0.0/0`）

不配这条会报 `MongoServerSelectionError: connection timed out`。

## 五、验收

```bash
BASE=https://vpsls.pages.dev

# 1. 后端类型
curl -s $BASE/api/storage
# 期望：{"backend":"mongodb","db":"vpsls","mongoReady":true,"hasUri":true}

# 2. 手动跑一次每日任务（会真实写库）
curl -s -X POST "$BASE/api/cron?key=YOUR_SECRET"
# 期望：{"ok":true,"storage":"mongodb","check":{...},"refetch":{...},"errors":[]}

# 3. 再查状态（应能读到刚写入的 lastRun）
curl -s $BASE/api/status

# 4. 套餐数据
curl -s "$BASE/api/offers?window=180" | head -c 150   # 含 perYear
```

MongoDB 侧确认：Atlas → Browse Collections → `vpsls.documents` 应看到 4 条文档。

## 六、本地验证（已实测通过）

```powershell
$env:MONGODB_URI='<你的连接串>'
pnpm build
$env:PORT='3210'; node .output/server/index.mjs

# 期望日志
# [mongo] backend ready, db=vpsls, warmed=N keys
# 且运行目录下不会生成 .data/
```

实测结果（2026-11-09）：

| 项 | 结果 |
| --- | --- |
| `/api/storage` | `backend=mongodb mongoReady=true` |
| MongoDB 文档 | 4 条（state/rates/plans/html-cache） |
| 删掉本地 `.data` 后重启 | 数据从 Mongo 读回，**不再创建 `.data`** |
| `POST /api/cron` | `ok=true check=18/18 plans=82 rates=6.6755 errors=[]` |
| 首页 / offers / status | 200 / 50 条 / lastRun 正常 |
| 是否污染 test 库 | **否**，全程只用 `vpsls` |

## 七、已知边界

1. **冷启动首请求**：Mongo 异步预热，首次请求可能读到空 → 自动用种子价兜底，第二次请求起即为库内真值。本地实测预热耗时约 2–3 秒（Atlas 跨区连接）。
2. **Atlas 免费层**：M0 集群 512 MB 存储、共享 CPU。本项目的 `html-cache.json` 约 500 KB–1.8 MB，长期跑会积累，建议每月清理或把缓存 TTL 缩短。
3. **连接数**：Workers 每次冷启动建一条连接（maxPoolSize=5）。低频访问场景没问题；如果流量大，建议改用 Atlas Data API 或加连接池代理。
4. **CSV/凭据**：连接串里含明文密码，只放在 CF 环境变量里，不要提交到仓库（`.gitignore` 已排除 `.data/`）。