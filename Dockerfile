# syntax=docker/dockerfile:1
# 多阶段构建：构建阶段用完整 Node，运行阶段只留产物
# 目标：镜像小 + 运行内存低，适配 1核1G

# ---------- 构建阶段 ----------
FROM node:22-alpine AS builder
WORKDIR /app

# pnpm 走 corepack，不额外装 npm 包
RUN corepack enable && corepack prepare pnpm@9 --activate

# 先只拷依赖清单，利用 layer 缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 再拷源码构建
COPY . .
RUN pnpm build

# 只保留生产依赖（.output 已打包大部分，但 nitro 需要少量运行时依赖）
RUN pnpm prune --prod

# ---------- 运行阶段 ----------
FROM node:22-alpine AS runner
WORKDIR /app

# 时区设为北京时间（每日 04:00 检测按本地时区分日）
ENV TZ=Asia/Shanghai \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256" \
    PORT=3000 \
    SQLITE_PATH=/data/vpsls.db

RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 只拷产物与依赖
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 数据目录（挂卷持久化）
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

# 用非 root 运行
USER node

CMD ["node", ".output/server/index.mjs"]