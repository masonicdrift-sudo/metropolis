import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Crown, ShieldCheck, User as UserIcon, ArrowLeft, Award, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type PublicProfile = {
  username: string;
  accessLevel: "user" | "admin" | "owner" | string;
  tacticalRole: string;
  rank: string;
  assignedUnit: string;
  milIdNumber: string;
  mos: string;
  createdAt?: string;
  lastLogin?: string;
};

type AwardRow = {
  id: number;
  username: string;
  awardName: string;
  awardType: string;
  reason: string;
  awardedBy: string;
  awardedAt: string;
  relatedOpId: number;
  relatedOpName: string;
};

function accessIcon(level: string) {
  if (level === "owner") return <Crown size={14} className="text-orange-400" />;
  if (level === "admin") return <ShieldCheck size={14} className="text-yellow-400" />;
  return <UserIcon size={14} className="text-blue-300" />;
}

function accessLabel(level: string) {
  return level === "owner" ? "OWNER" : level === "admin" ? "ADMIN" : "USER";
}

export default function UserProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ username?: string }>();
  const username = (params?.username || "").trim();

  const canView = !!user && !!username;

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["/api/profile", username],
    queryFn: () => apiRequest("GET", `/api/profile/${encodeURIComponent(username)}`),
    enabled: canView,
  });

  const { data: awards = [] } = useQuery<AwardRow[]>({
    queryKey: ["/api/awards", username],
    queryFn: () => apiRequest("GET", `/api/awards?username=${encodeURIComponent(username)}`),
    enabled: canView,
  });

  const isSelf = useMemo(() => profile?.username && profile.username === user?.username, [profile?.username, user?.username]);

  if (!user) {
    return (
      <div className="p-4 tac-page">
        <div className="text-sm font-bold tracking-wider text-muted-foreground">PROFILE</div>
        <div className="text-xs text-muted-foreground mt-2">Log in to view profiles.</div>
      </div>
    );
  }

  if (!username) {
    return (
      <div className="p-4 tac-page">
        <div className="text-sm font-bold tracking-wider text-muted-foreground">PROFILE</div>
        <div className="text-xs text-muted-foreground mt-2">No username specified.</div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 tac-page space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/messages">
          <Button variant="outline" size="sm" className="h-8 text-[10px] tracking-wider">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> BACK
          </Button>
        </Link>
        <div className="ml-auto text-[10px] text-muted-foreground tracking-wider">
          {isLoading ? "LOADING…" : isSelf ? "YOU" : "OPERATOR"}
        </div>
      </div>

      <div className="bg-card border border-border rounded p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-bold tracking-[0.15em] text-blue-300" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {profile?.username || username}
              </div>
              {profile?.accessLevel ? (
                <span className={cn("text-[9px] px-2 py-0.5 rounded border font-bold tracking-widest inline-flex items-center gap-1",
                  profile.accessLevel === "owner" ? "border-orange-900/50 text-orange-400 bg-orange-950/20" :
                  profile.accessLevel === "admin" ? "border-yellow-900/50 text-yellow-400 bg-yellow-950/20" :
                  "border-blue-900/40 text-blue-200 bg-blue-950/20"
                )}>
                  {accessIcon(profile.accessLevel)}
                  {accessLabel(profile.accessLevel)}
                </span>
              ) : null}
              {profile?.tacticalRole ? (
                <span className="text-[9px] px-2 py-0.5 rounded bg-secondary text-muted-foreground tracking-wider">
                  {profile.tacticalRole}
                </span>
              ) : null}
            </div>

            <div className="text-[10px] text-muted-foreground mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <div>RANK: <span className="text-foreground/80 font-mono">{profile?.rank || "—"}</span></div>
              <div>UNIT: <span className="text-foreground/80 font-mono">{profile?.assignedUnit || "—"}</span></div>
              <div>MOS: <span className="text-foreground/80 font-mono">{profile?.mos || "—"}</span></div>
              <div>MIL ID: <span className="text-foreground/80 font-mono">{profile?.milIdNumber || "—"}</span></div>
            </div>
          </div>

          <div className="w-12 h-12 rounded border border-border bg-secondary/30 flex items-center justify-center shrink-0">
            <BadgeCheck className="h-5 w-5 text-blue-300" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded p-3">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <Award className="h-3.5 w-3.5 text-blue-300" /> AWARDS
            <span className="ml-auto text-[9px] text-muted-foreground/70">{awards.length}</span>
          </div>
          {awards.length === 0 ? (
            <div className="text-xs text-muted-foreground">No awards on record.</div>
          ) : (
            <div className="space-y-1.5">
              {awards.slice(0, 8).map((a) => (
                <div key={a.id} className="border border-border/60 rounded p-2 bg-background/40">
                  <div className="text-[10px] font-mono font-bold">{a.awardName}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {new Date(a.awardedAt).toLocaleDateString()} · BY {a.awardedBy}
                    {a.relatedOpName ? ` · OP ${a.relatedOpName}` : ""}
                  </div>
                </div>
              ))}
              {awards.length > 8 ? (
                <div className="text-[9px] text-muted-foreground/70">Showing first 8…</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded p-3">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5 text-blue-300" /> TRAINING
          </div>
          <div className="text-xs text-muted-foreground">
            Training records are restricted. Operators can view their own in the Training tab; admins/owners can view the full roster.
          </div>
        </div>
      </div>
    </div>
  );
}

