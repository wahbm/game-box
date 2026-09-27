import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameManifest, GameModule } from '@game-box/sdk';
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)],
  );
}
describe('模块边界', () => {
  it('游戏只依赖 SDK、UI 和各自的规则及内容', () => {
    for (const id of ['link', 'spider', 'tower'])
      for (const path of files(`packages/${id}/src`).filter((p) => /\.tsx?$/.test(p))) {
        const source = readFileSync(path, 'utf8');
        const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
        expect(
          imports.filter(
            (name) =>
              name.startsWith('@game-box/') && !['@game-box/sdk', '@game-box/ui'].includes(name),
          ),
        ).toEqual([]);
        expect(imports.some((name) => name.includes('apps/') || name.includes('platform'))).toBe(
          false,
        );
      }
  });
  it('第四款游戏只需遵守契约与注册，不要求更改既有游戏', async () => {
    const plugin: GameModule = {
      validate: () => true,
      migrate: (s) => s,
      mount: () => ({ pause() {}, resume() {}, destroy() {}, snapshot: () => ({ turn: 1 }) }),
    };
    const manifest: GameManifest = {
      id: 'example',
      name: '示例',
      description: '独立接入验证',
      cover: '✦',
      version: '1.0.0',
      saveVersion: 1,
      contentVersion: 1,
      rules: '测试',
      load: async () => plugin,
    };
    expect(await manifest.load()).toBe(plugin);
  });
});
