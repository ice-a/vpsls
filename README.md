# VPS 报价单（vpsls 同款 · 前后端不分离）

仿 [vpsls.com](https://vpsls.com/) 模式的 VPS 优惠聚合站：**Nuxt 4 SSR 单体**（页面与 API 同进程、同端口，无前后端分离）、**服务商连通性每日 04:00 自动检测**、**全站推广链接统一出口替换**、UI 全新设计（机房报价单 / 工业仪表盘风）。

## 快速开始

```bash
pnpm install          # 安装依赖（node ≥ 20，pnpm ≥ 10）
pnpm dev              # 开发：http://localhost:3000
pnpm build && pnpm start   # 生产：.output/server/index.mjs
# 换端口：PORT=3210 node .output/server/index.mjs
```

页面：`/` 首页（榜单+推荐+状态）、`/deals` 实时筛选器、`/guide` 测速选购方法、`/providers` 服务商目录、`/stats` 访问统计。
各厂商联盟申请入口与步骤：[AFFILIATES.md](AFFILIATES.md)。

**展示与推荐口径（对外三原则）**：
- **年付主显**：价格列以「年付总价」为主（`/年`），月均与另一币种作辅助行；`perYear = 期价 × 年化倍数`（月付×12 / 季付×4 / 半年×2 / 年付=标价），不走 `perMonth×12` 防舍入漂移。
- **年付优先**：首页最便宜榜只列年付套餐；筛选器默认排序 `recommend`。
- **有 aff 优先**：配了 [shared/aff.ts](shared/aff.ts) 返佣链接的服务商在推荐序里排前（**前台不展示「返佣」标记**，只影响位次），排序键 `hasAff desc → cycle==yearly desc → perYear asc`，价格在同级内仍然升序——返佣不改价格口径，只改推荐位次。
- **预算窗口年付化**：首页「按预算快选」与筛选器 `window` 参数为年付总价档位（180/360/600/1200/2400）；旧分享链接 `window=15/30/50/100/200`（月单价）自动 ×12 兼容。

**人民币实时换算**：价格以美元标价，服务端按实时汇率（jsdelivr currency-api 主源 / open.er-api.com 备源，6h 缓存，启动预热）换算人民币；全站价格主显 ¥/$ 可在顶栏切换（localStorage 记忆），`GET /api/rates` 查当前汇率。

**测速选购（/guide）**：识别当前公网 IP 位置（ipwho.is → ipinfo.io）推荐机房区域并一键实测该区域；也可手动选点测 9 个区域的延迟（浏览器 no-cors 计时取多目标最小值 ≈ RTT），最快区域直达筛选器。

## 把 aff 换成你的（全站唯一入口）

**所有**对外链接只从 [shared/aff.ts](shared/aff.ts) 出去，站内统一走 `/go/:slug` 302 出口：

```ts
// 方式一：全局兜底（最常用）
DEFAULT_REF: 'YOUR-ID'        // 裸链自动拼 ?ref=YOUR-ID
// 或
DEFAULT_MODE: 'NONE',
DEFAULT_AFF_URL: 'https://你的联盟链接/…'   // 直接整链替换

// 方式二：给某家厂商配专属链接
PROVIDER_AFF: {
  racknerd: 'https://…带你的ID…',
}
```

改完 `pnpm build` 重启即可。验证：

```bash
curl -I http://127.0.0.1:3000/go/racknerd
# Location: https://racknerd.com?ref=你的ID
```

可选埋点：环境变量 `AFF_BEACON=https://你的收集端点`，每次出口跳转会附带 `p=<厂商>&src=<来源>` 上报。

## 每日自动检测

- 实现：[server/utils/scheduler.ts](server/utils/scheduler.ts)，由 server 启动插件 [server/plugins/availability.ts](server/plugins/availability.ts) 注册。
- 规则：每天 **04:00** 逐个 GET 18 家服务商官网（并发 6、超时 8s、重试 1 次），2xx/3xx/401/403 视为在线；**连续 3 轮全失败标 DOWN**，恢复即回 UP；进程启动时距上次检测 >20h 自动补跑。
- 结果落盘 `.data/state.json`（重启不丢；部署时把 `.data` 挂持久卷）。
- 手动触发 / 外部 cron 调用：

```bash
curl -X POST http://127.0.0.1:3000/api/check
# {"ok":true,"run":{"up":18,"down":0,"total":18,"durationMs":18073}}
```

多实例部署时只留一个实例注册定时器，其余实例设 `CHECK_DISABLED` 语义或直接用外部 cron 调上面的接口（结果幂等）。

## API 一览（同端口同进程）

| 路由 | 说明 |
| --- | --- |
| `GET /api/home` | 首页聚合：统计/最便宜榜/推荐位/厂商摘要 |
| `GET /api/offers` | 筛选：`window minRam minCpu minDisk region os cycle provider q sort` |
| `GET /api/providers` | 服务商目录 + 最近检测汇总 |
| `GET /api/status` | 最近一轮检测结果 |
| `POST /api/check` | 手动触发一轮检测 |
| `POST /api/refetch` | 刷新官方套餐源（`?force=1` 绕过缓存） |
| `GET /api/stats` | 访问统计聚合（`?days=7\|14\|30\|90`）：每日 PV/点击/搜索 + 三榜 |
| `GET /api/rates` | 当前 USD→CNY 汇率（实时 + 6h 缓存） |
| `POST /api/track/search` | 搜索条件上报（筛选器去抖后自动调用） |
| `GET /go/:slug` | 统一 aff 出口 302（`?src=` 标记来源、`?offer=` 产品级归因） |

## 套餐数据：官方抓取 + 种子回退

- **官方源（每日自动刷新 + 手动触发）**：`POST /api/refetch?force=1` 强刷、`POST /api/refetch` 走 24h 缓存；抓取调度与每日检测同频（04:00）。
- **当前可抓 6 家**（结构已实测解剖）：搬瓦工/ColoCrossing/Bytevirt/DediOne/WAP.AC/OVH —— 套餐行打 `官方实时` 徽标，`source=official`。
- **抓不动的 12 家**（反爬 403 / 套餐名客户端渲染 / 无静态价）：回退内置种子价，`source=seed`，页面如实标注；给 `OFFICIAL_SOURCES`（[server/scrape/official.ts](server/scrape/official.ts)）加一条 source 配置即可纳入。
- 解析器结构依据 `.probe/` 的官方页真实样本（WHMCS 新旧两模板 + wapac + OVH 卡片）；解析 0 条 = 判失败回种子，绝不半猜半填。
- HTML 缓存 `.data/official/html-cache.json`（24h），解析结果 `.data/official/plans.json`，部署挂持久卷。

## 访问统计

- 全局中间件 [server/middleware/track.ts](server/middleware/track.ts)：页面打开（HTML GET）自动记 PV；`/go/:slug` 出口点击记到**产品**（`?offer=of_xxx`）或**厂商**（无 offer 时 `provider:slug`）。
- 筛选器条件变化去抖 800ms 上报到 `/api/track/search`，按「归一化条件串」聚合（如 `region=ASIA&window=15`）。
- 数据落 `.data/analytics.json`，看板页 `/stats`（趋势柱状图 + 页面榜/产品点击榜/搜索条件榜），底层接口 `GET /api/stats`。

## 改数据

- 厂商目录：[server/data/providers.ts](server/data/providers.ts)（slug/name/tagline/regions/官网 URL）
- 套餐目录：[server/data/offers.ts](server/data/offers.ts)（元组一行一条；`perMonth` 自动 = 期价 ÷ 期数）
- 接真实价格源时：保持 `Offer` 字体结构（[shared/types.ts](shared/types.ts)），替换 `getOffers()` 的取数实现即可，页面与 API 不用动。

## 目录结构

```
app/            # 前端（SSR 页面与组件）
  pages/        #   /  /deals  /providers
  components/   #   OfferSheet / ProviderSheet / StatusChip
  assets/css/   #   设计系统（Chakra Petch + IBM Plex Mono，墨黑+薄荷绿）
server/         # 后端（Nitro，同端口）
  api/          #   JSON 接口
  routes/go/    #   aff 出口跳转
  utils/        #   db(状态存储) scheduler(每日检测)
  data/         #   厂商/套餐种子数据
shared/         # 前后端共享：types / format / aff 配置
.data/          # 运行状态（检测结果），持久化目录
```

## 部署

任意能跑 Node 的 VPS/容器：

```bash
pnpm install && pnpm build
PORT=3000 node .output/server/index.mjs     # 或 pnpm start
# systemd / pm2 / docker 均可；记得持久化 .data/
```
