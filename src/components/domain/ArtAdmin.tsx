import {
  BookOpen, CalendarDays, Eye, EyeOff, Film, ImagePlus, Languages, LoaderCircle, Music2, Search,
  Trash2, Tv2, Upload, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ArtType = "book" | "music" | "movie" | "series" | "anime";
type Locale = "zh-CN" | "zh-TW" | "en" | "ja";

interface Translation { title: string; creator: string; extra: string }
interface Candidate {
  source: string;
  sourceId: string;
  title: string;
  creator: string;
  originalTitle?: string;
  releaseDate?: string;
  isbn?: string;
  description?: string;
  coverUrl: string;
}
interface ArtItem {
  id: string;
  type: ArtType;
  source: string;
  sourceId: string;
  isbn: string;
  originalTitle: string;
  releaseDate: string;
  coverUrl: string;
  collectedOn: string;
  isVisible: boolean;
  translations: Partial<Record<Locale, Translation>>;
}
interface FormState {
  id?: string;
  type: ArtType;
  source: string;
  sourceId: string;
  isbn: string;
  originalTitle: string;
  releaseDate: string;
  collectedOn: string;
  isVisible: boolean;
  coverUrl: string;
  cover: { kind: "url"; url: string } | { kind: "upload"; data: string; mime: string } | null;
  translations: Record<Locale, Translation>;
}

const TYPES = [
  { id: "book", label: "书籍", Icon: BookOpen },
  { id: "music", label: "专辑", Icon: Music2 },
  { id: "movie", label: "电影", Icon: Film },
  { id: "series", label: "剧集", Icon: Tv2 },
  { id: "anime", label: "番剧", Icon: Tv2 },
] satisfies { id: ArtType; label: string; Icon: typeof BookOpen }[];
const LOCALES: { id: Locale; label: string }[] = [
  { id: "zh-CN", label: "简中" }, { id: "zh-TW", label: "繁中" }, { id: "en", label: "English" }, { id: "ja", label: "日本語" },
];
const emptyTranslation = (): Translation => ({ title: "", creator: "", extra: "" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());

export default function ArtAdmin() {
  const [type, setType] = useState<ArtType>("book");
  const [query, setQuery] = useState("");
  const [creator, setCreator] = useState("");
  const [isbn, setIsbn] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [items, setItems] = useState<ArtItem[]>([]);
  const [form, setForm] = useState<FormState>(() => blankForm("book"));
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [busy, setBusy] = useState<"search" | "save" | "translate" | "list" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { void loadItems(type); }, [type]);

  async function loadItems(selectedType: ArtType) {
    setBusy("list");
    try {
      const data = await fetchJson<{ items: ArtItem[] }>(`/api/admin/art/items?type=${selectedType}`);
      setItems(data.items);
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(null); }
  }

  function changeType(next: ArtType) {
    setType(next); setQuery(""); setCreator(""); setIsbn(""); setCandidates([]); setForm(blankForm(next)); setLocale("zh-CN"); setMessage("");
  }

  async function search(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy("search"); setMessage("");
    const params = new URLSearchParams({ type, q: query.trim() });
    if (creator.trim()) params.set("creator", creator.trim());
    if (isbn.trim()) params.set("isbn", isbn.trim());
    try {
      const data = await fetchJson<{ items: Candidate[] }>(`/api/admin/art/search?${params}`);
      setCandidates(data.items); if (!data.items.length) setMessage("没有找到候选结果。");
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(null); }
  }

  async function selectCandidate(candidate: Candidate) {
    const next = blankForm(type);
    next.source = candidate.source; next.sourceId = candidate.sourceId; next.isbn = candidate.isbn ?? isbn;
    next.originalTitle = candidate.originalTitle ?? candidate.title; next.releaseDate = candidate.releaseDate ?? "";
    next.coverUrl = candidate.coverUrl; next.cover = { kind: "url", url: candidate.coverUrl };
    next.translations["zh-CN"] = { title: candidate.title, creator: candidate.creator || "待填写", extra: candidate.description?.slice(0, 120) ?? "" };
    setForm(next); setLocale("zh-CN"); setMessage("");
    await translate(next.translations["zh-CN"]);
  }

  async function translate(source = form.translations["zh-CN"]) {
    if (!source.title.trim() || !source.creator.trim()) return setMessage("请先填写简中标题和作者。");
    setBusy("translate"); setMessage("");
    try {
      const data = await fetchJson<{ translations: Partial<Record<Locale, Translation>>; warnings: Locale[] }>("/api/admin/art/translate", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source),
      });
      setForm((current) => ({ ...current, translations: { ...current.translations, ...data.translations } as Record<Locale, Translation> }));
      if (data.warnings.length) setMessage(`部分语言翻译失败：${data.warnings.join(", ")}，可以手动填写。`);
    } catch (error) { setMessage(`${errorMessage(error)} 可以继续手动填写。`); } finally { setBusy(null); }
  }

  async function save() {
    if (!form.cover && !form.id) return setMessage("请选择或上传封面。");
    setBusy("save"); setMessage("");
    const body: Record<string, unknown> = {
      type: form.type, source: form.source, sourceId: form.sourceId, isbn: form.isbn, originalTitle: form.originalTitle,
      releaseDate: form.releaseDate, collectedOn: form.collectedOn, isVisible: form.isVisible, translations: form.translations,
    };
    if (form.cover) body.cover = form.cover;
    try {
      await fetchJson(form.id ? `/api/admin/art/items/${form.id}` : "/api/admin/art/items", {
        method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      setMessage(form.id ? "收藏已更新。" : "收藏已新增。"); setForm(blankForm(type)); setCandidates([]); await loadItems(type);
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(null); }
  }

  function edit(item: ArtItem) {
    setForm({
      id: item.id, type: item.type, source: item.source, sourceId: item.sourceId, isbn: item.isbn, originalTitle: item.originalTitle,
      releaseDate: item.releaseDate, collectedOn: item.collectedOn, isVisible: item.isVisible, coverUrl: item.coverUrl, cover: null,
      translations: Object.fromEntries(LOCALES.map(({ id }) => [id, item.translations[id] ?? emptyTranslation()])) as Record<Locale, Translation>,
    });
    setLocale("zh-CN"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(item: ArtItem) {
    try {
      await fetchJson(`/api/admin/art/items/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isVisible: !item.isVisible }) });
      await loadItems(type);
    } catch (error) { setMessage(errorMessage(error)); }
  }

  async function remove(item: ArtItem) {
    if (!window.confirm(`永久删除“${display(item).title}”？此操作不可恢复。`)) return;
    try {
      await fetchJson(`/api/admin/art/items/${item.id}`, { method: "DELETE" });
      if (form.id === item.id) setForm(blankForm(type)); await loadItems(type);
    } catch (error) { setMessage(errorMessage(error)); }
  }

  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      return setMessage("仅支持 10 MB 内的 JPEG、PNG、WebP 或 AVIF。");
    }
    const data = await fileToBase64(file);
    setForm((current) => ({ ...current, coverUrl: URL.createObjectURL(file), cover: { kind: "upload", data, mime: file.type } }));
  }

  const activeTranslation = form.translations[locale];
  const canSave = Boolean(form.translations["zh-CN"].title.trim() && form.translations["zh-CN"].creator.trim() && (form.cover || form.id));
  const sourceLabel = useMemo(() => form.source || "尚未选择来源", [form.source]);

  return <div className="space-y-8">
    <div className="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--border-soft)] pb-2" role="tablist" aria-label="收藏类型">
      {TYPES.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => changeType(id)} className={segment(type === id)}>
        <Icon className="size-4" aria-hidden="true" />{label}
      </button>)}
    </div>

    {message && <p role="status" className="border-l-2 border-[var(--foreground)] pl-3 text-sm text-[var(--text-muted)]">{message}</p>}

    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-10">
        <section className="space-y-5" aria-labelledby="art-search-heading">
          <div><h2 id="art-search-heading" className="text-lg font-semibold text-[var(--foreground)]">搜索候选</h2><p className="mt-1 text-sm text-[var(--text-muted)]">搜索只提供候选，最终分类、文字和封面由你确认。</p></div>
          <form onSubmit={search} className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 text-sm"><span>标题或关键词</span><input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} required /></label>
            <label className="space-y-1.5 text-sm"><span>{type === "music" ? "艺人" : type === "book" ? "作者" : "补充关键词"}</span><input className={inputClass} value={creator} onChange={(e) => setCreator(e.target.value)} maxLength={200} /></label>
            {type === "book" && <label className="space-y-1.5 text-sm"><span>ISBN（可选，精确查询）</span><input className={inputClass} value={isbn} onChange={(e) => setIsbn(e.target.value)} inputMode="numeric" maxLength={20} /></label>}
            <div className="flex items-end"><button className={primaryButton} disabled={busy === "search"}><Search className="size-4" />{busy === "search" ? "搜索中" : "搜索"}</button></div>
          </form>
          {candidates.length > 0 && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate) => <button key={`${candidate.source}-${candidate.sourceId}`} type="button" onClick={() => candidate.coverUrl && void selectCandidate(candidate)} disabled={!candidate.coverUrl} className="group text-left disabled:cursor-not-allowed disabled:opacity-45">
              <div className="aspect-[2/3] overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-soft)] bg-[var(--surface-soft)]">{candidate.coverUrl ? <img src={previewUrl(candidate.coverUrl)} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center text-xs text-[var(--text-faint)]">无可用封面</div>}</div>
              <p className="mt-3 font-medium leading-tight text-[var(--foreground)]">{candidate.title}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{candidate.creator || "创作者待补充"}</p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">{candidate.releaseDate || "日期未知"} · {candidate.source}</p>
            </button>)}
          </div>}
        </section>

        <section className="space-y-6 border-t border-[var(--border-soft)] pt-8" aria-labelledby="art-editor-heading">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="art-editor-heading" className="text-lg font-semibold text-[var(--foreground)]">{form.id ? "编辑收藏" : "新增收藏"}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{sourceLabel}</p></div>{form.id && <button className={quietButton} onClick={() => setForm(blankForm(type))}><X className="size-4" />取消编辑</button>}</div>
          <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="aspect-[2/3] overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-soft)] bg-[var(--surface-soft)]">{form.coverUrl ? <img src={previewUrl(form.coverUrl)} alt="封面预览" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[var(--text-faint)]"><ImagePlus className="size-8" /></div>}</div>
              <label className={`${quietButton} cursor-pointer justify-center`}><Upload className="size-4" />上传封面<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} /></label>
              <label className="space-y-1.5 text-xs"><span>或粘贴 HTTPS 图片 URL</span><input className={inputClass} value={form.cover?.kind === "url" ? form.cover.url : ""} onChange={(e) => setForm({ ...form, coverUrl: e.target.value, cover: e.target.value ? { kind: "url", url: e.target.value } : null })} /></label>
            </div>
            <div className="min-w-0 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm"><span>收藏日期</span><input type="date" className={inputClass} value={form.collectedOn} onChange={(e) => setForm({ ...form, collectedOn: e.target.value })} /></label>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} />公开显示</label>
                <label className="space-y-1.5 text-sm"><span>原名</span><input className={inputClass} value={form.originalTitle} onChange={(e) => setForm({ ...form, originalTitle: e.target.value })} maxLength={300} /></label>
                <label className="space-y-1.5 text-sm"><span>发行日期</span><input className={inputClass} value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} maxLength={40} /></label>
              </div>
              <div className="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--border-soft)]" role="tablist" aria-label="翻译语言">
                {LOCALES.map((item) => <button type="button" key={item.id} onClick={() => setLocale(item.id)} className={`border-b-2 px-3 py-2 text-sm ${locale === item.id ? "border-[var(--foreground)] text-[var(--foreground)]" : "border-transparent text-[var(--text-muted)]"}`}>{item.label}</button>)}
              </div>
              <div className="grid gap-4">
                <label className="space-y-1.5 text-sm"><span>标题</span><input className={inputClass} value={activeTranslation.title} onChange={(e) => updateTranslation(setForm, form, locale, "title", e.target.value)} maxLength={200} /></label>
                <label className="space-y-1.5 text-sm"><span>作者 / 导演 / 艺人</span><input className={inputClass} value={activeTranslation.creator} onChange={(e) => updateTranslation(setForm, form, locale, "creator", e.target.value)} maxLength={200} /></label>
                <label className="space-y-1.5 text-sm"><span>一句备注</span><textarea className={`${inputClass} min-h-24 resize-y`} value={activeTranslation.extra} onChange={(e) => updateTranslation(setForm, form, locale, "extra", e.target.value)} maxLength={500} /></label>
              </div>
              <div className="flex flex-wrap gap-3"><button type="button" className={quietButton} onClick={() => void translate()} disabled={busy === "translate"}><Languages className="size-4" />{busy === "translate" ? "翻译中" : "生成翻译草稿"}</button><button type="button" className={primaryButton} onClick={() => void save()} disabled={!canSave || busy === "save"}>{busy === "save" && <LoaderCircle className="size-4 animate-spin" />}{form.id ? "保存修改" : "添加收藏"}</button></div>
            </div>
          </div>
        </section>
      </div>

      <aside className="min-w-0 border-t border-[var(--border-soft)] pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0" aria-labelledby="current-art-heading">
        <div className="mb-5 flex items-center justify-between"><h2 id="current-art-heading" className="text-lg font-semibold text-[var(--foreground)]">当前收藏</h2>{busy === "list" && <LoaderCircle className="size-4 animate-spin text-[var(--text-muted)]" />}</div>
        <div className="space-y-4">
          {items.map((item) => { const text = display(item); return <article key={item.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 border-b border-[var(--border-soft)] pb-4">
            <img src={item.coverUrl} alt="" className="aspect-[2/3] w-full rounded-[var(--radius-control)] object-cover" />
            <div className="min-w-0"><p className="truncate font-medium text-[var(--foreground)]">{text.title}</p><p className="truncate text-sm text-[var(--text-muted)]">{text.creator}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-faint)]"><CalendarDays className="size-3" />{item.collectedOn}</p>
              <div className="mt-3 flex gap-1"><button className={iconButton} title="编辑" aria-label={`编辑 ${text.title}`} onClick={() => edit(item)}><ImagePlus className="size-4" /></button><button className={iconButton} title={item.isVisible ? "隐藏" : "显示"} aria-label={`${item.isVisible ? "隐藏" : "显示"} ${text.title}`} onClick={() => void toggle(item)}>{item.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button><button className={iconButton} title="永久删除" aria-label={`永久删除 ${text.title}`} onClick={() => void remove(item)}><Trash2 className="size-4" /></button></div>
            </div>
          </article>; })}
          {!items.length && busy !== "list" && <p className="text-sm text-[var(--text-muted)]">该分类还没有收藏。</p>}
        </div>
      </aside>
    </div>
  </div>;
}

function blankForm(type: ArtType): FormState {
  return { type, source: type === "music" ? "apple_music" : ["movie", "series", "anime"].includes(type) ? "tmdb" : "apple_books", sourceId: "", isbn: "", originalTitle: "", releaseDate: "", collectedOn: today(), isVisible: true, coverUrl: "", cover: null, translations: Object.fromEntries(LOCALES.map(({ id }) => [id, emptyTranslation()])) as Record<Locale, Translation> };
}
function previewUrl(url: string) { return url.startsWith("blob:") || url.startsWith("/") ? url : `/api/admin/art/cover-preview?url=${encodeURIComponent(url)}`; }
function display(item: ArtItem) { return item.translations["zh-CN"] ?? emptyTranslation(); }
function updateTranslation(setForm: React.Dispatch<React.SetStateAction<FormState>>, form: FormState, locale: Locale, field: keyof Translation, value: string) { setForm({ ...form, translations: { ...form.translations, [locale]: { ...form.translations[locale], [field]: value } } }); }
async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const data = await response.json().catch(() => ({})) as { error?: { message?: string } } & T; if (!response.ok) throw new Error(data.error?.message ?? "请求失败。"); return data; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "请求失败。"; }
function fileToBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
const inputClass = "w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--foreground)] outline-none focus:border-[var(--foreground)]";
const primaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:cursor-not-allowed disabled:opacity-45";
const quietButton = "inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-45";
const iconButton = "inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]";
const segment = (active: boolean) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm ${active ? "bg-[var(--foreground)] text-[var(--canvas)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"}`;
