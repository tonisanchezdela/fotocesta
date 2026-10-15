/* FotoCesta para Alexa.
   La skill entra en la familia de FotoCesta como un miembro más ("Alexa") y lee y escribe la misma lista
   de Firebase que usan los móviles. El catálogo y los precios los descarga de la web de la app (alexa.json),
   así que siempre coinciden con los de la app. */
const Alexa = require('ask-sdk-core');
const https = require('https');

/* ---------- configuración ---------- */
const FB = { apiKey: 'AIzaSyAytDvBEm1EdRHqBioCNkDvDfGON13jZDg', proyecto: 'fotocesta-57b4f' };
const DATOS_URLS = [
  'https://raw.githubusercontent.com/tonisanchezdela/fotocesta/gh-pages/alexa.json',
  'https://tonisanchezdela.github.io/fotocesta/alexa.json'
];
const NOMBRE_MIEMBRO = 'Alexa';
const COLOR_MIEMBRO = '#2F6DB5';

/* ---------- peticiones HTTP (fetch si existe; si no, https) ---------- */
function pedir(metodo, url, cuerpo, cabeceras = {}) {
  const esForm = typeof cuerpo === 'string';
  const datos = cuerpo == null ? null : esForm ? cuerpo : JSON.stringify(cuerpo);
  const hdr = { ...cabeceras };
  if (datos != null) hdr['Content-Type'] = esForm ? 'application/x-www-form-urlencoded' : 'application/json';
  if (typeof fetch === 'function') {
    return fetch(url, { method: metodo, headers: hdr, body: datos }).then(async r => {
      const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
      return { status: r.status, json: j };
    });
  }
  return new Promise((ok, ko) => {
    const req = https.request(url, { method: metodo, headers: hdr }, res => {
      let t = ''; res.on('data', c => t += c);
      res.on('end', () => { let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; } ok({ status: res.statusCode, json: j }); });
    });
    req.on('error', ko); req.setTimeout(6000, () => req.destroy(new Error('timeout')));
    if (datos != null) req.write(datos); req.end();
  });
}

/* ---------- Firebase: cuenta anónima propia de esta Alexa ---------- */
async function cuentaNueva() {
  const r = await pedir('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB.apiKey}`, { returnSecureToken: true });
  if (r.status !== 200) throw errorFb('auth', r);
  return { uid: r.json.localId, refresh: r.json.refreshToken, token: r.json.idToken };
}
async function renovar(refresh) {
  const r = await pedir('POST', `https://securetoken.googleapis.com/v1/token?key=${FB.apiKey}`,
    `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`);
  if (r.status !== 200) throw errorFb('auth', r);
  return { uid: r.json.user_id, refresh: r.json.refresh_token, token: r.json.id_token };
}
function errorFb(tipo, r) { const e = new Error(`${tipo} ${r.status} ${JSON.stringify(r.json || '').slice(0, 300)}`); e.tipo = tipo; e.status = r.status; return e; }

/* ---------- Firestore por REST ---------- */
const BASE = `https://firestore.googleapis.com/v1/projects/${FB.proyecto}/databases/(default)/documents`;
const ruta = partes => partes.map(encodeURIComponent).join('/');
function aValor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
  return { mapValue: { fields: aCampos(v) } };
}
function aCampos(o) { const f = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = aValor(v); return f; }
function deValor(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
  return null;
}
function deCampos(f) { const o = {}; for (const [k, v] of Object.entries(f || {})) o[k] = deValor(v); return o; }
const idDoc = d => d.name.split('/').pop();

