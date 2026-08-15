<div align="center">
    <img src="https://img.022335.xyz/logo.png" width="96px" />
    <h1 align="center">Pixtale</h1>
    <p align="center"><strong>An immersive masonry photo gallery 🎉</strong></p>
    <p align="center">English | <a href="README_ZH.md">简体中文</a></p>
    <img alt="Next.js" src="https://img.shields.io/badge/next.js-16-white?labelColor=black&logo=nextdotjs&logoColor=white&style=flat-square">
    <img alt="Docker" src="https://img.shields.io/badge/docker-ready-2496ED?labelColor=black&logo=docker&logoColor=white&style=flat-square">
    <img alt="Vercel" src="https://img.shields.io/badge/vercel-online-55b467?labelColor=black&logo=vercel&style=flat-square">
    <img alt="AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue?labelColor=black&style=flat-square">
</div>

> [!NOTE]
> This repository is an unofficial modified version of [aslost/pixtale](https://github.com/aslost/pixtale). See [MODIFICATIONS.md](MODIFICATIONS.md) for the change history. It remains licensed under AGPL-3.0-only.

## Purpose

This modified edition turns Pixtale into a login-only shared photo space. Administrators create member accounts and grant access per member and per album. Albums without view permission are completely hidden.

The recommended production stack is Vercel, Turso, and a private Cloudflare R2 bucket. Media is served through application authorization, so the bucket does not need public access.

## Shared Album Features

- Per-album view, upload, and delete-own permissions, with member search and batch controls.
- Permission-filtered albums, photo timeline, EXIF, and private per-user favorites.
- Uploads bound to an authorized target album, with object-storage compensation cleanup on failure.
- Member deletion removes only their own photo from the current album; admins control global trash and permanent deletion.
- Spatial photo comments that follow zoom and rotation, with a persistent hide/show preference.
- Admin activity log for permission changes and deletion events.

## Deployment

See the [Chinese Vercel + Turso + Cloudflare R2 guide](docs/DEPLOYMENT_ZH.md). Required environment variables are documented in [.env.example](.env.example).

Use Node.js 20.9 or newer; Node 22 is recommended:

```bash
npm ci
npm run test:shared
npm run build
```

## Tech Stack

- **Full-stack Framework:** [Next.js](https://nextjs.org/)

- **Web Framework:** [Hono](https://hono.dev/)

- **ORM:** [Drizzle](https://orm.drizzle.team/)

- **Database:** [SQLite](https://sqlite.org/) / [Turso](https://turso.tech/)

- **Object Storage:** S3-compatible storage (Cloudflare R2 recommended)

- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)

## License

`Pixtale` is open-source software licensed under the [AGPL-3.0](LICENSE). Network deployments must offer users the complete corresponding source for the deployed version. This edition exposes that link in the account menu.
