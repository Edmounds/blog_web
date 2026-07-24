import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

interface TableOfContentsProps {
  headings: Heading[];
  labels?: { title: string; introduction: string; collapse: string; expand: string };
  mode?: "desktop" | "mobile";
}

interface TOCItem {
  id: string;
  slug: string;
  text: string;
  depth: number;
  subheadings: TOCItem[];
}

const defaultLabels = {
  title: "On this page",
  introduction: "Introduction",
  collapse: "Collapse section",
  expand: "Expand section",
};

export default function TableOfContents({ headings, labels = defaultLabels, mode = "desktop" }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState("");
  const [open, setOpen] = useState(false);
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => {
    const list: TOCItem[] = [{ id: "intro-top", slug: "", text: labels.introduction, depth: 2, subheadings: [] }];
    let currentTop: TOCItem | null = null;

    for (const heading of headings) {
      const item: TOCItem = { id: heading.slug, slug: heading.slug, text: heading.text, depth: heading.depth, subheadings: [] };
      if (heading.depth <= 2) {
        currentTop = item;
        list.push(item);
      } else if (currentTop) {
        currentTop.subheadings.push(item);
      } else {
        list.push(item);
      }
    }

    return list;
  }, [headings, labels.introduction]);

  useEffect(() => {
    const elements = tree
      .flatMap((item) => [item, ...item.subheadings])
      .filter((item) => item.slug)
      .map((item) => document.getElementById(item.slug))
      .filter((element): element is HTMLElement => Boolean(element));

    const update = () => {
      if (window.scrollY < 120) {
        setActiveId("");
        return;
      }

      let current = "";
      for (const element of elements) {
        if (element.offsetTop - 120 <= window.scrollY) current = element.id;
        else break;
      }
      setActiveId(current);
    };

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [tree]);

  useEffect(() => {
    const parent = tree.find((item) => item.subheadings.some((subheading) => subheading.slug === activeId));
    if (parent) setExpandedState((state) => state[parent.id] ? state : { ...state, [parent.id]: true });
  }, [activeId, tree]);

  const content = (
    <nav className="toc-nav" aria-label={labels.title}>
      {tree.map((item) => {
        const active = activeId === item.slug;
        const hasChildren = item.subheadings.length > 0;
        const expanded = Boolean(expandedState[item.id]);

        return (
          <div className="toc-group" key={item.id}>
            <div className="toc-row">
              <a
                href={item.slug ? `#${item.slug}` : "#"}
                className={active ? "toc-link is-active" : "toc-link"}
                onClick={() => mode === "mobile" && setOpen(false)}
              >
                {item.text}
              </a>
              {hasChildren && (
                <button
                  type="button"
                  className="toc-expand"
                  aria-label={expanded ? labels.collapse : labels.expand}
                  aria-expanded={expanded}
                  onClick={() => setExpandedState((state) => ({ ...state, [item.id]: !state[item.id] }))}
                >
                  <ChevronRight aria-hidden="true" className={expanded ? "is-expanded" : ""} />
                </button>
              )}
            </div>

            {hasChildren && expanded && (
              <ul className="toc-children">
                {item.subheadings.map((subheading) => (
                  <li key={subheading.id}>
                    <a
                      href={`#${subheading.slug}`}
                      className={activeId === subheading.slug ? "toc-link toc-link--sub is-active" : "toc-link toc-link--sub"}
                      onClick={() => mode === "mobile" && setOpen(false)}
                    >
                      {subheading.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  if (mode === "mobile") {
    return (
      <section className="toc-mobile">
        <button type="button" className="toc-mobile__trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span>{labels.title}</span>
          <ChevronDown aria-hidden="true" className={open ? "is-expanded" : ""} />
        </button>
        {open && <div className="toc-mobile__panel">{content}</div>}
      </section>
    );
  }

  return (
    <section className="toc-desktop">
      <h2>{labels.title}</h2>
      {content}
    </section>
  );
}