class Firestore {
  constructor(token) { this.h = { Authorization: 'Bearer ' + token }; }
  async leer(partes) {
    const r = await pedir('GET', `${BASE}/${ruta(partes)}`, null, this.h);
    if (r.status === 404) return null;
    if (r.status !== 200) throw errorFb('leer', r);
    return deCampos(r.json.fields);
  }
  async listar(partes) {
    const out = {}; let pag = '';
    do {
      const r = await pedir('GET', `${BASE}/${ruta(partes)}?pageSize=300${pag ? '&pageToken=' + encodeURIComponent(pag) : ''}`, null, this.h);
      if (r.status !== 200) throw errorFb('listar', r);
      for (const d of (r.json && r.json.documents) || []) out[idDoc(d)] = deCampos(d.fields);
      pag = r.json && r.json.nextPageToken;
    } while (pag);
    return out;
  }
  async guardar(partes, datos, { soloSiNoExiste = false, campos = null } = {}) {
    let q = [];
    if (soloSiNoExiste) q.push('currentDocument.exists=false');
    if (campos) q = q.concat(campos.map(c => 'updateMask.fieldPaths=' + encodeURIComponent(c)));
    const r = await pedir('PATCH', `${BASE}/${ruta(partes)}${q.length ? '?' + q.join('&') : ''}`, { fields: aCampos(datos) }, this.h);
    if (soloSiNoExiste && (r.status === 400 || r.status === 409)) return false;
    if (r.status !== 200) throw errorFb('guardar', r);
    return true;
  }
  async borrar(partes) {
    const r = await pedir('DELETE', `${BASE}/${ruta(partes)}`, null, this.h);
    if (r.status !== 200 && r.status !== 404) throw errorFb('borrar', r);
  }
}

/* ---------- catálogo y precios (los mismos que la app) ---------- */
let CACHE = null;
async function datos() {
  if (CACHE && Date.now() - CACHE.t < 6 * 3600e3) return CACHE.d;
  for (const u of DATOS_URLS) {
    try { const r = await pedir('GET', u); if (r.status === 200 && r.json && r.json.CATALOGO) { CACHE = { t: Date.now(), d: preparar(r.json) }; return CACHE.d; } } catch (e) { console.log('datos', u, e.message); }
  }
  if (CACHE) return CACHE.d;
  return preparar({ CATALOGO: [], TIPO_MARCA: {}, TIPO_FILA: {}, SUPERS: [], CATS: [], IDX: {} });
}
const nrm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const STOP = new Set(['de', 'del', 'con', 'la', 'el', 'los', 'las', 'en', 'para', 'al', 'a', 'y', 'sin_']);
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const hoy = () => new Date().toISOString().slice(0, 10);
const nuevaId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function preparar(D) {
  const RAW = new Set(); for (const r of D.CATALOGO) for (const w of nrm(r[0] + ' ' + r[4].replace(/\|/g, ' ')).trim().split(' ')) RAW.add(w);
  const sing = w => { if (w.length <= 3 || !w.endsWith('s')) return w; const a = w.slice(0, -1); if (RAW.has(a)) return a; if (w.endsWith('es')) { const b = w.slice(0, -2); if (RAW.has(b)) return b; } return w.length > 4 ? w.replace(/(es|s)$/, '') : w; };
  const toks = s => nrm(s).trim().split(' ').filter(w => w && !STOP.has(w)).map(sing).join(' ');
  const CAT_IDX = D.CATALOGO.map(([n, c, f, p, kw, m]) => ({ n, c, f, p, m, kw: kw.split('|').map(toks).filter(Boolean) }));
  for (const e of CAT_IDX) { const t = D.TIPO_FILA[e.n] || (e.m && D.TIPO_MARCA[e.m]) || ''; e.t = toks(t); }
  const CAT_NOM = Object.fromEntries(CAT_IDX.map(e => [toks(e.n), e]));
  function matchCat(nombre) {
    const t = ' ' + toks(nombre) + ' '; if (CAT_NOM[t.trim()]) return CAT_NOM[t.trim()]; let best = null, bestM = null;
    for (const e of CAT_IDX) { if (!e.m) continue; for (const k of e.kw) { if (k.length < 3) continue; if (t.includes(' ' + k + ' ') && (!bestM || k.length > bestM.l)) bestM = { e, l: k.length }; } }
    if (bestM) return bestM.e;
    for (const e of CAT_IDX) for (const k of e.kw) { if (k.length < 3) continue; if (t.includes(' ' + k + ' ') && (!best || k.length > best.l || (k.length === best.l && e.m && !best.e.m))) best = { e, l: k.length }; }
    return best ? best.e : null;
  }
  function candidatos(q) {
    const qt = toks(q).split(' ').filter(w => w.length >= 2); if (!qt.length) return [];
    const full = qt.join(' '); const res = [];
    for (const e of CAT_IDX) {
      const nombre = toks(e.n); const bolsa = ' ' + [nombre, ...e.kw, e.t || ''].join(' ') + ' ';
      if (!qt.every(w => bolsa.includes(' ' + w + ' ') || (w.length >= 5 && bolsa.includes(' ' + w)))) continue;
      let sc = 0; if (nombre === full) sc += 100; if (e.kw.includes(full)) sc += 40; if (nombre.startsWith(qt[0])) sc += 15; if (!e.m) sc += 10; sc -= nombre.split(' ').length;
      res.push({ e, sc });
    }
    return res.sort((a, b) => b.sc - a.sc).map(x => x.e);
  }
  /* Igual que en la app, pero sin preguntar el modelo: si hay varios, se apunta tal cual y se elige luego en el móvil */
  function resolver(texto) {
    const c = candidatos(texto);
    const exacto = c.find(e => toks(e.n) === toks(texto));
    if (exacto && (toks(texto).includes(' ') || c.length === 1)) return exacto;
    if (c.length === 1) return c[0];
    return null;
  }
  return { ...D, toks, matchCat, resolver, SN: Object.fromEntries((D.SUPERS || []).map(s => [s.id, s.n])) };
}

