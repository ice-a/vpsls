# 部署到 Cloudflare Pages（不构建 app，纯 Web）

本项目是 Nuxt 4 SSR 单体（前后端不分离）。Nitro 官方 preset `cloudflare_pages` 已在本机跑通：产物 `dist/`，入口 `dist/_worker.js`，总体积约 517 kB。

## 0. 关键前提：存储层

线上唯一**会失败**的点是数据持久化。当前实现用 Node `fs` 写 `.data/`：

| 文件 | 用途 | CF 上的后果 |
| --- | --- | --- |
| `.data/state.json` | 服务商连通性检测结果 | 无法落盘 → 每次请求都当首次检测 |
| `.data/analytics.json` | 页面 PV / 点击 / 搜索条件 | 统计数据全部丢失 |
| `.data/rates.json` | USD→CNY 汇率缓存 | 每次回源查汇率（慢但能跑） |
| `.data/official/plans.json` | 官方套餐抓取结果 | 官方源数据丢失，只剩种子价 |

另有 `server/plugins/availability.ts` 注册的 `setTimeout` 定时器，在 Workers 上会被冻结 —— 每日检测必须改用 **Cron Triggers**（已在 `wrangler.toml` 配好 `0 4 * * *`）。

**两条路线，选一条：**

- **路线 A（不改代码，先上线看效果）**：只读模式。种子价 + 汇率实时查询可用，检测/统计/官方套餐降级为空。适合先验证 UI 和流量。
- **路线 B（要完整功能）**：把 `db.ts` / `analytics.ts` / `rates.ts` / `scrape/fetch.ts` 的 `fs` 换成 **Cloudflare KV**（简单键值够用）或 **D1**（需要 SQL 时）。改动集中在 4 个文件，接口签名不变。

> 路线 B 我可以直接改，说一声即可。

## 1. 推送到 GitHub

```bash
cd C:\Users\lee\Desktop\dev\ai\vpsls

git init -b main
git add .
git commit -m "feat: VPS 报价单 — 年付口径 + 官方套餐源 + CF Pages 部署"

# 方式一：仓库已存在
git remote add origin https://github.com/ice-a/vpsls.git
git push -u origin main

# 方式二：用 gh CLI 一次建仓并推送
gh auth login
gh repo create ice-a/vpsls --public --source=. --push
```

首次 `push` 需要 GitHub 凭据：HTTPS 用 **Personal Access Token**（Settings → Developer settings → Tokens，勾 `repo`），或配好 SSH key 后改用 `git@github.com:ice-a/vpsls.git`。

`.gitignore` 已排除 `node_modules/ .nuxt/ .output/ .data/ .probe/ .wrangler/ dist/`。

## 2. 在 Cloudflare 建 Pages 项目（Git 集成，推荐）

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub，选 `ice-a/vpsls` 仓库，分支 `main`
3. 构建配置：
   - Framework preset：**Nuxt**（没有就选 None）
   - Build command：`pnpm exec nuxi build --preset cloudflare_pages`
   - Build output directory：`dist`
   - 环境变量：`NODE_VERSION=20`、`PNPM_VERSION=9`
4. **Save and Deploy**。首次构建约 2–4 分钟。

之后每次 `git push` 自动重新部署。

## 3. 或者用 CLI 直传（不上 Git 集成）

```bash
pnpm install
pnpm build:cf                      # 产出 dist/
pnpm dlx wrangler login            # 浏览器授权
pnpm dlx wrangler pages deploy dist --project-name=vpsls
```

`wrangler.toml` 已写好 `name / compatibility_date / compatibility_flags=["nodejs_compat"] / pages_build_output_dir` 和 cron。

## 4. 绑自定义域名

Pages 项目 → **Custom domains** → **Set up a custom domain** → 填你的域名。
域名在同一 Cloudflare 账号下会自动建 CNAME；在别处则按提示加 CNAME 指向 `<project>.pages.dev`。

## 5. 验收清单（部署后逐条 curl）

```bash
BASE=https://vpsls.pages.dev

curl -s -o /dev/null -w "%{http_code}\n" $BASE/                       # 期望 200
curl -s $BASE/ | grep -c "按年付总价"                                  # 期望 ≥1
curl -s "$BASE/api/offers?window=180" | head -c 200                   # 期望含 "perYear"
curl -s $BASE/guide | grep -c "一键测速"                               # 期望 ≥1
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" $BASE/go/justhost
# 期望：302 https://justhost.asia/?ref=387918
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" $BASE/go/hetzner
# 期望：302 https://www.hetzner.com/（无 aff 就是裸链）
```

## 6. 每日任务（CF 上）

`wrangler.toml` 的 `[triggers] crons = ["0 4 * * *"]` 会在每天 04:00 UTC 触发 Worker。当前代码里没有 cron handler，**需要补一个**：

```ts
// server/plugins/cf-cron.ts
export default defineNitroPlugin((nitro) => {
  // Cloudflare 环境下由 scheduled handler 调用，见下
})
```

更直接的做法是外部 cron 打接口（不改代码也能跑）：

```bash
# 每天 04:00 调用，结果幂等
curl -X POST https://vpsls.pages.dev/api/check
curl -X POST "https://vpsls.pages.dev/api/refetch?force=1"
```

用 **GitHub Actions** 免费跑：

```yaml
# .github/workflows/daily.yml
name: daily-check
on:
  schedule: [{ cron: '0 20 * * *' }]   # UTC 20:00 = 北京 04:00
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST https://vpsls.pages.dev/api/check
      - run: curl -fsS -X POST "https://vpsls.pages.dev/api/refetch?force=1"
```

## 7. 本地验证 CF 产物

```bash
pnpm build:cf
pnpm dlx wrangler pages dev dist      # 起在 http://localhost:8788
```

## 常见报错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 构建 `Module not found: node:fs` | 没开 node compat | 确认 `compatibility_flags=["nodejs_compat"]` 在 `wrangler.toml` 且 Pages 项目设置里 |
| 线上 API 500 / 空数据 | `fs` 写盘失败 | 走路线 B 换 KV/D1，或接受只读降级 |
| `dist` 为空 | build command 没带 `--preset cloudflare_pages` | 用上面给出的完整命令 |
| 首次构建 pnpm 版本不符 | CF 默认 pnpm 5 | 设 `PNPM_VERSION=9` |
| 定时任务不执行 | Workers 无进程内定时器 | 用 cron triggers 或 GH Actions 打接口 |