import { NextResponse } from "next/server";

// Apple App Site Association — served at /.well-known/apple-app-site-association
// via a rewrite in next.config.ts (so the content-type is application/json and
// no auth/middleware applies). Declares that this site's /r/* links belong to
// the Mijote app, enabling Universal Links (open the app instead of Safari).
//
// appID is "<TeamID>.<bundleId>". Both parts are public (the AASA itself is
// served publicly) and the bundle id is immutable, so the production value is
// the default; APPLE_APP_ID can still override it if the team ever changes.
const DEFAULT_APP_ID = "7H527R9HJJ.fr.anthonykocken.mijote";

export function GET() {
  const appID = process.env.APPLE_APP_ID || DEFAULT_APP_ID;
  const appIDs = [appID];

  return NextResponse.json({
    applinks: {
      details: [
        {
          appIDs,
          components: [{ "/": "/r/*", comment: "Shared recipe links" }],
        },
      ],
    },
  });
}
