import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, LogIn, QrCode, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface AuthState {
  configured: boolean;
  stored: boolean;
  encryptionConfigured: boolean;
  needsLogin: boolean;
  lastRefreshAttemptAt: string | null;
  lastRefreshSuccessAt: string | null;
  lastLoginAt: string | null;
  lastErrorCode: string | null;
  lastError: string | null;
}

interface SyncState {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastSyncedCount: number;
  lastError: string | null;
}

interface AdminStatus { auth: AuthState; weekly: SyncState; total: SyncState }
type QrState = "waiting" | "scanned" | "expired" | "success";
interface QrSession { key: string; image: string; state: QrState; message: string }

const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-sm transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50";

export default function NeteaseAdmin() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [qr, setQr] = useState<QrSession | null>(null);
  const [busy, setBusy] = useState<"load" | "sync" | "qr" | null>("load");
  const [message, setMessage] = useState("");

  useEffect(() => { void loadStatus(); }, []);
  useEffect(() => {
    if (!qr || !["waiting", "scanned"].includes(qr.state)) return;
    const timer = window.setTimeout(() => void checkQr(qr.key), 2_000);
    return () => window.clearTimeout(timer);
  }, [qr?.key, qr?.state]);

  async function loadStatus() {
    setBusy("load");
    try {
      setStatus(await fetchJson<AdminStatus>("/api/admin/netease/status", { cache: "no-store" }));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function sync(afterLogin = false) {
    setBusy("sync");
    setMessage(afterLogin ? "登录成功，正在刷新排行。" : "");
    try {
      const response = await fetchJson<{ status: AdminStatus }>("/api/admin/netease/sync", { method: "POST" });
      setStatus(response.status);
      const failed = [response.status.auth, response.status.weekly, response.status.total]
        .filter((item) => item.lastError).length;
      setMessage(failed === 0 ? "排行刷新完成。" : `刷新完成，其中 ${failed} 项失败，请查看最近错误。`);
    } catch (error) {
      setMessage(errorMessage(error));
      await refreshStatusSilently();
    } finally {
      setBusy(null);
    }
  }

  async function startQrLogin() {
    setBusy("qr");
    setMessage("");
    try {
      const response = await fetchJson<{ key: string; loginUrl: string }>("/api/admin/netease/qr", { method: "POST" });
      const image = await QRCode.toDataURL(response.loginUrl, { errorCorrectionLevel: "M", margin: 2, width: 240 });
      setQr({ key: response.key, image, state: "waiting", message: "等待扫码" });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function checkQr(key: string) {
    try {
      const result = await fetchJson<{ state: QrState; message: string }>("/api/admin/netease/qr/check", jsonInit({ key }));
      setQr((current) => current?.key === key ? { ...current, state: result.state, message: result.message } : current);
      if (result.state === "success") await sync(true);
    } catch (error) {
      setMessage(errorMessage(error));
      setQr((current) => current?.key === key ? { ...current, state: "expired", message: "二维码检查失败" } : current);
      await refreshStatusSilently();
    }
  }

  async function refreshStatusSilently() {
    try {
      setStatus(await fetchJson<AdminStatus>("/api/admin/netease/status", { cache: "no-store" }));
    } catch {}
  }

  if (busy === "load" && !status) {
    return <p className="flex min-h-40 items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle className="animate-spin" size={16} />加载状态</p>;
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border-b border-[var(--border-soft)] pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">听歌排行管理</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">每日自动续期登录并同步周排行与总排行。</p>
          </div>
          <button className={button} type="button" onClick={() => void sync()} disabled={busy !== null || !status?.auth.configured}>
            {busy === "sync" ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            立即刷新排行
          </button>
        </div>
        {message && <p role="status" className="text-sm text-[var(--text-muted)]">{message}</p>}
      </section>

      {status && <>
        <section className="grid gap-4 border-b border-[var(--border-soft)] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">登录状态</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                {status.auth.needsLogin ? <AlertCircle size={16} className="text-[var(--destructive)]" /> : <CheckCircle2 size={16} />}
                {authLabel(status.auth)}
              </p>
            </div>
            <button
              className={`${button} ${status.auth.needsLogin ? "border-[var(--destructive)] text-[var(--destructive)]" : ""}`}
              type="button"
              onClick={() => void startQrLogin()}
              disabled={busy !== null || !status.auth.encryptionConfigured}
            >
              {busy === "qr" ? <LoaderCircle className="animate-spin" size={16} /> : status.auth.needsLogin ? <LogIn size={16} /> : <QrCode size={16} />}
              {status.auth.needsLogin ? "重新登录" : "更换登录"}
            </button>
          </div>

          <dl className="grid gap-px overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-3">
            <StatusDatum label="Token 最近刷新成功" value={formatDate(status.auth.lastRefreshSuccessAt)} />
            <StatusDatum label="最近刷新尝试" value={formatDate(status.auth.lastRefreshAttemptAt)} />
            <StatusDatum label="最近扫码登录" value={formatDate(status.auth.lastLoginAt)} />
          </dl>

          {!status.auth.encryptionConfigured && <ErrorLine text="未配置 NETEASE_COOKIE_KEY，无法安全保存刷新后的登录凭据。" />}
          {status.auth.lastError && <ErrorLine text={`${status.auth.lastErrorCode ? `${status.auth.lastErrorCode}：` : ""}${status.auth.lastError}`} />}

          {qr && <div className="grid gap-4 border-t border-[var(--border-soft)] pt-5 sm:grid-cols-[15rem_1fr] sm:items-center">
            <img className="aspect-square w-60 max-w-full rounded-[var(--radius-control)] border border-[var(--border-soft)]" src={qr.image} alt="网易云登录二维码" />
            <div className="grid gap-2">
              <h3 className="font-semibold">网易云扫码登录</h3>
              <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                {qr.state === "success" ? <CheckCircle2 size={16} /> : qr.state === "expired" ? <AlertCircle size={16} /> : <Clock3 size={16} />}
                {qr.message}
              </p>
              {qr.state === "expired" && <button className={`${button} w-fit`} type="button" onClick={() => void startQrLogin()} disabled={busy !== null}><RefreshCw size={16} />生成新二维码</button>}
            </div>
          </div>}
        </section>

        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">排行刷新状态</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <RankingStatus title="一周排行" state={status.weekly} />
            <RankingStatus title="总排行" state={status.total} />
          </div>
        </section>
      </>}
    </div>
  );
}

function RankingStatus({ title, state }: { title: string; state: SyncState }) {
  return <article className="grid gap-3 rounded-[var(--radius-control)] border border-[var(--border-soft)] p-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><span className="text-sm text-[var(--text-muted)]">{state.lastSyncedCount} 首</span></div>
    <dl className="grid gap-2 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-[var(--text-muted)]">最近刷新成功</dt><dd>{formatDate(state.lastSuccessAt)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-[var(--text-muted)]">最近尝试</dt><dd>{formatDate(state.lastAttemptAt)}</dd></div>
    </dl>
    {state.lastError ? <ErrorLine text={`最近错误：${state.lastError}`} /> : <p className="text-sm text-[var(--text-muted)]">最近错误：无</p>}
  </article>;
}

function StatusDatum({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 bg-[var(--canvas)] p-3"><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className="text-sm">{value}</dd></div>;
}

function ErrorLine({ text }: { text: string }) {
  return <p role="alert" className="flex items-start gap-2 text-sm text-[var(--destructive)]"><AlertCircle className="mt-0.5 shrink-0" size={16} /><span className="break-words">{text}</span></p>;
}

function authLabel(auth: AuthState) {
  if (!auth.encryptionConfigured) return "缺少 Cookie 加密密钥";
  if (auth.needsLogin) return "登录已失效，需要重新扫码";
  if (auth.stored) return "已保存可自动续期的登录凭据";
  if (auth.configured) return "正在使用旧 Secret，首次刷新后将转为加密存储";
  return "尚未登录";
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(value)) : "尚无";
}

function jsonInit(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? "请求失败。");
  return data as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。";
}
