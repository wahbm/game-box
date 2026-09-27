import { describe, expect, it } from 'vitest';
import {
  createLink,
  path,
  hint,
  match,
  reshuffle,
  validate as validLink,
} from '@game-box/link/rules';
import {
  createSpider,
  move,
  deal,
  undo,
  movable,
  validate as validSpider,
  type SpiderState,
} from '@game-box/spider/rules';
import {
  createTower,
  walk,
  damage,
  floors,
  buy,
  rewind,
  validate as validTower,
} from '@game-box/tower/rules';
describe('连连看', () => {
  it('截图中的圆点与菱形路径可通，但不同图案不能配对', () => {
    const s = {
      ...createLink(1, 1),
      moves: 2,
      board: [0, 0, 0, 2, 3, 2, 0, 5, 3, 3, 1, 5, 1, 4, 3, 4, 5, 4, 5, 2, 4, 2, 2, 2],
    };
    expect(validLink(s)).toBe(true);
    expect(path(s.board, 4, 6, 7, 3)).not.toBeNull();
    expect(match(s, 7, 3)).toBe(s);
    const sameSymbols = { ...s, board: [...s.board] };
    [sameSymbols.board[3], sameSymbols.board[11]] = [sameSymbols.board[11], sameSymbols.board[3]];
    expect(match(sameSymbols, 7, 3).board[7]).toBe(0);
    expect(match(sameSymbols, 7, 3).board[3]).toBe(0);
  });
  it('允许外圈及两次折弯，拒绝被包围的路径', () => {
    expect(path([1, 2, 1, 2, 2, 2], 2, 3, 0, 2)).not.toBeNull();
    expect(path(Array(25).fill(1), 5, 5, 6, 18)).toBeNull();
    expect(path([1, 1], 1, 2, 0, 0)).toBeNull();
  });
  it('不同图案不可消除', () => {
    const s = createLink(1, 42);
    const b = s.board.findIndex((v) => v !== s.board[0]);
    expect(match(s, 0, b)).toBe(s);
  });
  it('十关的种子局面、任意消除与洗牌均可最终完成', () => {
    for (let level = 1; level <= 10; level++) {
      let s = createLink(level, level * 190);
      expect(validLink(s)).toBe(true);
      s = reshuffle(s);
      let count = 0;
      while (!s.won) {
        const pair = hint(s);
        expect(pair).not.toBeNull();
        s = match(s, ...pair!);
        expect(validLink(s)).toBe(true);
        if (++count > 100) throw Error('未能完成');
      }
      expect(s.board.every((v) => !v)).toBe(true);
    }
  });
  it('固定种子可复现并拒绝损坏数据', () => {
    expect(createLink(3, 1)).toEqual(createLink(3, 1));
    expect(validLink({})).toBe(false);
    expect(validLink({ ...createLink(), board: [1] })).toBe(false);
  });
});
export function nearlyWonSpider(): SpiderState {
  const s = createSpider(3);
  s.columns = Array.from({ length: 10 }, () => []);
  s.stock = [];
  s.completed = Array.from({ length: 7 }, (_, g) =>
    Array.from({ length: 13 }, (_, i) => ({ id: g * 13 + 12 - i, rank: 13 - i, up: true })),
  );
  s.columns[0] = Array.from({ length: 13 }, (_, i) => ({ id: 103 - i, rank: 13 - i, up: true }));
  return s;
}
describe('蜘蛛纸牌', () => {
  it('104 张牌、正确布局、隐藏牌及确定性洗牌', () => {
    const s = createSpider(123);
    expect(s.columns.map((c) => c.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(s.stock).toHaveLength(5);
    expect(s.columns.every((c) => c.filter((x) => x.up).length === 1)).toBe(true);
    expect(validSpider(s)).toBe(true);
    expect(s).toEqual(createSpider(123));
    expect(movable(s.columns[0], 0)).toBe(false);
  });
  it('补发与撤销精确恢复，空列阻止补发', () => {
    const s = createSpider(1),
      n = deal(s);
    expect(n.stock).toHaveLength(4);
    expect(undo(n)).toEqual(s);
    const empty = structuredClone(s);
    empty.columns[0] = [];
    expect(deal(empty)).toBe(empty);
  });
  it('移动翻牌以及收牌均可完整撤销', () => {
    const s = createSpider(1);
    s.columns[1].push(...s.columns[2]);
    s.columns[2] = [];
    const n = move(s, 0, s.columns[0].length - 1, 2);
    expect(n.columns[0].at(-1)?.up).toBe(true);
    expect(undo(n)).toEqual(s);
    const almost = nearlyWonSpider();
    expect(validSpider(almost)).toBe(true);
    const won = move(almost, 0, 0, 1);
    expect(won.completed).toHaveLength(8);
    expect(validSpider(won)).toBe(true);
    expect(undo(won)).toEqual(almost);
  });
  it('拒绝重复牌和非法移动', () => {
    const s = createSpider(1);
    expect(move(s, 0, 0, 1)).toBe(s);
    s.columns[0][0] = s.columns[0][1];
    expect(validSpider(s)).toBe(false);
  });
});
describe('魔塔', () => {
  it('玩家先攻、向上取整，无法破防返回 Infinity', () => {
    const h = { hp: 100, attack: 10, defense: 3, gold: 0, keys: 0 };
    expect(damage(h, { hp: 21, attack: 8, defense: 0, gold: 0, name: '' })).toBe(10);
    expect(damage(h, { hp: 10, attack: 99, defense: 0, gold: 0, name: '' })).toBe(0);
    expect(damage(h, { hp: 10, attack: 1, defense: 10, gold: 0, name: '' })).toBe(Infinity);
  });
  it('固定路线贯通十层并击败 Boss，无需购买属性', () => {
    let s = createTower();
    for (let f = 0; f < 10; f++) {
      const route = floors[f].route;
      for (let i = 1; i < route.length; i++) {
        const [x, y] = route[i];
        s = walk(s, x - s.x, y - s.y);
        expect(validTower(s)).toBe(true);
      }
      if (f < 9) expect(s.floor).toBe(f + 1);
    }
    expect(s.won).toBe(true);
    expect(s.hero.hp).toBeGreaterThan(0);
  });
  it('门需要钥匙、禁止致死战斗、回退恢复入口', () => {
    let s = createTower();
    s.x = 7;
    s.y = 3;
    s.hero.keys = 0;
    expect(walk(s, -1, 0).hero.keys).toBe(0);
    expect(walk(s, -1, 0).x).toBe(7);
    s = createTower();
    s.x = 6;
    s.y = 1;
    s.hero.hp = 1;
    expect(walk(s, 1, 0).x).toBe(6);
    s = walk(createTower(), 1, 0);
    expect(rewind(s).x).toBe(1);
  });
  it('商店检查位置及金币，购买影响属性', () => {
    const s = createTower();
    s.x = 2;
    s.y = 3;
    s.hero.gold = 30;
    expect(s.maps[0][3][2]).toBe('s');
    const n = buy(s, 'attack');
    expect(n.hero.attack).toBe(s.hero.attack + 4);
    expect(n.hero.gold).toBe(15);
    expect(buy({ ...s, x: 3 }, 'attack')).toEqual({ ...s, x: 3 });
  });
  it('拒绝不合法存档', () => {
    expect(validTower({})).toBe(false);
    expect(validTower({ ...createTower(), floor: 10 })).toBe(false);
  });
});
