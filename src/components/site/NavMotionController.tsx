import { useEffect } from "react"

export default function NavMotionController() {
  useEffect(() => {
    const cleanups: Array<() => void> = []
    const switchers = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-switcher]"))

    switchers.forEach((switcher) => {
      const links = Array.from(switcher.querySelectorAll<HTMLElement>("[data-nav-link]"))
      const indicator = switcher.querySelector<HTMLElement>("[data-nav-indicator]")
      if (!links.length || !indicator) return

      const active = () => links.find((link) => link.getAttribute("aria-current") === "page") ?? links[0]
      
      let currentTarget: HTMLElement = active()

      const moveTo = (link: HTMLElement) => {
        currentTarget = link
        const linkRect = link.getBoundingClientRect()
        const switcherRect = switcher.getBoundingClientRect()
        const x = linkRect.left - switcherRect.left
        const width = linkRect.width
        switcher.setAttribute("data-ready", "true")

        indicator.style.setProperty("--x", `${x}px`)
        indicator.style.setProperty("--w", `${width}px`)
      }

      const updateActiveGroup = () => {
        const activeLink = active()
        const parentGroup = activeLink.getAttribute("data-parent")
        const href = activeLink.getAttribute("href") || ""

        if (parentGroup === "content" || href.startsWith("/blogs") || href.startsWith("/blog") || href.startsWith("/projects")) {
          switcher.setAttribute("data-active-group", "content")
        } else if (parentGroup === "art" || href.startsWith("/art")) {
          switcher.setAttribute("data-active-group", "art")
        } else {
          switcher.setAttribute("data-active-group", "none")
        }
      }

      const reset = () => {
        updateActiveGroup()
        moveTo(active())
      }
      const onFocusOut = () => {
        requestAnimationFrame(() => {
          if (!switcher.contains(document.activeElement)) reset()
        })
      }

      // Initialize positioning
      reset()

      // Set up ResizeObserver to handle layout shifts dynamically
      const resizeObserver = new ResizeObserver(() => {
        moveTo(currentTarget)
      })
      resizeObserver.observe(switcher)

      window.addEventListener("spa:nav-sync", reset)
      switcher.addEventListener("pointerleave", reset)
      switcher.addEventListener("focusout", onFocusOut)

      cleanups.push(() => {
        resizeObserver.disconnect()
        window.removeEventListener("spa:nav-sync", reset)
        switcher.removeEventListener("pointerleave", reset)
        switcher.removeEventListener("focusout", onFocusOut)
      })

      links.forEach((link) => {
        const onPointerEnter = () => moveTo(link)
        const onFocus = () => moveTo(link)

        link.addEventListener("pointerenter", onPointerEnter)
        link.addEventListener("focus", onFocus)

        cleanups.push(() => {
          link.removeEventListener("pointerenter", onPointerEnter)
          link.removeEventListener("focus", onFocus)
        })
      })
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  return null
}
