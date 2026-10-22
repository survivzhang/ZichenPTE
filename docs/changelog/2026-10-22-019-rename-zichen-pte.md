# 改名 Zichen-PTE；去掉原作者的链接和推广

日期：2026-10-22

- 页面标题、顶部 logo 旁的名字、登录页、「添加到主屏幕」的名字（manifest、iOS 标题）都从 Qwerty Learner 改成 **Zichen-PTE**。分享图片的文件名和网址也改了。
- 去掉原作者 Qwerty Learner 留下的内容：
  - 页脚的 GitHub、小红书、微信群、Twitter、捐赠、VS Code 插件、邮箱、中国大陆镜像链接和他的 ICP 备案号。页脚现在只显示「@ Zichen-PTE」和版本号。
  - 练完一章的结果页上的作者头像、捐赠、社群、GitHub 按钮（分享和导出保留）。
  - 词典页的「申请词典 / QwertyLearner.ai」推广框、友情链接页，以及没用到的推广弹窗、收藏提示和捐赠卡片，连同这些图片。
  - 练习页在手机上弹出的「暂未适配移动端」提示（018 已经支持手机了）。
- `package.json`、Tauri 配置、docker compose 服务名、Azure 语音请求的 User-Agent 改成 zichen-pte；GitHub Pages 构建路径改成 `/ZichenPTE`。
- 文档：代码仓库改为 `survivzhang/ZichenPTE`，网站和接口地址改为 `https://pte.zichen1998.com`，Vercel 项目名 `zichen_pte`；加了查线上日志的命令。
- 保留不改的：说明本项目 fork 自 RealKai42/qwerty-learner 的出处链接、原作者的 README，以及以前的修改日志。
