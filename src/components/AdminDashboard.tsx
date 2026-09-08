"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban, Copy, Eye, KeyRound, Pencil, Plus, RefreshCcw, Search, ShieldCheck, Smartphone, Trash2,
} from "lucide-react";
import { adminAuth, adminReq } from "@/lib/api";
import { Card, ConfirmDialog, ErrorState, Label, Skeleton } from "@/components/ui";
import { BrandMark } from "@/components/BrandMark";
import { KeyAvatar } from "@/components/KeyAvatar";
import { fmtDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { License } from "@/lib/types";

type AdminTab = "overview" | "licenses" | "devices" | "logs" | "templates";

interface AdminMe { id: string; email: string; name: string; role: string }
interface Stats {
  licenses_total: number; licenses_active: number; licenses_expired: number;
  licenses_revoked: number; devices_total: number; sessions_24h: number;
}
interface LogRow { id: number; type: string; license_id: string | null; metadata: string | null; created_at: string }
interface DeviceRow { id: string; license_id: string; device_identifier: string; platform: string; last_seen_at: string }

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  UNUSED: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  EXPIRED: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  SUSPENDED: "text-orange-300 border-orange-500/30 bg-orange-500/10",
  REVOKED: "text-red-300 border-red-500/30 bg-red-500/10",
  BOUND: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  UNBOUND: "text-slate-400 border-white/10 bg-white/5",
};

const canDestroy = (role: string) => role === "SUPER_ADMIN" || role === "ADMIN";

