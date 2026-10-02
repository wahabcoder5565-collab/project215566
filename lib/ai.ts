import { errorMessage } from "@/lib/supabase";

/** Client helper for the server-side Gemini proxy. */

export type AiOpeners = { openers: string[]; hook: string };
export type AiBio = { bio: string; headline: string };
export type AiReplies = { replies: string[] };
export type AiReview = { summary: string; tips: string[] };

async function post<T>(
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `${fallback} (${res.status})`);
  }
  return (await res.json()) as T;
}

export const ai = {
  bio: (p: {
    display_name: string;
    bio?: string;
    headline?: string;
    country?: string;
    city?: string;
    languages?: string[];
    interests: string[];
    looking_for: string;
  }) => post<AiBio>({ task: "bio", ...p }, "Could not write your profile"),

  openers: (p: {
    interests: string[];
    city?: string | null;
    country?: string | null;
    bio?: string | null;
    shared?: string[] | null;
    my_interests: string[];
    my_city?: string | null;
    looking_for?: string | null;
  }) =>
    post<AiOpeners>(
      { task: "openers", ...p },
      "Could not suggest openers",
    ),

  replies: (p: { message: string; history: string[] }) =>
    post<AiReplies>({ task: "reply", ...p }, "Could not draft replies"),

  review: (p: {
    display_name: string;
    headline?: string | null;
    bio?: string | null;
    interests: string[];
  }) => post<AiReview>({ task: "review", ...p }, "Could not review your profile"),
};

export { errorMessage };