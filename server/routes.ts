import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { upload } from "./upload";
import { z } from "zod";
import {
  insertUnitSchema, insertOperationSchema, insertIntelReportSchema,
  insertCommsLogSchema, insertAssetSchema, insertThreatSchema,
  ACCESS_RANK,
} from "@shared/schema";
import type { TacticalMapRangeRing } from "@shared/schema";
import ms from "milsymbol";
import { resolveMarkerSidc, sidcForAffiliation } from "@shared/natoSidc";

const TERRAIN_DIR = path.resolve(process.cwd(), "TDL_TerrainExport", "TDL_TerrainExport");

/** Any of these suffixes identifies a TDL terrain export file; the stem is the map id (e.g. Everon_water.geojson → Everon). */
const TERRAIN_FILE_SUFFIXES = [
  "_metadata.json",
  "_water.geojson",
  "_roads.geojson",
  "_pois.geojson",
  "_structures.geojson",
  "_contours.geojson",
  "_vegetation.json",
  "_heightmap.asc",
  "_heightmap.json",
] as const;

function discoverTerrainMapIds(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const ids = new Set<string>();
  for (const f of files) {
    const lower = f.toLowerCase();
    for (const suf of TERRAIN_FILE_SUFFIXES) {
      if (lower.endsWith(suf.toLowerCase())) {
        const id = f.slice(0, f.length - suf.length);
        if (id.length > 0) ids.add(id);
        break;
      }
    }
  }
  return Array.from(ids).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
}

function terrainMapLabel(dir: string, id: string): string {
  const metaPath = path.join(dir, `${id}_metadata.json`);
  try {
    if (fs.existsSync(metaPath)) {
      const raw = fs.readFileSync(metaPath, "utf-8");
      const j = JSON.parse(raw) as { name?: string };
      if (j.name && typeof j.name === "string" && j.name.trim()) {
        return j.name
          .trim()
          .replace(/^GM_/i, "")
          .replace(/_/g, " ");
      }
    }
  } catch {
    /* ignore bad metadata */
  }
  return id.replace(/_/g, " ");
}

const tacticalMarkerPostSchema = z.object({
  mapKey: z.string().min(1).max(120),
  gameX: z.number(),
  gameZ: z.number(),
  /** Legacy: unit | vehicle | building | equipment, or a friendly-template SIDC from the NATO catalog. Ignored when customSidc is set. */
  markerType: z.string().min(1).max(120),
  affiliation: z.enum(["friendly", "hostile", "neutral", "unknown"]),
  label: z.string().max(200).optional().default(""),
  /** Optional 15-char friendly-template letter SIDC (2nd char F); validated with milsymbol. */
  customSidc: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().length(15).regex(/^[A-Za-z0-9*\-]+$/).optional(),
  ),
});

const tacticalMarkerPatchSchema = z.object({
  gameX: z.number(),
  gameZ: z.number(),
});

const tacticalLinePostSchema = z.object({
  mapKey: z.string().min(1).max(120),
  points: z.array(z.tuple([z.number(), z.number()])).min(2).max(500),
  label: z.string().max(200).optional().default(""),
  color: z
    .string()
    .max(32)
    .regex(/^#[0-9A-Fa-f]{3,8}$/)
    .optional()
    .default("#38bdf8"),
});

const tacticalRangeRingPostSchema = z.object({
  mapKey: z.string().min(1).max(120),
  centerX: z.number(),
  centerZ: z.number(),
  radiusMeters: z.number().min(1).max(500_000),
  label: z.string().max(200).optional().default(""),
  color: z
    .string()
    .max(32)
    .regex(/^#[0-9A-Fa-f]{3,8}$/)
    .optional()
    .default("#a855f7"),
});

const tacticalRangeRingPatchSchema = z.object({
  centerX: z.number().optional(),
  centerZ: z.number().optional(),
  radiusMeters: z.number().min(1).max(500_000).optional(),
  label: z.string().max(200).optional(),
  color: z
    .string()
    .max(32)
    .regex(/^#[0-9A-Fa-f]{3,8}$/)
    .optional(),
});

const tacticalBuildingLabelPostSchema = z.object({
  mapKey: z.string().min(1).max(120),
  featureKey: z.string().min(1).max(256),
  label: z.string().max(200).optional().default(""),
  fillColor: z
    .string()
    .max(32)
    .regex(/^#[0-9A-Fa-f]{3,8}$/)
    .optional()
    .default("#64748b"),
  strokeColor: z.string().max(48).optional().default("#94a3b8"),
});

// ── Activity Log / Links / Support Requests ───────────────────────────────────
const activityQuerySchema = z.object({
  fromTs: z.string().optional(),
  toTs: z.string().optional(),
  actorUsername: z.string().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  limit: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().optional()),
  offset: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().optional()),
});

const entityLinkPostSchema = z.object({
  aType: z.string().min(1).max(64),
  aId: z.string().min(1).max(128),
  bType: z.string().min(1).max(64),
  bId: z.string().min(1).max(128),
  relation: z.string().min(1).max(32).optional().default("related"),
  note: z.string().max(800).optional().default(""),
});

const supportRequestPostSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(40).optional().default("general"),
  priority: z.enum(["routine", "priority", "immediate", "flash"]).optional().default("routine"),
  status: z.enum(["open", "triaging", "in_progress", "closed"]).optional().default("open"),
  assignedTo: z.string().max(64).optional().default(""),
  dueAt: z.string().max(64).optional().default(""),
  details: z.string().max(8000).optional().default(""),
});
const supportRequestPatchSchema = supportRequestPostSchema.partial();

// ── Medical / Casualty ────────────────────────────────────────────────────────
const casualtyPostSchema = z.object({
  displayName: z.string().min(1).max(120),
  unit: z.string().max(120).optional().default(""),
  patientId: z.string().max(120).optional().default(""),
  classification: z.enum(["UNCLASS", "CUI", "SECRET", "TS"]).optional().default("UNCLASS"),
  status: z.enum(["open", "evac_requested", "evac_enroute", "evac_complete", "closed"]).optional().default("open"),
  precedence: z.enum(["urgent", "priority", "routine"]).optional().default("routine"),
  injury: z.string().max(800).optional().default(""),
  locationGrid: z.string().max(64).optional().default(""),
  incidentAt: z.string().min(1).max(64),
  notes: z.string().max(8000).optional().default(""),
});
const casualtyPatchSchema = casualtyPostSchema.partial();

const casualtyEvacUpsertSchema = z.object({
  casualtyId: z.number(),
  callSign: z.string().max(64).optional().default(""),
  pickupGrid: z.string().max(64).optional().default(""),
  hlzName: z.string().max(120).optional().default(""),
  destination: z.string().max(120).optional().default(""),
  platform: z.string().max(120).optional().default(""),
  requestedAt: z.string().max(64).optional().default(""),
  eta: z.string().max(64).optional().default(""),
  nineLineJson: z.string().max(50000).optional().default(""),
});

const casualtyTreatmentPostSchema = z.object({
  casualtyId: z.number(),
  ts: z.string().min(1).max(64),
  note: z.string().min(1).max(4000),
});

const approvalPostSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128),
  action: z.string().min(1).max(32),
  requestedNote: z.string().max(2000).optional().default(""),
  payloadJson: z.string().max(50000).optional().default(""),
});

const approvalDecisionSchema = z.object({
  decisionNote: z.string().max(2000).optional().default(""),
});

// Rate limiter: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't expose rate limit info that could help attackers
  skipSuccessfulRequests: true,
});

// Helper: strip passwordHash before sending any user object
function safeUser(user: any) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// Helper: push a WS event to all connected clients
function wsPush(type: string, extra?: object) {
  const broadcast = (global as any).__wsBroadcast;
  if (broadcast) broadcast({ type, ...extra });
}

function appendActivity(
  req: Request,
  e: {
    action: string;
    entityType: string;
    entityId?: string | number;
    summary?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  try {
    const ip =
      typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0].trim()
        : req.socket.remoteAddress || "";
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
    storage.appendActivity({
      ts: new Date().toISOString(),
      actorUsername: req.session.username || "unknown",
      actorRole: req.session.accessLevel || "user",
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId != null ? String(e.entityId) : "",
      summary: e.summary || "",
      beforeJson: e.before !== undefined ? JSON.stringify(e.before) : "",
      afterJson: e.after !== undefined ? JSON.stringify(e.after) : "",
      ip,
      userAgent: ua,
    });
    wsPush("ACTIVITY");
  } catch {
    // Never block the primary action if audit logging fails
  }
}

/** @username tokens in message text (matches client parsing). */
function extractMentionUsernames(content: string): string[] {
  const re = /@([A-Za-z0-9_-]{2,48})/g;
  const found = new Set<string>();
  let m;
  while ((m = re.exec(content)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

/** WebSocket ping to each mentioned user (general / group). */
function pushMentionPings(
  content: string,
  fromUsername: string,
  scope: "general" | "group",
  allowedUsernames: string[],
  extra: { groupId?: number; groupName?: string },
) {
  const broadcast = (global as any).__wsBroadcast as
    | ((msg: object, toUsernames?: string[]) => void)
    | undefined;
  if (!broadcast || !content.trim()) return;
  const allow = new Set(allowedUsernames.filter((u) => u !== fromUsername));
  const mentioned = extractMentionUsernames(content).filter((u) => allow.has(u));
  const uniq = Array.from(new Set(mentioned));
  const snippet = content.trim().slice(0, 160);
  for (const target of uniq) {
    broadcast(
      {
        type: "MENTION",
        scope,
        fromUsername,
        snippet,
        ...extra,
      },
      [target],
    );
  }
}

// Middleware: require logged-in session
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Middleware: require admin or higher
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if ((ACCESS_RANK[req.session.accessLevel || ""] ?? 0) < ACCESS_RANK.admin) return res.status(403).json({ error: "Forbidden" });
  next();
}

// Middleware: require owner role only
function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.accessLevel !== "owner") return res.status(403).json({ error: "Forbidden — Owner only" });
  next();
}