/* ---------- entender lo que se dice ---------- */
const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
function parseVoz(txt) {
  return String(txt || '').toLowerCase()
    .replace(/\b(a|en) (la|mi) lista( de la compra)?\b/g, ' ').replace(/\b(a|en) foto ?cesta\b/g, ' ')
    .replace(/\s+(y|e|además|tambien|también|más|mas)\s+/g, ',').split(/[,.;]+/).map(t => t.trim()).filter(Boolean).map(t => {
      let cant = 1; t = t.replace(/^(añade|añadir|apunta|apuntar|pon|poner|compra|comprar|necesito|quiero|mete)\s+/, '');
      const m = t.match(/^(media docena|una docena|\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:de\s+)?(.+)$/);
      if (m) { cant = /docena/.test(m[1]) ? 1 : (+m[1] || NUM[m[1]] || 1); t = m[2]; }
      t = t.replace(/^(kilo|kilos|paquete|paquetes|botella|botellas|bote|botes|lata|latas|bolsa|bolsas|brik|briks|litro|litros)\s+(de\s+)?/, '');
      return { nombre: t, cant: Math.min(cant, 50) };
    }).filter(p => p.nombre.length >= 2);
}
/* Código de familia dicho letra a letra: «a be ce dos tres cuatro», «ABC 234»… */
const LETRAS = { a: 'A', be: 'B', b: 'B', ce: 'C', c: 'C', de: 'D', d: 'D', e: 'E', efe: 'F', f: 'F', ge: 'G', g: 'G', hache: 'H', h: 'H', jota: 'J', j: 'J', ka: 'K', ca: 'K', k: 'K', ele: 'L', l: 'L', eme: 'M', m: 'M', ene: 'N', n: 'N', pe: 'P', p: 'P', cu: 'Q', q: 'Q', erre: 'R', ere: 'R', r: 'R', ese: 'S', s: 'S', te: 'T', t: 'T', u: 'U', uve: 'V', ve: 'V', v: 'V', w: 'W', equis: 'X', x: 'X', ye: 'Y', y: 'Y', zeta: 'Z', ceta: 'Z', z: 'Z', cero: '0', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9' };
function leerCodigo(txt) {
  let t = ' ' + nrm(txt) + ' ';
  t = t.replace(/ (uve doble|doble uve|doble ve) /g, ' w ').replace(/ i griega /g, ' y ').replace(/ (mi |el )?codigo( de mi familia)?( es)? /g, ' ');
  let out = '';
  for (const w of t.trim().split(' ')) {
    if (!w) continue;
    if (LETRAS[w]) out += LETRAS[w];
    else if (/^[a-z0-9]+$/.test(w) && w.length > 1 && /\d/.test(w)) out += w.toUpperCase();
    else if (/^[a-z]+$/.test(w) && w.length <= 6 && !LETRAS[w] && w.length > 1) out += w.toUpperCase();
    else if (/^\d$/.test(w)) out += w;
  }
  return out.replace(/[^A-Z0-9]/g, '');
}

/* ---------- la familia de este usuario ---------- */
async function conectar(h) {
  const am = h.attributesManager; const a = await am.getPersistentAttributes() || {};
  if (!a.code || !a.refresh) return null;
  const c = await renovar(a.refresh);
  if (c.refresh !== a.refresh) { a.refresh = c.refresh; am.setPersistentAttributes(a); await am.savePersistentAttributes(); }
  const db = new Firestore(c.token);
  db.guardar(['familias', a.code, 'miembros', c.uid], { visto: new Date() }, { campos: ['visto'] }).catch(() => {});
  return { db, uid: c.uid, code: a.code, a };
}
async function listaActual(f) {
  const listas = await f.db.listar(['familias', f.code, 'listas']);
  const ids = Object.keys(listas).sort((x, y) => (listas[x].creada || 0) - (listas[y].creada || 0));
  if (f.a.lista && listas[f.a.lista]) return { id: f.a.lista, nombre: listas[f.a.lista].nombre || 'Compra' };
  if (ids.length) return { id: ids[0], nombre: listas[ids[0]].nombre || 'Compra' };
  const id = nuevaId(); await f.db.guardar(['familias', f.code, 'listas', id], { nombre: 'Compra', creada: Date.now(), por: f.uid });
  return { id, nombre: 'Compra' };
}
const unir = l => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1];
const decir = s => String(s).replace(/&/g, ' y ').replace(/[<>]/g, ' ');
function euros(n) { const e = Math.floor(n + 1e-9), c = Math.round((n - e) * 100); return c ? `${e} euros con ${c}` : `${e} euros`; }

