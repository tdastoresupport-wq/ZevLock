// ZEV LOCK browser QA: Function UX + admin flows at mobile + desktop.
// Requires: dev server on :3109 and `npm install --no-save playwright-core`
// (uses the cached Playwright browsers / system Chrome, no save to package.json).
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("MISSING: run `npm install --no-save playwright-core` first, with the dev server on :3109.");
  process.exit(2);
}

const BASE = "http://127.0.0.1:3109";
const OUT = "C:/Users/Zev/AppData/Local/Temp/opencode";
const results = [];
const check = (name, cond, extra = "") => {
  results.push([cond ? "ok" : "FAIL", name, extra]);
  console.log(`  ${cond ? "ok" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  const errors = [];
  const rateLimited = [];
  const onConsole = (m) => {
    if (m.type() !== "error") return;
    // 429s during the 100-toggle burst are the rate limiter working as designed.
    if (/status of 429/.test(m.text())) { rateLimited.push(m.text()); return; }
    // 401s on /api/admin/* are expected secure denials (user probing admin APIs).
    if (/status of 401/.test(m.text()) && /\/api\/admin\//.test(m.location()?.url || "")) return;
    errors.push("console: " + m.text() + " @ " + (m.location()?.url || "?"));
  };
  try {
    // ---------- mobile: user flow ----------
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", onConsole);

    await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    check("license screen renders", await page.getByText("Nhập key để bắt đầu").count() > 0);
    await page.screenshot({ path: `${OUT}/qa-license.png` });

    await page.getByPlaceholder("ZEV-XXXX-XXXX-XXXX").fill("ZEV-DEMO-2026-VIP1");
    await page.evaluate(() => localStorage.setItem("zev_device_id", "web_qa_device_002"));
    await page.getByRole("button", { name: /^Kích hoạt$/i }).click();
    // Wait for the dashboard (first status compile can be slow in dev).
    await page.getByText("Sẵn sàng").first().waitFor({ timeout: 20000 });
    check("dashboard after activation", await page.getByText("Sẵn sàng").count() > 0);
    check("character artwork loads", (await page.getByAltText("Ảnh nhân vật Zev").count()) > 0);
    // Dismiss the welcome modal (covers nav until entered)
    const enter = page.getByRole("button", { name: /Vào app/i });
    if ((await enter.count()) > 0) { await enter.click(); await page.waitForTimeout(500); }
    const overflowHome = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check("home 390px no overflow", overflowHome <= 0, `overflow=${overflowHome}`);
    await page.screenshot({ path: `${OUT}/qa-home.png`, fullPage: true });

    // Modal a11y: license dialog exposes role + Escape closes it
    await page.getByRole("button", { name: "Bản quyền", exact: true }).click();
    await page.waitForTimeout(400);
    check("license dialog has dialog role", await page.getByRole("dialog").count() > 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("Escape closes dialog", await page.getByRole("dialog").count() === 0);
    // Viewport sweep: no overflow at 320/375/414
    for (const w of [320, 375, 414]) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.waitForTimeout(300);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`home ${w}px no overflow`, ov <= 0, `overflow=${ov}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });

    // Function tab
    await page.getByRole("navigation").getByRole("button", { name: "Chức năng" }).click();
    await page.waitForTimeout(600);
    check("function tab renders", await page.getByText("Điều khiển").count() > 0);
    const switches = page.locator('[role="switch"]');
    const n = await switches.count();
    check("8 function switches", n === 8, `found=${n}`);

    // Rapid toggle stress: 100 toggles on first switch
    const first = switches.first();
    const before = await first.getAttribute("aria-checked");
    for (let i = 0; i < 100; i++) { await first.click({ timeout: 2000 }); }
    await page.waitForTimeout(3000);
    const after = await first.getAttribute("aria-checked");
    const stuck = await page.locator("text=ĐANG LƯU").count();
    check("100 rapid toggles settle (no stuck SAVING)", stuck === 0, `before=${before} after=${after}`);
    const serverState = await page.evaluate(async () => {
      const r = await fetch("/api/functions", { headers: { Authorization: "Bearer " + localStorage.getItem("zev_token") } });
      return r.json();
    });
    const uiOn = (await first.getAttribute("aria-checked")) === "true";
    const key = "aimlock_head";
    check("UI matches server after stress", serverState.functions && serverState.functions[key] === uiOn);
    await page.screenshot({ path: `${OUT}/qa-function.png`, fullPage: true });

    // Realtime + Account
    await page.getByRole("navigation").getByRole("button", { name: "Trực tiếp" }).click();
    await page.waitForTimeout(500);
    check("realtime renders", await page.getByText("TRẠNG THÁI CHỨC NĂNG").count() > 0);
    await page.getByRole("navigation").getByRole("button", { name: "Tài khoản" }).click();
    await page.waitForTimeout(500);
    check("account shows server identity", await page.getByText("ZEV-DEMO-2026-VIP1").count() > 0);
    check("account has functions row", await page.getByText("CHỨC NĂNG").count() > 0);
    check("no install-profile embed in account", await page.getByText("IOS INSTALL PROFILE").count() === 0);
    await page.screenshot({ path: `${OUT}/qa-account.png`, fullPage: true });

    // Normal user cannot see admin in nav
    check("no admin in user nav", await page.getByRole("navigation").getByText("Admin").count() === 0);

    // /admin as normal user session: admin page shows its own login (server denies APIs)
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    check("admin route has login gate", await page.getByText("BẢNG ĐIỀU KHIỂN").count() > 0);
    const meStatus = await page.evaluate(async () => {
      const r = await fetch("/api/admin/me", { headers: { Authorization: "Bearer " + localStorage.getItem("zev_token") } });
      return r.status;
    });
    check("user token denied on admin API", meStatus === 401, `status=${meStatus}`);
    await page.screenshot({ path: `${OUT}/qa-admin-login.png` });
    await ctx.close();

    // ---------- desktop: admin flow ----------
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const admin = await ctx2.newPage();
    admin.on("pageerror", (e) => errors.push("admin pageerror: " + e.message));
    await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await admin.waitForTimeout(800);
    // Wrong password first
    await admin.getByPlaceholder("admin@example.com").fill("admin@example.com");
    await admin.getByPlaceholder("••••••••").fill("definitely-wrong");
    await admin.getByRole("button", { name: "Sign in" }).click();
    await admin.waitForTimeout(800);
    check("admin wrong password rejected in UI", await admin.getByText("Invalid email or password").count() > 0);
    await ctx2.close();
  } catch (e) {
    console.log("QA EXCEPTION: " + (e.stack || e.message).split("\n").slice(0, 4).join(" | "));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  check("zero console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  check("rate limiter engaged during 100-toggle burst", rateLimited.length > 0, `${rateLimited.length} x 429`);
  const failed = results.filter((r) => r[0] === "FAIL").length;
  console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
  if (failed) process.exitCode = 1;
})();
