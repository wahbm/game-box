import type { GameManifest } from '@game-box/sdk';
export const manifest: GameManifest = {
  id: 'spider',
  name: '蜘蛛纸牌',
  description: '一张一弛，整理思绪，也整理一副好牌。',
  cover: '♠',
  version: '1.0.0',
  saveVersion: 1,
  contentVersion: 1,
  rules:
    '单花色蜘蛛纸牌：将连续降序牌组移到大一的牌下或空列。完整 K 到 A 自动收集，收齐八组获胜。有空列时不能补发。点击牌组后点击目标列，或拖动牌组；支持撤销全部操作。',
  load: () => import('./index'),
};
