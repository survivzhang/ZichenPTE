# 导入单词时跳过错题集里已有的词

日期：2026-10-21

- `POST /api/v1/review-words` 和 `server/scripts/import-json.ts` 导入单词时，错题集里已经有的词直接跳过，不再被设成「现在到期」，复习进度和备注都不变。返回值从 `{created, updated}` 改为 `{created, skipped}`。
- FIB / WFD 本来就会跳过题库里已有的句子，现在三类导入的行为一致，重复导入同一天的 Notion 总结也不会打乱复习。
- 新增项目技能 `import-notion-pte`（`.claude/skills/`）：从 Notion「每日 PTE 总结」挑出没导入过的日期，按 012 的规则整理成 FIB / WFD / 错词，确认后导入生产库并记修改日志。
