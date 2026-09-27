import { object, random, shuffle } from '@game-box/sdk';
export interface LinkState {
  level: number;
  rows: number;
  cols: number;
  board: number[];
  moves: number;
  seed: number;
  won: boolean;
}
export type Point = [number, number];
export function path(
  board: number[],
  rows: number,
  cols: number,
  a: number,
  b: number,
): Point[] | null {
  if (a === b || !board[a] || !board[b]) return null;
  const start: Point = [Math.floor(a / cols), a % cols],
    end: Point = [Math.floor(b / cols), b % cols];
  const queue: { p: Point; d: number; turns: number; trail: Point[] }[] = [
    { p: start, d: -1, turns: 0, trail: [start] },
  ];
  const seen = new Map<string, number>();
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    for (const [d, [dr, dc]] of (
      [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as Point[]
    ).entries()) {
      const p: Point = [q.p[0] + dr, q.p[1] + dc];
      const turns = q.turns + (q.d !== -1 && q.d !== d ? 1 : 0);
      if (turns > 2 || p[0] < -1 || p[0] > rows || p[1] < -1 || p[1] > cols) continue;
      if (p[0] === end[0] && p[1] === end[1]) return [...q.trail, p];
      if (p[0] >= 0 && p[0] < rows && p[1] >= 0 && p[1] < cols && board[p[0] * cols + p[1]])
        continue;
      const key = `${p},${d}`;
      if ((seen.get(key) ?? 3) <= turns) continue;
      seen.set(key, turns);
      queue.push({ p, d, turns, trail: [...q.trail, p] });
    }
  }
  return null;
}
export function hint(s: LinkState): [number, number] | null {
  for (let a = 0; a < s.board.length; a++)
    for (let b = a + 1; b < s.board.length; b++)
      if (s.board[a] && s.board[a] === s.board[b] && path(s.board, s.rows, s.cols, a, b))
        return [a, b];
  return null;
}
// Assign matching symbols to a geometric elimination sequence, guaranteeing a solution.
export function solvable(board: number[], rows: number, cols: number, seed: number): number[] {
  const rng = random(seed),
    work = [...board],
    result = [...board];
  const values = shuffle(
    board
      .filter(Boolean)
      .sort((a, b) => a - b)
      .filter((_, i) => i % 2 === 0),
    rng,
  );
  let pair = 0;
  while (work.some(Boolean)) {
    const cells = shuffle(
      work.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
      rng,
    );
    let found = false;
    for (const a of cells) {
      for (const b of cells) {
        if (a !== b && path(work, rows, cols, a, b)) {
          result[a] = result[b] = values[pair++];
          work[a] = work[b] = 0;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw new Error('无法生成可解棋盘');
  }
  return result;
}
export function createLink(level = 1, seed = Date.now()): LinkState {
  const cols = 6,
    rows = 4 + 2 * Math.floor((level - 1) / 3);
  const board = Array.from(
    { length: rows * cols },
    (_, i) => 1 + (Math.floor(i / 2) % Math.min(12, 4 + level)),
  );
  return {
    level,
    rows,
    cols,
    board: solvable(board, rows, cols, seed),
    moves: 0,
    seed,
    won: false,
  };
}
export function reshuffle(s: LinkState): LinkState {
  return { ...s, seed: s.seed + 1, board: solvable(s.board, s.rows, s.cols, s.seed + 1) };
}
export function match(s: LinkState, a: number, b: number): LinkState {
  if (s.won || s.board[a] !== s.board[b] || !path(s.board, s.rows, s.cols, a, b)) return s;
  const board = [...s.board];
  board[a] = board[b] = 0;
  let next = { ...s, board, moves: s.moves + 1, won: board.every((v) => !v) };
  if (!next.won && !hint(next)) next = reshuffle(next);
  return next;
}
export function validate(value: unknown): value is LinkState {
  if (!object(value)) return false;
  const s = value as unknown as LinkState;
  return (
    Number.isInteger(s.level) &&
    s.level >= 1 &&
    s.level <= 10 &&
    s.cols === 6 &&
    s.rows === 4 + 2 * Math.floor((s.level - 1) / 3) &&
    Array.isArray(s.board) &&
    s.board.length === s.rows * s.cols &&
    s.board.every((v) => Number.isInteger(v) && v >= 0 && v <= 12) &&
    Number.isInteger(s.moves) &&
    s.moves >= 0 &&
    Number.isFinite(s.seed) &&
    typeof s.won === 'boolean' &&
    s.won === s.board.every((v) => v === 0) &&
    Array.from(new Set(s.board)).every((v) => s.board.filter((x) => x === v).length % 2 === 0)
  );
}
