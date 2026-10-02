"use client";

import { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/components/app-provider";
import AuthScreen from "@/components/auth-screen";
import Onboarding from "@/components/onboarding";
import { Discovery } from "@/components/discovery";
import { MatchesView } from "@/components/matches-view";
import { Inbox, ChatDrawer } from "@/components/chat";
import ProfileDrawer from "@/components/profile-drawer";
import { Preferences } from "@/components/preferences";
import { ProfileEditor } from "@/components/profile-editor";
import { Avatar } from "@/components/ui";

const tabs = [
  { key: "discover", label: "Discover", icon: "🗺️" },
  { key: "matches", label: "Matches", icon: "💚" },
  { key: "inbox", label: "Inbox", icon: "💬" },
  { key: "profile", label: "My profile", icon: "👤" },
  { key: "preferences", label: "Preferences", icon: "⚙️" },
] as const;

function Shell() {
  const { session, me, needsOnboarding, signOut, loading } = useApp();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("discover");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [chat, setChat] = useState<{ id: string | null; name: string }>({
    id: null,
    name: "",
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  if (loading) {
    return (
      <div className="glow flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Booting up the global community…
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  if (needsOnboarding) return <Onboarding />;

  return (
    <div className="glow min-h-screen">
      {notice && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className="animate-in rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-700 shadow-xl backdrop-blur">
            {notice}
          </div>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-7xl flex-col px-3 py-4 sm:px-6">
        <header className="card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-xl shadow shadow-brand/30">
              🌍
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                Globe<span className="text-brand">Circle</span>
              </h1>
              <p className="text-[11px] text-zinc-500">People meet people, worldwide</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                  tab === t.key
                    ? "bg-brand font-semibold text-white shadow"
                    : "text-zinc-600 hover:bg-surface-2"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {me && (
              <button
                onClick={() => setTab("profile")}
                title="Edit your profile"
                className="flex items-center gap-2 rounded-full border border-line pl-1 pr-2.5 py-1 text-left hover:border-brand/60"
              >
                <Avatar name={me.display_name} url={me.avatar_url} size={32} online />
                <span className="max-w-[120px] truncate text-xs font-medium">
                  {me.display_name}
                </span>
              </button>
            )}
            <button
              onClick={signOut}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-zinc-600 hover:border-rose-500/50 hover:text-rose-700"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1">
          {tab === "profile" && <ProfileEditor />}
          {tab === "discover" && (
            <Discovery
              onOpenProfile={(id) => setProfileId(id)}
              onOpenChat={(id, name) => setChat({ id, name })}
            />
          )}
          {tab === "matches" && (
            <MatchesView
              onOpenProfile={(id) => setProfileId(id)}
              onConnect={(m) => {
                const id = m.member_id ?? m.other_id;
                if (id) setProfileId(id);
              }}
            />
          )}
          {tab === "inbox" && (
            <Inbox
              onOpenChat={(id, name) => setChat({ id, name })}
              onOpenProfile={(id) => setProfileId(id)}
            />
          )}
          {tab === "preferences" && <Preferences />}
        </main>
      </div>

      <ChatDrawer
        open={Boolean(chat.id)}
        connectionId={chat.id}
        name={chat.name}
        onClose={() => setChat({ id: null, name: "" })}
      />
      <ProfileDrawer
        open={Boolean(profileId)}
        memberId={profileId}
        onClose={() => setProfileId(null)}
        onConnect={() => {
          setNotice("Request sent — check your Inbox for replies.");
          setProfileId(null);
          setTab("inbox");
        }}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}