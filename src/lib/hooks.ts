import { useEffect, useRef, useState } from "react";
import type { PackageDetails } from "../api/types";
import { fetchDetails, peekDetails } from "./details";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(rootMargin = "200px"): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen];
}

/** Lazily loads package details; nothing runs until `enabled` is true. */
export function useDetails(id: string, source: string | undefined, enabled: boolean) {
  const [details, setDetails] = useState<PackageDetails | undefined>(() => peekDetails(id, source));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || details) return;
    let alive = true;
    fetchDetails(id, source)
      .then((d) => alive && setDetails(d))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [id, source, enabled, details]);
  return { details, error };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
