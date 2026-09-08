"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Ban, Copy, Eye, KeyRound, Plus, RefreshCcw, Smartphone, Trash2, Play, Search,
} from "lucide-react";
import { adminReq } from "@/lib/api";
import { Card, ConfirmDialog, ErrorState, Label, Skeleton } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { License } from "@/lib/types";

type AdminTab = "overview" | "licenses" | "devices" | "logs";

interface Stats { licenses_total: number; licenses_active: number; devices_total: number; sessions_24h: number }
interface LogRow { id: number; type: string; license_id: string | null; metadata: string | null; created_at: string }
interface DeviceRow { id: string; license_id: string; device_identifier: string; platform: string; last_seen_at: string }

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  UNUSED: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
  EXPIRED: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  SUSPENDED: "text-orange-300 border-orange-500/30 bg-orange-500/10",
  REVOKED: "text-red-300 border-red-500/30 bg-red-500/10",
};

export function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<AdminTab>("licenses");

  useEffect(() => {
    if (localStorage.getItem("zev_admin_token")) setAuthed(true);
  }, []);

  async function login() {
    setAuthError("");
    localStorage.setItem("zev_admin_token", tokenInput);
    try {
      await adminReq("/api/admin/stats");
      setAuthed(true);
    } catch {
      localStorage.removeItem("zev_admin_token");
      setAuthError("Invalid admin token.");
    }
  }

  if (!authed) {
    return (
      <div className="zev-top-pad mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10">
        <h1 className="mt-14 text-center text-2xl font-black tracking-[0.2em]">ZEV ADMIN</h1>
        <Card className="mt-6">
          <Label>ADMIN TOKEN</Label>
          <input
            type="password"
            className="zev-input mt-2 font-mono normal-case tracking-normal"
            placeholder="Enter admin token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void login(); }}
          />
          {authError && <p className="mt-2 text-[13px] text-red-400">{authError}</p>}
          <button className="zev-btn-primary mt-4" onClick={() => void login()}>Sign in</button>
          <p className="mt-3 text-center text-[11px] text-slate-500">Token lives only in this browser. Set it via <span className="font-mono">ADMIN_API_TOKEN</span>.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="zev-top-pad mx-auto min-h-dvh w-full max-w-[860px] px-4 pb-10">
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-black tracking-[0.18em]">ZEV ADMIN</h1>
        <button
          className="zev-btn-ghost text-xs"
          onClick={() => { localStorage.removeItem("zev_admin_token"); setAuthed(false); }}
        >
          Sign out
        </button>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {(["overview", "licenses", "devices", "logs"] as AdminTab[]).map((t) => (
          <button
            key={t}
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
        {tab === "licenses" && <Licenses />}
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
    ["Total licenses", stats.licenses_total],
    ["Active", stats.licenses_active],
    ["Bound devices", stats.devices_total],
    ["Sessions (24h)", stats.sessions_24h],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(([label, v]) => (
          <Card key={label}>
            <Label>{label.toUpperCase()}</Label>
            <p className="mt-1 text-2xl font-black">{v}</p>
          </Card>
        ))}
      </div>
      <Card>
        <Label>LATEST EVENTS</Label>
        <div className="mt-2 space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-[13px]">
              <span className="font-mono text-slate-300">{l.type}</span>
              <span className="font-mono text-[11px] text-slate-500">{new Date(l.created_at).toLocaleString("en-GB", { hour12: false })}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-[13px] text-slate-500">No events yet.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Licenses ------------------------------ */

function Licenses() {
  const [items, setItems] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<License | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; label: string; danger?: boolean; run: () => Promise<void> }>(null);
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
      setError(e instanceof Error ? e.message : "Failed to load licenses");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusF]);

  useEffect(() => { void load(1); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(path: string, init?: RequestInit) {
    setNotice("");
    const res = await adminReq<{ license?: License }>(path, init);
    setNotice("Done.");
    if (selected && res.license) setSelected(res.license);
    await load();
  }

  function askDestructive(title: string, body: string, label: string, run: () => Promise<void>) {
    setConfirm({ title, body, label, danger: true, run: async () => { await run(); setConfirm(null); } });
  }

  return (
    <div className="space-y-3">
      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center text-[13px] text-emerald-200">{notice}</p>}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="zev-input pl-10 !tracking-normal"
            placeholder="Search key…"
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") void load(1); }}
          />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="zev-input w-[128px] !tracking-normal">
          <option value="">All</option>
          {["UNUSED", "ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button className="zev-btn-ghost flex-1" onClick={() => void load(1)}>Apply filters</button>
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-violet-600 p-[11px] text-sm font-bold" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New license
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading && (<><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></>)}

      {!loading && items.map((l) => (
        <Card key={l.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="break-all font-mono text-[13px] font-bold">{l.key}</p>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black", STATUS_COLORS[l.status])}>{l.status}</span>
          </div>
          <p className="text-xs text-slate-400">{l.plan} · limit {l.device_limit} · exp {fmtDate(l.expires_at)} · {fmtDate(l.created_at)}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs" title="Copy" onClick={() => { void navigator.clipboard.writeText(l.key); setNotice("License key copied."); }}><Copy size={14} /></button>
            <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs" title="View" onClick={() => setSelected(l)}><Eye size={14} /></button>
            <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs" title="Extend +30d" onClick={() => void act(`/api/admin/licenses/${l.id}/extend`, { method: "POST", body: JSON.stringify({ extra_days: 30 }) })}>+30d</button>
            <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs" title="Reset device" onClick={() => void act(`/api/admin/licenses/${l.id}/reset-device`, { method: "POST" })}><Smartphone size={14} /></button>
            {l.status !== "SUSPENDED" && l.status !== "REVOKED" && (
              <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs" title="Suspend" onClick={() => askDestructive("Suspend license?", `${l.key} will stop working immediately.`, "Suspend", () => act(`/api/admin/licenses/${l.id}/suspend`, { method: "POST" }))}><Ban size={14} /></button>
            )}
            {(l.status === "UNUSED" || l.status === "SUSPENDED" || l.status === "EXPIRED") && (
              <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs" title="Activate" onClick={() => void act(`/api/admin/licenses/${l.id}/activate`, { method: "POST", body: JSON.stringify({}) })}><Play size={14} /></button>
            )}
            {l.status !== "REVOKED" && (
              <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs !text-red-300" title="Revoke" onClick={() => askDestructive("Revoke license?", `${l.key} will be permanently revoked.`, "Revoke", () => act(`/api/admin/licenses/${l.id}/revoke`, { method: "POST" }))}><RefreshCcw size={14} /></button>
            )}
            <button className="zev-btn-ghost !px-2.5 !py-1.5 text-xs !text-red-300" title="Delete" onClick={() => askDestructive("Delete license?", `${l.key} and its devices/sessions will be removed.`, "Delete", () => act(`/api/admin/licenses/${l.id}`, { method: "DELETE" }))}><Trash2 size={14} /></button>
          </div>
        </Card>
      ))}
      {!loading && items.length === 0 && !error && <Card><p className="text-center text-sm text-slate-400">No licenses match.</p></Card>}

      {/* Pagination */}
      <div className="flex items-center justify-between text-[13px] text-slate-400">
        <button className="zev-btn-ghost" disabled={page <= 1} onClick={() => void load(page - 1)}>Prev</button>
        <span>Page {page} · {total} total</span>
        <button className="zev-btn-ghost" disabled={page * 10 >= total} onClick={() => void load(page + 1)}>Next</button>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(1); }} />}
      {selected && (
        <DetailModal
          license={selected}
          onClose={() => setSelected(null)}
          onChanged={(l) => { setSelected(l); void load(); }}
        />
      )}
      {confirm && (
        <ConfirmDialog title={confirm.title} body={confirm.body} confirmLabel={confirm.label} danger={confirm.danger} onConfirm={confirm.run} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [plan, setPlan] = useState("Premium");
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(1);
  const [result, setResult] = useState<License | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    try {
      setBusy(true);
      setError("");
      const res = await adminReq<{ license: License }>("/api/admin/licenses", {
        method: "POST",
        body: JSON.stringify({ plan, duration_days: days, device_limit: limit }),
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
      <div className="zev-card w-full max-w-[440px] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-black">CREATE LICENSE</h3>
        <div className="mt-4 space-y-3">
          <div>
            <Label>PLAN</Label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="zev-input mt-1.5 !tracking-normal">
              <option>Premium</option>
              <option>VIP Plus</option>
              <option>Trial</option>
            </select>
          </div>
          <div>
            <Label>DURATION</Label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="zev-input mt-1.5 !tracking-normal">
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
              <option value={365}>365 Days</option>
            </select>
          </div>
          <div>
            <Label>DEVICE LIMIT</Label>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="zev-input mt-1.5 !tracking-normal">
              {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-2 text-[13px] text-red-400">{error}</p>}
        {result && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="break-all font-mono text-sm font-bold text-emerald-200">{result.key}</p>
            <p className="mt-1 text-xs text-emerald-100/70">{result.plan} · exp {fmtDate(result.expires_at)} · limit {result.device_limit}</p>
            <button className="zev-btn-ghost mt-2 w-full text-xs" onClick={() => { void navigator.clipboard.writeText(result.key); }}>Copy key</button>
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button className="zev-btn-ghost flex-1" onClick={onClose}>{result ? "Done" : "Cancel"}</button>
          {!result && (
            <button disabled={busy} onClick={() => void generate()} className="flex-1 rounded-[14px] bg-violet-600 p-[11px] text-sm font-bold disabled:opacity-50">
              {busy ? "Generating…" : "Generate license"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailModal({ license, onClose, onChanged }: { license: License; onClose: () => void; onChanged: (l: License) => void }) {
  const [plan, setPlan] = useState(license.plan);
  const [limit, setLimit] = useState(license.device_limit);
  const [extraDays, setExtraDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<{ bound_devices: number } | null>(null);

  useEffect(() => {
    adminReq<{ license: License; bound_devices: number }>(`/api/admin/licenses/${license.id}`)
      .then((r) => setDetail({ bound_devices: r.bound_devices }))
      .catch(() => {});
  }, [license.id]);

  async function patch(body: unknown) {
    setBusy(true);
    try {
      const res = await adminReq<{ license: License }>(`/api/admin/licenses/${license.id}/activate`, { method: "PATCH", body: JSON.stringify(body) });
      if (res.license) onChanged(res.license);
    } finally {
      setBusy(false);
    }
  }

  async function extend() {
    setBusy(true);
    try {
      const res = await adminReq<{ license: License }>(`/api/admin/licenses/${license.id}/extend`, { method: "POST", body: JSON.stringify({ extra_days: extraDays }) });
      if (res.license) onChanged(res.license);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="zev-card max-h-[85dvh] w-full max-w-[440px] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black"><KeyRound size={17} /> License</h3>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", STATUS_COLORS[license.status])}>{license.status}</span>
        </div>
        <p className="mt-2 break-all font-mono text-sm font-bold">{license.key}</p>
        <div className="mt-3 space-y-1.5 text-[13px] text-slate-300">
          <p>Plan: <b>{license.plan}</b></p>
          <p>Expiry: <b>{fmtDate(license.expires_at)}</b></p>
          <p>Devices: <b>{detail ? `${detail.bound_devices}/${license.device_limit}` : `…/${license.device_limit}`}</b></p>
          <p>Created: <b>{fmtDate(license.created_at)}</b></p>
        </div>

        <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
          <div className="flex gap-2">
            <input value={plan} onChange={(e) => setPlan(e.target.value)} className="zev-input !tracking-normal" placeholder="Plan" />
            <button disabled={busy} className="zev-btn-ghost shrink-0" onClick={() => void patch({ plan })}>Save</button>
          </div>
          <div className="flex gap-2">
            <input type="number" min={1} max={10} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="zev-input !tracking-normal" />
            <button disabled={busy} className="zev-btn-ghost shrink-0" onClick={() => void patch({ device_limit: limit })}>Limit</button>
          </div>
          <div className="flex gap-2">
            <input type="number" min={1} max={3650} value={extraDays} onChange={(e) => setExtraDays(Number(e.target.value))} className="zev-input !tracking-normal" />
            <button disabled={busy} className="zev-btn-ghost shrink-0" onClick={() => void extend()}>Extend</button>
          </div>
        </div>

        <button className="zev-btn-ghost mt-4 w-full" onClick={onClose}>Close</button>
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-500"><BadgeCheck size={12} /> Changes are audited in logs</p>
      </div>
    </div>
  );
}

/* ------------------------------ Devices ------------------------------ */

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
          <p className="flex items-center gap-2 text-sm font-bold"><Smartphone size={15} className="text-cyan-300" />{d.platform}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{d.device_identifier}</p>
          <p className="mt-1 text-[11px] text-slate-500">last seen {new Date(d.last_seen_at).toLocaleString("en-GB", { hour12: false })}</p>
        </Card>
      ))}
      {items.length === 0 && <Card><p className="text-center text-sm text-slate-400">No devices bound yet.</p></Card>}
    </div>
  );
}

/* ------------------------------ Logs ------------------------------ */

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
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-violet-200">{l.type}</span>
              <span className="font-mono text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString("en-GB", { hour12: false })}</span>
            </div>
            {l.metadata && <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{l.metadata}</p>}
          </div>
        ))}
        {items.length === 0 && <p className="text-[13px] text-slate-500">No log entries yet.</p>}
      </div>
    </Card>
  );
}
