import { useEffect, useRef, useState } from "react";

interface CoverImageProps {
  src: string;
  alt: string;
}

/**
 * Displays a cover image scaled proportionally (object-contain).
 * To make the letterbox / pillarbox bands blend naturally with the image edges,
 * it renders a blurred, scaled-up backdrop of the same image in the background.
 * This naturally extends any edge color gradients to fill the container perfectly.
 */
export default function CoverImage({ src, alt }: CoverImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // If the image is already loaded (e.g. from cache or finished before hydration)
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className="cover-image-wrapper bg-[var(--surface-parchment)] relative overflow-hidden flex items-center justify-center">
      {/* Blurred background image acting as an edge gradient extension */}
      <div
        className="absolute inset-[-40px] bg-center bg-cover transition-opacity duration-500 ease-in-out"
        style={{
          backgroundImage: `url(${src})`,
          filter: "blur(20px) saturate(1.1)",
          opacity: loaded ? 0.95 : 0,
          zIndex: 0,
        }}
      />
      
      {/* Dark overlay to make the ambient blur subtle and premium (especially in dark mode) */}
      <div 
        className="absolute inset-0 bg-black/5 dark:bg-black/20 pointer-events-none transition-opacity duration-500 ease-in-out"
        style={{
          opacity: loaded ? 1 : 0,
          zIndex: 1,
        }}
      />

      {/* Foreground image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`cover-image-inner relative z-10 ${loaded ? "cover-image-visible" : ""}`}
        loading="eager"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
