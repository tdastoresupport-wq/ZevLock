// §3 convergence probe v2: prove Home/Function/Realtime/server agree at rest
// and after reload. Robust counting + toggle retry (rate-limit aware).
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("MISSING playwright-core");
  process.exit(2);
}
const BASE = "http://127.0.0.1:3109";
const results = [];
const check = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`  ${cond ? "ok" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const nav = async (l) => {
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    await page.getByRole("navigation").getByRole("button", { name: l, exact: true }).click({ timeout: 8000 });
    await page.waitForTimeout(700);
  };
  const counts = () => page.evaluate(() => {
    const txt = document.querySelector("main")?.innerText || "";
    const hm = txt.match(/(\d+) trên \d+ đang bật/);
    const rm = txt.match(/(\d+)\/8/);
    const on = [...document.querySelectorAll('[role="switch"]')].filter(
      (s) => s.getAttribute("aria-checked") === "true"
    ).length;
    return { home: hm ? Number(hm[1]) : null, realtime: rm ? Number(rm[1]) : null, uiSwitches: on, tab: document.querySelector('nav button[aria-current="page"]')?.textContent.trim() };
  });
  const serverCount = () => page.evaluate(async () => {
    const r = await fetch("/api/functions", { headers: { Authorization: "Bearer " + localStorage.getItem("zev_token") } });
    const j = await r.json();
    return Object.values(j.functions).filter(Boolean).length;
  });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("ZEV-XXXX-XXXX-XXXX").fill("ZEV-DEMO-2026-VIP1");
  await page.evaluate(() => localStorage.setItem("zev_device_id", "web_qa_device_002"));
  await page.getByRole("button", { name: /^Kích hoạt$/i }).click();
  await page.getByText("Sẵn sàng").first().waitFor({ timeout: 20000 });
  const enter = page.getByRole("button", { name: /Vào app/i });
  if ((await enter.count()) > 0) { await enter.click(); await page.waitForTimeout(400); }

  // Normalize: all OFF via master (retry until settled, rate-limit aware)
  await nav("Chức năng");
  for (let i = 0; i < 6; i++) {
    const label = await page.getByRole("button", { name: /tắt tất cả|Bật tất cả/i }).innerText().catch(() => "");
    if (!label.includes("Tắt")) break;
    await page.getByRole("button", { name: /Tắt tất cả/ }).click();
    await page.waitForTimeout(2500);
  }

  // Toggle first switch ON via UI (retry on rate-limit rollback)
  let uiOn = false;
  for (let i = 0; i < 6 && !uiOn; i++) {
    await page.locator('[role="switch"]').first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    uiOn = await page.evaluate(
      () => [...document.querySelectorAll('[role="switch"]')][0]?.getAttribute("aria-checked") === "true"
    );
  }
  check("UI toggle took effect", uiOn);

  await nav("Trang chủ");
  const h = await counts();
  await nav("Trực tiếp");
  const rt = await counts();
  await nav("Chức năng");
  const f = await counts();
  const s = await serverCount();
  check(
    "Home/Function/Realtime/server agree",
    h.home === 1 && rt.realtime === 1 && f.uiSwitches === 1 && s === 1,
    `home=${h.home} realtime=${rt.realtime} function=${f.uiSwitches} server=${s}`
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const enter2 = page.getByRole("button", { name: /Vào app/i });
  if ((await enter2.count()) > 0) { await enter2.click(); await page.waitForTimeout(400); }
  const h2 = await counts();
  await nav("Trực tiếp");
  const rt2 = await counts();
  const s2 = await serverCount();
  check(
    "agreement survives reload",
    h2.home === 1 && rt2.realtime === 1 && s2 === 1,
    `home=${h2.home} realtime=${rt2.realtime} server=${s2}`
  );

  // Cleanup back to all off
  await nav("Chức năng");
  for (let i = 0; i < 6; i++) {
    const label = await page.getByRole("button", { name: /tắt tất cả|Bật tất cả/i }).innerText().catch(() => "");
    if (!label.includes("Tắt")) break;
    await page.getByRole("button", { name: /Tắt tất cả/ }).click();
    await page.waitForTimeout(2500);
  }
  check("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} convergence checks passed`);
  if (failed) process.exitCode = 1;
})().catch((e) => { console.log("PROBE-EXCEPTION", String(e).split("\n")[0]); process.exit(1); });
