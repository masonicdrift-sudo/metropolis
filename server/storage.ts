import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "./crypto";
import type {
  Unit, InsertUnit,
  Operation, InsertOperation,
  IntelReport, InsertIntelReport,
  CommsLog, InsertCommsLog,
  Asset, InsertAsset,
  Threat, InsertThreat,
  User, InsertUser,
  AccessCode,
  Message,
  CommoCard, InsertCommoCard,
} from "@shared/schema";

const sqlite = new Database("tacedge.db");
const db = drizzle(sqlite, { schema });

// Initialize tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS commo_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    primary_key TEXT NOT NULL DEFAULT '',
    primary_tdl TEXT NOT NULL DEFAULT '',
    backup_key TEXT NOT NULL DEFAULT '',
    backup_tdl TEXT NOT NULL DEFAULT '',
    nets TEXT NOT NULL DEFAULT '[]',
    ranger_nets TEXT NOT NULL DEFAULT '{}',
    keycalls TEXT NOT NULL DEFAULT '[]',
    keycall_theme TEXT DEFAULT '',
    keycall_note TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    content TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    read_by TEXT NOT NULL DEFAULT '{}',
    deleted INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_username);
  CREATE TABLE IF NOT EXISTS access_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_by TEXT DEFAULT '',
    used_at TEXT DEFAULT '',
    used INTEGER DEFAULT 0,
    expires_at TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    last_login TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callsign TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    grid TEXT NOT NULL,
    commander TEXT NOT NULL,
    pax INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'planning',
    objective TEXT NOT NULL,
    grid TEXT NOT NULL,
    assigned_units TEXT NOT NULL DEFAULT '[]',
    start_time TEXT NOT NULL,
    end_time TEXT DEFAULT '',
    fratricide INTEGER DEFAULT 0,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS intel_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'UNCLASS',
    category TEXT NOT NULL,
    threat TEXT NOT NULL,
    source TEXT NOT NULL,
    grid TEXT DEFAULT '',
    summary TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    related_op_id INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS comms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_callsign TEXT NOT NULL,
    to_callsign TEXT NOT NULL,
    channel TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'routine'
  );
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'operational',
    assigned_unit_id INTEGER DEFAULT 0,
    grid TEXT DEFAULT '',
    fuel_pct INTEGER DEFAULT 100,
    ammo_pct INTEGER DEFAULT 100,
    serial_number TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS threats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'possible',
    grid TEXT NOT NULL,
    reported_by TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    notes TEXT DEFAULT ''
  );
