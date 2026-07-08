# Electron 更新后台全栈项目计划

## 1. 项目定位

本项目默认定位为 Electron 应用升级管理后台，用于管理多个 Electron 应用、上传全量包和增量包、发布更新版本，并向 Electron 客户端提供更新检测与下载接口。

同时，系统也提供普通文件版本发布能力：管理员可以创建文件项目、上传不同版本的普通文件、发布文件版本，并提供一套独立于 Electron 的检查更新接口。这类文件仍默认存储在阿里云 OSS 中，但不参与 Electron 应用、平台架构、`electron-updater` 元数据和客户端升级判断。

默认技术栈：

- 前端与服务端：最新版 Nuxt，使用 Nitro Server Routes 构建全栈 API。
- UI：Nuxt UI，构建后台管理界面。
- 授权认证：nuxt-auth-utils，使用服务端 session 管理管理员登录态。
- ORM：drizzle-orm。
- 数据库：本地 SQLite。
- 文件存储：默认阿里云 OSS，可预留本地存储和其他对象存储扩展点。
- 目标客户端：Electron 应用，可兼容 `electron-updater` 常见更新元数据格式，并支持自定义更新协议。

## 2. 核心目标

1. 默认围绕 Electron 应用升级进行管理。
2. 管理多个 Electron 应用。
3. 为每个应用管理多个平台与架构的更新文件，例如 Windows x64、macOS arm64、Linux x64。
4. 支持上传全量包和增量包。
5. 支持创建版本、保存草稿、发布更新、撤回发布和回滚发布。
6. 支持更新通道，例如 `latest`、`beta`、`alpha`、`stable`。
7. 提供 Electron 客户端可调用的更新检查 API。
8. 默认将 Electron 升级文件和普通文件上传到阿里云 OSS，并在数据库中保存文件元数据。
9. 支持普通文件版本发布，普通文件不绑定 Electron 应用、平台和架构，但需要支持版本、发布状态和检查更新接口。
10. 后台提供清晰的应用、版本、文件、发布状态和下载统计视图。

## 3. 功能模块

### 3.1 管理员认证

- 管理员登录、退出。
- 基于 `nuxt-auth-utils` 的 session 认证。
- 全局后台路由保护。
- 首次启动可通过环境变量或初始化命令创建管理员账户。
- 后续可扩展多用户、角色权限和操作审计。

### 3.2 应用管理

应用是 Electron 升级服务的一级资源。

每个应用包含：

- 应用名称。
- 应用标识，例如 `com.example.desktop`。
- 应用 slug，用于 URL 中识别应用。
- 默认更新通道。
- 是否启用。
- 备注信息。
- 创建时间、更新时间。

后台能力：

- 创建应用。
- 编辑应用。
- 启用或停用应用。
- 查看应用版本列表。
- 查看应用平台文件分布。

### 3.3 版本管理

每个应用可以创建多个版本。

版本包含：

- 版本号，例如 `1.2.0`。
- 构建号，例如 `10200`。
- 更新通道，例如 `latest`、`beta`。
- 发布状态：草稿、已发布、已撤回。
- 更新说明。
- 是否强制更新。
- 发布时间。
- 创建时间、更新时间。

后台能力：

- 创建版本草稿。
- 编辑版本说明。
- 上传或绑定升级文件。
- 发布版本。
- 撤回版本。
- 查看版本文件与下载情况。

### 3.4 升级文件上传与对象存储

升级文件用于 Electron 更新流程，必须绑定应用和版本。

支持的升级文件类型：

- 全量安装包，例如 `.exe`、`.dmg`、`.pkg`、`.AppImage`、`.zip`。
- 增量包，例如 `.blockmap`、差分压缩包或自定义 patch 包。
- 更新元数据文件，例如 `latest.yml`、`latest-mac.yml`，可自动生成或手动上传。

默认上传流程：

