"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { Interest } from "@/lib/supabase";
import { errorMessage, rpc, supabase } from "@/lib/supabase";
import { ai } from "@/lib/ai";
import { COUNTRIES, GENDERS, inputCls, LANGS } from "@/lib/options";
import { useApp } from "@/components/app-provider";
import { Avatar, Chip, Spinner } from "@/components/ui";

type Draft = {
  username: string;
  display_name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  country_code: string;
  city: string;
  birth_year: number;
  gender: string;
  languages: string[];
  interests: string[];
  phone: string;
  has_whatsapp: boolean;
};

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export function ProfileEditor() {
  const { me, interests, refreshMe } = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!me) return;
    let active = true;
    void (async () => {
      try {
        const [slugs, detail] = await Promise.all([
          supabase.rpc("gc_interest_slugs", { p_member: me.id }),
          rpc<{ phone: string | null; has_whatsapp: boolean }>("gc_member_detail", {
            p_member: me.id,
          }),
        ]);
        if (!active) return;
        const mine = (slugs.data as string[] | null) ?? [];
        setDraft({
          username: me.username,
          display_name: me.display_name,
          headline: me.headline ?? "",
          bio: me.bio ?? "",
          avatar_url: me.avatar_url ?? "",
          country_code: me.country_code ?? "",
          city: me.city ?? "",
          birth_year: me.birth_year ?? 1995,
          gender: me.gender ?? "",
          languages: me.languages ?? [],
          interests: mine,
          phone: detail.phone ?? "",
          has_whatsapp: Boolean(detail.has_whatsapp),
        });
      } catch (e) {
        if (active) setError(errorMessage(e, "Could not load your profile"));
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [me]);

  const patch = (next: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...next } : d));

  const toggle = (key: "languages" | "interests", v: string) =>
    setDraft((d) => {
      if (!d) return d;
      const list = d[key];
      return { ...d, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });

  const grouped = useMemo(() => groupByCategory(interests), [interests]);
  const country = COUNTRIES.find((c) => c[0] === draft?.country_code);

  async function save() {
    if (!me?.id || !draft) return;
    setSaving(true);
    setError(null);
    try {
      await rpc("gc_update_profile", {
        p_username: draft.username,
        p_display_name: draft.display_name,
        p_headline: draft.headline,
        p_bio: draft.bio,
        p_avatar_url: draft.avatar_url,
        p_country: country?.[1] ?? "",
        p_country_code: draft.country_code,
        p_city: draft.city,
        p_birth_year: draft.birth_year,
        p_gender: draft.gender,
        p_languages: draft.languages,
        p_interest_slugs: draft.interests,
        p_phone: draft.phone,
        p_has_whatsapp: draft.has_whatsapp,
      });
      await refreshMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(errorMessage(e, "Could not save your profile"));
    } finally {
      setSaving(false);
    }
  }

  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me?.id) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Pick an image under 4 MB");
      return;
    }
    setUploading(true);
    setError(null);
    const path = `${me.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    try {
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      patch({ avatar_url: data.publicUrl });
    } catch (e) {
      setError(errorMessage(e, "Could not upload that image"));
    } finally {
      setUploading(false);
    }
  }

  if (!loaded) return <Spinner label="Loading your profile…" />;
  if (!draft) {
    return (
      <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
        {error ?? "We could not load your profile."}
      </p>
    );
  }

  const usernameOk = /^[a-z0-9_.]{3,20}$/.test(draft.username);

  return (
    <div className="space-y-4">
      <div className="card rounded-2xl p-6">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Avatar
              name={draft.display_name || draft.username}
              url={draft.avatar_url}
              size={84}
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? "…" : "Change"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => void pickAvatar(e)}
            className="hidden"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">My profile</h2>
            <p className="text-xs text-zinc-500">
              This is what other members see on your profile. Changes go live as soon as you
              save.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" hint={`@${draft.username || "handle"}`}>
              <input
                value={draft.username}
                onChange={(e) => patch({ username: e.target.value.toLowerCase() })}
                className={`${inputCls} ${usernameOk ? "" : "border-rose-500/60"}`}
                placeholder="your_handle"
              />
            </Field>
            <Field label="Display name">
              <input
                value={draft.display_name}
                onChange={(e) => patch({ display_name: e.target.value })}
                placeholder="How people see you"
                className={inputCls}
              />
            </Field>
          </section>
          {!usernameOk && (
            <p className="-mt-2 text-xs text-rose-700">
              Usernames are 3–20 characters: a–z, 0–9, underscore or dot.
            </p>
          )}

          <Field label="One-line headline">
            <input
              value={draft.headline}
              onChange={(e) => patch({ headline: e.target.value })}
              placeholder="Trail runner & landscape photographer"
              className={inputCls}
            />
          </Field>

          <Field label="About you" hint={`${draft.bio.length}/600`}>
            <textarea
              value={draft.bio}
              maxLength={600}
              rows={4}
              onChange={(e) => patch({ bio: e.target.value })}
              placeholder="What are you into? What would you talk about for hours?"
              className={inputCls}
            />
          </Field>

          <AiWriter
            displayName={draft.display_name}
            bio={draft.bio}
            headline={draft.headline}
            city={draft.city}
            country={country?.[1] ?? ""}
            languages={draft.languages}
            interests={draft.interests}
            onWrite={(b, h) => patch({ bio: b, headline: h || draft.headline })}
          />
        </div>
      </div>

      <div className="card rounded-2xl p-6">
        <h3 className="mb-4 text-sm font-semibold">Where you are</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Birth year">
            <input
              type="number"
              min={1940}
              max={2010}
              value={draft.birth_year}
              onChange={(e) => patch({ birth_year: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Gender">
            <select
              value={draft.gender}
              onChange={(e) => patch({ gender: e.target.value })}
              className={inputCls}
            >
              {GENDERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Country">
            <select
              value={draft.country_code}
              onChange={(e) => patch({ country_code: e.target.value })}
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
              value={draft.city}
              onChange={(e) => patch({ city: e.target.value })}
              placeholder="Lisbon"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
            Languages you speak
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LANGS.map((l) => (
              <Chip
                key={l}
                active={draft.languages.includes(l)}
                onClick={() => toggle("languages", l)}
              >
                {l}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="card rounded-2xl p-6">
        <h3 className="mb-1 text-sm font-semibold">How to reach you</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Your number shows on your profile so anyone you like can get hold of you.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number (optional)">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) =>
                patch({
                  phone: e.target.value,
                  has_whatsapp: e.target.value.trim().length > 0 && draft.has_whatsapp,
                })
              }
              placeholder="+351 912 345 678"
              className={inputCls}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => patch({ has_whatsapp: !draft.has_whatsapp })}
              disabled={draft.phone.trim().length === 0}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition disabled:opacity-40 ${
                draft.has_whatsapp
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                  : "border-line bg-surface-2 text-zinc-600 hover:border-brand/60"
              }`}
            >
              <span>💬 Reachable on WhatsApp</span>
              <span>{draft.has_whatsapp ? "On" : "Off"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card rounded-2xl p-6">
        <h3 className="mb-1 text-sm font-semibold">Interests</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Pick at least 3 — these drive who finds you. Selected: {draft.interests.length}
        </p>
        <div className="grid max-h-[420px] gap-4 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-2">
                {cat}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((i) => (
                  <Chip
                    key={i.slug}
                    active={draft.interests.includes(i.slug)}
                    onClick={() => toggle("interests", i.slug)}
                  >
                    {i.emoji} {i.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving || uploading || !usernameOk}
          className="flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-2 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium uppercase tracking-wide text-zinc-600">
        {label}
        {hint && <span className="text-[11px] normal-case text-zinc-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Drafts a bio and headline from the details already on the form. */
function AiWriter({
  displayName,
  bio,
  headline,
  city,
  country,
  languages,
  interests,
  onWrite,
}: {
  displayName: string;
  bio: string;
  headline: string;
  city: string;
  country: string;
  languages: string[];
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
        looking_for: "friendship",
      });
      onWrite(result.bio, result.headline);
    } catch (e) {
      setError(errorMessage(e, "Could not write your profile"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || !displayName.trim()}
        className="flex items-center gap-2 rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-medium text-brand-2 transition hover:bg-brand/20 disabled:opacity-50"
      >
        <span>✦</span>
        {busy ? "Writing…" : "Write this for me with AI"}
      </button>
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
    </div>
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