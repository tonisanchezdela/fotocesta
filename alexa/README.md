# FotoCesta para Alexa

Skill de Alexa que entra en tu familia de FotoCesta como un miembro más («Alexa») y usa la misma lista que los móviles.

Frases:
- «Alexa, pide a foto cesta que añada leche y dos de pan»
- «Alexa, pregunta a foto cesta qué hay en la lista»
- «Alexa, pide a foto cesta que quite el pan»
- «Alexa, pregunta a foto cesta dónde sale más barata la compra»
- «Alexa, abre foto cesta» (y luego hablas sin repetir «foto cesta»)

## Instalarla (una vez, desde el ordenador)

1. Entra en https://developer.amazon.com/alexa/console/ask con **la misma cuenta de Amazon que tu Echo** (si no tienes cuenta de desarrollador, te la crea gratis).
2. **Create Skill** →
   - Name: `FotoCesta` · Primary locale: **Spanish (ES)**
   - Type of experience: *Other* · Model: **Custom** · Hosting: **Alexa-hosted (Node.js)** · Región: **EU (Ireland)**
   - Template: **Start from Scratch** → Create skill. Espera un minuto a que se cree.
3. Pestaña **Build** → menú izquierdo *Interaction Model* → **JSON Editor**. Borra todo, pega el contenido de [`skill/modelo-es-ES.json`](skill/modelo-es-ES.json) → **Save** → **Build skill**.
4. Pestaña **Code**:
   - Abre `index.js`, borra todo y pega [`skill/lambda/index.js`](skill/lambda/index.js).
   - Abre `package.json`, borra todo y pega [`skill/lambda/package.json`](skill/lambda/package.json).
   - Pulsa **Save** y luego **Deploy**. Espera a que diga *Deployed*.
5. Pestaña **Test** → arriba, cambia *Off* por **Development**.
6. Ya funciona en tus Echo y en la app de Alexa. La primera vez di: «Alexa, abre foto cesta» y luego «mi código es…» con el código de tu familia (FotoCesta → Ajustes → Invitar), letra a letra.

Si Alexa no entiende bien el código, en la app de Alexa del móvil puedes escribirlo (icono del teclado): `abre foto cesta` y luego `mi código es ABC234`.

## Para otras personas
Pestaña **Distribution** → rellena nombre, descripción e iconos → **Availability** → *Beta test*: invita por email a quien quieras (hasta 500). Para que la pueda instalar cualquiera, envíala a certificación (Amazon tarda unos días).

## Cómo funciona
- La skill usa la misma base de datos de Firebase que la app, con una cuenta anónima propia, como un móvil más.
- El catálogo y los precios los descarga de `alexa.json`, que se genera solo desde la app cada vez que se publica la web (`generar-datos.js`). Así Alexa siempre tiene los mismos precios que la app, también tras la actualización mensual.
- Si Alexa oye un producto con varios modelos («leche»), lo apunta tal cual y el modelo se elige luego en el móvil.
