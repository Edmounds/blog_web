import { ChevronRight } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

interface TableOfContentsProps {
  headings: Heading[];
}

interface TOCItem {
  id: string;
  slug: string;
  text: string;
  depth: number;
  subheadings: TOCItem[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});

  // 1. Build collapsible hierarchical tree of headings
  const tree = useMemo(() => {
    const list: TOCItem[] = [];
    let currentTop: TOCItem | null = null;

    // Always prepend "Introduction" as the first top-level element pointing to top of page
    list.push({
      id: "intro-top",
      slug: "",
      text: "Introduction",
      depth: 2,
      subheadings: [],
    });

    for (const h of headings) {
      if (h.depth === 2 || h.depth === 1) {
        currentTop = {
          id: h.slug,
          slug: h.slug,
          text: h.text,
          depth: h.depth,
          subheadings: [],
        };
        list.push(currentTop);
      } else if (h.depth === 3) {
        const subItem: TOCItem = {
          id: h.slug,
          slug: h.slug,
          text: h.text,
          depth: h.depth,
          subheadings: [],
        };
        if (currentTop) {
          currentTop.subheadings.push(subItem);
        } else {
          // If H3 appears before any H2, add it as a top level item
          list.push(subItem);
        }
      }
    }
    return list;
  }, [headings]);

  // 2. High-precision Scroll Active Heading Tracking
  useEffect(() => {
    // Collect all element IDs we are tracking (excluding empty slug for Intro)
    const headingElements = tree
      .flatMap((item) => [item, ...item.subheadings])
      .filter((item) => item.slug !== "")
      .map((item) => document.getElementById(item.slug))
      .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) {
      setActiveId("");
      return;
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      
      // If we are near the top of the page, automatically highlight "Introduction"
      if (scrollPosition < 120) {
        setActiveId("");
        return;
      }

      // Check if we have scrolled to the bottom of the page
      const isBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 30;

      if (isBottom) {
        setActiveId(headingElements[headingElements.length - 1].id);
        return;
      }

      const threshold = 110; // offset for sticky nav bars (cumulative height is 96px)
      let currentActive = "";

      for (let i = 0; i < headingElements.length; i++) {
        const el = headingElements[i];
        if (el.offsetTop - threshold <= scrollPosition) {
          currentActive = el.id;
        } else {
          break; // Stop since elements are ordered down the page
        }
      }

      setActiveId(currentActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initialize on mount

    return () => window.removeEventListener("scroll", handleScroll);
  }, [tree]);

  // 3. Auto-Expand Parent when a subheading inside it becomes active
  useEffect(() => {
    if (!activeId) return;

    const activeParent = tree.find((item) =>
      item.slug === activeId || item.subheadings.some((sub) => sub.slug === activeId)
    );

    if (activeParent && activeParent.subheadings.length > 0) {
      setExpandedState((prev) => {
        if (prev[activeParent.id]) return prev; // Already expanded
        return { ...prev, [activeParent.id]: true };
      });
    }
  }, [activeId, tree]);

  // Toggle expanded state of a top-level heading group
  const toggleExpand = (id: string) => {
    setExpandedState((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper check if a group is currently expanded
  const isExpanded = (id: string) => {
    return !!expandedState[id];
  };

  return (
    <div className="flex flex-col gap-4 border border-[var(--border-soft)] bg-[var(--surface-canvas)] rounded-[18px] p-5 shadow-none select-none">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--border-soft)] pb-2 block">
        On this page
      </span>
      <nav className="flex flex-col gap-1 text-sm">
        {tree.map((item) => {
          const hasChildren = item.subheadings.length > 0;
          const isItemActive = activeId === item.slug;
          const isAnyChildActive = item.subheadings.some((sub) => activeId === sub.slug);
          
          return (
            <div key={item.id} className="flex flex-col">
              <div className="group/toc flex items-center justify-between py-1 px-1 rounded-md transition-colors hover:bg-[var(--surface-parchment)]">
                <a
                  href={item.slug === "" ? "#" : `#${item.slug}`}
                  className={cn(
                    "flex-1 text-sm truncate transition-colors duration-150 py-0.5",
                    isItemActive
                      ? "font-semibold text-[var(--color-action)]"
                      : isAnyChildActive
                      ? "font-medium text-[var(--text-main)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {item.text}
                </a>

                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleExpand(item.id);
                    }}
                    className="p-1 text-[var(--text-faint)] hover:text-[var(--text-main)] transition-colors rounded hover:bg-[var(--bg-subtle)]"
                    aria-label={isExpanded(item.id) ? "Collapse section" : "Expand section"}
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transform transition-transform duration-200",
                        isExpanded(item.id) && "rotate-90"
                      )}
                    />
                  </button>
                )}
              </div>

              {/* Collapsible Subheadings Panel */}
              <AnimatePresence initial={false}>
                {hasChildren && isExpanded(item.id) && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden pl-3.5 ml-3 border-l border-[var(--border-soft)] space-y-1 mt-1 mb-2"
                  >
                    {item.subheadings.map((sub) => {
                      const isSubActive = activeId === sub.slug;
                      return (
                        <li key={sub.id}>
                          <a
                            href={`#${sub.slug}`}
                            className={cn(
                              "block text-xs py-1 transition-colors duration-150 truncate",
                              isSubActive
                                ? "font-semibold text-[var(--color-action)]"
                                : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                            )}
                          >
                            {sub.text}
                          </a>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
