# 开发任务清单

## 0. 开发约束

- 开发 Nuxt 相关功能时，优先参考 Nuxt 官方 llms 文档：https://nuxt.com/llms.txt
- 开发 Nuxt UI 相关界面时，优先参考 Nuxt UI 官方 llms 文档：https://ui.nuxt.com/llms.txt
- 前端与服务端使用最新版 Nuxt。
- UI 使用 Nuxt UI。
- 认证使用 `nuxt-auth-utils`。
- ORM 使用 `drizzle-orm`。
- 数据库使用本地 SQLite。
- 文件存储默认使用阿里云 OSS。
- 系统默认主线是 Electron 应用升级管理。
- 普通文件也需要版本发布能力，但使用独立于 Electron 的检查更新接口。
- MVP 阶段优先完成核心闭环，复杂灰度、强制私有 token、完整 CI/CD 自动发布等能力可后续升级实现。

## 1. 项目初始化

- [x] 创建 Nuxt 项目。
- [x] 安装 Nuxt UI。
- [x] 安装 `nuxt-auth-utils`。
- [x] 安装 `drizzle-orm` 与 SQLite 驱动。
- [x] 安装阿里云 OSS SDK。
- [x] 配置 `nuxt.config.ts`。
- [x] 创建 `app.vue` 并使用 `UApp` 包裹应用。
- [x] 创建基础目录结构。
- [x] 配置 `.env.example`。
- [x] 配置 runtime config。

## 2. 数据库与 Drizzle

- [x] 创建 Drizzle schema。
- [x] 配置 SQLite 数据库连接。
- [x] 建立 migration 流程。
- [x] 创建 `users` 表。
- [x] 创建 `apps` 表。
- [x] 创建 `app_versions` 表。
- [x] 创建 `update_files` 表。
- [x] 创建 `releases` 表。
- [x] 创建 `file_projects` 表。
- [x] 创建 `file_versions` 表。
- [x] 创建 `file_releases` 表。
- [x] 创建 `audit_logs` 表。
- [x] 为 Electron 应用和普通文件项目预留 `secretHash` 字段。
- [x] 为版本表预留 `versionNormalized` 字段。
- [x] 为普通文件版本和发布表预留 `channel`、`environment` 字段。

## 3. 认证与后台保护

- [x] 实现管理员初始化能力。
- [x] 实现登录 API。
- [x] 实现退出 API。
- [x] 实现 session 获取 API。
- [x] 使用 `nuxt-auth-utils` 管理服务端 session。
- [x] 实现后台路由鉴权中间件。
- [x] 实现登录页。
- [x] 实现默认后台布局。

## 4. 应用管理

- [x] 实现应用列表 API。
- [x] 实现创建应用 API。
- [x] 实现应用详情 API。
- [x] 实现编辑应用 API。
- [x] 实现删除或停用应用 API。
- [x] 实现应用列表页。
- [x] 实现应用详情页。
- [x] 支持应用名称、slug、bundleId、默认通道、启用状态、描述。

## 5. Electron 版本管理

- [x] 实现应用版本列表 API。
- [x] 实现创建版本 API。
- [x] 实现版本详情 API。
- [x] 实现编辑版本 API。
- [x] 实现版本撤回 API。
- [x] 实现版本详情页。
- [x] 支持版本号、构建号、通道、发布状态、强制更新、更新说明。
- [x] 实现基础 semver 版本比较。

## 6. Electron 升级文件上传

- [x] 封装 OSS 服务。
- [x] 实现 Electron 升级文件上传 token API。
- [x] 实现 Electron 升级文件上传完成确认 API。
- [x] 保存升级文件元数据。
- [x] 支持平台：`win32`、`darwin`、`linux`。
- [x] 支持架构：`x64`、`arm64`。
- [x] 支持包类型：`full`、`delta`、`blockmap`、`metadata`。
- [x] 保存文件大小、sha256、sha512、mimeType、objectKey。
- [x] 实现升级文件上传页面。

## 7. Electron 发布与检查更新

- [x] 实现 Electron 版本发布 API。
- [x] 实现 Electron 版本撤回 API。
- [x] 实现 Electron 版本回滚 API。
- [x] 实现 `releases` 当前发布指针。
- [x] 实现自定义检查更新接口：`GET /api/public/apps/:appSlug/check-update`。
- [x] 实现 Electron 升级文件签名下载 URL。
- [x] 实现 `electron-updater` 兼容元数据接口。
- [x] 实现 `GET /updates/:appSlug/:platform/:channel/latest.yml`。
- [x] 实现 `GET /updates/:appSlug/:platform/:channel/latest-mac.yml`。
- [x] 实现 `GET /updates/:appSlug/:platform/:channel/latest-linux.yml`。
- [ ] 预留私有应用更新 token 校验。

## 8. 普通文件项目管理

- [x] 实现普通文件项目列表 API。
- [x] 实现创建普通文件项目 API。
- [x] 实现普通文件项目详情 API。
- [x] 实现编辑普通文件项目 API。
- [x] 实现删除或停用普通文件项目 API。
- [x] 实现普通文件项目列表页。
- [x] 实现普通文件项目详情页。
- [x] 支持名称、slug、分类、默认通道、启用状态、描述。

## 9. 普通文件版本管理

