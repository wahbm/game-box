import { Component, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { GameContext, GameInstance } from '@game-box/sdk';
export interface Controller<S> {
  get(): S;
  set(state: S): void;
  paused(): boolean;
  subscribe(listener: () => void): () => void;
}
class Boundary extends Component<
  { children: ReactNode; onError(error: unknown): void },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? (
      <p role="alert">游戏遇到错误，请返回大厅后重试。</p>
    ) : (
      this.props.children
    );
  }
}
export function mountReact<S>(
  container: HTMLElement,
  context: GameContext,
  initial: S,
  View: (props: { controller: Controller<S> }) => ReactNode,
): GameInstance {
  let state = initial,
    paused = false,
    dead = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  const controller: Controller<S> = {
    get: () => state,
    paused: () => paused || dead,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (next) => {
      if (paused || dead || next === state) return;
      state = next;
      notify();
      context.onChange(state);
    },
  };
  const root = createRoot(container);
  root.render(
    <Boundary onError={context.onError}>
      <View controller={controller} />
    </Boundary>,
  );
  context.onChange(state);
  return {
    pause() {
      paused = true;
      notify();
    },
    resume() {
      paused = false;
      notify();
    },
    snapshot: () => structuredClone(state),
    destroy() {
      dead = true;
      // A host may destroy us during its own React commit. Defer the nested
      // root cleanup until that commit finishes, while blocking input immediately.
      queueMicrotask(() => root.unmount());
      listeners.clear();
    },
  };
}
export function useGame<S>(controller: Controller<S>) {
  const state = useSyncExternalStore(controller.subscribe, controller.get);
  const paused = useSyncExternalStore(controller.subscribe, controller.paused);
  return { state, paused, commit: controller.set };
}
export function Stats({ children }: { children: ReactNode }) {
  return <div className="game-stats">{children}</div>;
}
export function Victory({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="victory" role="status">
      <span>✦</span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
