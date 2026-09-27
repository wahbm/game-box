import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameContext } from '@game-box/sdk';
import { mountReact, useGame, Stats, Victory, type Controller } from '@game-box/ui';
import {
  createLink,
  match,
  path,
  hint,
  reshuffle,
  validate,
  type LinkState,
  type Point,
} from './rules';
export { validate } from './rules';
export function migrate(state: unknown, from: number) {
  if (from !== 1 || !validate(state)) throw new Error('不支持的连连看存档');
  return state;
}
const symbols = ['', '✿', '◆', '☀', '♣', '●', '★', '♥', '☾', '✦', '▲', '⬟', '❖'];
export function mount(container: HTMLElement, context: GameContext) {
  function View({ controller }: { controller: Controller<LinkState> }) {
    const { state: s, paused, commit } = useGame(controller);
    const [selected, select] = useState<number | null>(null);
    const [marked, mark] = useState<number[]>([]);
    const surface = useRef<HTMLDivElement>(null);
    const [trail, setTrail] = useState<{ points: Point[]; symbol: string } | null>(null);
    const [geometry, setGeometry] = useState({
      x: 0,
      y: 0,
      pitchX: 0,
      pitchY: 0,
      width: 1,
      height: 1,
    });
    useLayoutEffect(() => {
      const element = surface.current!;
      const measure = () => {
        const box = element.getBoundingClientRect();
        const tiles = element.querySelectorAll('button');
        const first = tiles[0].getBoundingClientRect();
        const second = tiles[1].getBoundingClientRect();
        const below = tiles[s.cols].getBoundingClientRect();
        setGeometry({
          x: first.left - box.left + first.width / 2,
          y: first.top - box.top + first.height / 2,
          pitchX: second.left - first.left,
          pitchY: below.top - first.top,
          width: box.width,
          height: box.height,
        });
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }, [s.rows]);
    useEffect(() => {
      if (!trail) return;
      const timer = window.setTimeout(() => setTrail(null), 900);
      return () => window.clearTimeout(timer);
    }, [trail]);
    useEffect(() => {
      if (paused) setTrail(null);
    }, [paused]);
    const [message, setMessage] = useState('找到相同的图案，让它们相遇。');
    const click = (i: number) => {
      if (paused || !s.board[i]) return;
      setTrail(null);
      if (selected === null) {
        select(i);
        mark([]);
        setMessage('已选中一个图案，请选择相同的图案。');
        return;
      }
      if (selected === i) {
        select(null);
        setMessage('已取消选择，请选择两个相同的图案。');
        return;
      }
      if (s.board[selected] !== s.board[i]) {
        select(i);
        mark([]);
        setMessage('这两个图案不同，只有相同图案才能配对。已选中后一个图案。');
        return;
      }
      const next = match(s, selected, i);
      if (next !== s) {
        setTrail({
          points: path(s.board, s.rows, s.cols, selected, i)!,
          symbol: symbols[s.board[i]],
        });
        commit(next);
        select(null);
        mark([]);
        setMessage('漂亮！继续寻找下一对。');
        if (next.won && next.level === 10) context.onWin();
      } else {
        select(i);
        mark([]);
        setMessage('图案相同，但路径被阻挡或需要超过两次折弯。试试其他组合。');
      }
    };
    return (
      <>
        <Stats>
          <span>
            关卡 <b>{String(s.level).padStart(2, '0')} / 10</b>
          </span>
          <span>
            剩余 <b>{s.board.filter(Boolean).length / 2} 对</b>
          </span>
          <span>
            步数 <b>{s.moves}</b>
          </span>
        </Stats>
        <p className="link-instructions">相同图案 · 最多两次折弯 · 可以绕过棋盘外侧</p>
        <div className="link-surface" ref={surface}>
          <div className="link-board" style={{ gridTemplateColumns: `repeat(${s.cols},1fr)` }}>
            {s.board.map((v, i) => (
              <button
                key={i}
                aria-label={`图案 ${v} 位置 ${i}`}
                disabled={!v || paused}
                aria-pressed={selected === i}
                className={`tile color-${v % 6} ${selected === i ? 'selected' : ''} ${marked.includes(i) ? 'hinted' : ''} ${!v ? 'empty' : ''}`}
                onClick={() => click(i)}
              >
                {symbols[v]}
              </button>
            ))}
          </div>
          {trail && (
            <svg
              className="link-route"
              role="img"
              aria-label="成功配对的连接路径"
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            >
              <polyline
                points={trail.points
                  .map(
                    ([r, c]) =>
                      `${geometry.x + c * geometry.pitchX},${geometry.y + r * geometry.pitchY}`,
                  )
                  .join(' ')}
              />
              {[trail.points[0], trail.points[trail.points.length - 1]].map(([r, c], i) => (
                <g
                  key={i}
                  transform={`translate(${geometry.x + c * geometry.pitchX} ${geometry.y + r * geometry.pitchY})`}
                >
                  <circle r={geometry.pitchX * 0.28} />
                  <text textAnchor="middle" dominantBaseline="central">
                    {trail.symbol}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
        <div className="link-legend">
          <span>
            <i className="selection-key" />
            当前选中
          </span>
          <span>
            <i className="hint-key" />
            提示配对
          </span>
        </div>
        <p className="game-message" role="status">
          {message}
        </p>
        <div className="game-actions">
          <button
            disabled={paused || s.won}
            onClick={() => {
              setTrail(null);
              mark(hint(s) ?? []);
              select(null);
              setMessage('已标出可以配对的相同图案，点击它们即可消除。');
            }}
          >
            ✧ 提示一对
          </button>
          <button
            disabled={paused || s.won}
            onClick={() => {
              setTrail(null);
              commit(reshuffle(s));
              select(null);
              mark([]);
              setMessage('已重新排列，请选择两个相同的图案。');
            }}
          >
            ↻ 重新排列
          </button>
        </div>
        {s.won && (
          <Victory title={s.level === 10 ? '十关通关，眼力出众！' : '这一关，完成！'}>
            {s.level < 10 && (
              <button
                className="primary"
                onClick={() => {
                  setTrail(null);
                  setMessage('新的关卡开始了，找到相同的图案吧。');
                  commit(createLink(s.level + 1, s.seed + 1));
                  select(null);
                  mark([]);
                }}
              >
                下一关 →
              </button>
            )}
          </Victory>
        )}
      </>
    );
  }
  return mountReact(
    container,
    context,
    validate(context.initialState) ? context.initialState : createLink(),
    View,
  );
}
