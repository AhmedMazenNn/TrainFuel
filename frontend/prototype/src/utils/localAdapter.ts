/**
 * Browser-storage boundary. Each domain context talks to this interface so it can be
 * replaced by a shared backend API client later without touching the UI.
 */
export interface LocalAdapter<T> {
  load(): Promise<T>;
  save(state: T): Promise<void>;
  reset(): Promise<T>;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function createLocalAdapter<T extends {version: number;}>(key: string, seed: () => T, version = 1): LocalAdapter<T> {
  return {
    async load() {
      await wait(250);
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        const s = seed();
        window.localStorage.setItem(key, JSON.stringify(s));
        return s;
      }
      const parsed = JSON.parse(raw) as T;
      if (!parsed || parsed.version !== version) throw new Error('Unsupported data version');
      return parsed;
    },
    async save(state) {
      window.localStorage.setItem(key, JSON.stringify(state));
    },
    async reset() {
      const s = seed();
      window.localStorage.setItem(key, JSON.stringify(s));
      return s;
    }
  };
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}