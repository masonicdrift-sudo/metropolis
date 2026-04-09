import { permissionForClientPath } from "@shared/tacticalPermissions";
import type { AuthUser } from "./auth";
import { userCanViewPath } from "./auth";

/** Whether the user may open this app path (admins bypass; unknown paths default to allowed). */
export function canAccessAppRoute(user: AuthUser | null | undefined, pathname: string): boolean {
  if (!user) return false;
  if (user.accessLevel === "owner" || user.accessLevel === "admin") return true;
  const need = permissionForClientPath(pathname);
  if (!need) return true;
  return userCanViewPath(user, need);
}
