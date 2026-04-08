import { Link } from "wouter";
import { cn } from "@/lib/utils";

type ProfileLinkProps = {
  username: string | undefined | null;
  className?: string;
  children?: React.ReactNode;
};

/** Links to `/profile/:username`. Empty username renders children only (no link). */
export function ProfileLink({ username, className, children }: ProfileLinkProps) {
  const u = (username || "").trim();
  if (!u) return <>{children ?? null}</>;
  return (
    <Link
      href={`/profile/${encodeURIComponent(u)}`}
      className={cn("hover:underline transition-colors", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? u}
    </Link>
  );
}
