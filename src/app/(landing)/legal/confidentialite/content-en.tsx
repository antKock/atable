import Link from "next/link";
import type { Metadata } from "next";

// English translation of the privacy policy (Version EN, Lot 3). Editorial
// source of truth stays docs/politique-confidentialite.md (French); this file
// mirrors content-fr.tsx section by section. ⚠ Legal text: reviewed by the
// publisher before the EN launch (Lot 4 checklist).

export const metadataEn: Metadata = {
  title: "Privacy Policy — Mijote",
  description:
    "Privacy policy of the Mijote app. No ads, no tracking, minimal data.",
  alternates: { canonical: "/legal/confidentialite" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy Policy — Mijote",
    description: "Privacy policy of the Mijote app. No ads, no tracking, minimal data.",
    type: "article",
  },
};

const updatedAt = "September 5, 2026";
const contactEmail = "kocken.anthony@gmail.com";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 mb-3 scroll-mt-20 text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 text-base font-semibold text-foreground">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 leading-relaxed text-foreground/90">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="my-3 list-disc space-y-1.5 pl-6 text-foreground/90">{children}</ul>;
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-foreground/15 bg-foreground/5 px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border border-foreground/15 px-3 py-2 align-top text-foreground/90">{children}</td>;
}
const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="underline underline-offset-2">
    {children}
  </a>
);

