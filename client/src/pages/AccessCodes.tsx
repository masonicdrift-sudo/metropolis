import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Trash2, Copy, Check, KeyRound, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Code {
  id: number;
  code: string;
  createdBy: string;
  createdAt: string;
  used: boolean;
  usedBy: string;
  usedAt: string;
  expiresAt: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 text-muted-foreground hover:text-blue-400 transition-colors" title="Copy code">
      {copied ? <Check size={11} className="text-blue-400" /> : <Copy size={11} />}
    </button>
  );
}

export default function AccessCodes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "active" | "used">("all");

  const { data: codes = [] } = useQuery<Code[]>({
    queryKey: ["/api/access-codes"],
    queryFn: () => apiRequest("GET", "/api/access-codes"),
  });

  const generate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/access-codes", {}),
    onSuccess: (newCode: Code) => {
      qc.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: `Code generated: ${newCode.code}` });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/access-codes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/access-codes"] }); toast({ title: "Code revoked" }); },
  });

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).toUpperCase();
  };

  const isExpired = (c: Code) => c.expiresAt && new Date(c.expiresAt) < new Date();

  const displayed = codes.filter(c =>
    filter === "all" ? true : filter === "active" ? !c.used && !isExpired(c) : c.used || isExpired(c)
  );

  const activeCount = codes.filter(c => !c.used && !isExpired(c)).length;
  const usedCount = codes.filter(c => c.used).length;

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>ACCESS CODE MANAGER</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            <span className="text-blue-400">{activeCount} ACTIVE</span> ▪ <span className="text-muted-foreground">{usedCount} REDEEMED</span> ▪ {codes.length} TOTAL
          </div>
        </div>
        <Button size="sm" onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="bg-yellow-800 hover:bg-yellow-700 text-xs tracking-wider gap-1 text-yellow-100"
          data-testid="button-generate-code">
          <Plus size={12} /> GENERATE CODE
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-yellow-950/20 border border-yellow-900/40 rounded p-3 mb-4 flex items-start gap-2">
        <KeyRound size={11} className="text-yellow-400 mt-0.5 shrink-0" />
        <div className="text-[10px] text-yellow-300/80 leading-relaxed">
          Each code is single-use and allows one person to create a new Operator account on the login screen. 
          Share the code securely — once redeemed it cannot be used again. You can revoke unused codes at any time.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <div className="bg-card border border-border rounded px-3 py-2">
          <div className="text-[9px] text-muted-foreground tracking-wider">ACTIVE CODES</div>
          <div className="kpi-value text-xl text-blue-400">{activeCount}</div>
        </div>
        <div className="bg-card border border-border rounded px-3 py-2">
          <div className="text-[9px] text-muted-foreground tracking-wider">REDEEMED</div>
          <div className="kpi-value text-xl text-muted-foreground">{usedCount}</div>
        </div>
        <div className="bg-card border border-border rounded px-3 py-2">
          <div className="text-[9px] text-muted-foreground tracking-wider">TOTAL ISSUED</div>
          <div className="kpi-value text-xl">{codes.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="tac-filter-row mb-3">
        {(["all", "active", "used"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filter === f ? "bg-yellow-900/60 text-yellow-400 border border-yellow-800/60" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Codes table */}
      <div className="bg-card border border-border rounded">
        {displayed.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            {filter === "active" ? "NO ACTIVE CODES — GENERATE ONE ABOVE" : "NO CODES"}
          </div>
        ) : (
          <table className="w-full text-xs mobile-card-table">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground tracking-[0.12em]">
                <th className="text-left px-4 py-2">CODE</th>
                <th className="text-left px-4 py-2">STATUS</th>
                <th className="text-left px-4 py-2">CREATED</th>
                <th className="text-left px-4 py-2">REDEEMED BY</th>
                <th className="text-left px-4 py-2">REDEEMED AT</th>
                <th className="text-left px-4 py-2">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.map(c => {
                const expired = isExpired(c);
                return (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors" data-testid={`code-row-${c.id}`}>
                    <td className="px-4 py-3" data-label="CODE">
                      <div className="flex items-center gap-1">
                        <span className={`font-mono font-bold tracking-[0.2em] text-sm ${c.used || expired ? "text-muted-foreground line-through" : "text-yellow-300"}`}>
                          {c.code}
                        </span>
                        {!c.used && !expired && <CopyButton text={c.code} />}
                      </div>
                    </td>
                    <td className="px-4 py-3" data-label="STATUS">
                      {c.used
                        ? <span className="badge-offline text-[9px] px-2 py-0.5 rounded font-bold tracking-wider">REDEEMED</span>
                        : expired
                        ? <span className="badge-compromised text-[9px] px-2 py-0.5 rounded font-bold tracking-wider">EXPIRED</span>
                        : <span className="badge-active text-[9px] px-2 py-0.5 rounded font-bold tracking-wider">ACTIVE</span>}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono" data-label="CREATED">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-[10px] font-mono" data-label="REDEEMED BY">
                      {c.usedBy ? <span className="text-blue-400">{c.usedBy}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono" data-label="REDEEMED AT">{formatDate(c.usedAt)}</td>
                    <td className="px-4 py-3" data-label="ACTIONS">
                      {!c.used && (
                        <button onClick={() => del.mutate(c.id)}
                          className="p-1 text-muted-foreground hover:text-red-400 transition-colors" title="Revoke"
                          data-testid={`revoke-code-${c.id}`}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
