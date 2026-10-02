"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemberSummary } from "@/lib/supabase";
import { errorMessage, memberKey, rpc, supabase } from "@/lib/supabase";
import { Avatar, EmptyState, relativeTime, useToast } from "@/components/ui";
import { MemberCard, useInterestLabels } from "@/components/member-card";
import { useApp } from "@/components/app-provider";

export function Discovery({
  onOpenProfile,
  onOpenChat,
}: {
  onOpenProfile: (id: string) => void;
  onOpenChat: (connectionId: string, name: string) => void;
}) {
  const { me, interests } = useApp();
  const { show, node } = useToast();
  const [rows, setRows] = useState<MemberSummary[]>([]);
  const [query, setQuery] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [sort, setSort] = useState<"best" | "near" | "new">("best");
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interestLabels = useInterestLabels(interests);

  const fetchDiscover = useCallback(async (q: string) => {
    try {
      const data = await rpc<MemberSummary[]>("gc_discover", {
        p_limit: 80,
        p_query: q,
      });
      setRows(data ?? []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Could not load discovery"));
    } finally {
      setLoaded(true);
    }
  }, []);

  // initial load + debounced search (async state updates only)
  useEffect(() => {
    const timer = setTimeout(() => void fetchDiscover(query), 250);
    return () => clearTimeout(timer);
  }, [fetchDiscover, query]);

  // warm the persisted match cache
  useEffect(() => {
    void rpc<number>("gc_refresh_matches", { p_keep: 60 }).catch(() => {});
  }, []);

  // live presence
  useEffect(() => {
    const channel = supabase
      .channel("presence")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gc_members" },
        (payload) => {
          const next = payload.new as { id: string; is_online?: boolean; last_seen_at?: string };
          setRows((prev) =>
            prev.map((r) =>
              memberKey(r) === next.id
                ? {
                    ...r,
                    is_online: next.is_online ?? r.is_online,
                    last_seen_at: next.last_seen_at ?? r.last_seen_at,
                  }
                : r,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function sendRequest(m: MemberSummary) {
    const id = memberKey(m);
    try {
      await rpc("gc_send_request", { p_target: id, p_note: null, p_match_id: null });
      show(`Request sent to ${m.display_name} ✉️`);
      setRows((prev) =>
        prev.map((r) =>
          memberKey(r) === id ? { ...r, connection_status: "pending" } : r,
        ),
      );
    } catch (e) {
      show(errorMessage(e, "Could not send request"), "err");
    }
  }

  const visible = useMemo(() => {
    const list = rows.filter((r) => (onlyOnline ? r.is_online : true));
    if (sort === "near")
      return [...list].sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
    if (sort === "new")
      return [...list].sort(
        (a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at),
      );
    return list;
  }, [rows, onlyOnline, sort]);

  return (
    <div>
      {node}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
          placeholder="Search people, places or interests…"
          aria-label="Search the community"
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={() => setOnlyOnline((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            onlyOnline
              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700"
              : "border-line bg-surface-2 text-zinc-700 hover:border-brand/60"
          }`}
        >
          ● Online only
        </button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort results"
          className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-xs text-zinc-700"
        >
          <option value="best">Best match</option>
          <option value="near">Closest</option>
          <option value="new">Recently active</option>
        </select>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!loaded ? (
        <div className="py-16 text-center text-sm text-zinc-500">Scanning the globe…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nobody matches yet"
          hint="Loosen your filters in Preferences, or pick a couple more interests so the engine has something to work with."
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-500">
            {visible.length} people ranked for you
            {me ? ` · starting from ${me.city ?? me.country ?? "your profile"}` : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.slice(offset, offset + 18).map((m) => (
              <MemberCard
                key={memberKey(m)}
                member={m}
                interestLabels={interestLabels}
                onOpen={(x) => onOpenProfile(memberKey(x))}
                onRequest={sendRequest}
              />
            ))}
          </div>
          {offset + 18 < visible.length && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setOffset((o) => o + 18)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-zinc-700 hover:border-brand/60"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}

      <aside className="pointer-events-none fixed bottom-4 right-4 hidden xl:block">
        <ConnectionActivity onOpenChat={onOpenChat} />
      </aside>
    </div>
  );
}

/** live panel: incoming requests + unread, kept fresh by realtime */
function ConnectionActivity({
  onOpenChat,
}: {
  onOpenChat: (id: string, name: string) => void;
}) {
  const [rows, setRows] = useState<MemberSummary[]>([]);

  const reload = useCallback(async () => {
    try {
      setRows((await rpc<MemberSummary[]>("gc_my_connections")) ?? []);
    } catch {
      /* panel is best-effort */
    }
  }, []);

  useEffect(() => {
    const refresh = () => void reload();
    const kick = setTimeout(() => void reload(), 0);
    const channel = supabase
      .channel("conn-activity")
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
  }, [reload]);

  const pending = rows.filter((r) => r.status === "pending" && r.direction === "incoming");
  const unread = rows.filter((r) => (r.unread_count ?? 0) > 0);
  if (!pending.length && !unread.length) return null;

  return (
    <div className="card pointer-events-auto w-64 space-y-1.5 rounded-2xl p-3 shadow-2xl shadow-black/50">
      {pending.map((r) => (
        <button
          key={r.connection_id}
          onClick={() => r.connection_id && onOpenChat(r.connection_id, r.display_name)}
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2"
        >
          <Avatar name={r.display_name} url={r.avatar_url} size={28} online={r.is_online} />
          <span className="flex-1 truncate text-xs text-zinc-700">
            {r.display_name} wants to connect
          </span>
          <span className="text-[10px] text-brand">{relativeTime(r.created_at)}</span>
        </button>
      ))}
      {unread.map((r) => (
        <button
          key={`u-${r.connection_id}`}
          onClick={() => r.connection_id && onOpenChat(r.connection_id, r.display_name)}
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
            {r.unread_count}
          </span>
          <span className="flex-1 truncate text-xs text-zinc-700">
            New message from {r.display_name}
          </span>
        </button>
      ))}
    </div>
  );
}