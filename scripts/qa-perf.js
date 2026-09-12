// Measured perf observations (dev server, Chromium, Moto-G-class CPU throttle off).
// Prints real numbers; never claims FPS.
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("MISSING playwright-core");
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto("http://127.0.0.1:3109/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.getByPlaceholder("ZEV-XXXX-XXXX-XXXX").fill("ZEV-DEMO-2026-VIP1");
  await page.evaluate(() => localStorage.setItem("zev_device_id", "web_qa_device_002"));
  await page.getByRole("button", { name: /^Kích hoạt$/i }).click();
  await page.getByText("Sẵn sàng").first().waitFor({ timeout: 20000 });
  const enter = page.getByRole("button", { name: /Vào app/i });
  if ((await enter.count()) > 0) { await enter.click(); await page.waitForTimeout(400); }

  // LCP candidate: hero artwork timing
  const lcp = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    const img = document.querySelector(".zev-hero img");
    if (!img) return res({ found: false });
    if (img.complete && img.naturalWidth > 0) return res({ found: true, ms: Math.round(performance.now() - t0), cached: true });
    img.addEventListener("load", () => res({ found: true, ms: Math.round(performance.now() - t0), cached: false }), { once: true });
    setTimeout(() => res({ found: true, timeout: true }), 8000);
  }));
  console.log("hero-img:", JSON.stringify(lcp));

  // Toggle round-trip latency (server persist, dev server)
  await page.getByRole("navigation").getByRole("button", { name: "Chức năng" }).click();
  await page.waitForTimeout(500);
  const t1 = Date.now();
  await page.locator('[role="switch"]').first().click();
  await page.waitForFunction(
    () => [...document.querySelectorAll('[role="switch"]')][0]?.getAttribute("aria-checked") === "true",
    null, { timeout: 8000 }
  ).catch(() => {});
  console.log("toggle-roundtrip-ms:", Date.now() - t1);

  // Countdown tick cost: measure one interval handler via rAF deltas is noisy;
  // instead count longtasks during 5s of idle realtime tab.
  await page.getByRole("navigation").getByRole("button", { name: "Trực tiếp" }).click();
  const longtasks = await page.evaluate(() => new Promise((res) => {
    let n = 0;
    const po = new PerformanceObserver((l) => { n += l.getEntries().length; });
    try { po.observe({ entryTypes: ["longtask"] }); } catch { return res(-1); }
    setTimeout(() => { po.disconnect(); res(n); }, 5000);
  }));
  console.log("longtasks-in-5s-idle-realtime:", longtasks);

  // JS heap after stress (10 toggles)
  await page.getByRole("navigation").getByRole("button", { name: "Chức năng" }).click();
  const mem0 = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1));
  for (let i = 0; i < 10; i++) { await page.locator('[role="switch"]').first().click({ timeout: 3000 }).catch(() => {}); }
  await page.waitForTimeout(2500);
  const mem1 = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1));
  console.log("jsheap-MB before/after 10 toggles:", mem0, mem1);
  await browser.close();
})().catch((e) => { console.log("PERF-EXCEPTION", String(e).split("\n")[0]); process.exit(1); });
