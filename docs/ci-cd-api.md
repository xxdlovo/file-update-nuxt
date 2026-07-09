# CI/CD API 文档

本文档用于 CI/CD 系统自动上传并发布 Electron 应用更新包和普通文件版本。

## 基础信息

- Base URL：`https://你的域名`
- 鉴权方式：所有 `/api/ci/*` 接口都需要请求头 `Authorization: Bearer <CI_API_TOKEN>`
- Token 配置：
  - 推荐生产环境配置 `CI_API_TOKEN_SHA256`，值为 Token 的 SHA-256 hex 摘要
  - 本地开发可以配置 `CI_API_TOKEN`
- Content-Type：业务接口使用 `application/json`

示例请求头：

```http
Authorization: Bearer ci_xxx
Content-Type: application/json
```

## 通用流程

1. CI 调用 `prepare` 接口，创建或复用草稿版本，并获取对象存储上传信息。
2. CI 根据返回的 `upload.method` 上传构建产物到对象存储。
3. CI 调用 `complete` 接口，提交已上传文件的元数据。
4. 如果 `complete` 请求体中传 `publish: true`，接口会在登记文件后自动发布。

上传方式说明：

- `upload.method` 为 `PUT` 时，直接把二进制文件 PUT 到 `upload.uploadUrl`，并带上 `upload.headers`。
- `upload.method` 为 `POST` 时，使用 `multipart/form-data` 提交到 `upload.uploadUrl`，表单字段包含 `upload.fields`，文件字段名为 `file`。

## 健康检查

### GET `/api/ci/ping`

用于验证 CI Token 是否可用。

请求体：无

响应体：

```json
{
  "ok": true,
  "scope": "ci"
}
```

## Electron 应用

### POST `/api/ci/apps/:appSlug/releases/prepare`

创建或复用 Electron 应用版本，并为一个或多个构建产物生成上传地址。

路径参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `appSlug` | string | 是 | Electron 应用 slug |

请求体：

```json
{
  "version": "1.2.3",
  "buildNumber": "1203",
  "channel": "latest",
  "forceUpdate": false,
  "releaseNotes": "修复已知问题",
  "storageConfigId": 1,
  "files": [
    {
      "platform": "win32",
      "arch": "x64",
      "packageType": "full",
      "fileName": "my-app-setup-1.2.3.exe",
      "contentType": "application/octet-stream"
    }
  ]
}
```

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | string | 是 | 版本号 |
| `buildNumber` | string | 否 | 构建号 |
| `channel` | string | 否 | 发布通道；不传时使用应用默认通道 |
| `forceUpdate` | boolean | 否 | 是否强制更新 |
| `releaseNotes` | string | 否 | 发布说明 |
| `storageConfigId` | number | 否 | 指定已验证的存储配置；不传时使用第一个可用配置或默认 OSS 配置 |
| `files` | array | 是 | 需要上传的产物列表，至少 1 个 |

`files` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | string | 是 | 支持 `win32`、`darwin`、`linux` |
| `arch` | string | 是 | 支持 `x64`、`arm64` |
| `packageType` | string | 是 | 支持 `full`、`delta`、`blockmap`、`metadata` |
| `fileName` | string | 是 | 原始文件名 |
| `contentType` | string | 否 | MIME 类型；默认 `application/octet-stream` |

响应体：

```json
{
  "app": {
    "id": 1,
    "name": "My App",
    "slug": "my-app",
    "defaultChannel": "latest",
    "enabled": true
  },
  "version": {
    "id": 10,
    "appId": 1,
    "version": "1.2.3",
    "versionNormalized": "1.2.3",
    "buildNumber": "1203",
    "channel": "latest",
    "status": "draft",
    "forceUpdate": false,
    "releaseNotes": "修复已知问题"
  },
  "uploadTasks": [
    {
      "platform": "win32",
      "arch": "x64",
      "packageType": "full",
      "fileName": "my-app-setup-1.2.3.exe",
      "contentType": "application/octet-stream",
      "upload": {
        "method": "PUT",
        "uploadUrl": "https://bucket.endpoint/object-key?signature=xxx",
        "objectKey": "electron-updates/my-app/1.2.3/win32/x64/full/xxx.exe",
        "storageConfigId": 1,
        "bucket": "bucket-name",
        "endpoint": "oss-cn-hangzhou.aliyuncs.com",
        "headers": {
          "Content-Type": "application/octet-stream"
        }
      }
    }
  ]
}
```

