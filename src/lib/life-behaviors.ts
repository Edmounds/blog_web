/**
 * Client behaviour for the Life sections. It lives here rather than in the
 * section components because those are injected into the SPA as HTML
 * fragments, which never carries their component scripts along.
 */

type Select = (selected: HTMLButtonElement) => void;

const paintTabs = (tabs: HTMLButtonElement[], selected: HTMLButtonElement) => {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.classList.toggle("bg-[var(--foreground)]", active);
    tab.classList.toggle("text-[var(--canvas)]", active);
    tab.classList.toggle("text-[var(--text-muted)]", !active);
  }
};

const wireTabs = (tabs: HTMLButtonElement[], select: Select) => {
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
};

const claim = (element: HTMLElement) => {
  if (element.dataset.bound === "true") return false;
  element.dataset.bound = "true";
  return true;
};

const showMatching = (
  grid: HTMLElement,
  itemSelector: string,
  itemKey: string,
  emptySelector: string,
  emptyKey: string,
  value: string | undefined,
) => {
  let visibleItems = 0;
  grid.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => {
    const visible = item.dataset[itemKey] === value;
    item.classList.toggle("hidden", !visible);
    if (visible) visibleItems += 1;
  });
  grid.querySelectorAll<HTMLElement>(emptySelector).forEach((empty) => {
    const visible = empty.dataset[emptyKey] === value && visibleItems === 0;
    empty.classList.toggle("hidden", !visible);
    empty.classList.toggle("flex", visible);
  });
};

const bindScreenTabs = () => {
  document.querySelectorAll<HTMLElement>("[data-screen-tabs]").forEach((root) => {
    const grid = root.parentElement?.querySelector<HTMLElement>("[data-art-grid]");
    if (!grid || !claim(root)) return;
    const tabs = Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-screen-tab]"),
    );
    wireTabs(tabs, (selected) => {
      paintTabs(tabs, selected);
      showMatching(
        grid,
        "[data-art-type]",
        "artType",
        "[data-art-empty]",
        "artEmpty",
        selected.dataset.screenTab,
      );
    });
  });
};

const bindRankingTabs = (ranking: HTMLElement) => {
  const root = ranking.querySelector<HTMLElement>("[data-ranking-tabs]");
  if (!root || !claim(root)) return;
  const tabs = Array.from(
    ranking.querySelectorAll<HTMLButtonElement>("[data-ranking-tab]"),
  );
  const panels = Array.from(
    ranking.querySelectorAll<HTMLElement>("[data-ranking-panel]"),
  );
  wireTabs(tabs, (selected) => {
    paintTabs(tabs, selected);
    for (const panel of panels)
      panel.classList.toggle(
        "hidden",
        panel.dataset.rankingPanel !== selected.dataset.rankingTab,
      );
  });
};

const bindMusicTabs = () => {
  document.querySelectorAll<HTMLElement>("[data-music-tabs]").forEach((root) => {
    const container = root.parentElement;
    const grid = container?.querySelector<HTMLElement>("[data-art-grid]");
    const ranking = container?.querySelector<HTMLElement>(
      "[data-music-panel='ranking']",
    );
    if (!grid || !ranking) return;
    if (claim(root)) {
      const tabs = Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-music-tab]"),
      );
      wireTabs(tabs, (selected) => {
        paintTabs(tabs, selected);
        const musicKind = selected.dataset.musicTab;
        const rankingSelected = musicKind === "ranking";
        grid.classList.toggle("hidden", rankingSelected);
        ranking.classList.toggle("hidden", !rankingSelected);
        if (rankingSelected) return;
        showMatching(
          grid,
          "[data-music-kind]",
          "musicKind",
          "[data-music-empty]",
          "musicEmpty",
          musicKind,
        );
      });
    }
    bindRankingTabs(ranking);
  });
};

const bindCoverFallbacks = () => {
  document
    .querySelectorAll<HTMLImageElement>("[data-art-cover-fallback]")
    .forEach((image) => {
      if (image.dataset.artCoverBound === "true") return;
      image.dataset.artCoverBound = "true";
      image.addEventListener(
        "error",
        () => {
          const fallback = image.dataset.artCoverFallback;
          delete image.dataset.artCoverFallback;
          if (fallback) image.src = fallback;
        },
        { once: true },
      );
    });
  document
    .querySelectorAll<HTMLImageElement>("[data-game-cover]")
    .forEach((image) => {
      if (image.dataset.gameCoverBound === "true") return;
      image.dataset.gameCoverBound = "true";
      image.addEventListener("error", () => {
        const fallback =
          image.dataset.gameCoverFallback ??
          "/images/placeholders/default-cover.webp";
        delete image.dataset.gameCoverFallback;
        if (image.src !== new URL(fallback, location.href).href)
          image.src = fallback;
      });
    });
};

export const bindLifeBehaviors = () => {
  bindScreenTabs();
  bindMusicTabs();
  bindCoverFallbacks();
};
