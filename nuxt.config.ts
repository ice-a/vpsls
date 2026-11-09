import { defineNuxtConfig } from 'nuxt/config'

/**
 * 部署目标通过环境变量切换，默认本地 node-server：
 *   NITRO_PRESET=cloudflare_pages   → Cloudflare Pages（构建产物 dist/）
 *   NITRO_PRESET=node-server        → 本地/自有服务器（.output/server/index.mjs）
 */
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: true,

  css: [
    '@fontsource/chakra-petch/500.css',
    '@fontsource/chakra-petch/700.css',
    '@fontsource/ibm-plex-mono/400.css',
    '@fontsource/ibm-plex-mono/600.css',
    '~/assets/css/main.css'
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'VPS 报价单 · 全网 VPS 每日核价 · 人民币实时换算 · 机房测速选购',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: '全网 VPS 套餐按年付总价统一排序，美元标价实时汇率折算人民币；机房连通性每日 04:00 自动检测，支持按你的网络位置测速推荐机房区域。'
        },
        { name: 'theme-color', content: '#0b0f14' }
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },

  routeRules: {
    '/api/**': { cors: true, headers: { 'cache-control': 'no-store' } }
  },

  /**
   * mongodb 驱动的可选能力（AWS IAM 认证、zstd 压缩、Kerberos 等）用的是
   * 动态 require，打包器解析不到会直接构建失败。标记为 external：
   * 运行时若真用到才需要装，我们用标准 SCRAM 认证，永远不触发。
   */
  nitro: {
    rollupConfig: {
      external: [
        '@aws-sdk/credential-providers',
        '@mongodb-js/zstd',
        'gcp-metadata',
        'kerberos',
        'mongodb-client-encryption',
        'snappy',
        'socks'
      ]
    }
  },

  typescript: { strict: true }
})