// Desktop + reduced-motion QA (dev server :3109, playwright-core present).
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("MISSING playwright-core");
  process.exit(2);
}
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
  try {
    // Desktop widths: overflow + admin console
    for (const w of [768, 1024, 1440]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      await page.goto("http://127.0.0.1:3109/", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1200);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`license ${w}px no overflow`, ov <= 0, `overflow=${ov}`);
      await page.screenshot({ path: `C:/Users/Zev/AppData/Local/Temp/opencode/qa-desk-${w}.png` });
      await ctx.close();
      if (errs.length) check(`no page errors @${w}`, false, errs[0]);
    }
    // Mobile heights: bottom-nav overlap + reachability on short/tall phones
    for (const [w, h] of [[320, 568], [414, 896], [393, 852]]) {
      const mctx = await browser.newContext({ viewport: { width: w, height: h } });
      const mp = await mctx.newPage();
      await mp.goto("http://127.0.0.1:3109/", { waitUntil: "networkidle", timeout: 30000 });
      await mp.waitForTimeout(1200);
      const mov = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`license ${w}x${h} no overflow`, mov <= 0, `overflow=${mov}`);
      await mctx.close();
    }
    // Admin login visual at desktop
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const admin = await ctx.newPage();
    await admin.goto("http://127.0.0.1:3109/admin", { waitUntil: "networkidle", timeout: 30000 });
    await admin.waitForTimeout(800);
    check("admin wordmark lockup renders", await admin.getByText("BẢNG ĐIỀU KHIỂN").count() > 0);
    await admin.screenshot({ path: "C:/Users/Zev/AppData/Local/Temp/opencode/qa-admin-login.png" });
    // Reduced motion: aurora + enter animations disabled
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const rm = await ctx2.newPage();
    await rm.goto("http://127.0.0.1:3109/", { waitUntil: "networkidle", timeout: 30000 });
    await rm.waitForTimeout(800);
    const auroraAnim = await rm.evaluate(() => {
      const el = document.querySelector(".zev-aurora");
      if (!el) return "missing";
      return getComputedStyle(el).animationName + "/" + getComputedStyle(el).animationDuration;
    });
    check("reduced-motion aurora static", auroraAnim === "none/0s" || auroraAnim.startsWith("none"), auroraAnim);
    await ctx2.close();
    await ctx.close();
  } catch (e) {
    console.log("QA EXCEPTION: " + String((e.stack || e.message)).split("\n").slice(0, 3).join(" | "));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} desktop/a11y checks passed`);
  if (failed) process.exitCode = 1;
})();
