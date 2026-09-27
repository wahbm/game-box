import type { GameManifest } from '@game-box/sdk';
export const manifest: GameManifest = {
  id: 'link',
  name: '连连看',
  description: '让相同的图案相遇，在方寸之间找回专注。',
  cover: '✿',
  version: '1.0.0',
  saveVersion: 1,
  contentVersion: 1,
  rules:
    '相同图案最多经过两次折弯即可消除，路径可以经过棋盘外侧。没有时间限制，随时使用提示或洗牌。完成十个关卡即可通关。',
  load: () => import('./index'),
};
