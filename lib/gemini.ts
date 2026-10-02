import "server-only";

/**
 * Server-side Gemini client. The key must stay in server-only env vars:
 * anything prefixed NEXT_PUBLIC_ is inlined into the browser bundle.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Tried in order until one answers. The pinned 2.5 aliases now 404 for new
 * projects, so the rolling alias leads and older pins stay as a fallback.
 */
const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
]
  .filter((m): m is string => Boolean(m))
  .filter((m, i, all) => all.indexOf(m) === i);

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

type Part = { text: string };

type GeminiReply = {
  candidates?: {
    content?: { parts?: Part[] };
    finishReason?: string;
  }[];
};

async function callModel(
  model: string,
  prompt: string,
  maxOutputTokens: number,
  temperature: number,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured", 500);

  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature,
        // Thinking tokens are billed against this budget, so leave headroom.
        maxOutputTokens,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GeminiError(
      `${model} responded ${res.status}: ${detail.slice(0, 300)}`,
      res.status,
    );
  }

  const data = (await res.json()) as GeminiReply;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason ?? "empty response";
    throw new GeminiError(`no content from ${model} (${reason})`, 502);
  }
  return text;
}

/** Statuses that mean "try again shortly" rather than "this model is gone". */
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends a prompt that must come back as JSON and returns the parsed object.
 * Each model gets up to three attempts on transient failures, since the
 * rolling alias 503s fairly often under load.
 */
export async function generateJson<T>(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number } = {},
): Promise<T> {
  const maxTokens = opts.maxOutputTokens ?? 2048;
  const errors: GeminiError[] = [];

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await callModel(
          model,
          prompt,
          maxTokens,
          opts.temperature ?? 0.7,
        );
        return JSON.parse(text) as T;
      } catch (e) {
        // Bad JSON from a model that answered is worth a retry at a different
        // temperature before giving up on that model.
        if (e instanceof SyntaxError) {
          try {
            const retry = await callModel(model, prompt, maxTokens, 0.3);
            return JSON.parse(retry) as T;
          } catch (retryErr) {
            if (retryErr instanceof GeminiError) errors.push(retryErr);
          }
          break;
        }

        if (e instanceof GeminiError) {
          errors.push(e);
          // 404 means the alias is retired for this project; retrying is futile.
          if (e.status === 404) break;
          if (TRANSIENT.has(e.status) && attempt < 3) {
            await sleep(400 * 2 ** (attempt - 1));
            continue;
          }
        }
        break;
      }
    }
  }

  // Prefer a real service failure over a retired-model 404 when reporting.
  const reportable =
    errors.find((e) => TRANSIENT.has(e.status)) ??
    errors.find((e) => e.status !== 404) ??
    errors[0];
  throw reportable ?? new GeminiError("no Gemini model available", 502);
}

/** Trims and hard-caps free text coming back from the model. */
export function clamp(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}