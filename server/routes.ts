import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import {
  insertUnitSchema, insertOperationSchema, insertIntelReportSchema,
  insertCommsLogSchema, insertAssetSchema, insertThreatSchema,
} from "@shared/schema";

export function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  // ── Units ────────────────────────────────────────────────────────────────────
  app.get("/api/units", (_, res) => res.json(storage.getUnits()));
  app.post("/api/units", (req, res) => {
    const parsed = insertUnitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createUnit(parsed.data));
  });
  app.patch("/api/units/:id", (req, res) => {
    const unit = storage.updateUnit(Number(req.params.id), req.body);
    if (!unit) return res.status(404).json({ error: "Not found" });
    res.json(unit);
  });
  app.delete("/api/units/:id", (req, res) => {
    storage.deleteUnit(Number(req.params.id));
    res.status(204).send();
  });

  // ── Operations ───────────────────────────────────────────────────────────────
  app.get("/api/operations", (_, res) => res.json(storage.getOperations()));
  app.post("/api/operations", (req, res) => {
    const parsed = insertOperationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createOperation(parsed.data));
  });
  app.patch("/api/operations/:id", (req, res) => {
    const op = storage.updateOperation(Number(req.params.id), req.body);
    if (!op) return res.status(404).json({ error: "Not found" });
    res.json(op);
  });
  app.delete("/api/operations/:id", (req, res) => {
    storage.deleteOperation(Number(req.params.id));
    res.status(204).send();
  });

  // ── Intel ────────────────────────────────────────────────────────────────────
  app.get("/api/intel", (_, res) => res.json(storage.getIntelReports()));
  app.post("/api/intel", (req, res) => {
    const parsed = insertIntelReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createIntelReport(parsed.data));
  });
  app.patch("/api/intel/:id", (req, res) => {
    const report = storage.updateIntelReport(Number(req.params.id), req.body);
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(report);
  });
  app.delete("/api/intel/:id", (req, res) => {
    storage.deleteIntelReport(Number(req.params.id));
    res.status(204).send();
  });

  // ── Comms ────────────────────────────────────────────────────────────────────
  app.get("/api/comms", (_, res) => res.json(storage.getCommsLog()));
  app.post("/api/comms", (req, res) => {
    const parsed = insertCommsLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createCommsEntry(parsed.data));
  });
  app.patch("/api/comms/:id/ack", (req, res) => {
    const entry = storage.acknowledgeComms(Number(req.params.id));
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  });

  // ── Assets ───────────────────────────────────────────────────────────────────
  app.get("/api/assets", (_, res) => res.json(storage.getAssets()));
  app.post("/api/assets", (req, res) => {
    const parsed = insertAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createAsset(parsed.data));
  });
  app.patch("/api/assets/:id", (req, res) => {
    const asset = storage.updateAsset(Number(req.params.id), req.body);
    if (!asset) return res.status(404).json({ error: "Not found" });
    res.json(asset);
  });
  app.delete("/api/assets/:id", (req, res) => {
    storage.deleteAsset(Number(req.params.id));
    res.status(204).send();
  });

  // ── Threats ──────────────────────────────────────────────────────────────────
  app.get("/api/threats", (_, res) => res.json(storage.getThreats()));
  app.post("/api/threats", (req, res) => {
    const parsed = insertThreatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.status(201).json(storage.createThreat(parsed.data));
  });
  app.patch("/api/threats/:id", (req, res) => {
    const t = storage.updateThreat(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });
  app.delete("/api/threats/:id", (req, res) => {
    storage.deleteTheat(Number(req.params.id));
    res.status(204).send();
  });
}
