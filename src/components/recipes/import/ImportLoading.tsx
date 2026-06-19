import { Loader2 } from "lucide-react";

// Full-screen loading shown while any recipe import is in flight — whether the
// user typed a URL, picked a screenshot, dictated, or arrived from the iOS
// share sheet (mijote://import). Replaces the import cards for the duration.
export default function ImportLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-5 text-center">
      <Loader2 size={36} className="animate-spin text-accent" />
      <p className="text-[15px] text-muted-foreground">{message}</p>
    </div>
  );
}
