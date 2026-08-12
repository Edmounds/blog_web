import { Eye, EyeOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";

import type { AdminComment } from "@/lib/comments";

type ButtonVariant = "outline" | "destructive";
type ButtonSize = "default" | "sm";

const buttonBaseClass = "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const buttonVariantClasses: Record<ButtonVariant, string> = {
  outline: "border-[var(--border-strong)] bg-transparent text-foreground hover:border-foreground hover:bg-muted",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
};
const buttonSizeClasses: Record<ButtonSize, string> = {
  default: "h-10 gap-1.5 px-5",
  sm: "h-8 gap-1 px-3.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
};

function Button({
  className,
  variant = "outline",
  size = "default",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={`${buttonBaseClass} ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} ${className ?? ""}`.trim()}
      {...props}
    />
  );
}

interface PostOption {
  contentId: string;
  title: string;
}

interface CommentsAdminProps {
  posts: PostOption[];
}

type Status = "all" | "visible" | "hidden";

export default function CommentsAdmin({ posts }: CommentsAdminProps) {
  const [contentId, setContentId] = useState(posts[0]?.contentId ?? "");
  const [status, setStatus] = useState<Status>("all");
  const [items, setItems] = useState<AdminComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<number>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (contentId) void load(true);
  }, [contentId, status]);

  async function load(reset: boolean) {
    setIsLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ contentId, status });
      if (!reset && nextCursor) query.set("cursor", nextCursor);
      const page = await fetchJson<{ items: AdminComment[]; nextCursor: string | null }>(`/api/admin/comments?${query}`);
      setItems((current) => reset ? page.items : [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论加载失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleHidden(item: AdminComment) {
    setBusyId(item.id);
    setMessage("");
    try {
      const result = await fetchJson<{ item: AdminComment }>(`/api/admin/comments/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: !item.hidden }),
      });
      setItems((current) => {
        if (status === "visible" && result.item.hidden) return current.filter((comment) => comment.id !== item.id);
        if (status === "hidden" && !result.item.hidden) return current.filter((comment) => comment.id !== item.id);
        return current.map((comment) => comment.id === item.id ? result.item : comment);
      });
      setMessage(result.item.hidden ? "评论已隐藏。" : "评论已恢复。")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论状态更新失败。");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div>
      <div className="grid gap-5 border-b border-[var(--border-soft)] pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <label htmlFor="admin-post" className="text-sm font-medium text-[var(--text-main)]">内容</label>
          <select
            id="admin-post"
            value={contentId}
            onChange={(event) => setContentId(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--color-action)]"
          >
            {posts.map((post) => <option key={post.contentId} value={post.contentId}>{post.title}</option>)}
          </select>
        </div>

        <div className="inline-flex h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] p-1 md:w-auto" aria-label="评论状态">
          {([['all', '全部'], ['visible', '可见'], ['hidden', '已隐藏']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`min-w-20 px-3 text-sm transition-colors ${status === value ? "bg-[var(--text-main)] text-[var(--bg-base)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="min-h-10 py-3 text-sm text-[var(--text-muted)]" role="status" aria-live="polite">{message}</p>

      {isLoading && items.length === 0 ? (
        <p className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]"><LoaderCircle className="size-4 animate-spin" />正在加载评论</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-10">
          <p className="text-sm text-[var(--text-muted)]">当前筛选下没有评论。</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void load(true)}><RefreshCw />重新加载</Button>
        </div>
      ) : (
        <ol className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
          {items.map((item) => (
            <li key={item.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-base font-semibold text-[var(--text-main)]">{item.name}</h2>
                  <span className={`text-xs ${item.hidden ? "text-[var(--destructive)]" : "text-[var(--text-faint)]"}`}>{item.hidden ? "已隐藏" : "可见"}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-muted)]">{item.content}</p>
                <p className="text-xs leading-5 text-[var(--text-faint)]">#{item.id} · {item.createdAtLabel} · {item.device} · {item.region}</p>
              </div>
              <Button type="button" size="sm" variant={item.hidden ? "outline" : "destructive"} disabled={busyId === item.id} onClick={() => void toggleHidden(item)}>
                {busyId === item.id ? <LoaderCircle className="animate-spin" /> : item.hidden ? <Eye /> : <EyeOff />}
                {item.hidden ? "恢复" : "隐藏"}
              </Button>
            </li>
          ))}
        </ol>
      )}

      {nextCursor && (
        <Button type="button" variant="outline" className="mt-5 w-full" disabled={isLoading} onClick={() => void load(false)}>
          {isLoading && <LoaderCircle className="animate-spin" />}{isLoading ? "加载中" : "加载更多"}
        </Button>
      )}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "请求失败。");
  return data;
}
