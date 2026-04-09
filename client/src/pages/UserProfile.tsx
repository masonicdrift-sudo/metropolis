import { useMemo } from "react";
import { AwardRibbonImage } from "@/components/AwardRibbonImage";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Crown, ShieldCheck, User as UserIcon, ArrowLeft, Award, GraduationCap, ScrollText, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileLink } from "@/components/ProfileLink";
import { InstructorField } from "@/pages/Training";
import type { TrainingRecord } from "@shared/schema";

type AwardRow = {
  id: number;
  username: string;
  awardName: string;
  awardType: string;
  awardCatalogId?: string;
  catalogBranch?: string;
  catalogPrecedence?: number;
  imageUrl?: string | null;
  reason: string;
  awardedBy: string;
  awardedAt: string;
  relatedOpId: number;
  relatedOpName: string;
};

type SignInRow = TrainingRecord & {
  attachedDocTitle?: string | null;
  attachedDocType?: string | null;
  operationName?: string | null;
};

type ProfilePayload = {
  username: string;
  accessLevel: "user" | "admin" | "owner" | string;
  tacticalRole: string;
  rank: string;
  assignedUnit: string;
  teamAssignment: string;
  milIdNumber: string;
  mos: string;
  createdAt?: string;
  lastLogin?: string;
  /** Approved LOA window (YYYY-MM-DD). */
  loaStart?: string;
  loaEnd?: string;
  loaApprover?: string;
  /** Server: none | scheduled (before start) | active (in window). */
  loaPhase?: "none" | "scheduled" | "active";
  awards: AwardRow[];
  citations: AwardRow[];
  signInSheets: SignInRow[];
};

function accessIcon(level: string) {
  if (level === "owner") return <Crown size={14} className="text-orange-400" />;
  if (level === "admin") return <ShieldCheck size={14} className="text-yellow-400" />;
  return <UserIcon size={14} className="text-blue-300" />;
}

function accessLabel(level: string) {
  return level === "owner" ? "OWNER" : level === "admin" ? "ADMIN" : "USER";
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}

function fmtLoaDate(s: string) {
  if (!s) return "—";
  try {
    const d = new Date(s.length <= 10 ? `${s}T12:00:00` : s);
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return s;
  }
}

