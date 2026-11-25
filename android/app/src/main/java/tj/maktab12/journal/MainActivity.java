package tj.maktab12.journal;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * «Журнали мактаб» — пӯсти Android барои «Портали муосири маориф».
 * Ҳамаи маълумот ва санҷиши ҳуқуқҳо дар сервер аст; барнома танҳо сайтро бехатар нишон медиҳад.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = BuildConfig.APP_URL;
    private static final String OFFLINE = "file:///android_asset/offline.html";
    private static final int REQ_FILE = 41;
    private static final int REQ_STORAGE = 42;

    private WebView web;
    private SwipeRefreshLayout swipe;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private PendingDownload pendingDownload;
    private long lastBack;

    private static final class PendingDownload {
        final String url, ua, cd, mime;
        PendingDownload(String url, String ua, String cd, String mime) {
            this.url = url; this.ua = ua; this.cd = cd; this.mime = mime;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.web);
        swipe = findViewById(R.id.swipe);
        progress = findViewById(R.id.progress);
        applyInsets(findViewById(R.id.root));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " MaorifApp/" + BuildConfig.VERSION_NAME);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "MaorifApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> startDownload(new PendingDownload(url, ua, cd, mime)));

        swipe.setColorSchemeColors(getColor(R.color.accent));
        swipe.setProgressBackgroundColorSchemeColor(getColor(R.color.icon_bg));
        swipe.setOnRefreshListener(() -> {
            String u = web.getUrl();
            if (u == null || u.startsWith("file:")) web.loadUrl(APP_URL); else web.reload();
        });
        // Танҳо вақте саҳифа дар боло аст, кашидан навсозӣ мекунад
        swipe.setOnChildScrollUpCallback((parent, child) -> web.canScrollVertically(-1));

        if (state != null) web.restoreState(state);
        else web.loadUrl(APP_URL);
    }

    /** Android 15: барнома зери панелҳо мекашад — ҷойи панелҳо ва клавиатураро медиҳем. */
    private void applyInsets(View root) {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top, bottom, left, right;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                top = bars.top; left = bars.left; right = bars.right;
                bottom = Math.max(bars.bottom, ime.bottom);
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft();
                right = insets.getSystemWindowInsetRight();
            }
            v.setPadding(left, top, right, bottom);
            return insets;
        });
    }

    private static boolean isOwnSite(Uri u) {
        Uri base = Uri.parse(APP_URL);
        return "https".equals(u.getScheme()) && base.getHost() != null && base.getHost().equalsIgnoreCase(u.getHost());
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show();
        }
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            String scheme = u.getScheme() == null ? "" : u.getScheme();
            if (isOwnSite(u)) return false;
            if (scheme.equals("file") && OFFLINE.equals(u.toString().split("\\?")[0])) return false;
            // tel:, mailto:, sms: ва сайтҳои дигар — дар барномаҳои телефон
            openExternal(u);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progress.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            swipe.setRefreshing(false);
            CookieManager.getInstance().flush();
            if (url != null && url.startsWith("https")) {
                // window.print() дар WebView кор намекунад — ба чопи Android мегузаронем
                view.evaluateJavascript("window.print=function(){MaorifApp.print()};", null);
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) {
                swipe.setRefreshing(false);
                view.loadUrl(OFFLINE + "?u=" + Uri.encode(APP_URL));
            }
        }
    }

    private final class Chrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int p) {
            progress.setProgress(p);
            if (p >= 100) progress.setVisibility(View.GONE);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            try {
                startActivityForResult(params.createIntent(), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                Toast.makeText(MainActivity.this, R.string.no_app, Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }
    }

    /** Танҳо як амал барои сайт: чоп. */
    private final class Bridge {
        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String title = web.getTitle() == null ? getString(R.string.app_name) : web.getTitle();
                PrintDocumentAdapter a = web.createPrintDocumentAdapter(title);
                pm.print(title, a, new PrintAttributes.Builder().build());
            });
        }
    }

    private void startDownload(PendingDownload d) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = d;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            return;
        }
        try {
            String name = URLUtil.guessFileName(d.url, d.cd, d.mime);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(d.url));
            String cookie = CookieManager.getInstance().getCookie(d.url);
            if (cookie != null) r.addRequestHeader("Cookie", cookie);
            r.addRequestHeader("User-Agent", d.ua);
            r.setMimeType(d.mime);
            r.setTitle(name);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            openExternal(Uri.parse(d.url));
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == REQ_STORAGE && pendingDownload != null) {
            PendingDownload d = pendingDownload;
            pendingDownload = null;
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) startDownload(d);
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) {
            super.onBackPressed();
        } else {
            lastBack = now;
            Toast.makeText(this, R.string.press_again, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
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
}
