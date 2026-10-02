"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Avatar, Chip, ScoreRing, formatDistance, relativeTime } from "@/components/ui";
import type { Interest, MemberSummary } from "@/lib/supabase";

export function MemberCard({
  member,
  interestLabels,
  onOpen,
  onRequest,
}: {
  member: MemberSummary;
  interestLabels: Record<string, string>;
  onOpen?: (m: MemberSummary) => void;
  onRequest?: (m: MemberSummary) => void;
}) {
  const status = member.connection_status;
  const shared = member.shared_interests ?? [];

  return (
    <div className="card animate-in group relative flex flex-col gap-3 rounded-2xl p-4 transition hover:border-brand/60">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onOpen?.(member)}
          className="shrink-0"
          aria-label={`View ${member.display_name}`}
        >
          <Avatar
            name={member.display_name}
            url={member.avatar_url}
            size={54}
            online={member.is_online}
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpen?.(member)}
            className="block max-w-full truncate text-left text-base font-semibold hover:text-brand"
          >
            {member.display_name}
          </button>
          <p className="truncate text-xs text-zinc-500">@{member.username}</p>
          <p className="mt-1 truncate text-xs text-zinc-600">
            {flag(member.country_code)} {member.city ? `${member.city}, ` : ""}
            {member.country ?? "somewhere on Earth"}
          </p>
        </div>
        <ScoreRing score={Number(member.score)} />
      </div>

      {member.headline && (
        <p className="line-clamp-1 text-sm text-zinc-700">{member.headline}</p>
      )}

      {member.reason && (
        <p className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs text-violet-700">
          {member.reason}
        </p>
      )}

      {shared.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shared.slice(0, 4).map((s) => (
            <Chip key={s} tone="shared">
              {interestLabels[s] ?? s}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[11px] text-zinc-500">
          {formatDistance(member.distance_km)}
          {member.languages?.length ? ` · ${member.languages[0]}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {onRequest && !status && (
            <button
              onClick={() => onRequest(member)}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-hover"
            >
              Connect
            </button>
          )}
          {status === "pending" && <Chip tone="brand">Request sent</Chip>}
          {status === "accepted" && <Chip tone="shared">✓ Connected</Chip>}
        </div>
      </div>
    </div>
  );
}

export function flag(code?: string | null): string {
  if (!code) return "🌐";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => base + c.charCodeAt(0) - 65),
  );
}

export function useInterestLabels(interests: Interest[]): Record<string, string> {
  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of interests) map[i.slug] = `${i.emoji ?? ""} ${i.label}`.trim();
    return map;
  }, [interests]);
}

export function Countdown({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card rounded-2xl px-4 py-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}

export { relativeTime };