### POST `/api/ci/apps/:appSlug/releases/complete`

登记 Electron 应用已上传的文件元数据，并可选自动发布。

路径参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `appSlug` | string | 是 | Electron 应用 slug |

请求体：

```json
{
  "version": "1.2.3",
  "channel": "latest",
  "publish": true,
  "targets": [
    {
      "platform": "win32",
      "arch": "x64"
    }
  ],
  "files": [
    {
      "platform": "win32",
      "arch": "x64",
      "packageType": "full",
      "fileName": "my-app-setup-1.2.3.exe",
      "objectKey": "electron-updates/my-app/1.2.3/win32/x64/full/xxx.exe",
      "bucket": "bucket-name",
      "endpoint": "oss-cn-hangzhou.aliyuncs.com",
      "size": 104857600,
      "sha256": "sha256-hex",
      "sha512": "sha512-base64-or-hex",
      "mimeType": "application/octet-stream",
      "storageConfigId": 1
    }
  ]
}
```

也可以用 `versionId` 定位版本：

```json
{
  "versionId": 10,
  "publish": false,
  "files": [
    {
      "platform": "win32",
      "arch": "x64",
      "packageType": "full",
      "fileName": "my-app-setup-1.2.3.exe",
      "objectKey": "electron-updates/my-app/1.2.3/win32/x64/full/xxx.exe",
      "size": 104857600
    }
  ]
}
```

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `versionId` | number | 否 | 版本 ID；传了它就不需要用 `version` + `channel` 查找 |
| `version` | string | 条件必填 | 版本号；未传 `versionId` 时必填 |
| `channel` | string | 否 | 发布通道；未传 `versionId` 时参与查找，不传使用应用默认通道 |
| `publish` | boolean | 否 | 是否登记后立即发布 |
| `targets` | array | 否 | 发布目标；仅 `publish: true` 时使用，不传则按服务端发布逻辑处理 |
| `files` | array | 是 | 已上传文件列表，至少 1 个 |

`files` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | string | 是 | 支持 `win32`、`darwin`、`linux` |
| `arch` | string | 是 | 支持 `x64`、`arm64` |
| `packageType` | string | 是 | 支持 `full`、`delta`、`blockmap`、`metadata` |
| `fileName` | string | 是 | 原始文件名 |
| `objectKey` | string | 是 | `prepare` 响应中的 `upload.objectKey` |
| `bucket` | string | 否 | 对象存储 bucket；不传则使用存储配置中的 bucket |
| `endpoint` | string/null | 否 | 对象存储 endpoint；不传则使用存储配置中的 endpoint |
| `size` | number | 是 | 文件大小，单位 byte |
| `sha256` | string | 否 | 文件 SHA-256 |
| `sha512` | string | 否 | 文件 SHA-512 |
| `mimeType` | string | 否 | MIME 类型 |
| `storageConfigId` | number/null | 否 | 存储配置 ID |

响应体：

```json
{
  "app": {
    "id": 1,
    "name": "My App",
    "slug": "my-app"
  },
  "version": {
    "id": 10,
    "appId": 1,
    "version": "1.2.3",
    "channel": "latest",
    "status": "draft"
  },
  "files": [
    {
      "id": 100,
      "appId": 1,
      "versionId": 10,
      "platform": "win32",
      "arch": "x64",
      "packageType": "full",
      "fileName": "my-app-setup-1.2.3.exe",
      "objectKey": "electron-updates/my-app/1.2.3/win32/x64/full/xxx.exe",
      "bucket": "bucket-name",
      "endpoint": "oss-cn-hangzhou.aliyuncs.com",
      "size": 104857600,
      "sha256": "sha256-hex",
      "sha512": "sha512-base64-or-hex",
      "mimeType": "application/octet-stream"
    }
  ],
  "published": {
    "version": {
      "id": 10,
      "version": "1.2.3",
      "channel": "latest"
    },
    "targets": [
      {
        "platform": "win32",
        "arch": "x64"
      }
    ]
  }
}
```

如果没有传 `publish: true`，`published` 为 `null`。