export function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  // TDL terrain GeoJSON (Workbench exporter — see AG0_TDLTerrainExporterPlugin.c at repo root)
  if (fs.existsSync(TERRAIN_DIR)) {
    app.use("/terrain-data", express.static(TERRAIN_DIR, { index: false, maxAge: "2h" }));
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    // Generic error — never reveal whether username or password was wrong
    if (!username || !password) {
      appendActivity(req, { action: "LOGIN_FAIL", entityType: "user_session", summary: "Login failed (missing credentials)" });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = storage.getUserByUsername(username);
    // Always run bcrypt compare to prevent timing attacks (even if user not found)
    const dummyHash = "$2a$10$invalidhashfortimingprotection000000000000000000000000";
    const valid = user ? bcrypt.compareSync(password, user.passwordHash) : bcrypt.compareSync(password, dummyHash);
    if (!user || !valid) {
      appendActivity(req, { action: "LOGIN_FAIL", entityType: "user_session", summary: `Login failed for ${String(username).trim().slice(0, 48)}` });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    storage.updateLastLogin(user.id);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.accessLevel = user.accessLevel;
    req.session.tacticalRole = user.role || "";
    appendActivity(req, { action: "LOGIN", entityType: "user_session", entityId: user.id, summary: `Login: ${user.username}`, after: { username: user.username, accessLevel: user.accessLevel } });
    // Only return safe fields — never the hash
    res.json({
      id: user.id,
      username: user.username,
      accessLevel: user.accessLevel,
      role: user.role || "",
      rank: user.rank || "",
      assignedUnit: user.assignedUnit || "",
      milIdNumber: user.milIdNumber || "",
      mos: user.mos || "",
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    appendActivity(req, { action: "LOGOUT", entityType: "user_session", entityId: req.session?.userId || "", summary: `Logout: ${req.session?.username || "unknown"}` });
    req.session.destroy(() => res.json({ ok: true }));
  });

  // Change own password
  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) return res.status(401).json({ error: "Current password is incorrect" });
    storage.updateUserById(user.id, { passwordHash: bcrypt.hashSync(newPassword, 10) });
    res.json({ ok: true });
  });

  // Change own display username (password required); propagates name across messages, groups, training, etc.
  app.post("/api/auth/change-username", requireAuth, (req, res) => {
    const { newUsername, currentPassword } = req.body;
    const trimmed = typeof newUsername === "string" ? newUsername.trim() : "";
    if (!trimmed || !currentPassword) return res.status(400).json({ error: "New username and current password required" });
    if (trimmed.length < 2 || trimmed.length > 48) return res.status(400).json({ error: "Username must be 2–48 characters" });
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) return res.status(401).json({ error: "Current password is incorrect" });
    if (trimmed === user.username) return res.status(400).json({ error: "That is already your username" });
    if (storage.getUserByUsername(trimmed)) return res.status(409).json({ error: "Username already taken" });
    const updated = storage.changeUsername(user.id, user.username, trimmed);
    if (!updated) return res.status(500).json({ error: "Failed to update username" });
    req.session.username = updated.username;
    wsPush("USER");
    res.json({
      id: updated.id,
      username: updated.username,
      role: updated.role,
      rank: updated.rank || "",
      assignedUnit: updated.assignedUnit || "",
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });
    const user = storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Not logged in" });
    res.json({
      id: user.id,
      username: user.username,
      accessLevel: user.accessLevel,
      role: user.role || "",
      rank: user.rank || "",
      assignedUnit: user.assignedUnit || "",
      milIdNumber: user.milIdNumber || "",
      mos: user.mos || "",
    });
  });

  // ── Public registration with access code ─────────────────────────────────
  const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: "Too many registration attempts." } });
  app.post("/api/auth/register", registerLimiter, (req, res) => {
    const { username, password, accessCode } = req.body;
    if (!username || !password || !accessCode) return res.status(400).json({ error: "Username, password, and access code required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const exists = storage.getUserByUsername(username);
    if (exists) return res.status(409).json({ error: "Username already taken" });
    // Validate and redeem the code atomically
    const redeemed = storage.validateAndRedeemCode(accessCode, username);
    if (!redeemed) return res.status(403).json({ error: "Invalid or expired access code" });
    const user = storage.createUser(username, password, "user");
    // Auto log in
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.accessLevel = user.accessLevel;
    req.session.tacticalRole = user.role || "";
    res.status(201).json(safeUser(user));
  });

  // ── Access codes (Owner only) ────────────────────────────────────────────
  app.get("/api/access-codes", requireOwner, (_, res) => res.json(storage.getAccessCodes()));
  app.post("/api/access-codes", requireOwner, (req, res) => {
    const code = storage.generateAccessCode(req.session.username!, req.body.expiresAt || "");
    res.status(201).json(code);
  });
  app.delete("/api/access-codes/:id", requireOwner, (req, res) => {
    storage.deleteAccessCode(Number(req.params.id));
    res.status(204).send();
  });

  // ── User management (admin+ can list/create, only owner can delete admins) ───
  app.get("/api/users", requireAdmin, (_, res) => res.json(storage.getUsers()));
  /** Roster for any logged-in user — DMs, @mentions (no admin required). */
  app.get("/api/users/directory", requireAuth, (_, res) => {
    res.json(
      storage.getUsers().map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
      })),
    );
  });
  app.post("/api/users", requireAdmin, (req, res) => {
    const { username, password, accessLevel, role, rank, assignedUnit, milIdNumber, mos } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    // Role creation rules:
    //  - Owner (rank 3): can create Owner, Admin, Operator
    //  - Admin (rank 2): can create Admin and Operator, NOT Owner
    //  - Operator (rank 1): cannot create anyone (blocked by requireAdmin above)
    const requestedAccess = accessLevel || "user";
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const targetRank = ACCESS_RANK[requestedAccess] ?? 0;
    if (targetRank > callerRank) return res.status(403).json({ error: "Cannot create a user with a role higher than your own" });
    const exists = storage.getUserByUsername(username);
    if (exists) return res.status(409).json({ error: "Username already exists" });
    const user = storage.createUser(username, password, requestedAccess, {
      rank: typeof rank === "string" ? rank : "",
      assignedUnit: typeof assignedUnit === "string" ? assignedUnit : "",
      milIdNumber:
        typeof milIdNumber === "string" ? milIdNumber.trim().slice(0, 64) : "",
      mos: typeof mos === "string" ? mos.trim().slice(0, 32) : "",
    });
    if (typeof role === "string") {
      storage.updateUserById(user.id, { role: role.trim().slice(0, 64) });
    }
    appendActivity(req, {
      action: "CREATE",
      entityType: "user",
      entityId: user.id,
      summary: `Created user: ${user.username} (${user.accessLevel})`,
      after: { id: user.id, username: user.username, accessLevel: user.accessLevel, role: user.role || "" },
    });
    res.status(201).json(safeUser(user));
  });
  // Owner-only: edit any user's username, role, or reset password
  app.patch("/api/users/:id", requireOwner, (req, res) => {
    const id = Number(req.params.id);
    const { username, accessLevel, role, password } = req.body;
    const target = storage.getUserById(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const beforeSafe = { id: target.id, username: target.username, accessLevel: target.accessLevel, role: target.role || "" };
    // Build update payload
    const updates: Record<string, any> = {};
    if (username && username !== target.username) {
      const exists = storage.getUserByUsername(username);
      if (exists) return res.status(409).json({ error: "Username already taken" });
      updates.username = username;
    }
    if (accessLevel && ACCESS_RANK[accessLevel] !== undefined) {
      updates.accessLevel = accessLevel;
    }
    if (typeof role === "string") {
      updates.role = role.trim().slice(0, 64);
    }
    if (typeof req.body.rank !== "undefined") {
      updates.rank = req.body.rank;
    }
    if (typeof req.body.assignedUnit !== "undefined") {
      updates.assignedUnit = req.body.assignedUnit;
    }
    if (typeof req.body.milIdNumber !== "undefined") {
      updates.milIdNumber =
        typeof req.body.milIdNumber === "string"
          ? req.body.milIdNumber.trim().slice(0, 64)
          : "";
    }
    if (typeof req.body.mos !== "undefined") {
      updates.mos =
        typeof req.body.mos === "string" ? req.body.mos.trim().slice(0, 32) : "";
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const bcrypt = require("bcryptjs");
      updates.passwordHash = bcrypt.hashSync(password, 10);
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const updated = storage.updateUserById(id, updates); wsPush("USER");
    const { passwordHash, ...safe } = updated as any;
    appendActivity(req, {
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      summary: `Updated user: ${beforeSafe.username} → ${(safe as any).username || beforeSafe.username}`,
      before: beforeSafe,
      after: { id: (safe as any).id, username: (safe as any).username, accessLevel: (safe as any).accessLevel, role: (safe as any).role || "" },
    });
    res.json(safe);
  });

  app.delete("/api/users/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot delete your own account" });
    // Check target user's role — you can only delete users with lower rank than you
    const target = storage.getUserById(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const targetRank = ACCESS_RANK[target.accessLevel] ?? 0;
    if (targetRank >= callerRank) return res.status(403).json({ error: "Cannot delete a user with equal or higher role" });
    storage.deleteUser(id);
    appendActivity(req, { action: "DELETE", entityType: "user", entityId: id, summary: `Deleted user: ${target.username} (${target.accessLevel})`, before: { id: target.id, username: target.username, accessLevel: target.accessLevel, role: target.role || "" } });
    res.status(204).send();
  });

  // ── File Upload (images/files for messages and ISOFAC) ────────────────────────
  app.post("/api/upload", requireAuth, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      url,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  });

  // ── ISOFAC Documents ───────────────────────────────────────────────────
  app.get("/api/isofac", requireAuth, (_, res) => res.json(storage.getIsofacDocs()));
  app.get("/api/isofac/:id", requireAuth, (req, res) => {
    const doc = storage.getIsofacDoc(Number(req.params.id));
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  });
  app.post("/api/isofac", requireAuth, (req, res) => {
    const now = new Date().toISOString();
    const idoc2 = storage.createIsofacDoc({
      ...req.body,
      createdBy: req.session.username!,
      createdAt: now,
      updatedAt: now,
      attachments: req.body.attachments || "[]",
      tags: req.body.tags || "[]",
    });
    wsPush("ISOFAC");
    appendActivity(req, {
      action: "CREATE",
      entityType: "isofac",
      entityId: idoc2.id,
      summary: `Created ISOFAC doc: ${idoc2.title}`,
      after: { id: idoc2.id, type: idoc2.type, title: idoc2.title, status: idoc2.status, classification: idoc2.classification },
    });
    res.status(201).json(idoc2);
  });
  app.patch("/api/isofac/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getIsofacDoc(id);
    const doc = storage.updateIsofacDoc(id, req.body);
    if (!doc) return res.status(404).json({ error: "Not found" });
    wsPush("ISOFAC");
    appendActivity(req, {
      action: "UPDATE",
      entityType: "isofac",
      entityId: doc.id,
      summary: `Updated ISOFAC doc: ${doc.title}`,
      before: before ? { id: before.id, type: before.type, title: before.title, status: before.status, classification: before.classification } : undefined,
      after: { id: doc.id, type: doc.type, title: doc.title, status: doc.status, classification: doc.classification },
    });
    res.json(doc);
  });

  app.post("/api/isofac/:id/release", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const releasability = typeof req.body?.releasability === "string" ? req.body.releasability.trim() : "";
    if (!releasability) return res.status(400).json({ error: "releasability required" });
    const before = storage.getIsofacDoc(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    // Tactical default: require 2-person integrity for partner release (admin/owner only approve).
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    if (!isStaff) {
      return res.status(403).json({ error: "Only admin/owner can request partner release (approval required)" });
    }
    const now = new Date().toISOString();
    const approval = storage.createApproval({
      entityType: "isofac_release",
      entityId: String(id),
      action: "RELEASE",
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: "",
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({ releasability }),
    });
    wsPush("APPROVALS");
    appendActivity(req, { action: "CREATE", entityType: "approval", entityId: approval.id, summary: `Requested ISOFAC release approval for doc ${id} (${before.title})` , after: approval });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });
  app.delete("/api/isofac/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getIsofacDoc(id);
    storage.deleteIsofacDoc(id);
    wsPush("ISOFAC");
    appendActivity(req, {
      action: "DELETE",
      entityType: "isofac",
      entityId: id,
      summary: `Deleted ISOFAC doc: ${before?.title ?? id}`,
      before: before ? { id: before.id, type: before.type, title: before.title, status: before.status, classification: before.classification } : undefined,
    });
    res.status(204).send();
  });

  // ── Commo Cards ────────────────────────────────────────────────────────────────
  app.get("/api/commo-cards", requireAuth, (_, res) => res.json(storage.getCommoCards()));
  app.get("/api/commo-cards/active", requireAuth, (_, res) => {
    const cards = storage.getCommoCards();
    const active = cards.find(c => c.active) || cards[0] || null;
    res.json(active);
  });
  app.post("/api/commo-cards", requireAdmin, (req, res) => {
    const card = storage.createCommoCard({ ...req.body, createdBy: req.session.username!, createdAt: new Date().toISOString() });
    res.status(201).json(card);
  });
  app.patch("/api/commo-cards/:id", requireAdmin, (req, res) => {
    const card = storage.updateCommoCard(Number(req.params.id), req.body);
    if (!card) return res.status(404).json({ error: "Not found" });
    res.json(card);
  });
  app.patch("/api/commo-cards/:id/activate", requireAdmin, (req, res) => {
    storage.setActiveCard(Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete("/api/commo-cards/:id", requireAdmin, (req, res) => {
    storage.deleteCommoCard(Number(req.params.id));
    res.status(204).send();
  });

  // ── Group Chats ────────────────────────────────────────────────────────────
  // Get groups the current user is a member of
  app.get("/api/groups", requireAuth, (req, res) => {
    res.json(storage.getGroupsForUser(req.session.username!));
  });
  // Create a new group
  app.post("/api/groups", requireAuth, (req, res) => {
    const { name, members } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Group name required" });
    if (!Array.isArray(members) || members.length < 1)
      return res.status(400).json({ error: "At least one other member required" });
    const group = storage.createGroup(name.trim(), req.session.username!, members);
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "GROUP_CREATED", group }, JSON.parse(group.members));
    res.status(201).json(group);
  });
  // Get group messages
  app.get("/api/groups/:id/messages", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const group = storage.getGroup(id);
    if (!group) return res.status(404).json({ error: "Not found" });
    const members = JSON.parse(group.members || "[]");
    if (!members.includes(req.session.username!)) return res.status(403).json({ error: "Not a member" });
    res.json(storage.getGroupMessages(id));
  });
  // Send a group message
  app.post("/api/groups/:id/messages", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const group = storage.getGroup(id);
    if (!group) return res.status(404).json({ error: "Not found" });
    const members = JSON.parse(group.members || "[]");
    if (!members.includes(req.session.username!)) return res.status(403).json({ error: "Not a member" });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const { attachment } = req.body;
    const text = content.trim();
    const msg = storage.sendMessage(req.session.username!, `GROUP:${id}`, text, attachment || "");
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "GROUP_MESSAGE", groupId: id, message: msg }, members);
    pushMentionPings(text, req.session.username!, "group", members, {
      groupId: id,
      groupName: group.name,
    });
    res.status(201).json(msg);
  });
  // Add member to group (creator or admin+)
  app.post("/api/groups/:id/members", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const group = storage.getGroup(id);
    if (!group) return res.status(404).json({ error: "Not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    if (group.createdBy !== req.session.username && callerRank < ACCESS_RANK.admin)
      return res.status(403).json({ error: "Only group creator or admin can add members" });
    const { username } = req.body;
    const updated = storage.addGroupMember(id, username);
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "GROUP_UPDATED", group: updated }, JSON.parse(updated!.members));
    res.json(updated);
  });
  // Leave a group
  app.delete("/api/groups/:id/members/me", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const updated = storage.removeGroupMember(id, req.session.username!);
    res.json(updated);
  });
  // Delete a group (creator or admin+)
  app.delete("/api/groups/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const group = storage.getGroup(id);
    if (!group) return res.status(404).json({ error: "Not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    if (group.createdBy !== req.session.username && callerRank < ACCESS_RANK.admin)
      return res.status(403).json({ error: "Only group creator or admin can delete" });
    storage.deleteGroup(id);
    res.status(204).send();
  });

  // ── Messaging ────────────────────────────────────────────────────────────────
  // General channel
  app.get("/api/messages/general", requireAuth, (req, res) => {
    const msgs = storage.getGeneralMessages();
    // Mark all as read for this user
    const me = req.session.username!;
    msgs.forEach(m => {
      if (m.fromUsername !== me) {
        const readBy = JSON.parse(m.readBy || "{}");
        if (!readBy[me]) {
          readBy[me] = true;
          const { eq } = require("drizzle-orm");
        }
      }
    });
    res.json(msgs);
  });

  app.post("/api/messages/general", requireAuth, (req, res) => {
    const { content, attachment } = req.body;
    if (!content?.trim() && !attachment) return res.status(400).json({ error: "Content or attachment required" });
    const text = content?.trim() || "";
    const msg = storage.sendMessage(req.session.username!, "GENERAL", text, attachment || "");
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "GENERAL_MESSAGE", message: msg });
    if (text) {
      const allNames = storage.getUsers().map((u) => u.username);
      pushMentionPings(text, req.session.username!, "general", allNames, {});
    }
    res.status(201).json(msg);
  });

  // DM list for current user
  app.get("/api/messages/dms", requireAuth, (req, res) => {
    res.json(storage.getDMList(req.session.username!));
  });

  // DM conversation with a specific user
  app.get("/api/messages/dm/:username", requireAuth, (req, res) => {
    const me = req.session.username!;
    const other = String(Array.isArray(req.params.username) ? req.params.username[0] : req.params.username);
    const msgs = storage.getDMConversation(me, other);
    // Mark as read
    storage.markRead(other, me, me);
    res.json(msgs);
  });

  app.post("/api/messages/dm/:username", requireAuth, (req, res) => {
    const { content, attachment } = req.body;
    if (!content?.trim() && !attachment) return res.status(400).json({ error: "Content or attachment required" });
    const me = req.session.username!;
    const to = String(Array.isArray(req.params.username) ? req.params.username[0] : req.params.username);
    if (me === to) return res.status(400).json({ error: "Cannot DM yourself" });
    const msg = storage.sendMessage(me, to, content?.trim() || "", attachment || "");
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "DM", message: msg }, [me, to]);
    res.status(201).json(msg);
  });

  // Unread counts
  app.get("/api/messages/unread", requireAuth, (req, res) => {
    const me = req.session.username!;
    res.json({
      dms: storage.getUnreadDMCount(me),
      general: storage.getUnreadGeneralCount(me),
    });
  });

  // Mark general as read
  app.post("/api/messages/general/read", requireAuth, (req, res) => {
    const me = req.session.username!;
    const msgs = storage.getGeneralMessages();
    // Mark all unread general messages as read
    msgs.forEach(m => {
      if (m.fromUsername !== me) {
        const readBy = JSON.parse(m.readBy || "{}");
        if (!readBy[me]) storage.markRead(m.fromUsername, "GENERAL", me);
      }
    });
    res.json({ ok: true });
  });

  // Delete a message (owner of message or admin+)
  app.delete("/api/messages/:id", requireAuth, (req, res) => {
    storage.deleteMessage(Number(req.params.id));
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "MESSAGE_DELETED", id: Number(req.params.id) });
    res.status(204).send();
  });

  // ── Units ────────────────────────────────────────────────────────────────────
  app.get("/api/units", requireAuth, (_, res) => res.json(storage.getUnits()));
  app.post("/api/units", requireAdmin, (req, res) => {
    const parsed = insertUnitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const unit = storage.createUnit(parsed.data); wsPush("UNIT"); res.status(201).json(unit);
  });
  app.patch("/api/units/:id", requireAdmin, (req, res) => {
    const unit = storage.updateUnit(Number(req.params.id), req.body);
    if (!unit) return res.status(404).json({ error: "Not found" });
    wsPush("UNIT"); res.json(unit);
  });
  app.delete("/api/units/:id", requireAdmin, (req, res) => {
    storage.deleteUnit(Number(req.params.id)); wsPush("UNIT");
    res.status(204).send();
  });

  // ── Operations ───────────────────────────────────────────────────────────────
  app.get("/api/operations", requireAuth, (_, res) => res.json(storage.getOperations()));
  app.post("/api/operations", requireAuth, (req, res) => {
    const parsed = insertOperationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const op = storage.createOperation(parsed.data);
    wsPush("OPERATION");
    appendActivity(req, {
      action: "CREATE",
      entityType: "operations",
      entityId: op.id,
      summary: `Created operation: ${op.name}`,
      after: op,
    });
    res.status(201).json(op);
  });
  app.patch("/api/operations/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getOperation(id);
    const op = storage.updateOperation(id, req.body);
    if (!op) return res.status(404).json({ error: "Not found" });
    wsPush("OPERATION");
    appendActivity(req, {
      action: "UPDATE",
      entityType: "operations",
      entityId: op.id,
      summary: `Updated operation: ${op.name}`,
      before,
      after: op,
    });
    res.json(op);
  });

  // Request approval for operation planning changes (admin/owner)
  app.post("/api/operations/:id/request-approval", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getOperation(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    const patch = typeof req.body === "object" && req.body ? req.body : {};
    const now = new Date().toISOString();
    const approval = storage.createApproval({
      entityType: "operations_plan",
      entityId: String(id),
      action: "UPDATE",
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: "",
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({ patch }),
    });
    wsPush("APPROVALS");
    appendActivity(req, { action: "CREATE", entityType: "approval", entityId: approval.id, summary: `Requested op plan approval for ${before.name} (${id})`, after: approval });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });
  app.delete("/api/operations/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getOperation(id);
    storage.deleteOperation(id);
    wsPush("OPERATION");
    appendActivity(req, {
      action: "DELETE",
      entityType: "operations",
      entityId: id,
      summary: `Deleted operation: ${before?.name ?? id}`,
      before,
    });
    res.status(204).send();
  });

  // ── Intel ────────────────────────────────────────────────────────────────────
  app.get("/api/intel", requireAuth, (_, res) => res.json(storage.getIntelReports()));
  app.post("/api/intel", requireAuth, (req, res) => {
    const parsed = insertIntelReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const ir = storage.createIntelReport(parsed.data);
    wsPush("INTEL");
    appendActivity(req, {
      action: "CREATE",
      entityType: "intel",
      entityId: ir.id,
      summary: `Created intel: ${ir.title}`,
      after: ir,
    });
    res.status(201).json(ir);
  });
  app.patch("/api/intel/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getIntelReport(id);
    const report = storage.updateIntelReport(id, req.body);
    if (!report) return res.status(404).json({ error: "Not found" });
    wsPush("INTEL");
    appendActivity(req, {
      action: "UPDATE",
      entityType: "intel",
      entityId: report.id,
      summary: `Updated intel: ${report.title}`,
      before,
      after: report,
    });
    res.json(report);
  });

  app.post("/api/intel/:id/release", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const releasability = typeof req.body?.releasability === "string" ? req.body.releasability.trim() : "";
    if (!releasability) return res.status(400).json({ error: "releasability required" });
    const before = storage.getIntelReport(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    if (!isStaff) {
      return res.status(403).json({ error: "Only admin/owner can request partner release (approval required)" });
    }
    const now = new Date().toISOString();
    const approval = storage.createApproval({
      entityType: "intel_release",
      entityId: String(id),
      action: "RELEASE",
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: "",
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({ releasability }),
    });
    wsPush("APPROVALS");
    appendActivity(req, { action: "CREATE", entityType: "approval", entityId: approval.id, summary: `Requested intel release approval for ${id} (${before.title})`, after: approval });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });

  // Request action on an intel report (collection/tasking) (admin/owner -> approval)
  app.post("/api/intel/:id/request-action", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const report = storage.getIntelReport(id);
    if (!report) return res.status(404).json({ error: "Not found" });
    const actionType = typeof req.body?.actionType === "string" ? req.body.actionType : "collection_request";
    const note = typeof req.body?.note === "string" ? req.body.note : "";
    const now = new Date().toISOString();
    const approval = storage.createApproval({
      entityType: "intel_action",
      entityId: String(id),
      action: "REQUEST_ACTION",
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: note,
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({ actionType }),
    });
    wsPush("APPROVALS");
    appendActivity(req, { action: "CREATE", entityType: "approval", entityId: approval.id, summary: `Requested intel action: ${id} (${report.title})`, after: approval });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });
  // Add image to intel report
  app.post("/api/intel/:id/images", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const report = storage.getIntelReport(id);
    if (!report) return res.status(404).json({ error: "Not found" });
    const images = JSON.parse(report.images || "[]");
    images.push(req.body);
    const updated = storage.updateIntelReport(id, { images: JSON.stringify(images) });
    res.json(updated);
  });
  app.delete("/api/intel/:id/images/:idx", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = Number(req.params.idx);
    const report = storage.getIntelReport(id);
    if (!report) return res.status(404).json({ error: "Not found" });
    const images = JSON.parse(report.images || "[]").filter((_: any, i: number) => i !== idx);
    const updated = storage.updateIntelReport(id, { images: JSON.stringify(images) });
    res.json(updated);
  });
  app.delete("/api/intel/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getIntelReport(id);
    storage.deleteIntelReport(id);
    wsPush("INTEL");
    appendActivity(req, {
      action: "DELETE",
      entityType: "intel",
      entityId: id,
      summary: `Deleted intel: ${before?.title ?? id}`,
      before,
    });
    res.status(204).send();
  });

  // ── Comms ────────────────────────────────────────────────────────────────────
  app.get("/api/comms", requireAuth, (_, res) => res.json(storage.getCommsLog()));
  app.post("/api/comms", requireAuth, (req, res) => {
    const parsed = insertCommsLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const cl = storage.createCommsEntry(parsed.data);
    wsPush("COMMS");
    appendActivity(req, {
      action: "CREATE",
      entityType: "comms",
      entityId: cl.id,
      summary: `Created comms message ${cl.id} (${cl.fromCallsign}→${cl.toCallsign})`,
      after: { ...cl, message: "<redacted>" },
    });
    res.status(201).json(cl);
  });
  app.patch("/api/comms/:id/ack", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getCommsLog().find((m) => m.id === id);
    const entry = storage.acknowledgeComms(id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    appendActivity(req, {
      action: "UPDATE",
      entityType: "comms",
      entityId: id,
      summary: `Acknowledged comms message ${id}`,
      before: before ? { ...before, message: "<redacted>" } : undefined,
      after: { ...entry, message: "<redacted>" },
    });
    res.json(entry);
  });
  app.delete("/api/comms/:id", requireOwner, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getCommsLog().find((m) => m.id === id);
    storage.deleteCommsEntry(id);
    appendActivity(req, {
      action: "DELETE",
      entityType: "comms",
      entityId: id,
      summary: `Deleted comms message ${id}`,
      before: before ? { ...before, message: "<redacted>" } : undefined,
    });
    res.status(204).send();
  });
  app.delete("/api/comms", requireOwner, (req, res) => {
    storage.clearCommsLog();
    appendActivity(req, { action: "DELETE", entityType: "comms", entityId: "", summary: "Cleared comms log" });
    res.status(204).send();
  });

  // ── Assets ───────────────────────────────────────────────────────────────────
  app.get("/api/assets", requireAuth, (_, res) => res.json(storage.getAssets()));
  app.post("/api/assets", requireAuth, (req, res) => {
    const parsed = insertAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const asset = storage.createAsset(parsed.data);
    wsPush("ASSET");
    appendActivity(req, { action: "CREATE", entityType: "assets", entityId: asset.id, summary: `Created asset: ${asset.name}`, after: asset });
    res.status(201).json(asset);
  });
  app.patch("/api/assets/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getAsset(id);
    const asset = storage.updateAsset(id, req.body);
    if (!asset) return res.status(404).json({ error: "Not found" });
    wsPush("ASSET");
    appendActivity(req, { action: "UPDATE", entityType: "assets", entityId: asset.id, summary: `Updated asset: ${asset.name}`, before, after: asset });
    res.json(asset);
  });
  app.delete("/api/assets/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getAsset(id);
    storage.deleteAsset(id);
    wsPush("ASSET");
    appendActivity(req, { action: "DELETE", entityType: "assets", entityId: id, summary: `Deleted asset: ${before?.name ?? id}`, before });
    res.status(204).send();
  });

  // ── Threats ──────────────────────────────────────────────────────────────────
  app.get("/api/threats", requireAuth, (_, res) => res.json(storage.getThreats()));
  app.post("/api/threats", requireAuth, (req, res) => {
    const parsed = insertThreatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const threat = storage.createThreat(parsed.data);
    wsPush("THREAT");
    appendActivity(req, { action: "CREATE", entityType: "threats", entityId: threat.id, summary: `Created threat: ${threat.label}`, after: threat });
    res.status(201).json(threat);
  });
  app.patch("/api/threats/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getThreats().find((x) => x.id === id);
    const t = storage.updateThreat(id, req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    wsPush("THREAT");
    appendActivity(req, { action: "UPDATE", entityType: "threats", entityId: t.id, summary: `Updated threat: ${t.label}`, before, after: t });
    res.json(t);
  });
  app.delete("/api/threats/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getThreats().find((x) => x.id === id);
    storage.deleteTheat(id);
    wsPush("THREAT");
    appendActivity(req, { action: "DELETE", entityType: "threats", entityId: id, summary: `Deleted threat ${id}`, before });
    res.status(204).send();
  });

  // Request action on a threat-board target (admin/owner -> approval)
  app.post("/api/threats/:id/request-action", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const threat = storage.getThreats().find((x) => x.id === id);
    if (!threat) return res.status(404).json({ error: "Not found" });
    const actionType = typeof req.body?.actionType === "string" ? req.body.actionType : "action_request";
    const note = typeof req.body?.note === "string" ? req.body.note : "";
    const now = new Date().toISOString();
    const approval = storage.createApproval({
      entityType: "threat_action",
      entityId: String(id),
      action: "REQUEST_ACTION",
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: note,
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({ actionType }),
    });
    wsPush("APPROVALS");
    appendActivity(req, { action: "CREATE", entityType: "approval", entityId: approval.id, summary: `Requested threat action: ${threat.label} (${id})`, after: approval });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });

  const THREAT_LEVELS = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"] as const;
  function computeDashboardThreatLevel(threats: ReturnType<typeof storage.getThreats>) {
    const activeThreats = threats.filter(t => t.active).length;
    const criticalThreats = threats.filter(t => t.active && t.confidence === "confirmed").length;
    if (criticalThreats >= 3) return "SEVERE";
    if (criticalThreats >= 2) return "HIGH";
    if (activeThreats >= 3) return "ELEVATED";
    return "GUARDED";
  }

  app.get("/api/dashboard/threat-level", requireAuth, (_, res) => {
    const threats = storage.getThreats();
    const computed = computeDashboardThreatLevel(threats);
    let mode: "auto" | "manual" = "auto";
    let manualLevel: string | null = null;
    const raw = storage.getSiteSetting("dashboard_threat");
    if (raw) {
      try {
        const j = JSON.parse(raw) as { mode?: string; level?: string };
        if (j.mode === "manual" && j.level && THREAT_LEVELS.includes(j.level as any)) {
          mode = "manual";
          manualLevel = j.level;
        }
      } catch { /* ignore */ }
    }
    const display = mode === "manual" && manualLevel ? manualLevel : computed;
    res.json({ computed, mode, display });
  });

  app.patch("/api/dashboard/threat-level", requireAdmin, (req, res) => {
    const { mode, level } = req.body || {};
    if (mode === "auto") {
      storage.setSiteSetting("dashboard_threat", JSON.stringify({ mode: "auto" }));
      wsPush("THREAT");
      return res.json({ ok: true });
    }
    if (mode === "manual" && level && THREAT_LEVELS.includes(level)) {
      storage.setSiteSetting("dashboard_threat", JSON.stringify({ mode: "manual", level }));
      wsPush("THREAT");
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: "Send { mode: \"auto\" } or { mode: \"manual\", level: LOW|GUARDED|... }" });
  });

  // ── PERSTAT ───────────────────────────────────────────────────────────────────
  app.get("/api/perstat", requireAuth, (_, res) => res.json(storage.getPerstat()));
  app.post("/api/perstat", requireAuth, (req, res) => {
    const { username, dutyStatus, notes } = req.body;
    const target = username || req.session.username!;
    // Only admin+ can set other users; normal user can only set themselves
    if (target !== req.session.username && (ACCESS_RANK[req.session.accessLevel || ""] ?? 0) < ACCESS_RANK.admin)
      return res.status(403).json({ error: "Forbidden" });
    const ps = storage.upsertPerstat(target, dutyStatus || "active", notes || ""); wsPush("PERSTAT"); res.json(ps);
  });

  // ── After Action Reports ──────────────────────────────────────────────────────
  app.get("/api/aar", requireAuth, (_, res) => res.json(storage.getAars()));
  app.get("/api/aar/:id", requireAuth, (req, res) => {
    const doc = storage.getAar(Number(req.params.id));
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  });
  app.post("/api/aar", requireAuth, (req, res) => {
    const now = new Date().toISOString();
    const aar = storage.createAar({ ...req.body, submittedBy: req.session.username!, createdAt: now }); wsPush("AAR");
    res.status(201).json(aar);
  });
  app.patch("/api/aar/:id", requireAuth, (req, res) => {
    const aar = storage.updateAar(Number(req.params.id), req.body);
    if (!aar) return res.status(404).json({ error: "Not found" });
    wsPush("AAR"); res.json(aar);
  });
  app.delete("/api/aar/:id", requireAdmin, (req, res) => {
    storage.deleteAar(Number(req.params.id)); wsPush("AAR");
    res.status(204).send();
  });

  // ── Op Tasks (Kanban per Operation) ──────────────────────────────────────────
  app.get("/api/operations/:id/tasks", requireAuth, (req, res) => {
    res.json(storage.getOpTasks(Number(req.params.id)));
  });
  app.post("/api/operations/:id/tasks", requireAuth, (req, res) => {
    const task = storage.createOpTask({
      ...req.body,
      operationId: Number(req.params.id),
      createdAt: new Date().toISOString(),
    });
    wsPush("OP_TASK", { operationId: Number(req.params.id) });
    appendActivity(req, { action: "CREATE", entityType: "tasks", entityId: task.id, summary: `Created task for op ${task.operationId}: ${task.title}`, after: task });
    res.status(201).json(task);
  });
  app.patch("/api/tasks/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const before = storage.getOpTask(id);
    const task = storage.updateOpTask(id, req.body);
    if (!task) return res.status(404).json({ error: "Not found" });
    wsPush("OP_TASK", { operationId: task.operationId });
    appendActivity(req, { action: "UPDATE", entityType: "tasks", entityId: task.id, summary: `Updated task ${task.id}`, before, after: task });
    res.json(task);
  });
  app.delete("/api/tasks/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    storage.deleteOpTask(id);
    wsPush("OP_TASK");
    appendActivity(req, { action: "DELETE", entityType: "tasks", entityId: id, summary: `Deleted task ${id}` });
    res.status(204).send();
  });

  // ── Awards ────────────────────────────────────────────────────────────────────
  app.get("/api/awards", requireAuth, (req, res) => {
    const username = req.query.username as string | undefined;
    res.json(storage.getAwards(username));
  });
  app.post("/api/awards", requireAdmin, (req, res) => {
    const award = storage.createAward({ ...req.body, awardedBy: req.session.username!, awardedAt: new Date().toISOString() }); wsPush("AWARD");
    res.status(201).json(award);
  });
  app.delete("/api/awards/:id", requireAdmin, (req, res) => {
    storage.deleteAward(Number(req.params.id)); wsPush("AWARD");
    res.status(204).send();
  });

  // ── Training Records ──────────────────────────────────────────────────────────
  app.get("/api/training", requireAuth, (req, res) => {
    const me = req.session.username!;
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    const rawU = req.query.username;
    const qUser =
      typeof rawU === "string"
        ? rawU
        : Array.isArray(rawU) && typeof rawU[0] === "string"
          ? rawU[0]
          : undefined;
    // Operators only see their own records; admins/owners can filter by ?username= or see all
    if (!isStaff) {
      return res.json(storage.getTrainingRecords(me));
    }
    res.json(storage.getTrainingRecords(qUser));
  });
  app.post("/api/training", requireAdmin, (req, res) => {
    const rec = storage.createTrainingRecord({ ...req.body, createdAt: new Date().toISOString() }); wsPush("TRAINING");
    res.status(201).json(rec);
  });
  app.patch("/api/training/:id", requireAdmin, (req, res) => {
    const rec = storage.updateTrainingRecord(Number(req.params.id), req.body);
    if (!rec) return res.status(404).json({ error: "Not found" });
    wsPush("TRAINING"); res.json(rec);
  });
  app.delete("/api/training/:id", requireAdmin, (req, res) => {
    storage.deleteTrainingRecord(Number(req.params.id)); wsPush("TRAINING");
    res.status(204).send();
  });

  // ── Shared calendar (team events) ────────────────────────────────────────────
  const calendarEventPostSchema = z.object({
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(""),
    title: z.string().min(1).max(200),
    notes: z.string().max(4000).optional().default(""),
    startTime: z.string().max(16).optional().default(""),
    endTime: z.string().max(16).optional().default(""),
    color: z.string().min(1).max(32).optional().default("blue"),
  });
  const calendarEventPatchSchema = calendarEventPostSchema.partial();

  app.get("/api/calendar-events", requireAuth, (req, res) => {
    const rawFrom = req.query.from;
    const rawTo = req.query.to;
    const from =
      typeof rawFrom === "string"
        ? rawFrom
        : Array.isArray(rawFrom) && typeof rawFrom[0] === "string"
          ? rawFrom[0]
          : undefined;
    const to =
      typeof rawTo === "string"
        ? rawTo
        : Array.isArray(rawTo) && typeof rawTo[0] === "string"
          ? rawTo[0]
          : undefined;
    if (from && to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
      }
      return res.json(storage.getCalendarEvents(from, to));
    }
    res.json(storage.getCalendarEvents());
  });

  app.post("/api/calendar-events", requireAuth, (req, res) => {
    const parsed = calendarEventPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const row = storage.createCalendarEvent({
      ...parsed.data,
      endDate: parsed.data.endDate || "",
      endTime: parsed.data.endTime || "",
      color: parsed.data.color || "blue",
      createdBy: req.session.username!,
      createdAt: now,
      updatedAt: now,
    });
    wsPush("CALENDAR");
    appendActivity(req, { action: "CREATE", entityType: "calendar", entityId: row.id, summary: `Created calendar event: ${row.title} (${row.eventDate})`, after: row });
    res.status(201).json(row);
  });

  app.patch("/api/calendar-events/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = calendarEventPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = storage.getCalendarEvent(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    if (existing.createdBy !== req.session.username && !isStaff) {
      return res.status(403).json({ error: "Only the author or an admin/owner can edit this event" });
    }
    const row = storage.updateCalendarEvent(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Not found" });
    wsPush("CALENDAR");
    appendActivity(req, { action: "UPDATE", entityType: "calendar", entityId: row.id, summary: `Updated calendar event: ${row.title} (${row.eventDate})`, before: existing, after: row });
    res.json(row);
  });

  app.delete("/api/calendar-events/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getCalendarEvent(id);
    const result = storage.tryDeleteCalendarEvent(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") return res.status(403).json({ error: "Only the author or an admin/owner can delete this event" });
      return res.status(404).json({ error: "Not found" });
    }
    wsPush("CALENDAR");
    appendActivity(req, { action: "DELETE", entityType: "calendar", entityId: id, summary: `Deleted calendar event ${id}`, before });
    res.status(204).send();
  });

  // ── Activity Log (admin/owner) ───────────────────────────────────────────────
  app.get("/api/activity", requireAdmin, (req, res) => {
    const parsed = activityQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const q = parsed.data;
    const rows = storage.getActivity({
        fromTs: q.fromTs,
        toTs: q.toTs,
        actorUsername: q.actorUsername,
        entityType: q.entityType,
        action: q.action,
        limit: q.limit,
        offset: q.offset,
      });
    const isOwner = req.session.accessLevel === "owner";
    res.json(
      isOwner
        ? rows
        : rows.map((r) => ({
            ...r,
            ip: "",
          })),
    );
  });

  // ── Link Analysis ────────────────────────────────────────────────────────────
  app.get("/api/entity-links", requireAuth, (req, res) => {
    const rawType = req.query.type;
    const rawId = req.query.id;
    const type =
      typeof rawType === "string"
        ? rawType
        : Array.isArray(rawType) && typeof rawType[0] === "string"
          ? rawType[0]
          : "";
    const id =
      typeof rawId === "string"
        ? rawId
        : Array.isArray(rawId) && typeof rawId[0] === "string"
          ? rawId[0]
          : "";
    if (!type || !id) return res.status(400).json({ error: "type and id query required" });
    res.json(storage.getLinksForEntity(type, id));
  });

  app.post("/api/entity-links", requireAuth, (req, res) => {
    const parsed = entityLinkPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const row = storage.createEntityLink({
      ...parsed.data,
      createdBy: req.session.username!,
      createdAt: now,
    });
    wsPush("LINKS");
    appendActivity(req, {
      action: "CREATE",
      entityType: "links",
      entityId: row.id,
      summary: `Linked ${row.aType}:${row.aId} ↔ ${row.bType}:${row.bId} (${row.relation})`,
      after: row,
    });
    res.status(201).json(row);
  });

  app.delete("/api/entity-links/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getEntityLink(id);
    const result = storage.tryDeleteEntityLink(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") return res.status(403).json({ error: "Only the author or an admin/owner can delete this link" });
      return res.status(404).json({ error: "Not found" });
    }
    wsPush("LINKS");
    appendActivity(req, { action: "DELETE", entityType: "links", entityId: id, summary: `Deleted link ${id}`, before });
    res.status(204).send();
  });

  // ── Support Requests (Reachback) ─────────────────────────────────────────────
  app.get("/api/support-requests", requireAuth, (_req, res) => {
    res.json(storage.getSupportRequests());
  });

  app.post("/api/support-requests", requireAuth, (req, res) => {
    const parsed = supportRequestPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const row = storage.createSupportRequest({
      ...parsed.data,
      createdBy: req.session.username!,
      createdAt: now,
      updatedAt: now,
    });
    wsPush("SUPPORT_REQUESTS");
    appendActivity(req, { action: "CREATE", entityType: "support_requests", entityId: row.id, summary: `Created support request: ${row.title}`, after: row });
    res.status(201).json(row);
  });

  app.patch("/api/support-requests/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = supportRequestPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = storage.getSupportRequest(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    const isAuthor = existing.createdBy === req.session.username;
    const isAssignee = existing.assignedTo && existing.assignedTo === req.session.username;
    if (!isAuthor && !isAssignee && !isStaff) {
      return res.status(403).json({ error: "Only the author, assignee, or an admin/owner can update this request" });
    }
    const before = existing;
    const row = storage.updateSupportRequest(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Not found" });
    wsPush("SUPPORT_REQUESTS");
    appendActivity(req, { action: "UPDATE", entityType: "support_requests", entityId: row.id, summary: `Updated support request: ${row.title}`, before, after: row });
    res.json(row);
  });

  app.delete("/api/support-requests/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getSupportRequest(id);
    const result = storage.tryDeleteSupportRequest(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") return res.status(403).json({ error: "Only the author or an admin/owner can delete this request" });
      return res.status(404).json({ error: "Not found" });
    }
    wsPush("SUPPORT_REQUESTS");
    appendActivity(req, { action: "DELETE", entityType: "support_requests", entityId: id, summary: `Deleted support request ${id}`, before });
    res.status(204).send();
  });

  // ── Medical / Casualty Tracking ──────────────────────────────────────────────
  app.get("/api/casualties", requireAuth, (_req, res) => {
    res.json(storage.getCasualties());
  });

  app.get("/api/casualties/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const row = storage.getCasualty(id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  app.post("/api/casualties", requireAuth, (req, res) => {
    const parsed = casualtyPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const row = storage.createCasualty({
      displayName: parsed.data.displayName,
      unit: parsed.data.unit,
      patientId: parsed.data.patientId,
      classification: parsed.data.classification,
      status: parsed.data.status,
      precedence: parsed.data.precedence,
      injury: parsed.data.injury,
      locationGrid: parsed.data.locationGrid,
      incidentAt: parsed.data.incidentAt,
      notes: parsed.data.notes,
      createdBy: req.session.username!,
      createdAt: now,
      updatedAt: now,
    });
    wsPush("CASUALTIES");
    appendActivity(req, { action: "CREATE", entityType: "casualty", entityId: row.id, summary: `Created casualty: ${row.displayName}`, after: row });
    res.status(201).json(row);
  });

  app.patch("/api/casualties/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = storage.getCasualty(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const parsed = casualtyPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    if (existing.createdBy !== req.session.username && !isStaff) {
      return res.status(403).json({ error: "Only the author or an admin/owner can edit this casualty" });
    }
    const row = storage.updateCasualty(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Not found" });
    wsPush("CASUALTIES");
    appendActivity(req, { action: "UPDATE", entityType: "casualty", entityId: row.id, summary: `Updated casualty: ${row.displayName}`, before: existing, after: row });
    res.json(row);
  });

  app.delete("/api/casualties/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getCasualty(id);
    const result = storage.tryDeleteCasualty(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") return res.status(403).json({ error: "Only the author or an admin/owner can delete this casualty" });
      return res.status(404).json({ error: "Not found" });
    }
    wsPush("CASUALTIES");
    appendActivity(req, { action: "DELETE", entityType: "casualty", entityId: id, summary: `Deleted casualty ${id}`, before });
    res.status(204).send();
  });

  app.get("/api/casualties/:id/evac", requireAuth, (req, res) => {
    const casualtyId = Number(req.params.id);
    if (!Number.isFinite(casualtyId)) return res.status(400).json({ error: "Invalid id" });
    res.json(storage.getCasualtyEvac(casualtyId) || null);
  });

  app.post("/api/casualties/evac", requireAuth, (req, res) => {
    const parsed = casualtyEvacUpsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const row = storage.upsertCasualtyEvac(parsed.data);
    wsPush("CASUALTIES");
    appendActivity(req, { action: "UPDATE", entityType: "casualty_evac", entityId: row.id, summary: `Upserted evac for casualty ${row.casualtyId}`, after: row });
    res.status(201).json(row);
  });

  app.get("/api/casualties/:id/treatments", requireAuth, (req, res) => {
    const casualtyId = Number(req.params.id);
    if (!Number.isFinite(casualtyId)) return res.status(400).json({ error: "Invalid id" });
    res.json(storage.getCasualtyTreatments(casualtyId));
  });

  app.post("/api/casualties/treatments", requireAuth, (req, res) => {
    const parsed = casualtyTreatmentPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const row = storage.addCasualtyTreatment({
      casualtyId: parsed.data.casualtyId,
      ts: parsed.data.ts,
      note: parsed.data.note,
      performedBy: req.session.username!,
    });
    wsPush("CASUALTIES");
    appendActivity(req, { action: "CREATE", entityType: "casualty_treatment", entityId: row.id, summary: `Added treatment note for casualty ${row.casualtyId}`, after: row });
    res.status(201).json(row);
  });

  app.delete("/api/casualties/treatments/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const result = storage.tryDeleteCasualtyTreatment(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") return res.status(403).json({ error: "Only the author or an admin/owner can delete this note" });
      return res.status(404).json({ error: "Not found" });
    }
    wsPush("CASUALTIES");
    appendActivity(req, { action: "DELETE", entityType: "casualty_treatment", entityId: id, summary: `Deleted treatment note ${id}` });
    res.status(204).send();
  });

  // ── Approvals (admin/owner) ────────────────────────────────────────────────
  app.get("/api/approvals", requireAdmin, (req, res) => {
    const raw = req.query.status;
    const status =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : undefined;
    res.json(storage.getApprovals(status));
  });

  app.post("/api/approvals", requireAdmin, (req, res) => {
    const parsed = approvalPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const row = storage.createApproval({
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      action: parsed.data.action,
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: parsed.data.requestedNote,
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: parsed.data.payloadJson,
    });
    wsPush("APPROVALS");
    appendActivity(req, { action: "CREATE", entityType: "approval", entityId: row.id, summary: `Approval requested: ${row.entityType} ${row.entityId}`, after: row });
    res.status(201).json(row);
  });

  app.post("/api/approvals/:id/approve", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = approvalDecisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const row = storage.approveApproval(id, req.session.username!, parsed.data.decisionNote);
    if (!row) return res.status(404).json({ error: "Not found" });
    // execute side-effect for known approvals
    if (row.entityType === "isofac_release" && row.action === "RELEASE") {
      try {
        const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
        if (payload?.releasability) {
          storage.releaseIsofacDoc(Number(row.entityId), String(payload.releasability), row.requestedBy);
          wsPush("ISOFAC");
        }
      } catch {}
    }
    if (row.entityType === "intel_release" && row.action === "RELEASE") {
      try {
        const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
        if (payload?.releasability) {
          storage.releaseIntelReport(Number(row.entityId), String(payload.releasability), row.requestedBy);
          wsPush("INTEL");
        }
      } catch {}
    }
    if (row.entityType === "operations_plan" && row.action === "UPDATE") {
      try {
        const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
        const patch = payload?.patch && typeof payload.patch === "object" ? payload.patch : {};
        const before = storage.getOperation(Number(row.entityId));
        const updated = storage.updateOperation(Number(row.entityId), patch);
        if (updated) {
          wsPush("OPERATION");
          appendActivity(req, {
            action: "UPDATE",
            entityType: "operations",
            entityId: updated.id,
            summary: `Approved op plan update: ${updated.name}`,
            before,
            after: updated,
          });
        }
      } catch {}
    }
    if (row.entityType === "intel_action" && row.action === "REQUEST_ACTION") {
      try {
        const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
        const actionType = typeof payload?.actionType === "string" ? payload.actionType : "collection_request";
        const report = storage.getIntelReport(Number(row.entityId));
        const title = report ? report.title : `Intel ${row.entityId}`;
        const sr = storage.createSupportRequest({
          title: `Intel action: ${title}`,
          category: "intel",
          priority: "high",
          status: "open",
          assignedTo: "",
          dueAt: "",
          details: `${actionType}\n\n${row.requestedNote || ""}`.trim(),
          createdBy: row.requestedBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        wsPush("SUPPORT_REQUESTS");
        appendActivity(req, { action: "CREATE", entityType: "support_request", entityId: sr.id, summary: `Created support request from intel action approval`, after: sr });
      } catch {}
    }
    if (row.entityType === "threat_action" && row.action === "REQUEST_ACTION") {
      try {
        const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
        const actionType = typeof payload?.actionType === "string" ? payload.actionType : "action_request";
        const threat = storage.getThreats().find((x) => x.id === Number(row.entityId));
        const label = threat ? threat.label : `Threat ${row.entityId}`;
        const priority =
          threat?.confidence === "confirmed" ? "critical" : threat?.confidence === "probable" ? "high" : "medium";
        const sr = storage.createSupportRequest({
          title: `Target action: ${label}`,
          category: "fires",
          priority,
          status: "open",
          assignedTo: "",
          dueAt: "",
          details: `${actionType}\n\n${row.requestedNote || ""}`.trim(),
          createdBy: row.requestedBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        wsPush("SUPPORT_REQUESTS");
        appendActivity(req, { action: "CREATE", entityType: "support_request", entityId: sr.id, summary: `Created support request from threat action approval`, after: sr });
      } catch {}
    }
    wsPush("APPROVALS");
    appendActivity(req, { action: "UPDATE", entityType: "approval", entityId: row.id, summary: `Approved: ${row.entityType} ${row.entityId}`, after: row });
    res.json(row);
  });

  app.post("/api/approvals/:id/reject", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = approvalDecisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const row = storage.rejectApproval(id, req.session.username!, parsed.data.decisionNote);
    if (!row) return res.status(404).json({ error: "Not found" });
    wsPush("APPROVALS");
    appendActivity(req, { action: "UPDATE", entityType: "approval", entityId: row.id, summary: `Rejected: ${row.entityType} ${row.entityId}`, after: row });
    res.json(row);
  });

  // ── Broadcasts (FLASH) ────────────────────────────────────────────────────────
  app.get("/api/broadcasts", requireAuth, (_, res) => res.json(storage.getActiveBroadcasts()));
  app.get("/api/broadcasts/all", requireAdmin, (_, res) => res.json(storage.getBroadcasts()));
  app.post("/api/broadcasts", requireAdmin, (req, res) => {
    const b = storage.createBroadcast({ ...req.body, sentBy: req.session.username!, sentAt: new Date().toISOString() });
    // Push to all connected users via WebSocket
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "BROADCAST", broadcast: b });
    res.status(201).json(b);
  });
  app.patch("/api/broadcasts/:id/dismiss", requireAuth, (req, res) => {
    storage.dismissBroadcast(Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete("/api/broadcasts/:id", requireAdmin, (req, res) => {
    storage.deleteBroadcast(Number(req.params.id));
    res.status(204).send();
  });

  // ── Tactical terrain (TDL export + NATO markers) ─────────────────────────────
  app.get("/api/terrain/maps", requireAuth, (_req, res) => {
    if (!fs.existsSync(TERRAIN_DIR)) {
      return res.json({ maps: [] as { id: string; label: string }[] });
    }
    const ids = discoverTerrainMapIds(TERRAIN_DIR);
    const maps = ids.map((id) => ({
      id,
      label: terrainMapLabel(TERRAIN_DIR, id),
    }));
    res.json({ maps });
  });

  app.get("/api/tactical-markers", requireAuth, (req, res) => {
    const raw = req.query.mapKey;
    const mapKey =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : "";
    if (!mapKey) return res.status(400).json({ error: "mapKey query required" });
    res.json(storage.getTacticalMarkers(mapKey));
  });

  app.post("/api/tactical-markers", requireAuth, (req, res) => {
    const parsed = tacticalMarkerPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const b = parsed.data;
    let sidc: string | null;
    let markerTypeStored = b.markerType;
    if (b.customSidc) {
      const u = b.customSidc.trim().toUpperCase();
      if (!/^S[F][A-Z0-9*\-]{13}$/.test(u)) {
        return res.status(400).json({
          error:
            "customSidc must be a 15-character friendly-template letter SIDC (2nd character F, per APP-6 / 2525C)",
        });
      }
      const sym = new ms.Symbol(u, { size: 16, fill: true });
      if (!sym.isValid()) {
        return res.status(400).json({ error: "customSidc is not supported by milsymbol" });
      }
      sidc = sidcForAffiliation(u, b.affiliation);
      markerTypeStored = `custom:${u}`;
    } else {
      sidc = resolveMarkerSidc(b.affiliation, b.markerType);
      if (!sidc) {
        return res.status(400).json({ error: "Invalid markerType (unknown legacy type or SIDC preset)" });
      }
    }
    const row = storage.createTacticalMarker({
      mapKey: b.mapKey,
      gameX: b.gameX,
      gameZ: b.gameZ,
      sidc,
      markerType: markerTypeStored,
      affiliation: b.affiliation,
      label: b.label.trim(),
      createdBy: req.session.username!,
      createdAt: new Date().toISOString(),
    });
    wsPush("TACTICAL_MARKERS", { mapKey: b.mapKey });
    appendActivity(req, {
      action: "CREATE",
      entityType: "tac_marker",
      entityId: row.id,
      summary: `Placed TAC marker on ${b.mapKey} (${b.affiliation})`,
      after: { id: row.id, mapKey: row.mapKey, gameX: row.gameX, gameZ: row.gameZ, markerType: row.markerType, affiliation: row.affiliation, label: row.label },
    });
    res.status(201).json(row);
  });

  app.patch("/api/tactical-markers/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = tacticalMarkerPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const result = storage.tryUpdateTacticalMarkerPosition(
      id,
      parsed.data.gameX,
      parsed.data.gameZ,
    );
    if (!result.ok) {
      return res.status(404).json({ error: "Marker not found" });
    }
    wsPush("TACTICAL_MARKERS", { mapKey: result.mapKey });
    appendActivity(req, {
      action: "UPDATE",
      entityType: "tac_marker",
      entityId: id,
      summary: `Moved TAC marker ${id} on ${result.mapKey}`,
      after: { id: result.marker.id, mapKey: result.mapKey, gameX: result.marker.gameX, gameZ: result.marker.gameZ },
    });
    res.json(result.marker);
  });

  app.delete("/api/tactical-markers/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const result = storage.tryDeleteTacticalMarker(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res.status(403).json({ error: "Only the placer or an admin/owner can remove this marker" });
      }
      return res.status(404).json({ error: "Marker not found" });
    }
    wsPush("TACTICAL_MARKERS", { mapKey: result.mapKey });
    appendActivity(req, { action: "DELETE", entityType: "tac_marker", entityId: id, summary: `Deleted TAC marker ${id} on ${result.mapKey}` });
    res.status(204).send();
  });

  app.get("/api/tactical-lines", requireAuth, (req, res) => {
    const raw = req.query.mapKey;
    const mapKey =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : "";
    if (!mapKey) return res.status(400).json({ error: "mapKey query required" });
    res.json(storage.getTacticalLines(mapKey));
  });

  app.post("/api/tactical-lines", requireAuth, (req, res) => {
    const parsed = tacticalLinePostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const b = parsed.data;
    const line = storage.createTacticalLine({
      mapKey: b.mapKey,
      points: b.points,
      label: b.label.trim(),
      color: b.color,
      createdBy: req.session.username!,
      createdAt: new Date().toISOString(),
    });
    wsPush("TACTICAL_LINES", { mapKey: b.mapKey });
    appendActivity(req, { action: "CREATE", entityType: "tac_line", entityId: line.id, summary: `Created TAC line on ${b.mapKey}`, after: { id: line.id, mapKey: line.mapKey, label: line.label, color: line.color } });
    res.status(201).json(line);
  });

  app.delete("/api/tactical-lines/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const result = storage.tryDeleteTacticalLine(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res.status(403).json({ error: "Only the author or an admin/owner can remove this line" });
      }
      return res.status(404).json({ error: "Line not found" });
    }
    wsPush("TACTICAL_LINES", { mapKey: result.mapKey });
    appendActivity(req, { action: "DELETE", entityType: "tac_line", entityId: id, summary: `Deleted TAC line ${id} on ${result.mapKey}` });
    res.status(204).send();
  });

  app.get("/api/tactical-range-rings", requireAuth, (req, res) => {
    const raw = req.query.mapKey;
    const mapKey =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : "";
    if (!mapKey) return res.status(400).json({ error: "mapKey query required" });
    res.json(storage.getTacticalRangeRings(mapKey));
  });

  app.post("/api/tactical-range-rings", requireAuth, (req, res) => {
    const parsed = tacticalRangeRingPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const b = parsed.data;
    const ring = storage.createTacticalRangeRing({
      mapKey: b.mapKey,
      centerX: b.centerX,
      centerZ: b.centerZ,
      radiusMeters: b.radiusMeters,
      label: b.label.trim(),
      color: b.color,
      createdBy: req.session.username!,
      createdAt: new Date().toISOString(),
    });
    wsPush("TACTICAL_RANGE_RINGS", { mapKey: b.mapKey });
    appendActivity(req, { action: "CREATE", entityType: "tac_ring", entityId: ring.id, summary: `Created TAC range ring on ${b.mapKey}`, after: { id: ring.id, mapKey: ring.mapKey, radiusMeters: ring.radiusMeters, color: ring.color, label: ring.label } });
    res.status(201).json(ring);
  });

  app.patch("/api/tactical-range-rings/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = tacticalRangeRingPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const updates: Partial<
      Pick<TacticalMapRangeRing, "centerX" | "centerZ" | "radiusMeters" | "label" | "color">
    > = {};
    if (d.centerX !== undefined) updates.centerX = d.centerX;
    if (d.centerZ !== undefined) updates.centerZ = d.centerZ;
    if (d.radiusMeters !== undefined) updates.radiusMeters = d.radiusMeters;
    if (d.label !== undefined) updates.label = d.label.trim();
    if (d.color !== undefined) updates.color = d.color;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    const result = storage.tryUpdateTacticalRangeRing(
      id,
      updates,
      req.session.username!,
      req.session.accessLevel || "",
    );
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res.status(403).json({ error: "Only the author or an admin/owner can edit this range ring" });
      }
      return res.status(404).json({ error: "Range ring not found" });
    }
    wsPush("TACTICAL_RANGE_RINGS", { mapKey: result.mapKey });
    appendActivity(req, { action: "UPDATE", entityType: "tac_ring", entityId: id, summary: `Updated TAC range ring ${id} on ${result.mapKey}`, after: { id: result.ring.id, mapKey: result.mapKey, radiusMeters: result.ring.radiusMeters, color: result.ring.color, label: result.ring.label } });
    res.json(result.ring);
  });

  app.delete("/api/tactical-range-rings/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const result = storage.tryDeleteTacticalRangeRing(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res.status(403).json({ error: "Only the author or an admin/owner can remove this range ring" });
      }
      return res.status(404).json({ error: "Range ring not found" });
    }
    wsPush("TACTICAL_RANGE_RINGS", { mapKey: result.mapKey });
    appendActivity(req, { action: "DELETE", entityType: "tac_ring", entityId: id, summary: `Deleted TAC range ring ${id} on ${result.mapKey}` });
    res.status(204).send();
  });

  app.get("/api/tactical-building-labels", requireAuth, (req, res) => {
    const raw = req.query.mapKey;
    const mapKey =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : "";
    if (!mapKey) return res.status(400).json({ error: "mapKey query required" });
    res.json(storage.getTacticalBuildingLabels(mapKey));
  });

  app.post("/api/tactical-building-labels", requireAuth, (req, res) => {
    const parsed = tacticalBuildingLabelPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const b = parsed.data;
    const row = storage.upsertTacticalBuildingLabel({
      mapKey: b.mapKey,
      featureKey: b.featureKey,
      label: b.label.trim(),
      fillColor: b.fillColor,
      strokeColor: b.strokeColor,
      createdBy: req.session.username!,
      createdAt: new Date().toISOString(),
    });
    wsPush("TACTICAL_BUILDING_LABELS", { mapKey: b.mapKey });
    appendActivity(req, { action: "CREATE", entityType: "tac_building_label", entityId: row.id, summary: `Upserted building label on ${b.mapKey}`, after: { id: row.id, mapKey: row.mapKey, featureKey: row.featureKey, label: row.label, fillColor: row.fillColor, strokeColor: row.strokeColor } });
    res.status(201).json(row);
  });

  app.delete("/api/tactical-building-labels/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const result = storage.tryDeleteTacticalBuildingLabel(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res.status(403).json({ error: "Only the author or an admin/owner can remove this label" });
      }
      return res.status(404).json({ error: "Building label not found" });
    }
    wsPush("TACTICAL_BUILDING_LABELS", { mapKey: result.mapKey });
    appendActivity(req, { action: "DELETE", entityType: "tac_building_label", entityId: id, summary: `Deleted building label ${id} on ${result.mapKey}` });
    res.status(204).send();
  });

  // ── Notifications (aggregate unread counts) ───────────────────────────────────
  app.get("/api/notifications", requireAuth, (req, res) => {
    const me = req.session.username!;
    const broadcasts = storage.getActiveBroadcasts().length;
    const dms = storage.getUnreadDMCount(me);
    const general = storage.getUnreadGeneralCount(me);
    res.json({ broadcasts, dms, general, total: broadcasts + dms + general });
  });
}
