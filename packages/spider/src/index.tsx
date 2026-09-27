import { useState } from 'react';
import type { GameContext } from '@game-box/sdk';
import { mountReact, useGame, Stats, Victory, type Controller } from '@game-box/ui';
import { createSpider, move, deal, undo, movable, validate, type SpiderState } from './rules';
export { validate } from './rules';
export function migrate(state: unknown, from: number) {
  if (from !== 1 || !validate(state)) throw new Error('不支持的纸牌存档');
  return state;
}
const rank = (n: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[n] ?? String(n);
export function mount(container: HTMLElement, context: GameContext) {
  function View({ controller }: { controller: Controller<SpiderState> }) {
    const { state: s, paused, commit } = useGame(controller);
    const [selected, select] = useState<[number, number] | null>(null);
    const [zoomed, setZoomed] = useState(false);
    const [message, setMessage] = useState('按 K → A 排列，将八组纸牌送回家。');
    const transfer = (to: number, source = selected) => {
      if (!source || paused) return;
      const n = move(s, source[0], source[1], to);
      if (n !== s) {
        commit(n);
        select(null);
        setMessage('移动成功。');
        if (n.completed.length === 8) context.onWin();
      } else setMessage('只能接在大一点的牌下，或移入空列。');
    };
    return (
      <>
        <Stats>
          <span>
            已收集 <b>{s.completed.length} / 8</b>
          </span>
          <span>
            步数 <b>{s.moves}</b>
          </span>
          <span>
            待发牌 <b>{s.stock.length} 组</b>
          </span>
        </Stats>
        <div className={`spider-table ${zoomed ? 'zoomed' : ''}`}>
          <div className="spider-columns">
            {s.columns.map((column, c) => (
              <div
                className="card-column"
                key={c}
                style={{ minHeight: Math.max(290, column.length * 29 + 85) }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const source = e.dataTransfer.getData('text/plain').split(',').map(Number);
                  if (source.length === 2) transfer(c, source as [number, number]);
                }}
              >
                <button
                  className="empty-column"
                  aria-label={`空列 ${c + 1}`}
                  disabled={paused}
                  onClick={() => transfer(c)}
                >
                  ♠
                </button>
                {column.map((card, i) => (
                  <button
                    key={card.id}
                    aria-label={`第${c + 1}列 ${card.up ? rank(card.rank) : '背面'} 第${i + 1}张`}
                    draggable={!paused && movable(column, i)}
                    onDragStart={(e) => {
                      select([c, i]);
                      e.dataTransfer.setData('text/plain', `${c},${i}`);
                    }}
                    disabled={paused || !card.up}
                    className={`playing-card ${i < column.length - 1 ? 'covered' : ''} ${card.up ? '' : 'face-down'} ${selected?.[0] === c && i >= selected[1] ? 'selected' : ''}`}
                    style={{ top: i * 29 }}
                    onClick={() => {
                      if (selected && selected[0] !== c) {
                        transfer(c);
                        return;
                      }
                      if (movable(column, i))
                        select(selected?.[0] === c && selected[1] === i ? null : [c, i]);
                      else setMessage('请选择一张牌或连续降序牌组。');
                    }}
                  >
                    {card.up && (
                      <>
                        <span>{rank(card.rank)} ♠</span>
                        <strong>♠</strong>
                      </>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="spider-bottom">
            <div className="completed-piles">
              {Array.from({ length: 8 }, (_, i) => (
                <span className={i < s.completed.length ? 'filled' : ''} key={i}>
                  ♠
                </span>
              ))}
            </div>
            <button
              disabled={paused || !s.stock.length || s.columns.some((c) => !c.length)}
              onClick={() => {
                const n = deal(s);
                commit(n);
                select(null);
                if (n.completed.length === 8) context.onWin();
              }}
            >
              补发一组 · {s.stock.length}
            </button>
          </div>
        </div>
        <p role="status" className="game-message">
          {s.columns.some((c) => !c.length) && s.stock.length
            ? '填满所有空列后，才能补发。'
            : message}
        </p>
        <div className="game-actions">
          <button onClick={() => setZoomed(!zoomed)}>{zoomed ? '缩小牌面' : '放大牌面'}</button>
          <button
            disabled={paused || !s.history.length}
            onClick={() => {
              commit(undo(s));
              select(null);
              setMessage('已撤销上一步。');
            }}
          >
            ↶ 撤销一步
          </button>
          <button disabled={paused || !selected} onClick={() => select(null)}>
            取消选择
          </button>
        </div>
        {s.completed.length === 8 && <Victory title="八组归位，恭喜获胜！" />}
      </>
    );
  }
  return mountReact(
    container,
    context,
    validate(context.initialState) ? context.initialState : createSpider(),
    View,
  );
}
