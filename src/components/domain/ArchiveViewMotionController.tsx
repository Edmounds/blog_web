import { useEffect } from "react"
import { animate, stagger } from "motion"
import { useReducedMotion } from "motion/react"

const ease = [0.22, 1, 0.36, 1] as const

type ArchiveView = "grid" | "list"

type ArchiveChangeEvent = CustomEvent<{ view?: ArchiveView }>

export default function ArchiveViewMotionController() {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const cleanups: Array<() => void> = []
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-archive-root]"))

    roots.forEach((root) => {
      const viewSwitcher = root.querySelector<HTMLElement>("[data-archive-view-switcher]")
      const indicator = root.querySelector<HTMLElement>("[data-archive-view-indicator]")
      const viewButtons = Array.from(root.querySelectorAll<HTMLElement>("[data-archive-view]"))
      const allItems = Array.from(root.querySelectorAll<HTMLElement>("[data-archive-item]"))
      const gridView = root.querySelector<HTMLElement>("[data-archive-grid]")
      const listView = root.querySelector<HTMLElement>("[data-archive-list]")
      const scopeItems: Record<ArchiveView, HTMLElement[]> = {
        grid: allItems.filter((item) => item.getAttribute("data-archive-scope") === "grid"),
        list: allItems.filter((item) => item.getAttribute("data-archive-scope") === "list"),
      }
      const getInitialActiveView = (): ArchiveView => {
        const activeButton = viewButtons.find(
          (button) => button.getAttribute("aria-pressed") === "true" || button.classList.contains("is-active")
        )
        const activeButtonView = activeButton?.getAttribute("data-archive-view")

        if (activeButtonView === "list") return "list"
        if (activeButtonView === "grid") return "grid"
        if (listView && !listView.classList.contains("hidden")) return "list"
        if (gridView?.classList.contains("hidden")) return "list"

        return "grid"
      }

      let activeView: ArchiveView = getInitialActiveView()
      let isReady = false

      const visibleItems = () => scopeItems[activeView].filter((item) => !item.hidden)
      const animateItems = () => {
        const items = visibleItems()
        if (shouldReduceMotion || !items.length) return

        animate(items, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, delay: stagger(0.035), ease })
      }
      const moveIndicator = () => {
        const activeButton = viewButtons.find((button) => button.getAttribute("data-archive-view") === activeView)
        if (!activeButton || !indicator || !viewSwitcher) return

        const x = activeButton.offsetLeft
        const width = activeButton.offsetWidth
        viewSwitcher.setAttribute("data-ready", "true")

        if (shouldReduceMotion) {
          indicator.style.transform = `translateX(${x}px)`
          indicator.style.width = `${width}px`
          indicator.style.opacity = "1"
          return
        }

        animate(indicator, { x, width, opacity: 1 }, { duration: 0.28, ease })
      }
      const onArchiveChange = (event: Event) => {
        activeView = (event as ArchiveChangeEvent).detail?.view === "list" ? "list" : "grid"
        moveIndicator()

        if (isReady) {
          animateItems()
        }
      }
      const onResize = () => moveIndicator()

      root.addEventListener("archive-view-change", onArchiveChange)
      window.addEventListener("resize", onResize, { passive: true })
      cleanups.push(() => {
        root.removeEventListener("archive-view-change", onArchiveChange)
        window.removeEventListener("resize", onResize)
      })

      moveIndicator()
      requestAnimationFrame(() => {
        isReady = true
      })
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [shouldReduceMotion])

  return null
}