1. 后台选择应用、版本、平台、架构、包类型。
2. 服务端创建 OSS 上传策略或接收文件流。
3. 文件上传到阿里云 OSS。
4. 服务端校验文件大小、sha256、mime/type 或扩展名。
5. 数据库保存升级文件记录。
6. 版本发布时生成或刷新客户端更新元数据。

建议优先实现“服务端签名直传 OSS”：

- 前端向服务端请求临时上传凭证。
- 前端将文件直接上传到 OSS。
- 上传完成后调用服务端确认接口。
- 服务端查询或校验对象信息并入库。

这样可以避免 Nuxt 服务端承受大文件上传压力。

### 3.5 普通文件版本管理

普通文件版本发布是不参与 Electron 升级发布流程的第二套更新体系，适合管理文档、安装辅助文件、配置模板、数据包、资源包或其他需要被外部程序检查更新的文件。

普通文件特性：

- 可以不绑定 Electron 应用。
- 需要先创建文件项目，再为文件项目创建多个版本。
- 不需要平台、架构和 Electron 更新通道。
- 不参与 `electron-updater` 元数据生成。
- 拥有自己的发布状态、当前版本指针和检查更新接口。
- 可以使用 OSS 签名 URL 下载。

每个文件项目包含：

- 文件名称。
- 文件标识，例如 `client-config`、`resource-pack`。
- 文件 slug，用于 URL 中识别文件。
- 文件分类或目录。
- 描述信息。
- 是否启用。
- 创建时间、更新时间。

每个文件版本包含：

- 所属文件项目。
- 版本号，例如 `1.0.0`。
- 发布状态：草稿、已发布、已撤回。
- 文件名称。
- OSS object key。
- 文件大小。
- hash。
- mime type。
- 访问权限：私有、公开、签名下载。
- 更新说明。
- 下载次数。
- 发布时间。
- 创建时间、更新时间。

后台能力：

- 创建普通文件项目。
- 创建普通文件版本。
- 上传普通文件版本。
- 发布普通文件版本。
- 撤回普通文件版本。
- 查看普通文件项目和版本列表。
- 按名称、分类、文件类型搜索。
- 复制下载链接或生成临时签名链接。
- 编辑文件描述、分类和访问策略。
- 删除文件版本记录，并可选择是否同步删除 OSS 对象。

### 3.6 发布管理

Electron 发布是“某个应用 + 某个通道 + 某个平台/架构”当前可见版本的指针。

发布规则：

- 一个应用同一通道下可以有多个历史版本。
- 客户端默认获取当前通道最新已发布版本。
- 发布新版本时，旧版本保留为历史记录。
- 撤回版本时，客户端应回退到该通道上一个可用版本，或返回无更新。
- 支持按平台、架构发布，避免 Windows 包影响 macOS 客户端。
- 普通文件使用单独的文件版本发布流程，不进入 Electron 发布流程。

发布动作：

- 发布版本。
- 重新生成更新元数据。
- 撤回版本。
- 回滚到指定历史版本。
- 标记强制更新。

普通文件发布规则：

- 一个文件项目可以有多个历史版本。
- 一个文件项目同一时间只有一个当前已发布版本。
- 发布新文件版本时，旧版本保留为历史记录。
- 撤回文件版本时，检查更新接口应回退到上一个可用版本，或返回无更新。
- 普通文件发布不关心平台、架构和 Electron 更新通道。

### 3.7 Electron 客户端更新接口

建议提供两类接口。

#### 标准更新元数据接口

用于兼容 `electron-updater` 常见模式：

- `GET /updates/:appSlug/:platform/:channel/latest.yml`
- `GET /updates/:appSlug/:platform/:channel/latest-mac.yml`
- `GET /updates/:appSlug/:platform/:channel/latest-linux.yml`

返回内容可包含：

- version。
- files。
- path。
- sha512 或 sha256。
- releaseDate。
- releaseNotes。

#### 自定义检查接口