## 普通文件

### POST `/api/ci/files/:fileSlug/releases/prepare`

创建或复用普通文件版本，并生成上传地址。

路径参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `fileSlug` | string | 是 | 普通文件项目 slug |

请求体：

```json
{
  "version": "2026.07.09",
  "channel": "stable",
  "environment": "prod",
  "releaseNotes": "更新资源包",
  "visibility": "signed",
  "fileName": "resource-pack.zip",
  "contentType": "application/zip",
  "storageConfigId": 1
}
```

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | string | 是 | 版本号 |
| `channel` | string | 否 | 发布通道；不传时使用项目默认通道 |
| `environment` | string | 否 | 环境；默认 `prod` |
| `releaseNotes` | string | 否 | 发布说明 |
| `visibility` | string | 否 | 下载可见性，支持 `signed`、`public`；默认 `signed` |
| `fileName` | string | 是 | 原始文件名 |
| `contentType` | string | 否 | MIME 类型；默认 `application/octet-stream` |
| `storageConfigId` | number | 否 | 指定已验证的存储配置 |

响应体：

```json
{
  "project": {
    "id": 5,
    "name": "Resource Pack",
    "slug": "resource-pack",
    "defaultChannel": "stable",
    "enabled": true
  },
  "version": {
    "id": 30,
    "fileProjectId": 5,
    "version": "2026.07.09",
    "channel": "stable",
    "environment": "prod",
    "status": "draft",
    "visibility": "signed",
    "releaseNotes": "更新资源包"
  },
  "upload": {
    "method": "PUT",
    "uploadUrl": "https://bucket.endpoint/object-key?signature=xxx",
    "objectKey": "files/resource-pack/stable/prod/2026.07.09/xxx.zip",
    "storageConfigId": 1,
    "bucket": "bucket-name",
    "endpoint": "oss-cn-hangzhou.aliyuncs.com",
    "headers": {
      "Content-Type": "application/zip"
    }
  }
}
```

### POST `/api/ci/files/:fileSlug/releases/complete`

登记普通文件已上传的文件元数据，并可选自动发布。

路径参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `fileSlug` | string | 是 | 普通文件项目 slug |

请求体：

```json
{
  "version": "2026.07.09",
  "channel": "stable",
  "environment": "prod",
  "publish": true,
  "file": {
    "fileName": "resource-pack.zip",
    "objectKey": "files/resource-pack/stable/prod/2026.07.09/xxx.zip",
    "bucket": "bucket-name",
    "endpoint": "oss-cn-hangzhou.aliyuncs.com",
    "size": 52428800,
    "sha256": "sha256-hex",
    "mimeType": "application/zip",
    "storageConfigId": 1
  }
}
```

也可以用 `versionId` 定位版本：

```json
{
  "versionId": 30,
  "publish": false,
  "file": {
    "fileName": "resource-pack.zip",
    "objectKey": "files/resource-pack/stable/prod/2026.07.09/xxx.zip",
    "size": 52428800
  }
}
```

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `versionId` | number | 否 | 文件版本 ID；传了它就不需要用 `version` + `channel` + `environment` 查找 |
| `version` | string | 条件必填 | 版本号；未传 `versionId` 时必填 |
| `channel` | string | 否 | 发布通道；未传 `versionId` 时参与查找，不传使用项目默认通道 |
| `environment` | string | 否 | 环境；未传 `versionId` 时参与查找，默认 `prod` |
| `publish` | boolean | 否 | 是否登记后立即发布 |
| `file` | object | 是 | 已上传文件信息 |

`file` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `fileName` | string | 是 | 原始文件名 |
| `objectKey` | string | 是 | `prepare` 响应中的 `upload.objectKey` |
| `bucket` | string | 否 | 对象存储 bucket；不传则使用存储配置中的 bucket |
| `endpoint` | string/null | 否 | 对象存储 endpoint；不传则使用存储配置中的 endpoint |
| `size` | number | 是 | 文件大小，单位 byte |
| `sha256` | string | 否 | 文件 SHA-256 |
| `mimeType` | string | 否 | MIME 类型 |
| `storageConfigId` | number/null | 否 | 存储配置 ID |

响应体：

