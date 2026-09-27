import Dexie, { type Table } from 'dexie';
import type { SaveRecord, SaveRepository } from '@game-box/sdk';
export class LocalSaves implements SaveRepository {
  private db: Dexie;
  private current: Table<SaveRecord, string>;
  private previous: Table<SaveRecord, string>;
  private queue: Promise<void> = Promise.resolve();
  constructor(name = 'game-box') {
    this.db = new Dexie(name);
    this.db.version(1).stores({ saves: 'gameId', backups: 'gameId', archives: '++id,gameId' });
    this.current = this.db.table('saves');
    this.previous = this.db.table('backups');
  }
  read(id: string) {
    return this.current.get(id);
  }
  backup(id: string) {
    return this.previous.get(id);
  }
  write(record: SaveRecord) {
    const copy = structuredClone(record);
    const task = this.queue.then(() =>
      this.db.transaction('rw', this.current, this.previous, async () => {
        const old = await this.current.get(copy.gameId);
        if (old) await this.previous.put(old);
        await this.current.put(copy);
      }),
    );
    this.queue = task.catch(() => {});
    return task;
  }
  async remove(id: string) {
    await this.queue;
    await this.db.transaction('rw', this.current, this.previous, async () => {
      await this.current.delete(id);
      await this.previous.delete(id);
    });
  }
  async archiveAndClear(id: string) {
    await this.queue;
    await this.db.transaction(
      'rw',
      this.current,
      this.previous,
      this.db.table('archives'),
      async () => {
        const current = await this.current.get(id);
        const backup = await this.previous.get(id);
        if (current || backup)
          await this.db
            .table('archives')
            .add({ gameId: id, current, backup, archivedAt: Date.now() });
        await this.current.delete(id);
        await this.previous.delete(id);
      },
    );
  }
  close() {
    this.db.close();
  }
}
