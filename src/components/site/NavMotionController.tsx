import { useEffect } from "react"
import { animate } from "motion"
import { useReducedMotion } from "motion/react"
const ease = [0.19, 1, 0.22, 1] as const

export default function NavMotionController() {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const cleanups: Array<() => void> = []
    const switchers = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-switcher]"))

    switchers.forEach((switcher) => {
      const links = Array.from(switcher.querySelectorAll<HTMLElement>("[data-nav-link]"))
      const indicator = switcher.querySelector<HTMLElement>("[data-nav-indicator]")
      if (!links.length || !indicator) return

      const active = () => links.find((link) => link.getAttribute("aria-current") === "page") ?? links[0]
      const moveTo = (link: HTMLElement) => {
        const x = link.offsetLeft
        const width = link.offsetWidth
        switcher.setAttribute("data-ready", "true")

        indicator.style.setProperty("--x", `${x}px`)
        indicator.style.setProperty("--w", `${width}px`)

        if (shouldReduceMotion) {
          indicator.style.transform = `translateX(${x}px)`
          indicator.style.width = `${width}px`
          indicator.style.opacity = "1"
          return
        }

        animate(indicator, { x, width, opacity: 1 }, { duration: 0.28, ease })
      }
      const reset = () => moveTo(active())
      const onFocusOut = () => {
        requestAnimationFrame(() => {
          if (!switcher.contains(document.activeElement)) reset()
        })
      }

      reset()
      window.addEventListener("resize", reset, { passive: true })
      window.addEventListener("spa:nav-sync", reset)
      switcher.addEventListener("pointerleave", reset)
      switcher.addEventListener("focusout", onFocusOut)

      cleanups.push(() => {
        window.removeEventListener("resize", reset)
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
  }, [shouldReduceMotion])

  return null
}
