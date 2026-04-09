import { useState } from "react";
import { cn } from "@/lib/utils";

const placeholder = `${import.meta.env.BASE_URL}awards/ribbon-placeholder.svg`;

type Props = {
  imageUrl?: string | null;
  alt: string;
  className?: string;
};

/** Ribbon thumbnail with Wikimedia or local fallback. */
export function AwardRibbonImage({ imageUrl, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const src = failed || !imageUrl?.trim() ? placeholder : imageUrl.trim();
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "h-7 w-[105px] max-w-full object-cover rounded-sm border border-border/60 bg-background/80 shrink-0",
        className,
      )}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
