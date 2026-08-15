<div align="center">
    <img src="https://img.022335.xyz/logo.png" width="96px" />
    <h1 align="center">Pixtale</h1>
    <p align="center"><strong>一个沉浸式瀑布流相册应用🎉</strong></p>
    <p align="center"><a href="README.md">English</a> | <a href="README_ZH.md">简体中文</a></p>
    <img alt="Next.js" src="https://img.shields.io/badge/next.js-16-white?labelColor=black&logo=nextdotjs&logoColor=white&style=flat-square">
    <img alt="Docker" src="https://img.shields.io/badge/docker-ready-2496ED?labelColor=black&logo=docker&logoColor=white&style=flat-square">
    <img alt="Vercel" src="https://img.shields.io/badge/vercel-online-55b467?labelColor=black&logo=vercel&style=flat-square">
    <img alt="AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue?labelColor=black&style=flat-square">
</div>

> [!NOTE]
> 本仓库是 [aslost/pixtale](https://github.com/aslost/pixtale) 的非官方修改版本。修改记录见 [MODIFICATIONS.md](MODIFICATIONS.md)，项目继续使用 AGPL-3.0-only 许可证。


## 项目定位

这个修改版把 Pixtale 改造成一个必须登录的共享相册。管理员创建成员账号并按“成员 + 相册”授权；没有查看权限的相册会完全隐藏。

推荐部署组合：Vercel + Turso + 私有 Cloudflare R2。照片通过应用鉴权读取，R2 桶不需要开放公共访问。

## 共享相册功能

- **相册级权限**：管理员可分别授予查看、上传、删除本人上传照片；支持搜索成员和批量设置。
- **共享照片视图**：普通成员只看到已授权相册，照片总览和收藏会自动过滤失效权限。
- **安全上传与删除**：上传绑定目标相册；普通成员只能从当前相册移除自己上传的照片；只有管理员能永久删除。
- **个人收藏**：每个账号拥有独立收藏状态。
- **空间评论**：评论标签固定在照片位置，可随缩放和旋转移动，也可一键隐藏。
- **管理员审计**：记录权限变更、成员/相册/照片/评论删除等关键操作。
- **图片处理**：保留瀑布流、缩略图、高清预览、EXIF 和响应式布局。

## 部署

完整步骤见 [Vercel + Turso + Cloudflare R2 部署指南](docs/DEPLOYMENT_ZH.md)。

最低必需环境变量：

```dotenv
TITLE=Pixtale Shared Album
JWT_SECRET=长随机字符串
ADMIN=管理员用户名
PASSWORD=管理员强密码
CRON_SECRET=另一个长随机字符串
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXT_PUBLIC_SOURCE_CODE_URL=https://github.com/你的账号/pixtale
```

部署完成后，在“系统 → 存储”中新建 S3 存储并填写 Cloudflare R2 的 bucket、endpoint、Access Key ID 和 Secret Access Key。

## 本地验证

项目要求 Node.js 20.9 或更高版本，推荐 Node 22。

```bash
npm ci
npm run test:shared
npm run build
```


## 技术栈

- **全栈框架：** [Next.js](https://nextjs.org/)

- **Web框架：** [Hono](https://hono.dev/)

- **ORM：** [Drizzle](https://orm.drizzle.team/)

- **数据库：** [SQLite](https://sqlite.org/) / [Turso](https://turso.tech/)

- **对象存储：** S3 兼容存储（推荐 Cloudflare R2）

- **UI组件：** [shadcn/ui](https://ui.shadcn.com/)

## 许可证

`Pixtale` 是基于 [AGPL-3.0](LICENSE) 许可证的开源软件。网络部署时必须向使用者提供当前部署版本对应的完整源代码；本修改版在账号菜单中提供“源代码”入口。