/* Si la persona abrió la skill («Alexa, abre foto cesta») seguimos escuchando; si fue una orden directa, terminamos */
function responder(h, txt) {
  const s = h.requestEnvelope.session;
  if (s && s.new === false) return h.responseBuilder.speak(txt + ' ¿Algo más?').reprompt('¿Algo más para la lista?').getResponse();
  return h.responseBuilder.speak(txt).withShouldEndSession(true).getResponse();
}
const SIN_FAMILIA = 'Primero tengo que unirme a tu familia de FotoCesta. En el móvil, abre FotoCesta, entra en Ajustes y pulsa Invitar para ver el código. Luego dime, por ejemplo: mi código es a, be, ce, dos, tres, cuatro.';

/* ---------- intenciones ---------- */
const Lanzar = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  async handle(h) {
    const a = await h.attributesManager.getPersistentAttributes() || {};
    if (!a.code) return h.responseBuilder.speak('¡Hola! Soy FotoCesta. ' + SIN_FAMILIA).reprompt('Dime el código de tu familia de FotoCesta, letra a letra.').getResponse();
    return h.responseBuilder.speak('¡Hola! ¿Qué apunto en la lista de la compra?').reprompt('Puedes decir: añade leche y pan. O: ¿qué hay en la lista?').getResponse();
  }
};

