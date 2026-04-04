import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  insertUnitSchema, insertOperationSchema, insertIntelReportSchema,
  insertCommsLogSchema, insertAssetSchema, insertThreatSchema,
  ROLE_RANK,
} from "@shared/schema";

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

// Middleware: require logged-in session
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Middleware: require admin or higher
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if ((ROLE_RANK[req.session.role || ""] ?? 0) < ROLE_RANK.admin) return res.status(403).json({ error: "Forbidden" });
  next();
}

// Middleware: require owner role only
function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.role !== "owner") return res.status(403).json({ error: "Forbidden — Owner only" });
  next();
}

export function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    // Generic error — never reveal whether username or password was wrong
    if (!username || !password) return res.status(401).json({ error: "Invalid credentials" });
    const user = storage.getUserByUsername(username);
    // Always run bcrypt compare to prevent timing attacks (even if user not found)
    const dummyHash = "$2a$10$invalidhashfortimingprotection000000000000000000000000";
    const valid = user ? bcrypt.compareSync(password, user.passwordHash) : bcrypt.compareSync(password, dummyHash);
    if (!user || !valid) return res.status(401).json({ error: "Invalid credentials" });
    storage.updateLastLogin(user.id);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    // Only return safe fields — never the hash
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });
    res.json({ id: req.session.userId, username: req.session.username, role: req.session.role });
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
    req.session.role = user.role;
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
  app.post("/api/users", requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    // Admins cannot create owner-level accounts
    const requestedRole = role || "user";
    const callerRank = ROLE_RANK[req.session.role || ""] ?? 0;
    if (ROLE_RANK[requestedRole] >= callerRank) return res.status(403).json({ error: "Cannot create a user with equal or higher role than your own" });
    const exists = storage.getUserByUsername(username);
    if (exists) return res.status(409).json({ error: "Username already exists" });
    const user = storage.createUser(username, password, requestedRole);
    res.status(201).json(safeUser(user));
  });
  app.delete("/api/users/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot delete your own account" });
    // Check target user's role — you can only delete users with lower rank than you
    const target = storage.getUserById(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const callerRank = ROLE_RANK[req.session.role || ""] ?? 0;
    const targetRank = ROLE_RANK[target.role] ?? 0;
    if (targetRank >= callerRank) return res.status(403).json({ error: "Cannot delete a user with equal or higher role" });
    storage.deleteUser(id);
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
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const msg = storage.sendMessage(req.session.username!, "GENERAL", content.trim());
    // Broadcast to all connected WS clients
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "GENERAL_MESSAGE", message: msg });
    res.status(201).json(msg);
  });

  // DM list for current user
  app.get("/api/messages/dms", requireAuth, (req, res) => {
    res.json(storage.getDMList(req.session.username!));
  });

  // DM conversation with a specific user
  app.get("/api/messages/dm/:username", requireAuth, (req, res) => {
    const me = req.session.username!;
    const other = req.params.username;
    const msgs = storage.getDMConversation(me, other);
    // Mark as read
    storage.markRead(other, me, me);
    res.json(msgs);
  });

  app.post("/api/messages/dm/:username", requireAuth, (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const me = req.session.username!;
    const to = req.params.username;
    if (me === to) return res.status(400).json({ error: "Cannot DM yourself" });
    const msg = storage.sendMessage(me, to, content.trim());
    // Push to both sender and recipient via WebSocket
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
  app.post("/api/units", requireAuth, (req, res) => {
    const parsed = insertUnitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createUnit(parsed.data));
  });
  app.patch("/api/units/:id", requireAuth, (req, res) => {
    const unit = storage.updateUnit(Number(req.params.id), req.body);
    if (!unit) return res.status(404).json({ error: "Not found" });
    res.json(unit);
  });
  app.delete("/api/units/:id", requireAuth, (req, res) => {
    storage.deleteUnit(Number(req.params.id));
    res.status(204).send();
  });

  // ── Operations ───────────────────────────────────────────────────────────────
  app.get("/api/operations", requireAuth, (_, res) => res.json(storage.getOperations()));
  app.post("/api/operations", requireAuth, (req, res) => {
    const parsed = insertOperationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createOperation(parsed.data));
  });
  app.patch("/api/operations/:id", requireAuth, (req, res) => {
    const op = storage.updateOperation(Number(req.params.id), req.body);
    if (!op) return res.status(404).json({ error: "Not found" });
    res.json(op);
  });
  app.delete("/api/operations/:id", requireAuth, (req, res) => {
    storage.deleteOperation(Number(req.params.id));
    res.status(204).send();
  });

  // ── Intel ────────────────────────────────────────────────────────────────────
  app.get("/api/intel", requireAuth, (_, res) => res.json(storage.getIntelReports()));
  app.post("/api/intel", requireAuth, (req, res) => {
    const parsed = insertIntelReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createIntelReport(parsed.data));
  });
  app.patch("/api/intel/:id", requireAuth, (req, res) => {
    const report = storage.updateIntelReport(Number(req.params.id), req.body);
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(report);
  });
  app.delete("/api/intel/:id", requireAuth, (req, res) => {
    storage.deleteIntelReport(Number(req.params.id));
    res.status(204).send();
  });

  // ── Comms ────────────────────────────────────────────────────────────────────
  app.get("/api/comms", requireAuth, (_, res) => res.json(storage.getCommsLog()));
  app.post("/api/comms", requireAuth, (req, res) => {
    const parsed = insertCommsLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createCommsEntry(parsed.data));
  });
  app.patch("/api/comms/:id/ack", requireAuth, (req, res) => {
    const entry = storage.acknowledgeComms(Number(req.params.id));
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  });

  // ── Assets ───────────────────────────────────────────────────────────────────
  app.get("/api/assets", requireAuth, (_, res) => res.json(storage.getAssets()));
  app.post("/api/assets", requireAuth, (req, res) => {
    const parsed = insertAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createAsset(parsed.data));
  });
  app.patch("/api/assets/:id", requireAuth, (req, res) => {
    const asset = storage.updateAsset(Number(req.params.id), req.body);
    if (!asset) return res.status(404).json({ error: "Not found" });
    res.json(asset);
  });
  app.delete("/api/assets/:id", requireAuth, (req, res) => {
    storage.deleteAsset(Number(req.params.id));
    res.status(204).send();
  });

  // ── Threats ──────────────────────────────────────────────────────────────────
  app.get("/api/threats", requireAuth, (_, res) => res.json(storage.getThreats()));
  app.post("/api/threats", requireAuth, (req, res) => {
    const parsed = insertThreatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createThreat(parsed.data));
  });
  app.patch("/api/threats/:id", requireAuth, (req, res) => {
    const t = storage.updateThreat(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });
  app.delete("/api/threats/:id", requireAuth, (req, res) => {
    storage.deleteTheat(Number(req.params.id));
    res.status(204).send();
  });
}