用于更灵活的客户端逻辑：

- `GET /api/public/apps/:appSlug/check-update`

查询参数：

- `version`：当前客户端版本。
- `platform`：`win32`、`darwin`、`linux`。
- `arch`：`x64`、`arm64`。
- `channel`：更新通道。
- `token`：可选，私有应用更新检查令牌，MVP 可预留，后续升级实现。

返回内容：

- 是否有更新。
- 最新版本。
- 是否强制更新。
- 更新说明。
- 全量包下载地址。
- 增量包下载地址。
- 文件 hash。
- 文件大小。
- 发布时间。

### 3.8 普通文件检查更新接口

普通文件提供独立于 Electron 的检查更新接口，用于让其他程序、脚本或服务检查某个文件项目是否有新版本。

- `GET /api/public/files/:fileSlug/check-update`

查询参数：

- `version`：当前本地文件版本。
- `channel`：可选，普通文件发布通道，例如 `stable`、`beta`。
- `env`：可选，目标环境，例如 `prod`、`test`、`dev`。
- `token`：可选，私有普通文件更新检查令牌，MVP 可预留，后续升级实现。

返回内容：

- 是否有更新。
- 最新版本。
- 文件名。
- 文件大小。
- 文件 hash。
- mime type。
- 更新说明。
- 发布时间。
- 下载地址。
- 下载地址过期时间。

普通文件也可以提供直接获取当前发布版本的接口：

- `GET /api/public/files/:fileSlug/latest`

### 3.9 CI/CD 上传与自动发布

CI/CD 上传接口用于让构建流水线自动创建版本、上传产物并按规则发布，适合 Electron 打包完成后自动推送升级包，也适合普通文件由外部系统自动发布。

MVP 可以只预留数据结构和接口规划，后续升级实现。

建议能力：

- 使用专用 API token 鉴权，不复用管理员 session。
- 创建 Electron 应用版本。
- 上传 Electron 升级文件。
- 创建普通文件版本。
- 上传普通文件。
- 可选择自动发布或仅保存草稿。
- 记录 CI/CD 操作审计。

建议接口：

- `POST /api/ci/apps/:appSlug/versions`
- `POST /api/ci/apps/:appSlug/versions/:version/files`
- `POST /api/ci/apps/:appSlug/versions/:version/publish`
- `POST /api/ci/files/:fileSlug/versions`
- `POST /api/ci/files/:fileSlug/versions/:version/upload`
- `POST /api/ci/files/:fileSlug/versions/:version/publish`

### 3.10 下载与安全

下载策略：

- 默认返回 OSS 签名下载 URL。
- 可配置公开读 Bucket，但生产环境建议使用短期签名 URL。
- 下载 URL 可设置有效期，例如 10 分钟。
- Electron 升级文件和普通文件共用底层下载签名能力，但上层权限、发布规则和检查更新接口分开处理。

安全措施：

- 后台 API 必须鉴权。
- 公共更新检查 API 只暴露必要信息。
- 普通文件默认不公开，除非管理员显式设置公开访问。
- 下载地址短期有效。
- 数据库保存文件 hash，客户端或下载方可校验完整性。
- 可选支持应用级 secret，用于私有更新通道。

### 3.11 统计与审计

第一阶段可以轻量实现：

- 升级文件下载次数。
- 普通文件下载次数。
- 最近下载时间。
- 版本发布时间。
- 管理员操作日志。

后续扩展：

- 按平台统计。
- 按版本统计。
- 按文件分类统计。
- 按 IP 或客户端标识统计。
- 发布操作审计。

## 4. 数据模型初稿

### 4.1 users

- `id`
- `email`
- `passwordHash`
- `name`
- `role`
- `createdAt`
- `updatedAt`

### 4.2 apps

- `id`
- `name`
- `slug`
- `bundleId`
- `defaultChannel`
- `secretHash`
- `enabled`
- `description`
- `createdAt`
- `updatedAt`