```json
{
  "project": {
    "id": 5,
    "name": "Resource Pack",
    "slug": "resource-pack"
  },
  "version": {
    "id": 30,
    "fileProjectId": 5,
    "version": "2026.07.09",
    "channel": "stable",
    "environment": "prod",
    "status": "draft",
    "fileName": "resource-pack.zip",
    "objectKey": "files/resource-pack/stable/prod/2026.07.09/xxx.zip",
    "bucket": "bucket-name",
    "endpoint": "oss-cn-hangzhou.aliyuncs.com",
    "size": 52428800,
    "sha256": "sha256-hex",
    "mimeType": "application/zip",
    "visibility": "signed"
  },
  "published": {
    "id": 30,
    "fileProjectId": 5,
    "version": "2026.07.09",
    "channel": "stable",
    "environment": "prod",
    "status": "published",
    "fileName": "resource-pack.zip"
  }
}
```

如果没有传 `publish: true`，`published` 为 `null`。

## 直接上传示例

### PUT 上传

适用于阿里云 OSS、腾讯云 COS、AWS S3、又拍云 USS 等返回 `method: "PUT"` 的存储。

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@dist/my-app-setup-1.2.3.exe"
```

### POST 表单上传

适用于七牛 Kodo 等返回 `method: "POST"` 且包含 `fields` 的存储。

```bash
curl -X POST "$UPLOAD_URL" \
  -F "token=$TOKEN" \
  -F "key=$OBJECT_KEY" \
  -F "file=@dist/resource-pack.zip"
```

## 完整调用示例

### Electron 应用

```bash
curl -X POST "https://你的域名/api/ci/apps/my-app/releases/prepare" \
  -H "Authorization: Bearer $CI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.2.3",
    "channel": "latest",
    "files": [
      {
        "platform": "win32",
        "arch": "x64",
        "packageType": "full",
        "fileName": "my-app-setup-1.2.3.exe"
      }
    ]
  }'
```

```bash
curl -X POST "https://你的域名/api/ci/apps/my-app/releases/complete" \
  -H "Authorization: Bearer $CI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.2.3",
    "channel": "latest",
    "publish": true,
    "files": [
      {
        "platform": "win32",
        "arch": "x64",
        "packageType": "full",
        "fileName": "my-app-setup-1.2.3.exe",
        "objectKey": "prepare 返回的 objectKey",
        "size": 104857600
      }
    ]
  }'
```

### 普通文件

```bash
curl -X POST "https://你的域名/api/ci/files/resource-pack/releases/prepare" \
  -H "Authorization: Bearer $CI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2026.07.09",
    "channel": "stable",
    "environment": "prod",
    "fileName": "resource-pack.zip",
    "contentType": "application/zip"
  }'
```

```bash
curl -X POST "https://你的域名/api/ci/files/resource-pack/releases/complete" \
  -H "Authorization: Bearer $CI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2026.07.09",
    "channel": "stable",
    "environment": "prod",
    "publish": true,
    "file": {
      "fileName": "resource-pack.zip",
      "objectKey": "prepare 返回的 objectKey",
      "size": 52428800
    }
  }'
```

## 常见错误响应

错误响应由 Nuxt/H3 返回，常见格式如下：

```json
{
  "statusCode": 401,
  "statusMessage": "Invalid CI API token",
  "message": "Invalid CI API token"
}
```

常见状态码：

| 状态码 | 说明 |
| --- | --- |
| `400` | 请求体缺少必填字段，或 `platform`、`arch`、`packageType`、`visibility` 等枚举值非法 |
| `401` | 缺少 `Authorization` 请求头，或 Token 无效 |
| `404` | 应用、普通文件项目、版本或存储配置不存在 |
| `500` | 默认对象存储未配置，或服务端内部错误 |
| `503` | CI API Token 未配置 |

## 注意事项

- `prepare` 会创建或复用草稿版本；同一个 slug、版本号、通道会命中同一版本记录。
- Electron 应用可以在一次 `prepare` 和 `complete` 中处理多个平台产物。
- 普通文件一次版本只登记一个文件。
- `complete` 中的 `objectKey` 应使用 `prepare` 响应里的值，避免登记到错误对象。
- 使用 `publish: true` 时，接口会写入发布指针；不传或传 `false` 时只登记文件元数据。
- 所有 CI 操作都会写入审计日志。
