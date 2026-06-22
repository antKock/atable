import { NextResponse } from "next/server";

// Android Digital Asset Links — served at /.well-known/assetlinks.json via a
// rewrite in next.config.ts (so the content-type is application/json and no
// auth/middleware applies). Declares that this site's /r/* and /join/* links
// belong to the Mijote Android app, enabling App Links (open the app instead
// of Chrome). This is the Android counterpart of src/app/api/aasa/route.ts.
//
// The fingerprint is the SHA-256 shown by Google Play App Signing in the Play
// Console (Setup → App signing) once the app exists there. Set it via
// ANDROID_CERT_SHA256 (comma-separated to list several, e.g. the Play upload
// key + app signing key). Until it's set we return an empty array so App Links
// verification stays inert rather than asserting a wrong fingerprint.
const PACKAGE_NAME = "fr.anthonykocken.mijote";

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return NextResponse.json(
    fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE_NAME,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [],
  );
}
