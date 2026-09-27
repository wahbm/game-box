import { useEffect } from 'react';
import type { GameContext } from '@game-box/sdk';
import { mountReact, useGame, Stats, Victory, type Controller } from '@game-box/ui';
import { createTower, walk, buy, rewind, damage, floors, validate, type TowerState } from './rules';
export { validate } from './rules';
export function migrate(state: unknown, from: number) {
  if (from !== 1 || !validate(state)) throw new Error('不支持的魔塔存档');
  return state;
}
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
  B: '最终守卫',
  p: '药水',
  g: '金币',
  s: '商店',
};
export function mount(container: HTMLElement, context: GameContext) {
  function View({ controller }: { controller: Controller<TowerState> }) {
    const { state: s, paused, commit } = useGame(controller);
    const f = floors[s.floor];
    const step = (dx: number, dy: number) => {
      if (controller.paused()) return;
      const old = controller.get(),
        next = walk(old, dx, dy);
      commit(next);
      if (next.won && !old.won) context.onWin();
    };
    useEffect(() => {
      const key = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLElement &&
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)
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
        if (d[e.key]) {
          e.preventDefault();
          step(...d[e.key]);
        }
      };
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
    }, []);
    const nearby = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]
      .map(([dx, dy]) => s.maps[s.floor][s.y + dy]?.[s.x + dx])
      .filter((t) => t === 'm' || t === 'B');
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
        <div className="tower-layout">
          <div className="tower-board" aria-label="魔塔地图">
            {s.maps[s.floor].flatMap((row, y) =>
              row.split('').map((t, x) => (
                <div
                  key={`${x},${y}`}
                  title={names[t]}
                  className={`tower-cell cell-${t === '#' ? 'wall' : t === '.' ? 'floor' : t === '<' || t === '>' ? 'stairs' : t} ${s.x === x && s.y === y ? 'hero-cell' : ''}`}
                >
                  {s.x === x && s.y === y ? <span aria-label="勇者">♙</span> : glyph[t]}
                </div>
              )),
            )}
          </div>
          <aside className="hero-panel">
            <div className="hero-avatar">♙</div>
            <h3>探索者</h3>
            <p className="muted">每一步，都离黎明更近。</p>
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
            <div className="enemy-preview">
              <b>战斗预览</b>
              {nearby.length ? (
                nearby.map((t, i) => {
                  const m = t === 'B' ? f.boss : f.monster,
                    loss = damage(s.hero, m);
                  return (
                    <p key={i}>
                      {m.name}
                      <br />
                      预计损失：{Number.isFinite(loss) ? loss : '无法破防'}
                      {loss >= s.hero.hp ? ' · 不可战胜' : ''}
                    </p>
                  );
                })
              ) : (
                <p>靠近怪物后查看预计损失</p>
              )}
            </div>
          </aside>
        </div>
        <p role="status" className="game-message">
          {s.message}
        </p>
        {s.maps[s.floor][s.y][s.x] === 's' && (
          <div className="shop">
            <b>旅人商店 · 每次 {f.shop.cost} 金币</b>
            <div className="game-actions">
              {(['hp', 'attack', 'defense'] as const).map((stat, i) => (
                <button
                  key={stat}
                  disabled={paused || s.hero.gold < f.shop.cost}
                  onClick={() => commit(buy(s, stat))}
                >
                  {['生命', '攻击', '防御'][i]} +{f.shop[stat]}
                </button>
              ))}
            </div>
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
              if (confirm('回到本层入口？本次进入楼层后的全部进度将回退。')) commit(rewind(s));
            }}
          >
            ↶ 回到本层入口
          </button>
        </div>
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
