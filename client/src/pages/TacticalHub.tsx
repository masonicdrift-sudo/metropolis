import { Link } from "wouter";
import { Map, MapPin } from "lucide-react";
import { SubPageNav } from "@/components/SubPageNav";
import { TACTICAL_SUB } from "@/lib/appNav";

const CARDS = [
  {
    href: "/tactical/map",
    title: "TAC MAP",
    desc: "Interactive tactical terrain and overlays.",
    icon: Map,
  },
  {
    href: "/tactical/grid",
    title: "GRID TOOL",
    desc: "MGRS references and quick copy-to-clipboard.",
    icon: MapPin,
  },
] as const;

export default function TacticalHub() {
  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div>
        <h1 className="text-sm font-bold tracking-[0.15em] text-blue-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          TACTICAL
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-wider mt-1">
          Map and grid tools in one section.
        </p>
      </div>
      <SubPageNav items={TACTICAL_SUB} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
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
