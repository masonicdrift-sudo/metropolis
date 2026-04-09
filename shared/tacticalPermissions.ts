/**
 * Tactical role permissions — union of assigned roles grants visibility (Discord-style).
 * Wildcard `*` means all keys in ALL_TACTICAL_PERMISSION_KEYS.
 */
export const TACTICAL_PERMISSION_DEFS = [
  { key: "view:calendar", label: "Calendar", group: "General" },
  { key: "view:operations", label: "Operations", group: "Operations" },
  { key: "view:intel", label: "Intelligence", group: "Intelligence" },
  { key: "view:comms", label: "Communications", group: "Communications" },
  { key: "view:personnel", label: "Personnel", group: "Personnel" },
  { key: "view:tactical", label: "Tactical (map / grid)", group: "Tactical" },
  { key: "view:isofac", label: "ISOFAC", group: "Documents" },
  { key: "view:training", label: "Training & awards", group: "Training" },
  { key: "view:assets", label: "Assets", group: "Logistics" },
  { key: "view:messages", label: "Messages", group: "Communications" },
  { key: "view:approvals", label: "Approvals queue", group: "Staff" },
  { key: "view:activity", label: "Activity log", group: "Audit" },
  { key: "view:support", label: "Support & medical", group: "Support" },
  { key: "view:settings", label: "Settings (self)", group: "Account" },
  { key: "view:broadcasts", label: "Broadcasts", group: "Admin" },
] as const;

export const ALL_TACTICAL_PERMISSION_KEYS: string[] = [
  ...TACTICAL_PERMISSION_DEFS.map((d) => d.key),
];

/** Raw permission keys from roles → effective view keys (expands `*`). */
export function expandEffectivePermissionKeys(raw: string[]): Set<string> {
  const out = new Set<string>();
  for (const k of raw) {
    if (k === "*") {
      for (const x of ALL_TACTICAL_PERMISSION_KEYS) out.add(x);
      return out;
    }
    out.add(k);
  }
  return out;
}

export function hasTacticalPermission(effectiveKeys: Set<string>, required: string): boolean {
  return effectiveKeys.has(required);
}

/** Longest-prefix wins. */
/** Longest-prefix match for hash routes (e.g. /personnel/perstat → personnel). */
export function permissionForClientPath(pathname: string): string | null {
  const keys = Object.keys(NAV_PATH_PERMISSION).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key === "/") {
      if (pathname === "/") return NAV_PATH_PERMISSION["/"] ?? null;
      continue;
    }
    if (pathname === key || pathname.startsWith(`${key}/`)) return NAV_PATH_PERMISSION[key];
  }
  return null;
}

export function permissionForApiPath(urlPath: string): string | null {
  const path = urlPath.replace(/\?.*$/, "");
  let best: { prefix: string; permission: string } | null = null;
  for (const row of API_PREFIX_PERMISSION) {
    if (path.startsWith(row.prefix)) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  return best?.permission ?? null;
}

/** Nav path → permission (client + docs). */
export const NAV_PATH_PERMISSION: Record<string, string> = {
  "/": "view:calendar", // dashboard — use calendar perm or add view:dashboard
  "/calendar": "view:calendar",
  "/operations": "view:operations",
  "/operations/tasks": "view:operations",
  "/operations/aar": "view:operations",
  "/intel": "view:intel",
  "/intel/links": "view:intel",
  "/intel/vault": "view:intel",
  "/comms": "view:comms",
  "/comms/commo-card": "view:comms",
  "/personnel": "view:personnel",
  "/personnel/perstat": "view:personnel",
  "/personnel/roster": "view:personnel",
  "/personnel/units": "view:personnel",
  "/personnel/promotions": "view:personnel",
  "/personnel/loa": "view:personnel",
  "/personnel/org-chart": "view:personnel",
  "/tactical": "view:tactical",
  "/tactical/map": "view:tactical",
  "/tactical/grid": "view:tactical",
  "/isofac": "view:isofac",
  "/approvals": "view:approvals",
  "/messages": "view:messages",
  "/training": "view:training",
  "/training/qualifications": "view:training",
  "/training/awards": "view:training",
  "/assets": "view:assets",
  "/activity": "view:activity",
  "/support": "view:support",
  "/support/medical": "view:support",
  "/settings": "view:settings",
  "/broadcasts": "view:broadcasts",
};

/** API path prefix → permission (GET/POST same area). Longer prefixes must match first (handled in permissionForApiPath). */
export const API_PREFIX_PERMISSION: { prefix: string; permission: string }[] = [
  { prefix: "/api/calendar-events", permission: "view:calendar" },
  { prefix: "/api/personnel-roster", permission: "view:personnel" },
  { prefix: "/api/promotion-packets", permission: "view:personnel" },
  { prefix: "/api/loa", permission: "view:personnel" },
  { prefix: "/api/tactical-markers", permission: "view:tactical" },
  { prefix: "/api/tactical-lines", permission: "view:tactical" },
  { prefix: "/api/tactical-range-rings", permission: "view:tactical" },
  { prefix: "/api/tactical-building-labels", permission: "view:tactical" },
  { prefix: "/api/entity-links", permission: "view:intel" },
  { prefix: "/api/notifications", permission: "view:messages" },
  { prefix: "/api/commo-cards", permission: "view:comms" },
  { prefix: "/api/broadcasts", permission: "view:broadcasts" },
  { prefix: "/api/dashboard", permission: "view:calendar" },
  { prefix: "/api/terrain", permission: "view:tactical" },
  { prefix: "/api/aar", permission: "view:operations" },
  { prefix: "/api/tasks", permission: "view:operations" },
  { prefix: "/api/calendar", permission: "view:calendar" },
  { prefix: "/api/operations", permission: "view:operations" },
  { prefix: "/api/intel", permission: "view:intel" },
  { prefix: "/api/comms", permission: "view:comms" },
  { prefix: "/api/units", permission: "view:personnel" },
  { prefix: "/api/perstat", permission: "view:personnel" },
  { prefix: "/api/org-chart", permission: "view:personnel" },
  { prefix: "/api/personnel", permission: "view:personnel" },
  { prefix: "/api/isofac", permission: "view:isofac" },
  { prefix: "/api/approvals", permission: "view:approvals" },
  { prefix: "/api/messages", permission: "view:messages" },
  { prefix: "/api/groups", permission: "view:messages" },
  { prefix: "/api/qualifications", permission: "view:training" },
  { prefix: "/api/training", permission: "view:training" },
  { prefix: "/api/awards", permission: "view:training" },
  { prefix: "/api/assets", permission: "view:assets" },
  { prefix: "/api/activity", permission: "view:activity" },
  { prefix: "/api/support", permission: "view:support" },
  { prefix: "/api/casualties", permission: "view:support" },
];
