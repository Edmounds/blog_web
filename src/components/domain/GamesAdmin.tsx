import { Eye, EyeOff, ImagePlus, LoaderCircle, RefreshCw, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type GameSource = "steam" | "manual";
interface GameItem {
  id: string; source: GameSource; steamAppId: number | null; title: string; steamPlaytimeMinutes: number;
  customPlaytimeMinutes: number | null; playtimeMinutes: number; isVisible: boolean; coverKey: string | null;
  cover: string; defaultCover: string; lastSeenAt: string | null;
}
interface SyncState { lastAttemptAt: string | null; lastSuccessAt: string | null; lastSyncedCount: number; lastError: string | null }

const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-sm transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50";
const input = "min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 text-sm";

export default function GamesAdmin() {
  const [items, setItems] = useState<GameItem[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({ lastAttemptAt: null, lastSuccessAt: null, lastSyncedCount: 0, lastError: null });
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | GameSource>("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [busy, setBusy] = useState<string | null>("list");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("0");
  const [cover, setCover] = useState<{ key: string; url: string } | null>(null);
  const coverRef = useRef<{ key: string; url: string } | null>(null);

  useEffect(() => { void loadItems(); }, []);
  useEffect(() => { coverRef.current = cover; }, [cover]);
  useEffect(() => () => { if (coverRef.current) void deleteTemporaryCover(coverRef.current.key); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    if (query && !item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    if (source !== "all" && item.source !== source) return false;
    return visibility === "all" || item.isVisible === (visibility === "visible");
  }), [items, query, source, visibility]);

  async function loadItems() {
    setBusy("list");
    try {
      const data = await fetchJson<{ items: GameItem[]; syncState: SyncState }>("/api/admin/games");
      setItems(data.items); setSyncState(data.syncState);
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(null); }
  }

  async function sync() {
    setBusy("sync"); setMessage("");
    try {
      const result = await fetchJson<{ added: number; updated: number; unchanged: number; total: number }>("/api/admin/games/sync", { method: "POST" });
      setMessage(`同步完成：新增 ${result.added}，更新 ${result.updated}，未变化 ${result.unchanged}，共 ${result.total}。`);
      await loadItems();
    } catch (error) { setMessage(errorMessage(error)); setBusy(null); }
  }

  async function uploadCover(file: File) {
    setBusy("upload"); setMessage("");
    try {
      if (cover) await deleteTemporaryCover(cover.key);
      const form = new FormData(); form.set("file", file);
      const data = await fetchJson<{ cover: { key: string; url: string } }>("/api/admin/games/covers", { method: "POST", body: form });
      setCover(data.cover);
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(null); }
  }

  const addManual = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!cover) { setMessage("请先上传竖版封面。"); return; }
    setBusy("create"); setMessage("");
    try {
      const data = await fetchJson<{ item: GameItem }>("/api/admin/games", jsonInit("POST", { title, customPlaytimeHours: hours, coverKey: cover.key, isVisible: true }));
      setItems((current) => [...current, data.item].sort(sortGames));
      setTitle(""); setHours("0"); setCover(null); coverRef.current = null;
      setMessage("手动游戏已添加。");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(null); }
  };

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id); setMessage("");
    try {
      const data = await fetchJson<{ item: GameItem }>(`/api/admin/games/${id}`, jsonInit("PATCH", body));
      setItems((current) => current.map((item) => item.id === id ? data.item : item).sort(sortGames));
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(null); }
  }

  async function replaceCover(item: GameItem, file: File) {
    setBusy(item.id); setMessage("");
    let uploaded: { key: string; url: string } | null = null;
    try {
      const form = new FormData(); form.set("file", file);
      uploaded = (await fetchJson<{ cover: { key: string; url: string } }>("/api/admin/games/covers", { method: "POST", body: form })).cover;
      const data = await fetchJson<{ item: GameItem }>(`/api/admin/games/${item.id}`, jsonInit("PATCH", { coverKey: uploaded.key }));
      setItems((current) => current.map((entry) => entry.id === item.id ? data.item : entry));
    } catch (error) {
      if (uploaded) await deleteTemporaryCover(uploaded.key);
      setMessage(errorMessage(error));
    } finally { setBusy(null); }
  }

  async function remove(item: GameItem) {
    if (!confirm(`永久删除“${item.title}”？`)) return;
    setBusy(item.id); setMessage("");
    try {
      await fetchJson(`/api/admin/games/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(null); }
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border-b border-[var(--border-soft)] pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold">游戏管理</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Steam 库每天自动同步，也可在此立即同步。</p></div>
          <button className={button} type="button" onClick={() => void sync()} disabled={busy !== null}><RefreshCw size={16} />立即同步</button>
        </div>
        <div className="grid gap-1 text-sm text-[var(--text-muted)]">
          <span>最近成功：{formatDate(syncState.lastSuccessAt)}，最近数量：{syncState.lastSyncedCount}</span>
          {syncState.lastError && <span className="text-[var(--destructive)]">最近错误：{syncState.lastError}</span>}
        </div>
      </section>

      <section className="grid gap-4 border-b border-[var(--border-soft)] pb-8">
        <h2 className="text-lg font-semibold">新增手动游戏</h2>
        <form className="grid gap-4 md:grid-cols-[1fr_10rem_auto]" onSubmit={(event) => void addManual(event)}>
          <label className="grid gap-1 text-sm"><span>标题</span><input className={input} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm"><span>时长（小时）</span><input className={input} value={hours} onChange={(event) => setHours(event.target.value)} inputMode="decimal" required /></label>
          <label className={`${button} mt-auto cursor-pointer`}><Upload size={16} />{busy === "upload" ? "上传中" : cover ? "更换封面" : "上传封面"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = ""; }} /></label>
          {cover && <img className="h-32 w-24 rounded-[var(--radius-control)] object-cover" src={cover.url} alt="待添加游戏封面" />}
          <button className={`${button} md:col-start-3`} type="submit" disabled={busy !== null || !cover}><ImagePlus size={16} />添加游戏</button>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[1fr_10rem_10rem]">
          <label className="relative"><Search className="absolute left-3 top-3" size={16} /><input className={`${input} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题" /></label>
          <select className={input} value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="all">全部来源</option><option value="steam">Steam</option><option value="manual">手动</option></select>
          <select className={input} value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="all">全部状态</option><option value="visible">公开</option><option value="hidden">隐藏</option></select>
        </div>
        {busy === "list" ? <p className="flex min-h-40 items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle className="animate-spin" size={16} />加载中</p> : filtered.length === 0 ? <p className="flex min-h-40 items-center text-sm text-[var(--text-muted)]">没有符合条件的游戏。</p> : <div className="grid gap-3">{filtered.map((item) => <GameRow key={item.id} item={item} busy={busy === item.id} patch={patch} replaceCover={replaceCover} remove={remove} />)}</div>}
      </section>
      {message && <p role="status" className="text-sm text-[var(--text-muted)]">{message}</p>}
    </div>
  );
}

function GameRow({ item, busy, patch, replaceCover, remove }: { item: GameItem; busy: boolean; patch: (id: string, body: Record<string, unknown>) => Promise<void>; replaceCover: (item: GameItem, file: File) => Promise<void>; remove: (item: GameItem) => Promise<void> }) {
  const [title, setTitle] = useState(item.title);
  const [hours, setHours] = useState(item.customPlaytimeMinutes == null ? "" : formatHours(item.customPlaytimeMinutes));
  useEffect(() => { setTitle(item.title); setHours(item.customPlaytimeMinutes == null ? "" : formatHours(item.customPlaytimeMinutes)); }, [item]);
  return (
    <article className="grid gap-4 rounded-[var(--radius-control)] border border-[var(--border-soft)] p-4 sm:grid-cols-[5rem_1fr] lg:grid-cols-[5rem_1fr_auto]">
      <img className="aspect-[2/3] w-20 rounded-[var(--radius-control)] object-cover" src={item.cover} alt={item.title} onError={(event) => { event.currentTarget.src = "/images/placeholders/default-cover.webp"; }} />
      <div className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-center gap-2"><strong className="break-words">{item.title}</strong><span className="text-xs text-[var(--text-faint)]">{item.source === "steam" ? `Steam ${item.steamAppId}` : "手动"}</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {item.source === "manual" && <label className="grid gap-1 text-xs"><span>标题</span><input className={input} value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title !== item.title) void patch(item.id, { title }); }} /></label>}
          <label className="grid gap-1 text-xs"><span>{item.source === "steam" ? `覆盖时长（Steam ${formatHours(item.steamPlaytimeMinutes)} 小时）` : "时长（小时）"}</span><input className={input} value={hours} onChange={(event) => setHours(event.target.value)} placeholder={item.source === "steam" ? "使用 Steam 时长" : undefined} onBlur={() => { const value = hours.trim(); const original = item.customPlaytimeMinutes == null ? "" : formatHours(item.customPlaytimeMinutes); if (value !== original) void patch(item.id, { customPlaytimeHours: value }); }} /></label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-start-2 lg:col-start-3 lg:row-start-1 lg:flex-col lg:items-stretch">
        <button className={button} type="button" disabled={busy} onClick={() => void patch(item.id, { isVisible: !item.isVisible })}>{item.isVisible ? <EyeOff size={16} /> : <Eye size={16} />}{item.isVisible ? "隐藏" : "公开"}</button>
        <label className={`${button} cursor-pointer`}><Upload size={16} />替换封面<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceCover(item, file); event.currentTarget.value = ""; }} /></label>
        {item.source === "steam" && item.coverKey && <button className={button} type="button" disabled={busy} onClick={() => void patch(item.id, { coverKey: null })}><RotateCcw size={16} />恢复封面</button>}
        {item.source === "manual" && <button className={`${button} text-[var(--destructive)]`} type="button" disabled={busy} onClick={() => void remove(item)}><Trash2 size={16} />删除</button>}
      </div>
    </article>
  );
}

const sortGames = (a: GameItem, b: GameItem) => b.playtimeMinutes - a.playtimeMinutes || a.title.localeCompare(b.title);
const formatHours = (minutes: number) => String(Math.round((minutes / 60) * 10) / 10);
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(value)) : "尚无";
const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const data: any = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error?.message ?? "请求失败。"); return data as T; }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "请求失败。";
async function deleteTemporaryCover(key: string) { await fetch("/api/admin/games/covers", jsonInit("DELETE", { key })).catch(() => undefined); }
