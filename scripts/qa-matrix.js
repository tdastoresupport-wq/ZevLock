// Full multi-switch matrix: sequential 8/8 ON+OFF, alternating, bulk,
// cross-surface, reload, rapid cross-key. Fails on any divergence.
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
    await page.waitForTimeout(600);
  };
  const sw = (name) => page.getByRole("switch", { name: new RegExp(name) });
  const uiCount = () => page.evaluate(() => [...document.querySelectorAll('[role="switch"]')].filter((s) => s.getAttribute("aria-checked") === "true").length);
  const serverCount = () => page.evaluate(async () => {
    const r = await fetch("/api/functions", { headers: { Authorization: "Bearer " + localStorage.getItem("zev_token") } });
    return Object.values((await r.json()).functions).filter(Boolean).length;
  });
  const settle = async () => {
    for (let i = 0; i < 20; i++) {
      const busy = await page.evaluate(() => [...document.querySelectorAll("p")].some((p) => /ĐANG LƯU|Saving/i.test(p.textContent || "")));
      if (!busy) break;
      await page.waitForTimeout(500);
    }
  };
  const names = ["AimLock Head", "Stability Assist", "Aim Hold", "Aim LockDown", "Sensitivity Boost", "Screen Boost", "HeadShot Fix", "Fix Recoil"];

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("ZEV-XXXX-XXXX-XXXX").fill("ZEV-DEMO-2026-VIP1");
  await page.evaluate(() => localStorage.setItem("zev_device_id", "web_qa_device_002"));
  await page.getByRole("button", { name: /^Kích hoạt$/i }).click();
  await page.getByText("Sẵn sàng").first().waitFor({ timeout: 20000 });
  const enter = page.getByRole("button", { name: /Vào app/i });
  if ((await enter.count()) > 0) { await enter.click(); await page.waitForTimeout(400); }
  await nav("Chức năng");

  // 8/8 sequential ON (patient, one server round-trip each)
  for (const n of names) {
    const cur = await sw(n).getAttribute("aria-checked");
    if (cur !== "true") { await sw(n).click({ timeout: 8000 }); await settle(); }
  }
  check("8/8 sequential ON", (await uiCount()) === 8 && (await serverCount()) === 8,
    `ui=${await uiCount()} server=${await serverCount()}`);

  // Cross-surface agreement at 8/8
  await nav("Trực tiếp");
  const rt = await page.evaluate(() => {
    const t = document.querySelector("main")?.innerText || "";
    const m = t.match(/(\d+)\/8/);
    return m ? Number(m[1]) : -1;
  });
  await nav("Trang chủ");
  const hm = await page.evaluate(() => {
    const t = document.querySelector("main")?.innerText || "";
    const m = t.match(/(\d+) trên \d+ đang bật/);
    if (m) return Number(m[1]);
    return /Mọi thứ đang bật/.test(t) ? 8 : (/Mọi thứ đang tắt/.test(t) ? 0 : -1);
  });
  check("cross-surface 8/8", rt === 8 && hm === 8, `realtime=${rt} home=${hm}`);

  // Alternating ON/OFF pattern
  await nav("Chức năng");
  const want = [true, false, true, false, true, false, true, false];
  const updStatuses = [];
  await page.exposeFunction("qaLogUpdate", (s) => updStatuses.push(s)).catch(() => {});
  await page.evaluate(() => {
    const orig = window.fetch;
    window.fetch = async (...a) => {
      const r = await orig(...a);
      if (typeof a[0] === "string" && a[0].includes("/api/functions/update")) {
        r.clone().text().then((t) => {
          try {
            const j = JSON.parse(t);
            window.qaLogUpdate(r.status + ":" + Object.entries(j.functions).filter(([, v]) => v).map(([k]) => k).join("+"));
          } catch { window.qaLogUpdate(r.status + ":unparseable"); }
        }).catch(() => {});
      }
      return r;
    };
  });
  for (let i = 0; i < 8; i++) {
    const cur = (await sw(names[i]).getAttribute("aria-checked")) === "true";
    if (cur !== want[i]) {
      await sw(names[i]).click({ timeout: 8000 });
      await settle();
      await page.waitForTimeout(600);
      const afterClick = await sw(names[i]).getAttribute("aria-checked");
      const failed = await page.evaluate(() => document.querySelector("main")?.innerText.includes("hoàn tác") ?? false);
      console.log(`  step ${names[i]}: was=${cur} want=${want[i]} now=${afterClick} failedMsg=${failed}`);
    }
  }
  console.log("  update-responses:", updStatuses.join(" | "));
  const dumpSwitches = (tag) => page.evaluate((t) => {
    const rows = [...document.querySelectorAll('[role="switch"]')].map((s) => {
      const op = getComputedStyle(s).opacity;
      return (s.getAttribute("aria-label") || "?").split(",")[0] + "=" + s.getAttribute("aria-checked") + "@op" + op;
    });
    return t + " [" + rows.length + " rows]: " + rows.join(" | ");
  }, "");
  console.log("  " + await dumpSwitches("T0"));
  await page.waitForTimeout(3000);
  console.log("  " + await dumpSwitches("T+3s"));
  const readUiByName = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('[role="switch"]')];
    const map = {};
    all.forEach((s) => {
      // Labels vary by surface ("Name, on" vs "Name on") — strip the state suffix.
      const label = (s.getAttribute("aria-label") || "").replace(/,? (on|off)$/, "");
      if (getComputedStyle(s).opacity === "1") map[label] = s.getAttribute("aria-checked") === "true";
    });
    return { n: all.length, map };
  });
  const _dbg = await readUiByName();
  console.log("  uiRead: rows=" + _dbg.n + " map=" + JSON.stringify(_dbg.map));
  const altUi = ["AimLock Head", "Stability Assist", "Aim Hold", "Aim LockDown", "Sensitivity Boost", "Screen Boost", "HeadShot Fix", "Fix Recoil"].map((n) => !!_dbg.map[n]);
  const altSrv = await page.evaluate(async () => {
    const r = await fetch("/api/functions", { headers: { Authorization: "Bearer " + localStorage.getItem("zev_token") } });
    const j = await r.json();
    return ["aimlock_head", "stability_assist", "aim_hold", "aim_lockdown", "sensitivity_boost", "screen_boost", "headshot_fix", "fix_recoil"].map((k) => !!j.functions[k]);
  });
  check("alternating pattern exact", JSON.stringify(altUi) === JSON.stringify(want) && JSON.stringify(altSrv) === JSON.stringify(want),
    `ui=${altUi.map((v) => (v ? 1 : 0)).join("")} srv=${altSrv.map((v) => (v ? 1 : 0)).join("")}`);

  // Bulk OFF then bulk ON (master flips the whole set: from partial it goes all-ON first)
  const master = () => page.getByRole("button", { name: /tắt tất cả|Bật tất cả/i });
  const masterLabel = async () => master().innerText().catch(() => "?");
  if ((await masterLabel()).includes("Bật")) {
    await master().click();
    await settle(); await page.waitForTimeout(1000);
  }
  check("bulk setup 8/8", (await serverCount()) === 8);
  await master().click();
  await settle(); await page.waitForTimeout(1000);
  console.log("  bulk-off settle: masterNow=" + JSON.stringify(await masterLabel()));
  const bulkOffUi = await page.evaluate(() => [...document.querySelectorAll('[role="switch"]')].filter((s) => s.getAttribute("aria-checked") === "true").length);
  const bulkOffSrv = await serverCount();
  check("bulk OFF 0/8", bulkOffUi === 0 && bulkOffSrv === 0, `ui=${bulkOffUi} server=${bulkOffSrv}`);
  const uiCountNow = () => page.evaluate(() => [...document.querySelectorAll('[role="switch"]')].filter((s) => s.getAttribute("aria-checked") === "true").length);
  await master().click(); await settle(); await page.waitForTimeout(1000);
  check("bulk ON 8/8", (await uiCountNow()) === 8 && (await serverCount()) === 8);

  // Reload persistence at 8/8
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const enter2 = page.getByRole("button", { name: /Vào app/i });
  if ((await enter2.count()) > 0) { await enter2.click(); await page.waitForTimeout(400); }
  check("reload persists 8/8", (await serverCount()) === 8);

  // Rapid cross-key burst: 4 fast toggles, final must converge
  await nav("Chức năng");
  for (const n of names.slice(0, 4)) { await sw(n).click({ timeout: 8000 }); await page.waitForTimeout(120); }
  await page.waitForTimeout(4000);
  const qu = await uiCount();
  const qs = await serverCount();
  check("rapid burst converges UI==server", qu === qs, `ui=${qu} server=${qs}`);

  // Cleanup to all off
  await nav("Chức năng");
  for (let i = 0; i < 10; i++) {
    const label = await page.getByRole("button", { name: /tắt tất cả|Bật tất cả/i }).innerText().catch(() => "");
    if (!label.includes("Tắt")) break;
    await page.getByRole("button", { name: /Tắt tất cả/ }).click();
    await settle();
    await page.waitForTimeout(800);
  }
  check("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} matrix checks passed`);
  if (failed) process.exitCode = 1;
})().catch((e) => { console.log("PROBE-EXCEPTION", String(e).split("\n")[0]); process.exit(1); });
