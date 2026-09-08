import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  showText?: boolean;
}

export default function StarRatingInput({
  value,
  onChange,
  size = "md",
  disabled = false,
  showText = false,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const numericValue = typeof value === "number" && value >= 1 && value <= 5 ? Math.round(value) : null;
  const displayRating = hovered ?? numericValue ?? 0;

  const starSizeClass = size === "sm" ? "size-3.5" : "size-5";
  const buttonPadding = size === "sm" ? "p-0.5" : "p-1";

  function handleClick(star: number) {
    if (disabled) return;
    if (numericValue === star) {
      onChange(null);
    } else {
      onChange(star);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5" onMouseLeave={() => setHovered(null)}>
      <div className="inline-flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => handleClick(star)}
              onMouseEnter={() => !disabled && setHovered(star)}
              className={`${buttonPadding} rounded-[calc(var(--radius-control)-2px)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50`}
              title={
                disabled
                  ? undefined
                  : numericValue === star
                    ? `已打 ${star} 星，再次点击清除`
                    : `打 ${star} 星`
              }
              aria-label={
                numericValue === star
                  ? `已选择 ${star} 星，点击取消评分`
                  : `选择 ${star} 星`
              }
            >
              <Star
                className={`${starSizeClass} transition-colors ${
                  isFilled
                    ? "fill-current text-[var(--foreground)]"
                    : "fill-none text-[var(--border-strong)]"
                }`}
              />
            </button>
          );
        })}
      </div>
      {showText && (
        <span className="text-xs text-[var(--text-muted)] select-none">
          {numericValue ? `${numericValue} 星` : "未评分"}
        </span>
      )}
    </div>
  );
}
