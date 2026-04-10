/** Items for horizontal sub-tabs on section pages (paths match wouter + hash router). */
export type SubNavItem = { href: string; label: string; short?: string };

export const OPS_SUB: SubNavItem[] = [
  { href: "/operations", label: "OPERATIONS", short: "Ops" },
  { href: "/operations/tasks", label: "TASK BOARD", short: "Tasks" },
  { href: "/operations/aar", label: "AFTER ACTION", short: "AAR" },
];

export const INTEL_SUB: SubNavItem[] = [
  { href: "/intel", label: "INTEL REPORTS", short: "Intel" },
  { href: "/intel/links", label: "LINK ANALYSIS", short: "Links" },
  { href: "/intel/vault", label: "FILE VAULT", short: "Vault" },
  { href: "/intel/isofac", label: "ISOFAC", short: "ISOFAC" },
];

export const COMMS_SUB: SubNavItem[] = [
  { href: "/comms", label: "COMMS LOG", short: "Log" },
  { href: "/comms/commo-card", label: "COMMO CARD", short: "Card" },
  { href: "/comms/messages", label: "MESSAGES", short: "Msgs" },
];

export const PERSONNEL_SUB: SubNavItem[] = [
  { href: "/personnel", label: "OVERVIEW", short: "Home" },
  { href: "/personnel/org-chart", label: "ORG CHART", short: "Org" },
  { href: "/personnel/roster", label: "ROSTER", short: "Roster" },
  { href: "/personnel/units", label: "UNITS", short: "Units" },
  { href: "/personnel/promotions", label: "PROMOTIONS", short: "Promo" },
  { href: "/personnel/loa", label: "LOA", short: "LOA" },
];

/** Admin hub sub-tabs (admin / owner only). */
export const ADMIN_SUB: SubNavItem[] = [
  { href: "/admin", label: "OVERVIEW", short: "Home" },
  { href: "/admin/approvals", label: "APPROVALS", short: "Appr" },
  { href: "/admin/activity", label: "ACTIVITY LOG", short: "Audit" },
  { href: "/admin/users", label: "USER MGMT", short: "Users" },
  { href: "/admin/roles", label: "PERM ROLES", short: "Roles" },
  { href: "/admin/access-codes", label: "ACCESS CODES", short: "Codes" },
  { href: "/admin/broadcasts", label: "BROADCASTS", short: "Flash" },
];

/** PROMOTIONS sub-tab is admin/owner only; operators still see other personnel tabs. */
export function personnelSubNavForAccess(accessLevel: string | undefined): SubNavItem[] {
  if (accessLevel === "admin" || accessLevel === "owner") return PERSONNEL_SUB;
  return PERSONNEL_SUB.filter((i) => i.href !== "/personnel/promotions");
}

export const TACTICAL_SUB: SubNavItem[] = [
  { href: "/tactical", label: "OVERVIEW", short: "Home" },
  { href: "/tactical/map", label: "TAC MAP", short: "Map" },
  { href: "/tactical/grid", label: "GRID TOOL", short: "Grid" },
];

export const SUPPORT_SUB: SubNavItem[] = [
  { href: "/support", label: "SUPPORT REQUESTS", short: "Support" },
  { href: "/support/medical", label: "MEDICAL / CASEVAC", short: "Medical" },
];

export const TRAINING_SUB: SubNavItem[] = [
  { href: "/training", label: "SIGN IN SHEET", short: "Sign-in" },
  { href: "/training/qualifications", label: "TRAINING RECORDS", short: "Records" },
  { href: "/training/awards", label: "AWARDS", short: "Awards" },
];

/** Longest-prefix match for mobile header title */
export function titleForPath(
  location: string,
  entries: { path: string; label: string }[],
): string {
  const sorted = [...entries].sort((a, b) => b.path.length - a.path.length);
  for (const e of sorted) {
    if (e.path === "/" ? location === "/" : location === e.path || location.startsWith(`${e.path}/`)) {
      return e.label;
    }
  }
  return "DASHBOARD";
}

/** Every routed screen title for the mobile top bar (most specific paths first in logic via sort). */
export const ROUTE_TITLE_ENTRIES: { path: string; label: string }[] = [
  { path: "/", label: "DASHBOARD" },
  { path: "/calendar", label: "CALENDAR" },
  { path: "/support/medical", label: "MEDICAL" },
  { path: "/support", label: "SUPPORT" },
  { path: "/operations/tasks", label: "TASK BOARD" },
  { path: "/operations/aar", label: "AFTER ACTION" },
  { path: "/operations", label: "OPERATIONS" },
  { path: "/intel/links", label: "LINK ANALYSIS" },
  { path: "/intel/vault", label: "FILE VAULT" },
  { path: "/intel/isofac", label: "ISOFAC" },
  { path: "/intel", label: "INTELLIGENCE" },
  { path: "/comms/commo-card", label: "COMMO CARD" },
  { path: "/comms/messages", label: "MESSAGES" },
  { path: "/comms", label: "COMMS" },
  { path: "/personnel/org-chart", label: "ORG CHART" },
  { path: "/personnel/roster", label: "ROSTER" },
  { path: "/personnel/units", label: "UNITS" },
  { path: "/personnel/promotions", label: "PROMOTIONS" },
  { path: "/personnel/loa", label: "LOA" },
  { path: "/personnel", label: "PERSONNEL" },
  { path: "/tactical/map", label: "TAC MAP" },
  { path: "/tactical/grid", label: "GRID TOOL" },
  { path: "/tactical", label: "TACTICAL" },
  { path: "/training/qualifications", label: "TRAINING RECORDS" },
  { path: "/training/awards", label: "AWARDS" },
  { path: "/training", label: "SIGN IN SHEET" },
  { path: "/admin/access-codes", label: "ACCESS CODES" },
  { path: "/admin/broadcasts", label: "BROADCASTS" },
  { path: "/admin/roles", label: "PERM ROLES" },
  { path: "/admin/users", label: "USER MGMT" },
  { path: "/admin/activity", label: "ACTIVITY LOG" },
  { path: "/admin/approvals", label: "APPROVALS" },
  { path: "/admin", label: "ADMIN" },
  { path: "/links", label: "LINK ANALYSIS" },
  { path: "/file-vault", label: "FILE VAULT" },
  { path: "/assets", label: "ASSETS" },
  { path: "/settings", label: "SETTINGS" },
  { path: "/profile", label: "PROFILE" },
];