- [x] 实现普通文件版本列表 API。
- [x] 实现创建普通文件版本 API。
- [x] 实现普通文件版本详情 API。
- [x] 实现编辑普通文件版本 API。
- [x] 实现普通文件版本上传 token API。
- [x] 实现普通文件版本上传完成确认 API。
- [x] 保存普通文件版本元数据。
- [x] 支持版本号、channel、environment、发布状态、更新说明。
- [x] MVP 默认使用 `stable + prod`。
- [x] 保存文件大小、sha256、mimeType、objectKey。
- [x] 实现普通文件版本上传页面。

## 10. 普通文件发布与检查更新

- [x] 实现普通文件版本发布 API。
- [x] 实现普通文件版本撤回 API。
- [x] 实现普通文件版本回滚 API。
- [x] 实现 `file_releases` 当前发布指针。
- [x] 实现普通文件检查更新接口：`GET /api/public/files/:fileSlug/check-update`。
- [x] 实现普通文件当前版本接口：`GET /api/public/files/:fileSlug/latest`。
- [x] 实现普通文件版本签名下载接口。
- [x] 支持查询参数 `version`。
- [x] 预留查询参数 `channel`、`env`、`token`。
- [ ] 预留私有普通文件更新 token 校验。

## 11. 后台页面

- [x] 实现 Dashboard。
- [x] Dashboard 显示应用数量。
- [x] Dashboard 显示已发布版本数量。
- [x] Dashboard 显示最近发布记录。
- [x] Dashboard 显示最近上传的升级文件。
- [x] Dashboard 显示最近发布的普通文件版本。
- [x] 实现应用列表页。
- [x] 实现应用详情页。
- [x] 实现 Electron 版本详情页。
- [x] 实现 Electron 升级文件上传页。
- [x] 实现普通文件项目列表页。
- [x] 实现普通文件项目详情页。
- [x] 实现普通文件版本详情页。
- [x] 实现设置页。
- [x] 设置页显示 OSS 配置检查结果。
- [x] 设置页显示下载 URL 有效期配置。
- [x] 新增存储配置菜单。
- [x] 实现阿里云 OSS 存储配置新增页面。
- [x] 实现阿里云 OSS 存储配置验证 API。
- [x] 上传 Electron 升级文件时支持选择已验证的存储配置。

## 12. OSS 与下载安全

- [x] Electron 升级文件和普通文件使用不同 OSS 前缀。
- [x] 实现短期签名下载 URL。
- [x] 支持下载 URL 过期时间配置。
- [x] 默认不依赖 OSS 公开读。
- [x] 保存升级文件使用的存储配置并用于后续签名下载。
- [x] 普通文件只有显式公开时才允许公开访问。
- [x] 下载接口记录下载次数。
- [x] 保存文件 hash 供客户端校验。

## 13. 文件删除与历史保留

- [x] 区分撤回发布和删除文件。
- [x] 删除文件记录前显示确认。
- [x] 预留同步删除 OSS 对象能力。
- [x] 同步删除 OSS 对象必须二次确认。
- [x] 删除、撤回、发布操作写入审计日志。
- [x] MVP 优先实现撤回发布和删除数据库记录。

## 14. 操作审计

- [x] 实现基础审计日志写入。
- [x] 记录登录操作。
- [x] 记录应用创建、编辑、停用。
- [x] 记录 Electron 版本创建、发布、撤回、回滚。
- [x] 记录升级文件上传、删除。
- [x] 记录普通文件项目创建、编辑、停用。
- [x] 记录普通文件版本上传、发布、撤回、回滚。
- [x] 记录文件删除动作。

## 15. CI/CD 预留

- [x] 预留 CI API token 配置。
- [x] 预留 CI API token hash 存储策略。
- [x] 规划 Electron 版本自动创建接口。
- [x] 规划 Electron 文件自动上传接口。
- [x] 规划 Electron 版本自动发布接口。
- [x] 规划普通文件版本自动创建接口。
- [x] 规划普通文件自动上传接口。
- [x] 规划普通文件版本自动发布接口。
- [x] MVP 可只完成接口规划和鉴权结构。
- [ ] 完整 CI/CD 自动上传和自动发布后续升级实现。

## 16. 测试与验证

- [ ] 验证登录和 session。
- [ ] 验证后台路由保护。
- [ ] 验证应用 CRUD。
- [ ] 验证 Electron 版本 CRUD。
- [ ] 验证 Electron 升级文件上传。
- [ ] 验证 Electron 发布、撤回、回滚。
- [ ] 验证 Electron 检查更新接口。
- [ ] 验证 `electron-updater` 元数据接口。
- [ ] 验证普通文件项目 CRUD。
- [ ] 验证普通文件版本上传。
- [ ] 验证普通文件发布、撤回、回滚。
- [ ] 验证普通文件检查更新接口。
- [ ] 验证签名下载 URL。
- [ ] 验证 semver 版本比较。
- [ ] 验证审计日志写入。

## 17. MVP 暂缓项

- [ ] 多管理员角色权限。
- [ ] 复杂灰度发布。
- [ ] 客户端设备管理。
- [ ] 自动生成二进制差分包。
- [ ] 高级下载统计。
- [x] 普通文件公开分享页。
- [ ] 强制私有 token 更新检查。
- [ ] 完整 CI/CD 自动上传和自动发布。
- [ ] 普通文件多 channel、多 env 管理界面。
- [ ] 多对象存储适配。
- [ ] 多租户。