export default function PrivacyEn() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6 sm:pt-10">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-foreground/70 hover:text-foreground hover:underline">
          ← Back to home
        </Link>
      </nav>

      <article>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-foreground/60">Last updated: {updatedAt}</p>

        <H2 id="qui-sommes-nous">1. Who we are</H2>
        <P>
          Mijote (the &ldquo;App&rdquo;, the &ldquo;Service&rdquo;) is a recipe management and
          meal planning app, available on the web, on the iOS App Store and on Google Play
          (Android).
        </P>
        <P>The data controller is:</P>
        <UL>
          <li>
            <strong>Anthony Kocken</strong>, independent publisher of the App.
          </li>
          <li>
            Contact:{" "}
            <a href={`mailto:${contactEmail}`} className="text-foreground underline underline-offset-2 hover:no-underline">
              {contactEmail}
            </a>
          </li>
          <li>
            App available at:{" "}
            <a href="https://mijote.anthonykocken.fr" className="text-foreground underline underline-offset-2 hover:no-underline">
              https://mijote.anthonykocken.fr
            </a>
          </li>
        </UL>

        <H2 id="approche">2. Our approach: the bare minimum of data</H2>
        <P>
          Mijote is designed to work <strong>without a traditional account</strong>. You don&apos;t need
          to provide <strong>an email address, a name, a phone number or a password</strong>. Access
          is based on the notion of a <strong>cookbook</strong>: a shared recipe collection, opened
          with an <strong>invite code</strong>.
        </P>
        <P>
          Two pieces of information are <strong>optional</strong> and only serve you: a{" "}
          <strong>profile name</strong>, shown to the other members of your cookbooks, and a{" "}
          <strong>recovery email</strong>, used solely to get your cookbooks back if you change
          or lose your device. Without a recovery email, no email is ever sent to you.
        </P>
        <P>We commit to the following principles:</P>
        <UL>
          <li>
            <strong>No advertising, no ad profiling.</strong>
          </li>
          <li>
            <strong>No audience measurement or tracking tools</strong> (no Google Analytics, no
            third-party cookies, no tracking pixels).
          </li>
          <li>
            <strong>No sale or rental</strong> of your data to third parties.
          </li>
          <li>
            <strong>No cross-app or cross-site tracking</strong> (no &ldquo;tracking&rdquo; in the
            App Store sense).
          </li>
        </UL>

        <H2 id="donnees-traitees">3. Data we process</H2>
        <H3>3.1 Data you provide</H3>
        <UL>
          <li>
            <strong>Cookbook name</strong>: the label you choose for your shared cookbook (e.g.
            &ldquo;Marie&apos;s kitchen&rdquo;).
          </li>
          <li>
            <strong>Profile name (optional)</strong>: the name you choose to show to the other
            members of your cookbooks. Without a name, a random alias (e.g. &ldquo;Curious
            Fox&rdquo;), derived from a technical identifier, is shown instead.
          </li>
          <li>
            <strong>Recovery email (optional)</strong>: the address you save in your profile to get
            your cookbooks back on a new device. It is stored as is (lowercased) and is only used
            to send you, at your request, a sign-in link or code (see{" "}
            <A href="#sous-traitants">section 6</A> and <A href="#securite">section 10</A>). You
            can remove it at any time from your profile.
          </li>
          <li>
            <strong>Recipe share link</strong>: when you share a recipe, we generate a unique
            address. Anyone with that link can view the recipe (title, ingredients, steps, photo)
            and save it to their own cookbook, without an account. The link stays valid as long as
            the recipe exists.
          </li>
          <li>
            <strong>Recipe content</strong>: titles, ingredient lists, preparation steps, prep and
            cook times, estimated cost, seasons, tags and photos you add.
          </li>
          <li>
            <strong>Content submitted to import features</strong>: when you import a recipe you
            send us, depending on the method: an <strong>audio recording</strong> (voice
            dictation), one or more <strong>images</strong> (photo or screenshot), or a{" "}
            <strong>web page address</strong> (link). Processing of these is detailed in{" "}
            <A href="#imports-ia">section 5</A>.
          </li>
        </UL>

        <H3>3.2 Data collected automatically</H3>
        <UL>
          <li>
            <strong>Device name</strong>: when a device connects to a cookbook, we derive a
            readable label (e.g. &ldquo;Apple iPhone 15 · Safari&rdquo;) from your browser&apos;s
            technical &ldquo;User-Agent&rdquo; header. It is used for diagnostics and security
            (recognizing a device if you ask us to). The raw header is not kept.
          </li>
          <li>
            <strong>Session metadata</strong>: random technical identifiers (generated
            automatically, unrelated to your real identity) and each device&apos;s last activity date.
          </li>
          <li>
            <strong>IP address</strong>: used <strong>only and temporarily</strong> to limit the
            number of attempts to connect to a cookbook (abuse protection). It{" "}
            <strong>is not stored</strong> in our database and is not linked to your content.
          </li>
          <li>
            <strong>Error reports (crashes)</strong>: in case of a technical error or crash, a
            report is sent to our provider <strong>Sentry</strong> (see{" "}
            <A href="#sous-traitants">section 6</A>). It may contain the error message, device
            type, OS version and a technical session identifier, to diagnose and fix the problem.
            It <strong>does not contain the content of your recipes</strong>.
          </li>
          <li>
            <strong>Memberships and roles</strong>: the list of cookbooks you have access to and
            your role in each (member, or read-only guest).
          </li>
          <li>
            <strong>Internal usage statistics</strong>: to understand how the Service is used, our
            servers record, per connected device, the days of activity and the platform (iOS,
            Android, web), per-recipe counters (number of views, last activity) and daily
            aggregates (number of demo trials, recovery emails sent…). These statistics are
            produced without any third-party tool and contain neither name nor email address.
          </li>
          <li>
            <strong>Language</strong>: the interface is displayed in your device&apos;s language
            (technical &ldquo;Accept-Language&rdquo; header); this information is not kept.
          </li>
        </UL>

        <H3>3.3 Data we do NOT collect</H3>
        <P>
          Unless you enter them voluntarily in your profile (name, recovery email), we collect no
          name or email address. We never collect: phone number, postal address, password,
          location data, health data, banking or payment data, advertising identifiers, contacts,
          browsing history.
        </P>

        <H2 id="finalites">4. Purposes and legal bases of processing</H2>
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Purpose</Th>
              <Th>Legal basis (GDPR)</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Cookbook name, recipes, photos, tags</Td>
              <Td>Providing the service: creating, storing and sharing your recipes in the cookbook</Td>
              <Td>Performance of the contract (the Service&apos;s terms of use)</Td>
            </tr>
            <tr>
              <Td>Invite code, session identifiers, device name, memberships and roles</Td>
              <Td>Authenticating you anonymously and managing device and people access to cookbooks</Td>
              <Td>Performance of the contract</Td>
            </tr>
            <tr>
              <Td>Profile name</Td>
              <Td>Identifying you to the other members of your cookbooks</Td>
              <Td>Performance of the contract (optional information)</Td>
            </tr>
            <tr>
              <Td>Recovery email, sign-in links and codes</Td>
              <Td>Getting your cookbooks back on a new device; merging two accesses into one profile</Td>
              <Td>Performance of the contract (optional feature you enable)</Td>
            </tr>
            <tr>
              <Td>Internal usage statistics</Td>
              <Td>Measuring how the Service is used and improving it</Td>
              <Td>Legitimate interest (improving the Service), without individual profiling</Td>
            </tr>
            <tr>
              <Td>Content submitted to imports (audio, images, URL)</Td>
              <Td>Performing the requested import and structuring the recipe</Td>
              <Td>Performance of the contract (a feature you explicitly trigger)</Td>
            </tr>
            <tr>
              <Td>IP address</Td>
              <Td>Limiting abusive connection attempts</Td>
              <Td>Legitimate interest (security of the Service)</Td>
            </tr>
            <tr>
              <Td>Error reports (crashes)</Td>
              <Td>Diagnosing and fixing malfunctions, improving stability</Td>
              <Td>Legitimate interest (quality and security of the Service)</Td>
            </tr>
          </tbody>
        </Table>

        <H2 id="imports-ia">5. AI-powered imports</H2>
        <P>
          To turn a voice recording, a photo or a web page into a structured recipe, the App uses
          the <strong>OpenAI</strong> service (see <A href="#sous-traitants">section 6</A>).
        </P>
        <UL>
          <li>
            <strong>Voice dictation import</strong>: the audio recording is sent to OpenAI for
            transcription, then the resulting text is structured.{" "}
            <strong>The audio recording is never kept</strong> by Mijote: only the resulting recipe
            text is stored.
          </li>
          <li>
            <strong>Photo / screenshot import</strong>: the image is sent to OpenAI to extract the
            recipe text. <strong>Import images are not kept</strong> by Mijote: only the resulting
            structured recipe is stored. (Photos you <strong>deliberately add</strong> to a recipe,
            on the other hand, are kept — see <A href="#conservation">section 8</A>.)
          </li>
          <li>
            <strong>Link import</strong>: the page&apos;s text content is fetched — directly, or for
            some sources (Instagram, sites blocking automated access) through our provider{" "}
            <strong>Apify</strong> (see <A href="#sous-traitants">section 6</A>), to whom the
            address is sent — then sent to OpenAI for structuring.{" "}
            <strong>The URL and the raw page content are not kept.</strong>
          </li>
        </UL>
        <P>
          These operations only run <strong>when you explicitly use</strong> the corresponding
          import feature.
        </P>

        <H2 id="sous-traitants">6. Hosting and processors</H2>
        <P>
          To operate, the App relies on the following technical providers, acting as{" "}
          <strong>processors</strong> on our behalf:
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th>Role</Th>
              <Th>Data involved</Th>
              <Th>Location</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td><strong>Vercel</strong></Td>
              <Td>Application hosting</Td>
              <Td>Technical request data, logs</Td>
              <Td>European Union (Paris, <code>cdg1</code>)</Td>
            </tr>
            <tr>
              <Td><strong>Supabase</strong></Td>
              <Td>Database and photo storage</Td>
              <Td>Cookbooks, recipes, sessions, photos</Td>
              <Td>European Union (Ireland, <code>eu-west-1</code>)</Td>
            </tr>
            <tr>
              <Td><strong>Upstash</strong></Td>
              <Td>Rate limiting (security)</Td>
              <Td>IP address, session identifiers</Td>
              <Td>United Kingdom (London, <code>eu-west-2</code>)</Td>
            </tr>
            <tr>
              <Td><strong>OpenAI</strong></Td>
              <Td>Audio transcription, image reading, text structuring</Td>
              <Td>Content submitted to imports (<A href="#imports-ia">section 5</A>)</Td>
              <Td>United States</Td>
            </tr>
            <tr>
              <Td><strong>Apify</strong></Td>
              <Td>Fetching web page content during link import (Instagram, sites blocking automated access)</Td>
              <Td>Address of the page to import</Td>
              <Td>United States</Td>
            </tr>
            <tr>
              <Td><strong>Sentry</strong></Td>
              <Td>Error logging and crash reports</Td>
              <Td>Error messages, technical context (device type, OS, session identifier)</Td>
              <Td>United States</Td>
            </tr>
            <tr>
              <Td><strong>Resend</strong></Td>
              <Td>Sending access-recovery emails</Td>
              <Td>Recovery email address, sign-in link and code</Td>
              <Td>United States</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          Regarding <strong>OpenAI</strong>: data sent through their programming interface (API){" "}
          <strong>is not used to train their models</strong> and is retained by OpenAI for a
          limited time (for abuse prevention) before deletion, in accordance with their API data
          processing policy.
        </P>

        <H2 id="transferts">7. Data transfers outside the European Union</H2>
        <P>
          <strong>Vercel</strong> and <strong>Supabase</strong>, which host most of your data,
          operate <strong>within the European Union</strong>. Several processors nevertheless
          process data outside the EU:
        </P>
        <UL>
          <li>
            <strong>OpenAI</strong> (AI imports) operates in the <strong>United States</strong>;
          </li>
          <li>
            <strong>Apify</strong> (link import) operates in the <strong>United States</strong>;
          </li>
          <li>
            <strong>Sentry</strong> (error reports) operates in the <strong>United States</strong>;
          </li>
          <li>
            <strong>Resend</strong> (access-recovery emails) operates in the{" "}
            <strong>United States</strong>;
          </li>
          <li>
            <strong>Upstash</strong> (rate limiting) operates in the <strong>United Kingdom</strong>.
          </li>
        </UL>
        <P>
          These transfers are covered by appropriate safeguards under the GDPR: the European
          Commission&apos;s standard contractual clauses, the UK adequacy decision of June 28, 2021,
          and/or participation in the <em>EU–US Data Privacy Framework</em> for providers
          established in the United States.
        </P>

        <H2 id="conservation">8. Retention periods</H2>
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Retention period</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Cookbook, recipes, photos, device sessions</Td>
              <Td>
                Kept as long as the cookbook exists; deleted when you delete the cookbook (see{" "}
                <A href="#suppression">section 11</A>)
              </Td>
            </tr>
            <tr>
              <Td>Profile name, recovery email</Td>
              <Td>As long as your profile exists; editable or removable at any time from the profile</Td>
            </tr>
            <tr>
              <Td>Sign-in links and codes</Td>
              <Td>15 minutes (stored hashed, 5 attempts max), purged at the latest 24 h after expiry</Td>
            </tr>
            <tr>
              <Td>Session cookie (<code>atable_session</code>)</Td>
              <Td>180 days, extended each time you use the App</Td>
            </tr>
            <tr>
              <Td>IP address (rate limiting)</Td>
              <Td>1 hour maximum</Td>
            </tr>
            <tr>
              <Td>Content submitted to imports, on OpenAI&apos;s side</Td>
              <Td>Limited period set by OpenAI, then deletion</Td>
            </tr>
            <tr>
              <Td>Error reports (Sentry)</Td>
              <Td>Limited period set by Sentry (90 days by default), then deletion</Td>
            </tr>
            <tr>
              <Td>Technical logs (host)</Td>
              <Td>Limited period, for security and diagnostics</Td>
            </tr>
            <tr>
              <Td>Internal usage statistics</Td>
              <Td>Daily aggregates kept without limit; per-device activity days deleted with the cookbook</Td>
            </tr>
            <tr>
              <Td>Demo account</Td>
              <Td>Recipes added in the demo deleted every night; demo identities purged after 30 days</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          No automatic deletion of inactive cookbooks is applied at this time: your recipes remain
          available as long as you don&apos;t delete them.
        </P>

        <H2 id="cookies">9. Cookies and local storage</H2>
        <P>
          The App <strong>uses no advertising or audience-measurement cookies</strong>. No cookie
          consent banner is therefore required.
        </P>
        <UL>
          <li>
            <strong>
              <code>atable_session</code> cookie
            </strong>
            : a cookie <strong>strictly necessary</strong> for the Service to work. It keeps you
            connected to your cookbook. It is secured (inaccessible to JavaScript,
            cryptographically signed, sent over HTTPS only) and lasts 180 days, extended each time
            you use the App.
          </li>
          <li>
            <strong>Browser local storage</strong> (<code>localStorage</code>): used for strictly
            functional purposes — speeding up display through a cache of already-loaded data, and
            keeping a random technical identifier used to organize your photo storage. This
            information stays on your device.
          </li>
        </UL>

        <H2 id="securite">10. Security</H2>
        <P>
          We implement technical measures to protect your data: encrypted exchanges (HTTPS), a
          secured and cryptographically signed session cookie, limits on connection attempts, and
          data access restricted to your cookbook.
        </P>
        <P>
          Sign-in links and codes sent to your recovery email are single-use, valid for 15
          minutes, stored hashed (SHA-256) and limited to 5 attempts.
        </P>
        <P>
          However, <strong>a cookbook&apos;s invite code or link acts as an access key</strong>:
          anyone who has it can open the cookbook — with read and write access through a
          &ldquo;member&rdquo; link, read-only through a &ldquo;guest&rdquo; link. We recommend
          sharing them only with people you trust; any member can remove someone from the cookbook
          at any time.
        </P>

        <H2 id="suppression">11. Deleting your data</H2>
        <P>You stay in control of your data directly from the App:</P>
        <UL>
          <li>
            <strong>Leave a cookbook</strong>: removes your access to that cookbook. Its recipes
            are kept for the other members.
          </li>
          <li>
            <strong>Remove a member</strong>: any member can remove another person from a
            cookbook; their access is cut immediately.
          </li>
          <li>
            <strong>Delete a cookbook</strong>: <strong>permanently</strong> deletes all the
            recipes, tags, device sessions and the cookbook itself.
          </li>
          <li>
            <strong>Delete a recipe</strong>: deletes that recipe and its associated tags.
          </li>
          <li>
            <strong>Remove your recovery email or your name</strong>: from your profile, at any
            time.
          </li>
          <li>
            <strong>Log out</strong>: clears the session on the device in use.
          </li>
        </UL>
        <P>Deleting a cookbook satisfies the requirement of a clear path to delete user data.</P>

        <H2 id="droits">12. Your rights</H2>
        <P>
          Under the GDPR, you have the rights of <strong>access</strong>,{" "}
          <strong>rectification</strong>, <strong>erasure</strong>, <strong>restriction</strong>,{" "}
          <strong>objection</strong> and <strong>portability</strong> of your data.
        </P>
        <UL>
          <li>
            The rights of <strong>rectification</strong> and <strong>erasure</strong> are exercised
            directly in the App (editing or deleting your recipes, deleting the cookbook).
          </li>
          <li>
            For any other request (access, copy of your data, objection), you can contact us at
            the address given in <A href="#qui-sommes-nous">section 1</A>.
          </li>
        </UL>
        <P>
          Since the App doesn&apos;t let us link a cookbook to a real identity (apart from a
          recovery email you may have saved), we may ask you for
          elements establishing that you are indeed a member of the cookbook concerned before
          acting on a request.
        </P>
        <P>
          If you believe your rights are not being respected, you can lodge a complaint with the
          French data protection authority, the{" "}
          <strong>Commission nationale de l&apos;informatique et des libertés (CNIL)</strong> —{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            www.cnil.fr
          </a>
          .
        </P>

        <H2 id="mineurs">13. Minors</H2>
        <P>
          The App is not intended for children and does not knowingly collect data about them. No
          data is requested that would reveal users&apos; age.
        </P>

        <H2 id="modifications">14. Changes to this policy</H2>
        <P>
          This privacy policy may evolve. Any substantial change will be indicated by updating the
          date at the top of this document.
        </P>

        <H2 id="contact">15. Contact</H2>
        <P>
          For any question about this policy or the processing of your data:{" "}
          <a href={`mailto:${contactEmail}`} className="text-foreground underline underline-offset-2 hover:no-underline">
            {contactEmail}
          </a>
          .
        </P>
      </article>
    </main>
  );
}
