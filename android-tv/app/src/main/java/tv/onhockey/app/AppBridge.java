package tv.onhockey.app;

import android.net.Uri;
import android.webkit.JavascriptInterface;

/** window.OnHockeyTV as both builds expose it, used by lib/tv.js on the site. */
class AppBridge {
    protected final MainActivity activity;

    AppBridge(MainActivity activity) {
        this.activity = activity;
    }

    /** Opens a link outside the WebView, e.g. a YouTube video in the YouTube app. */
    @JavascriptInterface
    public boolean openUrl(String url) {
        return activity.openExternal(Uri.parse(url));
    }

    /** True on a TV (remote-control layout); false on a phone or tablet. */
    @JavascriptInterface
    public boolean isTv() {
        return activity.isTelevision();
    }

    @JavascriptInterface
    public String version() {
        return BuildConfig.VERSION_NAME;
    }
}
