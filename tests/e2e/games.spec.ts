import { test, expect, type Page } from '@playwright/test';
import { createLink, hint } from '@game-box/link/rules';
import { createSpider, type SpiderState } from '@game-box/spider/rules';
import { createTower, floors } from '@game-box/tower/rules';
import legacyTower from '../fixtures/tower-v1.json';
async function seed(page: Page, id: string, state: unknown, backup?: unknown, legacy = false) {
  await page.goto('/');
  await page.evaluate(
    async ({ id, state, backup, legacy }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('game-box', 10);
        request.onupgradeneeded = () => {
          for (const name of ['saves', 'backups'])
            if (!request.result.objectStoreNames.contains(name))
              request.result.createObjectStore(name, { keyPath: 'gameId' });
          if (!request.result.objectStoreNames.contains('archives'))
            request.result.createObjectStore('archives', { autoIncrement: true, keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['saves', 'backups'], 'readwrite');
          tx.objectStore('saves').put({
            gameId: id,
            schemaVersion: id === 'tower' && !legacy ? 2 : 1,
            contentVersion: id === 'tower' && !legacy ? 2 : 1,
            updatedAt: Date.now(),
            state,
          });
          if (backup)
            tx.objectStore('backups').put({
              gameId: id,
              schemaVersion: id === 'tower' && !legacy ? 2 : 1,
              contentVersion: id === 'tower' && !legacy ? 2 : 1,
              updatedAt: Date.now() - 1,
              state: backup,
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { id, state, backup, legacy },
  );
  await page.goto(`/#/games/${id}`);
}
async function saved(page: Page, id: string): Promise<any> {
  return page.evaluate(
    (id) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('game-box');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction('saves').objectStore('saves').get(id);
          q.onsuccess = () => {
            resolve(q.result?.state);
            db.close();
          };
        };
      }),
    id,
  );
}
for (const [id, name] of [
  ['link', '连连看'],
  ['spider', '蜘蛛纸牌'],
  ['tower', '魔塔'],
])
  test(`${name}：打开、暂停、说明、刷新续玩、重新开始、返回`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('/');
    await page.getByRole('button', { name: `进入${name}`, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ⅱ 暂停', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();
    await expect(page.getByText('休息一下也很好')).toBeVisible();
    await page.getByRole('button', { name: '继续游戏 →', exact: true }).click();
    await page.getByRole('button', { name: 'ⓘ 玩法' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '知道了，继续游戏' }).click();
    if (id === 'tower') await page.getByRole('button', { name: '向右移动' }).click();
    if (id === 'spider') await page.getByRole('button', { name: /补发一组/ }).click();
    await expect.poll(() => saved(page, id)).toBeTruthy();
    const before = await saved(page, id);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ⅱ 暂停', exact: true })).toBeEnabled();
    expect(await saved(page, id)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: '↻ 新游戏' }).click();
    expect(await saved(page, id)).toEqual(before);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '↻ 新游戏' }).click();
    await expect(page.getByRole('button', { name: 'Ⅱ 暂停', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '← 游戏大厅' }).click();
    await expect(page.getByText('接着上次的快乐')).toBeVisible();
    expect(errors).toEqual([]);
  });
test('连连看：点击消除和十关结算', async ({ page }) => {
  const s = createLink(10, 11);
  s.board = s.board.map(() => 0);
  s.board[0] = s.board[1] = 1;
  await seed(page, 'link', s);
  await page.getByRole('button', { name: '图案 1 位置 0', exact: true }).click();
  await page.getByRole('button', { name: '图案 1 位置 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '十关通关，眼力出众！' })).toBeVisible();
  await expect.poll(async () => (await saved(page, 'link'))?.won).toBe(true);
});
test('连连看：正常配对后刷新保存步数', async ({ page }) => {
  const s = createLink(1, 17),
    pair = hint(s)!;
  await seed(page, 'link', s);
  for (const i of pair)
    await page.getByRole('button', { name: `图案 ${s.board[i]} 位置 ${i}`, exact: true }).click();
  await expect.poll(async () => (await saved(page, 'link'))?.moves).toBe(1);
  await page.reload();
  await expect(page.locator('.game-stats')).toContainText('步数 1');
});
test('蜘蛛：完成收牌并撤销胜利', async ({ page }) => {
  const s: SpiderState = createSpider(1);
  s.columns = Array.from({ length: 10 }, () => []);
  s.stock = [];
  s.completed = Array.from({ length: 7 }, (_, g) =>
    Array.from({ length: 13 }, (_, i) => ({ id: g * 13 + 12 - i, rank: 13 - i, up: true })),
  );
  s.columns[0] = Array.from({ length: 13 }, (_, i) => ({ id: 103 - i, rank: 13 - i, up: true }));
  await seed(page, 'spider', s);
  await page.getByRole('button', { name: '第1列 K 第1张', exact: true }).click();
  await page.getByRole('button', { name: '空列 2', exact: true }).click();
  await expect(page.getByRole('heading', { name: '八组归位，恭喜获胜！' })).toBeVisible();
  await page.getByRole('button', { name: '↶ 撤销一步' }).click();
  await expect(page.getByRole('heading', { name: '八组归位，恭喜获胜！' })).not.toBeVisible();
  await expect.poll(async () => (await saved(page, 'spider'))?.completed.length).toBe(7);
});
test('魔塔：塔顶战斗结算与离开后的键盘清理', async ({ page }) => {
  const s = createTower();
  s.floor = 9;
  [s.x, s.y] = floors[9].route.at(-2)!;
  s.hero.attack = 500;
  s.hero.defense = 500;
  await seed(page, 'tower', s);
  await expect(page.getByRole('heading', { name: '长夜守卫', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '向右移动' }).click();
  await expect(page.getByRole('heading', { name: '长夜已尽，黎明到来。' })).toBeVisible();
  await expect.poll(async () => (await saved(page, 'tower'))?.won).toBe(true);
  await page.getByRole('button', { name: '← 游戏大厅' }).click();
  const before = await saved(page, 'tower');
  await page.keyboard.press('ArrowRight');
  expect(await saved(page, 'tower')).toEqual(before);
});
test('损坏存档：恢复有效备份', async ({ page }) => {
  const s = createLink(2, 8);
  await seed(page, 'link', { broken: true }, s);
  await expect(page.getByText('这份存档暂时无法读取')).toBeVisible();
  await page.getByRole('button', { name: '恢复上一份有效备份' }).click();
  await expect(page.locator('.game-stats')).toContainText('02 / 10');
  await expect.poll(() => saved(page, 'link')).toEqual(s);
});
test('大厅按需加载，切换游戏无需加载其他游戏', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /挑一款/ })).toBeVisible();
  expect(
    requests.some((url) => /packages\/(link|spider|tower)\/src\/(index|rules)/.test(url)),
  ).toBe(false);
  await page.getByRole('button', { name: '进入连连看', exact: true }).click();
  await expect(page.locator('.link-board')).toBeVisible();
  expect(requests.some((url) => /packages\/(spider|tower)\/src\/(index|rules)/.test(url))).toBe(
    false,
  );
});

