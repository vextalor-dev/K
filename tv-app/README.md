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
- The signing keystore password is a placeholder; the keystore is generated
  once in CI and cached. If you want a release-grade key, generate one and
  store it in GitHub Secrets (`KEYSTORE_PATH`/`KEYSTORE_PASSWORD`/`KEY_ALIAS`/
  `KEY_PASSWORD`).