const Vincular = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'VincularIntent',
  async handle(h) {
    const dicho = Alexa.getSlotValue(h.requestEnvelope, 'codigo') || '';
    const code = leerCodigo(dicho);
    if (code.length !== 6) return h.responseBuilder.speak(`He entendido ${code ? code.split('').join(', ') : 'nada'}, y el código tiene seis letras o números. Dímelo otra vez, despacio: mi código es, y las letras una a una.`).reprompt('Dime: mi código es, y las seis letras o números.').getResponse();
    const am = h.attributesManager; const a = await am.getPersistentAttributes() || {};
    let c = a.refresh ? await renovar(a.refresh).catch(() => null) : null;
    if (!c) c = await cuentaNueva();
    const db = new Firestore(c.token);
    const fam = await db.leer(['familias', code]);
    if (!fam) return h.responseBuilder.speak(`No encuentro ninguna familia con el código ${code.split('').join(', ')}. Revísalo en el móvil, en Ajustes, Invitar, y dímelo otra vez.`).reprompt('Dime: mi código es, y las seis letras o números.').getResponse();
    if (a.code && a.code !== code) await new Firestore(c.token).borrar(['familias', a.code, 'miembros', c.uid]).catch(() => {});
    await db.guardar(['familias', code, 'miembros', c.uid], { nombre: NOMBRE_MIEMBRO, foto: '', color: COLOR_MIEMBRO, unido: Date.now(), visto: new Date() });
    am.setPersistentAttributes({ code, refresh: c.refresh, uid: c.uid }); await am.savePersistentAttributes();
    return h.responseBuilder.speak(`¡Listo! Ya estoy en ${decir(fam.nombre || 'tu familia')}. A partir de ahora puedes decirme: Alexa, pide a foto cesta que añada leche. ¿Quieres apuntar algo ahora?`).reprompt('¿Qué apunto?').getResponse();
  }
};

const Desvincular = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'DesvincularIntent',
  async handle(h) {
    const f = await conectar(h).catch(() => null);
    if (f) await f.db.borrar(['familias', f.code, 'miembros', f.uid]).catch(() => {});
    await h.attributesManager.deletePersistentAttributes();
    return h.responseBuilder.speak('Hecho, ya no estoy en ninguna familia. Cuando quieras, dime otro código.').withShouldEndSession(true).getResponse();
  }
};

const Anadir = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AnadirIntent',
  async handle(h) {
    const f = await conectar(h); if (!f) return h.responseBuilder.speak(SIN_FAMILIA).reprompt('Dime el código de tu familia.').getResponse();
    const pedidos = parseVoz(Alexa.getSlotValue(h.requestEnvelope, 'productos'));
    if (!pedidos.length) return h.responseBuilder.speak('¿Qué quieres que apunte?').reprompt('Por ejemplo: añade leche y dos de pan.').getResponse();
    const D = await datos(); const L = await listaActual(f); const nombres = [];
    for (const p of pedidos) {
      const e = D.resolver(p.nombre); const nombre = e ? e.n : cap(p.nombre.trim()); const id = slug(nombre);
      let prod = await f.db.leer(['familias', f.code, 'productos', id]);
      if (!prod) {
        const m = e || D.matchCat(nombre);
        prod = { nombre, cat: (e && e.c) || (m && m.c) || 'Otros', formato: (e && e.f) || '', precios: {}, compras: [], creado: hoy() };
        await f.db.guardar(['familias', f.code, 'productos', id], prod, { soloSiNoExiste: true });
      }
      const cur = await f.db.leer(['familias', f.code, 'listas', L.id, 'items', id]);
      await f.db.guardar(['familias', f.code, 'listas', L.id, 'items', id], {
        nombre: prod.nombre || nombre, cat: prod.cat || 'Otros', cant: (cur ? (cur.cant || 1) : 0) + p.cant,
        marcado: false, origen: 'alexa', ts: Date.now(), por: (cur && cur.por) || f.uid
      });
      nombres.push((p.cant > 1 ? p.cant + ' de ' : '') + (prod.nombre || nombre).toLowerCase());
    }
    return responder(h, `Apuntado: ${decir(unir(nombres))}.`);
  }
};

