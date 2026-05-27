/**
 * Conductor — Postgres schema (Drizzle ORM)
 *
 * Tables:
 *   users               — accounts (Google/Apple OAuth)
 *   sessions            — JWT auth sessions are stateless; legacy table kept off
 *   user_api_keys       — BYOK OpenRouter keys, AES-256-GCM encrypted
 *   threads             — chat threads (per user)
 *   messages            — tree-structured messages with branches
 *   workspaces          — saved workspace layouts
 *   panes               — workspace panes
 *   channels            — workspace channels
 *   usage_events        — token + cost ledger
 *   feedback            — thumbs-up/down + comments
 */

import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  real,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ───── users ──────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  provider: text("provider").notNull(), // "google" | "apple"
  providerAccountId: text("provider_account_id"),
  dailySpendCapUsd: real("daily_spend_cap_usd").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ───── user_api_keys ──────────────────────────────────────────────────
export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("openrouter"),
    encryptedKey: text("encrypted_key").notNull(), // base64(iv:tag:ciphertext)
    lastFour: text("last_four").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userProviderIdx: index("user_api_keys_user_provider_idx").on(t.userId, t.provider),
  }),
);
export type UserApiKey = typeof userApiKeys.$inferSelect;

// ───── threads ────────────────────────────────────────────────────────
export const threads = pgTable(
  "threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(), // "chat" | "compare" | "orchestrate" | "workspace"
    title: text("title").notNull().default("Untitled thread"),
    branchedFromThreadId: uuid("branched_from_thread_id"),
    branchedFromMessageId: uuid("branched_from_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("threads_user_idx").on(t.userId),
  }),
);
export type Thread = typeof threads.$inferSelect;

// ───── messages ───────────────────────────────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    role: text("role").notNull(), // "user" | "assistant" | "system"
    content: text("content").notNull(),
    modelId: text("model_id"),
    status: text("status").notNull().default("complete"), // "streaming" | "complete" | "stopped" | "error"
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("messages_thread_idx").on(t.threadId),
    parentIdx: index("messages_parent_idx").on(t.parentId),
  }),
);
export type Message = typeof messages.$inferSelect;

// ───── workspaces ─────────────────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Workspace"),
  layoutTreeJson: jsonb("layout_tree_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Workspace = typeof workspaces.$inferSelect;

// ───── channels ───────────────────────────────────────────────────────
export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#10b981"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Channel = typeof channels.$inferSelect;

// ───── panes ──────────────────────────────────────────────────────────
export const panes = pgTable("panes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id").references(() => threads.id, { onDelete: "set null" }),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
  position: jsonb("position").notNull(), // { row, col, w, h }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Pane = typeof panes.$inferSelect;

// ───── usage_events ───────────────────────────────────────────────────
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id"),
    messageId: uuid("message_id"),
    modelId: text("model_id").notNull(),
    openrouterModel: text("openrouter_model"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("usage_events_user_created_idx").on(t.userId, t.createdAt),
  }),
);
export type UsageEvent = typeof usageEvents.$inferSelect;

// ───── share_links ────────────────────────────────────────────────────
// Stores a conversation snapshot so shares work even though messages are
// held in client-side state (not persisted per-message to the DB).
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Shared conversation"),
    mode: text("mode").notNull().default("chat"), // "chat" | "compare" | "orchestrate"
    snapshotJson: jsonb("snapshot_json").notNull(), // serialized messages / nodes
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: index("share_links_token_idx").on(t.token),
    userIdx: index("share_links_user_idx").on(t.userId),
  }),
);
export type ShareLink = typeof shareLinks.$inferSelect;

// ───── feedback ───────────────────────────────────────────────────────
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    messageId: uuid("message_id"),
    rating: integer("rating").notNull(), // 1 = thumbs up, -1 = thumbs down, 0 = general
    comment: text("comment"),
    isBugReport: boolean("is_bug_report").notNull().default(false),
    pageContext: text("page_context"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("feedback_user_idx").on(t.userId),
  }),
);
export type Feedback = typeof feedback.$inferSelect;
export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
