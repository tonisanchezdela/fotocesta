# FotoCesta · Datos para la ficha de Google Play

Copia y pega cada bloque en el apartado de Play Console que se indica.

## 1. Crear la app (Play Console → Crear app)

| Campo | Valor |
|---|---|
| Nombre de la app | FotoCesta: lista de la compra |
| Idioma predeterminado | Español (España) – es-ES |
| App o juego | App |
| Gratuita o de pago | **Gratuita** (no se podrá cambiar a de pago) |

## 2. Ficha principal de Play Store (Crecer → Presencia en Play Store → Ficha principal)

**Nombre de la app** (máx. 30):
```
FotoCesta: lista de la compra
```

**Descripción breve** (máx. 80):
```
Lista de la compra en familia por voz. Mira en qué súper te sale más barata.
```

**Descripción completa** (máx. 4000):
```
FotoCesta es la forma más rápida de hacer la lista de la compra con tu familia y saber en qué supermercado te sale más barata.

🎤 DICTA Y LISTO
Pulsa «Dictar productos» y di lo que necesitas: «dos leches, pan y detergente». Se añade todo solo. También puedes escribirlo.

🥛 ELIGE EL MODELO
Si un producto tiene varias opciones, FotoCesta te deja elegir: leche entera, semidesnatada, desnatada, sin lactosa o de tu marca preferida. Más de 700 productos y marcas habituales.

👨‍👩‍👧 LISTAS EN FAMILIA, EN TIEMPO REAL
Crea tu familia y comparte el código por WhatsApp. Todos añadís productos a la vez y veis los cambios al momento. Cada producto muestra la foto y el nombre de quien lo añadió. Crea tantas listas como quieras: compra semanal, cumpleaños, casa del pueblo…

💶 COMPARA 7 SUPERMERCADOS
Al confirmar la lista verás cuánto te cuesta en Mercadona, Consum, Lidl, Carrefour, Alcampo, Dia y Family Cash, con el detalle de cada producto y lo que ahorras si repartes la compra. Si un precio no coincide, lo corriges y la app lo recuerda.

📈 APRENDE TUS HÁBITOS
Marca los productos al cogerlos y pulsa «Terminar compra». FotoCesta aprende cada cuánto compras cada cosa y te avisa cuando te toca volver a comprarla.

✅ Gratis, sin anuncios y sin registro: no pide correo ni contraseña.
✅ También funciona sin conexión; los cambios se sincronizan al volver la cobertura.

Los precios son orientativos: se calculan a partir de precios de referencia de cada cadena y de los precios que corrijas tú.
```

**Recursos gráficos** (en la carpeta `graficos` del ZIP):

| Campo | Archivo |
|---|---|
| Icono de la app (512 × 512) | icono-512.png |
| Gráfico destacado (1024 × 500) | cabecera-1024x500.png |
| Capturas de pantalla del teléfono (mín. 2) | captura-1.png … captura-6.png |
| Vídeo (URL de YouTube) | pega el enlace del vídeo subido a YouTube (Público u Oculto, sin anuncios) |

## 3. Detalles de la tienda (Presencia en Play Store → Configuración de la tienda)

| Campo | Valor |
|---|---|
| Categoría | Compras |
| Etiquetas | Lista de la compra, Supermercado |
| Correo de contacto | tu correo (se muestra públicamente) |
| Sitio web | https://github.com/tonisanchezdela/fotocesta (opcional) |

## 4. Contenido de la app (Política → Contenido de la app)

**Política de privacidad (URL):**
```
https://github.com/tonisanchezdela/fotocesta/blob/main/PRIVACIDAD.md
```

**Acceso a la app:** «Toda la funcionalidad está disponible sin restricciones de acceso» (no hay usuario ni contraseña).

**Anuncios:** No, la app no contiene anuncios.

**Clasificación de contenido:** categoría «Todas las demás tipos de app». Responde **No** a violencia, sexo, lenguaje, drogas, apuestas y compras.
- ¿Los usuarios pueden interactuar entre sí? **Sí** (solo dentro de su familia, con código privado).
- ¿Comparte la ubicación del usuario? **No**.
- ¿Permite compras digitales? **No**.

**Público objetivo:** 18 años o más (evita los requisitos adicionales de apps para niños).

**App de noticias:** No. **App de salud:** No. **Servicios financieros:** No. **App gubernamental:** No.

**Seguridad de los datos:**

| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos de usuario? | **Sí** (solo si el usuario crea o se une a una familia) |
| ¿Todos los datos se cifran en tránsito? | **Sí** |
| ¿Los usuarios pueden pedir que se eliminen sus datos? | **Sí** |
| Datos compartidos con terceros | **Ninguno** |

Tipos de datos recopilados (todos: *recopilados*, *no compartidos*, *opcionales*, finalidad **Funcionalidad de la app**):

| Categoría | Tipo |
|---|---|
| Información personal | Nombre |
| Fotos y vídeos | Fotos (foto de perfil, opcional) |
| Actividad en apps | Otro contenido generado por el usuario (listas de la compra) · Historial de compras dentro de la app |
| Identificadores de dispositivo u otros | ID de usuario (identificador anónimo de Firebase) |

**URL de eliminación de cuenta/datos:**
```
https://github.com/tonisanchezdela/fotocesta/blob/main/PRIVACIDAD.md#cómo-borrar-tus-datos
```

**Permisos:** la app solo usa Internet. No pide cámara, ubicación ni contactos.

## 5. Prueba cerrada (obligatoria en cuentas personales nuevas)

1. Probar y publicar → Pruebas → **Prueba cerrada** → Crear canal.
2. Sube **FotoCesta-GooglePlay.aab** (descárgalo del enlace de abajo).
3. Añade una lista de probadores con **al menos 12 correos de Gmail**.
4. Envía la versión a revisión. Cuando esté aprobada, copia el **enlace de participación** y mándalo a los probadores: tienen que aceptarlo e instalar la app desde Google Play.
5. Pasados **14 días seguidos** con al menos 12 probadores, en el Panel aparece **Solicitar acceso a producción**. Respondes el cuestionario y, tras la revisión, publicas.

**Archivo para subir a Google Play (siempre la última versión):**
https://github.com/tonisanchezdela/fotocesta/releases/latest/download/FotoCesta-GooglePlay.aab

Al subir la primera versión, acepta **Firma de apps de Play** (Play App Signing). Google guarda la clave de firma definitiva.
