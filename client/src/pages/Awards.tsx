import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Award, Operation } from "@shared/schema";
import { MILITARY_AWARDS_CATALOG, type MilitaryAwardDefinition } from "@shared/militaryAwardsCatalog";
import { Plus, Star, Trash2, ChevronsUpDown, Check, Shield, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SubPageNav } from "@/components/SubPageNav";
import { TRAINING_SUB } from "@/lib/appNav";
import { ProfileLink } from "@/components/ProfileLink";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { AwardRibbonImage } from "@/components/AwardRibbonImage";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  medal: { label: "MEDAL", color: "text-yellow-400", icon: "🎖" },
  commendation: { label: "COMMENDATION", color: "text-blue-400", icon: "⭐" },
  citation: { label: "CITATION", color: "text-blue-400", icon: "📋" },
  achievement: { label: "ACHIEVEMENT", color: "text-orange-400", icon: "🏆" },
  badge: { label: "BADGE / TAB", color: "text-violet-300", icon: "🛡" },
};

type ListAward = Award & {
  catalogBranch?: string;
  catalogPrecedence?: number;
  imageUrl?: string | null;
};

function AwardForm({ onClose, users, ops }: { onClose: () => void; users: any[]; ops: Operation[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "",
    awardName: "",
    awardType: "commendation",
    reason: "",
    relatedOpId: 0,
    relatedOpName: "",
  });
  const [customMode, setCustomMode] = useState(false);
  const [awardCatalogId, setAwardCatalogId] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);

  const catalogSorted = useMemo(
    () => [...MILITARY_AWARDS_CATALOG].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const selectedCatalog: MilitaryAwardDefinition | undefined = useMemo(
    () => (awardCatalogId ? catalogSorted.find((x) => x.id === awardCatalogId) : undefined),
    [awardCatalogId, catalogSorted],
  );

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiRequest("POST", "/api/awards", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/awards"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Award granted" });
      onClose();
    },
  });

  const set = (k: string) => (v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const handleOp = (id: string) => {
    const op = ops.find((o) => o.id === Number(id));
    setForm((f) => ({ ...f, relatedOpId: Number(id), relatedOpName: op?.name || "" }));
  };

  const submit = () => {
    if (!form.username) {
      toast({ title: "Recipient required", variant: "destructive" });
      return;
    }
    if (customMode) {
      if (!form.awardName.trim()) {
        toast({ title: "Award name required", variant: "destructive" });
        return;
      }
      create.mutate({
        username: form.username,
        awardCatalogId: "",
        awardName: form.awardName.trim(),
        awardType: form.awardType,
        reason: form.reason,
        relatedOpId: form.relatedOpId,
        relatedOpName: form.relatedOpName,
      });
      return;
    }
    if (!awardCatalogId) {
      toast({ title: "Select a military award from the catalog", variant: "destructive" });
      return;
    }
    create.mutate({
      username: form.username,
      awardCatalogId,
      awardName: "",
      reason: form.reason,
      relatedOpId: form.relatedOpId,
      relatedOpName: form.relatedOpName,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] tracking-wider">RECIPIENT *</Label>
          <Select value={form.username} onValueChange={set("username")}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u.username} value={u.username}>
                  {u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] tracking-wider">SOURCE</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={!customMode ? "default" : "outline"}
              size="sm"
              className="text-[10px] h-8 flex-1"
              onClick={() => {
                setCustomMode(false);
              }}
            >
              U.S. MILITARY CATALOG
            </Button>
            <Button
              type="button"
              variant={customMode ? "default" : "outline"}
              size="sm"
              className="text-[10px] h-8 flex-1"
              onClick={() => {
                setCustomMode(true);
                setAwardCatalogId("");
                setCatalogOpen(false);
              }}
            >
              CUSTOM
            </Button>
          </div>
        </div>

        {!customMode ? (
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[10px] tracking-wider">DECORATION / AWARD *</Label>
            <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={catalogOpen}
                  className="w-full justify-between text-xs font-normal h-9"
                >
                  {selectedCatalog ? (
                    <span className="truncate text-left">
                      <span className="text-muted-foreground mr-1">[{selectedCatalog.branch}]</span>
                      {selectedCatalog.name}
                    </span>
                  ) : (
                    "Search all branches (Army, Navy, USMC, AF, SF, USCG, Joint)…"
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Filter by name or branch…" className="text-xs" />
                  <CommandList>
                    <CommandEmpty className="text-xs">No award found.</CommandEmpty>
                    {(
                      [
                        "Joint",
                        "Army",
                        "Navy",
                        "Marine Corps",
                        "Air Force",
                        "Space Force",
                        "Coast Guard",
                      ] as const
                    ).map((branch) => {
                      const items = catalogSorted.filter((a) => a.branch === branch);
                      if (items.length === 0) return null;
                      return (
                        <CommandGroup key={branch} heading={branch.toUpperCase()}>
                          {items.map((a) => (
                            <CommandItem
                              key={a.id}
                              value={`${a.id} ${a.name} ${a.branch}`}
                              onSelect={() => {
                                setAwardCatalogId(a.id);
                                setCatalogOpen(false);
                              }}
                              className="text-xs"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-3.5 w-3.5 shrink-0",
                                  awardCatalogId === a.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <AwardRibbonImage imageUrl={a.imageUrl} alt="" className="h-6 w-[72px] mr-2" />
                              <span className="truncate">{a.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedCatalog ? (
              <p className="text-[9px] text-muted-foreground">
                Precedence rank {selectedCatalog.precedence} · Type {selectedCatalog.awardType}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div>
              <Label className="text-[10px] tracking-wider">AWARD TYPE</Label>
              <Select value={form.awardType} onValueChange={set("awardType")}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.icon} {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] tracking-wider">AWARD NAME *</Label>
              <Input
                value={form.awardName}
                onChange={(e) => set("awardName")(e.target.value)}
                placeholder="e.g. Valor Under Fire"
                className="text-xs"
              />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <Label className="text-[10px] tracking-wider">LINKED OPERATION</Label>
          <Select value={String(form.relatedOpId)} onValueChange={handleOp}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">— NONE —</SelectItem>
              {ops.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[10px] tracking-wider">REASON / CITATION</Label>
          <Textarea
            value={form.reason}
            onChange={(e) => set("reason")(e.target.value)}
            className="text-xs h-20"
            placeholder="Describe the action or achievement..."
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
          CANCEL
        </Button>
        <Button
          size="sm"
          className="text-xs bg-yellow-800 hover:bg-yellow-700 text-yellow-100"
          onClick={submit}
          disabled={create.isPending}
        >
          GRANT AWARD
        </Button>
      </div>
    </div>
  );
}

export default function AwardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [open, setOpen] = useState(false);
  const [filterUser, setFilterUser] = useState("all");

  const { data: awards = [] } = useQuery<ListAward[]>({
    queryKey: ["/api/awards"],
    queryFn: () => apiRequest("GET", "/api/awards"),
  });
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: canAdmin,
  });
  const { data: ops = [] } = useQuery<Operation[]>({
    queryKey: ["/api/operations"],
    queryFn: () => apiRequest("GET", "/api/operations"),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/awards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/awards"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Award removed" });
    },
  });

  const allUsers = Array.from(new Set(awards.map((a) => a.username)));
  const filtered = filterUser === "all" ? awards : awards.filter((a) => a.username === filterUser);
  const decorationRows = filtered.filter((a) => a.awardType !== "citation" && a.awardType !== "badge");
  const badgeRows = filtered.filter((a) => a.awardType === "badge");
  const citationRows = filtered.filter((a) => a.awardType === "citation");

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={TRAINING_SUB} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            AWARDS & COMMENDATIONS
          </h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {awards.length} TOTAL · ORDERED BY PRECEDENCE (most senior first)
            {filtered.length > 0 ? (
              <span className="block mt-0.5 text-muted-foreground/90">
                SHOWN: {decorationRows.length} decorations · {badgeRows.length} badges/tabs · {citationRows.length} citations
              </span>
            ) : null}
          </div>
        </div>
        {canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-yellow-800 hover:bg-yellow-700 text-yellow-100 text-xs tracking-wider gap-1">
                <Star size={12} /> GRANT AWARD
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm tracking-widest">GRANT AWARD</DialogTitle>
              </DialogHeader>
              <AwardForm onClose={() => setOpen(false)} users={users} ops={ops} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {allUsers.length > 0 && (
        <div className="tac-filter-row mb-3">
          {["all", ...allUsers].map((u) => (
            <button
              key={u}
              onClick={() => setFilterUser(u)}
              className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${
                filterUser === u
                  ? "bg-yellow-900/50 text-yellow-400 border border-yellow-800"
                  : "text-muted-foreground hover:text-foreground bg-secondary"
              }`}
            >
              {u === "all" ? "ALL" : u}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">
          NO AWARDS ON RECORD
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border/60 pb-1">
              <Star className="h-3.5 w-3.5 text-yellow-500/90 shrink-0" />
              DECORATIONS & SERVICE AWARDS
              <span className="ml-auto text-[9px] font-mono text-muted-foreground/80">{decorationRows.length}</span>
            </div>
            {decorationRows.length === 0 ? (
              <div className="text-xs text-muted-foreground pl-1">None in this view.</div>
            ) : (
              decorationRows.map((a) => {
                const cfg = TYPE_CONFIG[a.awardType] || TYPE_CONFIG.commendation;
                return (
                  <div
                    key={a.id}
                    className="bg-card border border-border rounded px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AwardRibbonImage imageUrl={a.imageUrl} alt={a.awardName} className="h-9 w-[120px]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
                          {a.catalogBranch && a.catalogBranch !== "Custom" ? (
                            <span className="text-[9px] text-muted-foreground font-mono">[{a.catalogBranch}]</span>
                          ) : null}
                          <span className="text-xs font-bold font-mono break-words">{a.awardName}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          AWARDED TO:{" "}
                          <ProfileLink username={a.username} className="text-foreground font-bold hover:text-blue-400">
                            {a.username}
                          </ProfileLink>{" "}
                          ▪ BY{" "}
                          <ProfileLink username={a.awardedBy} className="text-muted-foreground hover:text-foreground">
                            {a.awardedBy}
                          </ProfileLink>{" "}
                          ▪ {fmt(a.awardedAt)}
                          {a.relatedOpName ? ` ▪ OP: ${a.relatedOpName}` : ""}
                        </div>
                        {a.reason ? <div className="text-[11px] mt-1 text-muted-foreground italic">"{a.reason}"</div> : null}
                      </div>
                    </div>
                    {canAdmin && (
                      <button
                        onClick={() => del.mutate(a.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 shrink-0"
                        type="button"
                        aria-label="Remove award"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border/60 pb-1">
              <Shield className="h-3.5 w-3.5 text-violet-400/90 shrink-0" />
              BADGES & TABS (U.S. ARMY)
              <span className="ml-auto text-[9px] font-mono text-muted-foreground/80">{badgeRows.length}</span>
            </div>
            {badgeRows.length === 0 ? (
              <div className="text-xs text-muted-foreground pl-1">None in this view.</div>
            ) : (
              badgeRows.map((a) => {
                const cfg = TYPE_CONFIG.badge;
                return (
                  <div
                    key={a.id}
                    className="bg-card border border-border rounded px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AwardRibbonImage imageUrl={a.imageUrl} alt={a.awardName} className="h-9 w-[120px]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
                          {a.catalogBranch && a.catalogBranch !== "Custom" ? (
                            <span className="text-[9px] text-muted-foreground font-mono">[{a.catalogBranch}]</span>
                          ) : null}
                          <span className="text-xs font-bold font-mono break-words">{a.awardName}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          AWARDED TO:{" "}
                          <ProfileLink username={a.username} className="text-foreground font-bold hover:text-blue-400">
                            {a.username}
                          </ProfileLink>{" "}
                          ▪ BY{" "}
                          <ProfileLink username={a.awardedBy} className="text-muted-foreground hover:text-foreground">
                            {a.awardedBy}
                          </ProfileLink>{" "}
                          ▪ {fmt(a.awardedAt)}
                          {a.relatedOpName ? ` ▪ OP: ${a.relatedOpName}` : ""}
                        </div>
                        {a.reason ? <div className="text-[11px] mt-1 text-muted-foreground italic">"{a.reason}"</div> : null}
                      </div>
                    </div>
                    {canAdmin && (
                      <button
                        onClick={() => del.mutate(a.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 shrink-0"
                        type="button"
                        aria-label="Remove award"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border/60 pb-1">
              <ScrollText className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
              CITATIONS & UNIT AWARDS
              <span className="ml-auto text-[9px] font-mono text-muted-foreground/80">{citationRows.length}</span>
            </div>
            {citationRows.length === 0 ? (
              <div className="text-xs text-muted-foreground pl-1">None in this view.</div>
            ) : (
              citationRows.map((a) => {
                const cfg = TYPE_CONFIG[a.awardType] || TYPE_CONFIG.commendation;
                return (
                  <div
                    key={a.id}
                    className="bg-card border border-border rounded px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AwardRibbonImage imageUrl={a.imageUrl} alt={a.awardName} className="h-9 w-[120px]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
                          {a.catalogBranch && a.catalogBranch !== "Custom" ? (
                            <span className="text-[9px] text-muted-foreground font-mono">[{a.catalogBranch}]</span>
                          ) : null}
                          <span className="text-xs font-bold font-mono break-words">{a.awardName}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          AWARDED TO:{" "}
                          <ProfileLink username={a.username} className="text-foreground font-bold hover:text-blue-400">
                            {a.username}
                          </ProfileLink>{" "}
                          ▪ BY{" "}
                          <ProfileLink username={a.awardedBy} className="text-muted-foreground hover:text-foreground">
                            {a.awardedBy}
                          </ProfileLink>{" "}
                          ▪ {fmt(a.awardedAt)}
                          {a.relatedOpName ? ` ▪ OP: ${a.relatedOpName}` : ""}
                        </div>
                        {a.reason ? <div className="text-[11px] mt-1 text-muted-foreground italic">"{a.reason}"</div> : null}
                      </div>
                    </div>
                    {canAdmin && (
                      <button
                        onClick={() => del.mutate(a.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 shrink-0"
                        type="button"
                        aria-label="Remove award"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
