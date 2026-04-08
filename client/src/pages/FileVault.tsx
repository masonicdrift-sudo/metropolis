import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { IsofacDoc } from "@shared/schema";
import { useState } from "react";
import { Search, FolderOpen, ExternalLink, Trash2, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { SubPageNav } from "@/components/SubPageNav";
import { INTEL_SUB } from "@/lib/appNav";

const CLASS_COLOR: Record<string, string> = {
  UNCLASS: "text-blue-400 border-blue-900/50",
  CUI: "text-yellow-400 border-yellow-900/50",
  SECRET: "text-orange-400 border-orange-900/50",
  TS: "text-red-400 border-red-900/50",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-muted-foreground", ACTIVE: "text-blue-400",
  SUPERSEDED: "text-yellow-400", ARCHIVED: "text-red-400",
};

const DOC_TYPE_GROUPS: Record<string, string[]> = {
  ORDERS: ["WARNO","OPORD","FRAGORD","OPLAN","CONOP"],
  INTELLIGENCE: ["IMINT","HVT_CARD","INTEL_SUMMARY","JIPOE","COA","THREAT_ASSESSMENT","ACE_PIR"],
  FIRES: ["ISR_PLAN","FIRE_SUPPORT_PLAN","CASEVAC_PLAN","LOG_CSS_PLAN"],
  COMMAND: ["ROE","EPA","OPSEC","REHEARSAL","CUSTOM"],
};

export default function FileVault() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: docs = [] } = useQuery<IsofacDoc[]>({
    queryKey: ["/api/isofac"],
    queryFn: () => apiRequest("GET", "/api/isofac"),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/isofac/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/isofac"] }); toast({ title: "Document removed" }); },
  });

  const allTypes = Array.from(new Set(docs.map(d => d.type)));

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    if (q && !d.title.toLowerCase().includes(q) && !d.type.toLowerCase().includes(q) &&
        !(d.opName || "").toLowerCase().includes(q) && !d.createdBy.toLowerCase().includes(q) &&
        !JSON.parse(d.tags || "[]").some((t: string) => t.toLowerCase().includes(q))) return false;
    if (filterType !== "all" && d.type !== filterType) return false;
    if (filterClass !== "all" && d.classification !== filterClass) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    return true;
  });

  const fmt = (iso: string) => { try { return new Date(iso).toLocaleDateString(); } catch { return iso; } };

  const getAttachments = (d: IsofacDoc) => {
    try { return JSON.parse(d.attachments || "[]"); } catch { return []; }
  };
  const getTags = (d: IsofacDoc) => {
    try { return JSON.parse(d.tags || "[]"); } catch { return []; }
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={INTEL_SUB} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>FILE VAULT</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {docs.length} DOCUMENTS ▪ {docs.filter(d => d.status === "ACTIVE").length} ACTIVE ▪ ISOFAC ARCHIVE
          </div>
        </div>
        <Link href="/isofac">
          <Button size="sm" variant="outline" className="text-xs tracking-wider gap-1">
            <FolderOpen size={12} /> OPEN ISOFAC
          </Button>
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="relative w-full">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title, type, op name, tags..." className="pl-7 text-xs h-8 w-full" />
        </div>
        <div className="tac-filter-row mb-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="text-xs h-8 w-[min(100%,11rem)] min-w-[7.5rem]"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL TYPES</SelectItem>
              {allTypes.map(t => <SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="text-xs h-8 w-[min(100%,10rem)] min-w-[7.5rem]"><SelectValue placeholder="Classification" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL CLASS</SelectItem>
              {["UNCLASS","CUI","SECRET","TS"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="text-xs h-8 w-[min(100%,10rem)] min-w-[7rem]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL STATUS</SelectItem>
              {["DRAFT","ACTIVE","SUPERSEDED","ARCHIVED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">
          {search || filterType !== "all" || filterClass !== "all" || filterStatus !== "all"
            ? "NO DOCUMENTS MATCH YOUR FILTERS"
            : "NO DOCUMENTS IN VAULT — CREATE DOCUMENTS IN THE ISOFAC TAB"}
        </div>
      )}

      <div className="space-y-1.5">
        {filtered.map(doc => {
          const cls = CLASS_COLOR[doc.classification] || "text-muted-foreground border-border";
          const attaches = getAttachments(doc);
          const tags = getTags(doc);

          return (
            <div key={doc.id} className={`bg-card border rounded px-3 py-2.5 flex items-start justify-between gap-3 ${cls}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-bold tracking-widest border px-1.5 py-0.5 rounded ${cls}`}>{doc.classification}</span>
                  {doc.docNumber ? <span className="text-[9px] font-mono text-muted-foreground tracking-wider">#{doc.docNumber}</span> : null}
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider">{doc.type.replace(/_/g," ")}</span>
                  <span className="text-xs font-bold">{doc.title}</span>
                  <span className={`text-[9px] font-bold tracking-wider ${STATUS_COLOR[doc.status] || ""}`}>{doc.status}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  <span>BY {doc.createdBy}</span>
                  {doc.opName && <span>▪ OP: {doc.opName}</span>}
                  <span>▪ {fmt(doc.createdAt)}</span>
                  {attaches.length > 0 && <span>▪ {attaches.length} ATTACHMENT{attaches.length > 1 ? "S" : ""}</span>}
                </div>
                {tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {tags.map((t: string, i: number) => (
                      <span key={i} className="text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href="/isofac">
                  <button className="p-1 text-muted-foreground hover:text-blue-400 transition-colors" title="Open in ISOFAC">
                    <ExternalLink size={11} />
                  </button>
                </Link>
                {canAdmin && (
                  <button onClick={() => del.mutate(doc.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
