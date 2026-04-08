import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { CalendarEvent } from "@shared/schema";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EVENT_COLORS: { key: string; label: string; cls: string }[] = [
  { key: "blue", label: "BLUE", cls: "bg-blue-950/40 border-blue-900/40 text-blue-200/90 hover:bg-blue-900/40" },
  { key: "black", label: "BLACK", cls: "bg-black/30 border-white/10 text-slate-200/90 hover:bg-black/40" },
  { key: "red", label: "RED", cls: "bg-red-950/40 border-red-900/40 text-red-200/90 hover:bg-red-900/40" },
  { key: "amber", label: "AMBER", cls: "bg-amber-950/35 border-amber-900/40 text-amber-200/90 hover:bg-amber-900/35" },
  { key: "green", label: "GREEN", cls: "bg-emerald-950/35 border-emerald-900/40 text-emerald-200/90 hover:bg-emerald-900/35" },
  { key: "purple", label: "PURPLE", cls: "bg-purple-950/35 border-purple-900/40 text-purple-200/90 hover:bg-purple-900/35" },
] as const;

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const mobile = useIsMobile();
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ title: "", notes: "", startTime: "", endDate: "", endTime: "", color: "blue" });

  const range = useMemo(() => {
    const ms = startOfMonth(cursor);
    const me = endOfMonth(cursor);
    return { from: ymd(ms), to: ymd(me) };
  }, [cursor]);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events", range.from, range.to],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/calendar-events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  });

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.eventDate) ?? [];
      list.push(e);
      m.set(e.eventDate, list);
    }
    for (const [, list] of Array.from(m.entries())) {
      list.sort((a: CalendarEvent, b: CalendarEvent) => {
        const ta = (a.startTime || "").localeCompare(b.startTime || "");
        if (ta !== 0) return ta;
        return a.id - b.id;
      });
    }
    return m;
  }, [events]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const createMut = useMutation({
    mutationFn: (body: { eventDate: string; endDate: string; title: string; notes: string; startTime: string; endTime: string; color: string }) =>
      apiRequest("POST", "/api/calendar-events", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "Event added" });
      closeDialog();
    },
    onError: () => toast({ title: "Could not add event", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (body: { id: number; patch: Partial<{ title: string; notes: string; startTime: string; eventDate: string; endDate: string; endTime: string; color: string }> }) =>
      apiRequest("PATCH", `/api/calendar-events/${body.id}`, body.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "Event updated" });
      closeDialog();
    },
    onError: () => toast({ title: "Could not update event", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/calendar-events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "Event removed" });
      closeDialog();
    },
    onError: () => toast({ title: "Could not delete event", variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setSelectedDate(null);
    setForm({ title: "", notes: "", startTime: "", endDate: "", endTime: "", color: "blue" });
  };

  const openNew = (dateStr: string) => {
    setSelectedDate(dateStr);
    setEditing(null);
    setForm({ title: "", notes: "", startTime: "", endDate: dateStr, endTime: "", color: "blue" });
    setDialogOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setSelectedDate(ev.eventDate);
    setEditing(ev);
    setForm({
      title: ev.title,
      notes: ev.notes || "",
      startTime: ev.startTime || "",
      endDate: (ev.endDate || ev.eventDate) as any,
      endTime: ev.endTime || "",
      color: ev.color || "blue",
    });
    setDialogOpen(true);
  };

  const canEdit = (ev: CalendarEvent) =>
    !!user && (ev.createdBy === user.username || user.accessLevel === "admin" || user.accessLevel === "owner");

  const submit = () => {
    if (!selectedDate || !form.title.trim()) {
      toast({ title: "Title and date required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        patch: {
          title: form.title.trim(),
          notes: form.notes.trim(),
          startTime: form.startTime.trim(),
          eventDate: selectedDate,
          endDate: form.endDate.trim(),
          endTime: form.endTime.trim(),
          color: form.color,
        },
      });
    } else {
      createMut.mutate({
        eventDate: selectedDate,
        endDate: form.endDate.trim(),
        title: form.title.trim(),
        notes: form.notes.trim(),
        startTime: form.startTime.trim(),
        endTime: form.endTime.trim(),
        color: form.color,
      });
    }
  };

  const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1
            className="text-sm font-bold tracking-[0.15em] text-green-400"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            UNIT CALENDAR
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
            Shared events — click a day to add; select an event to edit or delete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCursor((d) => subMonths(d, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-xs font-mono tracking-wider min-w-[10rem] text-center">
            {format(cursor, "MMMM yyyy").toUpperCase()}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCursor((d) => addMonths(d, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[10px] tracking-wider"
            onClick={() => setCursor(new Date())}
          >
            TODAY
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30 shrink-0">
          {weekdayLabels.map((w) => (
            <div key={w} className="text-[9px] font-bold tracking-widest text-muted-foreground py-2 text-center border-r border-border/40 last:border-r-0">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr min-h-[min(70vh,520px)]">
          {days.map((day) => {
            const ds = ymd(day);
            const inMonth = isSameMonth(day, cursor);
            const dayEvents = byDate.get(ds) ?? [];
            return (
              <div
                key={ds}
                role="button"
                tabIndex={0}
                onClick={() => openNew(ds)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openNew(ds);
                  }
                }}
                className={cn(
                  "border-b border-r border-border/60 p-1 sm:p-1.5 text-left flex flex-col gap-0.5 min-h-[4.5rem] sm:min-h-[5.5rem] touch-manipulation transition-colors cursor-pointer",
                  inMonth ? "bg-card hover:bg-secondary/40" : "bg-secondary/10 opacity-70 hover:opacity-90",
                  isToday(day) && "ring-1 ring-inset ring-green-600/50",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold",
                      isToday(day) ? "text-green-400" : inMonth ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <Plus className="h-3 w-3 text-muted-foreground/50 shrink-0" aria-hidden />
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-h-0 overflow-hidden">
                  {dayEvents.slice(0, mobile ? 2 : 3).map((ev) => (
                    (() => {
                      const colorCls = (EVENT_COLORS.find((c) => c.key === (ev.color || "blue"))?.cls) || EVENT_COLORS[0].cls;
                      const endStr = (ev.endDate && ev.endDate !== ev.eventDate) ? `→${ev.endDate}` : "";
                      const timeStr = `${ev.startTime ? `${ev.startTime}` : ""}${ev.endTime ? `-${ev.endTime}` : ""}`.trim();
                      const meta = `${timeStr ? `${timeStr} ` : ""}${endStr}`;
                      return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(ev);
                      }}
                      className={cn(
                        "text-[8px] sm:text-[9px] leading-tight px-1 py-0.5 rounded border truncate cursor-pointer text-left w-full",
                        colorCls,
                      )}
                    >
                      {meta ? `${meta} ` : ""}
                      {ev.title}
                    </button>
                      );
                    })()
                  ))}
                  {dayEvents.length > (mobile ? 2 : 3) && (
                    <span className="text-[8px] text-muted-foreground pl-0.5">+{dayEvents.length - (mobile ? 2 : 3)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="text-[10px] text-muted-foreground font-mono">Loading events…</div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent
          className={cn("max-w-md", mobile && "max-h-[85dvh] overflow-y-auto")}
          onPointerDownOutside={(e) => {
            const t = e.target as HTMLElement;
            if (
              t.closest("[data-radix-popper-content-wrapper]") ||
              t.closest("[data-radix-popover-content]")
            ) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-green-400" />
              {editing ? (
                <>
                  <Pencil className="h-3.5 w-3.5" /> EDIT EVENT
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> NEW EVENT
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedDate && (
            <div className="text-[10px] text-muted-foreground font-mono mb-2">
              DATE: {selectedDate} (Z) — adjust below if needed
            </div>
          )}
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">DATE (YYYY-MM-DD)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={selectedDate || ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                placeholder="2026-04-07"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">END DATE (YYYY-MM-DD)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                placeholder={selectedDate || "2026-04-07"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">START TIME (OPTIONAL, HH:MM)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                placeholder="0900 or 09:00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">END TIME (OPTIONAL, HH:MM)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                placeholder="1030 or 10:30"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">COLOR</Label>
              <Select value={form.color} onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_COLORS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">TITLE</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Range brief · rehearsal · NTC movement…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">NOTES</Label>
              <Textarea
                className="text-xs font-mono min-h-[5rem]"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Location, uniform, POC…"
              />
            </div>
            {editing && (
              <div className="text-[9px] text-muted-foreground">
                Scheduled by {editing.createdBy}
                {canEdit(editing) ? null : " — you can only view this event"}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button type="button" variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            {editing && canEdit(editing) && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => deleteMut.mutate(editing.id)}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="bg-green-800 hover:bg-green-700"
              onClick={submit}
              disabled={
                createMut.isPending ||
                updateMut.isPending ||
                (editing !== null && !canEdit(editing))
              }
            >
              {editing ? "Save" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
