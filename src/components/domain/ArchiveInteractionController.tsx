import { useEffect } from "react"

type ArchiveView = "grid" | "list"

const getArchiveView = (value: string | null): ArchiveView => (value === "list" ? "list" : "grid")

export default function ArchiveInteractionController() {
  useEffect(() => {
    const cleanups: Array<() => void> = []
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-archive-root]"))

    roots.forEach((root) => {
      const searchInput = root.querySelector<HTMLInputElement>("[data-archive-search]")
      const gridView = root.querySelector<HTMLElement>("[data-archive-grid]")
      const listView = root.querySelector<HTMLElement>("[data-archive-list]")
      const emptyState = root.querySelector<HTMLElement>("[data-archive-empty]")
      const listHead = root.querySelector<HTMLElement>("[data-archive-list-head]")
      const viewSwitcher = root.querySelector<HTMLElement>("[data-archive-view-switcher]")
      const indicator = root.querySelector<HTMLElement>("[data-archive-view-indicator]")
      const viewButtons = Array.from(root.querySelectorAll<HTMLElement>("[data-archive-view]"))
      const allItems = Array.from(root.querySelectorAll<HTMLElement>("[data-archive-item]"))
      const groups = Array.from(root.querySelectorAll<HTMLElement>("[data-archive-group]")).map((element) => ({
        element,
        gridItems: Array.from(element.querySelectorAll<HTMLElement>('[data-archive-item][data-archive-scope="grid"]')),
      }))

      if (!searchInput || !gridView || !listView || !emptyState) return

      let activeView: ArchiveView = "grid"
      const scopeItems: Record<ArchiveView, HTMLElement[]> = {
        grid: allItems.filter((item) => item.getAttribute("data-archive-scope") === "grid"),
        list: allItems.filter((item) => item.getAttribute("data-archive-scope") === "list"),
      }
      const visibleItems = () => scopeItems[activeView].filter((item) => !item.hidden)
      const updateEmptyState = () => emptyState.classList.toggle("hidden", visibleItems().length > 0)
      const dispatchChange = (type: "filter" | "view") => {
        root.dispatchEvent(new CustomEvent("archive-view-change", { detail: { type, view: activeView } }))
      }
      const moveIndicator = () => {
        const activeButton = viewButtons.find((button) => getArchiveView(button.getAttribute("data-archive-view")) === activeView)
        if (!activeButton || !indicator || !viewSwitcher) return

        indicator.style.transform = `translateX(${activeButton.offsetLeft}px)`
        indicator.style.width = `${activeButton.offsetWidth}px`
        indicator.style.opacity = "1"
        viewSwitcher.setAttribute("data-ready", "true")
      }
      const applyFilter = () => {
        const query = searchInput.value.trim().toLowerCase()

        allItems.forEach((item) => {
          const keywords = (item.getAttribute("data-archive-keywords") ?? "").toLowerCase()
          item.hidden = !(query.length === 0 || keywords.includes(query))
        })

        groups.forEach((group) => {
          group.element.toggleAttribute("hidden", !group.gridItems.some((item) => !item.hidden))
        })

        listHead?.classList.toggle("hidden", !scopeItems.list.some((item) => !item.hidden))
        updateEmptyState()
        dispatchChange("filter")
      }
      const setView = (view: ArchiveView) => {
        activeView = view
        gridView.classList.toggle("hidden", activeView !== "grid")
        listView.classList.toggle("hidden", activeView !== "list")

        viewButtons.forEach((button) => {
          const isActive = getArchiveView(button.getAttribute("data-archive-view")) === activeView
          button.classList.toggle("is-active", isActive)
          button.setAttribute("aria-pressed", String(isActive))
        })

        moveIndicator()
        updateEmptyState()
        dispatchChange("view")
      }
      const onSearchInput = () => applyFilter()
      const onResize = () => moveIndicator()

      viewButtons.forEach((button) => {
        const onClick = () => setView(getArchiveView(button.getAttribute("data-archive-view")))
        button.addEventListener("click", onClick)
        cleanups.push(() => button.removeEventListener("click", onClick))
      })

      searchInput.addEventListener("input", onSearchInput)
      window.addEventListener("resize", onResize, { passive: true })
      cleanups.push(() => {
        searchInput.removeEventListener("input", onSearchInput)
        window.removeEventListener("resize", onResize)
      })

      setView("grid")
      applyFilter()
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  return null
}
