import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users / Auth ─────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // owner | admin | user
  rank: text("rank").default(""),              // Military rank e.g. SGT, CPT, LTC
  assignedUnit: text("assigned_unit").default(""), // Callsign of assigned unit
  createdAt: text("created_at").notNull(),
  lastLogin: text("last_login").default(""),
});

// Military rank presets
export const ARMY_RANKS = [
  // Enlisted
  { abbr: "PVT",  full: "Private",                  tier: "enlisted" },
  { abbr: "PV2",  full: "Private Second Class",       tier: "enlisted" },
  { abbr: "PFC",  full: "Private First Class",        tier: "enlisted" },
  { abbr: "SPC",  full: "Specialist",                 tier: "enlisted" },
  { abbr: "CPL",  full: "Corporal",                   tier: "enlisted" },
  { abbr: "SGT",  full: "Sergeant",                   tier: "NCO" },
  { abbr: "SSG",  full: "Staff Sergeant",             tier: "NCO" },
  { abbr: "SFC",  full: "Sergeant First Class",       tier: "NCO" },
  { abbr: "MSG",  full: "Master Sergeant",            tier: "NCO" },
  { abbr: "1SG",  full: "First Sergeant",             tier: "NCO" },
  { abbr: "SGM",  full: "Sergeant Major",             tier: "NCO" },
  { abbr: "CSM",  full: "Command Sergeant Major",     tier: "NCO" },
  { abbr: "SMA",  full: "Sergeant Major of the Army", tier: "NCO" },
  // Warrant Officers
  { abbr: "WO1",  full: "Warrant Officer 1",          tier: "WO" },
  { abbr: "CW2",  full: "Chief Warrant Officer 2",    tier: "WO" },
  { abbr: "CW3",  full: "Chief Warrant Officer 3",    tier: "WO" },
  { abbr: "CW4",  full: "Chief Warrant Officer 4",    tier: "WO" },
  { abbr: "CW5",  full: "Chief Warrant Officer 5",    tier: "WO" },
  // Officers
  { abbr: "2LT",  full: "Second Lieutenant",          tier: "officer" },
  { abbr: "1LT",  full: "First Lieutenant",           tier: "officer" },
  { abbr: "CPT",  full: "Captain",                    tier: "officer" },
  { abbr: "MAJ",  full: "Major",                      tier: "officer" },
  { abbr: "LTC",  full: "Lieutenant Colonel",         tier: "officer" },
  { abbr: "COL",  full: "Colonel",                    tier: "officer" },
  { abbr: "BG",   full: "Brigadier General",          tier: "officer" },
  { abbr: "MG",   full: "Major General",              tier: "officer" },
  { abbr: "LTG",  full: "Lieutenant General",         tier: "officer" },
  { abbr: "GEN",  full: "General",                    tier: "officer" },
  // Special / Other
  { abbr: "RTO",  full: "Radio Telephone Operator",   tier: "MOS" },
  { abbr: "GFC",  full: "Ground Force Commander",     tier: "MOS" },
  { abbr: "JTAC", full: "Joint Terminal Attack Controller", tier: "MOS" },
  { abbr: "18A",  full: "Special Forces Officer",     tier: "MOS" },
  { abbr: "18B",  full: "SF Weapons Sergeant",        tier: "MOS" },
  { abbr: "18C",  full: "SF Engineer Sergeant",       tier: "MOS" },
  { abbr: "18D",  full: "SF Medical Sergeant",        tier: "MOS" },
  { abbr: "18E",  full: "SF Communications Sergeant", tier: "MOS" },
  { abbr: "18F",  full: "SF Intelligence Sergeant",   tier: "MOS" },
  { abbr: "68W",  full: "Combat Medic",               tier: "MOS" },
];
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
  // JSON array of {filename, originalName, url, mimeType}
  images: text("images").notNull().default("[]"),
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
