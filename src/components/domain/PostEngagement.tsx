import { Eye, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface PostEngagementProps {
  slug: string;
}

interface PostStats {
  slug: string;
  views: number;
  likes: number;
}

type LoadState = "idle" | "ready" | "unavailable";

const formatCount = (value: number | undefined): string => {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US").format(value);
};

export default function PostEngagement({ slug }: PostEngagementProps) {
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
      aria-label="Post engagement"
    >
      <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)]" aria-live="polite">
        <StatItem icon={<Eye aria-hidden="true" />} label="Views" value={formatCount(stats?.views)} />
        <StatItem icon={<Heart aria-hidden="true" />} label="Likes" value={formatCount(stats?.likes)} />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLike}
        disabled={isLiking || loadState === "unavailable"}
        className="w-full justify-center sm:w-auto"
        aria-label="Like this post"
      >
        <Heart aria-hidden="true" className={isLiking ? "fill-current" : undefined} />
        {isLiking ? "Liking" : "Like"}
      </Button>

      {loadState === "unavailable" && (
        <span className="sr-only" role="status">
          Post statistics are unavailable.
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
