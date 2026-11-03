import { chromium } from "playwright-core";
import { join } from "node:path";
import { tmpdir } from "node:os";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = process.env.LIMINAL_HUNT_URL ?? "http://127.0.0.1:4173/";
const SAVE_KEY = "liminal-hunt-save-v6";
const desktopScreenshot = join(tmpdir(), "liminal-hunt-menu-desktop.png");
const mobileScreenshot = join(tmpdir(), "liminal-hunt-menu-mobile.png");
const transitionScreenshot = join(tmpdir(), "liminal-hunt-transition.png");

const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
});

const results = [];
try {
  results.push(await testDesktopMenu());
  results.push(await testMobileMenu());
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;

async function testDesktopMenu() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await context.addInitScript((saveKey) => {
    if (sessionStorage.getItem("menu-smoke-initialized")) return;
    localStorage.removeItem(saveKey);
    sessionStorage.setItem("menu-smoke-initialized", "1");
  }, SAVE_KEY);
  await page.goto(`${BASE_URL}?qa=1`, { waitUntil: "networkidle" });

  const freshEnabled = await levelEnabled(page);
  const gameTitle = await page.locator(".menu-copy h1").textContent();
  const browserTitle = await page.title();
  const freshZone = await page.locator("#menu-current-zone").textContent();
  const freshCount = await page.locator("#menu-unlocked-count").textContent();
  await page.locator("#start-button").click();
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("key"));
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__liminalHuntQa.teleportForQa("door"));
  await page.keyboard.press("e");
  await page.waitForTimeout(260);
  const transitionVisible = await page.locator("#zone-transition").isVisible();
  const transitionHeading = await page.locator("#transition-title").textContent();
  await page.screenshot({ path: transitionScreenshot });

  await page.evaluate(
    ({ saveKey, save }) => localStorage.setItem(saveKey, JSON.stringify(save)),
    {
      saveKey: SAVE_KEY,
      save: {
        version: 6,
        unlockedLevel: 4,
        levelOne: {
          keyCollected: true,
          noteIds: [],
          completed: false,
          flashlightCharge: 82,
          batteryCollected: false,
          inventoryItemIds: ["level-1-exit-key", "block-mine-pickaxe"],
          zone: "boss-arena",
          activatedValveIds: ["pipe-valve-01", "pipe-valve-02", "pipe-valve-03"],
          destroyedMineAnchorIds: ["mine-anchor-01", "mine-anchor-02", "mine-anchor-03"],
          activatedLabTerminalIds: ["lab-terminal-01", "lab-terminal-02", "lab-terminal-03"],
          bossHealth: 8,
          livesRemaining: 3,
        },
      },
    },
  );
  await page.reload({ waitUntil: "networkidle" });
  const unlockedEnabled = await levelEnabled(page);

  await page.locator('.level-card[data-level="2"]').click();
  await page.waitForFunction(() => document.querySelector("#menu-current-zone")?.textContent === "Кубические шахты");
  await page.waitForFunction(() => Boolean(window.__liminalHuntQa));
  const selectedState = await page.evaluate(() => window.__liminalHuntQa.state());
  const unlockedAfterReplay = await page.locator("#menu-unlocked-count").textContent();
  const selectedCardCurrent = await page.locator('.level-card[data-level="2"]').evaluate((element) =>
    element.classList.contains("current"),
  );
  const layout = await page.evaluate(() => ({
    horizontalOverflow: document.querySelector("#start-screen").scrollWidth > window.innerWidth + 1,
    menuWidth: document.querySelector(".menu-shell").getBoundingClientRect().width,
  }));
  await page.screenshot({ path: desktopScreenshot });
  await page.getByRole("button", { name: "Продолжить игру" }).click();
  await page.waitForTimeout(180);
  const runningState = await page.evaluate(() => window.__liminalHuntQa.state());

  const ok =
    freshEnabled.join(",") === "true,false,false,false" &&
    gameTitle === "Верити: Бэкрумс" &&
    browserTitle === "Верити: Бэкрумс" &&
    freshZone === "Жёлтые комнаты" &&
    freshCount === "1/4" &&
    transitionVisible &&
    transitionHeading === "УРОВЕНЬ 1 · ВОДОПРОВОД МЕЧТЫ" &&
    unlockedEnabled.every(Boolean) &&
    selectedState.zone === "block-mines" &&
    selectedState.activatedValveIds.length === 3 &&
    selectedState.destroyedMineAnchorIds.length === 0 &&
    !selectedState.inventoryItemIds.includes("block-mine-pickaxe") &&
    unlockedAfterReplay === "4/4" &&
    selectedCardCurrent &&
    runningState.running &&
    !layout.horizontalOverflow &&
    layout.menuWidth <= 1080 &&
    errors.length === 0;

  await context.close();
  return {
    name: "desktop-menu",
    ok,
    screenshot: desktopScreenshot,
    transitionScreenshot,
    freshEnabled,
    gameTitle,
    browserTitle,
    transitionVisible,
    transitionHeading,
    unlockedEnabled,
    selectedState,
    layout,
    errors,
  };
}

async function testMobileMenu() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await context.addInitScript((saveKey) => {
    if (sessionStorage.getItem("menu-smoke-initialized")) return;
    localStorage.removeItem(saveKey);
    sessionStorage.setItem("menu-smoke-initialized", "1");
  }, SAVE_KEY);
  await page.goto(`${BASE_URL}?touch=1`, { waitUntil: "networkidle" });
  await page.locator('.level-card[data-level="4"]').scrollIntoViewIfNeeded();
  const layout = await page.evaluate(() => {
    const screen = document.querySelector("#start-screen");
    const card = document.querySelector('.level-card[data-level="4"]').getBoundingClientRect();
    return {
      canScroll: screen.scrollHeight > screen.clientHeight,
      horizontalOverflow: screen.scrollWidth > window.innerWidth + 1,
      lastCardVisible: card.top < window.innerHeight && card.bottom > 0,
    };
  });
  await page.screenshot({ path: mobileScreenshot });
  const ok = !layout.horizontalOverflow && layout.lastCardVisible && errors.length === 0;
  await context.close();
  return { name: "mobile-menu", ok, screenshot: mobileScreenshot, layout, errors };
}

async function levelEnabled(page) {
  const result = [];
  for (const level of [1, 2, 3, 4]) {
    result.push(await page.locator(`.level-card[data-level="${level}"]`).isEnabled());
  }
  return result;
}

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}
