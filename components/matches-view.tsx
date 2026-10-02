"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { MemberSummary } from "@/lib/supabase";
import { errorMessage, memberKey, rpc, supabase } from "@/lib/supabase";
import { Avatar, Chip, EmptyState, ScoreRing, relativeTime } from "@/components/ui";

export function MatchesView({
  onOpenProfile,
  onConnect,
}: {
  onOpenProfile: (id: string) => void;
  onConnect: (m: MemberSummary) => void;
}) {
  const [rows, setRows] = useState<MemberSummary[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await rpc<MemberSummary[]>("gc_my_matches")) ?? []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Could not load matches"));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void rpc<number>("gc_refresh_matches", { p_keep: 60 })
      .catch(() => {})
      .finally(() => void load());
  }, [load]);

  // a profile update anywhere can create a new match for me
  useEffect(() => {
    const channel = supabase
      .channel("matches-watch")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gc_members" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function dismiss(matchId: string) {
    setBusy(matchId);
    try {
      await rpc("gc_dismiss_match", { p_match: matchId });
      setRows((prev) => prev.filter((r) => r.match_id !== matchId));
    } catch (e) {
      setError(errorMessage(e, "Could not dismiss match"));
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(
    () => rows.filter((r) => Number(r.score) * 100 >= threshold),
    [rows, threshold],
  );

  const connected = visible.filter((r) => r.connection_status === "accepted");
  const pending = visible.filter((r) => r.connection_status === "pending");
  const open = visible.filter((r) => !r.connection_status);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          aria-label="Minimum match score"
          className="flex-1"
        />
        <span className="w-28 text-right text-xs text-zinc-600">
          {threshold === 0 ? "All matches" : `${threshold}% and up`}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!loaded ? (
        <div className="py-16 text-center text-sm text-zinc-500">Computing matches…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matches above this bar"
          hint="Lower the slider, or add more interests in Preferences to widen your net."
        />
      ) : (
        <div className="space-y-6">
          {connected.length > 0 && (
            <Section title="Connected" count={connected.length} tone="text-emerald-700">
              {connected.map((r) => (
                <Row
                  key={r.match_id}
                  r={r}
                  onOpen={() => r.other_id && onOpenProfile(r.other_id)}
                  action={<Chip tone="shared">✓ Connected</Chip>}
                />
              ))}
            </Section>
          )}
          {pending.length > 0 && (
            <Section title="Requests out" count={pending.length} tone="text-cyan">
              {pending.map((r) => (
                <Row
                  key={r.match_id}
                  r={r}
                  onOpen={() => r.other_id && onOpenProfile(r.other_id)}
                  action={<Chip tone="brand">Waiting</Chip>}
                />
              ))}
            </Section>
          )}
          <Section title="Suggested for you" count={open.length} tone="text-violet-700">
            <div className="grid gap-3 sm:grid-cols-2">
              {open.map((r) => (
                <Row
                  key={r.match_id}
                  r={r}
                  onOpen={() => r.other_id && onOpenProfile(r.other_id)}
                  action={
                    <>
                      <button
                        onClick={() => r.match_id && void dismiss(r.match_id)}
                        disabled={busy === r.match_id}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-zinc-600 hover:border-rose-500/50 hover:text-rose-700"
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => onConnect(r)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
                      >
                        Connect
                      </button>
                    </>
                  }
                  className="card rounded-2xl p-4"
                />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${tone}`}>
        {title} <span className="text-faint">({count})</span>
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  r,
  onOpen,
  action,
  className = "",
}: {
  r: MemberSummary;
  onOpen: () => void;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className || "card rounded-xl p-3"}`}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={r.display_name} url={r.avatar_url} size={38} online={r.is_online} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{r.display_name}</p>
          <p className="truncate text-xs text-zinc-500">
            {[r.city, r.country].filter(Boolean).join(", ") || "—"} ·{" "}
            {relativeTime(r.last_seen_at)}
          </p>
          {r.reason && <p className="truncate text-xs text-violet-700">{r.reason}</p>}
        </div>
      </button>
      {action}
      <ScoreRing score={Number(r.score)} />
      <span className="sr-only">{memberKey(r)}</span>
    </div>
  );
}