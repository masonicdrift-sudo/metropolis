import * as React from "react"

const MOBILE_BREAKPOINT = 768
/** Landscape phones are often wider than 768px but still need compact chrome. */
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
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
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

  return !!isMobile
}
