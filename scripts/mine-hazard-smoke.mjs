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
  await page.goto(`${BASE_URL}?qa=1&v=mine-hazard`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();

  await useTarget(page, "key");
  await useTarget(page, "door");
  for (const target of ["valve-1", "valve-2", "valve-3"]) await useTarget(page, target);
  await useTarget(page, "pipe-exit");

  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("mine-lava"));
  await page.waitForTimeout(180);
  const afterLava = await state(page);
  const lavaCaught = await page.locator("#caught-screen").isVisible();
  await page.locator("#retry-button").click();
  await page.waitForTimeout(140);

  await useTarget(page, "mine-pickaxe");
  const afterPickaxe = await state(page);
  await useTarget(page, "mine-anchor-1", 30);
  const duringFragments = await state(page);
  await page.waitForTimeout(900);
  const afterFragments = await state(page);

  const ok =
    lavaCaught &&
    afterLava.livesRemaining === 2 &&
    afterPickaxe.heldPickaxeVisible &&
    duringFragments.anchorFragmentCount > 0 &&
    afterFragments.anchorFragmentCount === 0 &&
    errors.length === 0;

  console.log(
    JSON.stringify(
      { ok, lavaCaught, afterLava, afterPickaxe, duringFragments, afterFragments, errors },
      null,
      2,
    ),
  );
  if (!ok) process.exitCode = 1;
  await context.close();
} finally {
  await browser.close();
}

async function useTarget(page, target, waitAfter = 120) {
  await page.evaluate((nextTarget) => window.__liminalHuntQa.teleportForQa(nextTarget), target);
  await page.waitForTimeout(70);
  await page.keyboard.press("e");
  await page.waitForTimeout(waitAfter);
}

async function state(page) {
  return page.evaluate(() => window.__liminalHuntQa.state());
}
