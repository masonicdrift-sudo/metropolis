import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users / Auth ─────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // admin | user
  createdAt: text("created_at").notNull(),
  lastLogin: text("last_login").default(""),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Role hierarchy: owner > admin > user
export const ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, user: 1 };

// ─── Access Codes ─────────────────────────────────────────────────────────────
export const accessCodes = sqliteTable("access_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  createdBy: text("created_by").notNull(),     // username of owner who generated it
  createdAt: text("created_at").notNull(),
  usedBy: text("used_by").default(""),          // username who redeemed it
  usedAt: text("used_at").default(""),
  used: integer("used", { mode: "boolean" }).default(false),
  expiresAt: text("expires_at").default(""),    // optional expiry
});
export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({ id: true });
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type AccessCode = typeof accessCodes.$inferSelect;

// ─── ISOFAC Documents ──────────────────────────────────────────────────────────
export const isofacDocs = sqliteTable("isofac_docs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // OPORD | IMINT | HVT_CARD | FRAGORD | ISR_PLAN | CASEVAC_PLAN | ROE | INTEL_SUMMARY | CUSTOM
  title: text("title").notNull(),
  classification: text("classification").notNull().default("UNCLASS"),
  status: text("status").notNull().default("DRAFT"), // DRAFT | ACTIVE | SUPERSEDED | ARCHIVED
  content: text("content").notNull().default(""),   // Rich text / formatted body
  attachments: text("attachments").notNull().default("[]"), // JSON array of {filename, originalName, url, type}
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  opName: text("op_name").default(""),             // Associated operation name
  targetGrid: text("target_grid").default(""),
  tags: text("tags").notNull().default("[]"),       // JSON string array
});
export const insertIsofacDocSchema = createInsertSchema(isofacDocs).omit({ id: true });
export type InsertIsofacDoc = z.infer<typeof insertIsofacDocSchema>;
export type IsofacDoc = typeof isofacDocs.$inferSelect;

// ─── Radio Commo Cards ──────────────────────────────────────────────────
export const commoCards = sqliteTable("commo_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),             // e.g. "COMMO CARD - 24FEB2026"
  effectiveDate: text("effective_date").notNull(),
  // Crypto
  primaryKey: text("primary_key").notNull().default(""),
  primaryTdl: text("primary_tdl").notNull().default(""),
  backupKey: text("backup_key").notNull().default(""),
  backupTdl: text("backup_tdl").notNull().default(""),
  // Nets JSON array: [{label, freq, callsigns, notes}]
  nets: text("nets").notNull().default("[]"),
  // Ranger/secondary nets JSON
  rangerNets: text("ranger_nets").notNull().default("{}"),
  // Keycalls JSON: [{word, meaning, externalOnly}]
  keycalls: text("keycalls").notNull().default("[]"),
  keycallTheme: text("keycall_theme").default(""),
  keycallNote: text("keycall_note").default(""),
  // Status
  active: integer("active", { mode: "boolean" }).default(true),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertCommoCardSchema = createInsertSchema(commoCards).omit({ id: true });
export type InsertCommoCard = z.infer<typeof insertCommoCardSchema>;
export type CommoCard = typeof commoCards.$inferSelect;

// ─── Group Chats ───────────────────────────────────────────────────────────────
export const groupChats = sqliteTable("group_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  // JSON array of usernames who are members
  members: text("members").notNull().default("[]"),
});
export const insertGroupChatSchema = createInsertSchema(groupChats).omit({ id: true });
export type InsertGroupChat = z.infer<typeof insertGroupChatSchema>;
export type GroupChat = typeof groupChats.$inferSelect;

// Group messages reuse the messages table with toUsername = 'GROUP:<id>'

// ─── Messages (DMs + General) ───────────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUsername: text("from_username").notNull(),
  // For DMs: toUsername is the recipient. For general: toUsername = 'GENERAL'
  toUsername: text("to_username").notNull(),
  content: text("content").notNull(),
  sentAt: text("sent_at").notNull(),
  // Track per-recipient read status as JSON: { "username": true/false }
  readBy: text("read_by").notNull().default("{}"),
  deleted: integer("deleted", { mode: "boolean" }).default(false),
  // Optional file/image attachment: {filename, originalName, url, mimeType}
  attachment: text("attachment").default(""),
});
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ─── Units / Personnel ───────────────────────────────────────────────────────
export const units = sqliteTable("units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  callsign: text("callsign").notNull(),
  type: text("type").notNull(), // infantry, armor, air, intel, support
  status: text("status").notNull().default("active"), // active, standby, compromised, offline
  grid: text("grid").notNull(), // grid coordinate string e.g. "38T LP 123 456"
  commander: text("commander").notNull(),
  pax: integer("pax").notNull().default(0),
  notes: text("notes").default(""),
});
export const insertUnitSchema = createInsertSchema(units).omit({ id: true });
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Unit = typeof units.$inferSelect;

