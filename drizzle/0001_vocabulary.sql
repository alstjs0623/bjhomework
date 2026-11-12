CREATE TABLE vocab_photos (
 id TEXT PRIMARY KEY NOT NULL,
 object_key TEXT NOT NULL,
 content_type TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE vocab_sets (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL,
 test_date TEXT NOT NULL,
 words TEXT NOT NULL,
 pass_score INTEGER NOT NULL DEFAULT 100,
 photo_id TEXT REFERENCES vocab_photos(id),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX vocab_sets_test_date_idx ON vocab_sets(test_date);
--> statement-breakpoint
CREATE TABLE vocab_attempts (
 id TEXT PRIMARY KEY NOT NULL,
 set_id TEXT NOT NULL REFERENCES vocab_sets(id) ON DELETE CASCADE,
 set_version INTEGER NOT NULL,
 questions TEXT NOT NULL,
 results TEXT,
 score REAL,
 passed INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 completed_at TEXT
);
--> statement-breakpoint
CREATE INDEX vocab_attempts_set_idx ON vocab_attempts(set_id, set_version);
