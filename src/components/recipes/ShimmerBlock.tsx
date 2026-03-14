"use client";

interface ShimmerBlockProps {
  variant: "rect" | "pill" | "image";
  className?: string;
}

export default function ShimmerBlock({ variant, className = "" }: ShimmerBlockProps) {
  const baseClasses = "shimmer rounded";
  const variantClasses = {
    rect: "h-4 w-12 rounded",
    pill: "h-6 rounded-full",
    image: "aspect-[4/3] w-full rounded-none",
  };

  return (
    <div
      aria-busy="true"
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    />
  );
}
