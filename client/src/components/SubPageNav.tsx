import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { SubNavItem } from "@/lib/appNav";

export function SubPageNav({ items, className }: { items: SubNavItem[]; className?: string }) {
  const [location] = useLocation();
  return (
    <nav
      className={cn(
        "flex flex-wrap gap-1 border-b border-border pb-2 mb-3 -mt-0.5 overflow-x-auto",
        className,
      )}
      aria-label="Section"
    >
      {items.map(({ href, label, short }) => {
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 px-2.5 py-1.5 rounded text-[9px] sm:text-[10px] tracking-wider font-bold transition-colors min-h-[40px] flex items-center",
              active
                ? "bg-blue-950/60 text-blue-400 border border-blue-900/60"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent",
            )}
            title={label}
          >
            <span className="sm:hidden">{short ?? label}</span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
