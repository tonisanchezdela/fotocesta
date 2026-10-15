/* Saca de la app (index.html) los datos que necesita la skill de Alexa: catálogo, súpers e índices de precio.
   Uso: node alexa/generar-datos.js app/src/main/assets/index.html _site/alexa.json
   Lo ejecuta el workflow «Publicar web» en cada cambio, así Alexa siempre tiene los mismos precios que la app. */
const fs=require('fs');
const [,,entrada,salida]=process.argv;
const html=fs.readFileSync(entrada,'utf8');
function sacar(nombre){
  const i=html.indexOf('\nconst '+nombre+'=');if(i<0)throw new Error('No encuentro '+nombre+' en la app');
  const resto=html.slice(i+1);const fin=resto.slice(1).search(/\n(?=[A-Za-z_$\/])/);
  const codigo=fin<0?resto:resto.slice(0,fin+1);
  return new Function(codigo+';return '+nombre)();
}
const datos={
  version:1,generado:new Date().toISOString(),
  PRECIOS_FECHA:sacar('PRECIOS_FECHA'),SUPERS:sacar('SUPERS'),CATS:sacar('CATS'),IDX:sacar('IDX'),
  CATALOGO:sacar('CATALOGO'),TIPO_MARCA:sacar('TIPO_MARCA'),TIPO_FILA:sacar('TIPO_FILA')
};
if(!Array.isArray(datos.CATALOGO)||datos.CATALOGO.length<100)throw new Error('Catálogo vacío');
if(!datos.IDX.mercadona)throw new Error('IDX sin Mercadona');
fs.writeFileSync(salida,JSON.stringify(datos));
console.log(`alexa.json: ${datos.CATALOGO.length} productos, precios del ${datos.PRECIOS_FECHA}`);
