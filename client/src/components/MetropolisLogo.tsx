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
}: {
  className?: string;
  size?: MetropolisLogoSize;
  /** Visually hidden label for a11y when the image is decorative in context */
  title?: string;
}) {
  return (
    <img
      src="/metropolis-logo.png"
      alt={title}
      width={400}
      height={160}
      className={cn("w-auto object-contain object-left", sizeClass[size], className)}
      decoding="async"
    />
  );
}
