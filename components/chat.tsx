"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, MemberSummary } from "@/lib/supabase";
import { errorMessage, rpc, supabase } from "@/lib/supabase";
import { ai } from "@/lib/ai";
import { Avatar, Chip, EmptyState, relativeTime, useToast } from "@/components/ui";

export function Inbox({
  onOpenChat,
  onOpenProfile,
}: {
  onOpenChat: (id: string, name: string) => void;
  onOpenProfile: (id: string) => void;
}) {
  const [rows, setRows] = useState<MemberSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { show, node } = useToast();

  const load = useCallback(async () => {
    try {
      setRows((await rpc<MemberSummary[]>("gc_my_connections")) ?? []);
    } catch (e) {
      show(errorMessage(e, "Could not load connections"), "err");
    } finally {
      setLoaded(true);
    }
  }, [show]);

  useEffect(() => {
    const refresh = () => void load();
    const kick = setTimeout(() => void load(), 0);
    const channel = supabase
      .channel("inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gc_connections" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gc_messages" },
        refresh,
      )
      .subscribe();
    return () => {
      clearTimeout(kick);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const pending = rows.filter((r) => r.status === "pending" && r.direction === "incoming");
  const accepted = rows.filter((r) => r.status === "accepted");
  const outgoing = rows.filter((r) => r.status === "pending" && r.direction === "outgoing");

  async function respond(c: string, accept: boolean) {
    try {
      await rpc("gc_respond_request", { p_connection: c, p_accept: accept });
      show(accept ? "You're connected! Say hi 👋" : "Request declined");
      await load();
    } catch (e) {
      show(errorMessage(e, "Could not respond"), "err");
    }
  }

  return (
    <div className="space-y-6">
      {node}
      {!loaded ? (
        <div className="py-10 text-center text-sm text-zinc-500">Loading inbox…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No connections yet"
          hint="Send a request on Discover or Matches to start a conversation."
        />
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">
                Waiting for you ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map((r) => (
                  <div key={r.connection_id} className="card flex items-center gap-3 rounded-xl p-3">
                    <button
                      onClick={() => r.other_id && onOpenProfile(r.other_id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <Avatar name={r.display_name} url={r.avatar_url} size={40} online={r.is_online} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.display_name}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {r.note || "Wants to connect with you"}
                        </p>
                        <p className="text-[11px] text-zinc-500">{relativeTime(r.created_at)}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => r.connection_id && void respond(r.connection_id, false)}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-zinc-600 hover:border-rose-500/50 hover:text-rose-700"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => r.connection_id && void respond(r.connection_id, true)}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {accepted.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Chats ({accepted.length})
              </h3>
              <div className="space-y-2">
                {accepted.map((r) => (
                  <button
                    key={r.connection_id}
                    onClick={() =>
                      r.connection_id && onOpenChat(r.connection_id, r.display_name)
                    }
                    className="card flex w-full items-center gap-3 rounded-xl p-3 text-left hover:border-brand/60"
                  >
                    <Avatar name={r.display_name} url={r.avatar_url} size={42} online={r.is_online} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.display_name}</p>
                      <p className="truncate text-xs text-zinc-600">
                        {r.last_message || "Say hi to each other!"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-zinc-500">
                        {relativeTime(r.last_message_at ?? r.created_at)}
                      </p>
                      {(r.unread_count ?? 0) > 0 && (
                        <span className="mt-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                          {r.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {outgoing.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan">
                Sent ({outgoing.length})
              </h3>
              <div className="space-y-2">
                {outgoing.map((r) => (
                  <div key={r.connection_id} className="card flex items-center gap-3 rounded-xl p-3">
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar name={r.display_name} url={r.avatar_url} size={38} online={r.is_online} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.display_name}</p>
                        <p className="text-xs text-zinc-500">Request pending</p>
                      </div>
                    </div>
                    <Chip tone="brand">Pending</Chip>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function ChatDrawer({
  open,
  connectionId,
  name,
  onClose,
}: {
  open: boolean;
  connectionId: string | null;
  name: string;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { show, node } = useToast();

  const loadThread = useCallback(async (id: string) => {
    try {
      setMsgs((await rpc<ChatMessage[]>("gc_thread", { p_connection: id, p_limit: 100 })) ?? []);
    } catch (e) {
      show(errorMessage(e, "Could not load thread"), "err");
    } finally {
      setLoaded(true);
    }
  }, [show]);

  useEffect(() => {
    if (!open || !connectionId) return;
    const id = connectionId;
    const kick = setTimeout(() => void loadThread(id), 0);
    let myId: string | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      myId = data.session?.user.id ?? null;
    });

    const channel = supabase
      .channel(`thread-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gc_messages",
          filter: `connection_id=eq.${id}`,
        },
        (payload) => {
          const m = payload.new as {
            id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };
          setMsgs((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [...prev, { ...m, is_mine: m.sender_id === myId }],
          );
          // Drafted replies no longer fit once they have replied.
          if (m.sender_id !== myId) setSuggestions([]);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(kick);
      void supabase.removeChannel(channel);
    };
  }, [open, connectionId, loadThread]);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById("chat-scroll");
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, open]);

  async function suggestReplies() {
    const latest = [...msgs].reverse().find((m) => !m.is_mine);
    if (!latest) {
      show("Nothing to reply to yet", "err");
      return;
    }
    setAiBusy(true);
    try {
      const result = await ai.replies({
        message: latest.body,
        history: msgs.slice(-6).map((m) => `${m.is_mine ? "Me" : name}: ${m.body}`),
      });
      setSuggestions(result.replies);
      if (result.replies.length === 0) show("No suggestions came back", "err");
    } catch (e) {
      show(errorMessage(e, "Could not draft replies"), "err");
    } finally {
      setAiBusy(false);
    }
  }

  async function send() {
    if (!body.trim() || !connectionId) return;
    setSending(true);
    try {
      await rpc("gc_send_message", {
        p_connection: connectionId,
        p_body: body.trim(),
      });
      setBody("");
    } catch (e) {
      show(errorMessage(e, "Could not send message"), "err");
    } finally {
      setSending(false);
    }
  }

  if (!open || !connectionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {node}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full flex-col border-l border-line bg-surface shadow-2xl sm:w-[520px]">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{name}</h2>
            <p className="text-[11px] text-zinc-500">Real-time conversation</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-zinc-600 hover:border-brand/60"
          >
            Close
          </button>
        </header>

        <main id="chat-scroll" className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {!loaded ? (
            <div className="text-center text-sm text-zinc-500">Loading…</div>
          ) : msgs.length === 0 ? (
            <div className="text-center text-sm text-zinc-500">No messages yet. Say hello 👋</div>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className={`flex ${m.is_mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow ${
                    m.is_mine
                      ? "bg-gradient-to-br from-brand to-brand-2 text-white"
                      : "border border-line bg-surface-2 text-zinc-800"
                  }`}
                >
                  {m.body}
                  <p
                    className={`mt-1 text-[10px] ${m.is_mine ? "text-white/70" : "text-zinc-500"}`}
                  >
                    {relativeTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </main>

        <footer className="border-t border-line px-3 py-3">
          {suggestions.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setBody(s);
                    setSuggestions([]);
                  }}
                  className="block w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-left text-xs text-zinc-700 transition hover:border-brand/60"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => void suggestReplies()}
            disabled={aiBusy || msgs.length === 0}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand-2 transition hover:bg-brand/20 disabled:opacity-40"
          >
            <span>✦</span>
            {aiBusy ? "Drafting…" : "Suggest a reply"}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message…"
              maxLength={2000}
              aria-label="Message"
              className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              disabled={sending || !body.trim()}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}