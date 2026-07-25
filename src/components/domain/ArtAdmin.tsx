import {
  BookOpen, CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Film, ImagePlus, Languages, LoaderCircle, Music2, Search,
  Trash2, Tv2, Upload, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  cover: { kind: "url"; url: string } | { kind: "stored"; key: string } | null;
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
const TRANSLATED_TYPES = new Set<ArtType>(["book", "movie"]);
const emptyTranslation = (): Translation => ({ title: "", creator: "", extra: "" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const MUSIC_PAGE_SIZE = 10;

export default function ArtAdmin() {
  const [type, setType] = useState<ArtType>("book");
  const [query, setQuery] = useState("");
  const [creator, setCreator] = useState("");
  const [isbn, setIsbn] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatePage, setCandidatePage] = useState(1);
  const [items, setItems] = useState<ArtItem[]>([]);
  const [form, setForm] = useState<FormState>(() => blankForm("book"));
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const pendingCoverKey = useRef<string | null>(null);

  useEffect(() => { void loadItems(type); }, [type]);
  useEffect(() => () => { if (pendingCoverKey.current) void deleteUploadedCover(pendingCoverKey.current); }, []);

  async function loadItems(selectedType: ArtType, ensuredItem?: ArtItem) {
    setIsLoadingItems(true);
    try {
      const data = await fetchJson<{ items: ArtItem[] }>(`/api/admin/art/items?type=${selectedType}`, { cache: "no-store" });
      setItems(ensuredItem ? [ensuredItem, ...data.items.filter((item) => item.id !== ensuredItem.id)] : data.items);
    } catch (error) { setMessage(errorMessage(error)); } finally { setIsLoadingItems(false); }
  }

  function changeType(next: ArtType) {
    discardPendingCover();
    setType(next); setQuery(""); setCreator(""); setIsbn(""); setCandidates([]); setCandidatePage(1); setForm(blankForm(next)); setLocale("zh-CN"); setMessage(""); setSaveMessage("");
  }

  async function search(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true); setMessage(""); setSaveMessage("");
    const params = new URLSearchParams({ type, q: query.trim() });
    if (type !== "music" && creator.trim()) params.set("creator", creator.trim());
    if (isbn.trim()) params.set("isbn", isbn.trim());
    try {
      const data = await fetchJson<{ items: Candidate[] }>(`/api/admin/art/search?${params}`, { cache: "no-store" });
      setCandidates(data.items); setCandidatePage(1); if (!data.items.length) setMessage("没有找到候选结果。");
    } catch (error) { setMessage(errorMessage(error)); } finally { setIsSearching(false); }
  }

  function selectCandidate(candidate: Candidate) {
    discardPendingCover();
    const next = blankForm(type);
    next.source = candidate.source; next.sourceId = candidate.sourceId; next.isbn = candidate.isbn ?? isbn;
    next.originalTitle = candidate.originalTitle ?? candidate.title; next.releaseDate = candidate.releaseDate ?? "";
    next.coverUrl = candidate.coverUrl; next.cover = { kind: "url", url: candidate.coverUrl };
    next.translations["zh-CN"] = { title: candidate.title, creator: candidate.creator || "待填写", extra: candidate.description?.slice(0, 120) ?? "" };
    setForm(next); setLocale("zh-CN"); setMessage(""); setSaveMessage("");
  }

  async function translate(source = form.translations["zh-CN"]) {
    if (!source.title.trim() || !source.creator.trim()) return setMessage("请先填写简中标题和作者。");
    setIsTranslating(true); setMessage(""); setSaveMessage("");
    try {
      const data = await fetchJson<{ translations: Partial<Record<Locale, Translation>>; warnings: Locale[] }>("/api/admin/art/translate", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, ...source }),
      });
      setForm((current) => ({ ...current, translations: { ...current.translations, ...data.translations } as Record<Locale, Translation> }));
      if (data.warnings.length) setMessage(`部分语言翻译失败：${data.warnings.join(", ")}，可以手动填写。`);
    } catch (error) { setMessage(`${errorMessage(error)} 可以继续手动填写。`); } finally { setIsTranslating(false); }
  }

  async function save() {
    if (!form.cover && !form.id) return setSaveMessage("请选择或上传封面。");
    const savedTitle = form.translations["zh-CN"].title.trim();
    setIsSaving(true); setMessage(""); setSaveMessage("");
    const body: Record<string, unknown> = {
      type: form.type, source: form.source, sourceId: form.sourceId, isbn: form.isbn, originalTitle: form.originalTitle,
      releaseDate: form.releaseDate, collectedOn: form.collectedOn, isVisible: form.isVisible, translations: translationsForType(form.type, form.translations),
    };
    if (form.cover) body.cover = form.cover;
    try {
      const data = await fetchJson<{ item: ArtItem }>(form.id ? `/api/admin/art/items/${form.id}` : "/api/admin/art/items", {
        method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      pendingCoverKey.current = null;
      setItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
      setSaveMessage(form.id ? `已更新“${savedTitle}”。` : `已添加“${savedTitle}”。`);
      setForm(blankForm(type)); setLocale("zh-CN");
    } catch (error) { setSaveMessage(errorMessage(error)); } finally { setIsSaving(false); }
  }

  function edit(item: ArtItem) {
    discardPendingCover();
    setForm({
      id: item.id, type: item.type, source: item.source, sourceId: item.sourceId, isbn: item.isbn, originalTitle: item.originalTitle,
      releaseDate: item.releaseDate, collectedOn: item.collectedOn, isVisible: item.isVisible, coverUrl: item.coverUrl, cover: null,
      translations: Object.fromEntries(LOCALES.map(({ id }) => [id, item.translations[id] ?? emptyTranslation()])) as Record<Locale, Translation>,
    });
    setLocale("zh-CN"); setSaveMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
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
    setIsUploading(true); setMessage(""); setSaveMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const data = await fetchJson<{ cover: { kind: "stored"; key: string; url: string } }>("/api/admin/art/covers", { method: "POST", body });
      const previousKey = pendingCoverKey.current;
      pendingCoverKey.current = data.cover.key;
      setForm((current) => ({ ...current, coverUrl: data.cover.url, cover: { kind: "stored", key: data.cover.key } }));
      if (previousKey) void deleteUploadedCover(previousKey);
    } catch (error) { setMessage(errorMessage(error)); } finally { setIsUploading(false); }
  }

  function discardPendingCover() {
    const key = pendingCoverKey.current;
    pendingCoverKey.current = null;
    if (key) void deleteUploadedCover(key);
  }

  function changeCoverUrl(url: string) {
    discardPendingCover();
    setForm({ ...form, coverUrl: url, cover: url ? { kind: "url", url } : null });
  }

  const activeTranslation = form.translations[locale];
  const canSave = Boolean(form.translations["zh-CN"].title.trim() && form.translations["zh-CN"].creator.trim() && (form.cover || form.id));
  const sourceLabel = useMemo(() => form.source || "尚未选择来源", [form.source]);
  const collectedCandidates = useMemo(() => new Set(items.map((item) => candidateKey(item))), [items]);
  const candidatePageCount = type === "music" ? Math.max(1, Math.ceil(candidates.length / MUSIC_PAGE_SIZE)) : 1;
  const candidatePageStart = (candidatePage - 1) * MUSIC_PAGE_SIZE;
  const visibleCandidates = type === "music" ? candidates.slice(candidatePageStart, candidatePageStart + MUSIC_PAGE_SIZE) : candidates;

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
            <label className="space-y-1.5 text-sm"><span>{type === "music" ? "专辑名或歌手" : "标题或关键词"}</span><input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} required /></label>
            {type !== "music" && <label className="space-y-1.5 text-sm"><span>{type === "book" ? "作者" : "补充关键词"}</span><input className={inputClass} value={creator} onChange={(e) => setCreator(e.target.value)} maxLength={200} /></label>}
            {type === "book" && <label className="space-y-1.5 text-sm"><span>ISBN（可选，精确查询）</span><input className={inputClass} value={isbn} onChange={(e) => setIsbn(e.target.value)} inputMode="numeric" maxLength={20} /></label>}
            <div className="flex items-end"><button className={primaryButton} disabled={isSearching}><Search className="size-4" />{isSearching ? "搜索中" : "搜索"}</button></div>
          </form>
          {candidates.length > 0 && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCandidates.map((candidate) => { const isCollected = collectedCandidates.has(candidateKey(candidate)); return <button key={candidateKey(candidate)} type="button" onClick={() => candidate.coverUrl && !isCollected && selectCandidate(candidate)} disabled={!candidate.coverUrl || isCollected} className="group text-left disabled:cursor-not-allowed disabled:opacity-45">
              {type === "music" ? <AlbumCover src={candidate.coverUrl ? previewUrl(candidate.coverUrl) : ""} alt="" /> : <PosterCover src={candidate.coverUrl ? previewUrl(candidate.coverUrl) : ""} alt="" hover />}
              <p className="mt-3 font-medium leading-tight text-[var(--foreground)]">{candidate.title}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{candidate.creator || "创作者待补充"}</p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">{isCollected ? "已收藏" : `${candidate.releaseDate || "日期未知"} · ${candidate.source}`}</p>
            </button>; })}
          </div>}
          {type === "music" && candidates.length > MUSIC_PAGE_SIZE && <div className="flex items-center justify-center gap-3">
            <button type="button" className={iconButton} aria-label="上一页" title="上一页" disabled={candidatePage === 1} onClick={() => setCandidatePage((page) => Math.max(1, page - 1))}><ChevronLeft className="size-4" /></button>
            <p className="min-w-20 text-center text-sm text-[var(--text-muted)]">第 {candidatePage} / {candidatePageCount} 页</p>
            <button type="button" className={iconButton} aria-label="下一页" title="下一页" disabled={candidatePage === candidatePageCount} onClick={() => setCandidatePage((page) => Math.min(candidatePageCount, page + 1))}><ChevronRight className="size-4" /></button>
          </div>}
        </section>

        <section className="space-y-6 border-t border-[var(--border-soft)] pt-8" aria-labelledby="art-editor-heading">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="art-editor-heading" className="text-lg font-semibold text-[var(--foreground)]">{form.id ? "编辑收藏" : "新增收藏"}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{sourceLabel}</p></div>{form.id && <button className={quietButton} onClick={() => { discardPendingCover(); setForm(blankForm(type)); }}><X className="size-4" />取消编辑</button>}</div>
          <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="space-y-3">
              {type === "music" ? <AlbumCover src={form.coverUrl ? previewUrl(form.coverUrl) : ""} alt="封面预览" emptyIcon /> : <PosterCover src={form.coverUrl ? previewUrl(form.coverUrl) : ""} alt="封面预览" emptyIcon />}
              <label className={`${quietButton} cursor-pointer justify-center ${isUploading ? "pointer-events-none opacity-45" : ""}`}><Upload className="size-4" />{isUploading ? "上传中" : "上传封面"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={isUploading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
              <label className="space-y-1.5 text-xs"><span>或粘贴 HTTPS 图片 URL</span><input className={inputClass} value={form.coverUrl} onChange={(e) => changeCoverUrl(e.target.value)} /></label>
            </div>
            <div className="min-w-0 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm"><span>收藏日期</span><input type="date" className={inputClass} value={form.collectedOn} onChange={(e) => setForm({ ...form, collectedOn: e.target.value })} /></label>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} />公开显示</label>
                <label className="space-y-1.5 text-sm"><span>原名</span><input className={inputClass} value={form.originalTitle} onChange={(e) => setForm({ ...form, originalTitle: e.target.value })} maxLength={300} /></label>
                <label className="space-y-1.5 text-sm"><span>发行日期</span><input className={inputClass} value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} maxLength={40} /></label>
              </div>
              {TRANSLATED_TYPES.has(type) && <div className="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--border-soft)]" role="tablist" aria-label="翻译语言">
                {LOCALES.map((item) => <button type="button" key={item.id} onClick={() => setLocale(item.id)} className={`border-b-2 px-3 py-2 text-sm ${locale === item.id ? "border-[var(--foreground)] text-[var(--foreground)]" : "border-transparent text-[var(--text-muted)]"}`}>{item.label}</button>)}
              </div>}
              <div className="grid gap-4">
                <label className="space-y-1.5 text-sm"><span>标题</span><input className={inputClass} value={activeTranslation.title} onChange={(e) => updateTranslation(setForm, form, locale, "title", e.target.value)} maxLength={200} /></label>
                <label className="space-y-1.5 text-sm"><span>作者 / 导演 / 艺人</span><input className={inputClass} value={activeTranslation.creator} onChange={(e) => updateTranslation(setForm, form, locale, "creator", e.target.value)} maxLength={200} /></label>
                <label className="space-y-1.5 text-sm"><span>一句备注</span><textarea className={`${inputClass} min-h-24 resize-y`} value={activeTranslation.extra} onChange={(e) => updateTranslation(setForm, form, locale, "extra", e.target.value)} maxLength={500} /></label>
              </div>
              <div className="flex flex-wrap gap-3">{TRANSLATED_TYPES.has(type) && <button type="button" className={quietButton} onClick={() => void translate()} disabled={isTranslating || isSaving}><Languages className="size-4" />{isTranslating ? "翻译中" : "生成翻译草稿"}</button>}<button type="button" className={primaryButton} onClick={() => void save()} disabled={!canSave || isSaving || isTranslating || isUploading}>{isSaving && <LoaderCircle className="size-4 animate-spin" />}{isSaving ? (form.id ? "保存中" : "添加中") : form.id ? "保存修改" : "添加收藏"}</button></div>
              <p aria-live="polite" role="status" className={`min-h-5 text-sm ${saveMessage ? "text-[var(--text-muted)]" : "sr-only"}`}>{saveMessage || "等待保存结果"}</p>
            </div>
          </div>
        </section>
      </div>

      <aside className="min-w-0 border-t border-[var(--border-soft)] pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0" aria-labelledby="current-art-heading">
        <div className="mb-5 flex items-center justify-between"><h2 id="current-art-heading" className="text-lg font-semibold text-[var(--foreground)]">当前收藏</h2>{isLoadingItems && <LoaderCircle className="size-4 animate-spin text-[var(--text-muted)]" />}</div>
        <div className="space-y-4">
          {items.map((item) => { const text = display(item); return <article key={item.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 border-b border-[var(--border-soft)] pb-4">
            {type === "music" ? <AlbumCover src={item.coverUrl} alt="" /> : <PosterCover src={item.coverUrl} alt="" />}
            <div className="min-w-0"><p className="truncate font-medium text-[var(--foreground)]">{text.title}</p><p className="truncate text-sm text-[var(--text-muted)]">{text.creator}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-faint)]"><CalendarDays className="size-3" />{item.collectedOn}</p>
              <div className="mt-3 flex gap-1"><button className={iconButton} title="编辑" aria-label={`编辑 ${text.title}`} onClick={() => edit(item)}><ImagePlus className="size-4" /></button><button className={iconButton} title={item.isVisible ? "隐藏" : "显示"} aria-label={`${item.isVisible ? "隐藏" : "显示"} ${text.title}`} onClick={() => void toggle(item)}>{item.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button><button className={iconButton} title="永久删除" aria-label={`永久删除 ${text.title}`} onClick={() => void remove(item)}><Trash2 className="size-4" /></button></div>
            </div>
          </article>; })}
          {!items.length && !isLoadingItems && <p className="text-sm text-[var(--text-muted)]">该分类还没有收藏。</p>}
        </div>
      </aside>
    </div>
  </div>;
}

