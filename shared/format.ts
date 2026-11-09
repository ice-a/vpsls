import type { BillingCycle, BillingTerm } from './types'

/** 计费周期 → 中文标签 */
export function cycleLabel(c: BillingCycle): BillingTerm {
  return c === 'monthly' ? '月付' : c === 'quarterly' ? '季付' : c === 'semiannual' ? '半年付' : '年付'
}
