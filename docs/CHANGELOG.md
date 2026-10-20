# 个人版修改日志

本仓库 fork 自 [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner)，改造成只给自己（和管理员分配的账号）使用的 PTE 备考工具。这里记录所有改动、做法和原因，以及部署、运维的关键信息。最新的在最上面。

## 部署与环境速查

| 项目       | 内容                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 代码       | GitHub `survivzhang/qwerty-learner`，`master` 推送即自动部署                                                              |
| 网站       | https://qwerty-learner-pi-plum.vercel.app （Vercel 个人空间 `zichen-zhangs-projects`，**不是** Coursebox 团队）           |
| 函数区域   | `syd1`（悉尼），见 `vercel.json`                                                                                          |
| 数据库     | Neon Postgres 免费版，资源名 `neon-aqua-compass`，区域悉尼；每次部署的构建命令先跑迁移（`yarn db:migrate && yarn build`） |
| 本地数据库 | Docker Postgres，端口 **55432**（5432/5433/5435/5436 被其他项目占用）                                                     |
| 发音       | Azure Speech 免费档（F0，`australiaeast`），声音 `en-GB-SoniaNeural`                                                      |
| 账号       | 管理员 `zichen`；其他账号在「用户管理」页创建                                                                             |

### Vercel 生产环境变量

| 变量                                        | 说明                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 等 | Neon 集成自动添加；迁移用 unpooled 连接                              |
| `BETTER_AUTH_SECRET`                        | 会话签名密钥（敏感，加密存储）                                       |
| `BETTER_AUTH_URL`                           | `https://qwerty-learner-pi-plum.vercel.app`                          |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`  | Azure 发音（敏感，加密存储；`vercel env pull` 拿不到值，这是正常的） |
| `AZURE_TTS_VOICE`（可选）                   | 默认 `en-GB-SoniaNeural`，可改成如 `en-AU-NatashaNeural`             |

Preview 环境目前没有 `BETTER_AUTH_SECRET`，只有用 `master` 以外的分支部署时才需要补。

### 常用命令

```bash
yarn dev                 # 本地：启动 Docker 数据库 + 迁移 + API(3001) + 前端(5173)
yarn admin:create        # 在本地数据库创建管理员（密码输入不显示）
yarn admin:create:prod   # 在线上数据库创建管理员（临时拉取线上变量，用完即删；会先打印目标数据库地址）
yarn db:generate         # 改了 server/db/schema.ts 后生成迁移文件
yarn db:migrate          # 应用迁移
yarn typecheck           # 前端 + 后端类型检查
```

添加 Vercel 环境变量时不要在命令后面写 `# 注释`：zsh 会把它当成参数传给 Vercel（曾因此报 `gitBranch can only be used with target=preview`）。

---

## 2026-10-20

### 默写规则固定、默认英音、切回窗口自动继续

- **默写不再看开关**：只有打对的字母显示；第一次打错后，只能按住 Tab 或鼠标悬停时看答案，松开就遮住，绝不会自动显示整个单词。之前的问题：打错后会按旧的"默写开关"处理，开关是关的就直接显示整词；而原项目在一章结束点「下一章节」「重复本章节」时会自动关掉默写，所以"有时候会显示文本"。
- 去掉工具栏的默写开关、结果页的「默写本章节」按钮和 Shift+Enter 快捷键（练习本身就是默写）。
- 提示是否解锁改为跟随每个单词自己的状态（`wordState.hasMadeInputWrong`），换词时不会沿用上一个词的提示。
- **默认英音**：发音和音标默认 `uk`；浏览器里之前存的美音设置一次性迁移为英音（`localStorage` 标记 `britishDefaultsApplied`），之后手动改什么就保持什么。
- **点屏幕暂停**：原因是窗口失焦（切到别的窗口/屏幕、截图）会暂停计时。现在失焦仍暂停，但**切回窗口自动继续**；如果是手动点 Pause 暂停的，切回来不会自动继续。

### 彻底移除 IndexedDB（`70c473a`）

- 统计页、词典卡片进度、章节统计改为读数据库：新增 `GET /api/stats/words`、`/api/stats/dicts`、`/api/stats/chapters`。
- 练习记录只写服务器；章节记录在最后一个单词记录保存成功后才写，保证顺序。
- 删除：旧的 IndexedDB 复习模式（被 FSRS 取代）、本地错题合并、设置里的「数据设置」（导出/导入本地数据）、原作者的捐赠弹窗（DonateCard）、旧的未使用 `src/pages/Gallery`。
- 卸载 `dexie`、`dexie-export-import`、`dexie-react-hooks`、`pako`。

### PTE 练习中错题：FIB 固定搭配、WFD 拼写（`4bf1d75`）

