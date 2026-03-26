import { createServiceClient } from "@/lib/supabase/server";

const cache = new Map<string, { value: unknown; expiry: number }>();
const TTL_MS = 60_000;

const DEFAULTS: Record<string, unknown> = {
  "rate_limit.general": { requests: 100, window_seconds: 60 },
  "rate_limit.scrape": { requests: 5, window_seconds: 3600 },
  "rate_limit.evaluate": { requests: 20, window_seconds: 60 },
  "rate_limit.export": { requests: 10, window_seconds: 3600 },
  "rate_limit.auth": { requests: 10, window_seconds: 3600 },
  "scrape.concurrency": 5,
  "evaluate.model": "claude-sonnet-4-20250514",
  "evaluate.max_tokens": 300,
  "evaluate.concurrency": 5,
  "evaluate.calibration_max": 10,
};

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value as T;
  }

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();

  const value = data?.value ?? DEFAULTS[key] ?? null;
  cache.set(key, { value, expiry: Date.now() + TTL_MS });
  return value as T;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const supabase = await createServiceClient();
  const { data } = await supabase.from("system_settings").select("*");

  const result: Record<string, unknown> = { ...DEFAULTS };
  if (data) {
    for (const row of data) {
      result[row.key] = row.value;
      cache.set(row.key, { value: row.value, expiry: Date.now() + TTL_MS });
    }
  }
  return result;
}

export function bustCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