test('连连看：区分图案不同与路径受阻，并支持取消选中', async ({ page }) => {
  const s = {
    ...createLink(1, 1),
    moves: 2,
    board: [0, 0, 0, 2, 3, 2, 0, 5, 3, 3, 1, 5, 1, 4, 3, 4, 5, 4, 5, 2, 4, 2, 2, 2],
  };
  await seed(page, 'link', s);
  await page.getByRole('button', { name: '图案 5 位置 7', exact: true }).click();
  await page.getByRole('button', { name: '图案 2 位置 3', exact: true }).click();
  await expect(page.locator('.game-message')).toContainText('这两个图案不同');
  await expect(page.locator('.game-stats')).toContainText('步数 2');
  await page.getByRole('button', { name: '图案 2 位置 3', exact: true }).click();
  await expect(page.locator('.game-message')).toContainText('已取消选择');
  await page.getByRole('button', { name: '图案 5 位置 7', exact: true }).click();
  await page.getByRole('button', { name: '图案 5 位置 16', exact: true }).click();
  await expect(page.locator('.game-message')).toContainText('图案相同，但路径被阻挡');
  await page.getByRole('button', { name: '✧ 提示一对' }).click();
  await expect(page.locator('.game-message')).toContainText('已标出可以配对');
});

test('连连看：外圈连接路径可见，立即存档且暂停清理反馈', async ({ page }) => {
  const s = createLink(1, 17);
  s.board = [1, 2, 1, 2, 3, 3, 4, 4, 5, 5, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 1, 1, 2, 2];
  await seed(page, 'link', s);
  await page.getByRole('button', { name: '图案 1 位置 0', exact: true }).click();
  await expect(page.getByRole('button', { name: '图案 1 位置 0', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '图案 1 位置 2', exact: true }).click();
  const route = page.getByRole('img', { name: '成功配对的连接路径' });
  await expect(route).toBeVisible();
  const points = await route.locator('polyline').getAttribute('points');
  expect(points!.split(' ').length).toBeGreaterThan(3);
  await expect.poll(async () => (await saved(page, 'link'))?.moves).toBe(1);
  await page.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();
  await expect(route).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.game-stats')).toContainText('步数 1');
  await expect(route).toHaveCount(0);
  await page.getByRole('button', { name: '图案 2 位置 12', exact: true }).click();
  await page.getByRole('button', { name: '图案 2 位置 13', exact: true }).click();
  await expect(route).toBeVisible();
  const offset = await page.evaluate(() => {
    const tile = document.querySelector('[aria-label="图案 0 位置 12"]')!.getBoundingClientRect();
    const endpoint = document.querySelector('.link-route circle')!.getBoundingClientRect();
    return {
      x: Math.abs(tile.x + tile.width / 2 - endpoint.x - endpoint.width / 2),
      y: Math.abs(tile.y + tile.height / 2 - endpoint.y - endpoint.height / 2),
    };
  });
  expect(offset.x).toBeLessThan(1);
  expect(offset.y).toBeLessThan(1);
});

test('手机验收：横竖屏、纸牌放大和触控移动', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/#/games/spider');
  await page.getByRole('button', { name: '放大牌面', exact: true }).click();
  await expect(page.locator('.spider-table')).toHaveClass(/zoomed/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 800, height: 360 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '缩小牌面', exact: true }).click();
  await page.goto('/#/games/tower');
  await page.getByRole('button', { name: '向右移动' }).click();
  await expect.poll(async () => (await saved(page, 'tower'))?.x).toBe(2);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole('button', { name: '向右移动' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('手机验收：切后台后保持暂停，恢复后才接受输入', async ({ page }) => {
  await seed(page, 'tower', createTower());
  await expect(page.getByRole('button', { name: '向右移动' })).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('休息一下也很好')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  expect((await saved(page, 'tower')).x).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('休息一下也很好')).toBeVisible();
  await page.getByRole('button', { name: '继续游戏 →', exact: true }).click();
  await page.getByRole('button', { name: '向右移动' }).click();
  await expect.poll(async () => (await saved(page, 'tower'))?.x).toBe(2);
});

test('魔塔升级：地图点选只检查，图例和完整战斗预览可用', async ({ page }) => {
  await seed(page, 'tower', createTower());
  await page.getByRole('button', { name: '查看怪物 第2行第8列', exact: true }).click();
  const inspector = page.getByRole('region', { name: '地图详情', exact: true });
  await expect(inspector).toContainText('青苔怪');
  await expect(inspector).toContainText('生命 55');
  await expect(inspector).toContainText('预计损失');
  await expect(inspector).toContainText('敌人反击');
  expect((await saved(page, 'tower')).hero.hp).toBe(600);
  expect((await saved(page, 'tower')).x).toBe(1);
  await page.getByRole('button', { name: '查看精英 第3行第4列', exact: true }).click();
  await expect(inspector).toContainText('荆棘卫士');
  await expect(inspector).toContainText('高风险高回报');
  await page.getByRole('button', { name: '查看红宝石 第2行第6列', exact: true }).click();
  await expect(inspector).toContainText('永久攻击 +5');
  await page.getByText('地图图例与探索规则', { exact: true }).click();
  await expect(page.locator('.tower-legend')).toContainText('精英');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(inspector).toContainText('附近没有敌人');
});

test('魔塔升级：商店展示收益并精确购买，回退可恢复属性', async ({ page }) => {
  const s = createTower();
  s.x = 2;
  s.y = 3;
  s.hero.gold = 100;
  await seed(page, 'tower', s);
  const shop = page.getByRole('region', { name: '旅人商店', exact: true });
  await expect(shop).toContainText('拥有 100 金币');
  await expect(shop).toContainText('30 金币');
  await shop.getByRole('button', { name: /攻击 \+5/ }).click();
  await expect.poll(async () => (await saved(page, 'tower')).hero.attack).toBe(21);
  await expect(shop).toContainText('拥有 70 金币');
  await expect(shop).toContainText('21 → 26');
  await page.reload();
  await expect(shop).toContainText('拥有 70 金币');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '↶ 回到本层入口' }).click();
  await expect.poll(async () => (await saved(page, 'tower')).hero.attack).toBe(16);
  await expect(shop).toHaveCount(0);
});

test('魔塔升级：线上旧版存档无损续玩，新开局切换升级版', async ({ page }) => {
  await seed(page, 'tower', legacyTower, undefined, true);
  await expect(page.locator('.tower-legacy')).toContainText('已保留原地图、数值与进度');
  await expect.poll(async () => (await saved(page, 'tower')).campaignVersion).toBe(1);
  expect((await saved(page, 'tower')).maps).toEqual(legacyTower.maps);
  expect((await saved(page, 'tower')).hero).toEqual(legacyTower.hero);
  await page.getByRole('button', { name: '查看怪物 第2行第8列', exact: true }).click();
  await expect(page.getByRole('region', { name: '地图详情' })).toContainText('生命 24');
  await page.reload();
  await expect(page.locator('.tower-legacy')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '↻ 新游戏' }).click();
  await expect(page.locator('.tower-legacy')).toHaveCount(0);
  await expect.poll(async () => (await saved(page, 'tower')).campaignVersion).toBe(2);
});
