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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${BASE_URL}?qa=1&v=verity-face`, { waitUntil: "networkidle" });
  await page.locator("#start-button").click();

  const screenshots = {};
  for (const face of ["normal", "chase"]) {
    for (const view of ["front", "angle"]) {
      await page.evaluate(
        ({ nextFace, nextView }) => window.__liminalHuntQa.previewVerityFace(nextFace, nextView),
        { nextFace: face, nextView: view },
      );
      await page.waitForTimeout(500);
      const key = `${face}-${view}`;
      const path = join(tmpdir(), `liminal-verity-${key}.png`);
      await page.screenshot({ path });
      screenshots[key] = path;
    }
  }

  const state = await page.evaluate(() => window.__liminalHuntQa.state());
  console.log(JSON.stringify({ screenshots, state, errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
