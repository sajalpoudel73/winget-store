import { api } from "../api";
import type { PackageDetails } from "../api/types";

const TTL_MS = 7 * 24 * 3600 * 1000;
const mem = new Map<string, PackageDetails>();
const failed = new Map<string, string>();
const inflight = new Map<string, Promise<PackageDetails>>();

const MAX_PARALLEL = 3;
let active = 0;
const waiting: { run: () => void }[] = [];

function schedule<T>(job: () => Promise<T>, priority: boolean): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entry = {
      run: () => {
        active++;
        job()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      },
    };
    if (priority) waiting.unshift(entry);
    else waiting.push(entry);
    next();
  });
}

function next() {
  while (active < MAX_PARALLEL && waiting.length) waiting.shift()!.run();
}

const key = (id: string, source?: string) => `${source ?? ""}:${id}`.toLowerCase();
const storeKey = (k: string) => `wgs.d.${k}`;

/** Returns cached details without any I/O to winget, or undefined. */
export function peekDetails(id: string, source?: string): PackageDetails | undefined {
  const k = key(id, source);
  const hit = mem.get(k);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(storeKey(k));
    if (raw) {
      const { t, d } = JSON.parse(raw) as { t: number; d: PackageDetails };
      if (Date.now() - t < TTL_MS) {
        mem.set(k, d);
        return d;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return undefined;
}

/**
 * Loads `winget show` details. Requests are de-duplicated, limited to a few at a time
 * (each one starts a winget process), and cached for a week.
 * Pass `version` to read a specific version (not cached). `priority` jumps the queue.
 */
export function fetchDetails(id: string, source?: string, opts: { version?: string; priority?: boolean } = {}): Promise<PackageDetails> {
  if (opts.version) {
    return schedule(() => api.packageDetails(id, source, opts.version), true);
  }
  const cached = peekDetails(id, source);
  if (cached) return Promise.resolve(cached);
  const k = key(id, source);
  if (!opts.priority && failed.has(k)) return Promise.reject(new Error(failed.get(k)));
  const existing = inflight.get(k);
  if (existing) return existing;
  const p = schedule(() => api.packageDetails(id, source), !!opts.priority)
    .then((d) => {
      mem.set(k, d);
      failed.delete(k);
      try {
        localStorage.setItem(storeKey(k), JSON.stringify({ t: Date.now(), d }));
      } catch {
        /* quota or unavailable */
      }
      return d;
    })
    .catch((e) => {
      failed.set(k, String(e));
      throw e;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

export function clearDetailsCache() {
  mem.clear();
  failed.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("wgs.d."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
