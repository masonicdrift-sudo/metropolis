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
  /** DoD / service personnel identifier (display in user management). */
  milIdNumber: text("mil_id_number").default(""),
  /** US Army MOS code (see US_ARMY_MOS_OPTIONS). */
  mos: text("mos").default(""),
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
  type: text("type").notNull(), // OPORD | IMINT | … | RADIO_LOG | CUSTOM
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

// ─── PERSTAT (Personnel Accountability) ─────────────────────────────────────
export const perstat = sqliteTable("perstat", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  dutyStatus: text("duty_status").notNull().default("active"), // active | off_duty | leave | mia | kia
  lastSeen: text("last_seen").notNull(),
  notes: text("notes").default(""),
});
export const insertPerstatSchema = createInsertSchema(perstat).omit({ id: true });
export type InsertPerstat = z.infer<typeof insertPerstatSchema>;
export type Perstat = typeof perstat.$inferSelect;

// ─── After Action Reports ─────────────────────────────────────────────────────
export const afterActionReports = sqliteTable("after_action_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  operationId: integer("operation_id").default(0),
  operationName: text("operation_name").default(""),
  date: text("date").notNull(),
  submittedBy: text("submitted_by").notNull(),
  classification: text("classification").notNull().default("UNCLASS"),
  summary: text("summary").notNull().default(""),
  whatWentWell: text("what_went_well").notNull().default(""),
  sustainItems: text("sustain_items").notNull().default(""),
  improveItems: text("improve_items").notNull().default(""),
  lessonsLearned: text("lessons_learned").notNull().default(""),
  casualties: text("casualties").notNull().default(""),
  equipment: text("equipment").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const insertAarSchema = createInsertSchema(afterActionReports).omit({ id: true });
export type InsertAar = z.infer<typeof insertAarSchema>;
export type AfterActionReport = typeof afterActionReports.$inferSelect;

// ─── Op-Order Tasks (Kanban) ──────────────────────────────────────────────────
export const opTasks = sqliteTable("op_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operationId: integer("operation_id").notNull(),
  title: text("title").notNull(),
  phase: text("phase").notNull().default("PREP"), // PREP | INFIL | ACTION | EXFIL | CONSOLIDATE
  assignedTo: text("assigned_to").default(""),    // username or unit callsign
  status: text("status").notNull().default("pending"), // pending | in_progress | complete
  notes: text("notes").default(""),
  createdAt: text("created_at").notNull(),
});
export const insertOpTaskSchema = createInsertSchema(opTasks).omit({ id: true });
export type InsertOpTask = z.infer<typeof insertOpTaskSchema>;
export type OpTask = typeof opTasks.$inferSelect;

// ─── Awards / Commendations ───────────────────────────────────────────────────
export const awards = sqliteTable("awards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  awardName: text("award_name").notNull(),
  awardType: text("award_type").notNull().default("commendation"), // commendation | medal | citation | achievement
  reason: text("reason").notNull().default(""),
  awardedBy: text("awarded_by").notNull(),
  awardedAt: text("awarded_at").notNull(),
  relatedOpId: integer("related_op_id").default(0),
  relatedOpName: text("related_op_name").default(""),
});
export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type Award = typeof awards.$inferSelect;

// ─── Training Records ─────────────────────────────────────────────────────────
export const trainingRecords = sqliteTable("training_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  eventName: text("event_name").notNull(),
  category: text("category").notNull().default("general"), // general | weapons | medical | comms | leadership | special
  date: text("date").notNull(),
  result: text("result").notNull().default("pass"), // pass | fail | qualified | expired
  instructor: text("instructor").default(""),
  expiresAt: text("expires_at").default(""),
  notes: text("notes").default(""),
  createdAt: text("created_at").notNull(),
});
export const insertTrainingSchema = createInsertSchema(trainingRecords).omit({ id: true });
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type TrainingRecord = typeof trainingRecords.$inferSelect;

// ─── Flash Broadcasts ─────────────────────────────────────────────────────────
export const broadcasts = sqliteTable("broadcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("flash"), // flash | immediate | priority
  sentBy: text("sent_by").notNull(),
  sentAt: text("sent_at").notNull(),
  expiresAt: text("expires_at").default(""),
  active: integer("active", { mode: "boolean" }).default(true),
});
export const insertBroadcastSchema = createInsertSchema(broadcasts).omit({ id: true });
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type Broadcast = typeof broadcasts.$inferSelect;

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

// ─── Tactical terrain map markers (NATO symbology, game X/Z per export) ───────
export const tacticalMapMarkers = sqliteTable("tactical_map_markers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapKey: text("map_key").notNull(),
  gameX: real("game_x").notNull(),
  gameZ: real("game_z").notNull(),
  sidc: text("sidc").notNull(),
  markerType: text("marker_type").notNull(),
  affiliation: text("affiliation").notNull().default("unknown"),
  label: text("label").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertTacticalMapMarkerSchema = createInsertSchema(
  tacticalMapMarkers,
).omit({ id: true, createdAt: true, createdBy: true, sidc: true });
export type InsertTacticalMapMarker = z.infer<typeof insertTacticalMapMarkerSchema>;
export type TacticalMapMarker = typeof tacticalMapMarkers.$inferSelect;

// ─── Tactical map polylines (game X/Z in meters, JSON point list) ─────────────
export const tacticalMapLines = sqliteTable("tactical_map_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapKey: text("map_key").notNull(),
  pointsJson: text("points_json").notNull(),
  label: text("label").notNull().default(""),
  color: text("color").notNull().default("#38bdf8"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export type TacticalMapLineRow = typeof tacticalMapLines.$inferSelect;
export type TacticalMapLine = Omit<TacticalMapLineRow, "pointsJson"> & {
  points: [number, number][];
};

// ─── Tactical map range rings (game X/Z meters, radius in meters) ───────────
export const tacticalMapRangeRings = sqliteTable("tactical_map_range_rings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapKey: text("map_key").notNull(),
  centerX: real("center_x").notNull(),
  centerZ: real("center_z").notNull(),
  radiusMeters: real("radius_meters").notNull(),
  label: text("label").notNull().default(""),
  color: text("color").notNull().default("#a855f7"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertTacticalMapRangeRingSchema = createInsertSchema(
  tacticalMapRangeRings,
).omit({ id: true, createdAt: true, createdBy: true });
export type InsertTacticalMapRangeRing = z.infer<typeof insertTacticalMapRangeRingSchema>;
export type TacticalMapRangeRing = typeof tacticalMapRangeRings.$inferSelect;

// ─── Tactical map building overlays (structure polygon label + fill; per map, shared) ──
export const tacticalMapBuildingLabels = sqliteTable("tactical_map_building_labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapKey: text("map_key").notNull(),
  featureKey: text("feature_key").notNull(),
  label: text("label").notNull().default(""),
  fillColor: text("fill_color").notNull().default("#64748b"),
  strokeColor: text("stroke_color").notNull().default("#94a3b8"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertTacticalMapBuildingLabelSchema = createInsertSchema(
  tacticalMapBuildingLabels,
).omit({ id: true, createdAt: true, createdBy: true });
export type InsertTacticalMapBuildingLabel = z.infer<typeof insertTacticalMapBuildingLabelSchema>;
export type TacticalMapBuildingLabel = typeof tacticalMapBuildingLabels.$inferSelect;
