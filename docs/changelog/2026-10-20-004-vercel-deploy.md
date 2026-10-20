# 部署到 Vercel（`a072b99`、`83d630b`、`75cf5b8`）

日期：2026-10-20

- 修复原项目 `vite.config.ts`：没有 `.git` 时读取提交号的 Promise 永不结束，构建会卡死。
- `.vercelignore` 防止本地 `.env` 被上传。
- 迁移走 Neon 的 unpooled 连接；Better Auth 的站点地址取自 Vercel 生产域名。
- `yarn admin:create:prod`：`vercel env run` 会先加载本地 `.env` 覆盖线上值，曾差点把线上管理员建到本地库，所以改为拉取到临时文件、只用该文件运行、用完删除。
