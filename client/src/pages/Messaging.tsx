import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { Send, Hash, MessageSquare, Users, Trash2, Crown, ShieldCheck, User as UserIcon, Search, Plus, LogOut, UserPlus, X, Paperclip, Download, ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ProfileLink } from "@/components/ProfileLink";
import type { Message, GroupChat } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const GENERAL = "GENERAL";

// ── Role icon helper ────────────────────────────────────────────
function RoleIcon({ role }: { role?: string }) {
  if (role === "owner") return <Crown size={9} className="text-orange-400 shrink-0" />;
  if (role === "admin") return <ShieldCheck size={9} className="text-yellow-400 shrink-0" />;
  return <UserIcon size={9} className="text-blue-400 shrink-0" />;
}

function roleColor(role?: string) {
  if (role === "owner") return "text-orange-400";
  if (role === "admin") return "text-yellow-400";
  return "text-blue-400";
}

/** Highlight @username for known roster members (matches server ping parsing). */
function formatMessageContent(raw: string, knownUsers: Set<string>): ReactNode {
  if (!raw || raw === "[message deleted]") return raw;
  const re = /@([A-Za-z0-9_-]{2,48})/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) parts.push(raw.slice(last, m.index));
    const name = m[1];
    const known = knownUsers.has(name);
    parts.push(
      known ? (
        <Link
          key={`${m.index}-${name}`}
          href={`/profile/${encodeURIComponent(name)}`}
          className="font-semibold text-amber-400/95 bg-amber-500/15 rounded px-0.5 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          @{name}
        </Link>
      ) : (
        <span key={`${m.index}-${name}`} className="text-muted-foreground">
          @{name}
        </span>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return parts.length > 0 ? <>{parts}</> : raw;
}

// ── Single message bubble ────────────────────────────────────────
// ── Delete confirm button ────────────────────────────────────────
function DeleteConfirmBtn({ onConfirm, isOwnMessage }: { onConfirm: () => void; isOwnMessage: boolean }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="absolute -top-7 -right-1 flex items-center gap-1 bg-card border border-red-800/60 rounded px-2 py-1 shadow-xl z-50">
        <span className="text-[9px] text-red-400 tracking-wider whitespace-nowrap">DELETE?</span>
        <button onClick={() => { onConfirm(); setConfirming(false); }}
          className="text-[9px] bg-red-900 hover:bg-red-800 text-red-200 px-1.5 py-0.5 rounded tracking-wider">YES</button>
        <button onClick={() => setConfirming(false)}
          className="text-[9px] text-muted-foreground hover:text-foreground px-1">NO</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)}
      title={isOwnMessage ? "Delete your message" : "Delete message (moderator)"}
      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-900/70 border border-red-700/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-800">
      <Trash2 size={8} className="text-red-300" />
    </button>
  );
}

