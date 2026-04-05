import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef } from "react";
import { Send, Hash, MessageSquare, Users, Trash2, Crown, ShieldCheck, User as UserIcon, Search, Plus, LogOut, UserPlus, X } from "lucide-react";
import type { Message, GroupChat } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

// ── Create Group Dialog ─────────────────────────────────────────
function CreateGroupDialog({ allUsers, currentUser, onCreated }: {
  allUsers: { id: number; username: string; role: string }[];
  currentUser: string;
  onCreated: (group: GroupChat) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { toast } = (window as any).__toastRef || { toast: () => {} };
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/groups", { name: name.trim(), members: selected }),
    onSuccess: (group: GroupChat) => {
      qc.invalidateQueries({ queryKey: ["/api/groups"] });
      setOpen(false); setName(""); setSelected([]);
      onCreated(group);
    },
  });

  const toggle = (u: string) =>
    setSelected(s => s.includes(u) ? s.filter(x => x !== u) : [...s, u]);

  const others = allUsers.filter(u => u.username !== currentUser);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-[9px] text-green-400/60 hover:text-green-400 flex items-center gap-1 tracking-wider transition-colors">
          <Plus size={9} /> NEW GROUP
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-sm tracking-widest">CREATE GROUP CHAT</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">GROUP NAME</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Assault Team Alpha"
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-green-700 uppercase tracking-wider" />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-2">ADD MEMBERS ({selected.length} selected)</label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {others.map(u => (
                <button key={u.username} onClick={() => toggle(u.username)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                    selected.includes(u.username)
                      ? "bg-green-950/60 border border-green-800/50"
                      : "hover:bg-secondary"
                  }`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] ${
                    selected.includes(u.username) ? "bg-green-700 border-green-600" : "border-border"
                  }`}>
                    {selected.includes(u.username) && "✓"}
                  </div>
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${
                    u.role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                    u.role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                    "bg-green-900/40 border-green-800/50 text-green-400"
                  }`}>{u.username[0].toUpperCase()}</div>
                  <span className={`font-mono font-bold text-[10px] ${roleColor(u.role)}`}>{u.username}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs">CANCEL</Button>
            <Button size="sm" onClick={() => create.mutate()}
              disabled={!name.trim() || selected.length === 0 || create.isPending}
              className="text-xs bg-green-800 hover:bg-green-700">CREATE</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add member to existing group ─────────────────────────────────
function AddMemberDialog({ group, allUsers, currentUser }: {
  group: GroupChat;
  allUsers: { id: number; username: string; role: string }[];
  currentUser: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const members = JSON.parse(group.members || "[]");
  const nonMembers = allUsers.filter(u => !members.includes(u.username));

  const add = useMutation({
    mutationFn: (username: string) => apiRequest("POST", `/api/groups/${group.id}/members`, { username }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups"] }); setOpen(false); },
  });

  if (nonMembers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1 text-muted-foreground hover:text-green-400 transition-colors" title="Add member">
          <UserPlus size={10} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle className="text-xs tracking-widest">ADD TO {group.name.toUpperCase()}</DialogTitle></DialogHeader>
        <div className="space-y-1">
          {nonMembers.map(u => (
            <button key={u.username} onClick={() => add.mutate(u.username)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-secondary text-left transition-colors">
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${
                u.role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                u.role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                "bg-green-900/40 border-green-800/50 text-green-400"
              }`}>{u.username[0].toUpperCase()}</div>
              <span className={`font-mono font-bold text-[10px] ${roleColor(u.role)}`}>{u.username}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Messaging page ──────────────────────────────────────────
export default function Messaging() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // activeChannel: "GENERAL" | "DM:username" | "GROUP:id"
  const [activeChannel, setActiveChannel] = useState<string>(GENERAL);
  const [dmSearch, setDmSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const isGroup = activeChannel.startsWith("GROUP:");
  const isDM = activeChannel.startsWith("DM:") || (!activeChannel.startsWith("GROUP:") && activeChannel !== GENERAL);
  const activeGroupId = isGroup ? Number(activeChannel.split(":")[1]) : null;
  const activeDMUser = isDM ? activeChannel.replace("DM:", "") : null;

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

  // Groups
  const { data: groups = [], refetch: refetchGroups } = useQuery<GroupChat[]>({
    queryKey: ["/api/groups"],
    queryFn: () => apiRequest("GET", "/api/groups"),
  });
  const activeGroup = groups.find(g => g.id === activeGroupId) ?? null;

  // DM messages
  const { data: dmMsgs = [], refetch: refetchDM } = useQuery<Message[]>({
    queryKey: ["/api/messages/dm", activeDMUser],
    queryFn: () => apiRequest("GET", `/api/messages/dm/${activeDMUser}`),
    enabled: !!activeDMUser,
    refetchInterval: false,
  });

  // Group messages
  const { data: groupMsgs = [], refetch: refetchGroupMsgs } = useQuery<Message[]>({
    queryKey: ["/api/groups", activeGroupId, "messages"],
    queryFn: () => apiRequest("GET", `/api/groups/${activeGroupId}/messages`),
    enabled: !!activeGroupId,
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
          refetchGeneral(); refetchUnread();
        } else if (msg.type === "DM") {
          refetchDM(); refetchDMList(); refetchUnread();
        } else if (msg.type === "GROUP_MESSAGE") {
          refetchGroupMsgs(); refetchGroups();
        } else if (msg.type === "GROUP_CREATED" || msg.type === "GROUP_UPDATED") {
          refetchGroups();
        } else if (msg.type === "MESSAGE_DELETED") {
          refetchGeneral(); refetchDM(); refetchGroupMsgs();
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
    mutationFn: (content: string) => apiRequest("POST", `/api/messages/dm/${activeDMUser}`, { content }),
    onSuccess: () => { refetchDM(); refetchDMList(); },
  });
  // Send group message
  const sendGroup = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/groups/${activeGroupId}/messages`, { content }),
    onSuccess: () => refetchGroupMsgs(),
  });
  // Leave group
  const leaveGroup = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/groups/${id}/members/me`),
    onSuccess: () => { refetchGroups(); setActiveChannel(GENERAL); },
  });
  // Delete group
  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/groups/${id}`),
    onSuccess: () => { refetchGroups(); setActiveChannel(GENERAL); },
  });
  // Delete message
  const deleteMsg = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/messages/${id}`),
    onSuccess: () => { refetchGeneral(); refetchDM(); refetchGroupMsgs(); },
  });

  // Mark general read when switching to it
  useEffect(() => {
    if (activeChannel === GENERAL) {
      apiRequest("POST", "/api/messages/general/read").then(() => refetchUnread());
    }
  }, [activeChannel]);

  const activeMsgs = isGroup ? groupMsgs : activeChannel === GENERAL ? generalMsgs : dmMsgs;
  const handleSend = (text: string) => {
    if (activeChannel === GENERAL) sendGeneral.mutate(text);
    else if (isGroup) sendGroup.mutate(text);
    else sendDM.mutate(text);
  };

  const canDelete = (msg: Message) =>
    msg.fromUsername === user?.username ||
    user?.role === "admin" || user?.role === "owner";

  const otherUsers = allUsers.filter(u => u.username !== user?.username);
  const filteredUsers = dmSearch
    ? otherUsers.filter(u => u.username.toLowerCase().includes(dmSearch.toLowerCase()))
    : otherUsers;

  const getDMUnread = (username: string) =>
    dmList.find(d => d.username === username)?.unread || 0;

  const openDM = (username: string) => setActiveChannel(`DM:${username}`);
  const openGroup = (id: number) => setActiveChannel(`GROUP:${id}`);

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

        {/* Groups */}
        <div className="px-2 pt-2 pb-1">
          <div className="text-[9px] text-muted-foreground/50 tracking-widest px-2 mb-1.5 flex items-center justify-between">
            <span>GROUP CHATS</span>
            <CreateGroupDialog allUsers={allUsers} currentUser={user?.username || ""} onCreated={g => openGroup(g.id)} />
          </div>
          {groups.map(g => {
            const isActive = activeChannel === `GROUP:${g.id}`;
            const memberList = JSON.parse(g.members || "[]") as string[];
            return (
              <button key={g.id} onClick={() => openGroup(g.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all mb-0.5 ${
                  isActive ? "bg-green-950/60 border border-green-900/50" : "hover:bg-secondary"
                }`}>
                <div className="w-5 h-5 rounded bg-green-900/40 border border-green-800/50 flex items-center justify-center shrink-0">
                  <Users size={9} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold font-mono truncate tracking-wider text-foreground">{g.name}</div>
                  <div className="text-[9px] text-muted-foreground/50">{memberList.length} members</div>
                </div>
              </button>
            );
          })}
          {groups.length === 0 && (
            <div className="text-[9px] text-muted-foreground/40 px-2 py-1">No groups yet</div>
          )}
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
              const isActive = activeChannel === `DM:${u.username}` || activeChannel === u.username;
              const lastDM = dmList.find(d => d.username === u.username);
              return (
                <button key={u.id}
                  onClick={() => openDM(u.username)}
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
          ) : isGroup && activeGroup ? (
            <>
              <Users size={14} className="text-green-400" />
              <span className="text-sm font-bold tracking-wider text-green-400 font-mono" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{activeGroup.name}</span>
              <span className="text-[10px] text-muted-foreground ml-1">— {JSON.parse(activeGroup.members || "[]").join(", ")}</span>
              <div className="ml-auto flex items-center gap-1">
                <AddMemberDialog group={activeGroup} allUsers={allUsers} currentUser={user?.username || ""} />
                <button onClick={() => leaveGroup.mutate(activeGroup.id)}
                  className="p-1 text-muted-foreground hover:text-yellow-400 transition-colors" title="Leave group">
                  <LogOut size={11} />
                </button>
                {(activeGroup.createdBy === user?.username || user?.role === "admin" || user?.role === "owner") && (
                  <button onClick={() => deleteGroup.mutate(activeGroup.id)}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors" title="Delete group">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${
                userMap[activeDMUser || ""] === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                userMap[activeDMUser || ""] === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                "bg-green-900/40 border-green-800/50 text-green-400"
              }`}>{(activeDMUser || "?")[0].toUpperCase()}</div>
              <span className={`text-sm font-bold tracking-wider font-mono ${roleColor(userMap[activeDMUser || ""])}`} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {activeDMUser}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">— Direct Message</span>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-2">
          {activeMsgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-[40px] mb-2">{activeChannel === GENERAL ? "#" : isGroup ? "👥" : "💬"}</div>
              <div className="text-sm font-bold text-muted-foreground tracking-wider">
                {activeChannel === GENERAL ? "Welcome to #general"
                  : isGroup ? `Welcome to ${activeGroup?.name}`
                  : `Start a conversation with ${activeDMUser}`}
              </div>
              <div className="text-[10px] text-muted-foreground/50 mt-1">
                {activeChannel === GENERAL ? "This is the beginning of all team comms."
                  : isGroup ? `${JSON.parse(activeGroup?.members || "[]").length} members in this group.`
                  : "Your messages are private."}
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
          placeholder={activeChannel === GENERAL ? "Message #general..."
            : isGroup ? `Message ${activeGroup?.name}...`
            : `Message ${activeDMUser}...`}
        />
      </div>
    </div>
  );
}
