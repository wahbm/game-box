import { object, random, shuffle } from '@game-box/sdk';
export interface Card {
  id: number;
  rank: number;
  up: boolean;
}
export interface Position {
  columns: Card[][];
  stock: Card[][];
  completed: Card[][];
  moves: number;
}
export interface SpiderState extends Position {
  history: Position[];
}
export function createSpider(seed = Date.now()): SpiderState {
  const deck = shuffle(
    Array.from({ length: 104 }, (_, id) => ({ id, rank: (id % 13) + 1, up: false })),
    random(seed),
  );
  const columns = Array.from({ length: 10 }, (_, i) =>
    deck.splice(0, i < 4 ? 6 : 5).map((c, j) => ({ ...c, up: j === (i < 4 ? 5 : 4) })),
  );
  return {
    columns,
    stock: Array.from({ length: 5 }, () => deck.splice(0, 10).map((c) => ({ ...c, up: true }))),
    completed: [],
    moves: 0,
    history: [],
  };
}
export function movable(cards: Card[], index: number): boolean {
  return (
    index >= 0 &&
    index < cards.length &&
    cards.slice(index).every((c, j, a) => c.up && (j === 0 || a[j - 1].rank === c.rank + 1))
  );
}
export function canMove(s: Position, from: number, index: number, to: number): boolean {
  if (from === to || !s.columns[from] || !s.columns[to] || !movable(s.columns[from], index))
    return false;
  const target = s.columns[to].at(-1);
  return !target || target.rank === s.columns[from][index].rank + 1;
}
function position(s: Position): Position {
  return structuredClone({
    columns: s.columns,
    stock: s.stock,
    completed: s.completed,
    moves: s.moves,
  });
}
function finish(s: SpiderState): SpiderState {
  for (const column of s.columns) {
    let repeat = true;
    while (repeat) {
      repeat = false;
      if (column.length) column[column.length - 1].up = true;
      const run = column.slice(-13);
      if (run.length === 13 && run.every((c, i) => c.up && c.rank === 13 - i)) {
        s.completed.push(column.splice(-13));
        repeat = true;
      }
    }
  }
  return s;
}
function next(s: SpiderState): SpiderState {
  return { ...position(s), moves: s.moves + 1, history: [...s.history, position(s)] };
}
export function move(s: SpiderState, from: number, index: number, to: number): SpiderState {
  if (!canMove(s, from, index, to)) return s;
  const n = next(s);
  n.columns[to].push(...n.columns[from].splice(index));
  return finish(n);
}
export function deal(s: SpiderState): SpiderState {
  if (!s.stock.length || s.columns.some((c) => !c.length)) return s;
  const n = next(s);
  n.stock.shift()!.forEach((c, i) => n.columns[i].push(c));
  return finish(n);
}
export function undo(s: SpiderState): SpiderState {
  const prev = s.history.at(-1);
  return prev ? { ...structuredClone(prev), history: s.history.slice(0, -1) } : s;
}
function validPosition(value: unknown): value is Position {
  if (!object(value)) return false;
  const s = value as unknown as Position;
  if (
    !Array.isArray(s.columns) ||
    s.columns.length !== 10 ||
    !Array.isArray(s.stock) ||
    s.stock.length > 5 ||
    !Array.isArray(s.completed) ||
    s.completed.length > 8 ||
    !Number.isInteger(s.moves) ||
    s.moves < 0
  )
    return false;
  const groups = [...s.columns, ...s.stock, ...s.completed];
  if (!groups.every(Array.isArray)) return false;
  const cards = groups.flat();
  if (
    cards.length !== 104 ||
    !cards.every(
      (c) =>
        object(c) &&
        Number.isInteger(c.id) &&
        c.id >= 0 &&
        c.id < 104 &&
        c.rank === (c.id % 13) + 1 &&
        typeof c.up === 'boolean',
    ) ||
    new Set(cards.map((c) => c.id)).size !== 104
  )
    return false;
  return (
    s.stock.every((c) => c.length === 10 && c.every((x) => x.up)) &&
    s.completed.every((c) => c.length === 13 && c.every((x, i) => x.up && x.rank === 13 - i)) &&
    s.columns.every(
      (c) => (!c.length || c.at(-1)!.up) && c.every((x, i) => !i || !c[i - 1].up || x.up),
    )
  );
}
export function validate(value: unknown): value is SpiderState {
  return (
    validPosition(value) &&
    object(value) &&
    Array.isArray(value.history) &&
    value.history.every(validPosition)
  );
}
