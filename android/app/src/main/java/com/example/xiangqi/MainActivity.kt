package com.example.xiangqi

import android.app.Activity
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        val ws: WebSettings = webView.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
        ws.allowFileAccess = true
        ws.allowContentAccess = true
        ws.setUseWideViewPort(true)
        ws.loadWithOverviewMode = true
        ws.cacheMode = WebSettings.LOAD_DEFAULT
        // 缩放关闭，保持棋盘原始比例，触控更跟手
        ws.builtInZoomControls = false
        ws.displayZoomControls = false

        // 所有链接都在 WebView 内打开
        webView.webViewClient = WebViewClient()

        // 加载打包在 assets/www 中的网页版象棋
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
