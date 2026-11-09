import { getState } from '../utils/db'

/** 最近一次检测汇总（前端页脚/状态条轮询用） */
export default defineEventHandler(() => {
  return { lastRun: getState().lastRun }
})
