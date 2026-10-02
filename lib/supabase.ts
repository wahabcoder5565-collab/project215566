import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export type Gender =
  | "female"
  | "male"
  | "non_binary"
  | "other"
  | "undisclosed";

export type LookingFor =
  | "friendship"
  | "networking"
  | "language_exchange"
  | "travel_buddy"
  | "any";

/** Row shape shared by gc_discover, gc_my_matches and gc_my_connections. */
export type MemberSummary = {
  username: string;
  display_name: string;
  bio: string | null;
  headline: string | null;
  avatar_url: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  gender: Gender | null;
  birth_year: number | null;
  languages: string[] | null;
  is_online: boolean;
  last_seen_at: string;
  score: number;
  shared_interests: string[] | null;
  distance_km: number | null;
  reason: string | null;
  connection_status: string | null;
  /** gc_discover */
  member_id?: string;
  /** gc_my_matches / gc_my_connections */
  other_id?: string;
  match_id?: string;
  connection_id?: string;
  /** gc_my_connections */
  status?: "pending" | "accepted" | "declined";
  direction?: "incoming" | "outgoing";
  note?: string | null;
  created_at?: string;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
};

export type Interest = {
  id: string;
  slug: string;
  label: string;
  emoji: string | null;
  category: string;
};

export type Preferences = {
  member_id: string;
  looking_for: LookingFor;
  min_age: number;
  max_age: number;
  preferred_genders: string[];
  preferred_countries: string[];
  max_distance_km: number;
  min_shared_interests: number;
  interested_in_slugs: string[];
  discoverable: boolean;
};

export type MemberDetail = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
  gender: Gender | null;
  birth_year: number | null;
  age: number | null;
  languages: string[] | null;
  headline: string | null;
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
  interests: { slug: string; label: string; emoji: string | null }[];
  phone: string | null;
  has_whatsapp: boolean;
  looking_for: LookingFor | null;
  shared: string[] | null;
  distance_km: number | null;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  is_mine: boolean;
};

/** Stable id for a person row regardless of which RPC produced it. */
export function memberKey(m: MemberSummary): string {
  return m.member_id ?? m.other_id ?? m.username;
}

export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}