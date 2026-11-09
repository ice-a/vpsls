# 部署到 1核1G 服务器（Docker Compose）

纯自建部署：**Node 内置 SQLite**（零外部数据库）、**Docker Compose 一条命令启动**、**资源限制写死**。

## 一、资源实测（本机实跑，非估算）

| 指标 | 数值 |
| --- | --- |
| 启动后内存 RSS | **86 MB** |
| 20 并发 × 20 轮压测后 RSS | **261 MB** |
| 压测后私有内存 | 271 MB |
| CPU 累计（400 次请求） | 6.7 s |
| `node:sqlite` 数据库体积 | **4 KB**（4 条记录） |
| 依赖数量 | Nuxt + Vue，**无任何数据库驱动** |

1核1G 机型：系统 ~250MB + 容器限额 400MB = **安全余量充足**。容器内存硬上限设为 **400M**，超了只会 GC 不会拖死整机。

## 二、部署三步

```bash
# 1. 拉代码
git clone https://github.com/ice-a/vpsls.git
cd vpsls

# 2. 配置（可选，不改也能跑）
cp .env.example .env
#   编辑 .env：APP_PORT=3000、CRON_SECRET=你的随机串

# 3. 构建并启动
docker compose up -d --build
```

访问 `http://服务器IP:3000`。

首次构建约 3-5 分钟（要装依赖 + 构建 Nuxt）。之后更新：

```bash
git pull && docker compose up -d --build
```

## 三、数据持久化

- SQLite 数据库落在 Docker 卷 `vpsls-data` → 容器内 `/data/vpsls.db`
- 重建容器、升级镜像**数据不丢**
- 备份：`docker compose exec app cp /data/vpsls.db /data/backup-$(date +%F).db`
- 导出到宿主机：`docker cp vpsls:/data/vpsls.db ./backup.db`

表结构（单表）：

```sql
CREATE TABLE documents (
  key        TEXT PRIMARY KEY,   -- state.json / rates.json / official/plans.json ...
  data       TEXT NOT NULL,      -- 整份 JSON
  updated_at TEXT NOT NULL
);
```

查看内容：

```bash
docker compose exec app node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/data/vpsls.db');
console.log(db.prepare('SELECT key,updated_at FROM documents').all());
"
```

## 四、每日任务

容器内**自带定时器**（进程存活即生效）：每天 **04:00（北京时间）** 自动跑检测 + 官方套餐抓取。

如需外部兜底或手动触发：

```bash
curl -X POST "http://服务器IP:3000/api/cron?key=你的CRON_SECRET"
```

服务器 crontab 兜底（可选）：

```bash
0 4 * * * curl -fsS -X POST "http://127.0.0.1:3000/api/cron?key=你的CRON_SECRET"
```

## 五、验收清单

```bash
BASE=http://服务器IP:3000

curl -s $BASE/api/storage
# {"backend":"sqlite","path":"/data/vpsls.db","rows":4,"driver":"node:sqlite","node":"v22.x"}

curl -s -X POST "$BASE/api/cron?key=你的密钥"
# {"ok":true,"storage":{"backend":"sqlite","rows":4},"check":{"up":18,...},"errors":[]}

curl -s $BASE/api/status          # lastRun 有 finishedAt
curl -s "$BASE/api/offers?window=180" | head -c 120   # 含 perYear
curl -s -o /dev/null -w "%{http_code}\n" $BASE/       # 200
```

## 六、常用运维

```bash
docker compose logs -f app          # 看日志
docker compose stats                # 看实时资源占用
docker compose restart app          # 重启
docker compose down                 # 停止（数据卷保留）
docker compose down -v              # 停止并删数据（慎用）
```

## 七、反向代理（可选）

如果机器上有 Caddy/Nginx，转发到 `127.0.0.1:3000` 即可。Caddy 一行：

```
vps.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

## 八、已知边界

1. **Node 版本要求 ≥ 22.5**：`node:sqlite` 是内置模块，Dockerfile 用 `node:22-alpine` 已满足。自己跑源码需要 `node -v` ≥ 22.5。
2. **单实例**：SQLite WAL 支持并发读、单写。单容器单实例完全够用；不要水平扩到多容器共用一个 db 文件。
3. **首次请求**：SQLite 同步读取，**无异步空窗**（这点比之前的 Mongo 方案更干净）。
4. **官方套餐抓取**：6 个源里 bandwagon/colocrossing/bytevirt/dedione/wapac/ovh，国外 VPS 访问这些站点可能较慢，单次抓取约 10-30 秒，超时 20 秒会跳过该源并回退种子价。

## 九、如果还想再轻

当前已经是「Nuxt SSR + 内置 SQLite + 无外部依赖」的最小可用组合。若要进一步压到 ~80MB 常驻：

- 把 SSR 改成纯静态（`nitro.preset = 'static'`），API 用外部服务 → 失去服务端筛选/统计
- 或者重写为 Hono + Preact（工作量大，收益是内存从 261MB 降到 ~90MB）

**当前 400M 限额下 1核1G 完全跑得动，不建议为此重写。**