export default function UserProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ username?: string }>();
  const username = (params?.username || "").trim();

  const canView = !!user && !!username;

  const { data: profile, isLoading, isFetching, isError, error } = useQuery<ProfilePayload>({
    queryKey: ["/api/profile", username],
    queryFn: () => apiRequest("GET", `/api/profile/${encodeURIComponent(username)}`),
    enabled: canView,
    retry: false,
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

  const awards = profile?.awards ?? [];
  const citations = profile?.citations ?? [];
  const signInSheets = profile?.signInSheets ?? [];

  return (
    <div className="p-3 md:p-4 tac-page space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/messages">
          <Button variant="outline" size="sm" className="h-8 text-[10px] tracking-wider">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> BACK
          </Button>
        </Link>
        <div className="ml-auto text-[10px] text-muted-foreground tracking-wider">
          {isLoading ? "LOADING…" : isError ? "NOT FOUND" : isSelf ? "YOU" : "OPERATOR"}
        </div>
      </div>

      {isError ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-4 text-xs text-muted-foreground">
          <div className="font-bold tracking-wider text-destructive/90 mb-1">PROFILE UNAVAILABLE</div>
          <p>
            No operator named <span className="font-mono text-foreground">{username}</span> exists on this node, or you do not have access.
            {error instanceof Error && error.message ? ` (${error.message})` : ""}
          </p>
        </div>
      ) : null}

      {!isError ? (
      <>
      <div className="bg-card border border-border rounded p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-bold tracking-[0.15em] text-blue-300" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {profile?.username || username}
              </div>
              {profile?.accessLevel ? (
                <span className={cn(
                  "text-[9px] px-2 py-0.5 rounded border font-bold tracking-widest inline-flex items-center gap-1",
                  profile.accessLevel === "owner" ? "border-orange-900/50 text-orange-400 bg-orange-950/20" :
                  profile.accessLevel === "admin" ? "border-yellow-900/50 text-yellow-400 bg-yellow-950/20" :
                  "border-blue-900/40 text-blue-200 bg-blue-950/20",
                )}
                >
                  {accessIcon(profile.accessLevel)}
                  {accessLabel(profile.accessLevel)}
                </span>
              ) : null}
              {profile?.tacticalRole ? (
                <span className="text-[9px] px-2 py-0.5 rounded bg-secondary text-muted-foreground tracking-wider">
                  ROLE: {profile.tacticalRole}
                </span>
              ) : null}
            </div>

            <div className="text-[10px] text-muted-foreground mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <div>RANK: <span className="text-foreground/80 font-mono">{profile?.rank || "—"}</span></div>
              <div>UNIT: <span className="text-foreground/80 font-mono">{profile?.assignedUnit || "—"}</span></div>
              <div>TEAM ASSIGNMENT: <span className="text-foreground/80 font-mono">{profile?.teamAssignment || "—"}</span></div>
              <div>MOS: <span className="text-foreground/80 font-mono">{profile?.mos || "—"}</span></div>
              <div>MIL ID: <span className="text-foreground/80 font-mono">{profile?.milIdNumber || "—"}</span></div>
            </div>
          </div>

          <div className="w-12 h-12 rounded border border-border bg-secondary/30 flex items-center justify-center shrink-0">
            <BadgeCheck className="h-5 w-5 text-blue-300" />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded p-4">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-cyan-300" /> STATUS
        </div>
        {(isLoading || isFetching) && !profile ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : profile?.loaPhase === "active" || profile?.loaPhase === "scheduled" ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2.5 text-[11px]",
              profile.loaPhase === "active"
                ? "border-cyan-800/60 bg-cyan-950/25 text-cyan-100"
                : "border-amber-900/50 bg-amber-950/20 text-amber-100",
            )}
          >
            <div className="font-bold tracking-wider uppercase mb-1">
              {profile.loaPhase === "active" ? "On leave (approved LOA)" : "Scheduled leave (approved LOA)"}
            </div>
            <div className="text-[10px] space-y-1 text-cyan-50/90">
              <div>
                <span className="text-muted-foreground/90">Dates: </span>
                {fmtLoaDate(profile.loaStart || "")} → {fmtLoaDate(profile.loaEnd || "")}
              </div>
              {profile.loaApprover ? (
                <div>
                  <span className="text-muted-foreground/90">Approved by: </span>
                  <ProfileLink username={profile.loaApprover} className="font-mono text-cyan-300 hover:text-cyan-200">
                    {profile.loaApprover}
                  </ProfileLink>
                </div>
              ) : (
                <div className="text-muted-foreground/80">Approved by: —</div>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground/70 mt-2 leading-snug">
              Personnel roster lines linked to this operator are set to <span className="font-mono text-foreground/80">Leave</span>{" "}
              while LOA is active.
            </p>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No active or scheduled approved leave of absence.
          </div>
        )}
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
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {awards.map((a) => (
                <div key={a.id} className="border border-border/60 rounded p-2 bg-background/40 flex gap-2 items-start">
                  <AwardRibbonImage imageUrl={a.imageUrl} alt={a.awardName} className="h-7 w-[96px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono font-bold leading-tight">
                      {a.catalogBranch && a.catalogBranch !== "Custom" ? (
                        <span className="text-muted-foreground font-normal mr-1">[{a.catalogBranch}]</span>
                      ) : null}
                      {a.awardName}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {fmtDate(a.awardedAt)} · BY{" "}
                      <ProfileLink username={a.awardedBy} className="text-muted-foreground hover:text-foreground">
                        {a.awardedBy}
                      </ProfileLink>
                      {a.relatedOpName ? ` · OP ${a.relatedOpName}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded p-3">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-amber-300" /> CITATIONS
            <span className="ml-auto text-[9px] text-muted-foreground/70">{citations.length}</span>
          </div>
          {citations.length === 0 ? (
            <div className="text-xs text-muted-foreground">No citations on record.</div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {citations.map((a) => (
                <div key={a.id} className="border border-border/60 rounded p-2 bg-background/40 flex gap-2 items-start">
                  <AwardRibbonImage imageUrl={a.imageUrl} alt={a.awardName} className="h-7 w-[96px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono font-bold leading-tight">
                      {a.catalogBranch && a.catalogBranch !== "Custom" ? (
                        <span className="text-muted-foreground font-normal mr-1">[{a.catalogBranch}]</span>
                      ) : null}
                      {a.awardName}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {fmtDate(a.awardedAt)} · BY{" "}
                      <ProfileLink username={a.awardedBy} className="text-muted-foreground hover:text-foreground">
                        {a.awardedBy}
                      </ProfileLink>
                      {a.relatedOpName ? ` · OP ${a.relatedOpName}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded p-3">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5 text-blue-300" /> SIGN-IN SHEET
        </div>
        {signInSheets.length === 0 ? (
          <div className="text-xs text-muted-foreground">No sign-in entries for this operator.</div>
        ) : (
          <div className="space-y-1.5">
            {signInSheets.map((r) => (
              <div key={r.id} className="border border-border/60 rounded p-2 bg-background/40 text-[10px]">
                <div className="font-bold">{r.eventName}</div>
                <div className="text-muted-foreground mt-0.5">
                  {fmtDate(r.date)} · {r.category.toUpperCase()} · {r.result.toUpperCase()}
                  {r.operationName ? ` · OP: ${r.operationName}` : ""}
                </div>
                {r.instructor ? (
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    INSTR: <InstructorField text={r.instructor} className="inline" />
                  </div>
                ) : null}
                {r.attachedIsofacDocId > 0 && (r.attachedDocTitle || r.attachedDocType) ? (
                  <div className="text-blue-300/90 mt-0.5">
                    Attached: {r.attachedDocType ? `[${r.attachedDocType}] ` : ""}{r.attachedDocTitle || `#${r.attachedIsofacDocId}`}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      ) : null}
    </div>
  );
}
