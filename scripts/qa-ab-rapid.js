// Rapid A-then-B probe: click B while A's request is still in flight.
// Records whether B's intent is sent, applied, dropped, or rolled back.
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("MISSING playwright-core");
  process.exit(2);
}
const BASE = "http://127.0.0.1:3109";

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const net = [];
  const reqs = [];
  let t0 = Date.now();
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/functions/update")) {
      reqs.push({ t: Date.now() - t0, body: req.postData() });
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/functions/update")) {
      let body = "";
      try { body = await res.text(); } catch { body = "<unreadable>"; }
      try {
        const j = JSON.parse(body);
        const on = Object.entries(j.functions).filter(([, v]) => v).map(([k]) => k).join("+") || "(none)";
        net.push({ t: Date.now() - t0, status: res.status(), on });
      } catch { net.push({ t: Date.now() - t0, status: res.status(), on: "unparseable:" + body.slice(0, 80) }); }
    }
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("ZEV-XXXX-XXXX-XXXX").fill("ZEV-DEMO-2026-VIP1");
  await page.evaluate(() => {
    localStorage.setItem("zev_device_id", "web_qa_device_002");
    document.querySelector("nextjs-portal")?.remove();
  });
  await page.getByRole("button", { name: /^Kích hoạt$/i }).click();
  await page.getByText("Sẵn sàng").first().waitFor({ timeout: 20000 });
  const enter = page.getByRole("button", { name: /Vào app/i });
  if ((await enter.count()) > 0) { await enter.click(); await page.waitForTimeout(400); }
  await page.getByRole("navigation").getByRole("button", { name: "Chức năng", exact: true }).click({ timeout: 8000 });
  await page.waitForTimeout(700);

  // Normalize all OFF first (sequential, patient)
  for (let i = 0; i < 10; i++) {
    const on = await page.evaluate(() => [...document.querySelectorAll('[role="switch"]')].filter((s) => s.getAttribute("aria-checked") === "true").length);
    if (on === 0) break;
    const sw = page.locator('[role="switch"]');
    const n = await sw.count();
    for (let k = 0; k < n; k++) {
      const v = await sw.nth(k).getAttribute("aria-checked");
      if (v === "true") { await sw.nth(k).click({ timeout: 8000 }); await page.waitForTimeout(1500); break; }
    }
  }
  const base = await page.evaluate(() => [...document.querySelectorAll('[role="switch"]')].filter((s) => s.getAttribute("aria-checked") === "true").length);
  console.log("BASELINE-ON:", base);

  // THE TEST: click A, then click B 60ms later — targeted BY STABLE
  // aria-label (identity), never by index (indexes shift when rows regroup).
  net.length = 0;
  reqs.length = 0;
  t0 = Date.now();
  const swA = page.getByRole("switch", { name: /AimLock Head/ });
  const swB = page.getByRole("switch", { name: /Stability Assist/ });
  await swA.click({ timeout: 8000 });
  await page.waitForTimeout(60);
  const bLabelBefore = await swB.getAttribute("aria-checked");
  await swB.click({ timeout: 8000 });
  await page.waitForTimeout(3000);
  const finalStates = await page.evaluate(() => [...document.querySelectorAll('[role="switch"]')].map((s) => s.getAttribute("aria-checked")).join(","));
  const server = await page.evaluate(async () => {
    const r = await fetch("/api/functions", { headers: { Authorization: "Bearer " + localStorage.getItem("zev_token") } });
    const j = await r.json();
    return Object.entries(j.functions).filter(([, v]) => v).map(([k]) => k).join(",");
  });
  console.log("B-LABEL-BEFORE-SECOND-CLICK:", bLabelBefore);
  console.log("UI-FINAL:", finalStates);
  console.log("SERVER-FINAL:", server || "(none)");
  console.log("--- REQUESTS ---");
  reqs.forEach((q) => console.log("t+" + q.t + "ms", q.body));
  console.log("--- RESPONSES ---");
  net.forEach((n) => console.log("t+" + n.t + "ms", n.status, "server-said-ON:" + n.on));
  console.log("ERRORS:", errors.length ? errors.join(" | ") : "(none)");
  await browser.close();
})().catch((e) => { console.log("PROBE-EXCEPTION", String(e).split("\n")[0]); process.exit(1); });
