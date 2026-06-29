import { NextResponse } from "next/server";

// Android Digital Asset Links — served at /.well-known/assetlinks.json via a
// rewrite in next.config.ts (so the content-type is application/json and no
// auth/middleware applies). Declares that this site's /r/* and /join/* links
// belong to the Mijote Android app, enabling App Links (open the app instead
// of Chrome). This is the Android counterpart of src/app/api/aasa/route.ts.
const PACKAGE_NAME = "fr.anthonykocken.mijote";

// SHA-256 fingerprints allowed to handle Mijote's App Links. This is public
// data (the statement is served publicly and the certs are immutable), so the
// production values are hardcoded as the default — exactly like the iOS AASA
// route hardcodes DEFAULT_APP_ID. ANDROID_CERT_SHA256 (comma-separated) can
// still override if the keys ever change.
//   [0] Play App Signing key — Google re-signs every Play Store install with
//       this, so it's the one that matters for shipped builds.
//   [1] Upload key (our keystore) — for builds installed directly / sideloaded.
const DEFAULT_FINGERPRINTS = [
  "13:5D:49:7D:08:B8:D2:18:71:7D:12:40:5E:4D:C4:F9:9C:2E:89:21:D2:A9:E1:A8:7C:40:12:FE:17:D0:06:10",
  "B9:83:02:E0:E5:38:66:85:E2:F3:27:82:40:07:94:ED:E1:D7:E0:97:06:78:EA:8D:9A:EC:AE:FB:32:8A:77:5E",
];

export function GET() {
  const override = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fingerprints = override.length ? override : DEFAULT_FINGERPRINTS;

  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
