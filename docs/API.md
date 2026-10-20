# Import API (`/api/v1`)

For scripts and agents (e.g. Claude) to add words to a user's review queue —
typically words gotten wrong while practicing PTE listening, speaking, reading
or writing elsewhere.

- **Base URL:** `https://qwerty-learner-pi-plum.vercel.app/api/v1` (local dev: `http://localhost:5173/api/v1`)
- **Auth:** `Authorization: Bearer <key>`. Keys are created by an admin on the 用户管理 page (API 密钥 section) and start with `qlk_`. A key acts with admin rights and stops working when revoked or when its creator is no longer an admin. Never commit a key.
- **Format:** JSON in, JSON out. Errors: `401` bad/missing key, `400` invalid body (`issues` explains why), `404` unknown username.

## List users

```bash
curl -s "$BASE/users" -H "Authorization: Bearer $QLK"
# {"users":[{"username":"zichen","role":"admin"}]}
```

## Add words to a user's review queue

`POST /review-words`

| field | type | |
|---|---|---|
| `username` | string | whose queue to add to |
| `words` | array, 1–1000 items | |
| `words[].word` | string | required; matching is case-insensitive |
| `words[].trans` | string or string[] | meaning, e.g. `"n. 旅行计划"` or `["n. 旅行计划"]` |
| `words[].usphone` / `ukphone` | string | phonetics without slashes, e.g. `aɪˈtɪnəreri` |
| `words[].source` | `listening` \| `speaking` \| `reading` \| `writing` \| `other` | default `other` |
| `words[].note` | string | where it came from, e.g. `"WFD 第12题"` |

```bash
curl -s -X POST "$BASE/review-words" \
  -H "Authorization: Bearer $QLK" -H 'Content-Type: application/json' \
  -d '{
    "username": "zichen",
    "words": [
      {"word": "itinerary", "trans": "n. 旅行计划", "source": "listening", "note": "WFD 第12题"},
      {"word": "deteriorate", "trans": "v. 恶化", "source": "reading", "note": "FIB 高频"}
    ]
  }'
# {"created":2,"updated":0}
```

What happens to each word:

- **New word:** a review card is created, due **now**, so it is part of today's (mandatory) review.
- **Word already in the queue:** it is moved up to be due now; its schedule is otherwise kept, and a note replaces the old one.
- Duplicates within one request are ignored.

From then on the word is scheduled by FSRS like any other mistake: typed right
on the first try in a review → the interval grows (≈3, 8, 20… days); wrong →
back to tomorrow.

## Read a user's review queue

```bash
curl -s "$BASE/review-words?username=zichen" -H "Authorization: Bearer $QLK"
```

Returns every card with `word`, `trans`, `source`, `note`, `due` and
`history` (each answer: `kind` = `learn` | `review` | `import`, `correct`, `at`).

## Planned

Importing whole dictionaries (e.g. PTE FIB high-frequency words, WFD dictation
lists) as new PTE word books will be added under `/api/v1` as well.
