import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalSaves } from '@game-box/platform';
import { migrate } from '../packages/link/src/index';
import { createLink } from '@game-box/link/rules';
const record = (moves: number) => ({
  gameId: 'link',
  schemaVersion: 1,
  contentVersion: 1,
  updatedAt: moves,
  state: { ...createLink(1, 10), moves },
});
describe('本地存档', () => {
  it('顺序写入、快照隔离、当前及上一份备份、删除', async () => {
    const db = new LocalSaves(`test-${Math.random()}`);
    const first = record(1);
    const a = db.write(first);
    first.state.moves = 100;
    await a;
    expect((await db.read('link'))?.state).toEqual(record(1).state);
    await Promise.all([db.write(record(2)), db.write(record(3))]);
    expect(await db.read('link')).toEqual(record(3));
    expect(await db.backup('link')).toEqual(record(2));
    await db.remove('link');
    expect(await db.read('link')).toBeUndefined();
    expect(await db.backup('link')).toBeUndefined();
    db.close();
  });
  it('损坏原数据可归档而非覆盖，保留备份供恢复', async () => {
    const db = new LocalSaves(`test-${Math.random()}`);
    await db.write(record(1));
    await db.write({ ...record(2), state: { bad: true } });
    expect(() => migrate({ bad: true }, 1)).toThrow();
    expect(migrate((await db.backup('link'))!.state, 1)).toEqual(record(1).state);
    await db.archiveAndClear('link');
    expect(await db.read('link')).toBeUndefined();
    db.close();
  });
  it('同版恢复及不兼容版本拒绝', () => {
    expect(migrate(record(1).state, 1)).toEqual(record(1).state);
    expect(() => migrate(record(1).state, 99)).toThrow();
  });
  it('存储关闭时显式拒绝写入', async () => {
    const db = new LocalSaves(`test-${Math.random()}`);
    await db.write(record(1));
    db.close();
    await expect(db.write(record(2))).rejects.toThrow();
  });
});
