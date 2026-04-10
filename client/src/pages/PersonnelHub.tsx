import { Link } from "wouter";
import { useMemo } from "react";
import { ClipboardList, UserCheck, Users, Medal, Palmtree, Network } from "lucide-react";
import { SubPageNav } from "@/components/SubPageNav";
import { personnelSubNavForAccess } from "@/lib/appNav";
import { useAuth } from "@/lib/auth";

const CARDS = [
  {
    href: "/personnel/org-chart",
    title: "ORG CHART",
    desc: "Blank manning board — admins build elements and assign by drag-and-drop.",
    icon: Network,
    adminOnly: false,
  },
  {
    href: "/personnel/perstat",
    title: "PERSTAT",
    desc: "Personnel status tracking and readiness.",
    icon: UserCheck,
    adminOnly: false,
  },
  {
    href: "/personnel/roster",
    title: "ROSTER",
    desc: "Editable personnel roster and assignments.",
    icon: ClipboardList,
    adminOnly: false,
  },
  {
    href: "/personnel/units",
    title: "UNITS",
    desc: "Friendly unit records, grids, and status.",
    icon: Users,
    adminOnly: false,
  },
  {
    href: "/personnel/promotions",
    title: "PROMOTIONS",
    desc: "Submit promotion packets; approved soldiers get orders FLASH + auto rank.",
    icon: Medal,
    adminOnly: true,
  },
  {
    href: "/personnel/loa",
    title: "LOA",
    desc: "Request leave of absence; approval updates PERSTAT and linked roster lines.",
    icon: Palmtree,
    adminOnly: false,
  },
] as const;

export default function PersonnelHub() {
  const { user } = useAuth();
  const isStaff = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const cards = useMemo(() => CARDS.filter((c) => !c.adminOnly || isStaff), [isStaff]);
  const personnelNav = useMemo(() => personnelSubNavForAccess(user?.accessLevel), [user?.accessLevel]);

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div>
        <h1 className="text-sm font-bold tracking-[0.15em] text-blue-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          PERSONNEL
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-wider mt-1">
          PERSTAT, roster, and units — pick a workspace below.
        </p>
      </div>
      <SubPageNav items={personnelNav} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map(({ href, title, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="block rounded-md border border-border bg-card p-4 hover:bg-secondary/40 transition-colors"
          >
            <Icon className="h-5 w-5 text-blue-400 mb-2" />
            <div className="text-xs font-bold tracking-wider">{title}</div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
