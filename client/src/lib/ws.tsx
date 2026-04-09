/**
 * Global WebSocket context — one persistent connection for the entire app.
 * Listens for server-pushed events and invalidates React Query caches instantly.
 * All pages update in real time without polling or refreshing.
 */
import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { toast } from "@/hooks/use-toast";

const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : "";

// Map of WS event type → query keys to invalidate
const EVENT_KEY_MAP: Record<string, string[][]> = {
  // Messaging
  GENERAL_MESSAGE:  [["/api/messages/general"], ["/api/messages/unread"]],
  DM:               [["/api/messages/dms"],     ["/api/messages/unread"]],
  GROUP_CREATED:    [["/api/groups"]],
  GROUP_UPDATED:    [["/api/groups"]],
  GROUP_LEFT:       [["/api/groups"]],
  MESSAGE_DELETED:  [["/api/messages/general"], ["/api/messages/dms"], ["/api/messages/unread"]],
  // Operations & tasks
  OPERATION:        [["/api/operations"]],
  OP_TASK:          [["/api/tasks"]],
  // Intel
  INTEL:            [["/api/intel"]],
  // Comms log
  COMMS:            [["/api/comms"]],
  // Units
  UNIT:             [["/api/units"]],
  // Assets
  ASSET:            [["/api/assets"]],
  THREAT:           [["/api/dashboard/threat-level"]],
  // PERSTAT
  PERSTAT:          [["/api/perstat"]],
  PERSONNEL_ROSTER: [["/api/personnel-roster"]],
  // AAR
  AAR:              [["/api/aar"]],
  // Awards
  AWARD:            [["/api/awards"], ["/api/profile"]],
  // Training
  TRAINING:         [["/api/training"]],
  // Broadcasts
  BROADCAST:        [["/api/broadcasts"], ["/api/broadcasts/all"], ["/api/notifications"]],
  // ISOFAC / File Vault
  ISOFAC:           [["/api/isofac"]],
  // Shared calendar
  CALENDAR:         [["/api/calendar-events"]],
  // Commo Cards
  COMMO_CARD:       [["/api/commo-cards"]],
  // Users (role/rank/unit changes)
  USER:             [["/api/users"], ["/api/auth/me"], ["/api/loa/mine"]],
  // Activity / Links / Support
  ACTIVITY:         [["/api/activity"]],
  LINKS:            [["/api/entity-links"], ["/api/entity-links/all"]],
  SUPPORT_REQUESTS: [["/api/support-requests"]],
  // Medical / Casualty
  CASUALTIES:       [["/api/casualties"]],
  // Approvals
  APPROVALS:        [["/api/approvals"]],
};

const WSContext = createContext<null>(null);

export function WSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "AUTH", username: user!.username }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "TACTICAL_MARKERS") {
            if (typeof msg.mapKey === "string" && msg.mapKey.length > 0) {
              qc.invalidateQueries({ queryKey: ["/api/tactical-markers", msg.mapKey] });
            } else {
              qc.invalidateQueries({ queryKey: ["/api/tactical-markers"] });
            }
            return;
          }
          if (msg.type === "TACTICAL_LINES") {
            if (typeof msg.mapKey === "string" && msg.mapKey.length > 0) {
              qc.invalidateQueries({ queryKey: ["/api/tactical-lines", msg.mapKey] });
            } else {
              qc.invalidateQueries({ queryKey: ["/api/tactical-lines"] });
            }
            return;
          }
          if (msg.type === "TACTICAL_RANGE_RINGS") {
            if (typeof msg.mapKey === "string" && msg.mapKey.length > 0) {
              qc.invalidateQueries({ queryKey: ["/api/tactical-range-rings", msg.mapKey] });
            } else {
              qc.invalidateQueries({ queryKey: ["/api/tactical-range-rings"] });
            }
            return;
          }
          if (msg.type === "TACTICAL_BUILDING_LABELS") {
            if (typeof msg.mapKey === "string" && msg.mapKey.length > 0) {
              qc.invalidateQueries({ queryKey: ["/api/tactical-building-labels", msg.mapKey] });
            } else {
              qc.invalidateQueries({ queryKey: ["/api/tactical-building-labels"] });
            }
            return;
          }
          if (msg.type === "MENTION") {
            const who = typeof msg.fromUsername === "string" ? msg.fromUsername : "Someone";
            const scopeLabel =
              msg.scope === "general"
                ? "#general"
                : msg.scope === "group"
                  ? String(msg.groupName || `Group`)
                  : "Messages";
            toast({
              title: `Ping from ${who}`,
              description: `${scopeLabel}: ${typeof msg.snippet === "string" ? msg.snippet : ""}`,
            });
            if (msg.scope === "general") {
              qc.invalidateQueries({ queryKey: ["/api/messages/general"] });
              qc.invalidateQueries({ queryKey: ["/api/messages/unread"] });
            } else if (msg.scope === "group" && msg.groupId != null) {
              qc.invalidateQueries({ queryKey: ["/api/groups", Number(msg.groupId), "messages"] });
              qc.invalidateQueries({ queryKey: ["/api/messages/unread"] });
            }
            return;
          }
          if (msg.type === "GROUP_MESSAGE" && msg.groupId != null) {
            qc.invalidateQueries({ queryKey: ["/api/groups", Number(msg.groupId), "messages"] });
            qc.invalidateQueries({ queryKey: ["/api/messages/unread"] });
            return;
          }
          const keys = EVENT_KEY_MAP[msg.type];
          if (keys) {
            keys.forEach(key => qc.invalidateQueries({ queryKey: key }));
          }
          // For OP_TASK, also invalidate the specific operation's tasks
          if (msg.type === "OP_TASK" && msg.operationId) {
            qc.invalidateQueries({ queryKey: ["/api/tasks", msg.operationId] });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        // Reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.username]);

  return <WSContext.Provider value={null}>{children}</WSContext.Provider>;
}
