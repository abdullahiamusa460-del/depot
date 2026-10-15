import { useState } from "react";
import { cn } from "../../lib/cn";
import { initials } from "../../lib/format";

const gradients = [
  "from-rose-500 to-orange-400",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-violet-500 to-fuchsia-400",
  "from-amber-500 to-yellow-400",
  "from-blue-500 to-indigo-400",
  "from-teal-500 to-green-400",
  "from-pink-500 to-rose-400",
];

const sizeClasses = {
  sm: "h-10 w-10 rounded-lg text-xs",
  md: "h-14 w-14 rounded-xl text-sm",
  lg: "h-20 w-20 rounded-2xl text-lg",
  xl: "h-28 w-28 rounded-2xl text-2xl",
};

function hashIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

export interface ProductThumbProps {
  name: string;
  image?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function ProductThumb({
  name,
  image,
  size = "md",
  className,
}: ProductThumbProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (image && failedSrc !== image) {
    return (
      <img
        src={image}
        alt={name}
        loading="lazy"
        onError={() => setFailedSrc(image)}
        className={cn(
          "shrink-0 object-cover ring-1 ring-border",
          sizeClasses[size],
          className,
        )}
      />
    );
  }
  const gradient = gradients[hashIndex(name, gradients.length)];
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-xs",
        gradient,
        sizeClasses[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
