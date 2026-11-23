'use strict';
/* Versión completa (pago único, por hogar). ESTRUCTURA PREPARADA — TODAVÍA INVISIBLE.
   Mientras PREMIUM_ACTIVO sea false la app se comporta como siempre: todo está desbloqueado y no se ve ningún candado.
   Cómo se activará (ver js/PREMIUM.md): el servidor marca el hogar con premium:{activo:true} después de verificar la compra en Google Play;
   los usuarios NO pueden escribir ese campo (firestore.rules solo les deja unirse, salirse o guardar el cifrado).
   Para PROBAR el bloqueo sin activarlo para todos, en este teléfono: localStorage.setItem('lfh.premiumModo', 'gratis' | 'completa' | 'real')
     gratis   = simula un hogar que no ha comprado     completa = simula un hogar que ya compró
     real     = usa lo que diga el hogar (hogarInfo.premium)        (vacío = modo normal, sin bloqueo)
   Va después de precios.js. Usa hogarInfo, el(), toast(), VIDEOS/verVideo (videos.js) y FS/db. */
const PREMIUM_ACTIVO=false;                       /* ← el interruptor general: se cambia a true el día del lanzamiento de pago */
const PREMIUM_PRODUCTO='libro_completo_hogar';    /* identificador del producto en Google Play (pago único, por hogar) */
const PREMIUM_FUNCIONES={
  anio:   {n:'Año', d:'Todos tus meses juntos: ingresos, egresos, balance, evolución mes a mes y el reporte del año en PDF.', video:'analisis-y-control'},
  comp:   {n:'Comparativas', d:'Compara meses, trimestres, semestres o años, con barras y las categorías que más cambiaron.', video:'analisis-y-control'},
  precios:{n:'Evolución de precios', d:'Mira qué subió y qué bajó: súper, alquiler, suscripciones y cualquier egreso, con avisos mientras escribes.', video:'analisis-y-control'},
  plan:   {n:'Metas y deudas', d:'Metas de ahorro con su fecha, gastos recurrentes y un plan para salir de tus deudas.', video:'analisis-y-control'},
  extra:  {n:'Tarjeta y fondos', d:'Tarjeta de crédito con sus cuotas, retiro de efectivo por banco y fondo de emergencia.', video:'analisis-y-control'},
  kit:    {n:'Asistentes', d:'Siete asistentes: fondo de emergencia, simulador «¿y si…?», gastos compartidos, suscripciones, reporte del mes, alertas de gasto y largo plazo.', video:'asistentes'},
  herr:   {n:'Herramientas', d:'Buscador en todos tus meses, ahorro en dólares, calculadoras, comercios recordados e importar gastos desde Excel.', video:'herramientas'}
};
/* Pestañas que se bloquean completas. Herramientas se bloquea por tarjetas (el respaldo y los videos quedan siempre libres). */
const PREMIUM_PAGINAS=['anio','comp','precios','plan','kit','extra'];
const PREMIUM_TARJETAS_HERR=['Buscador (en los meses)','Ahorro en dólares','Comercios recordados','Calculadora y conversor','Dividir un gasto','Calculadora de préstamo o cuotas','Importar gastos (Excel o CSV)'];

function premiumModo(){ try{ return localStorage.getItem('lfh.premiumModo')||''; }catch(e){ return ''; } }
function premiumVigente(){ return PREMIUM_ACTIVO || ['gratis','completa','real'].includes(premiumModo()); }
/* ¿Este hogar tiene la versión completa? (la compra la hace una persona y vale para todo el hogar) */
function hogarEsCompleto(){
  const m=premiumModo();
  if(m==='completa') return true;
  if(m==='gratis') return false;
  return !!(typeof hogarInfo!=='undefined' && hogarInfo && hogarInfo.premium && hogarInfo.premium.activo===true);
}
/* ¿Se puede usar esta función? Todo lo que no esté en PREMIUM_FUNCIONES es gratis. */
function puedeUsar(clave){
  if(!premiumVigente()) return true;
  if(!PREMIUM_FUNCIONES[clave]) return true;
  return hogarEsCompleto();
}
const premiumBloqueaPagina=t=>PREMIUM_PAGINAS.includes(t)&&!puedeUsar(t);