- PTE 首页分「词汇 | 练习中错题」；练习中错题包含 **FIB 固定搭配**、**WFD 拼写**、**错词词典**。
- **FIB**：显示整句，只拼 `[方括号]` 里的部分（可以是词组）。第一遍没有发音、没有释义、不能看答案；打错后才解锁。
- **WFD**：自动播放整句，整句默写，忽略大小写和标点。打错时只退回到当前这个词的开头（不整句清空）。长句自动换行。
- FIB / WFD 有各自的 FSRS 计划，只作为「建议今天复习」，**不进每日强制复习，也不锁学习**。错词词典（单词）仍在每日强制复习里。
- 复习卡增加 `type`（`word` / `fib` / `wfd`）和 `sentence` 字段，唯一约束改为 (用户, 类型, 内容)。
- 导入接口：`POST /api/v1/fib`（每句必须恰好一个 `[空]`）、`POST /api/v1/wfd`；`/api/review/due`、`/api/review/cards` 支持 `?type=`。
- 错题本增加「单词 / FIB / WFD」标签。
- **发音**：`GET /api/tts?text=` 调 Azure 神经语音；没配置时返回 503，前端自动改用浏览器英音（Mac 上是 Daniel）。
- **发音缓存**：服务器以 SHA-256(声音名 + 句子) 为主键存进 `tts_audio` 表，同一句只调用 Azure 一次，所有账号、设备共用；浏览器另有一年 HTTP 缓存和页面内缓存。线上验证：首次 1.73 秒（生成），第二次 0.44 秒（缓存），表里只一条。
- 本地错题合并只合并账号上线（2026-10-20）之前的记录，避免同一浏览器上别人的本地数据混进来（后来随 IndexedDB 一起移除）。

### FSRS 复习系统、PTE 首页导航、管理员导入 API（`cc44aba`、`d7b7dff`）

- **复习算法 FSRS**（`ts-fsrs`，FSRS v6）：只有错过的词进复习。学习时第一遍打错 → 生成复习卡；复习时第一遍打对 = Good，打错 = Again。关闭当天短间隔，错了的词明天出现，答对后间隔约 3 → 8 → 20 天递增，再错回到 1 天。
- **强制复习**：今天到期的单词复习没做完，不能学任何新章节（首页和练习页都会拦）。
- 记录方式从"错了几次"改为"第几遍、对还是错"，错题本显示「第 1 遍 ✗ · 第 2 遍 ✓ …」和下次复习时间。
- **PTE 跨词典跳过**：在其他 PTE 词典练过的词自动跳过；整章都被跳过时显示提示并算作完成。
- 顶部导航：PTE | 其他词典 | 错题本 | 统计。
- **管理员 API 密钥**：「用户管理」页生成（`qlk_` 开头，只显示一次，库里只存 SHA-256），可吊销；`/api/v1/users`、`/api/v1/review-words`。用法见 `docs/API.md`。
- 复习卡插入改为并发安全（唯一约束 + on conflict），避免同一个词同时写入时报 500。
- 修复：Vercel 用 ES5 目标检查函数代码，`[...new Set()]` 改为 `Array.from`。

### 首页推荐继续学习（`c5a7da0`）

- `/` 改为首页，练习页移到 `/practice`，点击才开始练习。
- 推荐上次的词典和章节；上次那章已完成（有章节记录）就推荐下一章；整本完成就推荐换词典。新增 `GET /api/progress?dict=`。
- 词典页、错题本、统计页的关闭按钮改为"返回上一页"。

### 去掉原作者统计追踪；PTE 优先的词典页；默认 PTE（`05b66a0`）

- 删除 Google Analytics、Mixpanel、Vercel Analytics（脚本、调用和依赖）。
- 词典页：PTE 在首页单独展示，其他分类折叠，点分类展开小类，点小类显示词典（标题如「国际考试 / TOEFL」）。
- 新账号默认词典改为 PTE 基础词汇。

### 部署到 Vercel（`a072b99`、`83d630b`、`75cf5b8`）

- 修复原项目 `vite.config.ts`：没有 `.git` 时读取提交号的 Promise 永不结束，构建会卡死。
- `.vercelignore` 防止本地 `.env` 被上传。
- 迁移走 Neon 的 unpooled 连接；Better Auth 的站点地址取自 Vercel 生产域名。
- `yarn admin:create:prod`：`vercel env run` 会先加载本地 `.env` 覆盖线上值，曾差点把线上管理员建到本地库，所以改为拉取到临时文件、只用该文件运行、用完删除。

### 当前词典和章节存到账号；Logo 回首页（`3aca361`）

- 新增 `user_preference` 表和 `GET/PUT /api/preferences`；登录后先加载再渲染，避免先闪 CET-4。
- 左上角 Logo 原本链到原作者网站，改为回到自己的首页。

### 登录、管理员、用户管理（`bfac02c`、`0ab1be3`、`50ae489`）

- 后端：Hono（`server/`，Vercel 上作为函数 `api/index.ts`），Drizzle ORM + Postgres。
- 登录：Better Auth 用户名 + 密码，会话一年、使用中每天自动续期；关闭公开注册；登录失败限流（每分钟 5 次）。
- 密码用 scrypt 加盐哈希存储（Better Auth 默认），不存明文。
- 管理员角色和「用户管理」页：创建用户、重置密码、删除用户（不能删自己）；`yarn admin:create` 创建第一个管理员（隐藏密码输入）。
- 项目改为 ESM（`"type": "module"`），旧的 CommonJS 配置改为 `.cjs`。

### 只保留英语（`6fb7008`）

- 删除日语、德语、哈萨克语、印尼语和编程词典（68 本及其数据文件）及语言切换标签，保留全部英语词典。
