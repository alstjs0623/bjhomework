ALTER TABLE vocab_sets ADD COLUMN manual_passed INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE vocab_sets ADD COLUMN manual_passed_at TEXT;