### 4.3 app_versions

- `id`
- `appId`
- `version`
- `versionNormalized`
- `buildNumber`
- `channel`
- `status`
- `forceUpdate`
- `releaseNotes`
- `publishedAt`
- `createdAt`
- `updatedAt`

### 4.4 update_files

升级文件表，仅用于 Electron 更新流程。

- `id`
- `appId`
- `versionId`
- `platform`
- `arch`
- `packageType`
- `fileName`
- `objectKey`
- `bucket`
- `endpoint`
- `size`
- `sha256`
- `sha512`
- `mimeType`
- `downloadCount`
- `createdAt`
- `updatedAt`

`packageType` 建议枚举：

- `full`
- `delta`
- `blockmap`
- `metadata`

### 4.5 file_projects

普通文件项目表，用于管理不参与 Electron 升级流程的文件更新对象。

- `id`
- `name`
- `slug`
- `category`
- `defaultChannel`
- `secretHash`
- `description`
- `enabled`
- `createdAt`
- `updatedAt`

### 4.6 file_versions

普通文件版本表，用于管理某个文件项目下的具体文件版本。

- `id`
- `fileProjectId`
- `version`
- `versionNormalized`
- `channel`
- `environment`
- `status`
- `releaseNotes`
- `fileName`
- `objectKey`
- `bucket`
- `endpoint`
- `size`
- `sha256`
- `mimeType`
- `visibility`
- `downloadCount`
- `createdBy`
- `publishedAt`
- `createdAt`
- `updatedAt`

`visibility` 建议枚举：

- `private`
- `signed`
- `public`

### 4.7 file_releases

普通文件发布指针表，用于记录每个文件项目当前对外可见的版本。

- `id`
- `fileProjectId`
- `fileVersionId`
- `channel`
- `environment`
- `active`
- `publishedAt`
- `createdAt`
- `updatedAt`

### 4.8 releases

- `id`
- `appId`
- `versionId`
- `channel`
- `platform`
- `arch`
- `active`
- `publishedAt`
- `createdAt`
- `updatedAt`

### 4.9 audit_logs

- `id`
- `userId`
- `action`
- `resourceType`
- `resourceId`
- `metadata`
- `createdAt`

## 5. API 规划

### 5.1 Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### 5.2 Apps

- `GET /api/apps`
- `POST /api/apps`
- `GET /api/apps/:id`
- `PATCH /api/apps/:id`
- `DELETE /api/apps/:id`

### 5.3 Versions

- `GET /api/apps/:appId/versions`
- `POST /api/apps/:appId/versions`
- `GET /api/versions/:id`
- `PATCH /api/versions/:id`
- `POST /api/versions/:id/publish`
- `POST /api/versions/:id/revoke`

### 5.4 Update Files

- `POST /api/update-files/upload-token`
- `POST /api/update-files/complete`
- `GET /api/versions/:versionId/files`
- `DELETE /api/update-files/:id`

### 5.5 Files

- `GET /api/files`
- `POST /api/files`
- `GET /api/files/:id`
- `PATCH /api/files/:id`
- `DELETE /api/files/:id`
- `GET /api/files/:id/versions`
- `POST /api/files/:id/versions`
- `POST /api/file-versions/upload-token`
- `POST /api/file-versions/complete`
- `GET /api/file-versions/:id`
- `PATCH /api/file-versions/:id`
- `DELETE /api/file-versions/:id`
- `POST /api/file-versions/:id/publish`
- `POST /api/file-versions/:id/revoke`
- `POST /api/file-versions/:id/download-url`

### 5.6 Public Updates

- `GET /api/public/apps/:appSlug/check-update`
- `GET /updates/:appSlug/:platform/:channel/latest.yml`
- `GET /updates/:appSlug/:platform/:channel/latest-mac.yml`
- `GET /updates/:appSlug/:platform/:channel/latest-linux.yml`
- `GET /api/public/update-files/:fileId/download`