/* ---------- Pantallas (solo se ven si el bloqueo está vigente) ---------- */
function buildBloqueo(){ const v=el('div'); v.id='view-bloqueo'; v.hidden=true; return v; }
function premiumPrecio(){ return null; }   /* cuando exista la compra, aquí irá el precio local que informe Google Play */
function renderBloqueo(clave){
  const v=document.getElementById('view-bloqueo'); if(!v) return;
  v.replaceChildren();
  const f=PREMIUM_FUNCIONES[clave]||PREMIUM_FUNCIONES.herr;
  const c=el('section','card premiumCard');
  const ic=el('div','premiumIco'); ic.textContent='🔒'; ic.setAttribute('aria-hidden','true');
  const h=el('h2'); h.textContent=f.n+' es parte de la versión completa'; h.style.textTransform='none';
  const p=el('p'); p.textContent=f.d;
  c.append(ic,h,p);
  const caja=el('div','premiumCaja');
  const t=el('p','small'); t.textContent='Con un solo pago desbloqueas todo, para ti y para tu pareja:'; t.style.fontWeight='700'; caja.append(t);
  const ul=el('ul'); Object.keys(PREMIUM_FUNCIONES).forEach(k=>{ const li=el('li'); li.textContent=PREMIUM_FUNCIONES[k].n; ul.append(li); }); caja.append(ul);
  const nota=el('p','small'); nota.textContent='Pago único, de por vida. Sin mensualidades y sin publicidad. Vale para todo tu hogar.'; caja.append(nota);
  const pr=premiumPrecio(); if(pr){ const b=el('p'); b.style.cssText='font-size:20px; font-weight:800; margin:6px 0 0'; b.textContent=pr; caja.append(b); }
  c.append(caja);
  const bar=el('div','premiumAcc');
  const bc=el('button','btn primary'); bc.type='button'; bc.textContent='Desbloquear versión completa'; bc.addEventListener('click',premiumDesbloquear); bar.append(bc);
  const i=(typeof VIDEOS!=='undefined')?VIDEOS.findIndex(x=>x.id===f.video):-1;
  if(i>=0){ const bv=el('button','btn'); bv.type='button'; bv.textContent='▶ Ver cómo funciona'; bv.addEventListener('click',()=>verVideo(i)); bar.append(bv); }
  const br=el('button','btn'); br.type='button'; br.textContent='Ya compré: actualizar'; br.addEventListener('click',premiumRestaurar); bar.append(br);
  const bh=el('button','link'); bh.type='button'; bh.textContent='Volver al Resumen'; bh.addEventListener('click',()=>{ tab='resumen'; showTab(); window.scrollTo(0,0); }); bar.append(bh);
  c.append(bar); v.append(c);
}
/* Tarjetas de Herramientas que son de la versión completa: se cambian por una placa con candado. */
function premiumProtegerHerramientas(v){
  if(puedeUsar('herr')) return;
  PREMIUM_TARJETAS_HERR.forEach(titulo=>{
    /* «Comercios recordados» se llena después de armar la pantalla: se busca por su identificador, no por el título */
    const h=[...v.querySelectorAll('h2')].find(x=>x.textContent===titulo);
    const card=titulo==='Comercios recordados'?v.querySelector('#comerciosCard'):(h&&h.closest('section,details')); if(!card) return;
    const p=el('button','btn premiumPlaca'); p.type='button'; p.textContent='🔒 '+titulo.replace(/ \(.*\)$/,'')+' · versión completa';
    p.addEventListener('click',()=>{ tab='herr'; premiumMostrarBloqueoHerr(); });
    card.replaceWith(p);
  });
}
function premiumMostrarBloqueoHerr(){
  const vb=document.getElementById('view-bloqueo'); if(!vb) return;
  renderBloqueo('herr'); tabsValidas().forEach(t=>{ const x=document.getElementById('view-'+t); if(x) x.hidden=true; }); vb.hidden=false; window.scrollTo(0,0);
}
/* Compra y actualización: todavía no conectadas (ver js/PREMIUM.md). */
function premiumDesbloquear(){ toast('La compra de la versión completa todavía no está disponible'); }
async function premiumRestaurar(){
  try{
    const s=await FS.getDoc(FS.doc(db,'hogares',hogarId));
    if(s.exists()){ hogarInfo=s.data(); try{ localStorage.setItem(hogarCacheKey(),JSON.stringify({id:hogarId,info:hogarInfo})); }catch(e){} }
    render();
    toast(hogarEsCompleto()?'¡Listo! Tu hogar tiene la versión completa':'No encontramos una compra en este hogar todavía');
  }catch(e){ toast('No se pudo comprobar. Revisa tu conexión'); }
}
