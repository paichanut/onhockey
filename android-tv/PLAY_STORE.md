# Ice Hockey TV Guide on Google Play

The `play` flavor of this app is **Ice Hockey TV Guide** (`com.paichanut.icehockeytvguide`): the
YouTube-only guide at https://icehockeytvguide.vercel.app (the `/guide` page of this project; on that
domain nothing else is served, see `proxy.js`). It has no onhockey.tv schedule, no sideload download
and no self-update, and its only permission is INTERNET. The `sideload` flavor is the OnHockey Live
APK on onhockey.vercel.app and never goes to Play.

## Build

```bash
cd android-tv
echo "sdk.dir=/path/to/android-sdk" > local.properties   # platform 36, build-tools 36
gradle -PplayStoreFile=/path/upload.jks -PplayStorePassword=… -PplayKeyAlias=upload -PplayKeyPassword=… \
  bundlePlayRelease            # → app/build/outputs/bundle/playRelease/app-play-release.aab
```

The upload key is **not** in this repo. Keep `upload.jks` and its password safe; Play App Signing holds
the real app-signing key, so a lost upload key can be reset from Play Console, but it takes days.
For every update, raise `versionCode` (and `versionName`) in the `play` flavor in `app/build.gradle`.

## Play Console checklist

1. **Create app**: name *Ice Hockey TV Guide*, App, Free, default language English.
2. **App content**
   - Privacy policy: `https://icehockeytvguide.vercel.app/privacy`
   - Ads: **No ads**
   - App access: **All functionality is available without special access**
   - Content rating questionnaire: category *Reference, News, or Educational* (or *Entertainment*);
     answer **No** to violence, sexual content, language, controlled substances, gambling; **No** to
     user interaction / sharing location / digital purchases. Expected: Everyone / PEGI 3.
   - Target audience: **18 and over** (or 13+). Do not pick under-13 ages: the app is not built for
     the Families policy.
   - News app: **No**. Government app: **No**. Financial features: **None**. Health: **None**.
   - Data safety (the app itself stores nothing; the site uses Google Analytics):
     - Data collected: **Yes**. Shared: **No**.
     - *App activity → App interactions* (Analytics), *App info and performance → Diagnostics*
       (Analytics), *Device or other IDs* (Analytics), *Location → Approximate location* (Analytics,
       from IP).
     - Processed ephemerally: No. Required: Yes (no opt-out in the app). Encrypted in transit: **Yes**.
       Users can request deletion: **No** (nothing tied to an account; clearing app storage resets
       the ID).
3. **Store listing** (text below) + graphics: icon 512×512, feature graphic 1024×500, phone screenshots,
   TV banner 1280×720 and TV screenshots (Android TV needs these to appear on Google TV).
4. **Advanced settings → Form factors → Android TV**: add it, opt in, upload the TV banner/screenshots.
   Google reviews TV separately (remote navigation, banner, no touch requirement: all done).
5. **Release**: a personal developer account created after Nov 2023 must run a **closed test with at
   least 12 testers for 14 days** before it can apply for production. Upload the `.aab` to
   *Testing → Closed testing*, add testers' Gmail addresses, share the opt-in link, then apply for
   production when Play allows it.

## Store listing text

**App name** (30): Ice Hockey TV Guide

**Short description** (80): Live and upcoming ice hockey streams from YouTube channels, in one list.

**Full description**:

Never miss a game. Ice Hockey TV Guide gathers the live and scheduled ice hockey streams that
YouTube channels in Thailand, Korea, Taiwan, Southeast Asia and the USA publish (youth tournaments,
club leagues, invitationals) and puts them in one list sorted by start time.

• See what is live right now and what starts next, in your own time zone
• Big thumbnails with the start time, so you can spot your team at a glance
• Filter by country or region
• Tap a game to watch it in the YouTube app
• Add any upcoming game to Google Calendar with one tap
• Works on Android phones and on Google TV with the remote
• The list refreshes by itself every five minutes

All streams are public YouTube live streams that belong to their channels; the app only links to
them. Ice Hockey TV Guide is not affiliated with YouTube or with any league or team.

**Category**: Sports. **Tags**: Sports, Hockey. **Contact email**: your developer email.
