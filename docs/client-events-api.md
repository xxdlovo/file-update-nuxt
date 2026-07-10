# 客户端事件上报 API

本文档说明客户端如何上报 Electron 应用和普通文件的运行、启动、下载、错误等事件。上报数据会进入独立的数据统计页面，不影响详情页原有的下载统计。

服务端会同时写入两类数据：

- 事件明细表：`app_client_events`、`file_client_events`，保留每次上报的流水记录。
- 客户汇总表：`app_clients`、`file_clients`，按目标对象 + `clientId` 聚合最后活跃时间、版本、平台、事件次数、启动次数、下载次数、错误次数等信息。

客户表不是替代事件表，而是面向统计页面和 Dashboard 的汇总索引：

- 事件表适合追踪最近事件、按天趋势、事件类型分布、版本分布等明细统计。
- 客户表适合展示活跃客户端、最后活跃时间、累计启动/下载/错误次数、当前版本和平台画像。
- 不传 `clientId` 时无法稳定识别同一个客户端，因此只写事件表，不写客户表。
- 客户端事件表和客户汇总表会保存请求真实 IP 到 `ip_address`，同时保留 `ip_hash` 兼容旧统计。

## 基础信息

- Electron 应用上报：`POST /api/public/apps/:appSlug/events`
- 普通文件上报：`POST /api/public/files/:fileSlug/events`
- Content-Type：`application/json`
- 鉴权：当前接口不要求后台登录，要求 `appSlug` 或 `fileSlug` 对应对象存在且启用。

## 事件类型建议

`eventType` 是必填字段，推荐使用以下值：

| 事件类型 | 说明 |
| --- | --- |
| `startup` | 客户端启动 |
| `download` | 下载行为 |
| `install` | 安装或更新安装完成 |
| `error` | 普通错误 |
| `crash` | 崩溃 |
| `exception` | 未捕获异常 |

也可以传入自定义事件类型，例如 `page_view`、`feature_used`、`update_applied`。

## Electron 应用事件上报

### 请求

```http
POST /api/public/apps/my-app/events
Content-Type: application/json
```

```json
{
  "eventType": "startup",
  "clientId": "device-001",
  "clientName": "Windows Desktop",
  "clientVersion": "1.2.4",
  "platform": "win32",
  "arch": "x64",
  "channel": "latest",
  "version": "1.2.4",
  "startupDurationMs": 1280,
  "durationMs": 1280,
  "bytes": 0,
  "source": "electron",
  "metadata": {
    "os": "Windows 11",
    "locale": "zh-CN"
  }
}
```

### 请求字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `eventType` | string | 是 | 事件类型 |
| `clientId` | string | 否 | 客户端或设备唯一标识，用于统计活跃客户端 |
| `clientName` | string | 否 | 客户端名称 |
| `clientVersion` | string | 否 | 客户端程序版本 |
| `platform` | string | 否 | 平台，例如 `win32`、`darwin`、`linux` |
| `arch` | string | 否 | 架构，例如 `x64`、`arm64` |
| `channel` | string | 否 | 发布通道；不传时使用应用默认通道 |
| `version` | string | 否 | 当前应用版本；服务端会尝试关联对应版本记录 |
| `currentVersion` | string | 否 | 当前应用版本；和 `version` 二选一即可 |
| `versionId` | number | 否 | 应用版本 ID；优先用于关联版本 |
| `startupDurationMs` | number | 否 | 启动耗时，单位毫秒 |
| `durationMs` | number | 否 | 事件耗时，单位毫秒 |
| `bytes` | number | 否 | 事件涉及的数据量，单位字节 |
| `source` | string | 否 | 来源，默认 `client` |
| `metadata` | object | 否 | 扩展数据，会以 JSON 字符串保存 |

### 响应

```json
{
  "ok": true,
  "eventId": 123,
  "appId": 1,
  "versionId": 10
}
```

## 普通文件事件上报

### 请求

```http
POST /api/public/files/resource-pack/events
Content-Type: application/json
```

```json
{
  "eventType": "download",
  "clientId": "client-001",
  "clientName": "Launcher",
  "clientVersion": "2.0.0",
  "platform": "win32",
  "arch": "x64",
  "channel": "stable",
  "environment": "prod",
  "version": "0.0.3",
  "durationMs": 5200,
  "bytes": 104857600,
  "source": "launcher",
  "metadata": {
    "fileName": "resource-pack.zip"
  }
}
```

### 请求字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `eventType` | string | 是 | 事件类型 |
| `clientId` | string | 否 | 客户端或设备唯一标识 |
| `clientName` | string | 否 | 客户端名称 |
| `clientVersion` | string | 否 | 客户端程序版本 |
| `platform` | string | 否 | 平台 |
| `arch` | string | 否 | 架构 |
| `channel` | string | 否 | 发布通道；不传时使用普通文件项目默认通道 |
| `environment` | string | 否 | 环境；默认 `prod` |
| `version` | string | 否 | 当前文件版本；服务端会尝试关联对应文件版本记录 |
| `currentVersion` | string | 否 | 当前文件版本；和 `version` 二选一即可 |
| `versionId` | number | 否 | 文件版本 ID；优先用于关联版本 |
| `startupDurationMs` | number | 否 | 启动耗时，单位毫秒 |
| `durationMs` | number | 否 | 事件耗时，单位毫秒 |
| `bytes` | number | 否 | 事件涉及的数据量，单位字节 |
| `source` | string | 否 | 来源，默认 `client` |
| `metadata` | object | 否 | 扩展数据，会以 JSON 字符串保存 |

### 响应

```json
{
  "ok": true,
  "eventId": 456,
  "fileProjectId": 5,
  "versionId": 30
}
```

## curl 示例

### Electron 启动事件

```bash
curl -X POST "https://你的域名/api/public/apps/my-app/events" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "startup",
    "clientId": "device-001",
    "clientVersion": "1.2.4",
    "platform": "win32",
    "arch": "x64",
    "channel": "latest",
    "version": "1.2.4",
    "startupDurationMs": 1280
  }'
```

### 普通文件下载事件

```bash
curl -X POST "https://你的域名/api/public/files/resource-pack/events" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "download",
    "clientId": "client-001",
    "clientVersion": "2.0.0",
    "channel": "stable",
    "environment": "prod",
    "version": "0.0.3",
    "durationMs": 5200,
    "bytes": 104857600
  }'
```

## 统计查看

上报成功后，可以在后台左侧菜单进入「数据统计」，选择 Electron 应用或普通文件项目查看：

- 事件总数
- 启动事件
- 下载事件
- 错误事件
- 活跃客户端
- 平台分布
- 版本排行
- 最近事件

## 注意事项

- `eventType` 不能为空，否则返回 `400 Event type is required`。
- `versionId` 优先级高于 `version/currentVersion`。
- 传入 `version/currentVersion` 时，服务端会按目标对象、通道、环境或平台信息尝试关联版本；找不到版本时仍会保存事件，只是 `versionId` 为 `null`。
- `clientId` 建议使用稳定匿名 ID，不建议直接上传用户手机号、邮箱等敏感信息。
- 不传 `clientId` 时只记录事件明细，不会更新客户汇总表。
- `metadata` 适合放少量调试和业务上下文，不建议放大体积日志。
