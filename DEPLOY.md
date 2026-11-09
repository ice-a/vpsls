# Cloudflare Pages 部署（完整功能 · KV 版）

代码已改造为**双后端**：本地/VPS 走文件，Cloudflare 走 KV。同一份代码两边都能跑。

## 一、存储层改造说明（已完成）

| 模块 | 文件 | 改动 |
| --- | --- | --- |
| 存储抽象 | [server/utils/storage.ts](server/utils/storage.ts) | 新增。`storageRead/storageWrite` 统一接口，Node 落地 `fs` |
| KV 后端 | [server/utils/cloudflare-kv.ts](server/utils/cloudflare-kv.ts) | 新增。内存快照 + 异步回写 KV |
| 检测状态 | [server/utils/db.ts](server/utils/db.ts) | `fs` → `storageRead/Write`，键 `state.json` |
| 访问统计 | [server/utils/analytics.ts](server/utils/analytics.ts) | 同上，键 `analytics.json` |
| 汇率 | [server/utils/rates.ts](server/utils/rates.ts) | 同上，键 `rates.json` |
| 抓取缓存 | [server/scrape/fetch.ts](server/scrape/fetch.ts) | 同上，键 `official/html-cache.json` |
| 官方套餐 | [server/scrape/official.ts](server/scrape/official.ts) | 同上，键 `official/plans.json` |
| 每日任务 | [server/tasks/daily.ts](server/tasks/daily.ts) + [server/api/cron.post.ts](server/api/cron.post.ts) | 新增。一次跑完 检测→抓取→汇率 |
| 定时器守卫 | [server/plugins/availability.ts](server/plugins/availability.ts) | CF 上自动跳过进程内定时器 |

**KV 的异步特性处理**：现有业务是同步读写。KV 后端采用「内存快照 + 异步回写」——
冷启动后**第一次请求**读到空（自动用种子价兜底），同时后台拉 KV，**第二次请求起**就是 KV 真值。
对分钟级更新的报价站可接受。

## 二、创建 KV 命名空间

```powershell
pnpm dlx wrangler login
pnpm dlx wrangler kv namespace create DATA
# 输出类似：
#   [[kv_namespaces]]
#   binding = "DATA"
#   id = "a1b2c3d4e5f6..."
```

把 `id` 填进 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "DATA"
id = "你的命名空间id"
```

## 三、让 KV 绑定生效

Workers 环境下 Nitro 拿不到 `DATA` 绑定是**静默降级**（用内存），
所以需要在 Worker 入口注入。Pages 项目设置 → **Settings → Functions →
KV namespace bindings** 添加：变量名 `DATA`，选刚创建的命名空间。

> Pages 的绑定在 Dashboard 配，`wrangler.toml` 里的 `[[kv_namespaces]]` 主要给 `wrangler pages deploy` 用。

然后把绑定注入 Nitro，改 `server/plugins/storage.ts`（新增）：

```ts
import { installKVBackend } from '../utils/cloudflare-kv'

export default defineNitroPlugin((nitro) => {
  // nitro.runtime 里拿 Cloudflare 的 env.DATA
  const kv = (globalThis as any).__env__?.DATA ?? (globalThis as any).process?.env?.DATA
  if (kv && typeof kv.get === 'function') {
    installKVBackend(kv)
    console.log('[storage] Cloudflare KV backend installed')
  }
})
```

## 四、部署

### 方式 A：Git 集成（推荐）

Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → `ice-a/vpsls`

- Build command：`pnpm exec nuxi build --preset cloudflare_pages`
- Output directory：`dist`
- 环境变量：`NODE_VERSION=20`、`PNPM_VERSION=9`、`CRON_SECRET=<你自己定一个随机串>`
- KV binding：`DATA` → 你的命名空间

### 方式 B：CLI 直传

```powershell
pnpm build:cf
pnpm dlx wrangler pages deploy dist --project-name=vpsls
```

## 五、每日任务

Workers 无进程内定时器，三条路选一条：

**① GitHub Actions（最省事，已在仓库 `.github/workflows/daily.yml` 配好）**

```yaml
name: daily
on:
  schedule: [{ cron: '0 20 * * *' }]   # UTC 20:00 = 北京 04:00
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST "$BASE/api/cron?key=$KEY"
        env:
          BASE: https://vpsls.pages.dev
          KEY: ${{ secrets.CRON_SECRET }}
```

**② Cloudflare Cron Triggers**：`wrangler.toml` 已配 `0 4 * * *`，
但需要 Worker 导出 `scheduled`。Pages 的 `_worker.js` 由 Nitro 生成不暴露这个钩子，
所以要在 Pages 项目里另建一个 **Worker** 专门调接口。

**③ 任意服务器 crontab**

```bash
0 4 * * * curl -fsS -X POST "https://vpsls.pages.dev/api/cron?key=YOUR_SECRET"
```

## 六、验收清单

```bash
BASE=https://vpsls.pages.dev

curl -s -o /dev/null -w "%{http_code}\n" $BASE/                       # 200
curl -s $BASE/ | grep -c "按年付总价"                                  # ≥1
curl -s "$BASE/api/offers?window=180" | head -c 120                   # 含 perYear
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" $BASE/go/justhost
# 302 https://justhost.asia/?ref=387918
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" $BASE/go/hetzner
# 302 https://www.hetzner.com/

# 手动跑一次每日任务
curl -s -X POST "$BASE/api/cron?key=YOUR_SECRET"
# 期望：{"ok":true,"check":{"up":18,...},"refetch":{"ok":[...],"totalPlans":82},"rates":{...}}

# 再访问一次，确认 KV 写入生效
curl -s $BASE/api/status | head -c 200                                # lastRun 有 finishedAt
```

## 七、本地验证（不部署也能验）

```bash
pnpm build            # node-server 产物，.output/server/index.mjs
pnpm build:cf         # CF 产物，dist/_worker.js
pnpm dlx wrangler pages dev dist    # 本地模拟 Workers，http://localhost:8788
```

## 常见报错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 线上数据不持久（每次请求都像首次） | KV binding 没配上 | Dashboard 加 `DATA` 绑定，或看 Worker 日志有无 `KV backend installed` |
| 首次访问数据为空 | KV 异步加载 | 正常。刷新一次即真值；想消除可加预热 |
| `Module not found: node:fs` | 没开 node compat | `compatibility_flags=["nodejs_compat"]` |
| `/api/cron` 返回 401 | 配了 `CRON_SECRET` 但没带 key | 请求加 `?key=xxx` 或 header `x-cron-key` |
| 构建后 dist 为空 | 命令没带 preset | 用 `pnpm build:cf` |