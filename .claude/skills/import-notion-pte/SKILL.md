---
name: import-notion-pte
description: 把 Notion「每日 PTE 总结」里还没导入的日期的错题（FIB 固定搭配、WFD 句子、错词）导入线上题库和每日复习。用户说「导入今天的错题」「同步 Notion」「每日导入」时使用。
---

# 每日从 Notion 导入错题

来源页面：「📝 每日 PTE 总结」 https://app.notion.com/p/PTE-3f8570cfc8a581b4bb96e3d8f067e23b
（在 PTE 8 炸 冲刺计划 下面）。只能用 **notion-pte** MCP 读（`mcp__notion-pte__notion-fetch`）。claude.ai Notion 连接器在另一个工作区，会返回 404。没有登录就先 `/mcp` 认证 notion-pte。

## 1. 找出没导入的日期

页面里每天是一个 h2 折叠块，标题像 `2026-10-20 · R&W FIB + WFD`，最新的在最上面。

已经导入过的日期写在 `docs/changelog/*import-notion*.md` 每条记录的「来源」行里。先 `grep -h 来源 docs/changelog/*import-notion*.md`，只处理比这些日期新的块。

数据库本身怎么去重：

- **FIB / WFD**：`practice_item` 上有唯一索引 (user, type, key)，重复的会被跳过（`skipped`），原来的导入日期和章节不变。
  - WFD 的 key 忽略大小写和标点。
  - FIB 的 key 只做了小写，所以同一个搭配换种写法（`with sb` / `with someone`）就会变成新题。FIB 统一写法：照抄 Notion 里的搭配短语，泛指用 `sb` / `sth`，句末不加标点。
- **错词**：错题集里已经有的词会被跳过（`skipped`），复习进度和 note 都不变。

## 2. 按规则挑内容

规则来自第一次导入（`docs/changelog/2026-10-20-012-import-notion-mistakes.md`）。只导入要打字的内容：

| 导入成  | 从哪里来                                                                                                                                                                                                | 写法                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fib`   | 当天错题里**被明确归为固定搭配**的那几题（看「固定搭配」小标题，或者「今天的发现」里点名的搭配）                                                                                                        | 用搭配短语做题，正确答案放进**唯一一个** `[ ]`，例如 `[abide] by a moral code`、`lose [connection] with sb`。`trans` 写中文意思，`note` 写 `选错：stand` |
| `wfd`   | WFD 表里**没拿满分**的句子（得分 x/x 的跳过）。没有分数、只列「错题原句」时整份都导                                                                                                                     | 原句照抄。`note` 写 `WFD #题号 6/13` 或 `WFD 10-13`                                                                                                      |
| `words` | 作文拼写错词（`source: writing`）、WFD 拼错/标注要背的词（`source: listening`）、标了「背单词时加上」的高频词。**只导真的听错或拼错的词**：高频词列表里那些在满分句子里、或者「失分原因」没提到的词不导 | 用正确拼写。`trans`、`usphone`、`ukphone` 从本项目词典查（见下面）。`note` 写来源，例如 `10-17 作文拼写：finacal`                                        |

**不导入**：

- RA、RS、SGD、DI、WE 结构这类口语、朗读和写作方法。
- 语法、词性、逻辑类的 FIB 错题，包括形近词和及物/不及物。它们不是搭配。
- 意思不明确的拖拽题。
- 「今日新词」（不是拼错的词）。
- 模板句。

拿不准的（例如一题算不算搭配）先列出来问用户，不要自己决定。

查词典：在仓库根目录跑 `node .claude/skills/import-notion-pte/lookup.mjs word1 word2 …`，每个词输出一行 JSON。注意：

- `missing` 的词（比如 re-enrollment）只填 `trans`，音标留空。
- 有些词典的 us/uk 音标是反的，导入前看一眼：英音有 ɒ、əʊ，美音有 ɑː（对应英音 ɒ）、oʊ 和词尾 r。
- 词组（office hours）不进 `words`。

## 3. 给用户确认

把三类内容按表格列出来，附上数量和每条的 note，等用户点头再导入。导入的是**生产库**。

## 4. 导入

把数据写到 scratchpad 里的 `data.json`，格式是 `{ fib: [{sentence, trans?, note?}], wfd: [...], words: [{word, trans?, usphone?, ukphone?, source?, note?}] }`：

```bash
vercel env pull /tmp/prod.env --environment=production --scope zichen-zhangs-projects
npx tsx --env-file=/tmp/prod.env server/scripts/import-json.ts zichen <scratchpad>/data.json
rm /tmp/prod.env
```

- 脚本会先打印数据库主机名，确认是 Neon 生产库。
- 脚本会校验每个 FIB 有且只有一个 `[ ]`。
- 输出 `fib / wfd / words {created, skipped}`。`skipped` 是已经在题库或错题集里的，属于正常情况。
- 不管成功还是失败，都要删掉 `/tmp/prod.env`。

## 5. 记录

按 CLAUDE.md 的约定加一条修改日志：

- 新建 `docs/changelog/YYYY-MM-DD-NNN-import-notion-mistakes.md`。NNN 接 `docs/CHANGELOG.md` 表里最大的序号。
- 在表格最上面加一行。

正文照 012 的格式写：

- **第一行写 `来源：YYYY-MM-DD, YYYY-MM-DD`**，这是下次判断哪些日期导过了的依据；
- 一张「类别 / 内容 / 数量」表；
- 「没有导入」的内容和理由；
- 脚本输出的数字。

然后提交，例如 `Import Notion PTE mistakes for 10-20`。
