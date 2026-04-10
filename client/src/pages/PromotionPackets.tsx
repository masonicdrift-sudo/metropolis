import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { SubPageNav } from "@/components/SubPageNav";
import { personnelSubNavForAccess } from "@/lib/appNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ARMY_RANKS } from "@shared/schema";
import { PROMOTION_ORDERS_INTRO } from "@shared/promotionOrders";
import { Plus, Trash2, Medal } from "lucide-react";

type DirUser = { id: number; username: string; role: string };

type Row = { username: string; newRank: string; effectiveDate: string };

const RANK_OPTIONS = [...ARMY_RANKS].sort((a, b) => a.abbr.localeCompare(b.abbr));

function emptyRow(): Row {
  return { username: "", newRank: "SGT", effectiveDate: "" };
}

export default function PromotionPacketsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [requestedNote, setRequestedNote] = useState("");

  const { data: directory = [] } = useQuery<DirUser[]>({
    queryKey: ["/api/users/directory"],
    queryFn: () => apiRequest("GET", "/api/users/directory"),
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/promotion-packets/request", {
        promotions: rows
          .filter((r) => r.username.trim() && r.newRank && r.effectiveDate.trim())
          .map((r) => ({
            username: r.username.trim(),
            newRank: r.newRank.trim(),
            effectiveDate: r.effectiveDate.trim(),
          })),
        requestedNote: requestedNote.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ title: "Promotion packet submitted", description: "Pending admin approval." });
      setRows([emptyRow()]);
      setRequestedNote("");
    },
    onError: (err: Error) =>
      toast({ title: "Request failed", description: err.message, variant: "destructive" }),
  });

  const validRows = rows.filter((r) => r.username.trim() && r.newRank && r.effectiveDate.trim());

  return (
    <div className="p-3 md:p-4 tac-page max-w-3xl">
      <SubPageNav items={personnelSubNavForAccess(user?.accessLevel)} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1
            className="text-sm font-bold tracking-[0.15em] flex items-center gap-2"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            <Medal className="h-4 w-4 text-amber-400/90" />
            PROMOTION PACKETS
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-1 max-w-xl">
            Submit one or more soldiers for promotion. When an admin approves the packet, each soldier receives a FLASH
            with Army promotion orders and their new rank is applied automatically.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card/40 p-3 mb-4 space-y-2">
        <div className="text-[9px] text-muted-foreground tracking-wider uppercase">Preview — orders text (abbrev.)</div>
        <pre className="text-[10px] text-muted-foreground/90 whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-y-auto border border-border/50 rounded p-2 bg-background/50">
          {PROMOTION_ORDERS_INTRO}
          {"\n\n"}
          • (Name lines are added after approval for each soldier in the packet.)
        </pre>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border border-border rounded-md p-3 bg-card"
          >
            <div className="sm:col-span-4 space-y-1">
              <Label className="text-[10px] tracking-wider">Operator (username)</Label>
              <Input
                className="text-xs font-mono"
                list="promo-user-datalist"
                placeholder="Callsign"
                value={row.username}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) => prev.map((x, j) => (j === i ? { ...x, username: v } : x)));
                }}
              />
            </div>
            <div className="sm:col-span-3 space-y-1">
              <Label className="text-[10px] tracking-wider">New rank</Label>
              <Select
                value={row.newRank}
                onValueChange={(v) =>
                  setRows((prev) => prev.map((x, j) => (j === i ? { ...x, newRank: v } : x)))
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {RANK_OPTIONS.map((r) => (
                    <SelectItem key={r.abbr} value={r.abbr} className="text-xs font-mono">
                      {r.abbr} — {r.full}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4 space-y-1">
              <Label className="text-[10px] tracking-wider">Effective date</Label>
              <Input
                className="text-xs"
                type="text"
                placeholder="e.g. 1 JUN 2026"
                value={row.effectiveDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) => prev.map((x, j) => (j === i ? { ...x, effectiveDate: v } : x)));
                }}
              />
            </div>
            <div className="sm:col-span-1 flex justify-end">
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
        ))}
        <datalist id="promo-user-datalist">
          {directory.map((d) => (
            <option key={d.id} value={d.username} />
          ))}
        </datalist>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs gap-1"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
        >
          <Plus size={14} /> Add line
        </Button>

        <div className="space-y-1">
          <Label className="text-[10px] tracking-wider">Packet note (optional)</Label>
          <Textarea
            className="text-xs min-h-[64px]"
            placeholder="Justification / remarks for the approval queue…"
            value={requestedNote}
            onChange={(e) => setRequestedNote(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            className="text-xs tracking-wider bg-amber-950/50 border border-amber-900/60 text-amber-200 hover:bg-amber-950/80"
            disabled={submit.isPending || validRows.length === 0}
            onClick={() => submit.mutate()}
          >
            Submit for approval ({validRows.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
