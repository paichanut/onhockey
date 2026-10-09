# OnHockey Live for Google TV / Android TV

A small Android app that shows https://onhockey.vercel.app full screen on a TV. It is for
sideloading onto your own TV, not for the Play Store (the onhockey.tv streams would not pass
Google Play's policies).

What it adds over opening the site in a TV browser:

- **Schedule without the home server.** The app fetches `onhockey.tv/schedule_table.php` itself
  (from your own home connection, no CORS), via `window.OnHockeyTV` (see `lib/tv.js`). If that
  fails it falls back to the site's `/api/schedule` relay.
- **Remote control.** Arrow keys move between games, chips and stream buttons; OK opens; Back
  closes the open game, then leaves the app.
- **Fullscreen** from the "Fullscreen" button next to Stop; Back exits it.
- Its own tile on the Google TV home screen; the screen stays on while it is open.

The app only wraps the website, so site updates show up without reinstalling.

## Install on the TV

1. On the TV: Settings → System → About → click **Android TV OS build** 7 times to turn on
   developer mode.
2. Install the **Downloader** app (by AFTVnews) from the Play Store.
3. Settings → Apps → Security & restrictions → Unknown sources → turn on **Downloader**.
4. Open Downloader and enter: `https://onhockey.vercel.app/onhockey-tv.apk`
5. Install, then open **OnHockey Live** from Apps (or add it to your favourites row).

Or from a computer on the same network with ADB:

```bash
adb connect <tv-ip>:5555
adb install -r onhockey-tv.apk
```

## Build

Needs JDK 17+, Gradle 8.9+ and the Android SDK (platform 35, build-tools 35).

```bash
cd android-tv
echo "sdk.dir=/path/to/android-sdk" > local.properties
gradle assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../public/onhockey-tv.apk
```

`sideload.keystore` (password `onhockey`) signs every build with the same key, so a new APK
installs over the old one. It is only for sideloading, not a store identity.

Bump `versionCode` / `versionName` in `app/build.gradle` when the app itself changes.