const Leer = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'LeerIntent',
  async handle(h) {
    const f = await conectar(h); if (!f) return h.responseBuilder.speak(SIN_FAMILIA).reprompt('Dime el código de tu familia.').getResponse();
    const D = await datos(); const L = await listaActual(f);
    const items = Object.values(await f.db.listar(['familias', f.code, 'listas', L.id, 'items'])).filter(x => !x.marcado);
    if (!items.length) return responder(h, `La lista ${decir(L.nombre)} está vacía.`);
    const orden = c => { const i = (D.CATS || []).indexOf(c); return i < 0 ? 99 : i; };
    items.sort((x, y) => orden(x.cat) - orden(y.cat) || String(x.nombre).localeCompare(y.nombre));
    const max = 25; const dichos = items.slice(0, max).map(x => ((x.cant || 1) > 1 ? x.cant + ' de ' : '') + String(x.nombre).toLowerCase());
    const resto = items.length > max ? ` y ${items.length - max} cosas más` : '';
    return responder(h, `En la lista hay ${items.length} ${items.length === 1 ? 'cosa' : 'cosas'}: ${decir(unir(dichos))}${resto}.`);
  }
};

const Quitar = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'QuitarIntent',
  async handle(h) {
    const f = await conectar(h); if (!f) return h.responseBuilder.speak(SIN_FAMILIA).reprompt('Dime el código de tu familia.').getResponse();
    const D = await datos(); const L = await listaActual(f);
    const pedido = parseVoz(Alexa.getSlotValue(h.requestEnvelope, 'producto'))[0];
    if (!pedido) return h.responseBuilder.speak('¿Qué quito de la lista?').reprompt('Por ejemplo: quita el pan.').getResponse();
    const q = D.toks(pedido.nombre.replace(/^(el|la|los|las)\s+/, ''));
    const items = await f.db.listar(['familias', f.code, 'listas', L.id, 'items']);
    const lista = Object.entries(items);
    const hit = lista.find(([, x]) => D.toks(x.nombre) === q) || lista.find(([, x]) => (' ' + D.toks(x.nombre) + ' ').includes(' ' + q + ' '));
    if (!hit) return responder(h, `No encuentro ${decir(pedido.nombre)} en la lista.`);
    await f.db.borrar(['familias', f.code, 'listas', L.id, 'items', hit[0]]);
    return responder(h, `Quitado: ${decir(String(hit[1].nombre).toLowerCase())}.`);
  }
};

