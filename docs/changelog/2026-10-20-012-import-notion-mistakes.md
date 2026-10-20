# 从 Notion「每日 PTE 总结」导入错题

日期：2026-10-20

来源：公开页面「每日 PTE 总结」（2026-10-13 ～ 10-19）。只导入打字类内容；RA、RS、SGD、DI 等口语/朗读题不导入。

| 类别         | 内容                                                                                                                            | 数量 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---- |
| FIB 固定搭配 | 10-19「固定搭配」：以搭配短语为题，`[ ]` 为正确答案，备注写当时选错的词                                                         | 8    |
| WFD 拼写     | 10-19 未满分的 8 句（#188、#293 满分不导）+ 10-13 错题原句 17 句                                                                | 25   |
| 错词词典     | 10-17 作文拼写错词 6 个（写作）、10-13 WFD 拼写错词 13 个、10-19 标注「背单词时加上」的 11 个（听力）；释义和音标取自本项目词典 | 30   |

没有导入：10-19 语法/词性/逻辑类题目（不是固定搭配）、阅读拖拽题里意思不明确的 authority earner、10-13「今日新词」（不是拼错的词）。

导入的 30 个单词当天到期，进入每日强制复习；FIB / WFD 只作为建议复习。

导入方式：`server/scripts/import-json.ts`，与 `/api/v1` 导入接口用同一套函数：

```bash
vercel env pull /tmp/prod.env --environment=production --scope zichen-zhangs-projects
npx tsx --env-file=/tmp/prod.env server/scripts/import-json.ts zichen data.json
rm /tmp/prod.env
```

`data.json` 格式：`{ fib: [{sentence, trans?, note?}], wfd: [{sentence, trans?, note?}], words: [{word, trans?, usphone?, ukphone?, source?, note?}] }`。以后也可以直接用 `docs/API.md` 里的 API 密钥方式导入。
