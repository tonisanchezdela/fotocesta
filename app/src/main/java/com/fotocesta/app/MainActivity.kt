package com.fotocesta.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.RecognizerIntent
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var vozId: String? = null
    private var guardarContenido: String? = null

    private val elegirArchivo =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
            val uris = WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data)
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
        }

    private val lanzarVoz =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
            val id = vozId ?: return@registerForActivityResult
            vozId = null
            val texto = res.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull() ?: ""
            responder(id, JSONObject().put("text", texto))
        }

    private val crearDocumento =
        registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            val contenido = guardarContenido
            guardarContenido = null
            if (uri != null && contenido != null) {
                try {
                    contentResolver.openOutputStream(uri)?.use { it.write(contenido.toByteArray(Charsets.UTF_8)) }
                    Toast.makeText(this, "Copia guardada", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "No se ha podido guardar", Toast.LENGTH_SHORT).show()
                }
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val cargador = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
        }

        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return cargador.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                } catch (_: Exception) {
                }
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.deny() }
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                return try {
                    elegirArchivo.launch(fileChooserParams.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        web.addJavascriptInterface(Puente(), "Android")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.__atras&&window.__atras())?'1':'0'") { r ->
                    if (r == null || !r.contains("1")) finish()
                }
            }
        })

        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    private fun responder(id: String, datos: JSONObject) {
        val js = "window.__nat&&window.__nat(" + JSONObject.quote(id) + "," + datos.toString() + ")"
        runOnUiThread { web.evaluateJavascript(js, null) }
    }

    inner class Puente {

        @JavascriptInterface
        fun voz(id: String) {
            runOnUiThread {
                vozId = id
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
                    .putExtra(RecognizerIntent.EXTRA_PROMPT, "Di lo que quieres añadir")
                    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                try {
                    lanzarVoz.launch(intent)
                } catch (e: Exception) {
                    vozId = null
                    responder(id, JSONObject().put("error", "sin_voz"))
                }
            }
        }

        @JavascriptInterface
        fun compartir(texto: String) {
            runOnUiThread {
                val envio = Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, texto)
                try {
                    startActivity(Intent.createChooser(envio, "Invitar a la familia"))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun guardar(nombre: String, contenido: String) {
            runOnUiThread {
                guardarContenido = contenido
                try {
                    crearDocumento.launch(nombre)
                } catch (e: Exception) {
                    guardarContenido = null
                }
            }
        }
    }
}
