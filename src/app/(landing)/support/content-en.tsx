import Link from "next/link";
import type { Metadata } from "next";

// English version of the support page (Version EN, Lot 3). Mirrors
// content-fr.tsx section by section — keep both in sync.

export const metadataEn: Metadata = {
  title: "Support — Mijote",
  description:
    "Help and contact for the Mijote app. How to import a recipe, share a cookbook, delete your data.",
  alternates: { canonical: "/support" },
  robots: { index: true, follow: true },
};

const contactEmail = "kocken.anthony@gmail.com";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 mb-3 scroll-mt-20 text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 leading-relaxed text-foreground/90">{children}</p>;
}

function FAQ({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group my-2 rounded-xl border border-foreground/10 bg-background/50 p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-base font-medium text-foreground">
        {question}
        <span aria-hidden="true" className="text-foreground/40 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">{children}</div>
    </details>
  );
}

export default function SupportEn() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6 sm:pt-10">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-foreground/70 hover:text-foreground hover:underline">
          ← Back to home
        </Link>
      </nav>

      <article>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Support</h1>
        <p className="mt-2 text-foreground/70">
          A question, a bug, an idea? The best way to reach us is by email. We usually reply
          within 2 business days.
        </p>

        <H2 id="contact">Write to us</H2>
        <P>
          For any request — help, bug report, suggestion, exercising your privacy rights:{" "}
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent("Mijote support")}`}
            className="text-foreground underline underline-offset-2 hover:no-underline"
          >
            {contactEmail}
          </a>
          .
        </P>
        <P>To help us diagnose, please include in your message:</P>
        <ul className="my-3 list-disc space-y-1 pl-6 text-foreground/90">
          <li>Your device model (iPhone, browser).</li>
          <li>What you were trying to do.</li>
          <li>What you see on screen (a screenshot if possible).</li>
        </ul>

        <H2 id="faq">Frequently asked questions</H2>

        <FAQ question="How do I add a recipe?">
          <p>
            From the home screen, tap the <strong>+ Add</strong> button. Three options:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Photo / screenshot</strong> — the AI extracts the title, ingredients and
              steps.
            </li>
            <li>
              <strong>Voice dictation</strong> — you talk, we transcribe and structure it.
            </li>
            <li>
              <strong>Link</strong> — paste the address of a cooking blog, we fetch it and shape
              it up.
            </li>
          </ul>
          <p>
            The recipe appears right away; enrichment (tags, times, generated image) happens in
            the background.
          </p>
        </FAQ>

        <FAQ question="How do I share my cookbook with my family?">
          <p>
            Open <strong>Cookbook &amp; profile</strong> from Home, pick the cookbook, then{" "}
            <strong>Invite someone</strong>. Two links to choose from: <strong>member</strong>{" "}
            (views and edits recipes) or <strong>guest</strong> (read-only, live). The{" "}
            <strong>invite code</strong> (e.g. <code>THYME-0421</code>) works too: the person
            enters it on the app&apos;s home screen.
          </p>
          <p>
            ⚠️ A link or code acts as an access key: only share it with people you trust. Any
            member can remove someone from the cookbook at any time from the members list.
          </p>
        </FAQ>

        <FAQ question="How do I get my cookbook back on a new device?">
          <p>
            If you saved a <strong>recovery email</strong> in your profile: on the home screen,{" "}
            <strong>Open a cookbook → Recover with my email</strong>. You receive a link (or a
            6-digit code) valid for 15 minutes that reconnects your cookbooks — no password, no
            account.
          </p>
          <p>
            Otherwise, ask a member of the cookbook for the <strong>invite code</strong> (visible
            in <strong>Cookbook &amp; profile</strong>). If you were alone, with no recovery email
            and no device still connected, the cookbook unfortunately can&apos;t be recovered:
            that&apos;s the flip side of anonymous sign-in. Consider saving a recovery email — it
            is used for nothing else.
          </p>
        </FAQ>

        <FAQ question="My recipe import didn't work, what can I do?">
          <p>AI import can fail in a few cases:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Blurry photo or tiny text</strong> — get closer, take several shots.
            </li>
            <li>
              <strong>Protected web page</strong> (paywall, heavy JavaScript) — copy the recipe
              text and type it in manually.
            </li>
            <li>
              <strong>Voice dictation in a noisy place</strong> — try again somewhere quiet.
            </li>
          </ul>
          <p>
            As a last resort, you can create the recipe manually from{" "}
            <strong>+ Add → Type it in</strong>.
          </p>
        </FAQ>

        <FAQ question="How do I delete my data?">
          <p>You have full control from the app:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Delete a recipe</strong>: from its page, menu&nbsp;…&nbsp;→ Delete.
            </li>
            <li>
              <strong>Leave the cookbook</strong>: removes your access to that cookbook. The
              recipes stay for the other members.
            </li>
            <li>
              <strong>Remove your recovery email or your name</strong>: from{" "}
              <strong>Cookbook &amp; profile → You</strong>, at any time.
            </li>
            <li>
              <strong>Delete the cookbook</strong>: <strong>permanently</strong> deletes all the
              recipes, tags, sessions and the cookbook itself. Double confirmation, irreversible.
            </li>
          </ul>
          <p>
            For any other privacy request (access, copy, portability), contact us by email at the
            address above.
          </p>
        </FAQ>

        <FAQ question="Is the app free?">
          <p>
            Yes. No ads, no in-app purchases, no subscription. The app is funded by its independent
            developer.
          </p>
        </FAQ>

        <FAQ question="Is there a web version?">
          <p>
            Yes — the app is first and foremost a responsive website available at{" "}
            <a href="https://mijote.anthonykocken.fr" className="underline underline-offset-2">
              mijote.anthonykocken.fr
            </a>
            . You can use it from any browser and add it to your phone&apos;s home screen (PWA mode).
          </p>
        </FAQ>

        <H2 id="legal">Legal and privacy</H2>
        <P>
          Full privacy policy:{" "}
          <Link
            href="/legal/confidentialite"
            className="text-foreground underline underline-offset-2 hover:no-underline"
          >
            /legal/confidentialite
          </Link>
          .
        </P>
        <P>
          Publisher: Anthony Kocken, independent developer. Contact:{" "}
          <a href={`mailto:${contactEmail}`} className="text-foreground underline underline-offset-2 hover:no-underline">
            {contactEmail}
          </a>
          .
        </P>
      </article>
    </main>
  );
}
