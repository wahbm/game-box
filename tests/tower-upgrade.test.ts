import { describe, expect, it } from 'vitest';
import legacySave from './fixtures/tower-v1.json';
import {
  createTower,
  campaigns,
  floorFor,
  walk,
  buy,
  rewind,
  shopCost,
  monsterAt,
  battlePreview,
  damage,
  migrate,
  validate,
} from '@game-box/tower/rules';
describe('魔塔体验升级', () => {
  for (const strategy of ['attack', 'defense'] as const)
    it(`升级版十层路线可用${strategy === 'attack' ? '攻击' : '防御'}投资通关`, () => {
      let s = createTower();
      for (let f = 0; f < 10; f++) {
        for (const [x, y] of campaigns[2][f].route.slice(1)) {
          const priorFloor = s.floor;
          s = walk(s, x - s.x, y - s.y);
          if (s.floor === priorFloor)
            expect([s.x, s.y], `第${f + 1}层：${s.message}`).toEqual([x, y]);
          if (s.maps[s.floor][s.y][s.x] === 's') s = buy(s, strategy);
          expect(validate(s)).toBe(true);
        }
      }
      expect(s.won).toBe(true);
      expect(s.hero.hp).toBeGreaterThan(0);
    });
  it('旧版固定样本无损迁移，保留地图、属性、楼层及入口快照', () => {
    const s = migrate(legacySave, 1);
    expect(s).toEqual({
      ...legacySave,
      campaignVersion: 1,
      checkpoint: { ...legacySave.checkpoint, campaignVersion: 1 },
    });
    expect(migrate(s, 2)).toEqual(s);
    expect(floorFor(s).monster.hp).toBe(24);
    expect(rewind(s)).toMatchObject({ x: 1, y: 1, hero: legacySave.checkpoint.hero });
    expect(walk(s, 1, 0).hero.keys).toBe(1);
    const potion = { ...s, x: 3, y: 3 };
    expect(walk(potion, 1, 0).hero.hp).toBe(s.hero.hp + 150);
    expect(() => migrate(legacySave, 9)).toThrow();
    expect(() => migrate({ ...legacySave, checkpoint: {} }, 1)).toThrow();
    expect(validate({ ...s, checkpoint: { ...s.checkpoint, campaignVersion: 2 } })).toBe(false);
  });
  it('升级版精英捷径有额外风险与奖励，钥匙资源可选择保留', () => {
    let s = createTower();
    s.x = 3;
    s.y = 1;
    const elite = monsterAt(s, 3, 2)!;
    expect(elite.gold).toBeGreaterThan(floorFor(s).monster.gold);
    expect(damage(s.hero, elite)).toBeGreaterThan(damage(s.hero, floorFor(s).monster));
    const n = walk(s, 0, 1);
    expect(n.hero.hp).toBe(s.hero.hp - damage(s.hero, elite));
    expect(n.hero.gold).toBe(elite.gold);
    expect(monsterAt(n, 3, 2)).toBeUndefined();
    s = { ...createTower(), x: 5, y: 3 };
    s.hero.keys = 1;
    const shortcut = walk(s, 0, 1);
    expect(shortcut.hero.keys).toBe(0);
    expect(shortcut.y).toBe(4);
    expect(walk({ ...s, hero: { ...s.hero, keys: 0 } }, 0, 1).y).toBe(3);
  });
  it('不同投资价格、实际收益与战斗预览一致，金币不足不扣款', () => {
    const s = createTower();
    s.x = 2;
    s.y = 3;
    s.hero.gold = 100;
    expect(shopCost(s, 'hp')).toBe(22);
    expect(shopCost(s, 'attack')).toBe(30);
    expect(shopCost(s, 'defense')).toBe(26);
    for (const stat of ['hp', 'attack', 'defense'] as const) {
      const n = buy(s, stat);
      expect(n.hero.gold).toBe(100 - shopCost(s, stat));
      expect(n.hero[stat]).toBe(s.hero[stat] + floorFor(s).shop[stat]);
    }
    const poor = { ...s, hero: { ...s.hero, gold: 0 } };
    expect(buy(poor, 'attack')).toBe(poor);
    const m = floorFor(s).monster;
    const report = battlePreview(s.hero, m);
    expect(report.loss).toBe(damage(s.hero, m));
    expect(report.remaining).toBe(s.hero.hp - report.loss);
    expect(battlePreview({ ...s.hero, attack: m.defense }, m)).toMatchObject({
      canWin: false,
      hit: 0,
      remaining: 0,
    });
    expect(battlePreview({ ...s.hero, hp: report.loss }, m).canWin).toBe(false);
    expect(battlePreview({ ...s.hero, attack: 999 }, m)).toMatchObject({
      canWin: true,
      turns: 1,
      loss: 0,
    });
  });
});
