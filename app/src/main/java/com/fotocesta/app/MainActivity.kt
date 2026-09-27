package com.fotocesta.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.speech.RecognizerIntent
import android.util.Base64
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
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermission: PermissionRequest? = null
    private var vozId: String? = null
    private var guardarContenido: String? = null

    private val lector by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private val escaner by lazy {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                    Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
                    Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E
                )
                .build()
        )
    }

    private val elegirArchivo =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
            val uris = WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data)
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
        }

    private val permisoCamara =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { concedido ->
            val req = pendingPermission
            pendingPermission = null
            if (req != null) {
                if (concedido) req.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else req.deny()
            }
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
                runOnUiThread {
                    if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        val tiene = ContextCompat.checkSelfPermission(
                            this@MainActivity, Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                        if (tiene) {
                            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                        } else {
                            pendingPermission = request
                            permisoCamara.launch(Manifest.permission.CAMERA)
                        }
                    } else {
                        request.deny()
                    }
                }
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

    private fun decodificar(b64: String): Bitmap? {
        return try {
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (e: Exception) {
            null
        }
    }

    inner class Puente {

        @JavascriptInterface
        fun ocr(id: String, b64: String) {
            val bmp = decodificar(b64)
            if (bmp == null) {
                responder(id, JSONObject().put("ok", false).put("error", "imagen"))
                return
            }
            lector.process(InputImage.fromBitmap(bmp, 0))
                .addOnSuccessListener { texto ->
                    val lineas = JSONArray()
                    for (bloque in texto.textBlocks) {
                        for (linea in bloque.lines) {
                            val lb = linea.boundingBox
                            val palabras = JSONArray()
                            for (el in linea.elements) {
                                val eb = el.boundingBox
                                palabras.put(
                                    JSONObject()
                                        .put("t", el.text)
                                        .put("h", eb?.height() ?: 0)
                                        .put("x", eb?.left ?: 0)
                                        .put("y", eb?.top ?: 0)
                                )
                            }
                            lineas.put(
                                JSONObject()
                                    .put("t", linea.text)
                                    .put("h", lb?.height() ?: 0)
                                    .put("x", lb?.left ?: 0)
                                    .put("y", lb?.top ?: 0)
                                    .put("w", palabras)
                            )
                        }
                    }
                    responder(id, JSONObject().put("ok", true).put("lines", lineas))
                }
                .addOnFailureListener { e ->
                    responder(id, JSONObject().put("ok", false).put("error", e.message ?: "error"))
                }
        }

        @JavascriptInterface
        fun barcode(id: String, b64: String) {
            val bmp = decodificar(b64)
            if (bmp == null) {
                responder(id, JSONObject().put("codes", JSONArray()))
                return
            }
            escaner.process(InputImage.fromBitmap(bmp, 0))
                .addOnSuccessListener { codigos ->
                    val arr = JSONArray()
                    for (c in codigos) {
                        val v = c.rawValue
                        if (v != null) arr.put(v)
                    }
                    responder(id, JSONObject().put("codes", arr))
                }
                .addOnFailureListener {
                    responder(id, JSONObject().put("codes", JSONArray()))
                }
        }

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
