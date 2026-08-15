# Vercel + Turso + Cloudflare R2 部署指南

这套部署用于“必须登录的共享相册”：Turso 保存账号、权限、评论和照片元数据，Cloudflare R2 保存原图、预览图和缩略图，Vercel 运行应用。

## 1. 准备服务

1. 在 Turso 创建数据库，并生成数据库访问 token。
2. 在 Cloudflare R2 创建私有 bucket，例如 `pixtale-photos`。
3. 为该 bucket 创建 Object Read & Write API token。权限尽量限制到单个 bucket。
4. Fork 本仓库到自己的公开 GitHub 仓库。AGPL 要求线上用户能访问当前部署版本的完整源代码。

不要打开 R2 的公共访问，也不要把任何 token、照片、数据库备份或 `.env` 提交到 Git。

## 2. 导入 Vercel

在 Vercel 新建项目并导入自己的 GitHub 仓库。Framework Preset 选择 Next.js，构建命令保持默认的 `npm run build`。

配置以下 Production、Preview 和 Development 环境变量：

| 变量 | 说明 |
| --- | --- |
| `TITLE` | 站点名称 |
| `JWT_SECRET` | 至少 32 字节的随机会话密钥 |
| `ADMIN` | 首次启动时创建的管理员用户名 |
| `PASSWORD` | 首次管理员密码，部署后应在应用内修改 |
| `CRON_SECRET` | Vercel Cron 调用回收站清理接口的密钥 |
| `TURSO_DATABASE_URL` | Turso 的 `libsql://` 地址 |
| `TURSO_AUTH_TOKEN` | Turso 数据库 token |
| `NEXT_PUBLIC_SOURCE_CODE_URL` | 当前公开 GitHub 仓库或发布 tag 地址 |

Vercel 构建完成后会自动执行版本化迁移并创建尚不存在的管理员。修改 `ADMIN` 或 `PASSWORD` 不会覆盖已经存在的账号。

## 3. 配置 Cloudflare R2

首次登录后进入“系统 → 存储 → 新增”：

| 字段 | 填写内容 |
| --- | --- |
| 类型 | 对象存储 |
| Bucket | R2 bucket 名称 |
| Region | `auto` |
| Endpoint | `https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com` |
| Access Key | R2 API Token 的 Access Key ID |
| Secret Key | R2 API Token 的 Secret Access Key |
| 访问域名 | 留空 |

存储凭据由应用保存在 Turso 的 `storage` 表中。当前上游数据模型没有对该字段额外加密，因此必须使用最小权限、单 bucket 的 R2 token，并严格保护 Turso 访问权限。

## 4. 首次设置

1. 用管理员账号登录。
2. 新建普通成员账号。
3. 新建相册。
4. 从相册菜单打开“成员权限”，为成员设置查看、上传、删除本人照片。
5. 用普通成员账号验证无权限相册完全不可见。
6. 上传一张测试照片，确认 R2 中同时出现原图、预览图和缩略图。

## 5. 上线检查

- 未登录访问会跳转登录页。
- 普通成员无法访问未授权相册及其 `/media/*` 地址。
- R2 bucket 保持私有，未配置自定义公共域名。
- 管理员可查看“系统 → 操作记录”。
- 账号菜单中的“源代码”指向当前部署对应的公开 commit 或 tag。
- Vercel 环境变量中不存在演示账号变量，Git 历史中不存在密钥。
- `npm run test:shared` 和 `npm run build` 均通过。

## 6. 更新部署

从上游同步或继续开发前，先备份 Turso。推送新 commit 后，Vercel 会重新构建并执行尚未应用的迁移。不要手工删除 `schema_migration` 记录。
