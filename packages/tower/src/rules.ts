import { object } from '@game-box/sdk';
import content from './content.json';
export const floors = content.floors;
export const contentVersion = content.version;
export interface Hero {
  hp: number;
  attack: number;
  defense: number;
  gold: number;
  keys: number;
}
export interface TowerPosition {
  floor: number;
  x: number;
  y: number;
  hero: Hero;
  maps: string[][];
  won: boolean;
}
export interface TowerState extends TowerPosition {
  checkpoint: TowerPosition;
  message: string;
}
export interface Monster {
  hp: number;
  attack: number;
  defense: number;
  gold: number;
  name: string;
}
export function damage(hero: Hero, monster: Monster): number {
  const hit = hero.attack - monster.defense;
  return hit <= 0
    ? Infinity
    : Math.max(0, Math.ceil(monster.hp / hit) - 1) * Math.max(0, monster.attack - hero.defense);
}
export function createTower(): TowerState {
  const p: TowerPosition = {
    floor: 0,
    x: 1,
    y: 1,
    hero: { hp: 600, attack: 16, defense: 7, gold: 0, keys: 0 },
    maps: floors.map((f) => f.map.map((row) => row)),
    won: false,
  };
  return { ...p, checkpoint: structuredClone(p), message: '拾起钥匙与宝石，向塔顶出发。' };
}
function tile(s: TowerPosition, x: number, y: number) {
  return s.maps[s.floor][y]?.[x] ?? '#';
}
function clear(s: TowerState, x: number, y: number) {
  const row = s.maps[s.floor][y];
  s.maps[s.floor][y] = row.slice(0, x) + '.' + row.slice(x + 1);
}
export function walk(s: TowerState, dx: number, dy: number): TowerState {
  if (s.won || Math.abs(dx) + Math.abs(dy) !== 1) return s;
  const x = s.x + dx,
    y = s.y + dy,
    t = tile(s, x, y);
  if (t === '#') return s;
  const n = structuredClone(s),
    f = floors[s.floor];
  n.message = '继续向前探索。';
  if (t === 'd') {
    if (!n.hero.keys) return { ...s, message: '需要一把黄钥匙。' };
    n.hero.keys--;
    clear(n, x, y);
    n.message = '黄门打开了。';
  }
  if (t === 'm' || t === 'B') {
    const m = t === 'B' ? f.boss : f.monster,
      loss = damage(n.hero, m);
    if (loss >= n.hero.hp)
      return {
        ...s,
        message: Number.isFinite(loss)
          ? `生命不足：预计损失 ${loss}。`
          : '攻击不足，无法击败这个敌人。',
      };
    n.hero.hp -= loss;
    n.hero.gold += m.gold;
    clear(n, x, y);
    n.message = `击败${m.name}，损失 ${loss} 生命，获得 ${m.gold} 金币。`;
    if (t === 'B') n.won = true;
  }
  if (t === 'k') {
    n.hero.keys++;
    clear(n, x, y);
    n.message = '获得黄钥匙 × 1。';
  }
  if (t === 'a') {
    n.hero.attack += 5;
    clear(n, x, y);
    n.message = '红宝石：攻击 +5。';
  }
  if (t === 'v') {
    n.hero.defense += 4;
    clear(n, x, y);
    n.message = '蓝宝石：防御 +4。';
  }
  if (t === 'p') {
    n.hero.hp += 150;
    clear(n, x, y);
    n.message = '药水：生命 +150。';
  }
  if (t === 'g') {
    n.hero.gold += 20;
    clear(n, x, y);
    n.message = '获得 20 金币。';
  }
  n.x = x;
  n.y = y;
  if (t === 's') n.message = '旅人商店：使用金币提升能力。';
  if (t === '>' || (t === '<' && s.floor > 0)) {
    n.floor += t === '>' ? 1 : -1;
    const pos = t === '>' ? floors[n.floor].entrance : floors[n.floor].exit;
    [n.x, n.y] = pos;
    n.message = `来到第 ${n.floor + 1} 层 · ${floors[n.floor].name}`;
    const { checkpoint: _, message: __, ...p } = n;
    n.checkpoint = structuredClone(p);
  }
  return n;
}
export function buy(s: TowerState, stat: 'hp' | 'attack' | 'defense'): TowerState {
  const shop = floors[s.floor].shop;
  if (s.won || tile(s, s.x, s.y) !== 's' || s.hero.gold < shop.cost) return s;
  const n = structuredClone(s);
  n.hero.gold -= shop.cost;
  n.hero[stat] += shop[stat];
  n.message = '交易完成，祝你一路顺风。';
  return n;
}
export function rewind(s: TowerState): TowerState {
  return {
    ...structuredClone(s.checkpoint),
    checkpoint: structuredClone(s.checkpoint),
    message: '已回到本层入口时的状态。',
  };
}
function validPosition(value: unknown): value is TowerPosition {
  if (!object(value)) return false;
  const s = value as unknown as TowerPosition;
  if (
    !Number.isInteger(s.floor) ||
    s.floor < 0 ||
    s.floor >= 10 ||
    !Number.isInteger(s.x) ||
    !Number.isInteger(s.y) ||
    s.x < 0 ||
    s.x > 8 ||
    s.y < 0 ||
    s.y > 8 ||
    !object(s.hero) ||
    !['hp', 'attack', 'defense', 'gold', 'keys'].every(
      (k) => Number.isInteger(s.hero[k as keyof Hero]) && s.hero[k as keyof Hero] >= 0,
    ) ||
    s.hero.hp <= 0 ||
    typeof s.won !== 'boolean' ||
    !Array.isArray(s.maps) ||
    s.maps.length !== 10
  )
    return false;
  return (
    s.maps.every(
      (m) =>
        Array.isArray(m) &&
        m.length === 9 &&
        m.every(
          (row) => typeof row === 'string' && row.length === 9 && /^[#.<>kadmpsvgB]+$/.test(row),
        ),
    ) && tile(s, s.x, s.y) !== '#'
  );
}
export function validate(value: unknown): value is TowerState {
  return (
    validPosition(value) &&
    object(value) &&
    validPosition(value.checkpoint) &&
    typeof value.message === 'string'
  );
}
