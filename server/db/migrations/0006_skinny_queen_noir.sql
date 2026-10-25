CREATE TABLE "speak_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"word" text NOT NULL,
	"dict" text NOT NULL,
	"chapter" integer,
	"score" integer,
	"passed" boolean NOT NULL,
	"first_try" boolean NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"locale" text NOT NULL,
	"phonemes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_ms" integer,
	"spoken_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_card" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "speak_dict" text;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "speak_chapter" integer;--> statement-breakpoint
ALTER TABLE "speak_record" ADD CONSTRAINT "speak_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "speak_record_user_dict_chapter_idx" ON "speak_record" USING btree ("user_id","dict","chapter");--> statement-breakpoint
CREATE INDEX "speak_record_user_word_idx" ON "speak_record" USING btree ("user_id","word");