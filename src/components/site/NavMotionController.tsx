import { useEffect } from "react"

export default function NavMotionController() {
  useEffect(() => {
    const cleanups: Array<() => void> = []
    const switchers = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-switcher]"))

    switchers.forEach((switcher) => {
      const links = Array.from(switcher.querySelectorAll<HTMLElement>("[data-nav-link], [data-nav-dropdown-trigger]"))
      const indicator = switcher.querySelector<HTMLElement>("[data-nav-indicator]")
      if (!links.length || !indicator) return

      const visibleLinks = () => links.filter((link) => link.getClientRects().length > 0)
      const active = () => {
        const visible = visibleLinks()
        const activeLink = visible.find((link) => link.getAttribute("aria-current") === "page")
        if (activeLink?.getAttribute("role") === "menuitem") {
          return activeLink.closest<HTMLElement>("[data-nav-dropdown]")?.querySelector<HTMLElement>("[data-nav-dropdown-trigger]") ?? activeLink
        }
        return activeLink ?? visible[0] ?? links[0]
      }
      const scrollContainer = switcher.closest<HTMLElement>("[data-mobile-nav-scroll]")
      
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

      const scrollActiveIntoView = () => {
        const activeLink = active()
        if (!scrollContainer || !activeLink) return

        const linkLeft = activeLink.offsetLeft
        const linkRight = linkLeft + activeLink.offsetWidth
        const visibleLeft = scrollContainer.scrollLeft
        const visibleRight = visibleLeft + scrollContainer.clientWidth

        if (linkLeft < visibleLeft) {
          scrollContainer.scrollTo({ left: linkLeft, behavior: "smooth" })
        } else if (linkRight > visibleRight) {
          scrollContainer.scrollTo({ left: linkRight - scrollContainer.clientWidth, behavior: "smooth" })
        }
      }

      const reset = () => {
        moveTo(active())
        requestAnimationFrame(scrollActiveIntoView)
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
      window.addEventListener("popstate", reset)
      document.addEventListener("astro:page-load", reset)
      switcher.addEventListener("pointerleave", reset)
      switcher.addEventListener("focusout", onFocusOut)

      cleanups.push(() => {
        resizeObserver.disconnect()
        window.removeEventListener("spa:nav-sync", reset)
        window.removeEventListener("popstate", reset)
        document.removeEventListener("astro:page-load", reset)
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
