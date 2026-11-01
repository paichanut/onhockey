package tv.onhockey.app;

import android.content.Intent;

/** Play Store Ice Hockey TV Guide build: the YouTube-only guide, updated through Google Play. */
final class Flavor {
    private Flavor() {}

    static Object bridge(MainActivity activity) {
        return new AppBridge(activity);
    }

    static void onCreate(MainActivity activity) {}

    static void onResume(MainActivity activity) {}

    static void onNewIntent(MainActivity activity, Intent intent) {}
}
