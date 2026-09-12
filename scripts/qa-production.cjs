// Production business + security smoke test (throwaway key, destroyed after).
// Reads the key from the local temp file — never hardcodes or prints it.
const fs = require("fs");

const B = "https://zev-lock.pages.dev";
const KEY = fs.readFileSync("C:/Users/Zev/AppData/Local/Temp/opencode/tkey.txt", "utf8").trim();
const results = [];
const check = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`  ${cond ? "ok" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

(async () => {
  // --- business: activate -> status -> functions -> logout ---
  let r = await fetch(`${B}/api/license/activate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: KEY, device_identifier: "web_prod_qa_01", platform: "iPhone" }),
  });
  check("activate throwaway key", r.status === 200, `status=${r.status}`);
  const { token } = await r.json();
  const H = { Authorization: `Bearer ${token}` };
  const dev = "device_identifier=web_prod_qa_01";

  r = await fetch(`${B}/api/license/status?${dev}`, { headers: H });
  const s = await r.json();
  check("status ACTIVE/VIP/server_now", s.license.status === "ACTIVE" && s.license.plan === "VIP" && !!s.license.server_now,
    `${s.license.status}/${s.license.plan}`);
  check("custom display identity served", s.license.display_name === "QA Throwaway");
  check("countdown finite", !!s.license.expires_at && s.license.is_permanent === 0);

  r = await fetch(`${B}/api/functions/update`, {
    method: "POST", headers: { "content-type": "application/json", ...H },
    body: JSON.stringify({ states: { aimlock_head: true } }),
  });
  const f = await r.json();
  check("function toggle persists", r.status === 200 && f.functions.aimlock_head === true);

  // --- security ---
  r = await fetch(`${B}/api/admin/stats`, { headers: H });
  check("user denied on admin API", r.status === 401, `status=${r.status}`);
  r = await fetch(`${B}/api/mobileconfig/download?profile=legacy-60hz`, { headers: H });
  check("mobileconfig download 200 + content-type",
    r.status === 200 && (r.headers.get("content-type") || "").includes("application/x-apple-aspen-config"));
  r = await fetch(`${B}/api/mobileconfig/download?profile=../../../etc`, { headers: H });
  check("path traversal 404", r.status === 404);
  r = await fetch(`${B}/api/mobileconfig/download?profile=nope`, { headers: H });
  check("unknown preset 404", r.status === 404);
  r = await fetch(`${B}/api/profiles/generate`, {
    method: "POST", headers: { "content-type": "application/json", ...H }, body: JSON.stringify({ preset: "evil" }),
  });
  check("invalid preset rejected", r.status === 400);
  r = await fetch(`${B}/api/license/check`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "ZEV-DEMO-2026-VIP1" }),
  });
  check("public demo key absent in prod", r.status === 404, `status=${r.status}`);
  // tampering: client cannot set plan/expiry/status
  r = await fetch(`${B}/api/functions/update`, {
    method: "POST", headers: { "content-type": "application/json", ...H },
    body: JSON.stringify({ states: { aimlock_head: false }, plan: "VIP", expires_at: "2099-01-01" }),
  });
  const f2 = await r.json();
  check("client plan/expiry ignored", r.status === 200 && f2.functions.aimlock_head === false);
  const s2 = await (await fetch(`${B}/api/license/status?${dev}`, { headers: H })).json();
  check("plan still server VIP", s2.license.plan === "VIP");
  // session revocation: logout then reuse
  await fetch(`${B}/api/session/logout`, { method: "POST", headers: H });
  r = await fetch(`${B}/api/license/status?${dev}`, { headers: H });
  check("revoked session denied", r.status === 401, `status=${r.status}`);
  // headers
  r = await fetch(`${B}/`);
  const h = r.headers;
  check("security headers live",
    !!h.get("content-security-policy") && !!h.get("strict-transport-security") && h.get("x-content-type-options") === "nosniff");

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} production checks passed`);
  if (failed) process.exitCode = 1;
})();
