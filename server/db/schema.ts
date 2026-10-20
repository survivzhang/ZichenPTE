import { relations } from 'drizzle-orm'
import { bigint, boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Auth tables, in the shape Better Auth expects (user, session, account,
// verification, rateLimit). `username` / `displayUsername` come from the
// username plugin; `role`, `banned*` and `impersonatedBy` from the admin plugin.
// ---------------------------------------------------------------------------

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  // admin plugin: 'admin' or 'user'
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

// ---------------------------------------------------------------------------
// Typing records. These mirror the browser-side IndexedDB tables in
// src/utils/db/record.ts.
// ---------------------------------------------------------------------------

export const wordRecord = pgTable(
  'word_record',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    dict: text('dict').notNull(),
    // -1 in review mode, null for practice outside a chapter
    chapter: integer('chapter'),
    // milliseconds between consecutive correct key presses
    timing: jsonb('timing').$type<number[]>().notNull(),
    wrongCount: integer('wrong_count').notNull(),
    // letter index -> keys mistakenly typed at that position
    mistakes: jsonb('mistakes').$type<Record<string, string[]>>().notNull(),
    typedAt: timestamp('typed_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('word_record_user_dict_chapter_idx').on(t.userId, t.dict, t.chapter),
    index('word_record_user_word_idx').on(t.userId, t.word),
  ],
)

export const chapterRecord = pgTable(
  'chapter_record',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dict: text('dict').notNull(),
    chapter: integer('chapter'),
    // seconds spent on the chapter
    time: integer('time').notNull(),
    correctCount: integer('correct_count').notNull(),
    wrongCount: integer('wrong_count').notNull(),
    wordCount: integer('word_count').notNull(),
    correctWordIndexes: jsonb('correct_word_indexes').$type<number[]>().notNull(),
    wordNumber: integer('word_number').notNull(),
    typedAt: timestamp('typed_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('chapter_record_user_dict_chapter_idx').on(t.userId, t.dict, t.chapter)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

// Per-user app state that should follow the account across devices.
export const userPreference = pgTable('user_preference', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  currentDict: text('current_dict'),
  currentChapter: integer('current_chapter'),
  updatedAt: updatedAt(),
})

// ---------------------------------------------------------------------------
// Spaced repetition (FSRS). A card exists for every word the user has gotten
// wrong (or that was imported as a mistake); words typed correctly the first
// time are considered learned and get no card.
// ---------------------------------------------------------------------------

export const reviewCard = pgTable(
  'review_card',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // lowercased; one card per word per user, whichever dictionary it came from
    word: text('word').notNull(),
    displayWord: text('display_word').notNull(),
    trans: jsonb('trans').$type<string[]>().notNull().default([]),
    usphone: text('usphone'),
    ukphone: text('ukphone'),
    // where the mistake came from: typing, listening, speaking, reading, writing, other
    source: text('source').notNull().default('typing'),
    note: text('note'),
    originDict: text('origin_dict'),
    // FSRS card state (see ts-fsrs Card)
    due: timestamp('due', { withTimezone: true }).notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),
    elapsedDays: integer('elapsed_days').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    reps: integer('reps').notNull(),
    lapses: integer('lapses').notNull(),
    state: integer('state').notNull(),
    lastReview: timestamp('last_review', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('review_card_user_word_idx').on(t.userId, t.word), index('review_card_user_due_idx').on(t.userId, t.due)],
)

// One row per time a carded word was answered: the first (wrong) learning
// attempt, every review, and imports.
export const reviewLog = pgTable(
  'review_log',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    cardId: integer('card_id')
      .notNull()
      .references(() => reviewCard.id, { onDelete: 'cascade' }),
    // learn = first time in a chapter, review = daily review, import = added via API or merged error book
    kind: text('kind').notNull(),
    correct: boolean('correct').notNull(),
    // ts-fsrs Rating; 0 for imports
    rating: integer('rating').notNull(),
    nextDue: timestamp('next_due', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('review_log_card_idx').on(t.cardId)],
)

// Admin-issued keys for the /api/v1 import API. Only a SHA-256 hash is stored.
export const apiKey = pgTable('api_key', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // first characters of the key, shown in the admin list to tell keys apart
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
})