### 5.7 Public File Updates

普通文件使用独立于 Electron 的公开检查更新接口：

- `GET /api/public/files/:fileSlug/check-update`
- `GET /api/public/files/:fileSlug/latest`
- `GET /api/public/file-versions/:fileVersionId/download`

## 6. 后台页面规划

### 6.1 登录页

- 邮箱。
- 密码。
- 登录状态提示。

### 6.2 Dashboard

- 应用数量。
- 已发布版本数量。
- 最近发布记录。
- 最近上传的升级文件。
- 最近发布的普通文件版本。
- 存储使用量。

### 6.3 应用列表

- 应用名称。
- slug。
- 默认通道。
- 启用状态。
- 最近版本。
- 操作入口。

### 6.4 应用详情

- 基本信息。
- 版本列表。
- 当前各通道发布状态。
- 升级文件上传入口。

### 6.5 版本详情

- 版本信息。
- 更新说明。
- 升级文件列表。
- 发布状态。
- 发布、撤回、回滚操作。

### 6.6 升级文件上传页

- 选择应用。
- 选择版本。
- 选择平台。
- 选择架构。
- 选择包类型。
- 上传文件。
- 显示 hash、大小、OSS 路径。

### 6.7 普通文件管理页

- 文件项目列表。
- 文件项目搜索。
- 文件分类筛选。
- 文件项目详情。
- 文件版本列表。
- 普通文件版本上传。
- 发布、撤回、回滚普通文件版本。
- 生成临时下载链接。
- 编辑文件项目和版本信息。
- 删除文件版本。

### 6.8 设置页

- OSS 配置检查。
- 默认下载 URL 有效期。
- 默认更新通道。
- 管理员账户设置。

## 7. 配置项规划

`.env` 建议包含：

```env
NUXT_SESSION_PASSWORD=

DATABASE_URL=file:./data/app.db

OSS_REGION=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=
OSS_ENDPOINT=
OSS_PUBLIC_BASE_URL=
OSS_UPLOAD_DIR=electron-updates
OSS_FILE_RELEASE_DIR=files

DOWNLOAD_URL_EXPIRES_SECONDS=600

UPDATE_TOKEN_REQUIRED=false
FILE_UPDATE_TOKEN_REQUIRED=false

CI_API_TOKEN=
```

生产环境建议：

- `NUXT_SESSION_PASSWORD` 使用高强度随机字符串。
- OSS AccessKey 使用最小权限。
- SQLite 数据库目录持久化并定期备份。
- 上传目录和数据库目录不要放在临时目录中。
- Electron 升级文件与普通文件版本使用不同 OSS 前缀，便于权限控制、清理和统计。
- 私有更新检查令牌、CI API token 只保存 hash，不在数据库中保存明文。

## 8. 技术实施路线

### 阶段 1：项目初始化

1. 创建 Nuxt 项目。
2. 安装 Nuxt UI、nuxt-auth-utils、drizzle-orm、SQLite 驱动、OSS SDK。
3. 配置 `nuxt.config.ts`。
4. 创建基础布局，确保根组件使用 `UApp`。
5. 建立环境变量与 runtime config。

### 阶段 2：数据库与认证

1. 定义 Drizzle schema。
2. 配置 SQLite 连接。
3. 建立 migration 流程。
4. 实现管理员初始化。
5. 实现登录、退出、session 获取。
6. 实现后台路由中间件。

### 阶段 3：应用与版本管理

1. 实现应用 CRUD API。
2. 实现版本 CRUD API。
3. 实现后台应用列表和应用详情页。
4. 实现版本详情页。
5. 增加基础表单验证。

### 阶段 4：升级文件上传

1. 封装 OSS 服务。
2. 实现升级文件上传凭证接口。
3. 实现升级文件上传完成确认接口。
4. 保存升级文件元数据。
5. 在后台实现升级文件上传界面。
6. 增加 hash 校验与文件类型限制。

