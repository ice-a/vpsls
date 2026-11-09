# 18 家厂商联盟（aff）申请指南

> 调研时间：2026-11-09，来源均为官方页面（附 URL）。**填链接的位置只有一个：[shared/aff.ts](shared/aff.ts)**。
> 拿到链接后填进 `PROVIDER_AFF`（单厂商）或 `DEFAULT_REF`（全局兜底），重启生效。
> 「社区口径」= 非官方披露，以你登录后台看到的为准。

## A. 自助注册型（最快，注册→后台点一下就出链接）

| 厂商 | 入口 | 奖励 | 申请步骤 |
| --- | --- | --- | --- |
| **RackNerd** | https://www.racknerd.com/affiliates | 循环返佣 recurring，注册 30 天可提现，PayPal 或余额；比例官方未公示（社区口径最高 15%） | 注册 my.racknerd.com → 客户区 Affiliates → 自助激活取链接 |
| **Vultr** | https://www.vultr.com/company/referral-program/ | 可提现推荐奖金，金额登录后显示（社区口径 $25–$100/推荐） | 登录 Vultr → Referral Program 区生成唯一链接 |
| **DigitalOcean** | https://www.digitalocean.com/referral-program | 被推荐人首笔消费满 $25 → 你得 $25 credit（仅余额） | 登录直接领链接，无表单无审核 |
| **Linode** | https://www.linode.com/referral-program/ | 被邀人得 $100/60 天 credit；其消费满 $25 且活跃 90 天后你得 $25 credit，无数量上限 | 先实付满 $25 激活资格 → Cloud Manager → My Profile → Referrals 复制链接 |
| **搬瓦工 Bandwagon** | https://bwh81.net/clientarea.php?action=affiliates | CPS 社区口径约 22%，PayPal 或余额 | 注册即自动开通 → 客户区 Affiliates 取 `aff.php?aff=你的ID` |
| **ZgoVPS** | https://clients.zgovps.com/index.php?/affiliates/ | **15% 每单**（官方明示） | 注册 clients.zgovps.com → Affiliates → Become an affiliate，即开 |
| **JustHost（俄区）** | 后台 + https://support.justhost.ru/ru-RU/support/solutions/articles/151000211327-партнерская-программа | 每次充值你得 5%（bonus 积分，1 分=$1，不可提现） | 免申请：`https://justhost.ru/?ref=你的数字ID` |
| **Bytevirt** | https://bytevirt.com/affiliates.php | WHMCS 联盟余额，比例登录后见 | 注册 → 后台 Affiliates 页激活取链接 |
| **WAP.AC** | https://wap.ac/affiliates.php | WHMCS 联盟余额，比例登录后见 | 注册 → 「用户推广」页激活 |
| **DediOne** | https://dedione.com/affiliates.php | WHMCS 联盟余额，比例登录后见 | 注册 → 登录后访问 affiliates.php 激活 |
| **CloudServer** | https://cloudserver.net/billing/affiliates.php（注意：官网是 **.net**，.com 是停放域名） | WHMCS 联盟余额，比例登录后见 | 在 cloudserver.net 注册 → billing 面板 → Affiliates 激活 |
| **VMISS** | app.vmiss.com 客户区导航「Affiliates」（页面对未登录/爬虫 403） | 不明，登录后见 | 注册登录 app.vmiss.com → 页脚 Affiliates 进面板 |

## B. 需要申请/审核或无标准计划

| 厂商 | 情况 | 怎么办 |
| --- | --- | --- |
| **Contabo** | 走 CJ（Commission Junction）联盟平台，CPS 固定佣金：VPS 4 核 €20 / 8 核 €55 / 18 核 €115，Plus €40–€170，VDS €40–€120，独服最高 €250（官方页明示） | 入口 https://contabo.com/en/affiliate-program/ → CJ 注册 publisher → 申请 Contabo 节目（需自有网站，人工审核约 1 周）→ 拿链接 |
| **Hetzner** | 入口在 Cloud Console https://console.hetzner.cloud/refer ；**状态存疑**：社区称正式 referral 计划 2026-06 起停发新链接（旧码有效至 2027-12），当前页面显示新客 €50 起始 credit 促销码 | 登录 console 访问 /refer 看你账户实际状态；有码先囤码 |
| **OVHcloud** | 无消费级官方返佣；只有机构向 https://partner.ovhcloud.com/en/ 或第三方平台（Awin 等，第三方口径 $3–$137/单） | 走 Partner 表单或 Awin 申请；短期可先用无参裸链 |
| **ColoCrossing** | 人工审核的 Partner 计划，Recurring commission 但比例未公布 | https://www.colocrossing.com/partner/ 底部表单提交，或打 1-800-518-9716 |
| **Dogyun（狗云）** | 未找到官方联盟/邀请返利计划 | 登录 console.dogyun.com 找「推广/邀请」；没有就开工单 https://ticket.dogyun.com 问 |
| **HostHatch** | 未找到官方计划 | 查客户后台邀请入口；没有就按 docs.hosthatch.com 联系方式邮件问 |

## 申请通用套路（3 步）

1. **先注册账号**——上面 12 家自助型都是注册完在客户后台找 `Affiliates / Referrals / 推广` 菜单，点激活即出专属链接。
2. **拿链接填进 [shared/aff.ts](shared/aff.ts)**——有 `?ref=`/`?aff=` 的填 `PROVIDER_AFF[slug]`；CJ 类（Contabo）把 CJ 给的完整跟踪链接整条填进去。
3. **验证**——`curl -I 你的域名/go/厂商slug`，看 `Location` 是不是你的链接；站内 `/stats` 页能看到这条出口被点了多少次。

## 建议优先级

- **马上有收益**：ZgoVPS（15% 明示）、搬瓦工（22% 口径、高客单）、RackNerd（recurring）、JustHost（5% 免申请）
- **量大再申**：Contabo CJ（审核一周，先备网站材料）
- **可先裸链**：Hetzner / OVH / Dogyun / HostHatch（计划不稳或没有，别等它们）
