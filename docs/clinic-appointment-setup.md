# 门诊预约后台配置

1. 在 Supabase 中开启 Anonymous Sign-Ins；正式接入微信手机号后，可将匿名用户升级或替换为正式账号。
2. 按顺序执行 `supabase/migrations/20260804000000_clinic_appointments.sql` 和 `supabase/migrations/20260805000000_add_clinic_locations.sql`。如果第一份已经执行，只运行第二份即可。
3. 在本地环境文件中配置 `TARO_APP_SUPABASE_URL` 和 `TARO_APP_SUPABASE_PUBLISHABLE_KEY`，不要使用 `service_role` 或 secret key。
4. 在腾讯位置服务创建 WebService Key，并在 `.env` 中配置 `TARO_APP_TENCENT_MAP_KEY`。
5. 在微信公众平台的服务器域名中，将 `https://<project-ref>.supabase.co` 和 `https://apis.map.qq.com` 加入 request 合法域名。
6. 在微信公众平台的隐私保护指引中声明“位置信息”用途，并确认 `getLocation` 接口审核配置完成。
7. 向 `clinics` 和 `clinic_slots` 添加真实门店与排班。`clinic_slots.weekday` 使用 0–6，分别代表周日到周六。

`.env` 示例：

```env
TARO_APP_SUPABASE_URL=https://<project-ref>.supabase.co
TARO_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
TARO_APP_TENCENT_MAP_KEY=你的腾讯位置服务WebServiceKey
```

每条 `clinics` 记录至少填写 `name`、`address`、`city`、`latitude` 和 `longitude`。经纬度应使用 GCJ-02 坐标系；`district`、`phone` 和 `image_url` 可选。只有同时填写经纬度后，页面才能展示距离并按距离排序。

仓库不会自动修改远程 Supabase。迁移执行并添加门店/排班后，预约页面才会显示真实可预约数据。
