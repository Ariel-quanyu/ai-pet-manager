# 门诊预约后台配置

1. 在 Supabase 中开启 Anonymous Sign-Ins；正式接入微信手机号后，可将匿名用户升级或替换为正式账号。
2. 执行 `supabase/migrations/20260804000000_clinic_appointments.sql`。
3. 在本地环境文件中配置 `TARO_APP_SUPABASE_URL` 和 `TARO_APP_SUPABASE_PUBLISHABLE_KEY`，不要使用 `service_role` 或 secret key。
4. 在微信公众平台的服务器域名中，将 `https://<project-ref>.supabase.co` 加入 request 合法域名。
5. 向 `clinics` 和 `clinic_slots` 添加真实门店与排班。`clinic_slots.weekday` 使用 0–6，分别代表周日到周六。

仓库不会自动修改远程 Supabase。迁移执行并添加门店/排班后，预约页面才会显示真实可预约数据。
