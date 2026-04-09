import { Link } from "wouter";
import { ClipboardList, UserCheck, Users, Medal } from "lucide-react";
import { SubPageNav } from "@/components/SubPageNav";
import { PERSONNEL_SUB } from "@/lib/appNav";

const CARDS = [
  {
    href: "/personnel/perstat",
    title: "PERSTAT",
    desc: "Personnel status tracking and readiness.",
    icon: UserCheck,
  },
  {
    href: "/personnel/roster",
    title: "ROSTER",
    desc: "Editable personnel roster and assignments.",
    icon: ClipboardList,
  },
  {
    href: "/personnel/units",
    title: "UNITS",
    desc: "Friendly unit records, grids, and status.",
    icon: Users,
  },
  {
    href: "/personnel/promotions",
    title: "PROMOTIONS",
    desc: "Submit promotion packets; approved soldiers get orders FLASH + auto rank.",
    icon: Medal,
  },
] as const;

export default function PersonnelHub() {
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
      <SubPageNav items={PERSONNEL_SUB} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map(({ href, title, desc, icon: Icon }) => (
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
