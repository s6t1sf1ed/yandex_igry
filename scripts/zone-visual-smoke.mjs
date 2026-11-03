import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = process.env.LIMINAL_HUNT_URL ?? "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${BASE_URL}?qa=1&v=zone-visual`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();
  const yellowRooms = join(tmpdir(), "liminal-yellow-rooms.png");
  await page.waitForTimeout(350);
  await page.screenshot({ path: yellowRooms });

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("key"));
  await page.waitForTimeout(180);
  const exitKey = join(tmpdir(), "verity-backrooms-exit-key.png");
  await page.screenshot({ path: exitKey });
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("door"));
  await page.waitForTimeout(80);
  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  const pipeDreams = join(tmpdir(), "liminal-pipe-dreams.png");
  await page.screenshot({ path: pipeDreams });

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("valve-1"));
  await page.waitForTimeout(180);
  const valveInactive = join(tmpdir(), "verity-backrooms-valve-inactive.png");
  await page.screenshot({ path: valveInactive });
  await page.keyboard.press("e");
  await page.waitForTimeout(180);
  const valveActive = join(tmpdir(), "verity-backrooms-valve-active.png");
  await page.screenshot({ path: valveActive });

  for (const target of ["valve-2", "valve-3"]) {
    await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
    await page.waitForTimeout(60);
    await page.keyboard.press("e");
  }
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("pipe-exit"));
  await page.waitForTimeout(80);
  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  const blockMines = join(tmpdir(), "liminal-block-mines.png");
  await page.screenshot({ path: blockMines });

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("mine-pickaxe"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(220);
  const blockMinePickaxe = join(tmpdir(), "liminal-block-mine-pickaxe.png");
  await page.screenshot({ path: blockMinePickaxe });

  for (const target of ["mine-anchor-1", "mine-anchor-2", "mine-anchor-3"]) {
    await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
    await page.waitForTimeout(80);
    await page.keyboard.press("e");
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("mine-exit"));
  await page.waitForTimeout(300);
  const blockMinePortal = join(tmpdir(), "liminal-block-mine-portal.png");
  await page.screenshot({ path: blockMinePortal });

  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  const observationLab = join(tmpdir(), "liminal-observation-lab.png");
  await page.screenshot({ path: observationLab });

  for (const target of ["lab-terminal-1", "lab-terminal-2", "lab-terminal-3"]) {
    await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
    await page.waitForTimeout(70);
    await page.keyboard.press("e");
    await page.waitForTimeout(90);
  }
  if (await page.locator("#caught-screen").isVisible()) {
    await page.locator("#retry-button").click();
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("lab-exit"));
  await page.waitForTimeout(300);
  const labElevator = join(tmpdir(), "liminal-lab-elevator.png");
  await page.screenshot({ path: labElevator });

  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  const bossArena = join(tmpdir(), "liminal-boss-arena-entry.png");
  await page.screenshot({ path: bossArena });
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("boss-weapon"));
  await page.waitForTimeout(80);
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  for (let relay = 0; relay < 3; relay += 1) {
    await page.evaluate(() => window.__liminalHuntQa.destroyBossRelayForQa());
  }
  await page.evaluate(() => window.__liminalHuntQa.shootForQa());
  await page.waitForTimeout(80);
  const bossFight = join(tmpdir(), "liminal-boss-fight.png");
  await page.screenshot({ path: bossFight });

  const state = await page.evaluate(() => window.__liminalHuntQa.state());
  console.log(JSON.stringify({ screenshots: { yellowRooms, exitKey, pipeDreams, valveInactive, valveActive, blockMines, blockMinePickaxe, blockMinePortal, observationLab, labElevator, bossArena, bossFight }, state, errors }, null, 2));
  if (state.zone !== "boss-arena" || !state.hasBossWeapon || state.bossHealth !== 7 || errors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
