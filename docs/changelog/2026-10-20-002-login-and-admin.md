# 登录、管理员、用户管理（`bfac02c`、`0ab1be3`、`50ae489`）

日期：2026-10-20

- 后端：Hono（`server/`，Vercel 上作为函数 `api/index.ts`），Drizzle ORM + Postgres。
- 登录：Better Auth 用户名 + 密码，会话一年、使用中每天自动续期；关闭公开注册；登录失败限流（每分钟 5 次）。
- 密码用 scrypt 加盐哈希存储（Better Auth 默认），不存明文。
- 管理员角色和「用户管理」页：创建用户、重置密码、删除用户（不能删自己）；`yarn admin:create` 创建第一个管理员（隐藏密码输入）。
- 项目改为 ESM（`"type": "module"`），旧的 CommonJS 配置改为 `.cjs`。
