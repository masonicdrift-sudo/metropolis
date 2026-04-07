import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Broadcast } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { X, Radio, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  flash:     { color: "text-red-400",    bg: "bg-red-950/95",    border: "border-red-600",    icon: Zap },
  immediate: { color: "text-orange-400", bg: "bg-orange-950/95", border: "border-orange-600", icon: AlertTriangle },
  priority:  { color: "text-yellow-400", bg: "bg-yellow-950/95", border: "border-yellow-600", icon: Radio },
};

export function BroadcastOverlay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const compactShell = useIsMobile();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState<Broadcast | null>(null);
  const seenIds = useRef<Set<number>>(new Set());

  const { data: active = [] } = useQuery<Broadcast[]>({
    queryKey: ["/api/broadcasts"],
    queryFn: () => apiRequest("GET", "/api/broadcasts"),
    refetchInterval: 15000,
    enabled: !!user,
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/broadcasts/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/broadcasts"] }),
  });

  useEffect(() => {
    const visible = active.filter(b => !dismissed.has(b.id));
    if (visible.length > 0 && !current) {
      const next = visible.find(b => !seenIds.current.has(b.id)) || visible[0];
      if (next) {
        seenIds.current.add(next.id);
        setCurrent(next);
      }
    }
  }, [active, dismissed, current]);

  const handleDismiss = () => {
    if (!current) return;
    setDismissed(prev => new Set([...Array.from(prev), current.id]));
    dismiss.mutate(current.id);
    setCurrent(null);
  };

  if (!current) return null;

  const cfg = PRIORITY_CONFIG[current.priority] || PRIORITY_CONFIG.priority;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex justify-center p-0 md:p-4",
        compactShell ? "items-end" : "items-center",
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      {/* Modal — bottom sheet when compact shell; centered on large desktop */}
      <div
        className={cn(
          "relative w-full border-2 shadow-2xl scanlines safe-bottom",
          cfg.bg,
          cfg.border,
          compactShell ? "rounded-t-xl p-5 max-h-[85dvh] overflow-y-auto w-full" : "w-full md:max-w-md rounded-lg p-5 md:p-6",
        )}
      >
        {/* Flashing top bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.border.replace("border-","bg-")} animate-pulse rounded-t-lg`} />

        <div className="flex items-start gap-4">
          <div className={`p-2 rounded border ${cfg.border} ${cfg.bg} shrink-0`}>
            <Icon size={20} className={`${cfg.color} animate-pulse`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-bold tracking-[0.25em] mb-1 ${cfg.color}`}>
              ⚡ {current.priority.toUpperCase()} MESSAGE — FROM {current.sentBy}
            </div>
            <div className="text-sm font-bold tracking-wider mb-2">{current.title}</div>
            <div className="text-[13px] text-foreground/90 leading-relaxed">{current.message}</div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 mt-6">
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {new Date(current.sentAt).toLocaleString()}
          </div>
          <Button size="sm" onClick={handleDismiss}
            className={`text-xs tracking-wider gap-1 bg-transparent border ${cfg.border} ${cfg.color} hover:bg-white/10`}>
            <X size={12} /> ACKNOWLEDGE
          </Button>
        </div>
      </div>
    </div>
  );
}