### 阶段 5：发布与更新检查

1. 实现版本发布、撤回、回滚。
2. 实现 release 指针表。
3. 实现自定义更新检查 API。
4. 实现升级文件下载签名 URL API。
5. 生成 `electron-updater` 兼容元数据。
6. 实现元数据路由。

### 阶段 6：普通文件版本发布

1. 实现文件项目表、文件版本表和文件发布指针表。
2. 实现文件项目 CRUD API。
3. 实现普通文件版本上传凭证接口。
4. 实现普通文件版本上传完成确认接口。
5. 实现普通文件版本发布、撤回和回滚。
6. 实现普通文件检查更新 API。
7. 实现普通文件管理页面。
8. 实现普通文件临时下载链接。

### 阶段 7：CI/CD 接口预留

1. 设计 CI API token 表或配置项。
2. 预留 Electron 版本自动创建、文件上传、自动发布接口。
3. 预留普通文件版本自动创建、文件上传、自动发布接口。
4. MVP 可先完成接口规划和鉴权结构，实际上传发布能力后续升级实现。

### 阶段 8：体验与安全加固

1. 增加发布确认弹窗。
2. 增加文件删除确认弹窗。
3. 增加操作审计。
4. 增加升级文件和普通文件下载统计。
5. 增加 OSS 配置检测页。
6. 增加错误边界与 toast 提示。
7. 增加输入校验和 API 权限检查。
8. 增加文件删除策略选择：仅删除记录、删除 OSS 对象、保留历史。

### 阶段 9：测试与部署

1. 为关键服务添加单元测试。
2. 为发布流程添加集成测试。
3. 使用 Electron 测试客户端验证更新检查和下载。
4. 验证普通文件版本上传、发布、检查更新、签名下载和删除流程。
5. 验证 semver 版本比较规则。
6. 编写部署文档。
7. 编写备份和恢复文档。

## 9. 推荐目录结构

```txt
app/
  app.vue
  layouts/
    default.vue
    auth.vue
  middleware/
    auth.global.ts
  pages/
    login.vue
    dashboard.vue
    apps/
      index.vue
      [id].vue
    versions/
      [id].vue
    update-files/
      upload.vue
    files/
      index.vue
      [id].vue
      versions/
        [id].vue
    settings.vue
  components/
    app/
    versions/
    update-files/
    files/
server/
  api/
    auth/
    apps/
    versions/
    update-files/
    files/
    file-versions/
    public/
  routes/
    updates/
  utils/
    db.ts
    oss.ts
    auth.ts
    update-metadata.ts
shared/
  types/
  validation/
db/
  schema.ts
  migrations/
data/
  app.db
```

## 10. 关键设计决策

### 10.1 Electron 升级发布与普通文件发布分开建模

升级文件服务于 Electron 更新流程，需要绑定应用、版本、平台、架构和包类型。

普通文件服务于通用文件更新流程，需要绑定文件项目和文件版本，但不绑定 Electron 应用、平台、架构和更新通道。

两类文件都可以复用 OSS 上传、hash 计算、签名下载和下载统计能力，但数据库表、发布指针、业务权限、页面入口和检查更新 API 应分开，避免 Electron 发布逻辑和普通文件发布逻辑互相影响。

### 10.2 全量包与增量包

数据库不应该只把升级文件当作普通附件，而要明确记录：

- 目标平台。
- 目标架构。
- 包类型。
- hash。
- 文件大小。
- 所属版本。

这样客户端才能可靠判断是否可以使用增量包，否则回退到全量包。

### 10.3 发布不是简单修改版本状态

发布应单独建模为 `releases`，避免未来支持多通道、多平台、多架构时逻辑混乱。

版本表示“构建产物”，发布表示“客户端当前能看到什么”。

### 10.4 OSS 文件不要强依赖公开读