const Presupuesto = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'PresupuestoIntent',
  async handle(h) {
    const f = await conectar(h); if (!f) return h.responseBuilder.speak(SIN_FAMILIA).reprompt('Dime el código de tu familia.').getResponse();
    const D = await datos(); const L = await listaActual(f);
    const items = Object.entries(await f.db.listar(['familias', f.code, 'listas', L.id, 'items'])).filter(([, x]) => !x.marcado);
    if (!items.length) return responder(h, 'La lista está vacía, así que la compra te sale gratis.');
    if (!D.CATALOGO.length) return h.responseBuilder.speak('Ahora mismo no puedo consultar los precios. Prueba en un rato o míralo en el móvil.').getResponse();
    const ajustes = await f.db.leer(['familias', f.code, 'ajustes', 'general']).catch(() => null);
    const act = ajustes && ajustes.supers;
    const sups = D.SUPERS.filter(s => !act || act.includes(s.id));
    const prods = {}; await Promise.all(items.map(async ([id]) => { prods[id] = await f.db.leer(['familias', f.code, 'productos', id]).catch(() => null); }));
    /* mismo cálculo que la app: precio guardado por la familia y, si no, el de referencia con el índice de cada súper (a igual peso) */
    const precio = (id, nombre, sup) => {
      const v = prods[id] && prods[id].precios && prods[id].precios[sup]; if (v && v.p > 0) return v.p;
      const e = D.matchCat((prods[id] && prods[id].nombre) || nombre); return e && D.IDX[sup] ? Math.round(e.p * D.IDX[sup] * 100) / 100 : null;
    };
    const media = (id, nombre) => { const v = D.SUPERS.map(s => precio(id, nombre, s.id)).filter(n => n > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const tot = sups.map(s => {
      let t = 0; for (const [id, x] of items) { const p = precio(id, x.nombre, s.id) ?? media(id, x.nombre); if (p != null) t += p * (x.cant || 1); }
      return { n: s.n, t: Math.round(t * 100) / 100 };
    }).sort((a, b) => a.t - b.t);
    const [b1, b2] = tot;
    let txt = `Con ${items.length} ${items.length === 1 ? 'producto' : 'productos'}, lo más barato es ${b1.n}: unos ${euros(b1.t)}.`;
    if (b2) txt += ` Le sigue ${b2.n}, con ${euros(b2.t)}.`;
    if (tot.length > 2) txt += ` El más caro es ${tot[tot.length - 1].n}, con ${euros(tot[tot.length - 1].t)}.`;
    return responder(h, txt);
  }
};

const Ayuda = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: h => h.responseBuilder.speak('Con FotoCesta puedes decir: añade leche y dos de pan. Qué hay en la lista. Quita el pan. O: dónde sale más barata la compra. Todo aparece al momento en los móviles de tu familia. ¿Qué quieres hacer?').reprompt('¿Qué quieres hacer?').getResponse()
};
const Salir = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: h => h.responseBuilder.speak('¡Hasta luego!').withShouldEndSession(true).getResponse()
};
const Si = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.YesIntent',
  handle: h => h.responseBuilder.speak('Vale, ¿qué apunto?').reprompt('Dime qué apunto, por ejemplo: leche y pan.').getResponse()
};
const No = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.NoIntent',
  handle: h => h.responseBuilder.speak('¡Vale, hasta luego!').withShouldEndSession(true).getResponse()
};
const NoEntendido = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: h => h.responseBuilder.speak('No te he entendido. Puedes decir: añade leche, qué hay en la lista, o dónde sale más barato.').reprompt('¿Qué quieres hacer?').getResponse()
};
const FinSesion = {
  canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: h => h.responseBuilder.getResponse()
};
const Errores = {
  canHandle: () => true,
  handle(h, e) {
    console.log('ERROR', e && e.stack || e);
    const auth = e && e.tipo === 'auth';
    const permiso = e && e.status === 403;
    const txt = auth ? 'No he podido conectar con FotoCesta. Prueba otra vez en un momento.'
      : permiso ? 'FotoCesta no me deja entrar en esa familia. Vuelve a decirme el código de tu familia.'
        : 'Ha habido un problema con FotoCesta. Prueba otra vez en un momento.';
    return h.responseBuilder.speak(txt).withShouldEndSession(true).getResponse();
  }
};

function crearSkill(adaptador) {
  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(Lanzar, Vincular, Desvincular, Anadir, Leer, Quitar, Presupuesto, Ayuda, Salir, Si, No, NoEntendido, FinSesion)
    .addErrorHandlers(Errores)
    .withPersistenceAdapter(adaptador)
    .withCustomUserAgent('fotocesta/alexa');
}

let handlerReal = null;
exports.handler = (evento, contexto, cb) => {
  if (!handlerReal) {
    const AWS = require('aws-sdk');
    const ddb = require('ask-sdk-dynamodb-persistence-adapter');
    handlerReal = crearSkill(new ddb.DynamoDbPersistenceAdapter({
      tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME, createTable: false,
      dynamoDBClient: new AWS.DynamoDB({ apiVersion: 'latest', region: process.env.DYNAMODB_PERSISTENCE_REGION })
    })).lambda();
  }
  return handlerReal(evento, contexto, cb);
};
exports._pruebas = { crearSkill, parseVoz, leerCodigo, preparar, aValor, deCampos, aCampos, slug };
