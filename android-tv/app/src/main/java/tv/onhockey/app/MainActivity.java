package tv.onhockey.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shows onhockey.vercel.app full screen and adds what a TV needs: the schedule fetched
 * natively (window.OnHockeyTV), remote-control Back handling and fullscreen video.
 */
public class MainActivity extends Activity {
    private static final String APP_URL = "https://onhockey.vercel.app/?tv=1";
    private static final String SCHEDULE_URL = "https://onhockey.tv/schedule_table.php";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final Pattern CHARSET = Pattern.compile("charset=([\\w-]+)", Pattern.CASE_INSENSITIVE);

    private FrameLayout root;
    private WebView web;
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

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString() + " OnHockeyTV/" + BuildConfig.VERSION_NAME);

        web.addJavascriptInterface(new Bridge(), "OnHockeyTV");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Stream pages open inside the app; app-store and intent:// links are ignored.
                String scheme = request.getUrl().getScheme();
                return !"http".equals(scheme) && !"https".equals(scheme);
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

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(APP_URL);
        }
        web.requestFocus();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
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
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    /** window.OnHockeyTV, used by lib/tv.js on the site. */
    private class Bridge {
        @JavascriptInterface
        public void fetchSchedule(final String id) {
            new Thread(() -> {
                String html = null;
                String error = null;
                try {
                    html = download(SCHEDULE_URL);
                } catch (Exception e) {
                    error = e.getMessage() != null ? e.getMessage() : e.toString();
                }
                final String js = "window.__onhockeyTv && window.__onhockeyTv(" + JSONObject.quote(id) + ","
                        + (html == null ? "null" : JSONObject.quote(html)) + ","
                        + (error == null ? "null" : JSONObject.quote(error)) + ")";
                web.post(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME;
        }
    }

    private static String download(String address) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", USER_AGENT);
        c.setRequestProperty("Referer", "https://onhockey.tv/");
        c.setRequestProperty("X-Requested-With", "XMLHttpRequest");
        c.setRequestProperty("Accept", "text/html,*/*");
        try {
            int status = c.getResponseCode();
            if (status != 200) throw new Exception("onhockey.tv responded " + status);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) {
                byte[] buf = new byte[16384];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            }
            // onhockey.tv serves windows-1251 unless it says otherwise.
            String charset = "windows-1251";
            String type = c.getContentType();
            if (type != null) {
                Matcher m = CHARSET.matcher(type);
                if (m.find()) charset = m.group(1);
            }
            return out.toString(charset);
        } finally {
            c.disconnect();
        }
    }
}
