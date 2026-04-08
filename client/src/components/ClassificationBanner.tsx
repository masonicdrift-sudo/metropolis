/**
 * Full-width classification strip — place at top of shell or auth screens.
 */
export function ClassificationBanner() {
  return (
    <div
      role="banner"
      aria-label="Data classification"
      className="shrink-0 w-full z-[60] bg-red-700 border-b border-red-950 shadow-[0_1px_0_rgba(0,0,0,0.35)] pt-[env(safe-area-inset-top,0px)]"
    >
      <div className="py-1.5 px-3 text-center">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-white uppercase [text-shadow:0_1px_0_rgba(0,0,0,0.35)]">
          TOP SECRET // FOR OFFICIAL USE ONLY
        </span>
      </div>
    </div>
  );
}
