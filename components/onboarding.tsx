"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "@/components/app-provider";
import { Avatar } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { ai } from "@/lib/ai";
import type { Interest } from "@/lib/supabase";
import { COUNTRIES, GENDERS, inputCls, LANGS, LOOKING } from "@/lib/options";

async function supabaseRpc(name: string, args: Record<string, unknown>) {
  return supabase.rpc(name, args);
}

export default function Onboarding() {
  const { me, interests, signOut, refreshMe, user, setNeedsOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: (user?.user_metadata?.username as string) ?? me?.username ?? "",
    display_name: me?.display_name ?? "",
    headline: "",
    bio: "",
    country_code: "",
    city: "",
    phone: me?.phone ?? "",
    has_whatsapp: me?.has_whatsapp ?? false,
    birth_year: 1995,
    gender: "",
    languages: ["English"] as string[],
    interests: [] as string[],
    looking_for: "friendship",
    min_age: 18,
    max_age: 65,
    preferred_genders: [] as string[],
    max_distance_km: 20000,
    min_shared_interests: 1,
  });

  const country = COUNTRIES.find((c) => c[0] === form.country_code);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle = (key: "languages" | "interests" | "preferred_genders", v: string) =>
    setForm((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });

  const geo = useGeolocation();

  const steps = [
    "Your identity",
    "Where in the world",
    "What you love",
    "Who you want to meet",
    "How to reach you",
  ];

  const canNext = [
    /^[a-z0-9_.]{3,20}$/.test(form.username) && form.display_name.trim().length >= 2,
    Boolean(form.country_code),
    form.interests.length >= 3,
    true,
    true,
  ][step];

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabaseRpc("gc_complete_profile", {
        p_username: form.username,
        p_display_name: form.display_name,
        p_bio: form.bio,
        p_headline: form.headline,
        p_country: country?.[1] ?? null,
        p_country_code: form.country_code || null,
        p_city: form.city,
        p_timezone: geo.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        p_latitude: geo.coords?.lat ?? country?.[2] ?? null,
        p_longitude: geo.coords?.lon ?? country?.[3] ?? null,
        p_birth_year: form.birth_year,
        p_gender: form.gender || null,
        p_languages: form.languages,
        p_interest_slugs: form.interests,
        p_looking_for: form.looking_for,
        p_min_age: form.min_age,
        p_max_age: form.max_age,
        p_preferred_genders: form.preferred_genders,
        p_preferred_countries: [],
        p_max_distance_km: form.max_distance_km,
        p_min_shared_interests: form.min_shared_interests,
        p_phone: form.phone,
        p_has_whatsapp: form.has_whatsapp,
      });
      if (error) throw error;
      await refreshMe();
      setNeedsOnboarding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glow min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Let&apos;s get you <span className="text-brand">discoverable</span>
            </h1>
            <p className="text-sm text-zinc-600">
              Step {step + 1} of {steps.length} — {steps[step]}
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-zinc-600 hover:border-rose-500/50 hover:text-rose-700"
          >
            Sign out
          </button>
        </div>

        <div className="mb-6 flex gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition ${
                i <= step ? "bg-brand" : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="card animate-in rounded-2xl p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={form.display_name || form.username || "You"} size={56} />
                <p className="text-xs text-zinc-600">
                  Your handle is visible worldwide. Keep it friendly.
                </p>
              </div>
              <Field label="Username">
                <input
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase())}
                  placeholder="your_handle"
                  className={inputCls}
                />
              </Field>
              <Field label="Display name">
                <input
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  placeholder="How people see you"
                  className={inputCls}
                />
              </Field>
              <Field label="One-line headline">
                <input
                  value={form.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="Trail runner & landscape photographer"
                  className={inputCls}
                />
              </Field>
              <Field label="About you">
                <textarea
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={3}
                  placeholder="What are you into? What would you talk about for hours?"
                  className={inputCls}
                />
              </Field>
              <AiBioButton
                displayName={form.display_name}
                bio={form.bio}
                headline={form.headline}
                city={form.city}
                country={country?.[1] ?? ""}
                languages={form.languages}
                lookingFor={form.looking_for}
                interests={form.interests}
                onWrite={(b, h) => {
                  set("bio", b);
                  if (h) set("headline", h);
                }}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Birth year">
                  <input
                    type="number"
                    min={1940}
                    max={2010}
                    value={form.birth_year}
                    onChange={(e) => set("birth_year", Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Gender">
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Prefer not to say</option>
                    {GENDERS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Country">
                <select
                  value={form.country_code}
                  onChange={(e) => set("country_code", e.target.value)}
                  className={inputCls}
                >
                  <option value="">Pick your country</option>
                  {COUNTRIES.map(([cc, name]) => (
                    <option key={cc} value={cc}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City (optional)">
                <input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Lisbon"
                  className={inputCls}
                />
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  Languages you speak
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGS.map((l) => (
                    <Pill
                      key={l}
                      active={form.languages.includes(l)}
                      onClick={() => toggle("languages", l)}
                    >
                      {l}
                    </Pill>
                  ))}
                </div>
              </div>
              <button
                onClick={geo.request}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-line px-3 py-2.5 text-left text-xs hover:border-brand/60"
              >
                <span className="text-zinc-700">
                  {geo.coords
                    ? `📍 Using your location (${geo.coords.lat.toFixed(2)}, ${geo.coords.lon.toFixed(2)})`
                    : "📍 Share precise location for distance-aware matching"}
                </span>
                <span className="text-brand">{geo.coords ? "Refresh" : "Enable"}</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
                Pick at least 3 — these drive your matches
              </p>
              <p className="mb-4 text-xs text-zinc-500">
                Selected: {form.interests.length}
              </p>
              <div className="grid max-h-[45vh] gap-4 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2">
                {groupByCategory(interests).map(([cat, list]) => (
                  <div key={cat}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-2">
                      {cat}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((i) => (
                        <Pill
                          key={i.slug}
                          active={form.interests.includes(i.slug)}
                          onClick={() => toggle("interests", i.slug)}
                        >
                          {i.emoji} {i.label}
                        </Pill>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  What are you looking for?
                </p>
                <div className="space-y-1.5">
                  {LOOKING.map(([v, label, hint]) => (
                    <button
                      key={v}
                      onClick={() => set("looking_for", v)}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition ${
                        form.looking_for === v
                          ? "border-brand bg-brand/20"
                          : "border-line hover:border-brand/50"
                      }`}
                    >
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-zinc-600">{hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label={`Age from ${form.min_age}`}>
                  <input
                    type="range"
                    min={18}
                    max={80}
                    value={form.min_age}
                    onChange={(e) => set("min_age", Number(e.target.value))}
                    className="w-full"
                  />
                </Field>
                <Field label={`Age to ${form.max_age}`}>
                  <input
                    type="range"
                    min={19}
                    max={99}
                    value={form.max_age}
                    onChange={(e) => set("max_age", Number(e.target.value))}
                    className="w-full"
                  />
                </Field>
              </div>

              <Field label={`Max distance: ${form.max_distance_km.toLocaleString()} km`}>
                <input
                  type="range"
                  min={50}
                  max={20000}
                  step={50}
                  value={form.max_distance_km}
                  onChange={(e) => set("max_distance_km", Number(e.target.value))}
                  className="w-full"
                />
              </Field>

              <Field label={`Minimum shared interests: ${form.min_shared_interests}`}>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={form.min_shared_interests}
                  onChange={(e) => set("min_shared_interests", Number(e.target.value))}
                  className="w-full"
                />
              </Field>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  Interested in (leave empty for anyone)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GENDERS.map(([v, l]) => (
                    <Pill
                      key={v}
                      active={form.preferred_genders.includes(v)}
                      onClick={() => toggle("preferred_genders", v)}
                    >
                      {l}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Field label="Phone number (optional)">
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+351 912 345 678"
                  className={inputCls}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  set("has_whatsapp", form.phone.trim().length > 0 && !form.has_whatsapp)
                }
                disabled={form.phone.trim().length === 0}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition disabled:opacity-40 ${
                  form.has_whatsapp
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-line hover:border-brand/60"
                }`}
              >
                <span className="text-zinc-700">
                  <span className="mr-1.5">💬</span>
                  I&apos;m also reachable on WhatsApp
                </span>
                <span className={form.has_whatsapp ? "text-emerald-700" : "text-zinc-400"}>
                  {form.has_whatsapp ? "On" : "Off"}
                </span>
              </button>
              <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs text-zinc-600">
                Your number appears on your profile so anyone you like can reach you. Leave it
                blank to stay unlisted.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-lg border border-line px-4 py-2 text-sm text-zinc-700 disabled:opacity-30"
            >
              Back
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => canNext && setStep((s) => s + 1)}
                disabled={!canNext}
                className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={busy}
                className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Enter the community"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Drafts a bio and headline from the details already entered. */
function AiBioButton({
  displayName,
  bio,
  headline,
  city,
  country,
  languages,
  lookingFor,
  interests,
  onWrite,
}: {
  displayName: string;
  bio: string;
  headline: string;
  city: string;
  country: string;
  languages: string[];
  lookingFor: string;
  interests: string[];
  onWrite: (bio: string, headline: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await ai.bio({
        display_name: displayName,
        bio,
        headline,
        city,
        country,
        languages,
        interests,
        looking_for: lookingFor,
      });
      onWrite(result.bio, result.headline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-medium text-brand-2 transition hover:bg-brand/20 disabled:opacity-50"
      >
        <span>✦</span>
        {busy ? "Writing…" : "Write this for me with AI"}
      </button>
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface-2 text-zinc-700 hover:border-brand/50"
      }`}
    >
      {children}
    </button>
  );
}

function groupByCategory(list: Interest[]): [string, Interest[]][] {
  const out = new Map<string, Interest[]>();
  for (const item of list) {
    if (!out.has(item.category)) out.set(item.category, []);
    out.get(item.category)!.push(item);
  }
  return [...out.entries()];
}

function useGeolocation() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const request = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {},
      { timeout: 8000 },
    );
  };
  return { coords, request, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
