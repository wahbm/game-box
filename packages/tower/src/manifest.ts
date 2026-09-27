import type { GameManifest } from '@game-box/sdk';
export const manifest: GameManifest = {
  id: 'tower',
  name: '魔塔',
  description: '带上勇气与一把钥匙，去寻找塔顶的黎明。',
  cover: '♜',
  version: '1.0.0',
  saveVersion: 1,
  contentVersion: 1,
  rules:
    '使用方向键、WASD 或屏幕方向按钮移动。钥匙打开黄门，宝石提升攻防，药水恢复生命。相邻敌人会显示预计战损，不可战胜时禁止战斗。楼梯可往返，商店可购买属性；回退恢复进入本层时的完整状态。击败十层最终守卫获胜。',
  load: () => import('./index'),
};
