CREATE TABLE "practice_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"sentence" text NOT NULL,
	"trans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"import_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_item" ADD CONSTRAINT "practice_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_item_user_type_key_idx" ON "practice_item" USING btree ("user_id","type","key");