export interface SaveRecord {
  gameId: string;
  schemaVersion: number;
  contentVersion: number;
  updatedAt: number;
  state: unknown;
}
export interface SaveRepository {
  read(id: string): Promise<SaveRecord | undefined>;
  backup(id: string): Promise<SaveRecord | undefined>;
  write(record: SaveRecord): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface Settings {
  reducedMotion: boolean;
}
export interface GameContext {
  initialState?: unknown;
  settings: Settings;
  onChange(state: unknown): void;
  onWin(): void;
  onError(error: unknown): void;
}
export interface GameInstance {
  pause(): void;
  resume(): void;
  destroy(): void;
  snapshot(): unknown;
}
export interface GameModule {
  mount(container: HTMLElement, context: GameContext): GameInstance;
  validate(state: unknown): boolean;
  migrate(state: unknown, fromVersion: number): unknown;
}
export interface GameManifest {
  id: string;
  name: string;
  description: string;
  cover: string;
  version: string;
  saveVersion: number;
  contentVersion: number;
  compatibleContentVersions?: number[];
  rules: string;
  load(): Promise<GameModule>;
}
export function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
