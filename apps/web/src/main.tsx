import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { GameInstance, GameManifest, GameModule, SaveRecord } from '@game-box/sdk';
import { LocalSaves } from '@game-box/platform';
import { games } from './registry';
import './style.css';
const saves = new LocalSaves();
function currentRoute() {
  return window.location.hash.replace(/^#\/?/, '');
}
function go(id = '') {
  window.location.hash = id ? `/games/${id}` : '/';
}
function Cover({ id, cover }: { id: string; cover: string }) {
  return (
    <div className={`cover cover-${id}`} aria-hidden="true">
      {id === 'link' ? (
        <div className="cover-tiles">
          {['✿', '◆', '☀', '◆', '☀', '✿', '♣', '●', '♣'].map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      ) : id === 'spider' ? (
        <div className="cover-cards">
          {['K', 'Q', 'J'].map((s, i) => (
            <div
              key={s}
              style={{ transform: `translateX(${(i - 1) * 44}px) rotate(${(i - 1) * 13}deg)` }}
            >
              <small>{s} ♠</small>
              <b>♠</b>
            </div>
          ))}
        </div>
      ) : id === 'tower' ? (
        <div className="cover-tower">
          <span className="moon" />
          <span className="tower-shape">♜</span>
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : (
        <span className="generic-cover">{cover}</span>
      )}
    </div>
  );
}
function App() {
  const [route, setRoute] = useState(currentRoute);
  const [records, setRecords] = useState<Record<string, SaveRecord>>({});
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    const listener = () => setRoute(currentRoute());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all(games.map(async (g) => [g.id, await saves.read(g.id)] as const))
      .then((items) => {
        if (active)
          setRecords(
            Object.fromEntries(
              items.filter((item): item is readonly [string, SaveRecord] => item[1] !== undefined),
            ),
          );
      })
      .catch(() => setStorageError('本地存储不可用，游戏可以运行，但进度无法保存。'));
    return () => {
      active = false;
    };
  }, [route]);
  const game = games.find((g) => route === `games/${g.id}`);
  const recent = Object.values(records).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const recentGame = games.find((g) => g.id === recent?.gameId);
  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="拾趣游戏盒首页">
          <span className="brand-icon">✣</span>
          <strong>
            拾趣<span>游戏盒</span>
          </strong>
        </a>
        <nav>
          <a href="#/" className="nav-active">
            游戏大厅
          </a>
          <span className="local-badge">
            <i /> 本地单机
          </span>
        </nav>
      </header>
      {storageError && (
        <div role="alert" className="notice">
          {storageError}
        </div>
      )}
      {game ? (
        <GameHost key={game.id} game={game} />
      ) : route && route !== '/' ? (
        <main className="not-found">
          <h1>这里还没有游戏</h1>
          <button onClick={() => go()}>返回大厅</button>
        </main>
      ) : (
        <main className="lobby">
          <section className="hero">
            <div className="eyebrow">
              <span /> SMALL GAMES, GOOD TIMES
            </div>
            <h1>
              给生活，
              <br />
              留一点<span>好玩的时间。</span>
            </h1>
            <p>
              熟悉的小游戏，随时开启的小快乐。
              <br />
              不用下载，无需登录，挑一个喜欢的开始吧。
            </p>
            <div className="hero-meta">
              <span>✧ 轻松上手</span>
              <span>◷ 随玩随停</span>
              <span>▣ 自动存档</span>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="orbit o1" />
              <span className="orbit o2" />
              <div className="art-square">✿</div>
              <div className="art-card">
                A<br />♠
              </div>
              <div className="art-star">✦</div>
              <span className="art-dot" />
            </div>
          </section>
          {recentGame && (
            <button className="continue-banner" onClick={() => go(recentGame.id)}>
              <span className={`mini-icon ${recentGame.id}`}>{recentGame.cover}</span>
              <span>
                <b>接着上次的快乐</b>
                <small>{recentGame.name} · 进度已保存在这台设备</small>
              </span>
              <strong>继续游戏 ↗</strong>
            </button>
          )}
          <section className="library">
            <div className="section-title">
              <div>
                <span className="eyebrow">YOUR LITTLE ESCAPE</span>
                <h2>
                  挑一款，放松一下 <span>{String(games.length).padStart(2, '0')}</span>
                </h2>
              </div>
              <span className="muted">经典玩法 · 简单快乐</span>
            </div>
            <div className="game-grid">
              {games.map((g, i) => (
                <article className="game-card" key={g.id}>
                  <button
                    className="cover-button"
                    aria-label={`进入${g.name}`}
                    onClick={() => go(g.id)}
                  >
                    <Cover id={g.id} cover={g.cover} />
                    <span className="cover-number">0{i + 1}</span>
                    <span className="cover-arrow">↗</span>
                  </button>
                  <div className="card-body">
                    <div className="card-tags">
                      <span>{['益智消除', '经典纸牌', '策略冒险'][i] ?? '轻松游玩'}</span>
                      <span>{['10 个关卡', '单花色', '原创 10 层'][i] ?? '单机游戏'}</span>
                    </div>
                    <h3>{g.name}</h3>
                    <p>{g.description}</p>
                    <button className="play-button" onClick={() => go(g.id)}>
                      {records[g.id] ? '继续游戏' : '开始游戏'}
                      <span>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="bottom-note">
            <span>✧</span>
            <div>
              <b>小小的游戏，慢慢地玩。</b>
              <p>没有倒计时的催促，只有属于你的节奏。</p>
            </div>
            <span className="coming">更多好玩，正在路上 ···</span>
          </section>
        </main>
      )}
      <footer>
        <span>✣ 拾趣 · 把快乐装进口袋</span>
        <span>进度仅保存在当前浏览器</span>
      </footer>
    </div>
  );
}
function GameHost({ game }: { game: GameManifest }) {
  const container = useRef<HTMLDivElement>(null),
    instance = useRef<GameInstance | null>(null);
  const [paused, setPaused] = useState(false),
    [rules, setRules] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loaded, setLoaded] = useState(false),
    [attempt, retry] = useState(0),
    [corrupt, setCorrupt] = useState(false),
    [won, setWon] = useState(false);
  const recovery = useRef<{ module: GameModule; backup?: unknown } | null>(null);
  const choice = useRef<{ state?: unknown } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError('');
    setCorrupt(false);
    setWon(false);
    setPaused(false);
    async function start() {
      try {
        const module = await game.load();
        let state: unknown;
        let stored: SaveRecord | undefined;
        try {
          stored = await saves.read(game.id);
        } catch {
          setNotice('本地存储不可用，进度无法保存。');
        }
        const decode = (record: SaveRecord) => {
          if (
            record.gameId !== game.id ||
            (record.contentVersion !== game.contentVersion &&
              !game.compatibleContentVersions?.includes(record.contentVersion))
          )
            throw new Error('内容版本不兼容');
          const value = module.migrate(record.state, record.schemaVersion);
          if (!module.validate(value)) throw new Error('存档无效');
          return value;
        };
        if (choice.current) {
          state = choice.current.state;
          choice.current = null;
        } else if (stored) {
          try {
            state = decode(stored);
          } catch {
            let backup: unknown;
            try {
              const record = await saves.backup(game.id);
              if (record) backup = decode(record);
            } catch {
              /* Keep both originals until explicit recovery. */
            }
            if (!cancelled) {
              recovery.current = { module, backup };
              setCorrupt(true);
            }
            return;
          }
        }
        if (cancelled || !container.current) return;
        instance.current = module.mount(container.current, {
          initialState: state,
          settings: {
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          },
          onChange: (state) => {
            if (cancelled) return;
            setWon(false);
            void saves
              .write({
                gameId: game.id,
                schemaVersion: game.saveVersion,
                contentVersion: game.contentVersion,
                updatedAt: Date.now(),
                state,
              })
              .catch(() => {
                if (!cancelled) setNotice('保存失败：进度暂未保存，请检查浏览器存储空间。');
              });
          },
          onWin: () => setWon(true),
          onError: () => {
            instance.current?.pause();
            setError('游戏运行出现错误，可以重试或返回大厅。');
          },
        });
        setLoaded(true);
        if (document.hidden) {
          instance.current.pause();
          setPaused(true);
        }
      } catch {
        if (!cancelled) setError('游戏加载失败，请检查网络后重试。');
      }
    }
    void start();
    const visibility = () => {
      if (document.hidden) {
        instance.current?.pause();
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
      instance.current?.destroy();
      instance.current = null;
    };
  }, [game, attempt]);
  async function recover(state?: unknown) {
    try {
      await saves.archiveAndClear(game.id);
      choice.current = { state };
      recovery.current = null;
      retry((n) => n + 1);
    } catch {
      setError('无法归档原存档，请检查存储权限后重试。');
    }
  }
  async function restart() {
    if (confirm('开始新游戏？当前进度会被替换，原存档将归档保留。')) {
      instance.current?.pause();
      await recover();
    }
  }
  function toggle() {
    if (paused) {
      instance.current?.resume();
      setPaused(false);
    } else {
      instance.current?.pause();
      setPaused(true);
    }
  }
  return (
    <main className={`game-page game-${game.id}`}>
      <div className="breadcrumb">
        <button onClick={() => go()}>← 游戏大厅</button>
        <span>/ {game.name}</span>
      </div>
      <div className="game-heading">
        <div>
          <span className="eyebrow">TAKE YOUR TIME</span>
          <h1>{game.name}</h1>
        </div>
        <div className="toolbar">
          <button disabled={!loaded || !!error} onClick={toggle}>
            {paused ? '▶ 继续' : 'Ⅱ 暂停'}
          </button>
          <button disabled={!loaded || !!error} onClick={() => void restart()}>
            ↻ 新游戏
          </button>
          <button
            onClick={() => {
              instance.current?.pause();
              setPaused(true);
              setRules(true);
            }}
          >
            ⓘ 玩法
          </button>
        </div>
      </div>
      {notice && (
        <div className="notice" role="alert">
          {notice}
        </div>
      )}
      {won && (
        <div className="success" role="status">
          ✦ 恭喜完成挑战！
        </div>
      )}
      {error && (
        <div className="error-panel" role="alert">
          <h2>{error}</h2>
          <button onClick={() => retry((n) => n + 1)}>重试</button>
          <button onClick={() => go()}>返回大厅</button>
        </div>
      )}
      {corrupt && (
        <div className="error-panel">
          <h2>这份存档暂时无法读取</h2>
          <p>原数据会归档保留，不会直接覆盖。</p>
          {recovery.current?.backup !== undefined && (
            <button onClick={() => void recover(recovery.current!.backup)}>
              恢复上一份有效备份
            </button>
          )}
          <button onClick={() => void recover()}>保留原数据并开始新游戏</button>
          <button onClick={() => go()}>返回大厅</button>
        </div>
      )}
      {!loaded && !error && !corrupt && <p className="loading">正在打开一点小快乐…</p>}
      <div className="game-stage">
        <div ref={container} />
        {paused && loaded && !rules && !error && (
          <div className="pause-overlay">
            <span>Ⅱ</span>
            <h2>休息一下也很好</h2>
            <p>你的游戏正在等你。</p>
            <button className="primary" onClick={toggle}>
              继续游戏 →
            </button>
          </div>
        )}
      </div>
      {rules && (
        <div className="modal-scrim">
          <section className="modal" role="dialog" aria-modal="true" aria-label="玩法说明">
            <span className="eyebrow">HOW TO PLAY</span>
            <h2>{game.name} · 玩法</h2>
            <p>{game.rules}</p>
            <button
              className="primary"
              autoFocus
              onClick={() => {
                setRules(false);
                instance.current?.resume();
                setPaused(false);
              }}
            >
              知道了，继续游戏
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
