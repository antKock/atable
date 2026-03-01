import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-muted-foreground">Cette page n&apos;existe pas.</p>
      <Link href="/" className="text-sm text-accent underline underline-offset-4">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
