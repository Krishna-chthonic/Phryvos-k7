CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`message_id` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_session` ON `artifacts` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_created` ON `artifacts` (`created_at`);--> statement-breakpoint
CREATE TABLE `dot_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`dot_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_calls` text,
	`tool_call_id` text,
	`tool_name` text,
	`tool_args` text,
	`tool_result` text,
	`status` text DEFAULT 'done',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`dot_id`) REFERENCES `dots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dot_messages_dot` ON `dot_messages` (`dot_id`);--> statement-breakpoint
CREATE INDEX `idx_dot_messages_created` ON `dot_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `dot_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`dot_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dot_id`) REFERENCES `dots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dot_spaces_dot` ON `dot_spaces` (`dot_id`);--> statement-breakpoint
CREATE TABLE `dot_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`dot_id` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`interval_seconds` integer,
	`next_run_at` integer,
	`last_run_at` integer,
	`last_result` text,
	`error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dot_id`) REFERENCES `dots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dot_tasks_dot` ON `dot_tasks` (`dot_id`);--> statement-breakpoint
CREATE INDEX `idx_dot_tasks_status` ON `dot_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dot_tasks_next_run` ON `dot_tasks` (`next_run_at`);--> statement-breakpoint
CREATE TABLE `dots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`character` text DEFAULT 'blue' NOT NULL,
	`role` text NOT NULL,
	`description` text,
	`system_prompt` text NOT NULL,
	`model` text DEFAULT 'auto',
	`tools` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`working_directory` text DEFAULT '/workspace',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `file_chunks` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content_enc` blob NOT NULL,
	`content_nonce` blob NOT NULL,
	`content_tag` blob NOT NULL,
	`embedding` blob NOT NULL,
	`embedding_model` text NOT NULL,
	`token_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_file_chunks_path` ON `file_chunks` (`file_path`);--> statement-breakpoint
CREATE INDEX `idx_file_chunks_model` ON `file_chunks` (`embedding_model`);--> statement-breakpoint
CREATE TABLE `fsrs_cards` (
	`id` integer PRIMARY KEY NOT NULL,
	`subject_id` integer NOT NULL,
	`topic_id` integer,
	`due` integer NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`elapsed_days` integer DEFAULT 0 NOT NULL,
	`scheduled_days` real DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `exam_subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `exam_topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fsrs_cards_due` ON `fsrs_cards` (`due`);--> statement-breakpoint
CREATE INDEX `idx_fsrs_cards_subject` ON `fsrs_cards` (`subject_id`);--> statement-breakpoint
CREATE INDEX `idx_fsrs_cards_topic` ON `fsrs_cards` (`topic_id`);--> statement-breakpoint
CREATE TABLE `memories` (
	`id` integer PRIMARY KEY NOT NULL,
	`point` text NOT NULL,
	`category` text DEFAULT 'fact',
	`source_session_id` text,
	`source` text DEFAULT 'user',
	`tier` text DEFAULT 'canon' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`importance` integer DEFAULT 5 NOT NULL,
	`source_turn_id` text,
	`valid_since` integer NOT NULL,
	`valid_until` integer,
	`related_ids` text,
	`sensitivity` text DEFAULT 'normal',
	`system_time` integer,
	`transaction_time` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_consolidation` (
	`id` integer PRIMARY KEY NOT NULL,
	`stm_key` text NOT NULL,
	`stm_value` text NOT NULL,
	`stm_access_count` integer DEFAULT 0 NOT NULL,
	`stm_last_access` integer NOT NULL,
	`ltm_promoted` integer DEFAULT false NOT NULL,
	`ltm_point` text,
	`ltm_category` text,
	`decay_score` real DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_consolidation_stm_key_unique` ON `memory_consolidation` (`stm_key`);--> statement-breakpoint
CREATE INDEX `idx_memory_stm_access` ON `memory_consolidation` (`stm_last_access`);--> statement-breakpoint
CREATE INDEX `idx_memory_decay` ON `memory_consolidation` (`decay_score`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `feedback` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `telemetry` text;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `mode` text;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `effort` text;