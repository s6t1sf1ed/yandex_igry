import { chromium } from "playwright-core";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = process.env.LIMINAL_HUNT_URL ?? "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
});

try {
  const backrooms = await testBackroomsReset();
  const mine = await testMineReset();
  const lab = await testLabReset();
  const boss = await testBossReset();
  const ok = backrooms.ok && mine.ok && lab.ok && boss.ok;
  console.log(JSON.stringify({ ok, backrooms, mine, lab, boss }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}

async function testBackroomsReset() {
  const { context, page, errors } = await createStartedPage("backrooms");
  await collectKeyAndEnterPipes(page);
  const livesAfterCatches = await loseAllLives(page);
  const resetState = await qaState(page);
  const livesHud = await page.locator("#lives-value").textContent();
  const ok =
    JSON.stringify(livesAfterCatches) === JSON.stringify([2, 1, 0]) &&
    resetState.livesRemaining === 3 &&
    resetState.zone === "yellow-rooms" &&
    resetState.inventoryItemIds.length === 0 &&
    resetState.activatedValveIds.length === 0 &&
    resetState.destroyedMineAnchorIds.length === 0 &&
    resetState.mineAggression === 1 &&
    !resetState.completed &&
    livesHud === "● ● ●" &&
    errors.length === 0;
  await context.close();
  return { ok, livesAfterCatches, resetState, livesHud, errors };
}

async function testMineReset() {
  const { context, page, errors } = await createStartedPage("mine");
  await collectKeyAndEnterPipes(page);
  for (const target of ["valve-1", "valve-2", "valve-3"]) await useQaTarget(page, target);
  await useQaTarget(page, "pipe-exit");
  await useQaTarget(page, "mine-pickaxe");
  await useQaTarget(page, "mine-anchor-1");
  const livesAfterCatches = await loseAllLives(page);
  const resetState = await qaState(page);
  const ok =
    JSON.stringify(livesAfterCatches) === JSON.stringify([2, 1, 0]) &&
    resetState.livesRemaining === 3 &&
    resetState.zone === "block-mines" &&
    resetState.inventoryItemIds.includes("level-1-exit-key") &&
    !resetState.inventoryItemIds.includes("block-mine-pickaxe") &&
    resetState.activatedValveIds.length === 3 &&
    resetState.destroyedMineAnchorIds.length === 0 &&
    resetState.mineAggression === 1 &&
    !resetState.completed &&
    errors.length === 0;
  await context.close();
  return { ok, livesAfterCatches, resetState, errors };
}

async function testLabReset() {
  const { context, page, errors } = await createStartedPage("lab");
  await enterLab(page);
  await useQaTarget(page, "lab-terminal-1");
  const livesAfterCatches = await loseAllLives(page);
  const resetState = await qaState(page);
  const ok =
    JSON.stringify(livesAfterCatches) === JSON.stringify([2, 1, 0]) &&
    resetState.livesRemaining === 3 &&
    resetState.zone === "observation-lab" &&
    resetState.activatedValveIds.length === 3 &&
    resetState.destroyedMineAnchorIds.length === 3 &&
    resetState.activatedLabTerminalIds.length === 0 &&
    resetState.labAggression === 1 &&
    !resetState.completed &&
    errors.length === 0;
  await context.close();
  return { ok, livesAfterCatches, resetState, errors };
}

async function testBossReset() {
  const { context, page, errors } = await createStartedPage("boss");
  await enterLab(page);
  for (const target of ["lab-terminal-1", "lab-terminal-2", "lab-terminal-3"]) {
    await useQaTarget(page, target);
  }
  await useQaTarget(page, "lab-exit");
  await useQaTarget(page, "boss-weapon");
  for (let shot = 0; shot < 3; shot += 1) {
    await page.evaluate(() => window.__liminalHuntQa.shootForQa());
  }
  const livesAfterCatches = await loseAllLives(page);
  const resetState = await qaState(page);
  const ok =
    JSON.stringify(livesAfterCatches) === JSON.stringify([2, 1, 0]) &&
    resetState.livesRemaining === 3 &&
    resetState.zone === "boss-arena" &&
    resetState.activatedValveIds.length === 3 &&
    resetState.destroyedMineAnchorIds.length === 3 &&
    resetState.activatedLabTerminalIds.length === 3 &&
    resetState.bossHealth === 8 &&
    !resetState.hasBossWeapon &&
    !resetState.inventoryItemIds.includes("pulse-blaster") &&
    !resetState.completed &&
    errors.length === 0;
  await context.close();
  return { ok, livesAfterCatches, resetState, errors };
}

async function createStartedPage(suffix) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${BASE_URL}?qa=1&v=lives-smoke-${suffix}`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();
  return { context, page, errors };
}

async function collectKeyAndEnterPipes(page) {
  await useQaTarget(page, "key");
  await useQaTarget(page, "door");
}

async function enterLab(page) {
  await collectKeyAndEnterPipes(page);
  for (const target of ["valve-1", "valve-2", "valve-3"]) await useQaTarget(page, target);
  await useQaTarget(page, "pipe-exit");
  await useQaTarget(page, "mine-pickaxe");
  for (const target of ["mine-anchor-1", "mine-anchor-2", "mine-anchor-3"]) {
    await useQaTarget(page, target);
  }
  await useQaTarget(page, "mine-exit");
}

async function useQaTarget(page, target) {
  await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
  await page.waitForTimeout(80);
  await page.keyboard.press("e");
  await page.waitForTimeout(130);
}

async function loseAllLives(page) {
  const livesAfterCatches = [];
  for (let catchIndex = 0; catchIndex < 3; catchIndex += 1) {
    await page.evaluate(() => window.__liminalHuntQa.triggerCatchForQa());
    await page.waitForTimeout(100);
    livesAfterCatches.push((await qaState(page)).livesRemaining);
    await page.locator("#retry-button").click();
    await page.waitForTimeout(140);
  }
  return livesAfterCatches;
}

async function qaState(page) {
  return page.evaluate(() => window.__liminalHuntQa.state());
}
