import { Link } from "wouter";
import { ShieldCheck, ScrollText, Users, UserCheck, KeyRound, Zap } from "lucide-react";
import { SubPageNav } from "@/components/SubPageNav";
import { ADMIN_SUB } from "@/lib/appNav";
import { useAuth } from "@/lib/auth";

const CARDS = [
  {
    href: "/admin/approvals",
    title: "APPROVALS",
    desc: "Review pending staff actions, LOA, promotions, and release requests.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/activity",
    title: "ACTIVITY LOG",
    desc: "Audit trail of changes across the node.",
    icon: ScrollText,
  },
  {
    href: "/admin/users",
    title: "USER MGMT",
    desc: "Create accounts, ranks, units, and access levels.",
    icon: Users,
  },
  {
    href: "/admin/roles",
    title: "PERM ROLES",
    desc: "Tactical permission roles (Discord-style area access).",
    icon: UserCheck,
  },
  {
    href: "/admin/access-codes",
    title: "ACCESS CODES",
    desc: "Issue single-use registration codes for new operators.",
    icon: KeyRound,
  },
  {
    href: "/admin/broadcasts",
    title: "BROADCASTS",
    desc: "FLASH-style alerts to all logged-in users.",
    icon: Zap,
  },
] as const;

export default function AdminHub() {
  const { user } = useAuth();
  const staff = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  if (!staff) {
    return (
      <div className="p-8 tac-page text-center text-xs text-muted-foreground tracking-wider">
        ADMIN ACCESS ONLY
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div>
        <h1 className="text-sm font-bold tracking-[0.15em] text-yellow-400/90" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          ADMIN
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-wider mt-1">
          Approvals, audit, accounts, roles, access codes, and broadcasts.
        </p>
      </div>
      <SubPageNav items={ADMIN_SUB} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ href, title, desc, icon: Icon }) => (
          <Link key={href} href={href} className="block rounded-md border border-border bg-card p-4 hover:bg-secondary/40 transition-colors">
            <Icon className="h-5 w-5 text-yellow-400 mb-2" />
            <div className="text-xs font-bold tracking-wider">{title}</div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
