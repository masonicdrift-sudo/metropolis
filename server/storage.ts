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
  GroupChat,
  IsofacDoc, InsertIsofacDoc,
  Perstat, InsertPerstat,
  AfterActionReport, InsertAar,
  OpTask, InsertOpTask,
  Award, InsertAward,
  TrainingRecord, InsertTraining,
  Broadcast, InsertBroadcast,
} from "@shared/schema";

// Use persistent disk path on Render if it exists, fallback to local
import { existsSync, mkdirSync } from "fs";
const RENDER_DISK = "/var/data";
const DB_PATH = process.env.NODE_ENV === "production" && existsSync(RENDER_DISK)
  ? `${RENDER_DISK}/tacedge.db`
  : "tacedge.db";
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite, { schema });

// Initialize tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS isofac_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'UNCLASS',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    content TEXT NOT NULL DEFAULT '',
    attachments TEXT NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    op_name TEXT DEFAULT '',
    target_grid TEXT DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS group_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    members TEXT NOT NULL DEFAULT '[]'
  );
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
    deleted INTEGER DEFAULT 0,
    attachment TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_username);
`); // safe to call even if tables exist

// Add columns that may not exist on older DBs
try { sqlite.exec(`ALTER TABLE messages ADD COLUMN attachment TEXT DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN rank TEXT DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN assigned_unit TEXT DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE intel_reports ADD COLUMN images TEXT NOT NULL DEFAULT '[]'`); } catch {}

// New feature tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS perstat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    duty_status TEXT NOT NULL DEFAULT 'active',
    last_seen TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS after_action_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    operation_id INTEGER DEFAULT 0,
    operation_name TEXT DEFAULT '',
    date TEXT NOT NULL,
    submitted_by TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'UNCLASS',
    summary TEXT NOT NULL DEFAULT '',
    what_went_well TEXT NOT NULL DEFAULT '',
    sustain_items TEXT NOT NULL DEFAULT '',
    improve_items TEXT NOT NULL DEFAULT '',
    lessons_learned TEXT NOT NULL DEFAULT '',
    casualties TEXT NOT NULL DEFAULT '',
    equipment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS op_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'PREP',
    assigned_to TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    award_name TEXT NOT NULL,
    award_type TEXT NOT NULL DEFAULT 'commendation',
    reason TEXT NOT NULL DEFAULT '',
    awarded_by TEXT NOT NULL,
    awarded_at TEXT NOT NULL,
    related_op_id INTEGER DEFAULT 0,
    related_op_name TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS training_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    event_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    date TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'pass',
    instructor TEXT DEFAULT '',
    expires_at TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'flash',
    sent_by TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    expires_at TEXT DEFAULT '',
    active INTEGER DEFAULT 1
  );
`);

