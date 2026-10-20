# 彻底移除 IndexedDB（`70c473a`）

日期：2026-10-20

- 统计页、词典卡片进度、章节统计改为读数据库：新增 `GET /api/stats/words`、`/api/stats/dicts`、`/api/stats/chapters`。
- 练习记录只写服务器；章节记录在最后一个单词记录保存成功后才写，保证顺序。
- 删除：旧的 IndexedDB 复习模式（被 FSRS 取代）、本地错题合并、设置里的「数据设置」（导出/导入本地数据）、原作者的捐赠弹窗（DonateCard）、旧的未使用 `src/pages/Gallery`。
- 卸载 `dexie`、`dexie-export-import`、`dexie-react-hooks`、`pako`。
