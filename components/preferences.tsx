"use client";

import { useCallback, useEffect, useState } from "react";
import type { Preferences } from "@/lib/supabase";
import { errorMessage, supabase } from "@/lib/supabase";
import { ai } from "@/lib/ai";
import type { AiReview } from "@/lib/ai";
import { useApp } from "@/components/app-provider";
import { Chip } from "@/components/ui";

const COUNTRIES: [string, string][] = [
  ["", "Anywhere"],
  ["PT", "Portugal"],
  ["ES", "Spain"],
  ["GB", "UK"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["SE", "Sweden"],
  ["NO", "Norway"],
  ["IS", "Iceland"],
  ["US", "USA"],
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["BR", "Brazil"],
  ["AR", "Argentina"],
  ["PE", "Peru"],
  ["KE", "Kenya"],
  ["MA", "Morocco"],
  ["ZA", "South Africa"],
  ["IN", "India"],
  ["TR", "Turkey"],
  ["TH", "Thailand"],
  ["VN", "Vietnam"],
  ["ID", "Indonesia"],
  ["JP", "Japan"],
  ["KR", "Korea"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
];

const LOOKING = [
  ["friendship", "Friendship"],
  ["networking", "Networking"],
  ["language_exchange", "Language exchange"],
  ["travel_buddy", "Travel buddy"],
  ["any", "Anything"],
] as const;

const GENDERS: [string, string][] = [
  ["female", "Woman"],
  ["male", "Man"],
  ["non_binary", "Non-binary"],
  ["other", "Other"],
];

export function Preferences() {
  const { me, interests, refreshMe } = useApp();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<AiReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function runReview() {
    if (!me) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const result = await ai.review({
        display_name: me.display_name,
        headline: me.headline,
        bio: me.bio,
        interests: myInterests,
      });
      setReview(result);
    } catch (e) {
      setReviewError(errorMessage(e, "Could not review your profile"));
    } finally {
      setReviewing(false);
    }
  }

  const memberId = me?.id ?? null;

  const load = useCallback(async () => {
    if (!memberId) return;
    try {
      const { data: p } = await supabase
        .from("gc_preferences")
        .select("*")
        .eq("member_id", memberId)
        .maybeSingle();
      if (p) setPrefs(p as Preferences);
      const slugs = await supabase.rpc("gc_interest_slugs", { p_member: memberId });
      setMyInterests((slugs.data as string[]) ?? []);
    } catch (e) {
      setError(errorMessage(e, "Could not load preferences"));
    } finally {
      setLoaded(true);
    }
  }, [memberId]);

  useEffect(() => {
    const kick = setTimeout(() => void load(), 0);
    return () => clearTimeout(kick);
  }, [load]);

  const patch = (next: Partial<Preferences>) =>
    setPrefs((p) => (p ? { ...p, ...next } : p));

  function toggleIn(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function save() {
    if (!me?.id || !prefs) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from("gc_preferences")
        .update({
          looking_for: prefs.looking_for,
          min_age: prefs.min_age,
          max_age: prefs.max_age,
          preferred_genders: prefs.preferred_genders,
          preferred_countries: prefs.preferred_countries,
          max_distance_km: prefs.max_distance_km,
          min_shared_interests: prefs.min_shared_interests,
          interested_in_slugs: myInterests,
        })
        .eq("member_id", me.id);
      if (updErr) throw updErr;

      const idBySlug = new Map(interests.map((i) => [i.slug, i.id]));
      const { error: delErr } = await supabase
        .from("gc_member_interests")
        .delete()
        .eq("member_id", me.id);
      if (delErr) throw delErr;

      const rows = myInterests
        .filter((s) => idBySlug.has(s))
        .map((s) => ({ member_id: me.id, interest_id: idBySlug.get(s)! }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from("gc_member_interests")
          .insert(rows);
        if (insErr) throw insErr;
      }

      await refreshMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(errorMessage(e, "Could not save preferences"));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="text-sm text-zinc-500">Loading preferences…</div>;
  if (!prefs) {
    return (
      <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
        {error ?? "No preference row found for your account."}
      </p>
    );
  }

  const countryFilterActive = (cc: string) =>
    cc === ""
      ? prefs.preferred_countries.length === 0
      : prefs.preferred_countries.includes(cc);

  return (
    <div className="card rounded-2xl p-6">
      <h2 className="mb-1 text-lg font-semibold">Matching preferences</h2>
      <p className="mb-4 text-xs text-zinc-500">
        These drive the ranking on Discover and Matches.
      </p>

      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Looking for
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {LOOKING.map(([v, label]) => (
              <Chip
                key={v}
                active={prefs.looking_for === v}
                onClick={() => patch({ looking_for: v })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-600">Min age: {prefs.min_age}</label>
            <input
              type="range"
              min={18}
              max={80}
              value={prefs.min_age}
              onChange={(e) => patch({ min_age: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">Max age: {prefs.max_age}</label>
            <input
              type="range"
              min={19}
              max={99}
              value={prefs.max_age}
              onChange={(e) => patch({ max_age: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </section>

        <section>
          <label className="mb-1 block text-xs text-zinc-600">
            Max distance: {prefs.max_distance_km.toLocaleString()} km
          </label>
          <input
            type="range"
            min={50}
            max={20000}
            step={50}
            value={prefs.max_distance_km}
            onChange={(e) => patch({ max_distance_km: Number(e.target.value) })}
            className="w-full"
          />
        </section>

        <section>
          <label className="mb-1 block text-xs text-zinc-600">
            Min shared interests: {prefs.min_shared_interests}
          </label>
          <input
            type="range"
            min={1}
            max={6}
            value={prefs.min_shared_interests}
            onChange={(e) => patch({ min_shared_interests: Number(e.target.value) })}
            className="w-full"
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Countries
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map(([cc, name]) => (
              <Chip
                key={cc || "any"}
                active={countryFilterActive(cc)}
                onClick={() => {
                  if (cc === "") return patch({ preferred_countries: [] });
                  toggleIn(prefs.preferred_countries, cc, (x) =>
                    patch({ preferred_countries: x }),
                  );
                }}
              >
                {name}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Interested in (empty = anyone)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {GENDERS.map(([v, label]) => (
              <Chip
                key={v}
                active={prefs.preferred_genders.includes(v)}
                onClick={() =>
                  toggleIn(prefs.preferred_genders, v, (x) =>
                    patch({ preferred_genders: x }),
                  )
                }
              >
                {label}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              My interests ({myInterests.length})
            </h3>
            <button
              type="button"
              onClick={() => void runReview()}
              disabled={reviewing}
              className="flex items-center gap-1.5 rounded-lg border border-brand/50 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand-2 transition hover:bg-brand/20 disabled:opacity-50"
            >
              <span>✦</span>
              {reviewing ? "Reviewing…" : "Review my profile"}
            </button>
          </div>
          {review && (
            <div className="mb-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2.5">
              <p className="text-xs leading-relaxed text-zinc-800">{review.summary}</p>
              <ul className="mt-2 space-y-1">
                {review.tips.map((t) => (
                  <li key={t} className="text-[11px] leading-relaxed text-zinc-700">
                    • {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reviewError && <p className="mb-2 text-xs text-rose-700">{reviewError}</p>}
          <div className="scrollbar-thin flex max-h-[35vh] flex-wrap gap-1.5 overflow-y-auto pr-1">
            {interests.map((i) => (
              <Chip
                key={i.slug}
                active={myInterests.includes(i.slug)}
                onClick={() => toggleIn(myInterests, i.slug, setMyInterests)}
              >
                {i.emoji} {i.label}
              </Chip>
            ))}
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
          {saved && <span className="text-xs text-emerald-700">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
