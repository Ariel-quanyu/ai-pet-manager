# AI 宠物管家

面向中文宠物主人的微信小程序 MVP，使用 **Taro + React + TypeScript** 实现。当前版本聚焦“进入产品—授权/体验—创建首只宠物—查看宠物档案”的最小闭环，不接入后端。

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