sqlite.exec(`
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

// No demo data seeded — start clean

export interface IStorage {
  // ISOFAC
  getIsofacDocs(): IsofacDoc[];
  getIsofacDoc(id: number): IsofacDoc | undefined;
  createIsofacDoc(d: InsertIsofacDoc): IsofacDoc;
  updateIsofacDoc(id: number, d: Partial<InsertIsofacDoc>): IsofacDoc | undefined;
  deleteIsofacDoc(id: number): void;
  // Group Chats
  getGroupsForUser(username: string): GroupChat[];
  getAllGroups(): GroupChat[];
  getGroup(id: number): GroupChat | undefined;
  createGroup(name: string, createdBy: string, members: string[]): GroupChat;
  addGroupMember(id: number, username: string): GroupChat | undefined;
  removeGroupMember(id: number, username: string): GroupChat | undefined;
  deleteGroup(id: number): void;
  getGroupMessages(groupId: number, limit?: number): Message[];
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
  sendMessage(from: string, to: string, content: string, attachment?: string): Message;
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
  updateUserById(id: number, updates: Partial<User>): User | undefined;
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
  deleteCommsEntry(id: number): void;
  clearCommsLog(): void;
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
  // PERSTAT
  getPerstat(): Perstat[];
  upsertPerstat(username: string, dutyStatus: string, notes?: string): Perstat;
  // After Action Reports
  getAars(): AfterActionReport[];
  getAar(id: number): AfterActionReport | undefined;
  createAar(a: InsertAar): AfterActionReport;
  updateAar(id: number, a: Partial<InsertAar>): AfterActionReport | undefined;
  deleteAar(id: number): void;
  // Op Tasks
  getOpTasks(operationId: number): OpTask[];
  createOpTask(t: InsertOpTask): OpTask;
  updateOpTask(id: number, t: Partial<InsertOpTask>): OpTask | undefined;
  deleteOpTask(id: number): void;
  // Awards
  getAwards(username?: string): Award[];
  createAward(a: InsertAward): Award;
  deleteAward(id: number): void;
  // Training
  getTrainingRecords(username?: string): TrainingRecord[];
  createTrainingRecord(t: InsertTraining): TrainingRecord;
  updateTrainingRecord(id: number, t: Partial<InsertTraining>): TrainingRecord | undefined;
  deleteTrainingRecord(id: number): void;
  // Broadcasts
  getBroadcasts(): Broadcast[];
  getActiveBroadcasts(): Broadcast[];
  createBroadcast(b: InsertBroadcast): Broadcast;
  dismissBroadcast(id: number): void;
  deleteBroadcast(id: number): void;
}

export class Storage implements IStorage {
  // ISOFAC
  getIsofacDocs() { return db.select().from(schema.isofacDocs).orderBy(desc(schema.isofacDocs.id)).all(); }
  getIsofacDoc(id: number) { return db.select().from(schema.isofacDocs).where(eq(schema.isofacDocs.id, id)).get(); }
  createIsofacDoc(d: InsertIsofacDoc) { return db.insert(schema.isofacDocs).values(d).returning().get(); }
  updateIsofacDoc(id: number, d: Partial<InsertIsofacDoc>) {
    return db.update(schema.isofacDocs).set({ ...d, updatedAt: new Date().toISOString() })
      .where(eq(schema.isofacDocs.id, id)).returning().get();
  }
  deleteIsofacDoc(id: number) { db.delete(schema.isofacDocs).where(eq(schema.isofacDocs.id, id)).run(); }

  // Group Chats
  getGroupsForUser(username: string): GroupChat[] {
    return db.select().from(schema.groupChats).all()
      .filter(g => JSON.parse(g.members || "[]").includes(username));
  }
  getAllGroups(): GroupChat[] {
    return db.select().from(schema.groupChats).orderBy(desc(schema.groupChats.id)).all();
  }
  getGroup(id: number): GroupChat | undefined {
    return db.select().from(schema.groupChats).where(eq(schema.groupChats.id, id)).get();
  }
  createGroup(name: string, createdBy: string, members: string[]): GroupChat {
    // Always include creator
    const allMembers = Array.from(new Set([createdBy, ...members]));
    return db.insert(schema.groupChats).values({
      name,
      createdBy,
      createdAt: new Date().toISOString(),
      members: JSON.stringify(allMembers),
    }).returning().get();
  }
  addGroupMember(id: number, username: string): GroupChat | undefined {
    const g = this.getGroup(id);
    if (!g) return undefined;
    const members = JSON.parse(g.members || "[]");
    if (!members.includes(username)) members.push(username);
    return db.update(schema.groupChats).set({ members: JSON.stringify(members) })
      .where(eq(schema.groupChats.id, id)).returning().get();
  }
  removeGroupMember(id: number, username: string): GroupChat | undefined {
    const g = this.getGroup(id);
    if (!g) return undefined;
    const members = JSON.parse(g.members || "[]").filter((m: string) => m !== username);
    return db.update(schema.groupChats).set({ members: JSON.stringify(members) })
      .where(eq(schema.groupChats.id, id)).returning().get();
  }
  deleteGroup(id: number): void {
    db.delete(schema.groupChats).where(eq(schema.groupChats.id, id)).run();
  }
  getGroupMessages(groupId: number, limit = 200): Message[] {
    const tag = `GROUP:${groupId}`;
    return db.select().from(schema.messages)
      .where(eq(schema.messages.toUsername, tag))
      .orderBy(schema.messages.id)
      .all().slice(-limit).map(m => this.decryptMsg(m));
  }

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
  sendMessage(from: string, to: string, content: string, attachment = ""): Message {
    const stored = db.insert(schema.messages).values({
      fromUsername: from,
      toUsername: to,
      content: content ? encrypt(content) : encrypt("[file]"),
      sentAt: new Date().toISOString(),
      readBy: JSON.stringify({ [from]: true }),
      deleted: false,
      attachment,
    }).returning().get();
    return { ...stored, content: content || "[file]", attachment };
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
      rank: schema.users.rank,
      assignedUnit: schema.users.assignedUnit,
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
  updateUserById(id: number, updates: Partial<User>) {
    return db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning().get();
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
  deleteCommsEntry(id: number) {
    db.delete(schema.commsLog).where(eq(schema.commsLog.id, id)).run();
  }
  clearCommsLog() {
    db.delete(schema.commsLog).run();
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

  // PERSTAT
  getPerstat() { return db.select().from(schema.perstat).all(); }
  upsertPerstat(username: string, dutyStatus: string, notes = ""): Perstat {
    const existing = db.select().from(schema.perstat).where(eq(schema.perstat.username, username)).get();
    const now = new Date().toISOString();
    if (existing) {
      return db.update(schema.perstat).set({ dutyStatus, lastSeen: now, notes })
        .where(eq(schema.perstat.username, username)).returning().get()!;
    }
    return db.insert(schema.perstat).values({ username, dutyStatus, lastSeen: now, notes }).returning().get();
  }

  // After Action Reports
  getAars() { return db.select().from(schema.afterActionReports).orderBy(desc(schema.afterActionReports.id)).all(); }
  getAar(id: number) { return db.select().from(schema.afterActionReports).where(eq(schema.afterActionReports.id, id)).get(); }
  createAar(a: InsertAar) { return db.insert(schema.afterActionReports).values(a).returning().get(); }
  updateAar(id: number, a: Partial<InsertAar>) {
    return db.update(schema.afterActionReports).set(a).where(eq(schema.afterActionReports.id, id)).returning().get();
  }
  deleteAar(id: number) { db.delete(schema.afterActionReports).where(eq(schema.afterActionReports.id, id)).run(); }

  // Op Tasks
  getOpTasks(operationId: number) {
    return db.select().from(schema.opTasks).where(eq(schema.opTasks.operationId, operationId)).all();
  }
  createOpTask(t: InsertOpTask) { return db.insert(schema.opTasks).values(t).returning().get(); }
  updateOpTask(id: number, t: Partial<InsertOpTask>) {
    return db.update(schema.opTasks).set(t).where(eq(schema.opTasks.id, id)).returning().get();
  }
  deleteOpTask(id: number) { db.delete(schema.opTasks).where(eq(schema.opTasks.id, id)).run(); }

  // Awards
  getAwards(username?: string) {
    const all = db.select().from(schema.awards).orderBy(desc(schema.awards.id)).all();
    return username ? all.filter(a => a.username === username) : all;
  }
  createAward(a: InsertAward) { return db.insert(schema.awards).values(a).returning().get(); }
  deleteAward(id: number) { db.delete(schema.awards).where(eq(schema.awards.id, id)).run(); }

  // Training Records
  getTrainingRecords(username?: string) {
    const all = db.select().from(schema.trainingRecords).orderBy(desc(schema.trainingRecords.id)).all();
    return username ? all.filter(r => r.username === username) : all;
  }
  createTrainingRecord(t: InsertTraining) { return db.insert(schema.trainingRecords).values(t).returning().get(); }
  updateTrainingRecord(id: number, t: Partial<InsertTraining>) {
    return db.update(schema.trainingRecords).set(t).where(eq(schema.trainingRecords.id, id)).returning().get();
  }
  deleteTrainingRecord(id: number) { db.delete(schema.trainingRecords).where(eq(schema.trainingRecords.id, id)).run(); }

  // Broadcasts
  getBroadcasts() { return db.select().from(schema.broadcasts).orderBy(desc(schema.broadcasts.id)).all(); }
  getActiveBroadcasts() {
    return db.select().from(schema.broadcasts).all().filter(b => {
      if (!b.active) return false;
      if (b.expiresAt && new Date(b.expiresAt) < new Date()) return false;
      return true;
    });
  }
  createBroadcast(b: InsertBroadcast) { return db.insert(schema.broadcasts).values(b).returning().get(); }
  dismissBroadcast(id: number) { db.update(schema.broadcasts).set({ active: false }).where(eq(schema.broadcasts.id, id)).run(); }
  deleteBroadcast(id: number) { db.delete(schema.broadcasts).where(eq(schema.broadcasts.id, id)).run(); }
}

export const storage = new Storage();
