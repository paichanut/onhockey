package tv.onhockey.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

/**
 * Shows the site full screen and adds what a TV or phone app needs: Back handling, fullscreen
 * video and the window.OnHockeyTV bridge. What differs between the sideloaded OnHockey Live
 * build and the Play Store Ice Hockey TV Guide build lives in each flavor's Flavor class.
 */
public class MainActivity extends Activity {
    private FrameLayout root;
    WebView web;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private WebChromeClient chrome;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0B1220"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B1220"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        // Android 15+ draws apps edge to edge: keep the page clear of the navigation and status bars.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // The sideloaded build plays third-party stream pages, some of which mix http into https.
        s.setMixedContentMode(BuildConfig.KEEP_ON_SITE ? WebSettings.MIXED_CONTENT_NEVER_ALLOW : WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString() + " " + BuildConfig.UA_TAG + "/" + BuildConfig.VERSION_NAME);

        web.addJavascriptInterface(Flavor.bridge(this), "OnHockeyTV");
        final String siteHost = Uri.parse(BuildConfig.SITE_URL).getHost();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                if (!"http".equals(scheme) && !"https".equals(scheme)) return true; // intent://, market:// …
                if (!request.isForMainFrame()) return false;
                // YouTube goes to the YouTube app; it plays far better there than in a WebView.
                if (isYouTube(url) && openExternal(url)) return true;
                // The Play build keeps the WebView on its own site; other pages open in the browser.
                if (BuildConfig.KEEP_ON_SITE && !siteHost.equals(url.getHost())) {
                    openExternal(url);
                    return true;
                }
                return false;
            }
        });
        chrome = new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
                view.requestFocus();
            }

            @Override
            public void onHideCustomView() {
                if (fullscreenView == null) return;
                root.removeView(fullscreenView);
                fullscreenView = null;
                web.setVisibility(View.VISIBLE);
                web.requestFocus();
                if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
                fullscreenCallback = null;
            }
        };
        web.setWebChromeClient(chrome);

        // Android 13+ delivers Back (gesture or remote) through this callback instead of key events.
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            // TVs get the remote-control layout; phones get the normal one.
            web.loadUrl(BuildConfig.SITE_URL + (isTelevision() ? "?tv=1" : "?app=1"));
        }
        web.requestFocus();
        Flavor.onCreate(this);
    }

    boolean isTelevision() {
        UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        return (ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION)
                || getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK);
    }

    private static boolean isYouTube(Uri url) {
        String host = url.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        boolean youtube = host.equals("youtu.be") || host.equals("youtube.com") || host.endsWith(".youtube.com");
        return youtube && (url.getPath() == null || !url.getPath().startsWith("/embed/"));
    }

    /** Opens a link in whichever app handles it (the YouTube app for YouTube links). */
    boolean openExternal(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Flavor.onNewIntent(this, intent);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Before Android 13, Back arrives as a key event.
        if (Build.VERSION.SDK_INT < 33 && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) handleBack();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    /** Back: leave fullscreen, then let the page close what is open, then go back, then exit. */
    private void handleBack() {
        if (fullscreenView != null) {
            chrome.onHideCustomView();
            return;
        }
        web.evaluateJavascript("!!(window.__onhockeyTvBack && window.__onhockeyTvBack())", handled -> {
            if ("true".equals(handled)) return;
            if (web.canGoBack()) web.goBack();
            else finish();
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        Flavor.onResume(this);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
