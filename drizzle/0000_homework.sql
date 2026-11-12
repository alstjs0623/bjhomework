CREATE TABLE homework (
 id TEXT PRIMARY KEY NOT NULL,
 subject TEXT NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 due_date TEXT NOT NULL,
 student_done INTEGER NOT NULL DEFAULT 0,
 mom_done INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK (mom_done = 0 OR student_done = 1)
);
--> statement-breakpoint
CREATE INDEX homework_due_date_idx ON homework(due_date);
--> statement-breakpoint
CREATE TABLE settings (
 key TEXT PRIMARY KEY NOT NULL,
 value TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1
);
