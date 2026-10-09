package tv.onhockey.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
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
import java.io.OutputStream;
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
    private static final String VERSION_URL = "https://onhockey.vercel.app/tv-version.json";
    private static final String APK_URL = "https://onhockey.vercel.app/onhockey-tv.apk";
    private static final String ACTION_INSTALL_STATUS = "tv.onhockey.app.INSTALL_STATUS";
    private static final String SCHEDULE_URL = "https://onhockey.tv/schedule_table.php";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final Pattern CHARSET = Pattern.compile("charset=([\\w-]+)", Pattern.CASE_INSENSITIVE);

    private FrameLayout root;
    private WebView web;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private WebChromeClient chrome;
    private boolean updateAfterPermission;

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
                Uri url = request.getUrl();
                // YouTube goes to the YouTube app; it plays far better there than in a WebView.
                if (request.isForMainFrame() && isYouTube(url) && openExternal(url)) return true;
                // Stream pages open inside the app; app-store and intent:// links are ignored.
                String scheme = url.getScheme();
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
        checkForUpdate();
    }

    private static boolean isYouTube(Uri url) {
        String host = url.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        boolean youtube = host.equals("youtu.be") || host.equals("youtube.com") || host.endsWith(".youtube.com");
        return youtube && (url.getPath() == null || !url.getPath().startsWith("/embed/"));
    }

    /** Opens a link in whichever app handles it (the YouTube app for YouTube links). */
    private boolean openExternal(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    // --- Self-update: public/tv-version.json says which versionCode the site's APK is. ---

    private void checkForUpdate() {
        new Thread(() -> {
            try {
                JSONObject info = new JSONObject(download(VERSION_URL));
                if (info.optInt("versionCode", 0) <= BuildConfig.VERSION_CODE) return;
                String name = info.optString("versionName", "");
                runOnUiThread(() -> {
                    if (isFinishing()) return;
                    new AlertDialog.Builder(this)
                            .setTitle("OnHockey Live " + name)
                            .setMessage("มีแอปเวอร์ชันใหม่ อัปเดตเลยไหม?\nA new version of the app is available.")
                            .setPositiveButton("Update", (d, w) -> startUpdate())
                            .setNegativeButton("Later", null)
                            .show();
                });
            } catch (Exception ignored) {
                // No network or no version file: try again next launch.
            }
        }).start();
    }

    private void startUpdate() {
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            // One-time: let this app install updates, then come back and it continues.
            updateAfterPermission = true;
            Toast.makeText(this, "Allow OnHockey Live to install apps, then press Back", Toast.LENGTH_LONG).show();
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            } catch (ActivityNotFoundException e) {
                startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            }
            return;
        }
        Toast.makeText(this, "Downloading update…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                PackageInstaller installer = getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(getPackageName());
                int id = installer.createSession(params);
                try (PackageInstaller.Session session = installer.openSession(id)) {
                    HttpURLConnection c = (HttpURLConnection) new URL(APK_URL).openConnection();
                    try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("app.apk", 0, -1)) {
                        byte[] buf = new byte[65536];
                        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                        session.fsync(out);
                    } finally {
                        c.disconnect();
                    }
                    Intent status = new Intent(this, MainActivity.class).setAction(ACTION_INSTALL_STATUS);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    session.commit(PendingIntent.getActivity(this, 0, status, flags).getIntentSender());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Update failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }).start();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // The system's "Install update?" screen.
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) startActivity(confirm);
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            Toast.makeText(this, "Update failed: " + message, Toast.LENGTH_LONG).show();
        }
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
        if (updateAfterPermission && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) {
            updateAfterPermission = false;
            startUpdate();
        }
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

        /** Opens a link outside the WebView, e.g. a YouTube video in the YouTube app. */
        @JavascriptInterface
        public boolean openUrl(String url) {
            return openExternal(Uri.parse(url));
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