`);

// Seed 24FEB2026 Commo Card
const commoCardExists = db.select().from(schema.commoCards).get();
if (!commoCardExists) {
  const now = new Date().toISOString();
  db.insert(schema.commoCards).values({
    title: "COMMO CARD - 24FEB2026",
    effectiveDate: "24FEB2026",
    primaryKey: "ANUB",
    primaryTdl: "Same",
    backupKey: "AMON",
    backupTdl: "Same",
    nets: JSON.stringify([
      { label: "ATG", freq: "49.0", callsigns: "Gypsy Flight, 2-1, ZR, ZU, TU, TR", notes: "" },
      { label: "Inter-Ship", freq: "48.5", callsigns: "Gypsy Flight", notes: "" },
      { label: "Ship 1", freq: "47.5", callsigns: "", notes: "" },
      { label: "Ship 2", freq: "47.0", callsigns: "", notes: "" },
      { label: "GROUND Inter-Command", freq: "46.2", callsigns: "", notes: "" },
      { label: "C2 HQ", freq: "46.0", callsigns: "2-1, 2-2, RTO, GFC, ZU", notes: "" },
      { label: "C2 HQ/DS/EN", freq: "45.5", callsigns: "", notes: "" },
      { label: "C2 ASLT 1", freq: "45.0", callsigns: "ZE", notes: "" },
      { label: "C2 ASLT 2", freq: "44.5", callsigns: "ZF", notes: "" },
      { label: "C2 Combined Team", freq: "44.0", callsigns: "", notes: "" },
      { label: "G3 HQ", freq: "43.5", callsigns: "3-1, 3-2, RTO, TU", notes: "" },
      { label: "G3 HQ/DS/EN", freq: "43.0", callsigns: "", notes: "" },
      { label: "G3 EX TEAM 1", freq: "42.5", callsigns: "TI", notes: "" },
      { label: "sUAS OPS", freq: "41.0", callsigns: "TI, Z99, GFC", notes: "mHz" },
      { label: "MEDICAL", freq: "40.5", callsigns: "ZM", notes: "mHz" },
      { label: "CONVOY", freq: "", callsigns: "", notes: "Use Ground Inter-Command unless otherwise directed" },
    ]),
    rangerNets: JSON.stringify({
      label: "Ranger Nets",
      color: "Red",
      encrypted: true,
      primaryKey: "Knight",
      primaryTdl: "Knight",
      backupKey: "2RB",
      backupTdl: "2RB",
      nets: [
        { label: "Batt CMD", freq: "47" },
        { label: "Batt Ops", freq: "47.2" },
        { label: "Batt Med", freq: "47.6" },
        { label: "Batt Fires", freq: "47.4" },
        { label: "MEDEVAC", freq: "58.0" },
        { label: "CSAR", freq: "57.0" },
        { label: "CAS", freq: "56.0" },
        { label: "JOINT OPS CMD", freq: "48.0" },
        { label: "ACO CMD", freq: "49.0", tdl: "Assassin" },
        { label: "BCO CMD", freq: "46.0", tdl: "Bushmaster" },
        { label: "DCO CMD", freq: "42.0", tdl: "Dread" },
      ]
    }),
    keycalls: JSON.stringify([
      { word: "ANUBIS", meaning: "BROKEN CRYPTO", externalOnly: false },
      { word: "HORUS", meaning: "SP", externalOnly: true },
      { word: "SETH", meaning: "PRE-ASSAULT FIRES", externalOnly: true },
      { word: "RA", meaning: "EXECUTE", externalOnly: true },
      { word: "OSIRIS", meaning: "MASCAL", externalOnly: true },
      { word: "HORUS", meaning: "JACKPOT", externalOnly: true },
      { word: "AMMIT", meaning: "DRY HOLE", externalOnly: true },
      { word: "BASTET", meaning: "ALL SECURE", externalOnly: true },
      { word: "PTAH", meaning: "BIP", externalOnly: true },
      { word: "THOTH", meaning: "SSE", externalOnly: true },
      { word: "KHONSU", meaning: "EXFIL", externalOnly: true },
      { word: "AMUN", meaning: "RTB", externalOnly: true },
    ]),
    keycallTheme: "Egyptian Mythology Theme",
    keycallNote: "All Keycalls except BROKEN CRYPTO are external use only.",
    active: true,
    createdBy: "ZR1",
    createdAt: now,
  }).run();
}

// Seed ZR1 as Owner (highest privilege)
const zr1Exists = db.select().from(schema.users).where(eq(schema.users.username, "ZR1")).get();
if (!zr1Exists) {
  const hash = bcrypt.hashSync("OSGSoftware1@!", 10);
  db.insert(schema.users).values({
    username: "ZR1",
    passwordHash: hash,
    role: "owner",
    createdAt: new Date().toISOString(),
    lastLogin: "",
  }).run();
}

// Seed Overlord admin account
const adminExists = db.select().from(schema.users).where(eq(schema.users.username, "Overlord")).get();
if (!adminExists) {
  const hash = bcrypt.hashSync("OSGSoftware1@!", 10);
  db.insert(schema.users).values({
    username: "Overlord",
    passwordHash: hash,
    role: "admin",
    createdAt: new Date().toISOString(),
    lastLogin: "",
  }).run();
}

// Seed demo data if empty
const unitCount = (db.select().from(schema.units).all()).length;
if (unitCount === 0) {
  const now = new Date().toISOString();
  // Units
  db.insert(schema.units).values([
    { callsign: "ALPHA-1", type: "infantry", status: "active", grid: "38T LP 4821 7334", commander: "CPT Rodriguez", pax: 12, notes: "Assault element" },
    { callsign: "BRAVO-2", type: "armor", status: "active", grid: "38T LP 5102 7210", commander: "1LT Chen", pax: 4, notes: "M1A2 x2" },
    { callsign: "CHARLIE-3", type: "intel", status: "standby", grid: "38T LP 4600 7500", commander: "SFC Williams", pax: 6, notes: "ISR team" },
    { callsign: "DELTA-4", type: "support", status: "active", grid: "38T LP 4400 7100", commander: "SSG Martinez", pax: 8, notes: "Log/Sustainment" },
    { callsign: "EAGLE-5", type: "air", status: "offline", grid: "38T LP 4200 7800", commander: "CW3 Thompson", pax: 2, notes: "UAS offline/maintenance" },
  ]).run();
  // Operations
  db.insert(schema.operations).values([
    { name: "OP IRON VEIL", type: "recon", priority: "high", status: "active", objective: "Confirm enemy OP at grid LP 5300 7400", grid: "38T LP 5300 7400", assignedUnits: "[1,3]", startTime: now, endTime: "", notes: "Night movement only" },
    { name: "OP THUNDER RUN", type: "strike", priority: "critical", status: "planning", objective: "Neutralize enemy cache site", grid: "38T LP 5600 7600", assignedUnits: "[1,2]", startTime: now, endTime: "", notes: "Requires fire support coordination" },
    { name: "OP SWIFT SUPPLY", type: "logistics", priority: "medium", status: "complete", objective: "Resupply ALPHA-1 with Class III/V", grid: "38T LP 4821 7334", assignedUnits: "[4]", startTime: now, endTime: now, notes: "Completed 0230L" },
  ]).run();
  // Intel
  db.insert(schema.intelReports).values([
    { title: "Enemy Vehicle Movement NW Grid", classification: "SECRET", category: "IMINT", threat: "high", source: "UAS-1 Persistent Stare", grid: "38T LP 5300 7400", summary: "3x BTR-80s observed moving NW along dirt road. Possible reinforcement of checkpoint at LP 5400. Movement corroborates previous HUMINT report.", timestamp: now, verified: 1, relatedOpId: 1 },
    { title: "SIGINT Intercept - Enemy Comms Spike", classification: "SECRET", category: "SIGINT", threat: "moderate", source: "EW Team Blackbird", grid: "38T LP 5500 7500", summary: "Significant radio traffic detected on enemy frequency 34.75 MHz. Encrypted burst transmissions suggest command-level coordination. Duration: 45 min.", timestamp: now, verified: 1, relatedOpId: 0 },
    { title: "Local National Report - IED Emplacement", classification: "CUI", category: "HUMINT", threat: "critical", source: "LN Source EAGLE", grid: "38T LP 4900 7200", summary: "Source reports 2x military-age males emplacing device near culvert on MSR TAMPA. Device described as pressure-plate IED. Unverified.", timestamp: now, verified: 0, relatedOpId: 0 },
    { title: "Cyber: Attempted Network Intrusion", classification: "SECRET", category: "CYBER", threat: "moderate", source: "CND Watch Officer", grid: "", summary: "Detected port scanning activity from external IP against tactical network segment. Blocked at perimeter firewall. Attribution: unknown. Recommend network audit.", timestamp: now, verified: 1, relatedOpId: 0 },
  ]).run();
  // Comms
  db.insert(schema.commsLog).values([
    { fromCallsign: "ALPHA-1", toCallsign: "TOC", channel: "PRIMARY", type: "SITREP", message: "ALPHA-1 SITREP: Location 38T LP 4821 7334. PAX 12 all UP. No CONTACT. Enemy activity neg. Equipment status GREEN. Resupply required Class III by 0600L.", timestamp: now, acknowledged: 1, priority: "routine" },
    { fromCallsign: "CHARLIE-3", toCallsign: "TOC", channel: "PRIMARY", type: "SALUTE", message: "SALUTE REPORT: SIZE - Plt(-). ACT - Moving NW. LOC - LP 5300 7400. UNIT - Unknown, BTR-80s. TIME - 0115L. EQUIP - 3x BTR-80.", timestamp: now, acknowledged: 1, priority: "priority" },
    { fromCallsign: "TOC", toCallsign: "ALL", channel: "PRIMARY", type: "FRAGO", message: "FRAGO 03: ALPHA-1 and BRAVO-2 will establish OPs vic LP 5200 7300 NLT 0300L. CHARLIE-3 maintains ISR coverage on enemy movement. ACK.", timestamp: now, acknowledged: 0, priority: "immediate" },
    { fromCallsign: "DELTA-4", toCallsign: "TOC", channel: "ALTERNATE", type: "LOGSTAT", message: "LOGSTAT: Class I 3 days. Class III 60%. Class V AMMO: 75%. Class IX: 2x broken Humvee windshields req. CASEVAC: 0 WIA/KIA.", timestamp: now, acknowledged: 1, priority: "routine" },
  ]).run();
  // Assets
  db.insert(schema.assets).values([
    { name: "M1A2 SEPv3 #1", type: "vehicle", status: "operational", assignedUnitId: 2, grid: "38T LP 5102 7210", fuelPct: 80, ammoPct: 90, serialNumber: "1TK-221-001", notes: "Main gun boresighted" },
    { name: "M1A2 SEPv3 #2", type: "vehicle", status: "degraded", assignedUnitId: 2, grid: "38T LP 5102 7210", fuelPct: 65, ammoPct: 90, serialNumber: "1TK-221-002", notes: "Track tension issue - monitor" },
    { name: "RQ-7 Shadow", type: "aircraft", status: "operational", assignedUnitId: 3, grid: "38T LP 4200 7800", fuelPct: 100, ammoPct: 0, serialNumber: "UAS-RQ7-055", notes: "Airborne - sector NW" },
    { name: "JTRS Manpack Radio #1", type: "comms_gear", status: "operational", assignedUnitId: 1, grid: "38T LP 4821 7334", fuelPct: 100, ammoPct: 0, serialNumber: "JTRS-0091", notes: "KY-99 loaded, freq plan current" },
    { name: "M777 Howitzer", type: "weapon", status: "operational", assignedUnitId: 4, grid: "38T LP 4400 7100", fuelPct: 0, ammoPct: 75, serialNumber: "M777-FA-014", notes: "Registered, met data current" },
  ]).run();
  // Threats
  db.insert(schema.threats).values([
    { label: "Enemy BTR-80 Plt", category: "enemy_force", confidence: "confirmed", grid: "38T LP 5300 7400", reportedBy: "CHARLIE-3", timestamp: now, active: 1, notes: "Moving NW, 3 vehicles" },
    { label: "Suspected IED - MSR TAMPA", category: "IED", confidence: "probable", grid: "38T LP 4900 7200", reportedBy: "HUMINT-EAGLE", timestamp: now, active: 1, notes: "Unverified LN report - do not use road segment" },
    { label: "Possible Sniper OP", category: "sniper", confidence: "possible", grid: "38T LP 5100 7450", reportedBy: "ALPHA-1", timestamp: now, active: 1, notes: "Glass glint observed from treeline" },
    { label: "Hostile Drone Observed", category: "drone", confidence: "confirmed", grid: "38T LP 5000 7300", reportedBy: "CHARLIE-3", timestamp: now, active: 0, notes: "Neutralized by counter-UAS at 0047L" },
  ]).run();
}

export interface IStorage {
  // Commo Cards
  getCommoCards(): CommoCard[];
  getCommoCard(id: number): CommoCard | undefined;
  createCommoCard(c: InsertCommoCard): CommoCard;
  updateCommoCard(id: number, c: Partial<InsertCommoCard>): CommoCard | undefined;
  deleteCommoCard(id: number): void;
  setActiveCard(id: number): void;
  // Messages
  getGeneralMessages(limit?: number): Message[];
  getDMConversation(userA: string, userB: string, limit?: number): Message[];
  getDMList(username: string): { username: string; lastMessage: string; sentAt: string; unread: number }[];
  sendMessage(from: string, to: string, content: string): Message;
  markRead(fromUsername: string, toUsername: string, readerUsername: string): void;
  getUnreadDMCount(username: string): number;
  getUnreadGeneralCount(username: string): number;
  deleteMessage(id: number): void;
  // Access Codes
  getAccessCodes(): AccessCode[];
  generateAccessCode(createdBy: string, expiresAt?: string): AccessCode;
  validateAndRedeemCode(code: string, username: string): AccessCode | null;
  deleteAccessCode(id: number): void;
  // Users
  getUsers(): Omit<User, "passwordHash">[];
  getUserById(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  createUser(username: string, password: string, role: string): User;
  deleteUser(id: number): void;
  updateLastLogin(id: number): void;
  // Units
  getUnits(): Unit[];
  getUnit(id: number): Unit | undefined;
  createUnit(u: InsertUnit): Unit;
  updateUnit(id: number, u: Partial<InsertUnit>): Unit | undefined;
  deleteUnit(id: number): void;
  // Operations
  getOperations(): Operation[];
  getOperation(id: number): Operation | undefined;
  createOperation(o: InsertOperation): Operation;
  updateOperation(id: number, o: Partial<InsertOperation>): Operation | undefined;
  deleteOperation(id: number): void;
  // Intel
  getIntelReports(): IntelReport[];
  getIntelReport(id: number): IntelReport | undefined;
  createIntelReport(r: InsertIntelReport): IntelReport;
  updateIntelReport(id: number, r: Partial<InsertIntelReport>): IntelReport | undefined;
  deleteIntelReport(id: number): void;
  // Comms
  getCommsLog(): CommsLog[];
  createCommsEntry(c: InsertCommsLog): CommsLog;
  acknowledgeComms(id: number): CommsLog | undefined;
  // Assets
  getAssets(): Asset[];
  getAsset(id: number): Asset | undefined;
  createAsset(a: InsertAsset): Asset;
  updateAsset(id: number, a: Partial<InsertAsset>): Asset | undefined;
  deleteAsset(id: number): void;
  // Threats
  getThreats(): Threat[];
  createThreat(t: InsertThreat): Threat;
  updateThreat(id: number, t: Partial<InsertThreat>): Threat | undefined;
  deleteTheat(id: number): void;
}

export class Storage implements IStorage {
  // Commo Cards
  getCommoCards() { return db.select().from(schema.commoCards).orderBy(desc(schema.commoCards.id)).all(); }
  getCommoCard(id: number) { return db.select().from(schema.commoCards).where(eq(schema.commoCards.id, id)).get(); }
  createCommoCard(c: InsertCommoCard) { return db.insert(schema.commoCards).values(c).returning().get(); }
  updateCommoCard(id: number, c: Partial<InsertCommoCard>) {
    return db.update(schema.commoCards).set(c).where(eq(schema.commoCards.id, id)).returning().get();
  }
  deleteCommoCard(id: number) { db.delete(schema.commoCards).where(eq(schema.commoCards.id, id)).run(); }
  setActiveCard(id: number) {
    // Deactivate all, then activate the selected one
    db.update(schema.commoCards).set({ active: false }).run();
    db.update(schema.commoCards).set({ active: true }).where(eq(schema.commoCards.id, id)).run();
  }

  // Messages
  private decryptMsg(m: Message): Message {
    return { ...m, content: decrypt(m.content) };
  }
  getGeneralMessages(limit = 200): Message[] {
    return db.select().from(schema.messages)
      .where(eq(schema.messages.toUsername, "GENERAL"))
      .orderBy(schema.messages.id)
      .all().slice(-limit).map(m => this.decryptMsg(m));
  }
  getDMConversation(userA: string, userB: string, limit = 200): Message[] {
    const all = db.select().from(schema.messages).all();
    return all.filter(m =>
      (m.fromUsername === userA && m.toUsername === userB) ||
      (m.fromUsername === userB && m.toUsername === userA)
    ).slice(-limit).map(m => this.decryptMsg(m));
  }
  getDMList(username: string): { username: string; lastMessage: string; sentAt: string; unread: number }[] {
    const all = db.select().from(schema.messages).all();
    const dmMap = new Map<string, { lastMessage: string; sentAt: string; unread: number }>();
    for (const m of all) {
      if (m.toUsername === "GENERAL") continue;
      const other = m.fromUsername === username ? m.toUsername : m.fromUsername;
      if (m.fromUsername !== username && m.toUsername !== username) continue;
      const existing = dmMap.get(other);
      if (!existing || m.sentAt > existing.sentAt) {
        const readBy = JSON.parse(m.readBy || "{}");
        const unread = m.fromUsername !== username && !readBy[username] ? 1 : 0;
        // Decrypt the preview snippet
        const preview = decrypt(m.content);
        dmMap.set(other, { lastMessage: preview, sentAt: m.sentAt, unread: existing ? existing.unread + unread : unread });
      }
    }
    return Array.from(dmMap.entries()).map(([u, v]) => ({ username: u, ...v }))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }
  sendMessage(from: string, to: string, content: string): Message {
    const stored = db.insert(schema.messages).values({
      fromUsername: from,
      toUsername: to,
      content: encrypt(content),   // AES-256-GCM encrypted at rest
      sentAt: new Date().toISOString(),
      readBy: JSON.stringify({ [from]: true }),
      deleted: false,
    }).returning().get();
    // Return decrypted for the API response (in-transit is TLS protected)
    return { ...stored, content };
  }
  markRead(fromUsername: string, toUsername: string, readerUsername: string): void {
    // Mark all messages in this conversation as read by the reader
    const msgs = this.getDMConversation(fromUsername, toUsername);
    for (const m of msgs) {
      if (m.fromUsername !== readerUsername) {
        const readBy = JSON.parse(m.readBy || "{}");
        if (!readBy[readerUsername]) {
          readBy[readerUsername] = true;
          db.update(schema.messages).set({ readBy: JSON.stringify(readBy) }).where(eq(schema.messages.id, m.id)).run();
        }
      }
    }
  }
  getUnreadDMCount(username: string): number {
    const all = db.select().from(schema.messages).all();
    return all.filter(m => {
      if (m.toUsername === "GENERAL" || m.fromUsername === username) return false;
      if (m.toUsername !== username) return false;
      const readBy = JSON.parse(m.readBy || "{}");
      return !readBy[username];
    }).length;
  }
  getUnreadGeneralCount(username: string): number {
    const all = db.select().from(schema.messages).all();
    return all.filter(m => {
      if (m.toUsername !== "GENERAL" || m.fromUsername === username) return false;
      const readBy = JSON.parse(m.readBy || "{}");
      return !readBy[username];
    }).length;
  }
  deleteMessage(id: number): void {
    db.update(schema.messages).set({ deleted: true, content: encrypt("[message deleted]") }).where(eq(schema.messages.id, id)).run();
  }

  // Access Codes
  getAccessCodes() {
    return db.select().from(schema.accessCodes).orderBy(desc(schema.accessCodes.id)).all();
  }
  generateAccessCode(createdBy: string, expiresAt = "") {
    // Generate a readable but unguessable 16-char alphanumeric code e.g. TACX-8K2M-PQ9R
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const code = `${seg(4)}-${seg(4)}-${seg(4)}`;
    return db.insert(schema.accessCodes).values({
      code,
      createdBy,
      createdAt: new Date().toISOString(),
      usedBy: "",
      usedAt: "",
      used: false,
      expiresAt,
    }).returning().get();
  }
  validateAndRedeemCode(code: string, username: string) {
    const entry = db.select().from(schema.accessCodes).where(eq(schema.accessCodes.code, code.toUpperCase())).get();
    if (!entry || entry.used) return null;
    // Check expiry if set
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return null;
    // Redeem it
    return db.update(schema.accessCodes).set({
      used: true,
      usedBy: username,
      usedAt: new Date().toISOString(),
    }).where(eq(schema.accessCodes.id, entry.id)).returning().get() ?? null;
  }
  deleteAccessCode(id: number) {
    db.delete(schema.accessCodes).where(eq(schema.accessCodes.id, id)).run();
  }

  // Users
  getUsers() {
    return db.select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      lastLogin: schema.users.lastLogin,
    }).from(schema.users).all();
  }
  getUserById(id: number) {
    return db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  }
  getUserByUsername(username: string) {
    return db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  }
  createUser(username: string, password: string, role: string) {
    const hash = bcrypt.hashSync(password, 10);
    return db.insert(schema.users).values({
      username,
      passwordHash: hash,
      role,
      createdAt: new Date().toISOString(),
      lastLogin: "",
    }).returning().get();
  }
  deleteUser(id: number) {
    db.delete(schema.users).where(eq(schema.users.id, id)).run();
  }
  updateLastLogin(id: number) {
    db.update(schema.users).set({ lastLogin: new Date().toISOString() }).where(eq(schema.users.id, id)).run();
  }

  // Units
  getUnits() { return db.select().from(schema.units).all(); }
  getUnit(id: number) { return db.select().from(schema.units).where(eq(schema.units.id, id)).get(); }
  createUnit(u: InsertUnit) { return db.insert(schema.units).values(u).returning().get(); }
  updateUnit(id: number, u: Partial<InsertUnit>) {
    return db.update(schema.units).set(u).where(eq(schema.units.id, id)).returning().get();
  }
  deleteUnit(id: number) { db.delete(schema.units).where(eq(schema.units.id, id)).run(); }

  // Operations
  getOperations() { return db.select().from(schema.operations).all(); }
  getOperation(id: number) { return db.select().from(schema.operations).where(eq(schema.operations.id, id)).get(); }
  createOperation(o: InsertOperation) { return db.insert(schema.operations).values(o).returning().get(); }
  updateOperation(id: number, o: Partial<InsertOperation>) {
    return db.update(schema.operations).set(o).where(eq(schema.operations.id, id)).returning().get();
  }
  deleteOperation(id: number) { db.delete(schema.operations).where(eq(schema.operations.id, id)).run(); }

  // Intel
  getIntelReports() { return db.select().from(schema.intelReports).orderBy(desc(schema.intelReports.id)).all(); }
  getIntelReport(id: number) { return db.select().from(schema.intelReports).where(eq(schema.intelReports.id, id)).get(); }
  createIntelReport(r: InsertIntelReport) { return db.insert(schema.intelReports).values(r).returning().get(); }
  updateIntelReport(id: number, r: Partial<InsertIntelReport>) {
    return db.update(schema.intelReports).set(r).where(eq(schema.intelReports.id, id)).returning().get();
  }
  deleteIntelReport(id: number) { db.delete(schema.intelReports).where(eq(schema.intelReports.id, id)).run(); }

  // Comms — message content encrypted at rest
  getCommsLog() {
    return db.select().from(schema.commsLog).orderBy(desc(schema.commsLog.id)).all()
      .map(m => ({ ...m, message: decrypt(m.message) }));
  }
  createCommsEntry(c: InsertCommsLog) {
    const encrypted = { ...c, message: encrypt(c.message) };
    const stored = db.insert(schema.commsLog).values(encrypted).returning().get();
    return { ...stored, message: c.message }; // return plaintext to caller
  }
  acknowledgeComms(id: number) {
    return db.update(schema.commsLog).set({ acknowledged: true }).where(eq(schema.commsLog.id, id)).returning().get();
  }

  // Assets
  getAssets() { return db.select().from(schema.assets).all(); }
  getAsset(id: number) { return db.select().from(schema.assets).where(eq(schema.assets.id, id)).get(); }
  createAsset(a: InsertAsset) { return db.insert(schema.assets).values(a).returning().get(); }
  updateAsset(id: number, a: Partial<InsertAsset>) {
    return db.update(schema.assets).set(a).where(eq(schema.assets.id, id)).returning().get();
  }
  deleteAsset(id: number) { db.delete(schema.assets).where(eq(schema.assets.id, id)).run(); }

  // Threats
  getThreats() { return db.select().from(schema.threats).orderBy(desc(schema.threats.id)).all(); }
  createThreat(t: InsertThreat) { return db.insert(schema.threats).values(t).returning().get(); }
  updateThreat(id: number, t: Partial<InsertThreat>) {
    return db.update(schema.threats).set(t).where(eq(schema.threats.id, id)).returning().get();
  }
  deleteTheat(id: number) { db.delete(schema.threats).where(eq(schema.threats.id, id)).run(); }
}

export const storage = new Storage();