function MsgBubble({ msg, isMe, onDelete, canDelete, userMap, knownUsers }: {
  msg: Message; isMe: boolean; onDelete: (id: number) => void;
  canDelete: boolean; userMap: Record<string, string>;
  knownUsers: Set<string>;
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
        "bg-blue-900/40 border-blue-800/50 text-blue-400"
      }`}>
        {msg.fromUsername[0].toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={cn("flex-1 min-w-0 max-w-[88%] sm:max-w-[75%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
        <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
          <Link
            href={`/profile/${encodeURIComponent(msg.fromUsername)}`}
            className={`text-[10px] font-bold font-mono tracking-wider ${roleColor(role)} hover:underline`}
          >
            {msg.fromUsername}
          </Link>
          <RoleIcon role={role} />
          <span className="text-[9px] text-muted-foreground/50">{time}</span>
        </div>
        <div className={`relative rounded px-2.5 py-1.5 text-xs leading-relaxed max-w-full break-words ${
          deleted ? "italic text-muted-foreground/50 bg-secondary/30" :
          isMe ? "bg-blue-900/40 border border-blue-800/30 text-foreground" :
          "bg-secondary border border-border text-foreground"
        }`}>
          {deleted ? msg.content : formatMessageContent(msg.content, knownUsers)}
            {/* Attachment */}
          {msg.attachment && (() => {
            try {
              const att: Attachment = JSON.parse(msg.attachment);
              if (att.mimeType?.startsWith("image/")) return (
                <a href={att.url} target="_blank" rel="noreferrer" className="block mt-1.5">
                  <img src={att.url} alt={att.originalName} className="max-h-48 max-w-xs rounded border border-border object-cover hover:opacity-90 transition-opacity" />
                </a>
              );
              return (
                <a href={att.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 mt-1.5 bg-secondary border border-border rounded px-2 py-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors max-w-xs">
                  <Paperclip size={9} />
                  <span className="truncate">{att.originalName}</span>
                  <Download size={9} className="ml-auto shrink-0" />
                </a>
              );
            } catch { return null; }
          })()}
          {/* Delete button — requires second click to confirm */}
          {!deleted && canDelete && hovered && (
            <DeleteConfirmBtn onConfirm={() => onDelete(msg.id)} isOwnMessage={isMe} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message input ────────────────────────────────────────────────
interface Attachment { url: string; originalName: string; mimeType: string; }

function MessageInput({ onSend, placeholder, mentionCandidates = [] }: {
  onSend: (text: string, attachment?: Attachment) => void;
  placeholder: string;
  /** Usernames for @ autocomplete + ping */
  mentionCandidates?: string[];
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionMatch = text.match(/@([\w-]*)$/);
  const mentionPrefix = mentionMatch ? mentionMatch[1].toLowerCase() : "";
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch || mentionCandidates.length === 0) return [];
    return mentionCandidates
      .filter((u) => u.toLowerCase().startsWith(mentionPrefix))
      .slice(0, 8);
  }, [mentionMatch, mentionPrefix, mentionCandidates]);

  useEffect(() => {
    setMentionHighlight(0);
  }, [mentionPrefix, mentionSuggestions.length]);

  const insertMention = (username: string) => {
    setText((t) => t.replace(/@([\w-]*)$/, `@${username} `));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pending) return;
    onSend(text.trim(), pending ?? undefined);
    setText(""); setPending(null);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      setPending(await res.json());
    } catch { /* silently fail */ }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionHighlight((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionHighlight((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
    } else if (e.key === "Tab" && mentionSuggestions.length > 0 && mentionMatch) {
      e.preventDefault();
      insertMention(mentionSuggestions[mentionHighlight]!);
    } else if (e.key === "Escape" && mentionMatch) {
      setText((t) => t.replace(/@([\w-]*)$/, ""));
    }
  };

  return (
    <div className="border-t border-border bg-card/50 relative">
      {mentionSuggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 mx-4 max-h-36 overflow-y-auto rounded border border-border bg-card shadow-lg z-50 py-1">
          <div className="text-[8px] text-muted-foreground px-2 py-0.5 tracking-wider">@ PING USER</div>
          {mentionSuggestions.map((u, i) => (
            <button
              key={u}
              type="button"
              className={`w-full text-left px-2 py-1.5 text-xs font-mono touch-manipulation ${
                i === mentionHighlight ? "bg-blue-950/70 text-blue-300" : "hover:bg-secondary"
              }`}
              onMouseDown={(ev) => {
                ev.preventDefault();
                insertMention(u);
              }}
            >
              @{u}
            </button>
          ))}
        </div>
      )}
      {pending && (
        <div className="flex items-center gap-2 px-4 pt-2">
          {pending.mimeType?.startsWith("image/") ? (
            <div className="relative">
              <img src={pending.url} className="h-16 rounded border border-border object-cover" alt={pending.originalName} />
              <button onClick={() => setPending(null)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-900 rounded-full flex items-center justify-center"><X size={8} className="text-white" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-secondary border border-border rounded px-2 py-1 text-[10px]">
              <Paperclip size={9} className="text-muted-foreground" />
              <span className="text-blue-400 max-w-[200px] truncate">{pending.originalName}</span>
              <button onClick={() => setPending(null)} className="text-muted-foreground hover:text-red-400 ml-1"><X size={9} /></button>
            </div>
          )}
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2 px-4 py-3 items-center">
        <label className={`p-1.5 rounded cursor-pointer transition-colors ${uploading ? "text-muted-foreground/30" : "text-muted-foreground hover:text-blue-400"}`} title="Attach image or file">
          <Paperclip size={13} />
          <input ref={fileRef} type="file" className="hidden" disabled={uploading}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-secondary border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-700"
          data-testid="input-message-text"
          autoComplete="off"
          autoCorrect="off"
        />
        <button type="submit" disabled={!text.trim() && !pending}
          className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 disabled:opacity-40 rounded text-blue-100 text-xs transition-colors flex items-center gap-1 touch-manipulation"
          data-testid="button-send-message">
          <Send size={11} />
        </button>
      </form>
      <div className="px-4 pb-2 text-[9px] text-muted-foreground/60 tracking-wide">
        <span className="font-mono text-amber-500/80">@User</span> pings them (toast + live unread). <span className="text-muted-foreground/80">Tab</span> inserts highlighted name.
      </div>
    </div>
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
        <button className="text-[9px] text-blue-400/60 hover:text-blue-400 flex items-center gap-1 tracking-wider transition-colors">
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
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-700 uppercase tracking-wider" />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-2">ADD MEMBERS ({selected.length} selected)</label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {others.map(u => (
                <button key={u.username} type="button" onClick={() => toggle(u.username)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                    selected.includes(u.username)
                      ? "bg-blue-950/60 border border-blue-800/50"
                      : "hover:bg-secondary"
                  }`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] ${
                    selected.includes(u.username) ? "bg-blue-700 border-blue-600" : "border-border"
                  }`}>
                    {selected.includes(u.username) && "✓"}
                  </div>
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${
                    u.role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                    u.role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                    "bg-blue-900/40 border-blue-800/50 text-blue-400"
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
              className="text-xs bg-blue-800 hover:bg-blue-700">CREATE</Button>
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
        <button className="p-1 text-muted-foreground hover:text-blue-400 transition-colors" title="Add member">
          <UserPlus size={10} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle className="text-xs tracking-widest">ADD TO {group.name.toUpperCase()}</DialogTitle></DialogHeader>
        <div className="space-y-1">
          {nonMembers.map(u => (
            <button key={u.username} type="button" onClick={() => add.mutate(u.username)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-secondary text-left transition-colors">
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${
                u.role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                u.role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                "bg-blue-900/40 border-blue-800/50 text-blue-400"
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
  const isMobile = useIsMobile();
  // activeChannel: "GENERAL" | "DM:username" | "GROUP:id"
  const [activeChannel, setActiveChannel] = useState<string>(GENERAL);
  /** Portrait: Discord-style — full-width channel list OR full-width chat (not side-by-side). */
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const goToChannel = (channel: string) => {
    setActiveChannel(channel);
    if (isMobile) setMobileListOpen(false);
  };

  const isGroup = activeChannel.startsWith("GROUP:");
  const isDM = activeChannel.startsWith("DM:") || (!activeChannel.startsWith("GROUP:") && activeChannel !== GENERAL);
  const activeGroupId = isGroup ? Number(activeChannel.split(":")[1]) : null;
  const activeDMUser = isDM ? activeChannel.replace("DM:", "") : null;

  // Roster for DMs, roles, @mentions (any logged-in user — not admin-only /api/users)
  const { data: allUsers = [] } = useQuery<{ id: number; username: string; role: string }[]>({
    queryKey: ["/api/users/directory"],
    queryFn: () => apiRequest("GET", "/api/users/directory"),
  });

  // Build username->role map
  const userMap = Object.fromEntries(allUsers.map(u => [u.username, u.role]));
  // Add self
  if (user) userMap[user.username] = user.accessLevel;

  const knownUsernames = useMemo(
    () => new Set(allUsers.map((u) => u.username)),
    [allUsers],
  );

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

  // Real-time updates are handled by the global WSProvider in App.tsx.
  // No local WebSocket connection needed here.

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [activeChannel]);

  const onMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 120;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generalMsgs, dmMsgs, groupMsgs, activeChannel]);

  // Send general
  const sendGeneral = useMutation({
    mutationFn: ({ text, attachment }: { text: string; attachment?: string }) =>
      apiRequest("POST", "/api/messages/general", { content: text, attachment }),
    onSuccess: () => refetchGeneral(),
  });
  // Send DM
  const sendDM = useMutation({
    mutationFn: ({ text, attachment }: { text: string; attachment?: string }) =>
      apiRequest("POST", `/api/messages/dm/${activeDMUser}`, { content: text, attachment }),
    onSuccess: () => { refetchDM(); refetchDMList(); },
  });
  // Send group message
  const sendGroup = useMutation({
    mutationFn: ({ text, attachment }: { text: string; attachment?: string }) =>
      apiRequest("POST", `/api/groups/${activeGroupId}/messages`, { content: text, attachment }),
    onSuccess: () => refetchGroupMsgs(),
  });
  // Leave group
  const leaveGroup = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/groups/${id}/members/me`),
    onSuccess: () => { refetchGroups(); goToChannel(GENERAL); },
  });
  // Delete group
  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/groups/${id}`),
    onSuccess: () => { refetchGroups(); goToChannel(GENERAL); },
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
  const handleSend = (text: string, attachment?: Attachment) => {
    stickToBottomRef.current = true;
    const attStr = attachment ? JSON.stringify(attachment) : "";
    if (activeChannel === GENERAL) sendGeneral.mutate({ text, attachment: attStr });
    else if (isGroup) sendGroup.mutate({ text, attachment: attStr });
    else sendDM.mutate({ text, attachment: attStr });
  };

  const canDelete = (msg: Message) =>
    msg.fromUsername === user?.username ||
    (user?.accessLevel === "admin" || user?.accessLevel === "owner");

  const otherUsers = allUsers.filter(u => u.username !== user?.username);
  const filteredUsers = dmSearch
    ? otherUsers.filter(u => u.username.toLowerCase().includes(dmSearch.toLowerCase()))
    : otherUsers;

  const getDMUnread = (username: string) =>
    dmList.find(d => d.username === username)?.unread || 0;

  const openDM = (username: string) => goToChannel(`DM:${username}`);
  const openGroup = (id: number) => goToChannel(`GROUP:${id}`);

  return (
    <div
      className={cn(
        "flex w-full min-h-0 overflow-hidden",
        /* Match useIsMobile (incl. landscape phones): reserve top bar + bottom tabs + safe areas. */
        isMobile
          ? "h-[calc(100dvh-7.25rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]"
          : "h-[min(100dvh,calc(100vh-2.5rem))] min-h-[28rem]",
      )}
    >

      {/* ── Channel sidebar ─────────────────────────────────── */}
      <div
        className={cn(
          "border-r border-border bg-card shrink-0 min-h-0 flex flex-col",
          isMobile
            ? mobileListOpen
              ? "flex-1 w-full min-w-0"
              : "hidden"
            : "w-56",
        )}
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={13} className="text-blue-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-blue-400">SECURE COMMS</span>
          </div>
        </div>

        {/* General */}
        <div className="px-2 pt-3 pb-1">
          <div className="text-[9px] text-muted-foreground/50 tracking-widest px-2 mb-1">CHANNELS</div>
          <button
            onClick={() => goToChannel(GENERAL)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all ${
              activeChannel === GENERAL
                ? "bg-blue-950/60 text-blue-400 border border-blue-900/50"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            data-testid="channel-general"
          >
            <div className="flex items-center gap-2">
              <Hash size={12} />
              <span className="tracking-wider">general</span>
            </div>
            {unread.general > 0 && activeChannel !== GENERAL && (
              <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] text-center">
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
                  isActive ? "bg-blue-950/60 border border-blue-900/50" : "hover:bg-secondary"
                }`}>
                <div className="w-5 h-5 rounded bg-blue-900/40 border border-blue-800/50 flex items-center justify-center shrink-0">
                  <Users size={9} className="text-blue-400" />
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
              className="w-full bg-secondary border border-border rounded pl-6 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-800"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-0.5">
            {filteredUsers.map(u => {
              const unreadCount = getDMUnread(u.username);
              const isActive = activeChannel === `DM:${u.username}` || activeChannel === u.username;
              const lastDM = dmList.find(d => d.username === u.username);
              return (
                <div
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDM(u.username)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDM(u.username);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all cursor-pointer ${
                    isActive ? "bg-blue-950/60 border border-blue-900/50" : "hover:bg-secondary"
                  }`}
                  data-testid={`dm-user-${u.username}`}
                >
                  <div className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-[9px] font-bold border ${
                    u.role === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                    u.role === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                    "bg-blue-900/40 border-blue-800/50 text-blue-400"
                  }`}>{u.username[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-mono font-bold truncate ${roleColor(u.role)}`}>
                      <ProfileLink username={u.username} className={roleColor(u.role)}>
                        {u.username}
                      </ProfileLink>
                    </div>
                    {lastDM && (
                      <div className="text-[9px] text-muted-foreground/50 truncate">{lastDM.lastMessage}</div>
                    )}
                  </div>
                  {unreadCount > 0 && !isActive && (
                    <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] text-center shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </div>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="text-[10px] text-muted-foreground/50 text-center py-3">No users found</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main chat area ───────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-0",
          isMobile && mobileListOpen && "hidden",
          isMobile && !mobileListOpen && "flex w-full",
        )}
      >
        {/* Channel header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-border bg-card/30 shrink-0">
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileListOpen(true)}
              className="p-2 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 shrink-0 touch-manipulation"
              aria-label="Back to channels"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
          )}
          {activeChannel === GENERAL ? (
            <>
              <Hash size={14} className="text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold tracking-wider text-blue-400 block truncate" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>general</span>
                <span className="text-[9px] text-muted-foreground hidden sm:block">All members can see this channel</span>
              </div>
            </>
          ) : isGroup && activeGroup ? (
            <>
              <Users size={14} className="text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold tracking-wider text-blue-400 font-mono block truncate" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{activeGroup.name}</span>
                <span className="text-[9px] text-muted-foreground truncate hidden md:block">
                  {(JSON.parse(activeGroup.members || "[]") as string[]).map((name, i) => (
                    <span key={name}>
                      {i > 0 ? ", " : null}
                      <ProfileLink username={name} className="text-muted-foreground hover:text-foreground">
                        {name}
                      </ProfileLink>
                    </span>
                  ))}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <AddMemberDialog group={activeGroup} allUsers={allUsers} currentUser={user?.username || ""} />
                <button onClick={() => leaveGroup.mutate(activeGroup.id)}
                  className="p-1 text-muted-foreground hover:text-yellow-400 transition-colors" title="Leave group">
                  <LogOut size={11} />
                </button>
                {(activeGroup.createdBy === user?.username || user?.accessLevel === "admin" || user?.accessLevel === "owner") && (
                  <button onClick={() => deleteGroup.mutate(activeGroup.id)}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors" title="Delete group">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                userMap[activeDMUser || ""] === "owner" ? "bg-orange-900/40 border-orange-800/50 text-orange-400" :
                userMap[activeDMUser || ""] === "admin" ? "bg-yellow-900/40 border-yellow-800/50 text-yellow-400" :
                "bg-blue-900/40 border-blue-800/50 text-blue-400"
              }`}>{(activeDMUser || "?")[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-bold tracking-wider font-mono truncate block ${roleColor(userMap[activeDMUser || ""])}`} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  <ProfileLink
                    username={activeDMUser || undefined}
                    className={`block truncate max-w-full ${roleColor(userMap[activeDMUser || ""])}`}
                  >
                    {activeDMUser}
                  </ProfileLink>
                </span>
                <span className="text-[9px] text-muted-foreground hidden sm:inline">Direct message</span>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          onScroll={onMessagesScroll}
          className="flex-1 min-h-0 overflow-y-auto py-2 tac-messages-scroll"
        >
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
                  knownUsers={knownUsernames}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          mentionCandidates={allUsers.map((u) => u.username)}
          placeholder={
            activeChannel === GENERAL
              ? "Message #general… (@User to ping)"
              : isGroup
                ? `Message ${activeGroup?.name}… (@User to ping)`
                : `Message ${activeDMUser}…`
          }
        />
      </div>
    </div>
  );
}
