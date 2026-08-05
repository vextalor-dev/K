# K TV Android App

A minimal Android TV WebView wrapper that loads the K streaming site
(`https://potato-ashy.vercel.app/`). Built for sideloading on Android TV boxes.

## Build the APK

The APK is built automatically by GitHub Actions whenever `tv-app/` changes,
or manually from the **Actions** tab ("Build TV APK" → "Run workflow").

1. Push a commit touching `tv-app/` (or run the workflow manually).
2. Open the workflow run → **Artifacts** → download `k-tv-release-apk`.
3. Install the `.apk` on the TV (allow unknown sources).

The release APK is signed with a keystore cached in GitHub Actions, so
updates keep the same signature (no need to uninstall between versions).

## What it does

- Loads the hosted site in a WebView with JavaScript, DOM storage, and
  media autoplay enabled.
- Landscape lock + immersive fullscreen (hides TV system bars).
- Back button navigates in-page; press Back on the home screen to exit.
- Fullscreen HTML5 video works via the WebChromeClient custom-view hook.

## Change the URL

Edit `HOME_URL` in
`tv-app/app/src/main/java/com/kapp/tv/MainActivity.java`, then push.

## Notes

- `minSdk 21` / `targetSdk 34`, leanback declared as a required feature.
- Signing credentials are read from GitHub Secrets
  (`KEYSTORE_PATH`/`KEYSTORE_PASSWORD`/`KEY_ALIAS`/`KEY_PASSWORD`) and only
  fall back to the placeholder when those are unset — set real values before
  the repo goes public. The keystore is generated once and cached in GitHub
  Actions, so updates keep the same signature.
- **Before each release, bump `versionCode`** (and `versionName`) in
  `tv-app/app/build.gradle` — Android will refuse to install a rebuild that
  keeps the same `versionCode`. Keep `public/js/config.js`'s `APK.version` in
  sync so the site re-offers the new APK.
