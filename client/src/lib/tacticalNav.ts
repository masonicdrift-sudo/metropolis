import { permissionForClientPath } from "@shared/tacticalPermissions";
import type { AuthUser } from "./auth";
import { userCanViewPath } from "./auth";

/** Whether the user may open this app path (admins bypass; unknown paths default to allowed). */
export function canAccessAppRoute(user: AuthUser | null | undefined, pathname: string): boolean {
  if (!user) return false;
  // Admin / owner only (not granted via tactical permissions)
  if (pathname === "/personnel/promotions" || pathname.startsWith("/personnel/promotions/")) {
    return user.accessLevel === "owner" || user.accessLevel === "admin";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return user.accessLevel === "owner" || user.accessLevel === "admin";
  }
  if (user.accessLevel === "owner" || user.accessLevel === "admin") return true;
  const need = permissionForClientPath(pathname);
  if (!need) return true;
  return userCanViewPath(user, need);
}
