"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function Avatar({
  name,
  url,
  size = 48,
  online,
  ring,
}: {
  name: string;
  url?: string | null;
  size?: number;
  online?: boolean;
  ring?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // deterministic hue so each member keeps a stable colour
  const hue = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
          style={ring ? { boxShadow: `0 0 0 2px hsl(${hue} 90% 60%)` } : undefined}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 60) % 360} 80% 45%))`,
            fontSize: size * 0.36,
          }}
        >
          {initials || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-surface ${
            online ? "bg-ok online-dot" : "bg-zinc-500"
          }`}
          style={{ width: size * 0.26, height: size * 0.26 }}
          title={online ? "Online now" : "Offline"}
        />
      )}
    </div>
  );
}

export function Chip({
  children,
  active,
  onClick,
  tone = "default",
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "shared" | "brand";
  title?: string;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition";
  const styles = active
    ? "border-brand bg-brand text-white"
    : tone === "shared"
      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700"
      : tone === "brand"
        ? "border-brand-2/50 bg-brand-2/10 text-brand-2"
        : "border-line bg-surface-2 text-zinc-700 hover:border-brand/60";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className={`${base} ${styles}`} onClick={onClick} title={title}>
      {children}
    </Tag>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, Number(score) || 0)) * 100);
  // Read from the theme so the ring stays legible if the palette changes.
  const color =
    pct >= 75
      ? "var(--ok)"
      : pct >= 50
        ? "var(--brand-2)"
        : pct >= 30
          ? "#8b5cf6"
          : "#8b90a8";
  return (
    <div
      className="flex items-center gap-1.5 text-xs font-semibold"
      style={{ color }}
      title={`${pct}% match`}
    >
      <svg width="30" height="30" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
        />
      </svg>
      {pct}%
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label ?? "Loading…"}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card animate-in rounded-2xl p-10 text-center">
      <div className="text-3xl">🌍</div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const node = toast ? (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`animate-in rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${
          toast.tone === "ok"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700"
            : "border-rose-500/40 bg-rose-500/15 text-rose-700"
        }`}
      >
        {toast.msg}
      </div>
    </div>
  ) : null;

  return { show, node };
}

export function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDistance(km?: number | null) {
  if (km === null || km === undefined) return "distance unknown";
  if (km < 1) return "under 1 km away";
  if (km < 1000) return `${Math.round(km)} km away`;
  return `${(km / 1000).toFixed(1)}k km away`;
}