import { NextResponse } from "next/server";

// Apple App Site Association — served at /.well-known/apple-app-site-association
// via a rewrite in next.config.ts (so the content-type is application/json and
// no auth/middleware applies). Declares that this site's /r/* links belong to
// the Mijote app, enabling Universal Links (open the app instead of Safari).
//
// APPLE_APP_ID must be "<TeamID>.fr.anthonykocken.mijote" (set in Vercel env,
// prod + staging). Without it we serve an empty association rather than a
// broken one.
export function GET() {
  const appID = process.env.APPLE_APP_ID;
  const appIDs = appID ? [appID] : [];

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
