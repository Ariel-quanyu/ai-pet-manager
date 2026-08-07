# AI 宠物管家

面向中文宠物主人的微信小程序 MVP，使用 **Taro + React + TypeScript** 实现。微信用户通过 Supabase Edge Function 完成身份验证；游客宠物数据仍只保存在本机。

## Phase 1 功能

- 启动页：品牌展示、协议确认、登录与跳过入口。
- 手机号授权页：保留微信 `getPhoneNumber` 接入点；当前以不采集手机号的体验模式落地。
- 首页：支持无宠物空状态与已有宠物状态。
- 添加宠物：必填与选填两步表单、校验、mock 本地持久化。
- 设计参考：`design/screenshots/` 内的墨刀验收截图。

AI、预约、门店、健康记录、真实身份与云端同步不在本阶段范围。详细的需求边界、用户流与架构决策见 [`docs/mvp-architecture.md`](docs/mvp-architecture.md)，长期产品需求见 [`docs/product-requirements.md`](docs/product-requirements.md)。

## 开发

要求 Node.js 18+ 与 npm。

```bash
npm install
npm run dev:weapp
```

使用微信开发者工具导入仓库根目录的 `project.config.json`，预览 `dist/`。项目默认使用游客 AppID，真实授权能力需替换为已配置的微信小程序 AppID，并在后端能力完成后才可用于生产。

### 微信登录与 Supabase 配置

前端构建仅使用以下公开变量（参见 `.env.example`）：

- `TARO_APP_SUPABASE_URL`
- `TARO_APP_SUPABASE_PUBLISHABLE_KEY`

Edge Function 读取 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`，以及 Supabase 托管运行时提供的
`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。后两项只用于服务端 Auth Admin/RPC，绝不能放进前端变量。
`wechat-login` 通过 Admin `generateLink` 生成不发送邮件的一次性 magic-link token hash，并立即在服务端
`verifyOtp`，最终只向客户端返回标准可刷新的 Supabase Session；不会自行签名 JWT。

部署前需**手动审查并应用** `supabase/migrations/20260807000000_wechat_identity_rpc.sql`。该 migration
只增加固定 `search_path` 的 `security definer` RPC，并只授权 `service_role`，用于访问未暴露的
`private.wechat_identities`；本仓库不会自动执行 migration。然后可由项目管理员手动执行（本 PR 不执行）：

```bash
npx supabase --version
npx supabase functions deploy --help
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push # 仅在审查 migration 后，由管理员决定执行
npx supabase secrets set WECHAT_APP_ID=... WECHAT_APP_SECRET=...
npx supabase functions deploy wechat-login
```

微信公众平台还需把 `https://<PROJECT_REF>.supabase.co` 加入 **request 合法域名**。部署前应在真实项目的
测试环境人工验证 Auth 的手机号唯一性策略、`profiles` trigger 和既有 `wechat_identities` 列约束与 migration 一致。

## 质量检查

```bash
npm run typecheck
npm test
npm run lint
npm run build:weapp
```

## 目录结构

```text
src/
├── adapters/       # 微信等平台能力适配（预留）
├── components/     # 跨功能复用组件
├── domain/         # 平台无关实体与规则
├── features/       # splash、auth、home、pet 页面切片
├── services/       # repository 契约与 mock 实现
├── store/          # 应用状态装配
├── styles/         # 全局样式与设计令牌
├── types/          # 公共类型（预留）
└── utils/          # 纯工具（预留）
```
