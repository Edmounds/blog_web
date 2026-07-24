import { LoaderCircle, MessageSquareText, RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PublicComment } from "@/lib/comments";

interface CommentsSectionProps {
  contentId: string;
  labels?: Record<string, string>;
}

interface CommentPage {
  items: PublicComment[];
  nextCursor: string | null;
}

interface ApiError {
  error?: { code?: string; message?: string };
}

export default function CommentsSection({ contentId, labels = {} }: CommentsSectionProps) {
  const copy = { comments: "评论", commentName: "名称", commentContent: "评论内容", commentSubmit: "发布评论", commentSubmitting: "发布中", commentLoading: "正在加载评论", commentReload: "重新加载", commentEmpty: "还没有评论，来留下第一条吧。", commentLoadMore: "加载更多", commentLoadingMore: "加载中", commentNameInvalid: "名称需为 1 至 20 个字符。", commentContentInvalid: "评论需为 1 至 500 个字符。", commentPublished: "评论已发布。", commentLoadFailed: "暂时无法加载评论，请稍后重试。", commentSubmitFailed: "评论发布失败，请稍后重试。", ...labels };
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    void loadComments(true);
  }, [contentId]);

  async function loadComments(reset: boolean) {
    reset ? setIsLoading(true) : setIsLoadingMore(true);
    setLoadError("");

    try {
      const cursor = reset ? null : nextCursor;
      const query = new URLSearchParams({ contentId });
      if (cursor) query.set("cursor", cursor);
      const page = await fetchJson<CommentPage>(`/api/comments?${query}`);
      setComments((current) => reset ? page.items : [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasLoadedOnce(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : copy.commentLoadFailed);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const cleanName = name.trim();
    if (!cleanName || Array.from(cleanName).length > 20) {
      setStatus(copy.commentNameInvalid);
      return;
    }
    if (!content.trim() || Array.from(content).length > 500) {
      setStatus(copy.commentContentInvalid);
      return;
    }

    setIsSubmitting(true);
    setStatus("");
    try {
      const result = await fetchJson<{ item: PublicComment }>("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId, name, content, website }),
      });
      setComments((current) => [result.item, ...current.filter((item) => item.id !== result.item.id)]);
      setContent("");
      setStatus(copy.commentPublished);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.commentSubmitFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="comments" className="border-t border-[var(--border-soft)] pt-10" aria-labelledby="comments-title">
      <div className="flex items-center gap-3">
        <MessageSquareText className="size-5 text-[var(--foreground-soft)]" aria-hidden="true" />
        <h2 id="comments-title" className="text-2xl font-semibold text-[var(--text-main)]">{copy.comments}</h2>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="comment-name" className="text-sm font-medium text-[var(--text-main)]">{copy.commentName}</label>
            <span className="text-xs tabular-nums text-[var(--text-faint)]">{Array.from(name).length}/20</span>
          </div>
          <input
            id="comment-name"
            name="name"
            required
            maxLength={20}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 text-base text-[var(--text-main)] outline-none transition focus:border-[var(--foreground)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="comment-content" className="text-sm font-medium text-[var(--text-main)]">{copy.commentContent}</label>
            <span className="text-xs tabular-nums text-[var(--text-faint)]">{Array.from(content).length}/500</span>
          </div>
          <textarea
            id="comment-content"
            name="content"
            required
            maxLength={500}
            rows={6}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-32 w-full resize-y rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 py-3 text-base leading-6 text-[var(--text-main)] outline-none transition focus:border-[var(--foreground)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>

        <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="comment-website">网站</label>
          <input id="comment-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {isSubmitting ? copy.commentSubmitting : copy.commentSubmit}
          </Button>
        </div>
        <p className="min-h-5 text-sm text-[var(--text-muted)]" role="status" aria-live="polite">{status}</p>
      </form>

      <div className="mt-10 border-t border-[var(--border-soft)] pt-2">
        {isLoading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{copy.commentLoading}
          </p>
        ) : loadError && !hasLoadedOnce ? (
          <div className="flex flex-col items-start gap-3 py-8" role="alert">
            <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadComments(true)}>
              <RefreshCw aria-hidden="true" />{copy.commentReload}
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-sm text-[var(--text-muted)]">{copy.commentEmpty}</p>
        ) : (
          <ol className="divide-y divide-[var(--border-soft)]">
            {comments.map((comment) => (
              <li key={comment.id} className="py-6">
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="break-words text-base font-semibold text-[var(--text-main)]">{comment.name}</h3>
                  <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-7 text-[var(--text-muted)]">{comment.content}</p>
                  <p className="text-xs leading-5 text-[var(--text-faint)]">
                    {comment.createdAtLabel} · {comment.device} · {comment.region}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {loadError && hasLoadedOnce && (
          <div className="flex flex-col items-start gap-3 py-5" role="alert">
            <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadComments(false)}>
              <RefreshCw aria-hidden="true" />{copy.commentReload}
            </Button>
          </div>
        )}

        {nextCursor && !loadError && (
          <Button type="button" variant="outline" className="mt-4 w-full" disabled={isLoadingMore} onClick={() => void loadComments(false)}>
            {isLoadingMore && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {isLoadingMore ? copy.commentLoadingMore : copy.commentLoadMore}
          </Button>
        )}
      </div>
    </section>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(data.error?.message ?? "请求失败，请稍后重试。");
  return data;
}
