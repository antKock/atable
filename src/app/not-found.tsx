import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-muted-foreground">{t.notFound.body}</p>
      <Link href="/" className="text-sm text-accent underline underline-offset-4">
        {t.notFound.backToLanding}
      </Link>
    </div>
  );
}
