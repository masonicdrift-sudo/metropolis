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
  insertCommsLogSchema, insertAssetSchema,
  ACCESS_RANK,
  ARMY_RANKS,
  SIGN_IN_ISO_FAC_TYPES,
} from "@shared/schema";

/** Only this username may have `accessLevel === "owner"` (see ensureSingleOwnerOverlord in storage). */
const OWNER_ACCOUNT_USERNAME = "Overlord";

import { buildPromotionOrdersMessage } from "@shared/promotionOrders";
import type { PromotionOrdersLine } from "@shared/promotionOrders";
import type { User } from "@shared/schema";
import { permissionForApiPath } from "@shared/tacticalPermissions";
import type { TacticalMapRangeRing } from "@shared/schema";
import ms from "milsymbol";
import { resolveMarkerSidc, sidcForAffiliation } from "@shared/natoSidc";
import { MILITARY_AWARDS_CATALOG, getMilitaryAwardById, sortAwardsByPrecedence } from "@shared/militaryAwardsCatalog";
import { enrichAndSortAwards, enrichAwardRow } from "./awardHelpers";
import {
  createBlankOrgChart,
  parseOrgChart,
  orgChartSchema,
  type OrgChartData,
  type OrgChartView,
  type OrgSlot,
  type OrgSlotView,
} from "@shared/orgChart";

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

const promotionLineRequestSchema = z.object({
  username: z.string().min(1).max(48),
  newRank: z.string().min(1).max(32),
  effectiveDate: z.string().min(1).max(64),
});
const promotionPacketRequestSchema = z.object({
  promotions: z.array(promotionLineRequestSchema).min(1).max(48),
  requestedNote: z.string().max(2000).optional().default(""),
});

const loaRequestPostSchema = z.object({
  startDate: z.string().min(8).max(32),
  endDate: z.string().min(8).max(32),
  reason: z.string().max(4000).optional().default(""),
});

const loaEarlyReturnPostSchema = z.object({
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(4000).optional().default(""),
});

function armyRankIndex(abbr: string): number {
  const t = abbr.trim();
  if (!t) return -1;
  return ARMY_RANKS.findIndex((r) => r.abbr === t);
}

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
  const fromLower = fromUsername.toLowerCase();
  const canonicalByLower = new Map<string, string>();
  for (const u of allowedUsernames) {
    if (u.toLowerCase() === fromLower) continue;
    canonicalByLower.set(u.toLowerCase(), u);
  }
  const mentioned = extractMentionUsernames(content)
    .map((tok) => canonicalByLower.get(tok.toLowerCase()))
    .filter((u): u is string => u != null);
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

/** Accept only same-origin upload paths for profile photos. */
function sanitizeProfileImageUrl(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (raw === null || raw === "") return "";
  const s = String(raw).trim().slice(0, 512);
  if (!s) return "";
  if (s.startsWith("/uploads/") && !s.includes("..") && !s.includes("\\")) return s;
  return null;
}

/** Public session fields for /api/auth/me and login (no password hash). */
function sessionUserJson(user: User) {
  const tacticalRoles = storage.getTacticalRolesDisplayForUser(user.id);
  const permissions = storage.getMergedTacticalPermissionKeys(user.id);
  return {
    id: user.id,
    username: user.username,
    accessLevel: user.accessLevel,
    role: user.role || "",
    rank: user.rank || "",
    assignedUnit: user.assignedUnit || "",
    teamAssignment: user.teamAssignment || "",
    milIdNumber: user.milIdNumber || "",
    mos: user.mos || "",
    loaStart: user.loaStart || "",
    loaEnd: user.loaEnd || "",
    loaApprover: user.loaApprover || "",
    profileImageUrl: user.profileImageUrl || "",
    tacticalRoles,
    permissions,
  };
}

function shouldSkipTacticalApiGate(path: string): boolean {
  if (path.startsWith("/api/auth/")) return true;
  if (path === "/api/users/directory") return true;
  if (path.startsWith("/api/profile/")) return true;
  if (path.startsWith("/api/presence/")) return true;
  if (path === "/api/upload") return true;
  if (path.startsWith("/api/tactical-roles")) return true;
  if (path === "/api/users" || /^\/api\/users\/\d+\/tactical-roles$/.test(path)) return true;
  return false;
}

