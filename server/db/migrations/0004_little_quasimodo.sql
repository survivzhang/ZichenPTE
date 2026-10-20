CREATE TABLE "tts_audio" (
	"id" text PRIMARY KEY NOT NULL,
	"voice" text NOT NULL,
	"text" text NOT NULL,
	"audio" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "review_card_user_word_idx";--> statement-breakpoint
ALTER TABLE "review_card" ADD COLUMN "type" text DEFAULT 'word' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_card" ADD COLUMN "sentence" text;--> statement-breakpoint
CREATE UNIQUE INDEX "review_card_user_type_word_idx" ON "review_card" USING btree ("user_id","type","word");