function AlbumCover({ src, alt, emptyIcon = false }: { src: string; alt: string; emptyIcon?: boolean }) {
  return <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-soft)] bg-[var(--surface-soft)]">
    {src ? <>
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-55" />
      <img src={src} alt={alt} className="relative h-full w-full object-contain" />
    </> : <div className="flex h-full items-center justify-center text-xs text-[var(--text-faint)]">{emptyIcon ? <ImagePlus className="size-8" /> : "无可用封面"}</div>}
  </div>;
}

function PosterCover({ src, alt, emptyIcon = false, hover = false }: { src: string; alt: string; emptyIcon?: boolean; hover?: boolean }) {
  return <div className="aspect-[2/3] w-full overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-soft)] bg-[var(--surface-soft)]">
    {src ? <img src={src} alt={alt} className={`h-full w-full object-cover ${hover ? "transition group-hover:scale-[1.02]" : ""}`} /> : <div className="flex h-full items-center justify-center text-xs text-[var(--text-faint)]">{emptyIcon ? <ImagePlus className="size-8" /> : "无可用封面"}</div>}
  </div>;
}

function blankForm(type: ArtType): FormState {
  return { type, source: type === "music" ? "deezer_music" : ["movie", "series", "anime"].includes(type) ? "tmdb" : "apple_books", sourceId: "", isbn: "", originalTitle: "", releaseDate: "", collectedOn: today(), isVisible: true, coverUrl: "", cover: null, translations: Object.fromEntries(LOCALES.map(({ id }) => [id, emptyTranslation()])) as Record<Locale, Translation> };
}
function candidateKey(item: Pick<Candidate, "source" | "sourceId">) { return `${item.source}:${item.sourceId}`; }
function previewUrl(url: string) { return url.startsWith("/") || url.startsWith("https://img.muelsyse.us/") ? url : `/api/admin/art/cover-preview?url=${encodeURIComponent(url)}`; }
function display(item: ArtItem) { return item.translations["zh-CN"] ?? emptyTranslation(); }
function translationsForType(type: ArtType, translations: Record<Locale, Translation>) { return TRANSLATED_TYPES.has(type) ? translations : { "zh-CN": translations["zh-CN"] }; }
function updateTranslation(setForm: React.Dispatch<React.SetStateAction<FormState>>, form: FormState, locale: Locale, field: keyof Translation, value: string) { setForm({ ...form, translations: { ...form.translations, [locale]: { ...form.translations[locale], [field]: value } } }); }
async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const data = await response.json().catch(() => ({})) as { error?: { message?: string } } & T; if (!response.ok) throw new Error(data.error?.message ?? "请求失败。"); return data; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "请求失败。"; }
async function deleteUploadedCover(key: string) {
  try { await fetch("/api/admin/art/covers", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }), keepalive: true }); } catch {}
}
const inputClass = "w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--foreground)] outline-none focus:border-[var(--foreground)]";
const primaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:cursor-not-allowed disabled:opacity-45";
const quietButton = "inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-45";
const iconButton = "inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]";
const segment = (active: boolean) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm ${active ? "bg-[var(--foreground)] text-[var(--canvas)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"}`;
