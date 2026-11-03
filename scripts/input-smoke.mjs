import { chromium } from "playwright-core";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = process.env.LIMINAL_HUNT_URL ?? "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
});

const results = [];

try {
  results.push(await testDesktop());
  results.push(await testMobile());
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;

async function testDesktop() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(`${BASE_URL}?qa=1`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();
  await page.waitForTimeout(250);

  const initial = await qaState(page);
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.up("w");
  const afterMove = await qaState(page);

  await page.mouse.move(640, 360);
  await page.mouse.move(790, 390, { steps: 5 });
  await page.waitForTimeout(120);
  const afterLook = await qaState(page);

  await page.keyboard.press("f");
  const afterFlashlight = await qaState(page);
  await page.keyboard.press("e");
  const afterAction = await qaState(page);

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("key"));
  await page.waitForTimeout(120);
  const keyPromptVisible = await page.locator("#interaction-prompt").getByText("взять ключ").isVisible();
  await page.keyboard.press("e");
  await page.waitForTimeout(160);
  const afterKeyPickup = await qaState(page);
  const inventoryVisible = (await page.locator("#inventory-items").textContent())?.includes("Ключ от выхода") ?? false;

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("door"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(180);
  const afterZoneTransition = await qaState(page);

  for (const target of ["valve-1", "valve-2", "valve-3"]) {
    await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
    await page.waitForTimeout(100);
    await page.keyboard.press("e");
    await page.waitForTimeout(140);
  }
  const afterValves = await qaState(page);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("pipe-exit"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(180);
  const afterMineTransition = await qaState(page);

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("mine-pickaxe"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(140);
  const afterPickaxe = await qaState(page);

  for (const target of ["mine-anchor-1", "mine-anchor-2", "mine-anchor-3"]) {
    await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
    await page.waitForTimeout(100);
    await page.keyboard.press("e");
    await page.waitForTimeout(140);
  }
  const afterMineAnchors = await qaState(page);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("mine-exit"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(180);
  const afterLabTransition = await qaState(page);
  await page.waitForTimeout(1600);
  const afterLabPatrol = await qaState(page);
  await page.waitForTimeout(13000);
  const duringLabPatrol = await qaState(page);
  await page.waitForTimeout(3000);
  const laterLabPatrol = await qaState(page);

  for (const target of ["lab-terminal-1", "lab-terminal-2", "lab-terminal-3"]) {
    await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
    await page.waitForTimeout(100);
    await page.keyboard.press("e");
    await page.waitForTimeout(140);
  }
  const afterLabTerminals = await qaState(page);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("lab-exit"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(180);
  const afterBossTransition = await qaState(page);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("boss-weapon"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(140);
  const afterBossWeapon = await qaState(page);
  for (const hits of [3, 3, 2]) {
    for (let relay = 0; relay < 3; relay += 1) {
      await page.evaluate(() => window.__liminalHuntQa.destroyBossRelayForQa());
    }
    for (let shot = 0; shot < hits; shot += 1) {
      await page.evaluate(() => window.__liminalHuntQa.shootForQa());
      await page.waitForTimeout(30);
    }
  }
  const afterBossDefeat = await qaState(page);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("boss-exit"));
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(180);
  const afterCompletion = await qaState(page);
  const endingVisible = await page.locator("#ending-screen").isVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__liminalHuntQa));
  const restoredState = await qaState(page);

  const moveDistance = horizontalDistance(initial.player, afterMove.player);
  const moved = moveDistance > 0.12;
  const movementReasonable = moveDistance < 5;
  const looked = Math.abs(afterLook.player.yaw - afterMove.player.yaw) > 0.01;
  const flashlightChanged = afterFlashlight.flashlight.enabled !== afterLook.flashlight.enabled;
  const actionRegistered = afterAction.actionCount === afterFlashlight.actionCount + 1;
  const inventoryUpdated = afterKeyPickup.inventoryItemIds.includes("level-1-exit-key");
  const inventoryRestored = restoredState.inventoryItemIds.includes("level-1-exit-key");
  const yellowRouteCompact = initial.yellowRouteSteps > 0 && initial.yellowRouteSteps < 100;
  const zoneTransitioned = afterZoneTransition.zone === "pipe-dreams";
  const valvesActivated = afterValves.activatedValveIds.length === 3;
  const mineTransitioned = afterMineTransition.zone === "block-mines";
  const mineRoutesConnected = initial.mineRouteSteps.every((steps) => steps > 0);
  const pickaxeCollected = afterPickaxe.inventoryItemIds.includes("block-mine-pickaxe");
  const mineAnchorsDestroyed = afterMineAnchors.destroyedMineAnchorIds.length === 3;
  const mineAggressionIncreased = afterMineAnchors.mineAggression > 1.3;
  const labTransitioned = afterLabTransition.zone === "observation-lab";
  const labPatrolStarted = horizontalDistance(afterLabTransition.verity, afterLabPatrol.verity) > 0.5;
  const labPatrolContinues = horizontalDistance(duringLabPatrol.verity, laterLabPatrol.verity) > 1;
  const labRoutesConnected = initial.labRouteSteps.every((steps) => steps > 0);
  const labTerminalsActivated = afterLabTerminals.activatedLabTerminalIds.length === 3;
  const labAggressionIncreased = afterLabTerminals.labAggression > 1.3;
  const bossTransitioned = afterBossTransition.zone === "boss-arena" && afterBossTransition.bossHealth === 8;
  const bossWeaponCollected =
    afterBossWeapon.hasBossWeapon && afterBossWeapon.inventoryItemIds.includes("pulse-blaster");
  const bossExitUnlocked = !afterBossDefeat.completed && afterBossDefeat.bossHealth === 0;
  const levelCompleted = afterCompletion.completed && afterCompletion.bossHealth === 0 && endingVisible;
  const completionRestored =
    restoredState.zone === "boss-arena" &&
    restoredState.activatedValveIds.length === 3 &&
    restoredState.destroyedMineAnchorIds.length === 3 &&
    restoredState.activatedLabTerminalIds.length === 3 &&
    restoredState.inventoryItemIds.includes("block-mine-pickaxe") &&
    restoredState.inventoryItemIds.includes("pulse-blaster") &&
    restoredState.mineAggression > 1.3 &&
    restoredState.labAggression > 1.3 &&
    restoredState.bossHealth === 0 &&
    restoredState.completed;

  await context.close();
  return {
    name: "desktop",
    ok:
      moved &&
      movementReasonable &&
      looked &&
      flashlightChanged &&
      actionRegistered &&
      keyPromptVisible &&
      inventoryUpdated &&
      inventoryVisible &&
      inventoryRestored &&
      yellowRouteCompact &&
      zoneTransitioned &&
      valvesActivated &&
      mineTransitioned &&
      mineRoutesConnected &&
      pickaxeCollected &&
      mineAnchorsDestroyed &&
      mineAggressionIncreased &&
      labTransitioned &&
      labPatrolStarted &&
      labPatrolContinues &&
      labRoutesConnected &&
      labTerminalsActivated &&
      labAggressionIncreased &&
      bossTransitioned &&
      bossWeaponCollected &&
      bossExitUnlocked &&
      levelCompleted &&
      completionRestored &&
      errors.length === 0,
    moved,
    moveDistance,
    movementReasonable,
    looked,
    flashlightChanged,
    actionRegistered,
    keyPromptVisible,
    inventoryUpdated,
    inventoryVisible,
    inventoryRestored,
    yellowRouteCompact,
    zoneTransitioned,
    valvesActivated,
    mineTransitioned,
    mineRoutesConnected,
    pickaxeCollected,
    mineAnchorsDestroyed,
    mineAggressionIncreased,
    labTransitioned,
    labPatrolStarted,
    labPatrolContinues,
    labRoutesConnected,
    labTerminalsActivated,
    labAggressionIncreased,
    bossTransitioned,
    bossWeaponCollected,
    bossExitUnlocked,
    endingVisible,
    levelCompleted,
    completionRestored,
    initial,
    afterMove,
    afterLook,
    errors,
  };
}

async function testMobile() {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(`${BASE_URL}?touch=1&qa=1`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();
  await page.waitForTimeout(250);

  const initial = await qaState(page);
  const movePad = await page.locator("#move-pad").boundingBox();
  if (!movePad) throw new Error("Move pad is not visible");
  await page.mouse.move(movePad.x + movePad.width / 2, movePad.y + movePad.height / 2);
  await page.mouse.down();
  await page.mouse.move(movePad.x + movePad.width / 2, movePad.y + 10, { steps: 4 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  const afterMove = await qaState(page);

  const lookZone = await page.locator("#look-zone").boundingBox();
  if (!lookZone) throw new Error("Look zone is not visible");
  await page.mouse.move(lookZone.x + lookZone.width / 2, lookZone.y + lookZone.height / 2);
  await page.mouse.down();
  await page.mouse.move(lookZone.x + lookZone.width / 2 + 110, lookZone.y + lookZone.height / 2 + 20, {
    steps: 5,
  });
  await page.mouse.up();
  const afterLook = await qaState(page);

  await page.locator("#mobile-flashlight-button").click();
  const afterFlashlight = await qaState(page);
  await page.locator("#mobile-action-button").click();
  const afterAction = await qaState(page);

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("key"));
  await page.waitForTimeout(120);
  const keyPromptVisible = await page.locator("#interaction-prompt").getByText("взять ключ").isVisible();
  await page.locator("#mobile-action-button").click();
  await page.waitForTimeout(160);
  const afterKeyPickup = await qaState(page);
  const inventoryVisible = (await page.locator("#inventory-items").textContent())?.includes("Ключ от выхода") ?? false;

  const moveDistance = horizontalDistance(initial.player, afterMove.player);
  const moved = moveDistance > 0.12;
  const movementReasonable = moveDistance < 5;
  const looked = Math.abs(afterLook.player.yaw - afterMove.player.yaw) > 0.01;
  const flashlightChanged = afterFlashlight.flashlight.enabled !== afterLook.flashlight.enabled;
  const actionRegistered = afterAction.actionCount === afterFlashlight.actionCount + 1;
  const inventoryUpdated = afterKeyPickup.inventoryItemIds.includes("level-1-exit-key");

  await context.close();
  return {
    name: "mobile",
    ok:
      moved &&
      movementReasonable &&
      looked &&
      flashlightChanged &&
      actionRegistered &&
      keyPromptVisible &&
      inventoryUpdated &&
      inventoryVisible &&
      errors.length === 0,
    moved,
    moveDistance,
    movementReasonable,
    looked,
    flashlightChanged,
    actionRegistered,
    keyPromptVisible,
    inventoryUpdated,
    inventoryVisible,
    initial,
    afterMove,
    afterLook,
    errors,
  };
}

async function qaState(page) {
  return page.evaluate(() => {
    if (!window.__liminalHuntQa) throw new Error("QA bridge is unavailable");
    return window.__liminalHuntQa.state();
  });
}

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
