import { cn } from "@/lib/utils";

const sizeClass = {
  /** Mobile chrome / tight rows */
  xs: "h-6 max-h-6",
  /** Sidebar compact, top bar */
  sm: "h-8 max-h-8",
  /** Default shell */
  md: "h-10 max-h-10",
  /** Login / register */
  lg: "h-16 max-h-16 sm:h-[4.5rem] sm:max-h-[4.5rem]",
} as const;

export type MetropolisLogoSize = keyof typeof sizeClass;

/**
 * Official Metropolis wordmark (PNG from `/metropolis-logo.png`).
 * Keep in `client/public/metropolis-logo.png` for Vite to serve at `/metropolis-logo.png`.
 */
export function MetropolisLogo({
  className,
  size = "md",
  title = "Metropolis",
  showText = false,
  textLayout = "stack",
}: {
  className?: string;
  size?: MetropolisLogoSize;
  /** Visually hidden label for a11y when the image is decorative in context */
  title?: string;
  /** Show “Metropolis” as visible text next to or under the mark */
  showText?: boolean;
  /** `stack` = below the image; `inline` = beside (e.g. mobile top bar) */
  textLayout?: "stack" | "inline";
}) {
  const wordmark = (
    <span
      className={cn(
        "font-bold text-blue-300/95 tracking-[0.14em] whitespace-nowrap shrink-0",
        textLayout === "inline" ? "text-[10px] leading-none" : "text-[11px] mt-0.5",
      )}
      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
    >
      Metropolis
    </span>
  );

  const img = (
    <img
      src="/metropolis-logo.png"
      alt={showText ? "" : title}
      role={showText ? "presentation" : undefined}
      width={400}
      height={160}
      className={cn("w-auto object-contain object-left", sizeClass[size], !showText && className)}
      decoding="async"
    />
  );

  if (!showText) {
    return img;
  }

  return (
    <div
      className={cn(
        textLayout === "inline" ? "flex items-center gap-2 min-w-0" : "flex flex-col items-stretch gap-0.5",
        className,
      )}
    >
      {img}
      {wordmark}
    </div>
  );
}
