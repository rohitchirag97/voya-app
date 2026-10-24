import { useEffect, useState } from 'react';
import { api, type Cosmetic } from '../api';

// Chat messages and seats carry badge/bubble/frame ids only; the artwork is fetched once per session and reused.
type Catalog = {
  bubbles: Record<string, Cosmetic>;
  frames: Record<string, Cosmetic>;
  badges: Record<string, { id: string; name: string; svg: string }>;
};

let cached: Catalog | null = null;
let loading: Promise<Catalog> | null = null;

function load() {
  loading ??= Promise.all([api<Cosmetic[]>('GET', '/cosmetics'), api<{ id: string; name: string; svg: string }[]>('GET', '/badges')])
    .then(([cos, bad]) => {
      const byKind = (kind: Cosmetic['kind']) => Object.fromEntries(cos.filter((c) => c.kind === kind).map((c) => [c.id, c]));
      cached = { bubbles: byKind('CHAT_BUBBLE'), frames: byKind('AVATAR_FRAME'), badges: Object.fromEntries(bad.map((b) => [b.id, b])) };
      return cached;
    })
    .catch((e) => {
      loading = null; // retry next time
      throw e;
    });
  return loading;
}

export function useCatalog(): Catalog {
  const [cat, setCat] = useState<Catalog>(cached ?? { bubbles: {}, frames: {}, badges: {} });
  useEffect(() => {
    if (!cached) load().then(setCat).catch(() => {});
  }, []);
  return cat;
}
