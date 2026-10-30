# 部署与环境速查

| 项目       | 内容                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 代码       | GitHub `survivzhang/ZichenPTE`，`master` 推送即自动部署                                                                                |
| 网站       | https://pte.zichen1998.com （Vercel 项目 `zichen_pte`，个人空间 `zichen-zhangs-projects`，**不是** Coursebox 团队；域名经 Cloudflare） |
| 函数区域   | `syd1`（悉尼），见 `vercel.json`                                                                                                       |
| 数据库     | Neon Postgres 免费版，资源名 `neon-aqua-compass`，区域悉尼；每次部署的构建命令先跑迁移（`yarn db:migrate && yarn build`）              |
| 本地数据库 | Docker Postgres，端口 **55432**（5432/5433/5435/5436 被其他项目占用）                                                                  |
| 发音       | Azure Speech 免费档（F0，`australiaeast`），声音 `en-GB-SoniaNeural`；跟读打分用同一个资源（发音评估，每月 5 小时识别额度）            |
| 账号       | 管理员 `zichen`；其他账号在「用户管理」页创建                                                                                          |

## Vercel 生产环境变量

| 变量                                        | 说明                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 等 | Neon 集成自动添加；迁移用 unpooled 连接                                                   |
| `BETTER_AUTH_SECRET`                        | 会话签名密钥（敏感，加密存储）                                                            |
| `BETTER_AUTH_URL`                           | 正式域名 `https://pte.zichen1998.com`（最初设的是旧的 vercel.app 地址，换域名后要一起改） |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`  | Azure 发音和跟读打分（敏感，加密存储；`vercel env pull` 拿不到值，这是正常的）            |
| `AZURE_TTS_VOICE`（可选）                   | 默认 `en-GB-SoniaNeural`，可改成如 `en-AU-NatashaNeural`                                  |
| `AZURE_TTS_VOICE_US`（可选）                | 跟读美音句子的原声，默认 `en-US-JennyNeural`                                              |

Preview 环境目前没有 `BETTER_AUTH_SECRET`，只有用 `master` 以外的分支部署时才需要补。

## 常用命令

```bash
yarn dev                 # 本地：启动 Docker 数据库 + 迁移 + API(3001) + 前端(5173)
yarn admin:create        # 在本地数据库创建管理员（密码输入不显示）
yarn admin:create:prod   # 在线上数据库创建管理员（临时拉取线上变量，用完即删；会先打印目标数据库地址）
vercel --scope zichen-zhangs-projects logs --project zichen_pte --no-branch --since 1h   # 线上请求日志（免费版只保留约 1 小时）
yarn db:generate         # 改了 server/db/schema.ts 后生成迁移文件
yarn db:migrate          # 应用迁移
yarn typecheck           # 前端 + 后端类型检查
```

添加 Vercel 环境变量时不要在命令后面写 `# 注释`：zsh 会把它当成参数传给 Vercel（曾因此报 `gitBranch can only be used with target=preview`）。
