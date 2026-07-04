import pkg from "playwright";

const { chromium } = pkg;

const BASE = process.env.SHOT_BASE ?? "http://localhost:3939";
const OUT = process.env.SHOT_OUT ?? "reference";

const routes = (process.env.SHOT_ROUTES ?? "/:home,/kongsi-kit:kit")
  .split(",")
  .map((r) => {
    const [path, name] = r.split(":");
    return { path, name: name ?? (path.replace(/\W+/g, "_") || "root") };
  });

const viewports = [
  { tag: "desktop", width: 1280, height: 1200 },
  { tag: "mobile", width: 390, height: 1500 },
];

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

for (const route of routes) {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
    });
    await page.goto(`${BASE}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const file = `${OUT}/shot-${route.name}-${vp.tag}.png`;
    await page.screenshot({ path: file });
    await page.close();
    console.log("shot", file);
  }
}

await browser.close();
console.log("done");
