import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";

export interface TacticalRoleBadge {
  id: number;
  name: string;
  color: string;
}

export interface AuthUser {
  id: number;
  username: string;
  /** Access level used for permissions (owner/admin/user). */
  accessLevel: string;
  /** Tactical position / duty role label (TL, GFC, etc). */
  role: string;
  rank: string;
  assignedUnit: string;
  /** Current team assignment within the unit (write-in). */
  teamAssignment: string;
  milIdNumber: string;
  mos: string;
  /** Approved LOA window (YYYY-MM-DD); empty when not on leave from an approved LOA. */
  loaStart?: string;
  loaEnd?: string;
  /** Approver username for active LOA. */
  loaApprover?: string;
  /** Profile photo URL (e.g. `/uploads/...`), set by staff. */
  profileImageUrl?: string;
  /** Discord-style permission roles (merged capabilities below). */
  tacticalRoles?: TacticalRoleBadge[];
  /** Effective permission keys (expanded from roles; includes all areas if `*` was granted). */
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch /api/auth/me (e.g. after username change). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Demo mode: injected at build time for GitHub Pages ──────────────────────
const DEMO_USER: AuthUser = {
  id: 0,
  username: "DEMO",
  accessLevel: "admin",
  role: "GFC",
  rank: "SSG",
  assignedUnit: "1/A/1-1 IN",
  teamAssignment: "HQ",
  milIdNumber: "",
  mos: "11B",
  tacticalRoles: [{ id: 1, name: "Base node access", color: "#5865F2" }],
  permissions: ["*"],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In demo/static builds skip the API call and auto-login as DEMO user
    if (import.meta.env.VITE_DEMO_MODE === "true") {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    apiRequest("GET", "/api/auth/me")
      .then((u: AuthUser) =>
        setUser({
          ...u,
          tacticalRoles: u.tacticalRoles ?? [],
          permissions: u.permissions ?? [],
        }),
      )
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    if (import.meta.env.VITE_DEMO_MODE === "true") return;
    const u = await apiRequest("POST", "/api/auth/login", { username, password });
    setUser({
      ...u,
      tacticalRoles: u.tacticalRoles ?? [],
      permissions: u.permissions ?? [],
    });
  };

  const logout = async () => {
    if (import.meta.env.VITE_DEMO_MODE === "true") return;
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
  };

  const refreshUser = async () => {
    if (import.meta.env.VITE_DEMO_MODE === "true") return;
    try {
      const u = await apiRequest("GET", "/api/auth/me");
      setUser({
        ...u,
        tacticalRoles: u.tacticalRoles ?? [],
        permissions: u.permissions ?? [],
      });
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Route or API area visibility from tactical permission roles (admins bypass). */
export function userCanViewPath(user: AuthUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.accessLevel === "owner" || user.accessLevel === "admin") return true;
  return (user.permissions || []).includes(permission);
}
