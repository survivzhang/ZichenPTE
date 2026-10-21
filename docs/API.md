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

| field                         | type                                                           |                                                    |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `username`                    | string                                                         | whose queue to add to                              |
| `words`                       | array, 1–1000 items                                            |                                                    |
| `words[].word`                | string                                                         | required; matching is case-insensitive             |
| `words[].trans`               | string or string[]                                             | meaning, e.g. `"n. 旅行计划"` or `["n. 旅行计划"]` |
| `words[].usphone` / `ukphone` | string                                                         | phonetics without slashes, e.g. `aɪˈtɪnəreri`      |
| `words[].source`              | `listening` \| `speaking` \| `reading` \| `writing` \| `other` | default `other`                                    |
| `words[].note`                | string                                                         | where it came from, e.g. `"WFD 第12题"`            |

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
# {"created":2,"skipped":0}
```

What happens to each word:

- **New word:** a review card is created, due **now**, so it is part of today's (mandatory) review. (This is the only import that goes straight into the error set.)
- **Word already in the queue:** skipped (counted in `skipped`). Its schedule and note stay as they are, so importing the same word again never resets its review.
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

## FIB / WFD question bank

FIB collocations and WFD sentences go into the user's **question bank**, not
straight into the error set. On the PTE page the bank appears as two word-book
cards (FIB 固定搭配, WFD 拼写), split into chapters **by import date**: FIB 10
items per chapter, WFD 5. Practicing a chapter works like a word book: an item
typed wrong on the first try becomes a FIB / WFD error card with its own FSRS
schedule (suggested, never mandatory). Only `POST /review-words` (single words)
adds straight to the mandatory review.

### Add FIB collocations

`POST /fib` — each sentence has exactly **one** blank in `[square brackets]`;
the blank may be a phrase. Only the bracketed part is typed; the rest of the
sentence is shown. FIB stays silent with no hints until the first mistake.

```bash
curl -s -X POST "$BASE/fib" \
  -H "Authorization: Bearer $QLK" -H 'Content-Type: application/json' \
  -d '{
    "username": "zichen",
    "items": [
      {"sentence": "The results are consistent [with] previous studies.", "trans": "与……一致", "note": "RW FIB"},
      {"sentence": "This is, [in terms of] cost, the best option."}
    ]
  }'
# {"created":2,"skipped":0}
```

A sentence with no blank or more than one is rejected with `400`.

### Add WFD sentences

`POST /wfd` — the whole sentence is read out (Azure neural voice, cached) and
typed in full; case and punctuation are ignored.

```bash
curl -s -X POST "$BASE/wfd" \
  -H "Authorization: Bearer $QLK" -H 'Content-Type: application/json' \
  -d '{"username": "zichen", "items": [{"sentence": "The library will be closed for renovation next week."}]}'
```

Both take up to 1000 `items` of `{ sentence, trans?, note? }` and an optional
`date` (`YYYY-MM-DD`, default today in Australia/Perth) that decides which
chapter group the items join. Sentences already in the bank are skipped
(`skipped`); for WFD, case and punctuation don't make a sentence different.

`GET /review-words?username=…&type=fib` (or `wfd`, `word`) lists error cards of one kind.

## Planned

Importing whole word books (e.g. PTE high-frequency word lists) as new PTE
dictionaries will be added under `/api/v1` as well.