// ─── Operations ──────────────────────────────────────────────────────────────
export const operations = sqliteTable("operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // recon, strike, logistics, MEDEVAC, ISR
  priority: text("priority").notNull().default("medium"), // critical, high, medium, low
  status: text("status").notNull().default("planning"), // planning, active, complete, aborted
  objective: text("objective").notNull(),
  grid: text("grid").notNull(),
  assignedUnits: text("assigned_units").notNull().default("[]"), // JSON array of unit IDs
  startTime: text("start_time").notNull(),
  endTime: text("end_time").default(""),
  fratricide: integer("fratricide", { mode: "boolean" }).default(false),
  notes: text("notes").default(""),
});
export const insertOperationSchema = createInsertSchema(operations).omit({ id: true });
export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operations.$inferSelect;

// ─── Intelligence Reports ─────────────────────────────────────────────────────
export const intelReports = sqliteTable("intel_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  classification: text("classification").notNull().default("UNCLASS"), // UNCLASS, CUI, SECRET, TS
  category: text("category").notNull(), // HUMINT, SIGINT, IMINT, OSINT, CYBER
  threat: text("threat").notNull(), // low, moderate, high, critical
  source: text("source").notNull(),
  grid: text("grid").default(""),
  summary: text("summary").notNull(),
  timestamp: text("timestamp").notNull(),
  verified: integer("verified", { mode: "boolean" }).default(false),
  relatedOpId: integer("related_op_id").default(0),
});
export const insertIntelReportSchema = createInsertSchema(intelReports).omit({ id: true });
export type InsertIntelReport = z.infer<typeof insertIntelReportSchema>;
export type IntelReport = typeof intelReports.$inferSelect;

// ─── Communications Log ───────────────────────────────────────────────────────
export const commsLog = sqliteTable("comms_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromCallsign: text("from_callsign").notNull(),
  toCallsign: text("to_callsign").notNull(),
  channel: text("channel").notNull(), // PRIMARY, ALTERNATE, CONTINGENCY, EMERGENCY
  type: text("type").notNull(), // SITREP, SALUTE, FRAGO, CASEVAC, FIRE_MISSION, LOGSTAT, FLASH
  message: text("message").notNull(),
  timestamp: text("timestamp").notNull(),
  acknowledged: integer("acknowledged", { mode: "boolean" }).default(false),
  priority: text("priority").notNull().default("routine"), // routine, priority, immediate, flash
});
export const insertCommsLogSchema = createInsertSchema(commsLog).omit({ id: true });
export type InsertCommsLog = z.infer<typeof insertCommsLogSchema>;
export type CommsLog = typeof commsLog.$inferSelect;

// ─── Assets / Equipment ───────────────────────────────────────────────────────
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // vehicle, aircraft, weapon, comms_gear, sensor, supply
  status: text("status").notNull().default("operational"), // operational, degraded, maintenance, destroyed
  assignedUnitId: integer("assigned_unit_id").default(0),
  grid: text("grid").default(""),
  fuelPct: integer("fuel_pct").default(100),
  ammoPct: integer("ammo_pct").default(100),
  serialNumber: text("serial_number").notNull(),
  notes: text("notes").default(""),
});
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// ─── Threat Markers ───────────────────────────────────────────────────────────
export const threats = sqliteTable("threats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  category: text("category").notNull(), // IED, enemy_force, sniper, artillery, drone, cyber
  confidence: text("confidence").notNull().default("possible"), // confirmed, probable, possible
  grid: text("grid").notNull(),
  reportedBy: text("reported_by").notNull(),
  timestamp: text("timestamp").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  notes: text("notes").default(""),
});
export const insertThreatSchema = createInsertSchema(threats).omit({ id: true });
export type InsertThreat = z.infer<typeof insertThreatSchema>;
export type Threat = typeof threats.$inferSelect;
