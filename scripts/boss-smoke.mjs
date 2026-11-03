import { chromium } from "playwright-core";
import { join } from "node:path";
import { tmpdir } from "node:os";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = process.env.LIMINAL_HUNT_URL ?? "http://127.0.0.1:4173/";
const screenshot = join(tmpdir(), "liminal-boss-arena.png");
const shieldScreenshot = join(tmpdir(), "liminal-boss-shield.png");

const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    localStorage.setItem(
      "liminal-hunt-save-v6",
      JSON.stringify({
        version: 6,
        unlockedLevel: 1,
        levelOne: {
          zone: "boss-arena",
          completed: false,
          bossHealth: 8,
          livesRemaining: 3,
          inventoryItemIds: [],
          noteIds: [],
          activatedValveIds: [],
          destroyedMineAnchorIds: [],
          activatedLabTerminalIds: [],
        },
      }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE_URL}?qa=1`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("boss-weapon"));
  await page.keyboard.press("e");
  await page.waitForTimeout(120);
  const armed = await page.evaluate(() => window.__liminalHuntQa.state());
  await page.evaluate(() => window.__liminalHuntQa.shootForQa());
  const shieldBlocked = await page.evaluate(() => window.__liminalHuntQa.state());
  await page.waitForTimeout(2100);
  const attacking = await page.evaluate(() => window.__liminalHuntQa.state());
  await page.screenshot({ path: shieldScreenshot });
  for (let relay = 0; relay < 3; relay += 1) {
    await page.evaluate(() => window.__liminalHuntQa.destroyBossRelayForQa());
  }
  const firstWindow = await page.evaluate(() => window.__liminalHuntQa.state());
  await page.evaluate(() => window.__liminalHuntQa.shootForQa());
  await page.waitForTimeout(80);
  await page.screenshot({ path: screenshot });
  await page.waitForTimeout(340);
  await page.evaluate(() => window.__liminalHuntQa.prepareBossShotForQa());
  await page.waitForTimeout(60);
  await page.keyboard.press("Space");
  await page.waitForTimeout(80);
  const productionShot = await page.evaluate(() => window.__liminalHuntQa.state());
  await page.evaluate(() => window.__liminalHuntQa.shootForQa());
  for (let relay = 0; relay < 3; relay += 1) {
    await page.evaluate(() => window.__liminalHuntQa.destroyBossRelayForQa());
  }
  for (let shot = 0; shot < 3; shot += 1) {
    await page.evaluate(() => window.__liminalHuntQa.shootForQa());
    await page.waitForTimeout(25);
  }
  for (let relay = 0; relay < 3; relay += 1) {
    await page.evaluate(() => window.__liminalHuntQa.destroyBossRelayForQa());
  }
  for (let shot = 0; shot < 2; shot += 1) {
    await page.evaluate(() => window.__liminalHuntQa.shootForQa());
    await page.waitForTimeout(25);
  }
  const defeated = await page.evaluate(() => window.__liminalHuntQa.state());
  const ok =
    armed.zone === "boss-arena" &&
    armed.hasBossWeapon &&
    armed.bossMode === "shielded" &&
    shieldBlocked.bossHealth === 8 &&
    attacking.bossProjectileCount > 0 &&
    firstWindow.bossMode === "vulnerable" &&
    productionShot.bossHealth === 6 &&
    defeated.bossHealth === 0 &&
    defeated.completed &&
    errors.length === 0;
  console.log(JSON.stringify({ ok, screenshot, shieldScreenshot, armed, shieldBlocked, attacking, firstWindow, productionShot, defeated, errors }, null, 2));
  if (!ok) process.exitCode = 1;
  await context.close();
} finally {
  await browser.close();
}
