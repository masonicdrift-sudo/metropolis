import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { upload } from "./upload";
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

// Helper: push a WS event to all connected clients
function wsPush(type: string, extra?: object) {
  const broadcast = (global as any).__wsBroadcast;
  if (broadcast) broadcast({ type, ...extra });
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
    res.json({ id: user.id, username: user.username, role: user.role, rank: user.rank || "", assignedUnit: user.assignedUnit || "" });
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
    // Role creation rules:
    //  - Owner (rank 3): can create Owner, Admin, Operator
    //  - Admin (rank 2): can create Admin and Operator, NOT Owner
    //  - Operator (rank 1): cannot create anyone (blocked by requireAdmin above)
    const requestedRole = role || "user";
    const callerRank = ROLE_RANK[req.session.role || ""] ?? 0;
    const targetRank = ROLE_RANK[requestedRole] ?? 0;
    if (targetRank > callerRank) return res.status(403).json({ error: "Cannot create a user with a role higher than your own" });
    const exists = storage.getUserByUsername(username);
    if (exists) return res.status(409).json({ error: "Username already exists" });
    const user = storage.createUser(username, password, requestedRole);
    res.status(201).json(safeUser(user));
  });
  // Owner-only: edit any user's username, role, or reset password
  app.patch("/api/users/:id", requireOwner, (req, res) => {
    const id = Number(req.params.id);
    const { username, role, password } = req.body;
    const target = storage.getUserById(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    // Build update payload
    const updates: Record<string, any> = {};
    if (username && username !== target.username) {
      const exists = storage.getUserByUsername(username);
      if (exists) return res.status(409).json({ error: "Username already taken" });
      updates.username = username;
    }
    if (role && ROLE_RANK[role] !== undefined) {
      updates.role = role;
    }
    if (typeof req.body.rank !== "undefined") {
      updates.rank = req.body.rank;
    }
    if (typeof req.body.assignedUnit !== "undefined") {
      updates.assignedUnit = req.body.assignedUnit;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const bcrypt = require("bcryptjs");
      updates.passwordHash = bcrypt.hashSync(password, 10);
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const updated = storage.updateUserById(id, updates); wsPush("USER");
    const { passwordHash, ...safe } = updated as any;
    res.json(safe);
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
    res.status(201).json(idoc2);
  });
  app.patch("/api/isofac/:id", requireAuth, (req, res) => {
    const doc = storage.updateIsofacDoc(Number(req.params.id), req.body);
    if (!doc) return res.status(404).json({ error: "Not found" });
    wsPush("ISOFAC"); res.json(doc);
  });
  app.delete("/api/isofac/:id", requireAdmin, (req, res) => {
    storage.deleteIsofacDoc(Number(req.params.id)); wsPush("ISOFAC");
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
    const msg = storage.sendMessage(req.session.username!, `GROUP:${id}`, content.trim(), attachment || "");
    const broadcast = (global as any).__wsBroadcast;
    if (broadcast) broadcast({ type: "GROUP_MESSAGE", groupId: id, message: msg }, members);
    res.status(201).json(msg);
  });
  // Add member to group (creator or admin+)
  app.post("/api/groups/:id/members", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const group = storage.getGroup(id);
    if (!group) return res.status(404).json({ error: "Not found" });
    const callerRank = ROLE_RANK[req.session.role || ""] ?? 0;
    if (group.createdBy !== req.session.username && callerRank < ROLE_RANK.admin)
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
    const callerRank = ROLE_RANK[req.session.role || ""] ?? 0;
    if (group.createdBy !== req.session.username && callerRank < ROLE_RANK.admin)
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
    const msg = storage.sendMessage(req.session.username!, "GENERAL", content?.trim() || "", attachment || "");
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
    const { content, attachment } = req.body;
    if (!content?.trim() && !attachment) return res.status(400).json({ error: "Content or attachment required" });
    const me = req.session.username!;
    const to = req.params.username;
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
    const op = storage.createOperation(parsed.data); wsPush("OPERATION"); res.status(201).json(op);
  });
  app.patch("/api/operations/:id", requireAuth, (req, res) => {
    const op = storage.updateOperation(Number(req.params.id), req.body);
    if (!op) return res.status(404).json({ error: "Not found" });
    wsPush("OPERATION"); res.json(op);
  });
  app.delete("/api/operations/:id", requireAuth, (req, res) => {
    storage.deleteOperation(Number(req.params.id)); wsPush("OPERATION");
    res.status(204).send();
  });

  // ── Intel ────────────────────────────────────────────────────────────────────
  app.get("/api/intel", requireAuth, (_, res) => res.json(storage.getIntelReports()));
  app.post("/api/intel", requireAuth, (req, res) => {
    const parsed = insertIntelReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const ir = storage.createIntelReport(parsed.data); wsPush("INTEL"); res.status(201).json(ir);
  });
  app.patch("/api/intel/:id", requireAuth, (req, res) => {
    const report = storage.updateIntelReport(Number(req.params.id), req.body);
    if (!report) return res.status(404).json({ error: "Not found" });
    wsPush("INTEL"); res.json(report);
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
    storage.deleteIntelReport(Number(req.params.id)); wsPush("INTEL");
    res.status(204).send();
  });

  // ── Comms ────────────────────────────────────────────────────────────────────
  app.get("/api/comms", requireAuth, (_, res) => res.json(storage.getCommsLog()));
  app.post("/api/comms", requireAuth, (req, res) => {
    const parsed = insertCommsLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const cl = storage.createCommsEntry(parsed.data); wsPush("COMMS"); res.status(201).json(cl);
  });
  app.patch("/api/comms/:id/ack", requireAuth, (req, res) => {
    const entry = storage.acknowledgeComms(Number(req.params.id));
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  });
  app.delete("/api/comms/:id", requireOwner, (req, res) => {
    storage.deleteCommsEntry(Number(req.params.id));
    res.status(204).send();
  });
  app.delete("/api/comms", requireOwner, (_, res) => {
    storage.clearCommsLog();
    res.status(204).send();
  });

  // ── Assets ───────────────────────────────────────────────────────────────────
  app.get("/api/assets", requireAuth, (_, res) => res.json(storage.getAssets()));
  app.post("/api/assets", requireAuth, (req, res) => {
    const parsed = insertAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const asset = storage.createAsset(parsed.data); wsPush("ASSET"); res.status(201).json(asset);
  });
  app.patch("/api/assets/:id", requireAuth, (req, res) => {
    const asset = storage.updateAsset(Number(req.params.id), req.body);
    if (!asset) return res.status(404).json({ error: "Not found" });
    wsPush("ASSET"); res.json(asset);
  });
  app.delete("/api/assets/:id", requireAuth, (req, res) => {
    storage.deleteAsset(Number(req.params.id)); wsPush("ASSET");
    res.status(204).send();
  });

  // ── Threats ──────────────────────────────────────────────────────────────────
  app.get("/api/threats", requireAuth, (_, res) => res.json(storage.getThreats()));
  app.post("/api/threats", requireAuth, (req, res) => {
    const parsed = insertThreatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const threat = storage.createThreat(parsed.data); wsPush("THREAT"); res.status(201).json(threat);
  });
  app.patch("/api/threats/:id", requireAuth, (req, res) => {
    const t = storage.updateThreat(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    wsPush("THREAT"); res.json(t);
  });
  app.delete("/api/threats/:id", requireAuth, (req, res) => {
    storage.deleteTheat(Number(req.params.id)); wsPush("THREAT");
    res.status(204).send();
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
    if (target !== req.session.username && (require("@shared/schema").ROLE_RANK[req.session.role || ""] ?? 0) < 2)
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
    wsPush("OP_TASK", { operationId: Number(req.params.id) }); res.status(201).json(task);
  });
  app.patch("/api/tasks/:id", requireAuth, (req, res) => {
    const task = storage.updateOpTask(Number(req.params.id), req.body);
    if (!task) return res.status(404).json({ error: "Not found" });
    wsPush("OP_TASK", { operationId: task.operationId }); res.json(task);
  });
  app.delete("/api/tasks/:id", requireAdmin, (req, res) => {
    storage.deleteOpTask(Number(req.params.id)); wsPush("OP_TASK");
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
    const callerRank = ROLE_RANK[req.session.role || ""] ?? 0;
    const isStaff = callerRank >= ROLE_RANK.admin;
    const rawU = req.query.username;
    const qUser = typeof rawU === "string" ? rawU : Array.isArray(rawU) ? rawU[0] : undefined;
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

  // ── Notifications (aggregate unread counts) ───────────────────────────────────
  app.get("/api/notifications", requireAuth, (req, res) => {
    const me = req.session.username!;
    const broadcasts = storage.getActiveBroadcasts().length;
    const dms = storage.getUnreadDMCount(me);
    const general = storage.getUnreadGeneralCount(me);
    res.json({ broadcasts, dms, general, total: broadcasts + dms + general });
  });
}
