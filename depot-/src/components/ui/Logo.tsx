import { cn } from "../../lib/cn";

export interface LogoProps {
  className?: string;
  alt?: string;
}

export function Logo({ className, alt = "" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      draggable={false}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
