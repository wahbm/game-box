import { useEffect, useRef, useState } from 'react';
import type { GameContext } from '@game-box/sdk';
import { mountReact, useGame, Stats, Victory, type Controller } from '@game-box/ui';
import {
  createTower,
  walk,
  buy,
  rewind,
  damage,
  floorFor,
  itemsFor,
  monsterAt,
  shopCost,
  battlePreview,
  validate,
  type TowerState,
  type Monster,
} from './rules';
export { validate, migrate } from './rules';
const glyph: Record<string, string> = {
  '#': '',
  '.': '',
  '<': '↙',
  '>': '↗',
  k: '⚿',
  a: '◆',
  v: '◆',
  d: '▥',
  m: '♟',
  e: '♞',
  B: '♜',
  p: '✚',
  g: '●',
  s: '⚖',
};
const names: Record<string, string> = {
  '#': '石墙',
  '.': '道路',
  '<': '下楼',
  '>': '上楼',
  k: '黄钥匙',
  a: '红宝石',
  v: '蓝宝石',
  d: '黄门',
  m: '怪物',
  e: '精英',
  B: '最终守卫',
  p: '药水',
  g: '金币',
  s: '商店',
};
function description(s: TowerState, t: string): string {
  const items = itemsFor(s);
  return (
    (
      {
        '.': '可以通行。使用方向按钮或键盘移动。',
        '<': s.floor === 0 ? '旅程的起点。' : '返回下一层，已拾取的物品不会重生。',
        '>': '前往上一层，并记录新的楼层入口快照。',
        k: '黄钥匙 +1。可以留给后续楼层，也可以用来打开捷径。',
        d: `需要 1 把黄钥匙；当前拥有 ${s.hero.keys} 把。`,
        a: `永久攻击 +${items.attack}。提高每次伤害，可能减少敌人反击次数。`,
        v: `永久防御 +${items.defense}。降低每次反击伤害。`,
        p: `生命 +${items.potion}，没有生命上限。`,
        g: `金币 +${items.gold}，用于商店购买属性。`,
        s: '走到商店即可交易。购买立即生效，也可以存下金币。',
      } as Record<string, string>
    )[t] ?? '点击方向按钮接近目标，先查看战损再行动。'
  );
}
function EnemyCard({ s, monster, label }: { s: TowerState; monster: Monster; label: string }) {
  const result = battlePreview(s.hero, monster);
  return (
    <article className={`tower-enemy ${result.canWin ? 'winnable' : 'danger'}`}>
      <div className="enemy-title">
        <h4>{monster.name}</h4>
        <span>{label}</span>
      </div>
      <div className="monster-attributes">
        <span>
          生命 <b>{monster.hp}</b>
        </span>
        <span>
          攻击 <b>{monster.attack}</b>
        </span>
        <span>
          防御 <b>{monster.defense}</b>
        </span>
        <span>
          金币 <b>+{monster.gold}</b>
        </span>
      </div>
      <div className="battle-result">
        <strong>{result.reason}</strong>
        <span>
          预计损失 <b>{Number.isFinite(result.loss) ? result.loss : '—'}</b> · 战后生命{' '}
          <b>{result.remaining}</b>
        </span>
      </div>
      <p>
        {result.hit
          ? `每击 ${result.hit} 伤害 · ${result.turns} 回合 · 敌人反击 ${result.turns - 1} 次（每次 ${result.retaliation}）`
          : `至少还需 ${monster.defense - s.hero.attack + 1} 点攻击才能破防。`}
      </p>
    </article>
  );
}
export function mount(container: HTMLElement, context: GameContext) {
  function View({ controller }: { controller: Controller<TowerState> }) {
    const { state: s, paused, commit } = useGame(controller);
    const [selection, setSelection] = useState<{ floor: number; x: number; y: number } | null>(
      null,
    );
    const inspectorRef = useRef<HTMLElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (selection && window.matchMedia('(max-width: 700px)').matches)
        inspectorRef.current?.scrollIntoView({ block: 'nearest' });
    }, [selection]);
    const f = floorFor(s);
    const inspected = selection?.floor === s.floor ? selection : null;
    const step = (dx: number, dy: number) => {
      if (controller.paused()) return;
      setSelection(null);
      const old = controller.get(),
        next = walk(old, dx, dy);
      commit(next);
      if (next.won && !old.won) context.onWin();
    };
    useEffect(() => {
      const key = (e: KeyboardEvent) => {
        if (
          e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          (e.target instanceof HTMLElement &&
            (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) ||
              e.target.isContentEditable))
        )
          return;
        const d: Record<string, [number, number]> = {
          ArrowUp: [0, -1],
          w: [0, -1],
          ArrowDown: [0, 1],
          s: [0, 1],
          ArrowLeft: [-1, 0],
          a: [-1, 0],
          ArrowRight: [1, 0],
          d: [1, 0],
        };
        const direction = d[e.key] ?? d[e.key.toLowerCase()];
        if (direction) {
          e.preventDefault();
          step(...direction);
        }
      };
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
    }, []);
    const nearby = (
      [
        [0, -1, '上方'],
        [0, 1, '下方'],
        [-1, 0, '左侧'],
        [1, 0, '右侧'],
      ] as const
    ).flatMap(([dx, dy, label]) => {
      const monster = monsterAt(s, s.x + dx, s.y + dy);
      return monster ? [{ monster, label }] : [];
    });
    const selectedTile = inspected ? s.maps[s.floor][inspected.y][inspected.x] : undefined;
    const selectedMonster = inspected ? monsterAt(s, inspected.x, inspected.y) : undefined;
    const remaining = s.maps[s.floor]
      .join('')
      .split('')
      .filter((t) => ['m', 'e', 'B'].includes(t)).length;
    const allMonsters = s.maps[s.floor]
      .flatMap((row, y) =>
        row.split('').flatMap((_, x) => {
          const monster = monsterAt(s, x, y);
          return monster ? [{ monster, distance: Math.abs(x - s.x) + Math.abs(y - s.y) }] : [];
        }),
      )
      .sort((a, b) => a.distance - b.distance);
    const comparison = selectedMonster ?? allMonsters[0]?.monster;
    return (
      <>
        <Stats>
          <span>
            楼层 <b>{String(s.floor + 1).padStart(2, '0')} / 10</b>
          </span>
          <span>{f.name}</span>
          <span>
            钥匙 <b>{s.hero.keys}</b>
          </span>
        </Stats>
        {s.campaignVersion === 1 && (
          <p className="tower-legacy">经典旅程 · 已保留原地图、数值与进度。新游戏将开启升级版。</p>
        )}
        <div className="tower-mission">
          <span>✦ {s.floor === 9 ? '击败长夜守卫，迎接黎明' : '收集资源，找到上楼阶梯 ↗'}</span>
          <small>本层剩余 {remaining} 名敌人 · 不必全部击败</small>
        </div>
        <div className="tower-layout">
          <div className="tower-map-panel" ref={mapRef}>
            <div className="tower-board" aria-label="魔塔地图">
              {s.maps[s.floor].flatMap((row, y) =>
                row.split('').map((t, x) => (
                  <button
                    type="button"
                    key={`${x},${y}`}
                    title={names[t]}
                    aria-label={`查看${names[t]} 第${y + 1}行第${x + 1}列`}
                    aria-pressed={inspected?.x === x && inspected?.y === y}
                    disabled={paused || t === '#'}
                    className={`tower-cell cell-${t === '#' ? 'wall' : t === '.' ? 'floor' : t === '<' || t === '>' ? 'stairs' : t} ${s.x === x && s.y === y ? 'hero-cell' : ''} ${inspected?.x === x && inspected?.y === y ? 'inspected' : ''}`}
                    onClick={() => setSelection({ floor: s.floor, x, y })}
                  >
                    {s.x === x && s.y === y ? <span aria-label="勇者">♙</span> : glyph[t]}
                  </button>
                )),
              )}
            </div>
            <p className="tower-map-help">点击地图格查看详情，不会移动或触发战斗。</p>
            {nearby.length > 0 && (
              <div className="tower-nearby-summary" aria-live="polite">
                {nearby.map(({ monster, label }) => {
                  const report = battlePreview(s.hero, monster);
                  return (
                    <span key={label}>
                      {label} · {monster.name}：
                      {report.canWin
                        ? `损失 ${report.loss}，剩余 ${report.remaining}`
                        : report.reason}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="tower-controls">
              <div className="dpad">
                {(
                  [
                    [0, -1, '↑'],
                    [-1, 0, '←'],
                    [0, 1, '↓'],
                    [1, 0, '→'],
                  ] as const
                ).map(([dx, dy, label], i) => (
                  <button
                    className={`direction direction-${i}`}
                    key={label}
                    aria-label={`向${['上', '左', '下', '右'][i]}移动`}
                    disabled={paused || s.won}
                    onClick={() => step(dx, dy)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                disabled={paused || s.won}
                onClick={() => {
                  if (confirm('回到本层入口？本次进入楼层后的全部进度将回退。')) {
                    setSelection(null);
                    commit(rewind(s));
                  }
                }}
              >
                ↶ 回到本层入口
              </button>
            </div>
          </div>
          <aside className="hero-panel">
            <div className="hero-avatar">♙</div>
            <h3>探索者</h3>
            <p className="muted">先看战损，再做选择。</p>
            <dl>
              {(
                [
                  ['hp', '生命'],
                  ['attack', '攻击'],
                  ['defense', '防御'],
                  ['gold', '金币'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{s.hero[key]}</dd>
                </div>
              ))}
            </dl>
            <div className="tower-advice">
              <b>路线提示</b>
              <p>{f.tip ?? '先收集宝石提升能力。可以往返楼层，也可以回到本层入口重新规划。'}</p>
              <p>玩家先攻；预计生命降至 0 时禁止战斗。</p>
            </div>
          </aside>
        </div>
        <section className="tower-inspector" aria-label="地图详情" ref={inspectorRef}>
          <div className="inspector-heading">
            <h3>{inspected ? '地图详情' : '相邻敌人 · 战斗预览'}</h3>
            {inspected && (
              <button
                disabled={paused}
                onClick={() => {
                  setSelection(null);
                  if (window.matchMedia('(max-width: 700px)').matches)
                    mapRef.current?.scrollIntoView({ block: 'center' });
                }}
              >
                返回附近预览
              </button>
            )}
          </div>
          {selectedMonster ? (
            <EnemyCard
              s={s}
              monster={selectedMonster}
              label={
                selectedTile === 'e'
                  ? '精英 · 高风险高回报'
                  : selectedTile === 'B'
                    ? '最终目标'
                    : '地图目标'
              }
            />
          ) : inspected && selectedTile ? (
            <div className="tile-description">
              <span className={`cell-${selectedTile}`}>{glyph[selectedTile] || '·'}</span>
              <div>
                <b>{names[selectedTile]}</b>
                <p>{description(s, selectedTile)}</p>
              </div>
            </div>
          ) : nearby.length ? (
            <div className="nearby-enemies">
              {nearby.map(({ monster, label }) => (
                <EnemyCard key={label} s={s} monster={monster} label={label} />
              ))}
            </div>
          ) : (
            <p className="inspector-empty">
              附近没有敌人。可以先点击任意怪物，查看属性、奖励和预计战损。
            </p>
          )}
        </section>
        <p role="status" className="game-message">
          {s.message}
        </p>
        {s.maps[s.floor][s.y][s.x] === 's' && (
          <section className="tower-shop" aria-label="旅人商店">
            <h3>
              旅人商店 <span>拥有 {s.hero.gold} 金币</span>
            </h3>
            <p>回复生命应对眼前战斗，或永久提升攻防。也可以暂不购买。</p>
            <div className="shop-offers">
              {(['hp', 'attack', 'defense'] as const).map((stat, i) => {
                const cost = shopCost(s, stat),
                  after = { ...s.hero, [stat]: s.hero[stat] + f.shop[stat] };
                return (
                  <button
                    key={stat}
                    disabled={paused || s.won || s.hero.gold < cost}
                    onClick={() => commit(buy(s, stat))}
                  >
                    <strong>
                      {['生命', '攻击', '防御'][i]} +{f.shop[stat]}
                    </strong>
                    <span>
                      {s.hero[stat]} → {after[stat]}
                    </span>
                    <b>{cost} 金币</b>
                    {comparison && (
                      <small>
                        对{comparison.name}战损：
                        {Number.isFinite(damage(s.hero, comparison))
                          ? damage(s.hero, comparison)
                          : '不可破防'}{' '}
                        →{' '}
                        {Number.isFinite(damage(after, comparison))
                          ? damage(after, comparison)
                          : '不可破防'}
                      </small>
                    )}
                    {s.hero.gold < cost && <small>还差 {cost - s.hero.gold} 金币</small>}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <details className="tower-legend">
          <summary>地图图例与探索规则</summary>
          <div>
            {Object.entries(names)
              .filter(([t]) => t !== '.' && t !== '#' && (t !== 'e' || s.campaignVersion === 2))
              .map(([t, name]) => (
                <span key={t}>
                  <i className={`cell-${t}`}>{glyph[t]}</i>
                  {name}
                </span>
              ))}
          </div>
          <p>
            方向键 / WASD
            或方向按钮移动。黄门消耗一把钥匙；宝石永久增加属性；怪物不会重生。楼梯可往返；回退会恢复进入本层时的全部地图和属性。
          </p>
        </details>
        {s.won && (
          <Victory title="长夜已尽，黎明到来。">
            <p>你登上了十层塔顶，完成了这段旅程。</p>
          </Victory>
        )}
      </>
    );
  }
  return mountReact(
    container,
    context,
    validate(context.initialState) ? context.initialState : createTower(),
    View,
  );
}
