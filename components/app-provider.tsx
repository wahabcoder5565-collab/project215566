"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, rpc, supabase } from "@/lib/supabase";
import type { Interest } from "@/lib/supabase";

export type Me = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  headline: string | null;
  avatar_url: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
  birth_year: number | null;
  gender: string | null;
  languages: string[] | null;
  phone: string | null;
  has_whatsapp: boolean;
  profile_complete: boolean;
  created_at: string;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  me: Me | null;
  interests: Interest[];
  loading: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setMe: (m: Me | null) => void;
  setNeedsOnboarding: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const bootstrapped = useRef(false);

  const loadInterests = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from("gc_interests")
      .select("*")
      .order("category", { ascending: true })
      .order("label", { ascending: true });
    if (data) setInterests(data as Interest[]);
  }, []);

  const loadMe = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("gc_members")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      setMe(null);
      setNeedsOnboarding(true);
      return;
    }
    const row = data as Me;
    setMe(row);
    setNeedsOnboarding(!row.profile_complete);
  }, []);

  // auth session bootstrap
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      if (data.session?.user) {
        try {
          await loadMe(data.session.user.id);
        } catch {
          /* needsOnboarding flag covers this */
        }
      }
      await loadInterests();
      bootstrapped.current = true;
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!bootstrapped.current) return;
      setSession(next);
      if (next?.user) {
        try {
          await loadMe(next.user.id);
        } catch {
          /* ignore */
        }
      } else {
        setMe(null);
        setNeedsOnboarding(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadInterests, loadMe]);

  // presence heartbeat: mark online on mount and every 45s
  useEffect(() => {
    if (!session?.user || !isSupabaseConfigured) return;
    let active = true;

    const beat = () => {
      if (active) void rpc("gc_set_presence", { p_online: true }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 45000);

    const onHide = () => {
      if (document.visibilityState === "hidden" && active) {
        void rpc("gc_set_presence", { p_online: false }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      void rpc("gc_set_presence", { p_online: false }).catch(() => {});
    };
  }, [session?.user]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      user: session?.user ?? null,
      me,
      interests,
      loading,
      needsOnboarding,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      signUp: async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim().toLowerCase() } },
        });
        if (error) throw error;
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError) throw signInError;
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setMe(null);
        setSession(null);
      },
      refreshMe: async () => {
        if (!session?.user) return;
        await loadMe(session.user.id);
      },
      setMe,
      setNeedsOnboarding,
    }),
    [session, me, interests, loading, needsOnboarding, loadMe],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}