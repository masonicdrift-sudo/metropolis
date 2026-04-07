import * as React from "react"

/** Shell + compact CSS: tablets in portrait, phones; avoids “rotate for layout” on ~768–1024px. */
const MOBILE_BREAKPOINT = 1024
/** Landscape phones are often wide but short — still need compact chrome. */
const COMPACT_MAX_HEIGHT = 520
const COMPACT_MAX_WIDTH = 1100

export function matchesMobileShell(): boolean {
  if (typeof window === "undefined") return false
  const w = window.innerWidth
  const h = window.innerHeight
  if (w < MOBILE_BREAKPOINT) return true
  if (h <= COMPACT_MAX_HEIGHT && w <= COMPACT_MAX_WIDTH) return true
  return false
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? matchesMobileShell() : false
  )

  React.useLayoutEffect(() => {
    const update = () => setIsMobile(matchesMobileShell())
    update()
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", update)
    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)
    return () => {
      mql.removeEventListener("change", update)
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
    }
  }, [])

  return isMobile
}