export function AdminDashboard() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<AdminTab>("licenses");

  useEffect(() => {
    adminAuth.me()
      .then((r) => setMe(r.admin))
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  async function login() {
    setAuthError("");
    setBusy(true);
    try {
      const res = await adminAuth.login(email.trim(), password);
      try { localStorage.setItem("zev_admin_token", res.token); } catch { /* ignore */ }
      setMe(res.admin);
    } catch {
      setAuthError("Invalid email or password.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { await adminAuth.logout(); } catch { /* ignore */ }
    try { localStorage.removeItem("zev_admin_token"); } catch { /* ignore */ }
    setMe(null);
  }

  if (checking) {
    return (
      <div className="zev-top-pad mx-auto flex min-h-dvh w-full max-w-[480px] items-center justify-center px-5">
        <BrandMark size={64} />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="zev-top-pad mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10">
        <div className="mt-12 flex flex-col items-center">
          <BrandMark size={64} />
          <h1 className="mt-4 text-center text-2xl font-black tracking-[0.2em]">ZEV ADMIN</h1>
        </div>
        <Card className="mt-6">
          <Label>EMAIL</Label>
          <input
            type="email"
            autoComplete="username"
            className="zev-input mt-1.5 !tracking-normal"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="mt-3">
            <Label>PASSWORD</Label>
            <input
              type="password"
              autoComplete="current-password"
              className="zev-input mt-1.5 !tracking-normal"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void login(); }}
            />
          </div>
          {authError && <p className="mt-2 text-[13px] text-red-400" role="alert">{authError}</p>}
          <button className="zev-btn-primary mt-4" disabled={busy} onClick={() => void login()}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-500">First run: uses ADMIN_EMAIL / ADMIN_PASSWORD from the server environment.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="zev-top-pad mx-auto min-h-dvh w-full max-w-[860px] px-4 pb-10">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <h1 className="text-lg font-black tracking-[0.18em]">ZEV ADMIN</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-purple-300/30 bg-purple-500/10 px-2.5 py-1 text-[10px] font-black tracking-wider text-purple-200">
            {me.role}
          </span>
          <button className="zev-btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </div>
      <p className="mt-1 text-[12px] text-slate-500">{me.name} · {me.email}</p>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Admin sections">
        {(["overview", "licenses", "templates", "devices", "logs"] as AdminTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full border px-4 py-2 text-[13px] font-bold capitalize",
              tab === t ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-white/10 text-slate-400"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "overview" && <Overview />}
        {tab === "licenses" && <Licenses role={me.role} />}
        {tab === "templates" && <Templates role={me.role} />}
        {tab === "devices" && <Devices />}
        {tab === "logs" && <Logs />}
      </div>
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */

function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [s, l] = await Promise.all([
        adminReq<Stats>("/api/admin/stats"),
        adminReq<{ items: LogRow[] }>("/api/admin/logs?limit=10"),
      ]);
      setStats(s);
      setLogs(l.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!stats) return <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;

  const cards: [string, number][] = [
    ["Active keys", stats.licenses_active],
    ["Expired keys", stats.licenses_expired],
    ["Revoked keys", stats.licenses_revoked],
    ["Total keys", stats.licenses_total],
    ["Bound devices", stats.devices_total],
    ["Sessions (24h)", stats.sessions_24h],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, v]) => (
          <Card key={label}>
            <Label>{label.toUpperCase()}</Label>
            <p className="tnum mt-1 text-2xl font-black">{v}</p>
          </Card>
        ))}
      </div>
      <Card>
        <Label>RECENT ACTIVITY</Label>
        <div className="mt-2 space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="truncate font-mono text-slate-300">{l.type}</span>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">{new Date(l.created_at).toLocaleString("en-GB", { hour12: false })}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-[13px] text-slate-500">No events yet.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Licenses ------------------------------ */

function Licenses({ role }: { role: string }) {
  const [items, setItems] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; label: string; run: () => Promise<void> }>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (p = page) => {
    try {
      setLoading(true);
      setError("");
      const q = new URLSearchParams({ page: String(p), limit: "10" });
      if (search.trim()) q.set("search", search.trim());
      if (statusF) q.set("status", statusF);
      const res = await adminReq<{ items: License[]; total: number }>(`/api/admin/licenses?${q}`);
      setItems(res.items);
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusF]);

  useEffect(() => { void load(1); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(path: string, init?: RequestInit, msg = "Done.") {
    setNotice("");
    await adminReq(path, init);
    setNotice(msg);
    await load();
  }

  async function copyKey(key: string) {
    try { await navigator.clipboard.writeText(key); setNotice("Key copied."); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center text-[13px] text-emerald-200">
          {notice}
        </p>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="zev-input pl-10 !tracking-normal"
            placeholder="Search key or name…"
            aria-label="Search keys"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(1); }}
          />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Filter by status" className="zev-input w-[128px] !tracking-normal">
          <option value="">All</option>
          {["UNUSED", "ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button className="zev-btn-ghost flex-1" onClick={() => void load(1)}>Apply filters</button>
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-violet-600 p-[11px] text-sm font-bold" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New key
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading && (<><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></>)}

      {!loading && items.map((l) => (
        <Card key={l.id} className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <KeyAvatar value={l.avatar} name={l.display_name || l.key} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-black">{l.display_name || "Unnamed key"}</p>
              <p className="truncate font-mono text-[11px] text-slate-500">{l.key}</p>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black", STATUS_COLORS[l.status])}>
              {l.status}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {l.plan} · {l.bound_devices ?? 0}/{l.device_limit} devices · exp {l.expires_at ? fmtDate(l.expires_at) : "Never"} · used {l.last_used_at ? timeAgo(l.last_used_at) : "never"}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <RowBtn title="Copy key" onClick={() => void copyKey(l.key)}><Copy size={14} /></RowBtn>
            <RowBtn title="View / edit" onClick={() => setEditing(l)}><Eye size={14} /></RowBtn>
            <RowBtn title="Extend 30 days" label="+30d" onClick={() => void run(`/api/admin/licenses/${l.id}/extend`, { method: "POST", body: JSON.stringify({ extra_days: 30 }) })} />
            <RowBtn title="Unbind devices" onClick={() => void run(`/api/admin/licenses/${l.id}/reset-device`, { method: "POST" }, "Devices unbound.")}><Smartphone size={14} /></RowBtn>
            {(l.status === "UNUSED" || l.status === "SUSPENDED" || l.status === "EXPIRED") && (
              <RowBtn title="Activate" onClick={() => void run(`/api/admin/licenses/${l.id}/activate`, { method: "POST", body: JSON.stringify({}) }, "Key activated.")}>
                <ShieldCheck size={14} />
              </RowBtn>
            )}
            {l.status !== "SUSPENDED" && l.status !== "REVOKED" && (
              <RowBtn title="Suspend" onClick={() => setConfirm({ title: "Suspend key?", body: `${l.display_name || l.key} stops working immediately.`, label: "Suspend", run: () => run(`/api/admin/licenses/${l.id}/suspend`, { method: "POST" }, "Key suspended.") })}>
                <Ban size={14} />
              </RowBtn>
            )}
            {canDestroy(role) && l.status !== "REVOKED" && (
              <RowBtn title="Revoke" danger onClick={() => setConfirm({ title: "Revoke key?", body: `${l.display_name || l.key} is permanently revoked.`, label: "Revoke", run: () => run(`/api/admin/licenses/${l.id}/revoke`, { method: "POST" }, "Key revoked.") })}>
                <RefreshCcw size={14} />
              </RowBtn>
            )}
            {canDestroy(role) && (
              <RowBtn title="Delete" danger onClick={() => setConfirm({ title: "Delete key?", body: "The key, its devices and sessions are removed.", label: "Delete", run: () => run(`/api/admin/licenses/${l.id}`, { method: "DELETE" }, "Key deleted.") })}>
                <Trash2 size={14} />
              </RowBtn>
            )}
          </div>
        </Card>
      ))}
      {!loading && items.length === 0 && !error && <Card><p className="text-center text-sm text-slate-400">No keys match.</p></Card>}

      <div className="flex items-center justify-between text-[13px] text-slate-400">
        <button className="zev-btn-ghost" disabled={page <= 1} onClick={() => void load(page - 1)}>Prev</button>
        <span>Page {page} · {total} total</span>
        <button className="zev-btn-ghost" disabled={page * 10 >= total} onClick={() => void load(page + 1)}>Next</button>
      </div>

      {showCreate && <KeyCreator onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(1); }} />}
      {editing && (
        <KeyEditor
          license={editing}
          onClose={() => setEditing(null)}
          onSaved={(l) => { setEditing(null); setNotice("Key updated."); void load(); if (l) setEditing(l); }}
        />
      )}
      {confirm && (
        <ConfirmDialog title={confirm.title} body={confirm.body} confirmLabel={confirm.label} danger onConfirm={async () => { await confirm.run(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

function RowBtn({ children, title, label, danger, onClick }: {
  children?: React.ReactNode; title: string; label?: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn("zev-btn-ghost !px-2.5 !py-1.5 text-xs", danger && "!text-red-300")}
    >
      {children ?? label}
    </button>
  );
}

/* ------------------------------ Key creator (3 steps) ------------------------------ */

const DURATIONS = [
  { id: "hour", label: "1 hour" },
  { id: "day", label: "1 day" },
  { id: "week", label: "1 week" },
  { id: "month", label: "1 month" },
  { id: "custom", label: "Custom" },
  { id: "permanent", label: "Permanent" },
];

function KeyCreator({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState("Premium");
  const [duration, setDuration] = useState("month");
  const [customDays, setCustomDays] = useState(90);
  const [limit, setLimit] = useState(1);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("zev");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials, setInitials] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<License | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function avatarValue(): string | undefined {
    if (avatar === "upload") return avatarUrl || undefined;
    if (avatar === "url") return avatarUrl.trim() || undefined;
    if (avatar === "initials") return initials.trim().toUpperCase().slice(0, 4) || undefined;
    return "zev";
  }

  async function onFile(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG, or WebP images.");
      return;
    }
    if (file.size > 96 * 1024) {
      setError("Image must be under 96 KB.");
      return;
    }
    const data = await file.arrayBuffer().then(
      (buf) => `data:${file.type};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`
    );
    setAvatarUrl(data);
  }

  async function generate() {
    try {
      setBusy(true);
      setError("");
      const res = await adminReq<{ license: License }>("/api/admin/licenses", {
        method: "POST",
        body: JSON.stringify({
          plan,
          duration_preset: duration,
          custom_days: duration === "custom" ? customDays : undefined,
          device_limit: limit,
          display_name: name.trim() || undefined,
          avatar: avatarValue(),
          notes: notes.trim() || undefined,
        }),
      });
      setResult(res.license);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="zev-card max-h-[88dvh] w-full max-w-[440px] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-black">NEW KEY · STEP {Math.min(step, 3)} OF 3</h3>

        {step === 1 && (
          <div className="mt-4 space-y-3">
            <div>
              <Label>PLAN</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {["Free", "Premium", "VIP"].map((p) => (
                  <button key={p} onClick={() => setPlan(p)} className={cn("rounded-xl border px-2 py-2.5 text-[13px] font-bold", plan === p ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>DURATION</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {DURATIONS.map((d) => (
                  <button key={d.id} onClick={() => setDuration(d.id)} className={cn("rounded-xl border px-2 py-2.5 text-[13px] font-bold", duration === d.id ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>
                    {d.label}
                  </button>
                ))}
              </div>
              {duration === "custom" && (
                <input type="number" min={1} max={3650} value={customDays} onChange={(e) => setCustomDays(Number(e.target.value))} aria-label="Custom days" className="zev-input mt-2 !tracking-normal" />
              )}
            </div>
            <div>
              <Label>DEVICE LIMIT</Label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} onClick={() => setLimit(n)} className={cn("rounded-xl border px-2 py-2.5 text-[13px] font-bold", limit === n ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-3">
            <div>
              <Label>DISPLAY NAME</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="e.g. James — iPhone" className="zev-input mt-1.5 !tracking-normal" />
            </div>
            <div>
              <Label>AVATAR</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <KeyAvatar value={avatarValue() ?? "zev"} name={name || "Z"} size={48} />
                <div className="grid flex-1 grid-cols-4 gap-1.5">
                  {[["zev", "ZEV"], ["initials", "ABC"], ["upload", "File"], ["url", "URL"]].map(([id, label]) => (
                    <button key={id} onClick={() => setAvatar(id)} className={cn("rounded-xl border px-1 py-2 text-[12px] font-bold", avatar === id ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {avatar === "initials" && (
                <input value={initials} onChange={(e) => setInitials(e.target.value)} maxLength={4} placeholder="JD" aria-label="Initials" className="zev-input mt-2 !tracking-normal" />
              )}
              {avatar === "url" && (
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" aria-label="Avatar URL" className="zev-input mt-2 !tracking-normal" />
              )}
              {avatar === "upload" && (
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onFile(e.target.files?.[0])} aria-label="Upload avatar" className="mt-2 text-[13px] text-slate-300" />
              )}
            </div>
            <div>
              <Label>NOTES</Label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Internal note (never shown to users)" className="zev-input mt-1.5 !tracking-normal" />
            </div>
            <Card className="!p-3 text-[12.5px] text-slate-300">
              <p><b>{plan}</b> · {DURATIONS.find((d) => d.id === duration)?.label}{duration === "custom" ? ` (${customDays}d)` : ""} · {limit} device{limit > 1 ? "s" : ""}</p>
              <p className="mt-0.5 text-slate-500">{name.trim() || "Unnamed key"}</p>
            </Card>
          </div>
        )}

        {step === 3 && !result && (
          <div className="mt-4">
            <p className="text-[13px] text-slate-400">Review looks good? The key is shown once after generation.</p>
          </div>
        )}

        {error && <p role="alert" className="mt-2 text-[13px] text-red-400">{error}</p>}

        {result && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-emerald-200"><ShieldCheck size={13} /> KEY CREATED — COPY IT NOW</p>
            <p className="mt-1.5 break-all font-mono text-sm font-bold text-emerald-100">{result.key}</p>
            <p className="mt-1 text-xs text-emerald-100/70">{result.plan} · exp {result.expires_at ? fmtDate(result.expires_at) : "Never"} · limit {result.device_limit}</p>
            <button className="zev-btn-ghost mt-2 w-full text-xs" onClick={() => { void navigator.clipboard.writeText(result.key); }}>
              <span className="flex items-center justify-center gap-1.5"><Copy size={13} /> Copy key</span>
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          {result ? (
            <button className="zev-btn-ghost flex-1" onClick={onClose}>Done</button>
          ) : (
            <>
              <button className="zev-btn-ghost flex-1" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
                {step === 1 ? "Cancel" : "Back"}
              </button>
              {step < 3 ? (
                <button className="flex-1 rounded-[14px] bg-violet-600 p-[11px] text-sm font-bold" onClick={() => setStep(step + 1)}>Continue</button>
              ) : (
                <button disabled={busy} onClick={() => void generate()} className="flex-1 rounded-[14px] bg-violet-600 p-[11px] text-sm font-bold disabled:opacity-50">
                  {busy ? "Generating…" : "Generate key"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Key editor ------------------------------ */

function KeyEditor({ license, onClose, onSaved }: {
  license: License;
  onClose: () => void;
  onSaved: (l: License | null) => void;
}) {
  const [name, setName] = useState(license.display_name ?? "");
  const [avatar, setAvatar] = useState(license.avatar ?? "zev");
  const [notes, setNotes] = useState(license.notes ?? "");
  const [plan, setPlan] = useState(license.plan);
  const [limit, setLimit] = useState(license.device_limit);
  const [expires, setExpires] = useState(license.expires_at ? license.expires_at.slice(0, 16) : "");
  const [permanent, setPermanent] = useState(!license.expires_at);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    try {
      setBusy(true);
      setError("");
      const res = await adminReq<{ license: License }>(`/api/admin/licenses/${license.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: name.trim() || null,
          avatar: avatar || null,
          notes: notes.trim() || null,
          plan,
          device_limit: limit,
          expires_at: permanent ? null : new Date(expires).toISOString(),
        }),
      });
      onSaved(res.license);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="zev-card max-h-[88dvh] w-full max-w-[440px] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black"><KeyRound size={17} /> Edit key</h3>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", STATUS_COLORS[license.status])}>{license.status}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <KeyAvatar value={avatar || "zev"} name={name || "Z"} size={52} />
          <p className="min-w-0 flex-1 break-all font-mono text-[12px] font-bold text-slate-300">{license.key}</p>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <Label>DISPLAY NAME</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} className="zev-input mt-1.5 !tracking-normal" />
          </div>
          <div>
            <Label>AVATAR</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button onClick={() => setAvatar("zev")} className={cn("rounded-xl border px-2 py-2 text-[12px] font-bold", avatar === "zev" ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>ZEV character</button>
              <button onClick={() => setAvatar((name.trim().slice(0, 2) || "ZX").toUpperCase())} className={cn("rounded-xl border px-2 py-2 text-[12px] font-bold", avatar !== "zev" && !avatar.startsWith("http") && !avatar.startsWith("data:") ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>Initials</button>
            </div>
            <input value={avatar.startsWith("http") || avatar.startsWith("data:") ? avatar : ""} onChange={(e) => setAvatar(e.target.value)} placeholder="…or paste image URL" aria-label="Avatar URL" className="zev-input mt-1.5 !tracking-normal" />
          </div>
          <div>
            <Label>PLAN</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {["Free", "Premium", "VIP"].map((p) => (
                <button key={p} onClick={() => setPlan(p)} className={cn("rounded-xl border px-2 py-2 text-[12px] font-bold", plan === p ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400")}>{p}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>DEVICE LIMIT</Label>
              <input type="number" min={1} max={10} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="zev-input mt-1.5 !tracking-normal" />
            </div>
            <div>
              <Label>EXPIRES</Label>
              <input type="datetime-local" value={expires} disabled={permanent} onChange={(e) => setExpires(e.target.value)} className="zev-input mt-1.5 !tracking-normal disabled:opacity-40" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-300">
            <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="h-4 w-4 accent-purple-500" />
            Permanent (no expiry)
          </label>
          <div>
            <Label>NOTES</Label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="zev-input mt-1.5 !tracking-normal" />
          </div>
        </div>

        {error && <p role="alert" className="mt-2 text-[13px] text-red-400">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button className="zev-btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button disabled={busy} onClick={() => void save()} className="flex-1 rounded-[14px] bg-violet-600 p-[11px] text-sm font-bold disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ MobileConfig templates ------------------------------ */

interface TemplateRow {
  preset: string;
  label: string;
  enabled: boolean;
  stats: { created: number; downloaded: number };
}

function Templates({ role }: { role: string }) {
  const [schema, setSchema] = useState("…");
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [activity, setActivity] = useState<LogRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [t, l] = await Promise.all([
        adminReq<{ schemaVersion: string; presets: TemplateRow[] }>("/api/admin/mobileconfig/templates"),
        adminReq<{ items: LogRow[] }>("/api/admin/logs?limit=50"),
      ]);
      setSchema(t.schemaVersion);
      setRows(t.presets);
      setActivity(l.items.filter((x) => x.type.startsWith("profile.") || x.type.startsWith("admin.preset")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(preset: string, enabled: boolean) {
    try {
      const res = await adminReq<{ presets: { preset: string; enabled: boolean }[] }>(
        "/api/admin/mobileconfig/templates",
        { method: "POST", body: JSON.stringify({ preset, enabled }) }
      );
      setRows((prev) => prev.map((r) => {
        const next = res.presets.find((x) => x.preset === r.preset);
        return next ? { ...r, enabled: next.enabled } : r;
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (loading) return (<><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></>);

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <Label>MOBILECONFIG TEMPLATES</Label>
          <span className="font-mono text-[11px] text-slate-500">schema v{schema}</span>
        </div>
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.preset} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-black">{r.label}</p>
                <p className="tnum mt-0.5 font-mono text-[11px] text-slate-500">
                  {r.stats.created} generated · {r.stats.downloaded} downloaded
                </p>
              </div>
              {canDestroy(role) ? (
                <button
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`${r.label} preset ${r.enabled ? "enabled" : "disabled"}`}
                  onClick={() => void toggle(r.preset, !r.enabled)}
                  className={cn(
                    "relative h-8 w-[52px] shrink-0 rounded-full border transition-colors",
                    r.enabled ? "border-purple-300/60 bg-gradient-to-r from-violet-600 to-purple-400" : "border-slate-600/60 bg-slate-800"
                  )}
                >
                  <span className={cn(
                    "absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white shadow",
                    r.enabled ? "right-[3px]" : "left-[3px]"
                  )} />
                </button>
              ) : (
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", r.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-slate-500")}>
                  {r.enabled ? "ON" : "OFF"}
                </span>
              )}
            </div>
          ))}
        </div>
        {!canDestroy(role) && (
          <p className="mt-2 text-[11px] text-slate-500">Your role can inspect templates but cannot modify them.</p>
        )}
      </Card>
      <Card>
        <Label>GENERATION ACTIVITY</Label>
        <div className="mt-2 space-y-2">
          {activity.slice(0, 12).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate font-mono text-slate-300">{l.type}</span>
              <span className="shrink-0 font-mono text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString("en-GB", { hour12: false })}</span>
            </div>
          ))}
          {activity.length === 0 && <p className="text-[13px] text-slate-500">No profile activity yet.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Devices / Logs ------------------------------ */

function Devices() {
  const [items, setItems] = useState<DeviceRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    adminReq<{ items: DeviceRow[] }>("/api/admin/devices?limit=50")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-2">
      {items.map((d) => (
        <Card key={d.id}>
          <p className="flex items-center gap-2 text-sm font-bold"><Smartphone size={15} className="text-purple-300" />{d.platform}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{d.device_identifier}</p>
          <p className="mt-1 text-[11px] text-slate-500">last seen {new Date(d.last_seen_at).toLocaleString("en-GB", { hour12: false })}</p>
        </Card>
      ))}
      {items.length === 0 && <Card><p className="text-center text-sm text-slate-400">No devices bound yet.</p></Card>}
    </div>
  );
}

function Logs() {
  const [items, setItems] = useState<LogRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    adminReq<{ items: LogRow[] }>("/api/admin/logs?limit=50")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  if (error) return <ErrorState message={error} />;
  return (
    <Card>
      <Label>AUDIT LOG</Label>
      <div className="mt-2 space-y-2.5">
        {items.map((l) => (
          <div key={l.id} className="border-b border-white/5 pb-2 text-[12px] last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono font-bold text-violet-200">{l.type}</span>
              <span className="shrink-0 font-mono text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString("en-GB", { hour12: false })}</span>
            </div>
            {l.metadata && <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{l.metadata}</p>}
          </div>
        ))}
        {items.length === 0 && <p className="text-[13px] text-slate-500">No log entries yet.</p>}
      </div>
    </Card>
  );
}