export function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  const prunedStaleLinks = storage.pruneStaleEntityLinks();
  if (prunedStaleLinks > 0) {
    console.log(
      `[entity_links] Removed ${prunedStaleLinks} stale link(s) whose entities no longer exist.`,
    );
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || "";
    if (!path.startsWith("/api/")) return next();
    if (shouldSkipTacticalApiGate(path)) return next();
    if (!req.session?.userId) return next();
    const al = req.session.accessLevel || "user";
    if (al === "owner" || al === "admin") return next();
    const need = permissionForApiPath(path);
    if (!need) return next();
    if (storage.userHasTacticalPermission(req.session.userId, need)) return next();
    return res.status(403).json({ error: "Insufficient tactical permissions" });
  });
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
    storage.reconcileExpiredLoas();
    const userFresh = storage.getUserById(user.id) || user;
    appendActivity(req, { action: "LOGIN", entityType: "user_session", entityId: user.id, summary: `Login: ${user.username}`, after: { username: user.username, accessLevel: user.accessLevel } });
    res.json(sessionUserJson(userFresh));
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
    storage.reconcileExpiredLoas();
    const user = storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Not logged in" });
    res.json(sessionUserJson(user));
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
    res.status(201).json(sessionUserJson(user));
  });

  // ── Access codes (admin or owner — same capabilities) ───────────────────
  app.get("/api/access-codes", requireAdmin, (_, res) => res.json(storage.getAccessCodes()));
  app.post("/api/access-codes", requireAdmin, (req, res) => {
    const code = storage.generateAccessCode(req.session.username!, req.body.expiresAt || "");
    res.status(201).json(code);
  });
  app.delete("/api/access-codes/:id", requireAdmin, (req, res) => {
    storage.deleteAccessCode(Number(req.params.id));
    res.status(204).send();
  });

  // ── User management (admin+ can list/create, only owner can delete admins) ───
  app.get("/api/users", requireAdmin, (_, res) => {
    const users = storage.getUsers();
    const map = storage.getAllUserTacticalPermissionRoleIdsMap();
    res.json(
      users.map((u) => ({
        ...u,
        tacticalRoleIds: map.get(u.id) ?? [],
      })),
    );
  });
  // ── User profiles (any logged-in user can view) ─────────────────────────────
  app.get("/api/profile/:username", requireAuth, (req, res) => {
    const username = String(req.params.username || "").trim();
    if (!username) return res.status(400).json({ error: "username required" });
    storage.reconcileExpiredLoas();
    const u = storage.getUserByUsername(username);
    if (!u) return res.status(404).json({ error: "Not found" });
    const awardRows = storage.getAwards(username).map(enrichAwardRow);
    const citations = awardRows.filter((a) => a.awardType === "citation");
    const badgeAwards = awardRows.filter((a) => a.awardType === "badge");
    const awardsOther = awardRows.filter((a) => a.awardType !== "citation" && a.awardType !== "badge");
    const awardsSorted = sortAwardsByPrecedence(awardsOther);
    const badgesSorted = sortAwardsByPrecedence(badgeAwards);
    const citationsSorted = sortAwardsByPrecedence(citations);
    const signInSheets = storage.getTrainingRecords(username).map((r) => {
      let attachedTitle: string | null = null;
      let attachedType: string | null = null;
      if (r.attachedIsofacDocId) {
        const doc = storage.getIsofacDoc(r.attachedIsofacDocId);
        if (doc) {
          attachedTitle = doc.title;
          attachedType = doc.type;
        }
      }
      let operationName: string | null = null;
      if (r.operationId) {
        const op = storage.getOperation(r.operationId);
        if (op) operationName = op.name;
      }
      return { ...r, attachedDocTitle: attachedTitle, attachedDocType: attachedType, operationName };
    });
    const loaStart = (u.loaStart || "").trim();
    const loaEnd = (u.loaEnd || "").trim();
    const loaApprover = (u.loaApprover || "").trim();
    const today = new Date().toISOString().slice(0, 10);
    let loaPhase: "none" | "scheduled" | "active" = "none";
    if (loaStart && loaEnd) {
      if (today > loaEnd) loaPhase = "none";
      else if (today < loaStart) loaPhase = "scheduled";
      else loaPhase = "active";
    }

    const qualifications = storage.getUserQualificationsForProfile(username);

    res.json({
      username: u.username,
      accessLevel: u.accessLevel,
      tacticalRole: u.role || "",
      tacticalRoles: storage.getTacticalRolesDisplayForUser(u.id),
      rank: u.rank || "",
      assignedUnit: u.assignedUnit || "",
      teamAssignment: u.teamAssignment || "",
      milIdNumber: u.milIdNumber || "",
      mos: u.mos || "",
      profileImageUrl: u.profileImageUrl || "",
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      loaStart,
      loaEnd,
      loaApprover,
      loaPhase,
      awards: awardsSorted,
      badges: badgesSorted,
      citations: citationsSorted,
      signInSheets,
      qualifications,
    });
  });

  /** Live session presence: user has at least one open /ws connection (app open in a tab). */
  app.get("/api/presence/:username", requireAuth, (req, res) => {
    const username = String(req.params.username || "").trim();
    if (!username) return res.status(400).json({ error: "username required" });
    const u = storage.getUserByUsername(username);
    if (!u) return res.status(404).json({ error: "Not found" });
    const fn = (global as any).__wsIsUserOnline as ((name: string) => boolean) | undefined;
    const online = typeof fn === "function" ? fn(u.username) : false;
    res.json({ online });
  });

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
    if (requestedAccess === "owner" && username !== OWNER_ACCOUNT_USERNAME) {
      return res.status(403).json({ error: "Only the Overlord account may have owner access" });
    }
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const targetRank = ACCESS_RANK[requestedAccess] ?? 0;
    if (targetRank > callerRank) return res.status(403).json({ error: "Cannot create a user with a role higher than your own" });
    const exists = storage.getUserByUsername(username);
    if (exists) return res.status(409).json({ error: "Username already exists" });
    const user = storage.createUser(username, password, requestedAccess, {
      rank: typeof rank === "string" ? rank : "",
      assignedUnit: typeof assignedUnit === "string" ? assignedUnit : "",
      teamAssignment:
        typeof req.body.teamAssignment === "string"
          ? req.body.teamAssignment.trim().slice(0, 128)
          : "",
      milIdNumber:
        typeof milIdNumber === "string" ? milIdNumber.trim().slice(0, 64) : "",
      mos: typeof mos === "string" ? mos.trim().slice(0, 32) : "",
    });
    let created = user;
    if (typeof role === "string") {
      const u2 = storage.updateUserById(user.id, { role: role.trim().slice(0, 64) });
      if (u2) created = u2;
    }
    if (Array.isArray(req.body.tacticalRoleIds) && req.body.tacticalRoleIds.length > 0) {
      const nums = req.body.tacticalRoleIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n));
      const setr = storage.setUserTacticalPermissionRoleIds(created.id, nums);
      if (!setr.ok) return res.status(400).json({ error: setr.error });
    }
    const fresh = storage.getUserById(created.id);
    appendActivity(req, {
      action: "CREATE",
      entityType: "user",
      entityId: created.id,
      summary: `Created user: ${created.username} (${created.accessLevel})`,
      after: { id: created.id, username: created.username, accessLevel: created.accessLevel, role: created.role || "" },
    });
    res.status(201).json(fresh ? sessionUserJson(fresh) : sessionUserJson(created));
  });
  // Admin+ edit users. Owner: full edit. Admin: full edit for standard users; for admin/owner targets only
  // duty role, rank, unit, team, MIL ID, MOS (not username, access level, password, or tactical perm roles).
  app.patch("/api/users/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { username, accessLevel, role, password } = req.body;
    const target = storage.getUserById(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const targetRank = ACCESS_RANK[target.accessLevel] ?? 0;
    const canEditSensitive =
      callerRank >= ACCESS_RANK.owner || targetRank < ACCESS_RANK.admin;
    if (!canEditSensitive) {
      if (username != null && String(username).trim() && String(username).trim() !== target.username) {
        return res.status(403).json({ error: "Only the owner can change username for admin or owner accounts" });
      }
      if (accessLevel != null && String(accessLevel) !== target.accessLevel) {
        return res.status(403).json({ error: "Only the owner can change access level for admin or owner accounts" });
      }
      if (password) {
        return res.status(403).json({ error: "Only the owner can reset password for admin or owner accounts" });
      }
      if (Array.isArray(req.body.tacticalRoleIds)) {
        return res.status(403).json({ error: "Only the owner can change tactical permission roles for admin or owner accounts" });
      }
    }
    const beforeSafe = { id: target.id, username: target.username, accessLevel: target.accessLevel, role: target.role || "" };
    // Build update payload
    const updates: Record<string, any> = {};
    let renamedViaAdmin = false;
    if (canEditSensitive && username != null && String(username).trim() !== target.username) {
      const trimmed = String(username).trim();
      if (trimmed.length < 2 || trimmed.length > 48) {
        return res.status(400).json({ error: "Username must be 2–48 characters" });
      }
      if (storage.getUserByUsername(trimmed)) return res.status(409).json({ error: "Username already taken" });
      const renamed = storage.changeUsername(id, target.username, trimmed);
      if (!renamed) return res.status(500).json({ error: "Failed to update username" });
      renamedViaAdmin = true;
      wsPush("USER");
      if (req.session.userId === id) req.session.username = trimmed;
    }
    if (canEditSensitive && accessLevel && ACCESS_RANK[accessLevel] !== undefined) {
      const nextLevel = String(accessLevel);
      if (nextLevel === "owner" && target.username !== OWNER_ACCOUNT_USERNAME) {
        return res.status(403).json({ error: "Only the Overlord account may have owner access" });
      }
      if (
        target.username === OWNER_ACCOUNT_USERNAME &&
        target.accessLevel === "owner" &&
        nextLevel !== "owner"
      ) {
        return res.status(403).json({ error: "Cannot remove owner access from the Overlord account" });
      }
      const nextRank = ACCESS_RANK[accessLevel] ?? 0;
      if (callerRank < ACCESS_RANK.owner && nextRank > callerRank) {
        return res.status(403).json({ error: "Cannot grant a role higher than your own" });
      }
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
    if (typeof req.body.teamAssignment !== "undefined") {
      updates.teamAssignment =
        typeof req.body.teamAssignment === "string" ? req.body.teamAssignment.trim().slice(0, 128) : "";
    }
    if (typeof req.body.profileImageUrl !== "undefined") {
      const v = sanitizeProfileImageUrl(req.body.profileImageUrl);
      if (v === null) {
        return res.status(400).json({
          error: "Invalid profile image URL — use an uploaded file path starting with /uploads/ or clear the field",
        });
      }
      updates.profileImageUrl = v;
    }
    if (canEditSensitive && password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const bcrypt = require("bcryptjs");
      updates.passwordHash = bcrypt.hashSync(password, 10);
    }
    let roleAssign = false;
    if (canEditSensitive && Array.isArray(req.body.tacticalRoleIds)) {
      const nums = req.body.tacticalRoleIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n));
      const setr = storage.setUserTacticalPermissionRoleIds(id, nums);
      if (!setr.ok) return res.status(400).json({ error: setr.error });
      roleAssign = true;
    }
    if (Object.keys(updates).length === 0 && !roleAssign && !renamedViaAdmin) {
      return res.status(400).json({ error: "Nothing to update" });
    }
    if (Object.keys(updates).length > 0) {
      storage.updateUserById(id, updates);
      wsPush("USER");
    }
    const fresh = storage.getUserById(id);
    if (!fresh) return res.status(404).json({ error: "User not found" });
    appendActivity(req, {
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      summary: `Updated user: ${beforeSafe.username} → ${fresh.username}`,
      before: beforeSafe,
      after: { id: fresh.id, username: fresh.username, accessLevel: fresh.accessLevel, role: fresh.role || "" },
    });
    res.json(sessionUserJson(fresh));
  });

  app.patch("/api/users/:id/tactical-roles", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const target = storage.getUserById(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const roleIds = Array.isArray(req.body.roleIds)
      ? req.body.roleIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n))
      : [];
    const setr = storage.setUserTacticalPermissionRoleIds(id, roleIds);
    if (!setr.ok) return res.status(400).json({ error: setr.error });
    appendActivity(req, {
      action: "UPDATE",
      entityType: "user_tactical_roles",
      entityId: id,
      summary: `Tactical permission roles for ${target.username}`,
      after: { userId: id, roleIds },
    });
    res.json({ ok: true, tacticalRoleIds: storage.getUserTacticalPermissionRoleIds(id) });
  });

  app.get("/api/tactical-roles", requireAdmin, (_, res) => {
    const rows = storage.listTacticalPermissionRoles();
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        permissions: (() => {
          try {
            const p = JSON.parse(r.permissionsJson || "[]") as unknown;
            return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
          } catch {
            return [];
          }
        })(),
        sortOrder: r.sortOrder,
        createdAt: r.createdAt,
      })),
    );
  });

  app.post("/api/tactical-roles", requireAdmin, (req, res) => {
    const { name, color, permissions, sortOrder } = req.body;
    if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
    const perms = Array.isArray(permissions) ? permissions.filter((x: unknown): x is string => typeof x === "string") : [];
    const row = storage.createTacticalPermissionRole({
      name,
      color: typeof color === "string" ? color : undefined,
      permissions: perms,
      sortOrder: sortOrder !== undefined && sortOrder !== null ? Number(sortOrder) : undefined,
    });
    appendActivity(req, {
      action: "CREATE",
      entityType: "tactical_permission_role",
      entityId: row.id,
      summary: `Created tactical permission role: ${row.name}`,
      after: { id: row.id, name: row.name },
    });
    let permArr: string[] = [];
    try {
      const p = JSON.parse(row.permissionsJson || "[]") as unknown;
      permArr = Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      permArr = [];
    }
    res.status(201).json({
      id: row.id,
      name: row.name,
      color: row.color,
      permissions: permArr,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    });
  });

  app.patch("/api/tactical-roles/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { name, color, permissions, sortOrder } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (color !== undefined) patch.color = color;
    if (permissions !== undefined) patch.permissions = permissions;
    if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);
    const row = storage.updateTacticalPermissionRole(id, patch as any);
    if (!row) return res.status(404).json({ error: "Not found" });
    appendActivity(req, {
      action: "UPDATE",
      entityType: "tactical_permission_role",
      entityId: id,
      summary: `Updated tactical permission role: ${row.name}`,
      after: { id: row.id, name: row.name },
    });
    let permArr: string[] = [];
    try {
      const p = JSON.parse(row.permissionsJson || "[]") as unknown;
      permArr = Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      permArr = [];
    }
    res.json({
      id: row.id,
      name: row.name,
      color: row.color,
      permissions: permArr,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    });
  });

  app.delete("/api/tactical-roles/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const del = storage.deleteTacticalPermissionRole(id);
    if (!del.ok) {
      if (del.reason === "not_found") return res.status(404).json({ error: "Not found" });
      return res.status(400).json({ error: "Cannot delete this role" });
    }
    appendActivity(req, {
      action: "DELETE",
      entityType: "tactical_permission_role",
      entityId: id,
      summary: `Deleted tactical permission role id ${id}`,
    });
    res.status(204).send();
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
    wsPush("LINKS");
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
    wsPush("LINKS");
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
    storage.deleteUnit(Number(req.params.id)); wsPush("UNIT"); wsPush("LINKS");
    res.status(204).send();
  });

  // ── Operations ───────────────────────────────────────────────────────────────
  app.get("/api/operations", requireAuth, (_, res) => {
    const ops = storage.getOperations();
    const counts = storage.getTrainingSignInCountsByOperationId();
    res.json(ops.map((o) => ({ ...o, signInCount: counts[o.id] ?? 0 })));
  });
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
    wsPush("LINKS");
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
    wsPush("LINKS");
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

  const THREAT_LEVELS = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"] as const;

  app.get("/api/dashboard/threat-level", requireAuth, (_, res) => {
    const computed = "GUARDED" as const;
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
  app.get("/api/perstat", requireAuth, (_, res) => {
    storage.reconcileExpiredLoas();
    res.json(storage.getPerstat());
  });
  app.post("/api/perstat", requireAuth, (req, res) => {
    const { username, dutyStatus, notes } = req.body;
    const target = username || req.session.username!;
    // Only admin+ can set other users; normal user can only set themselves
    if (target !== req.session.username && (ACCESS_RANK[req.session.accessLevel || ""] ?? 0) < ACCESS_RANK.admin)
      return res.status(403).json({ error: "Forbidden" });
    const ps = storage.upsertPerstat(target, dutyStatus || "active", notes || ""); wsPush("PERSTAT"); res.json(ps);
  });

  function enrichOrgChartView(data: OrgChartData): OrgChartView {
    const rosterRows = storage.getPersonnelRosterEntries();
    const rosterById = new Map(rosterRows.map((r) => [r.id, r]));
    const enrichSlot = (s: OrgSlot): OrgSlotView => {
      const un = (s.assignedUsername || "").trim();
      let displayLine = "";
      let profileLinkUsername: string | undefined;
      if (un) {
        const u = storage.getUserByUsername(un);
        const r = (u?.rank || "").trim();
        displayLine = r && u ? `${r} ${u.username}` : un;
        profileLinkUsername = un;
      } else {
        const rid = s.personnelRosterEntryId ?? 0;
        if (rid > 0) {
          const re = rosterById.get(rid);
          if (re) {
            const name = [re.lastName, re.firstName].filter(Boolean).join(", ") || "Roster";
            const rk = (re.rank || "").trim();
            displayLine = rk ? `${rk} ${name}` : name;
            const ln = (re.linkedUsername || "").trim();
            if (ln) profileLinkUsername = ln;
          } else {
            displayLine = `Roster row #${rid} (removed)`;
          }
        } else if ((s.writtenName || "").trim()) {
          displayLine = (s.writtenName || "").trim();
        }
      }
      return { ...s, displayLine, profileLinkUsername };
    };
    return {
      ...data,
      chains: data.chains.map((ch) => ({
        ...ch,
        hqSections: ch.hqSections.map((sec) => ({
          ...sec,
          slots: sec.slots.map(enrichSlot),
          branches: (sec.branches ?? []).map((b) => ({
            ...b,
            slots: b.slots.map(enrichSlot),
          })),
        })),
        columns: ch.columns.map((c) => ({ ...c, slots: c.slots.map(enrichSlot) })),
      })),
    };
  }

  // ── Org chart (unit manning board) ───────────────────────────────────────────
  app.get("/api/org-chart", requireAuth, (_req, res) => {
    const raw = storage.getSiteSetting("org_chart");
    let data: OrgChartData;
    try {
      data = raw ? parseOrgChart(JSON.parse(raw)) : createBlankOrgChart();
    } catch {
      data = createBlankOrgChart();
    }
    res.json(enrichOrgChartView(data));
  });

  app.put("/api/org-chart", requireAuth, requireAdmin, (req, res) => {
    const parsed = orgChartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    storage.setSiteSetting("org_chart", JSON.stringify(parsed.data));
    wsPush("ORG_CHART");
    res.json(enrichOrgChartView(parsed.data));
  });

  // ── Personnel roster (fillable line roster) ───────────────────────────────────
  const personnelRosterPostSchema = z.object({
    sortOrder: z.number().int().min(0).max(1_000_000).optional(),
    lineNo: z.string().max(32).optional().default(""),
    lastName: z.string().max(120).optional().default(""),
    firstName: z.string().max(120).optional().default(""),
    rank: z.string().max(32).optional().default(""),
    mos: z.string().max(32).optional().default(""),
    billet: z.string().max(120).optional().default(""),
    unit: z.string().max(120).optional().default(""),
    teamAssignment: z.string().max(128).optional().default(""),
    cellTags: z.string().max(256).optional().default(""),
    linkedUsername: z.string().max(64).optional().default(""),
    status: z.string().max(32).optional().default("present"),
    notes: z.string().max(2000).optional().default(""),
  });
  const personnelRosterPatchSchema = personnelRosterPostSchema.partial();

  app.get("/api/personnel-roster", requireAuth, (_, res) => {
    storage.reconcileExpiredLoas();
    res.json(storage.getPersonnelRosterEntries());
  });

  app.post("/api/personnel-roster", requireAuth, requireAdmin, (req, res) => {
    const parsed = personnelRosterPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const lu = parsed.data.linkedUsername?.trim();
    if (lu) {
      const u = storage.getUserByUsername(lu);
      if (!u) return res.status(400).json({ error: "Linked profile username not found" });
    }
    const now = new Date().toISOString();
    const all = storage.getPersonnelRosterEntries();
    const nextSort =
      parsed.data.sortOrder ??
      (all.length ? Math.max(...all.map((r) => r.sortOrder)) : 0) + 1;
    const row = storage.createPersonnelRosterEntry({
      sortOrder: nextSort,
      lineNo: parsed.data.lineNo,
      lastName: parsed.data.lastName,
      firstName: parsed.data.firstName,
      rank: parsed.data.rank,
      mos: parsed.data.mos,
      billet: parsed.data.billet,
      unit: parsed.data.unit,
      teamAssignment: parsed.data.teamAssignment,
      cellTags: parsed.data.cellTags,
      linkedUsername: lu || "",
      status: parsed.data.status,
      notes: parsed.data.notes,
      createdBy: req.session.username!,
      createdAt: now,
      updatedAt: now,
    });
    wsPush("PERSONNEL_ROSTER");
    appendActivity(req, {
      action: "CREATE",
      entityType: "personnel_roster",
      entityId: row.id,
      summary: `Added roster line: ${[row.rank, row.lastName, row.firstName].filter(Boolean).join(" ") || `#${row.id}`}`,
      after: row,
    });
    res.status(201).json(row);
  });

  app.patch("/api/personnel-roster/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = personnelRosterPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = storage.getPersonnelRosterEntry(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const callerRank = ACCESS_RANK[req.session.accessLevel || ""] ?? 0;
    const isStaff = callerRank >= ACCESS_RANK.admin;
    if (existing.createdBy !== req.session.username && !isStaff) {
      return res.status(403).json({ error: "Only the author or an admin/owner can edit this line" });
    }
    const lu = typeof parsed.data.linkedUsername === "string" ? parsed.data.linkedUsername.trim() : undefined;
    if (lu) {
      const u = storage.getUserByUsername(lu);
      if (!u) return res.status(400).json({ error: "Linked profile username not found" });
    }
    const now = new Date().toISOString();
    const patch = { ...parsed.data, updatedAt: now } as Record<string, unknown>;
    if (lu !== undefined) patch.linkedUsername = lu || "";
    const row = storage.updatePersonnelRosterEntry(id, patch as typeof parsed.data & { updatedAt: string });
    if (!row) return res.status(404).json({ error: "Not found" });
    wsPush("PERSONNEL_ROSTER");
    appendActivity(req, {
      action: "UPDATE",
      entityType: "personnel_roster",
      entityId: row.id,
      summary: `Updated roster line #${row.id}`,
      before: existing,
      after: row,
    });
    res.json(row);
  });

  app.delete("/api/personnel-roster/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getPersonnelRosterEntry(id);
    const result = storage.tryDeletePersonnelRosterEntry(id, req.session.username!, req.session.accessLevel || "");
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res.status(403).json({ error: "Only the author or an admin/owner can delete this line" });
      }
      return res.status(404).json({ error: "Not found" });
    }
    wsPush("PERSONNEL_ROSTER");
    appendActivity(req, {
      action: "DELETE",
      entityType: "personnel_roster",
      entityId: id,
      summary: `Deleted roster line #${id}`,
      before,
    });
    res.status(204).send();
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
  app.get("/api/awards/catalog", requireAuth, (_req, res) => {
    res.json({ awards: MILITARY_AWARDS_CATALOG });
  });
  app.get("/api/awards", requireAuth, (req, res) => {
    const username = req.query.username as string | undefined;
    res.json(enrichAndSortAwards(storage.getAwards(username)));
  });
  app.post("/api/awards", requireAdmin, (req, res) => {
    const body = req.body || {};
    const catalogId = String(body.awardCatalogId ?? body.award_catalog_id ?? "").trim();
    let awardName = String(body.awardName ?? "").trim();
    let awardType = String(body.awardType ?? "commendation");
    const username = String(body.username ?? "").trim();
    if (!username) return res.status(400).json({ error: "username required" });
    if (catalogId) {
      const def = getMilitaryAwardById(catalogId);
      if (!def) return res.status(400).json({ error: "Unknown military award id" });
      if (!awardName) awardName = def.name;
      awardType = def.awardType;
    } else if (!awardName) {
      return res.status(400).json({ error: "awardName or awardCatalogId required" });
    }
    const award = storage.createAward({
      username,
      awardName,
      awardType,
      awardCatalogId: catalogId,
      reason: String(body.reason ?? ""),
      relatedOpId: Number(body.relatedOpId) || 0,
      relatedOpName: String(body.relatedOpName ?? ""),
      awardedBy: req.session.username!,
      awardedAt: new Date().toISOString(),
    });
    wsPush("AWARD");
    res.status(201).json(enrichAndSortAwards([award])[0]);
  });
  app.delete("/api/awards/:id", requireAdmin, (req, res) => {
    storage.deleteAward(Number(req.params.id)); wsPush("AWARD");
    res.status(204).send();
  });

  // ── Qualifications (catalog + assignments) ───────────────────────────────────
  const qualDefPostSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    sortOrder: z.number().int().optional().default(0),
  });
  app.get("/api/qualifications/definitions", requireAuth, (_req, res) => {
    res.json(storage.getQualificationDefinitions());
  });
  app.post("/api/qualifications/definitions", requireAdmin, (req, res) => {
    const parsed = qualDefPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const row = storage.createQualificationDefinition({
      name: parsed.data.name.trim(),
      description: (parsed.data.description ?? "").trim(),
      sortOrder: parsed.data.sortOrder ?? 0,
      createdAt: now,
    });
    wsPush("QUALIFICATION");
    res.status(201).json(row);
  });
  app.patch("/api/qualifications/definitions/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const body = req.body || {};
    const row = storage.updateQualificationDefinition(id, {
      ...(typeof body.name === "string" ? { name: String(body.name).trim() } : {}),
      ...(typeof body.description === "string" ? { description: String(body.description) } : {}),
      ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    wsPush("QUALIFICATION");
    res.json(row);
  });
  app.delete("/api/qualifications/definitions/:id", requireAdmin, (req, res) => {
    storage.deleteQualificationDefinition(Number(req.params.id));
    wsPush("QUALIFICATION");
    res.status(204).send();
  });

  app.get("/api/qualifications/records", requireAdmin, (_req, res) => {
    const defs = new Map(storage.getQualificationDefinitions().map((d) => [d.id, d]));
    const rows = storage.getAllUserQualificationRecords().map((r) => {
      const def = defs.get(r.qualificationId);
      return {
        ...r,
        qualificationName: def?.name ?? `#${r.qualificationId}`,
        qualificationDescription: def?.description ?? "",
      };
    });
    res.json(rows);
  });

  const qualRecordPostSchema = z.object({
    username: z.string().min(1),
    qualificationId: z.number().int().positive(),
    obtainedAt: z.string().optional().default(""),
    notes: z.string().optional().default(""),
  });
  app.post("/api/qualifications/records", requireAdmin, (req, res) => {
    const parsed = qualRecordPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { username, qualificationId, obtainedAt, notes } = parsed.data;
    const un = username.trim();
    if (!storage.getUserByUsername(un)) return res.status(400).json({ error: "Unknown user" });
    const defs = storage.getQualificationDefinitions();
    if (!defs.some((d) => d.id === qualificationId)) return res.status(400).json({ error: "Unknown qualification" });
    try {
      const row = storage.createUserQualification({
        username: un,
        qualificationId,
        obtainedAt: (obtainedAt || "").trim(),
        recordedBy: req.session.username!,
        notes: (notes || "").trim(),
        createdAt: new Date().toISOString(),
      });
      wsPush("QUALIFICATION");
      res.status(201).json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|constraint/i.test(msg)) {
        return res.status(409).json({ error: "That user already has this qualification recorded" });
      }
      throw e;
    }
  });
  app.delete("/api/qualifications/records/:id", requireAdmin, (req, res) => {
    storage.deleteUserQualification(Number(req.params.id));
    wsPush("QUALIFICATION");
    res.status(204).send();
  });

  // ── Training Records (sign-in sheets) ───────────────────────────────────────
  const trainingPostSchema = z.object({
    username: z.string().min(1),
    eventName: z.string().min(1),
    category: z.string().optional().default("general"),
    date: z.string(),
    result: z.string().optional().default("pass"),
    instructor: z.string().optional().default(""),
    expiresAt: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    attachedIsofacDocId: z.number().int().nonnegative().optional().default(0),
    operationId: z.number().int().nonnegative().optional().default(0),
  });

  function enrichTrainingRows(rows: ReturnType<typeof storage.getTrainingRecords>) {
    return rows.map((r) => {
      let attachedDocTitle: string | null = null;
      let attachedDocType: string | null = null;
      if (r.attachedIsofacDocId) {
        const doc = storage.getIsofacDoc(r.attachedIsofacDocId);
        if (doc) {
          attachedDocTitle = doc.title;
          attachedDocType = doc.type;
        }
      }
      let operationName: string | null = null;
      if (r.operationId) {
        const op = storage.getOperation(r.operationId);
        if (op) operationName = op.name;
      }
      return { ...r, attachedDocTitle, attachedDocType, operationName };
    });
  }

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
      return res.json(enrichTrainingRows(storage.getTrainingRecords(me)));
    }
    res.json(enrichTrainingRows(storage.getTrainingRecords(qUser)));
  });
  function validateTrainingPayload(p: {
    attachedIsofacDocId: number;
    operationId: number;
  }) {
    if (p.attachedIsofacDocId) {
      const doc = storage.getIsofacDoc(p.attachedIsofacDocId);
      if (!doc) return { error: "Attached ISOFAC document not found" as const };
      if (!(SIGN_IN_ISO_FAC_TYPES as readonly string[]).includes(doc.type)) {
        return {
          error: "Choose an order/plan document (e.g. OPORD, CONOP, FRAGORD) to attach" as const,
        };
      }
    }
    if (p.operationId) {
      const op = storage.getOperation(p.operationId);
      if (!op) return { error: "Operation not found" as const };
    }
    return null;
  }

  app.post("/api/training", requireAdmin, (req, res) => {
    const parsed = trainingPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const p = parsed.data;
    const bad = validateTrainingPayload(p);
    if (bad) return res.status(400).json({ error: bad.error });
    const rec = storage.createTrainingRecord({
      username: p.username,
      eventName: p.eventName,
      category: p.category,
      date: p.date,
      result: p.result,
      instructor: p.instructor,
      expiresAt: p.expiresAt,
      notes: p.notes,
      attachedIsofacDocId: p.attachedIsofacDocId,
      operationId: p.operationId,
      createdAt: new Date().toISOString(),
    });
    wsPush("TRAINING");
    res.status(201).json(rec);
  });

  const trainingBatchSchema = trainingPostSchema.omit({ username: true }).extend({
    usernames: z.array(z.string().min(1)).min(1),
  });

  app.post("/api/training/batch", requireAdmin, (req, res) => {
    const parsed = trainingBatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const p = parsed.data;
    const bad = validateTrainingPayload({ attachedIsofacDocId: p.attachedIsofacDocId, operationId: p.operationId });
    if (bad) return res.status(400).json({ error: bad.error });
    const seen = new Set<string>();
    const unique = p.usernames.map((u) => u.trim()).filter((u) => {
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
    if (unique.length === 0) return res.status(400).json({ error: "No valid usernames" });
    const now = new Date().toISOString();
    const records = unique.map((username) =>
      storage.createTrainingRecord({
        username,
        eventName: p.eventName,
        category: p.category,
        date: p.date,
        result: p.result,
        instructor: p.instructor,
        expiresAt: p.expiresAt,
        notes: p.notes,
        attachedIsofacDocId: p.attachedIsofacDocId,
        operationId: p.operationId,
        createdAt: now,
      }),
    );
    wsPush("TRAINING");
    res.status(201).json({ count: records.length, records });
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
    wsPush("LINKS");
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
  app.get("/api/entity-links/all", requireAuth, (_, res) => {
    res.json(storage.getAllEntityLinks());
  });

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
    wsPush("LINKS");
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

  // ── Promotion packets (request → approvals queue → admin approves → rank + FLASH) ──
  app.post("/api/promotion-packets/request", requireAdmin, (req, res) => {
    const parsed = promotionPacketRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const seen = new Set<string>();
    const frozen: Array<{
      username: string;
      userId: number;
      previousRank: string;
      newRank: string;
      pmos: string;
      effectiveDate: string;
    }> = [];
    for (const line of parsed.data.promotions) {
      const uname = line.username.trim();
      const u = storage.getUserByUsername(uname);
      if (!u) return res.status(400).json({ error: `Unknown user: ${uname}` });
      const key = u.username.toLowerCase();
      if (seen.has(key)) return res.status(400).json({ error: `Duplicate in packet: ${u.username}` });
      seen.add(key);
      const nr = line.newRank.trim();
      if (!ARMY_RANKS.some((r) => r.abbr === nr)) {
        return res.status(400).json({ error: `Invalid new rank: ${nr}` });
      }
      const prev = (u.rank || "").trim();
      const ni = armyRankIndex(nr);
      const pi = armyRankIndex(prev);
      if (prev && ni >= 0 && pi >= 0 && ni <= pi) {
        return res.status(400).json({ error: `New rank must be above current rank for ${u.username}` });
      }
      frozen.push({
        username: u.username,
        userId: u.id,
        previousRank: prev,
        newRank: nr,
        pmos: (u.mos || "").trim(),
        effectiveDate: line.effectiveDate.trim(),
      });
    }
    const now = new Date().toISOString();
    const entityId = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const approval = storage.createApproval({
      entityType: "promotion_packet",
      entityId,
      action: "PROMOTE",
      status: "pending",
      requestedBy: req.session.username!,
      requestedAt: now,
      requestedNote: (parsed.data.requestedNote || "").trim(),
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({ promotions: frozen }),
    });
    wsPush("APPROVALS");
    appendActivity(req, {
      action: "CREATE",
      entityType: "approval",
      entityId: approval.id,
      summary: `Promotion packet requested (${frozen.length} soldier(s))`,
      after: approval,
    });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });

  // ── Leave of Absence (LOA) ───────────────────────────────────────────────────
  app.post("/api/loa/request", requireAuth, (req, res) => {
    const parsed = loaRequestPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const me = req.session.username!;
    storage.reconcileExpiredLoas();
    const existingPending = storage.listLoaRequestsForUser(me).find(
      (r) => r.subjectUsername === me && r.status === "pending",
    );
    if (existingPending) {
      return res.status(400).json({ error: "You already have a pending LOA request." });
    }
    const start = parsed.data.startDate.trim();
    const end = parsed.data.endDate.trim();
    if (start > end) return res.status(400).json({ error: "End date must be on or after start date" });
    const now = new Date().toISOString();
    const loa = storage.createLoaRequest({
      subjectUsername: me,
      startDate: start,
      endDate: end,
      reason: (parsed.data.reason || "").trim().slice(0, 4000),
      status: "pending",
      requestedBy: me,
      createdAt: now,
      updatedAt: now,
    });
    const approval = storage.createApproval({
      entityType: "loa_request",
      entityId: String(loa.id),
      action: "REQUEST_LEAVE",
      status: "pending",
      requestedBy: me,
      requestedAt: now,
      requestedNote: (parsed.data.reason || "").trim().slice(0, 2000),
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify({
        loaRequestId: loa.id,
        subjectUsername: me,
        startDate: start,
        endDate: end,
      }),
    });
    wsPush("APPROVALS");
    appendActivity(req, {
      action: "CREATE",
      entityType: "approval",
      entityId: approval.id,
      summary: `LOA requested: ${me} ${start}–${end}`,
      after: approval,
    });
    res.status(202).json({ ok: true, loaRequestId: loa.id, approvalId: approval.id });
  });

  app.get("/api/loa/mine", requireAuth, (req, res) => {
    storage.reconcileExpiredLoas();
    res.json(storage.listLoaRequestsForUser(req.session.username!));
  });

  app.get("/api/loa/pending-early-return", requireAuth, (req, res) => {
    storage.reconcileExpiredLoas();
    const row = storage.getPendingEarlyReturnApprovalForUser(req.session.username!);
    res.json(row ?? null);
  });

  app.get("/api/loa/my-return-requests", requireAuth, (req, res) => {
    storage.reconcileExpiredLoas();
    res.json(storage.listLoaEarlyReturnApprovalsForUser(req.session.username!));
  });

  app.get("/api/loa/approved-for-admin", requireAuth, requireAdmin, (_req, res) => {
    storage.reconcileExpiredLoas();
    res.json(storage.listApprovedLoaRequests());
  });

  app.post("/api/loa/early-return", requireAuth, (req, res) => {
    const parsed = loaEarlyReturnPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const me = req.session.username!;
    storage.reconcileExpiredLoas();
    const u = storage.getUserByUsername(me);
    if (!u) return res.status(400).json({ error: "User not found" });
    const loaStart = (u.loaStart || "").trim();
    const loaEnd = (u.loaEnd || "").trim();
    if (!loaStart || !loaEnd) {
      return res.status(400).json({ error: "You do not have an active approved leave on file." });
    }
    const match = storage.findApprovedLoaMatchingUserWindow(me);
    if (!match) {
      return res.status(400).json({ error: "No matching approved LOA record — contact an administrator." });
    }
    if (storage.hasPendingEarlyReturnApproval(me)) {
      return res.status(400).json({ error: "You already have a pending early return request." });
    }
    const ret = parsed.data.returnDate.trim();
    if (ret < loaStart || ret > loaEnd) {
      return res.status(400).json({ error: "Return date must be within your approved leave window (inclusive)." });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (ret < today) {
      return res.status(400).json({ error: "Return date cannot be before today." });
    }
    const now = new Date().toISOString();
    const reason = (parsed.data.reason || "").trim().slice(0, 4000);
    const payload = {
      loaRequestId: match.id,
      subjectUsername: me,
      returnDate: ret,
      previousEndDate: loaEnd,
      reason,
    };
    const approval = storage.createApproval({
      entityType: "loa_early_return",
      entityId: String(match.id),
      action: "REQUEST_EARLY_RETURN",
      status: "pending",
      requestedBy: me,
      requestedAt: now,
      requestedNote: reason.slice(0, 2000),
      approvedBy: "",
      approvedAt: "",
      decisionNote: "",
      payloadJson: JSON.stringify(payload),
    });
    wsPush("APPROVALS");
    wsPush("USER");
    appendActivity(req, {
      action: "CREATE",
      entityType: "approval",
      entityId: approval.id,
      summary: `Early return requested: ${me} by ${ret}`,
      after: approval,
    });
    res.status(202).json({ ok: true, approvalId: approval.id });
  });

  app.post("/api/loa/:id/retract", requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    storage.reconcileExpiredLoas();
    const r = storage.retractApprovedLoa(id);
    if (!r.ok) return res.status(400).json({ error: r.error });
    wsPush("USER");
    wsPush("PERSTAT");
    wsPush("PERSONNEL_ROSTER");
    appendActivity(req, {
      action: "UPDATE",
      entityType: "loa_request",
      entityId: id,
      summary: `Retracted approved LOA #${id}`,
    });
    res.json({ ok: true });
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
    if (row.entityType === "promotion_packet" && row.action === "PROMOTE") {
      try {
        const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
        const list = Array.isArray(payload.promotions) ? payload.promotions : [];
        const ordersLines: PromotionOrdersLine[] = [];
        for (const p of list) {
          const uid = Number(p.userId);
          const newRank = String(p.newRank || "").trim();
          if (!Number.isFinite(uid) || !newRank) continue;
          const u = storage.getUserById(uid);
          if (!u || u.username !== String(p.username || "").trim()) continue;
          storage.updateUserById(uid, { rank: newRank });
          ordersLines.push({
            username: u.username,
            previousRank: String(p.previousRank || "").trim(),
            newRank,
            pmos: String(p.pmos || "").trim(),
            effectiveDate: String(p.effectiveDate || "").trim(),
          });
        }
        wsPush("USER");
        const body = buildPromotionOrdersMessage(ordersLines);
        const nowIso = new Date().toISOString();
        const from = row.approvedBy || "COMMAND";
        const ws = (global as any).__wsBroadcast as ((msg: object, to?: string[]) => void) | undefined;
        for (const line of ordersLines) {
          const b = storage.createBroadcast({
            title: "PROMOTION ORDERS",
            message: body,
            priority: "immediate",
            sentBy: from,
            sentAt: nowIso,
            expiresAt: "",
            active: true,
            recipientUsername: line.username,
          });
          if (ws) ws({ type: "BROADCAST", broadcast: b }, [line.username]);
        }
        appendActivity(req, {
          action: "UPDATE",
          entityType: "promotion_packet",
          entityId: row.entityId,
          summary: `Approved promotion packet (${ordersLines.length} promotion(s))`,
          after: { count: ordersLines.length },
        });
      } catch (e) {
        console.error("promotion_packet approve:", e);
      }
    }
    if (row.entityType === "loa_request" && row.action === "REQUEST_LEAVE") {
      try {
        const loaId = Number(row.entityId);
        if (Number.isFinite(loaId)) {
          const r = storage.applyApprovedLoa(loaId, req.session.username!);
          if (r.ok) {
            wsPush("USER");
            wsPush("PERSTAT");
            wsPush("PERSONNEL_ROSTER");
            appendActivity(req, {
              action: "UPDATE",
              entityType: "loa_request",
              entityId: loaId,
              summary: `Approved LOA #${loaId} for subject`,
            });
          }
        }
      } catch (e) {
        console.error("loa_request approve:", e);
      }
    }
    if (row.entityType === "loa_early_return" && row.action === "REQUEST_EARLY_RETURN") {
      try {
        const r = storage.applyApprovedEarlyReturn(row, req.session.username!);
        if (r.ok) {
          wsPush("USER");
          wsPush("PERSTAT");
          wsPush("PERSONNEL_ROSTER");
          appendActivity(req, {
            action: "UPDATE",
            entityType: "loa_early_return",
            entityId: row.entityId,
            summary: `Approved early return for ${row.requestedBy}`,
          });
        } else {
          console.error("loa_early_return approve:", r.error);
        }
      } catch (e) {
        console.error("loa_early_return approve:", e);
      }
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
    const before = storage.getApproval(id);
    const row = storage.rejectApproval(id, req.session.username!, parsed.data.decisionNote);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (before?.entityType === "loa_request" && before.action === "REQUEST_LEAVE") {
      const loaId = Number(before.entityId);
      if (Number.isFinite(loaId)) storage.rejectLoaRequest(loaId);
    }
    wsPush("APPROVALS");
    appendActivity(req, { action: "UPDATE", entityType: "approval", entityId: row.id, summary: `Rejected: ${row.entityType} ${row.entityId}`, after: row });
    res.json(row);
  });

  app.delete("/api/approvals/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const before = storage.getApproval(id);
    if (!before) return res.status(404).json({ error: "Not found" });
    storage.deleteApproval(id);
    wsPush("APPROVALS");
    appendActivity(req, {
      action: "DELETE",
      entityType: "approval",
      entityId: id,
      summary: `Deleted approval record #${id} (${before.entityType} ${before.entityId})`,
      before,
    });
    res.status(204).send();
  });

  // ── Broadcasts (FLASH) ────────────────────────────────────────────────────────
  app.get("/api/broadcasts", requireAuth, (req, res) =>
    res.json(storage.getActiveBroadcasts(req.session.username!)),
  );
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
    const broadcasts = storage.getActiveBroadcasts(me).length;
    const dms = storage.getUnreadDMCount(me);
    const general = storage.getUnreadGeneralCount(me);
    res.json({ broadcasts, dms, general, total: broadcasts + dms + general });
  });
}
