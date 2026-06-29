import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";

// ===== NextAuth tables =====

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  hashedPassword: text("hashedPassword"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const accounts = pgTable("account", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<"oauth" | "oidc" | "email">().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("session", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    compositePk: uniqueIndex().on(table.identifier, table.token),
  })
);

// ===== App tables =====

export const tenants = pgTable("tenant", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const tenantMembers = pgTable("tenantMember", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").$type<"owner" | "admin" | "agent">().notNull().default("owner"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const platformConnections = pgTable("platformConnection", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  platform: text("platform").$type<"facebook" | "instagram" | "twitter" | "linkedin" | "tiktok" | "whatsapp" | "telegram">().notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt", { mode: "date" }),
  platformUserId: text("platformUserId"),
  platformUserName: text("platformUserName"),
  metadata: jsonb("metadata").$type<{
    pages?: { id: string; name: string; accessToken: string }[];
    groups?: { id: string; name: string }[];
  }>().default({}),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const products = pgTable("product", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  title: text("title"),
  description: text("description"),
  price: text("price"),
  stockStatus: text("stockStatus").$type<"in_stock" | "sold" | "low_stock" | "discontinued">().notNull().default("in_stock"),
  sku: text("sku"),
  images: jsonb("images").$type<string[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const posts = pgTable("post", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  imageUrls: jsonb("imageUrls").$type<string[]>().default([]),
  status: text("status").$type<"draft" | "publishing" | "published" | "partial" | "failed">().notNull().default("draft"),
  scheduledAt: timestamp("scheduledAt", { mode: "date" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const postDestinations = pgTable("postDestination", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  platformConnectionId: uuid("platformConnectionId").notNull().references(() => platformConnections.id, { onDelete: "cascade" }),
  destinationType: text("destinationType").$type<"page" | "group" | "marketplace" | "profile">().notNull(),
  destinationId: text("destinationId"),
  destinationName: text("destinationName"),
  platformPostId: text("platformPostId"),
  status: text("status").$type<"pending" | "publishing" | "published" | "failed">().notNull().default("pending"),
  error: text("error"),
  platformResponse: jsonb("platformResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const conversations = pgTable("conversation", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  platformConnectionId: uuid("platformConnectionId").notNull().references(() => platformConnections.id, { onDelete: "cascade" }),
  platformConversationId: text("platformConversationId"),
  pageId: text("pageId"),
  customerName: text("customerName"),
  customerId: text("customerId"),
  lastMessagePreview: text("lastMessagePreview"),
  unreadCount: integer("unreadCount").default(0),
  status: text("status").$type<"open" | "closed">().notNull().default("open"),
  platform: text("platform").notNull(),
  lastMessageAt: timestamp("lastMessageAt", { mode: "date" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const messages = pgTable("message", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  platformMessageId: text("platformMessageId"),
  content: text("content"),
  senderName: text("senderName"),
  direction: text("direction").$type<"inbound" | "outbound">().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customers = pgTable("customer", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  platform: text("platform").$type<"facebook" | "instagram" | "messenger">().notNull(),
  platformUserId: text("platformUserId").notNull(),
  name: text("name").notNull(),
  profilePictureUrl: text("profilePictureUrl"),
  username: text("username"),
  lastInteractionAt: timestamp("lastInteractionAt", { mode: "date" }),
  interactionType: text("interactionType").$type<"dm" | "comment" | "like" | "reaction">().default("dm"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const dailyAnalytics = pgTable("dailyAnalytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  platformConnectionId: uuid("platformConnectionId").notNull().references(() => platformConnections.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  newConversations: integer("newConversations").default(0).notNull(),
  messagesReceived: integer("messagesReceived").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  sales: integer("sales").default(0).notNull(),
  revenue: integer("revenue").default(0),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
