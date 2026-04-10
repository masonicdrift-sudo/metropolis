/**
 * Full-width classification strip — place at top of shell or auth screens.
 * Fixed to the viewport top so it stays visible while the page scrolls; pair with
 * ClassificationBannerSpacer where layout needs offset for the reserved height.
 */
export function ClassificationBanner() {
  return (
    <div
      role="banner"
      aria-label="Data classification"
      className="fixed top-0 left-0 right-0 shrink-0 w-full z-[60] border-b border-black/20 shadow-[0_1px_0_rgba(0,0,0,0.2)] pt-[env(safe-area-inset-top,0px)]"
      style={{ backgroundColor: "#fce83a" }}
    >
      <div className="py-1.5 px-3 text-center">
        <span
          className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-black uppercase"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          TOP SECRET // SCI // ARMA USE ONLY
        </span>
      </div>
    </div>
  );
}

/** Reserves vertical space equal to ClassificationBanner + safe-area so content is not covered. */
export function ClassificationBannerSpacer() {
  return (
    <div
      className="shrink-0 w-full pointer-events-none h-[calc(2.5rem+env(safe-area-inset-top,0px))]"
      aria-hidden
    />
  );
}