公开读 Bucket 简单，但生产环境不够稳妥。默认建议使用签名 URL，更新检查 API 返回短期下载地址，或返回一个本服务的下载跳转接口。

普通文件也默认走签名 URL，只有管理员明确设置为公开时才生成长期公开链接。

### 10.5 兼容 electron-updater，但保留自定义 API

`electron-updater` 生态成熟，但不同平台的元数据格式细节较多。项目应提供兼容元数据接口，同时保留自定义 JSON 检查接口，方便客户端实现更严格的版本策略。

### 10.6 版本比较规则

Electron 应用版本和普通文件版本都建议使用 semver 作为默认版本比较规则，避免使用字符串直接比较。

建议保存两个值：

- `version`：用户输入和页面展示使用，例如 `1.2.10`。
- `versionNormalized`：服务端比较和排序使用。

MVP 应至少实现稳定的 semver 比较；复杂版本如 `1.0.0-beta.1`、构建元数据和非标准版本号可以后续升级增强。

### 10.7 客户端鉴权策略

公开更新检查实现简单，但私有应用和私有普通文件需要预留鉴权能力。

建议策略：

- Electron 应用可配置 `secretHash`。
- 普通文件项目可配置 `secretHash`。
- 客户端检查更新时可携带 token。
- 服务端只保存 hash，不保存明文 token。
- MVP 可先允许关闭 token 校验，后续升级实现强制私有检查。

### 10.8 文件删除与历史保留策略

发布撤回不等于删除文件。删除动作需要明确区分：

- 仅删除数据库记录。
- 删除数据库记录并同步删除 OSS 对象。
- 保留历史版本，但取消当前发布。
- 标记为不可见，保留审计和下载记录。

MVP 建议优先实现“撤回发布”和“删除记录”，同步删除 OSS 对象需要二次确认并写入审计日志。

### 10.9 普通文件 channel 和 env

普通文件不需要 Electron 的平台和架构，但建议支持 `channel` 与 `environment`：

- `channel`：例如 `stable`、`beta`。
- `environment`：例如 `prod`、`test`、`dev`。

MVP 可以默认只使用 `stable + prod`，数据模型和 API 参数先预留，后续升级实现多环境、多通道发布。

### 10.10 CI/CD 自动发布

CI/CD 上传接口非常适合后续接入 Electron 打包流水线和外部文件发布流水线。

MVP 不强制实现完整 CI/CD 上传，但应预留：

- API token 鉴权。
- 自动创建版本的接口结构。
- 自动上传文件的接口结构。
- 自动发布或保存草稿的参数。
- 审计日志记录。

## 11. 首个可交付版本范围

MVP 建议包含：

- 管理员登录。
- 应用 CRUD。
- 版本 CRUD。
- OSS 升级文件上传。
- 发布版本。
- 自定义更新检查 API。
- 升级文件签名下载 URL。
- 普通文件项目 CRUD。
- 普通文件版本上传、发布、撤回、检查更新和签名下载。
- 基础 semver 版本比较。
- 基础操作审计。
- 基础后台页面。

MVP 暂缓：

- 多管理员角色权限。
- 复杂灰度发布。
- 客户端设备管理。
- 自动生成二进制差分包。
- 高级下载统计。
- 普通文件公开分享页。
- 强制私有 token 更新检查。
- 完整 CI/CD 自动上传和自动发布。
- 普通文件多 channel、多 env 管理界面。

## 12. 后续可扩展能力

- 灰度发布，例如按百分比、客户端 ID、版本范围发布。
- 私有通道访问密钥。
- Webhook 通知。
- CI/CD 上传接口。
- GitHub Actions 自动发布。
- 私有更新检查 token。
- 多对象存储适配，例如 S3、MinIO、腾讯云 COS、七牛云。
- 多租户。
- 自动清理旧版本文件。
- 普通文件批量上传、批量删除和生命周期管理。
- 客户端崩溃或启动统计。
