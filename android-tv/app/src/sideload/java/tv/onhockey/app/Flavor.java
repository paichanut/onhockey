package tv.onhockey.app;

import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sideloaded OnHockey Live build: fetches the onhockey.tv schedule natively and updates itself
 * from the site's APK (public/tv-version.json says which versionCode is there).
 */
final class Flavor {
    private static final String VERSION_URL = "https://onhockey.vercel.app/tv-version.json";
    private static final String APK_URL = "https://onhockey.vercel.app/onhockey-tv.apk";
    private static final String ACTION_INSTALL_STATUS = "tv.onhockey.app.INSTALL_STATUS";
    private static final String SCHEDULE_URL = "https://onhockey.tv/schedule_table.php";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final Pattern CHARSET = Pattern.compile("charset=([\\w-]+)", Pattern.CASE_INSENSITIVE);

    private static boolean updateAfterPermission;

    private Flavor() {}

    static Object bridge(MainActivity activity) {
        return new SideloadBridge(activity);
    }

    static void onCreate(MainActivity activity) {
        checkForUpdate(activity);
    }

    static void onResume(MainActivity activity) {
        if (updateAfterPermission && (Build.VERSION.SDK_INT < 26 || activity.getPackageManager().canRequestPackageInstalls())) {
            updateAfterPermission = false;
            startUpdate(activity);
        }
    }

    static void onNewIntent(MainActivity activity, Intent intent) {
        if (!ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // The system's "Install update?" screen.
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) activity.startActivity(confirm);
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            Toast.makeText(activity, "Update failed: " + message, Toast.LENGTH_LONG).show();
        }
    }

    /** Adds the native onhockey.tv schedule fetch to the shared bridge. */
    static class SideloadBridge extends AppBridge {
        SideloadBridge(MainActivity activity) {
            super(activity);
        }

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
                activity.web.post(() -> activity.web.evaluateJavascript(js, null));
            }).start();
        }
    }

    private static void checkForUpdate(MainActivity activity) {
        new Thread(() -> {
            try {
                JSONObject info = new JSONObject(download(VERSION_URL));
                if (info.optInt("versionCode", 0) <= BuildConfig.VERSION_CODE) return;
                String name = info.optString("versionName", "");
                activity.runOnUiThread(() -> {
                    if (activity.isFinishing()) return;
                    new AlertDialog.Builder(activity)
                            .setTitle("OnHockey Live " + name)
                            .setMessage("มีแอปเวอร์ชันใหม่ อัปเดตเลยไหม?\nA new version of the app is available.")
                            .setPositiveButton("Update", (d, w) -> startUpdate(activity))
                            .setNegativeButton("Later", null)
                            .show();
                });
            } catch (Exception ignored) {
                // No network or no version file: try again next launch.
            }
        }).start();
    }

    private static void startUpdate(MainActivity activity) {
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            // One-time: let this app install updates, then come back and it continues.
            updateAfterPermission = true;
            Toast.makeText(activity, "Allow OnHockey Live to install apps, then press Back", Toast.LENGTH_LONG).show();
            try {
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
            } catch (ActivityNotFoundException e) {
                activity.startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            }
            return;
        }
        Toast.makeText(activity, "Downloading update…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(activity.getPackageName());
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
                    Intent status = new Intent(activity, MainActivity.class).setAction(ACTION_INSTALL_STATUS);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    session.commit(PendingIntent.getActivity(activity, 0, status, flags).getIntentSender());
                }
            } catch (Exception e) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "Update failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }).start();
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
