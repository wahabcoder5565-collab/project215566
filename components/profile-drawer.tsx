"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemberDetail } from "@/lib/supabase";
import { errorMessage, rpc, supabase } from "@/lib/supabase";
import { ai } from "@/lib/ai";
import type { AiOpeners } from "@/lib/ai";
import { useApp } from "@/components/app-provider";
import { Avatar, Chip } from "@/components/ui";
import { flag } from "@/components/member-card";

export default function ProfileDrawer({
  open,
  memberId,
  onClose,
  onConnect,
}: {
  open: boolean;
  memberId: string | null;
  onClose: () => void;
  onConnect?: (id: string) => void;
}) {
  const [detail, setDetail] = useState<{ id: string; profile: MemberDetail | null } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openers, setOpeners] = useState<AiOpeners | null>(null);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [myLookingFor, setMyLookingFor] = useState<string | null>(null);
  const { me } = useApp();

  useEffect(() => {
    if (!me?.id) return;
    let active = true;
    void (async () => {
      const [slugs, prefs] = await Promise.all([
        supabase.rpc("gc_interest_slugs", { p_member: me.id }),
        supabase
          .from("gc_preferences")
          .select("looking_for")
          .eq("member_id", me.id)
          .maybeSingle(),
      ]);
      if (!active) return;
      setMyInterests((slugs.data as string[] | null) ?? []);
      setMyLookingFor((prefs.data?.looking_for as string | undefined) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [me?.id]);

  const load = useCallback(async (id: string) => {
    try {
      const profile = await rpc<MemberDetail>("gc_member_detail", { p_member: id });
      setDetail({ id, profile });
      setError(null);
    } catch (e) {
      setDetail({ id, profile: null });
      setError(errorMessage(e, "Profile unavailable"));
    }
  }, []);

  const loaded = detail?.id === memberId;
  const profile = detail?.profile ?? null;
  const shared = Array.isArray(profile?.shared) ? profile!.shared : [];

  useEffect(() => {
    if (!open || !memberId) return;
    const id = memberId;
    const kick = setTimeout(() => void load(id), 0);
    return () => clearTimeout(kick);
  }, [open, memberId, load]);

  if (!open || !memberId) return null;

  async function connect(note?: string) {
    if (!memberId) return;
    setBusy(true);
    try {
      await rpc("gc_send_request", {
        p_target: memberId,
        p_note: note ?? null,
        p_match_id: null,
      });
      onConnect?.(memberId);
    } catch (e) {
      setError(errorMessage(e, "Could not send request"));
    } finally {
      setBusy(false);
    }
  }

  async function suggestOpeners() {
    if (!profile) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await ai.openers({
        interests: profile.interests.map((i) => i.slug),
        city: profile.city,
        country: profile.country,
        bio: profile.bio,
        shared: shared,
        my_interests: myInterests,
        my_city: me?.city ?? null,
        looking_for: myLookingFor,
      });
      setOpeners(result);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not suggest openers");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full flex-col border-l border-line bg-surface shadow-2xl sm:w-[560px]">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Profile</h2>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-zinc-600 hover:border-brand/60"
          >
            Close
          </button>
        </header>

        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
          {!loaded ? (
            <div className="py-12 text-center text-sm text-zinc-500">Loading profile…</div>
          ) : error || !profile ? (
            <div className="py-12 text-center text-sm text-zinc-500">{error ?? "Not found"}</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <Avatar
                  name={profile.display_name}
                  url={profile.avatar_url}
                  size={72}
                  online={profile.is_online}
                />
                <div className="flex-1">
                  <h1 className="text-xl font-bold">{profile.display_name}</h1>
                  <p className="text-sm text-zinc-500">@{profile.username}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {flag(profile.country_code)} {profile.city ? `${profile.city}, ` : ""}
                    {profile.country ?? "Somewhere"}
                    {profile.age ? ` · ${profile.age} years` : ""}
                  </p>
                  {profile.headline && (
                    <p className="mt-2 text-sm text-zinc-700">{profile.headline}</p>
                  )}
                  {profile.looking_for && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-brand-2">
                      Looking for {profile.looking_for.replace("_", " ")}
                    </p>
                  )}
                </div>
              </div>

              {profile.bio && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    About
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                    {profile.bio}
                  </p>
                </div>
              )}

              {profile.interests.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Interests
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((i) => (
                      <Chip key={i.slug}>
                        {i.emoji} {i.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Languages
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.languages.map((l) => (
                      <Chip key={l}>{l}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {profile.phone && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Contact
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${profile.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-zinc-700 hover:border-brand/60"
                    >
                      <span>📞</span>
                      {profile.phone}
                    </a>
                    {profile.has_whatsapp && (
                      <a
                        href={`https://wa.me/${profile.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-500/20"
                      >
                        <span>💬</span>
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}

              {shared.length > 0 && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                  You both share: {shared.slice(0, 6).join(", ")}
                </div>
              )}

              {onConnect && (
                <div>
                  {!openers ? (
                    <button
                      onClick={() => void suggestOpeners()}
                      disabled={aiBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-medium text-brand-2 transition hover:bg-brand/20 disabled:opacity-50"
                    >
                      <span>✦</span>
                      {aiBusy ? "Thinking…" : "Suggest a way to say hello"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-2">
                        Openers for {profile.display_name}
                      </h3>
                      {openers.hook && (
                        <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-zinc-600">
                          {openers.hook}
                        </p>
                      )}
                      {openers.openers.map((o) => (
                        <div
                          key={o}
                          className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
                        >
                          <p className="flex-1 text-xs leading-relaxed text-zinc-800">{o}</p>
                          <button
                            onClick={() => void connect(o)}
                            disabled={busy}
                            className="shrink-0 rounded-md border border-brand/60 px-2 py-1 text-[11px] font-medium text-brand-2 transition hover:bg-brand/20 disabled:opacity-50"
                          >
                            Use this
                          </button>
                        </div>
                      ))}
                      {openers.openers.length === 0 && (
                        <p className="text-xs text-zinc-500">
                          No openers came back. Try the plain request instead.
                        </p>
                      )}
                      {aiError && <p className="text-xs text-rose-700">{aiError}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {onConnect && (
          <footer className="flex gap-2 border-t border-line px-4 py-3">
            <button
              onClick={() => void connect()}
              disabled={busy}
              className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand-2 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send connection request"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}