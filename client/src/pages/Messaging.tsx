import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Hash, MessageSquare, Users, Trash2, Crown, ShieldCheck, User as UserIcon, Search } from "lucide-react";
import type { Message } from "@shared/schema";

const GENERAL = "GENERAL";
const WS_URL = typeof window !== "undefined"
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
  : "";

// ── Role icon helper ────────────────────────────────────────────
function RoleIcon({ role }: { role?: string }) {
  if (role === "owner") return <Crown size={9} className="text-orange-400 shrink-0" />;
  if (role === "admin") return <ShieldCheck size={9} className="text-yellow-400 shrink-0" />;
  return <UserIcon size={9} className="text-green-400 shrink-0" />;
}

function roleColor(role?: string) {
  if (role === "owner") return "text-orange-400";
  if (role === "admin") return "text-yellow-400";
  return "text-green-400";
}

// ── Single message bubble ────────────────────────────────────────
function MsgBubble({ msg, isMe, onDelete, canDelete, userMap }: {
  msg: Message; isMe: boolean; onDelete: (id: number) => void;
  canDelete: boolean; userMap: Record<string, string>;
}) {
  const [hovered, setHovered] = useState(false);
  const deleted = msg.content === "[message deleted]";
  const role = userMap[msg.fromUsername];
  const time = new Date(msg.sentAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div
      className={`group flex gap-2 px-4 py-1 hover:bg-secondary/20 transition-colors ${isMe ? "flex-row-reverse" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className={`w-6 h-6 rounded shrink-0 flex items-center justify-center text-[9px] font-bold border mt-0.5 ${
        role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
        role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
        "bg-green-900/40 border-green-800/50 text-green-400"
      }`}>
        {msg.fromUsername[0].toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={`flex-1 min-w-0 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
          <span className={`text-[10px] font-bold font-mono tracking-wider ${roleColor(role)}`}>{msg.fromUsername}</span>
          <RoleIcon role={role} />
          <span className="text-[9px] text-muted-foreground/50">{time}</span>
        </div>
        <div className={`relative rounded px-2.5 py-1.5 text-xs leading-relaxed max-w-full break-words ${
          deleted ? "italic text-muted-foreground/50 bg-secondary/30" :
          isMe ? "bg-green-900/40 border border-green-800/30 text-foreground" :
          "bg-secondary border border-border text-foreground"
        }`}>
          {msg.content}
          {/* Delete button */}
          {!deleted && canDelete && hovered && (
            <button onClick={() => onDelete(msg.id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-900/80 border border-red-700/50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-800">
              <Trash2 size={8} className="text-red-300" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message input ────────────────────────────────────────────────
function MessageInput({ onSend, placeholder }: { onSend: (text: string) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2 px-4 py-3 border-t border-border bg-card/50">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-secondary border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-green-700 focus:border-green-700"
        data-testid="input-message-text"
      />
      <button type="submit" disabled={!text.trim()}
        className="px-3 py-1.5 bg-green-800 hover:bg-green-700 disabled:opacity-40 rounded text-green-100 text-xs transition-colors flex items-center gap-1"
        data-testid="button-send-message">
        <Send size={11} />
      </button>
    </form>
  );
}

// ── Main Messaging page ──────────────────────────────────────────
export default function Messaging() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeChannel, setActiveChannel] = useState<string>(GENERAL); // "GENERAL" or a username for DMs
  const [dmSearch, setDmSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch all users for DM list and role lookup
  const { data: allUsers = [] } = useQuery<{ id: number; username: string; role: string }[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
  });

  // Build username->role map
  const userMap = Object.fromEntries(allUsers.map(u => [u.username, u.role]));
  // Add self
  if (user) userMap[user.username] = user.role;

  // General messages
  const { data: generalMsgs = [], refetch: refetchGeneral } = useQuery<Message[]>({
    queryKey: ["/api/messages/general"],
    queryFn: () => apiRequest("GET", "/api/messages/general"),
    enabled: activeChannel === GENERAL,
    refetchInterval: false,
  });

  // DM messages
  const { data: dmMsgs = [], refetch: refetchDM } = useQuery<Message[]>({
    queryKey: ["/api/messages/dm", activeChannel],
    queryFn: () => apiRequest("GET", `/api/messages/dm/${activeChannel}`),
    enabled: activeChannel !== GENERAL,
    refetchInterval: false,
  });

  // DM list (sidebar)
  const { data: dmList = [], refetch: refetchDMList } = useQuery<{ username: string; lastMessage: string; sentAt: string; unread: number }[]>({
    queryKey: ["/api/messages/dms"],
    queryFn: () => apiRequest("GET", "/api/messages/dms"),
  });

  // Unread counts
  const { data: unread = { dms: 0, general: 0 }, refetch: refetchUnread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    refetchInterval: 10000,
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "AUTH", username: user.username }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "GENERAL_MESSAGE") {
          refetchGeneral();
          refetchUnread();
        } else if (msg.type === "DM") {
          refetchDM();
          refetchDMList();
          refetchUnread();
        } else if (msg.type === "MESSAGE_DELETED") {
          refetchGeneral();
          refetchDM();
        }
      } catch {}
    };
    ws.onerror = () => {};
    return () => { ws.close(); };
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generalMsgs, dmMsgs, activeChannel]);

  // Send general
  const sendGeneral = useMutation({
    mutationFn: (content: string) => apiRequest("POST", "/api/messages/general", { content }),
    onSuccess: () => refetchGeneral(),
  });

  // Send DM
  const sendDM = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/messages/dm/${activeChannel}`, { content }),
    onSuccess: () => { refetchDM(); refetchDMList(); },
  });

  // Delete
  const deleteMsg = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/messages/${id}`),
    onSuccess: () => { refetchGeneral(); refetchDM(); },
  });

  // Mark general read when switching to it
  useEffect(() => {
    if (activeChannel === GENERAL) {
      apiRequest("POST", "/api/messages/general/read").then(() => refetchUnread());
    }
  }, [activeChannel]);

  const activeMsgs = activeChannel === GENERAL ? generalMsgs : dmMsgs;
  const handleSend = (text: string) => {
    if (activeChannel === GENERAL) sendGeneral.mutate(text);
    else sendDM.mutate(text);
  };

  const canDelete = (msg: Message) =>
    msg.fromUsername === user?.username ||
    (user?.role === "admin" || user?.role === "owner");

  const otherUsers = allUsers.filter(u => u.username !== user?.username);
  const filteredUsers = dmSearch
    ? otherUsers.filter(u => u.username.toLowerCase().includes(dmSearch.toLowerCase()))
    : otherUsers;

  const getDMUnread = (username: string) =>
    dmList.find(d => d.username === username)?.unread || 0;

  return (
    <div className="flex h-full" style={{ height: "calc(100vh)" }}>

      {/* ── Channel sidebar ─────────────────────────────────── */}
      <div className="w-56 border-r border-border bg-card flex flex-col shrink-0">
        {/* Header */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare size={13} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">SECURE COMMS</span>
          </div>
        </div>

        {/* General */}
        <div className="px-2 pt-3 pb-1">
          <div className="text-[9px] text-muted-foreground/50 tracking-widest px-2 mb-1">CHANNELS</div>
          <button
            onClick={() => setActiveChannel(GENERAL)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all ${
              activeChannel === GENERAL
                ? "bg-green-950/60 text-green-400 border border-green-900/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            data-testid="channel-general"
          >
            <div className="flex items-center gap-2">
              <Hash size={12} />
              <span className="tracking-wider">general</span>
            </div>
            {unread.general > 0 && activeChannel !== GENERAL && (
              <span className="bg-green-600 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] text-center">
                {unread.general > 99 ? "99+" : unread.general}
              </span>
            )}
          </button>
        </div>

        {/* DMs */}
        <div className="px-2 pt-2 flex-1 overflow-hidden flex flex-col">
          <div className="text-[9px] text-muted-foreground/50 tracking-widest px-2 mb-1.5 flex items-center justify-between">
            <span>DIRECT MESSAGES</span>
            {unread.dms > 0 && <span className="bg-red-700 text-white text-[9px] font-bold px-1.5 rounded-full">{unread.dms}</span>}
          </div>

          {/* Search */}
          <div className="relative mb-1.5">
            <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input value={dmSearch} onChange={e => setDmSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-secondary border border-border rounded pl-6 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-green-800"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-0.5">
            {filteredUsers.map(u => {
              const unreadCount = getDMUnread(u.username);
              const isActive = activeChannel === u.username;
              const lastDM = dmList.find(d => d.username === u.username);
              return (
                <button key={u.id}
                  onClick={() => setActiveChannel(u.username)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all ${
                    isActive ? "bg-green-950/60 border border-green-900/50" : "hover:bg-secondary"
                  }`}
                  data-testid={`dm-user-${u.username}`}
                >
                  <div className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-[9px] font-bold border ${
                    u.role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                    u.role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                    "bg-green-900/40 border-green-800/50 text-green-400"
                  }`}>{u.username[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-mono font-bold truncate ${roleColor(u.role)}`}>{u.username}</div>
                    {lastDM && (
                      <div className="text-[9px] text-muted-foreground/50 truncate">{lastDM.lastMessage}</div>
                    )}
                  </div>
                  {unreadCount > 0 && !isActive && (
                    <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] text-center shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="text-[10px] text-muted-foreground/50 text-center py-3">No users found</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main chat area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/30">
          {activeChannel === GENERAL ? (
            <>
              <Hash size={14} className="text-green-400" />
              <span className="text-sm font-bold tracking-wider text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>general</span>
              <span className="text-[10px] text-muted-foreground ml-2">— All members can see this channel</span>
            </>
          ) : (
            <>
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${
                userMap[activeChannel] === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                userMap[activeChannel] === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                "bg-green-900/40 border-green-800/50 text-green-400"
              }`}>{activeChannel[0].toUpperCase()}</div>
              <span className={`text-sm font-bold tracking-wider font-mono ${roleColor(userMap[activeChannel])}`} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {activeChannel}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">— Direct Message</span>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-2">
          {activeMsgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-[40px] mb-2">{activeChannel === GENERAL ? "#" : "💬"}</div>
              <div className="text-sm font-bold text-muted-foreground tracking-wider">
                {activeChannel === GENERAL ? "Welcome to #general" : `Start a conversation with ${activeChannel}`}
              </div>
              <div className="text-[10px] text-muted-foreground/50 mt-1">
                {activeChannel === GENERAL ? "This is the beginning of all team comms." : "Your messages are private."}
              </div>
            </div>
          )}
          {activeMsgs.map((msg, i) => {
            const prev = activeMsgs[i - 1];
            const showHeader = !prev || prev.fromUsername !== msg.fromUsername ||
              (new Date(msg.sentAt).getTime() - new Date(prev.sentAt).getTime()) > 5 * 60 * 1000;
            return (
              <div key={msg.id}>
                {showHeader && i > 0 && <div className="h-1" />}
                <MsgBubble
                  msg={msg}
                  isMe={msg.fromUsername === user?.username}
                  onDelete={(id) => deleteMsg.mutate(id)}
                  canDelete={canDelete(msg)}
                  userMap={userMap}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          placeholder={activeChannel === GENERAL ? "Message #general..." : `Message ${activeChannel}...`}
        />
      </div>
    </div>
  );
}
