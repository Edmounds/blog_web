import { Eye, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface PostEngagementProps {
  slug: string;
  locale?: string;
  labels?: Record<string, string>;
}

interface PostStats {
  slug: string;
  views: number;
  likes: number;
}

type LoadState = "idle" | "ready" | "unavailable";

const formatCount = (value: number | undefined, locale: string): string => {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat(locale).format(value);
};

export default function PostEngagement({ slug, locale = "zh-CN", labels = {} }: PostEngagementProps) {
  const copy = { engagementLabel: "文章互动", views: "浏览", likes: "喜欢", like: "点赞", liking: "点赞中", statsUnavailable: "文章统计暂时不可用。", ...labels };
  const [stats, setStats] = useState<PostStats>();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      try {
        const current = await fetchJson<PostStats>(`/api/stats?slug=${encodeURIComponent(slug)}`);
        if (!isActive) return;
        setStats(current);
        setLoadState("ready");

        const viewed = await fetchJson<PostStats & { ok: true; counted: boolean }>("/api/view", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ slug }),
        });
        if (!isActive) return;
        setStats(viewed);
      } catch {
        if (!isActive) return;
        setLoadState("unavailable");
      }
    }

    void loadStats();

    return () => {
      isActive = false;
    };
  }, [slug]);

  async function handleLike() {
    if (isLiking) return;

    setIsLiking(true);

    try {
      const liked = await fetchJson<PostStats & { ok: true }>("/api/like", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug }),
      });
      setStats(liked);
      setLoadState("ready");
    } catch {
      setLoadState("unavailable");
    } finally {
      setIsLiking(false);
    }
  }

  return (
    <section
      className="flex flex-col gap-4 border-y border-[var(--border-soft)] py-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label={copy.engagementLabel}
    >
      <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)]" aria-live="polite">
        <StatItem icon={<Eye aria-hidden="true" />} label={copy.views} value={formatCount(stats?.views, locale)} />
        <StatItem icon={<Heart aria-hidden="true" />} label={copy.likes} value={formatCount(stats?.likes, locale)} />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLike}
        disabled={isLiking || loadState === "unavailable"}
        className="w-full justify-center sm:w-auto"
        aria-label={copy.like}
      >
        <Heart aria-hidden="true" className={isLiking ? "fill-current" : undefined} />
        {isLiking ? copy.liking : copy.like}
      </Button>

      {loadState === "unavailable" && (
        <span className="sr-only" role="status">
          {copy.statsUnavailable}
        </span>
      )}
    </section>
  );
}

function StatItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] px-3 py-2">
      <span className="[&_svg]:size-4">{icon}</span>
      <span className="font-medium text-[var(--text-main)]">{value}</span>
      <span>{label}</span>
    </span>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
