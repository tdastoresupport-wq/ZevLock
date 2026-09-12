// NAV-TRANSITION full-flow verification against PRODUCTION build (:3110).
// Flows: A home-function-home-function, B via realtime/account,
// C rapid-20, D mid-transition interrupt, E reload, F reduced-motion,
// G keyboard nav. Records state + errors; fails non-zero on any anomaly.
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("MISSING playwright-core");
  process.exit(2);
}
const BASE = "http://127.0.0.1:3110";
const results = [];
const check = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`  ${cond ? "ok" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

async function newApp(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("ZEV-XXXX-XXXX-XXXX").fill("ZEV-DEMO-2026-VIP1");
  await page.evaluate(() => localStorage.setItem("zev_device_id", "web_dbg_003"));
  await page.getByRole("button", { name: /^Kích hoạt$/i }).click();
  await page.getByText("Sẵn sàng").first().waitFor({ timeout: 20000 });
  const enter = page.getByRole("button", { name: /Vào app/i });
  if ((await enter.count()) > 0) { await enter.click(); await page.waitForTimeout(400); }
  return { ctx, page, errors };
}

async function snap(page) {
  return await page.evaluate(() => {
    const mains = [...document.querySelectorAll("main")].map((m) => ({
      op: getComputedStyle(m).opacity,
      txt: (m.innerText || "").slice(0, 24).replace(/\n/g, "|"),
    }));
    const cur = [...document.querySelectorAll("nav button")].find((b) => b.getAttribute("aria-current") === "page");
    const portal = !!document.querySelector("nextjs-portal");
    return { mains, current: cur ? cur.textContent.trim().slice(0, 10) : "(none)", portal };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  try {
    const { ctx, page, errors } = await newApp(browser);
    const nav = async (label) => {
      await page.getByRole("navigation").getByRole("button", { name: label, exact: true }).click({ timeout: 5000 });
    };
    const expectTab = async (label, where) => {
      await page.waitForTimeout(500);
      const s = await snap(page);
      const okMain = s.mains.length === 1 && s.mains[0].op === "1";
      check(`${where}: single settled main + pill on ${label}`, okMain && s.current === label, JSON.stringify(s));
    };

    // A
    await nav("Chức năng"); await expectTab("Chức năng", "A home->function");
    await nav("Trang chủ"); await expectTab("Trang chủ", "A function->home");
    await nav("Chức năng"); await expectTab("Chức năng", "A home->function 2");
    // B
    await nav("Trực tiếp"); await nav("Chức năng"); await expectTab("Chức năng", "B via realtime");
    await nav("Tài khoản"); await nav("Chức năng"); await expectTab("Chức năng", "B via account");
    // C rapid 20
    const seq = ["Trang chủ", "Chức năng", "Trực tiếp", "Tài khoản"];
    for (let i = 0; i < 20; i++) { await nav(seq[i % 4]); await page.waitForTimeout(60); }
    await page.waitForTimeout(1500);
    {
      const s = await snap(page);
      check("C rapid-20 settled clean", s.mains.length === 1 && s.mains[0].op === "1", JSON.stringify(s));
    }
    // D mid-transition interrupt
    await nav("Trang chủ"); await page.waitForTimeout(800);
    await nav("Chức năng"); await page.waitForTimeout(50);
    await nav("Trực tiếp"); await page.waitForTimeout(800);
    {
      const s = await snap(page);
      check("D interrupt lands on realtime settled", s.mains.length === 1 && s.current === "Trực tiếp", JSON.stringify(s));
    }
    // Function content intact after all nav
    await nav("Chức năng"); await page.waitForTimeout(500);
    {
      const n = await page.locator('[role="switch"]').count();
      const titles = await page.locator("h1").first().innerText().catch(() => "?");
      check("Function content intact (8 switches)", n === 8, `switches=${n} h1=${titles}`);
    }
    // G keyboard: Tab to nav + Enter
    await page.keyboard.press("Escape").catch(() => {});
    await nav("Trang chủ"); await page.waitForTimeout(400);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("nav button")];
      btns[1].focus();
    });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    {
      const s = await snap(page);
      check("G keyboard Enter activates function", s.current === "Chức năng", JSON.stringify(s.current));
    }
    check("no nextjs-portal in production", (await snap(page)).portal === false);
    check("zero console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();

    // E reload (lands home by design, session persists)
    {
      const c2 = await newApp(browser);
      await c2.page.getByRole("navigation").getByRole("button", { name: "Chức năng", exact: true }).click();
      await c2.page.waitForTimeout(500);
      await c2.page.reload({ waitUntil: "networkidle" });
      await c2.page.waitForTimeout(1500);
      const stillAuthed = await c2.page.getByText("Sẵn sàng").count().then((n) => n > 0).catch(() => false);
      check("E reload keeps session (no license wall)", stillAuthed);
      await c2.ctx.close();
    }

    // F reduced motion
    {
      const c3 = await newApp(browser, { reducedMotion: "reduce" });
      await c3.page.getByRole("navigation").getByRole("button", { name: "Chức năng", exact: true }).click();
      await c3.page.waitForTimeout(400);
      const s = await snap(c3.page);
      check("F reduced-motion nav works", s.mains.length === 1 && s.current === "Chức năng", JSON.stringify(s));
      await c3.ctx.close();
    }
  } catch (e) {
    console.log("QA EXCEPTION: " + String((e.stack || e.message)).split("\n").slice(0, 4).join(" | "));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} nav checks passed`);
  if (failed) process.exitCode = 1;
})();
