'use strict';
/* Pantalla de inicio animada, íconos de línea y barra de navegación inferior (teléfono) */
/* El logo animado se ve desde que abre la página. Se quita cuando la app ya está lista, pero no antes de SPLASH_MIN ms
   (para que se alcance a ver) y, por si algo tarda mucho, nunca después de 7,5 s (así se ve el mensaje de conexión). */
const SPLASH_MIN=900;
let splashQuitado=false;
function ocultarSplash(forzar){
  if(splashQuitado) return;
  const s=document.getElementById('splash');
  if(!s){ splashQuitado=true; return; }
  const falta=SPLASH_MIN-performance.now();
  if(falta>0&&!forzar){ setTimeout(()=>ocultarSplash(true),falta); return; }
  splashQuitado=true; s.classList.add('out'); setTimeout(()=>s.remove(),500);
}
setTimeout(()=>ocultarSplash(true),7500);

const ICONOS={
  tuerca:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  tarjeta:'<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6 15h4"/>',
  video:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  inicio:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  libro:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 8h6M9 12h4"/>',
  compras:'<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.2h11L21 7H6"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  mas:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  anio:'<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
  metas:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  herr:'<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.2-.5-.5-2.2z"/>',
  guia:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M9 13h6M9 17h6"/>',
  idea:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'
};
const icono=(k,cls)=>'<svg class="ico'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(ICONOS[k]||'')+'</svg>';

function grupoDe(k){
  if(k==='resumen') return 'inicio';
  if(/^q\d$/.test(k)) return 'libro';
  if(/^c\d$/.test(k)) return 'compras';
  if(k==='cal') return 'cal';
  return 'mas';
}
const ultimoGrupo={};
function irAGrupo(g){
  if(g==='inicio') tab='resumen';
  else if(g==='libro') tab=(ultimoGrupo.libro&&QS.includes(ultimoGrupo.libro))?ultimoGrupo.libro:QS[0];
  else if(g==='compras'){ const u=ultimoGrupo.compras; tab=(u&&QS.includes('q'+u.slice(1)))?u:'c'+QS[0].slice(1); }
  else if(g==='cal') tab='cal';
  showTab(); window.scrollTo(0,0);
}
function renderBottomNav(){
  const nav=document.getElementById('bottomNav'); if(!nav) return;
  nav.replaceChildren();
  [['inicio','Resumen'],['libro','Libro'],['compras','Compras'],['cal','Calendario'],['mas','Más']].forEach(([g,t])=>{
    const b=el('button'); b.type='button'; b.dataset.g=g; b.innerHTML=icono(g)+'<span>'+t+'</span>';
    b.addEventListener('click',()=>{ if(g==='mas') abrirMas(); else irAGrupo(g); });
    nav.append(b);
  });
  marcarNav();
}
/* Marca la sección activa en la barra de abajo y decide qué pestañas pequeñas se ven arriba */
function marcarNav(){
  const g=grupoDe(tab);
  document.body.dataset.grupo=g;
  document.body.classList.toggle('subtabs',(g==='libro'||g==='compras')&&QS.length>1);
  if(g==='libro'||g==='compras') ultimoGrupo[g]=tab;
  const nav=document.getElementById('bottomNav'); if(!nav) return;
  nav.querySelectorAll('button').forEach(b=>{ if(b.dataset.g===g) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
}
function abrirMas(){
  const body=el('div'); body.className='masList';
  const item=(ic,titulo,desc,fn)=>{
    const b=el('button','btn masItem'); b.type='button';
    b.innerHTML=icono(ic)+'<span><b>'+titulo+'</b><small>'+desc+'</small></span>';
    b.addEventListener('click',()=>{ closeModal(); fn(); window.scrollTo(0,0); });
    body.append(b);
  };
  item('anio','Año','Resumen del año, evolución y reporte en PDF',()=>{ tab='anio'; showTab(); });
  item('metas','Metas y deudas','Metas de ahorro y calculadora de deudas',()=>{ tab='plan'; showTab(); });
  item('tarjeta','Tarjeta y fondos','Tarjeta de crédito, retiro de efectivo por banco y fondo de emergencia',()=>{ tab='extra'; showTab(); });
  item('video','Videos de ayuda','Aprende la app en 6 videos cortos, con voz y subtítulos',abrirVideos);
  item('herr','Herramientas','Buscador, ahorro en dólares, comercios, calculadoras, importación y respaldo',()=>{ tab='herr'; showTab(); });
  item('tuerca','Opciones','Tu hogar, cifrado, sesión, apariencia, moneda y modalidad de cobro',()=>{ tab='opc'; showTab(); });
  modal('Más',body,[{label:'Cerrar'}]);
}

/* ---------- Botón flotante: compra rápida (egreso variable) y carga de comprobantes ---------- */
function qDeDia(dia){
  if(periodo==='mensual') return 'q1';
  if(periodo==='quincenal') return dia<=15?'q1':'q2';
  return dia<=7?'q1':(dia<=14?'q2':(dia<=21?'q3':'q4'));
}
function hoyISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function compraRapida(){
  if(!cur||!months[cur]) return;
  const f=el('div','rapForm');
  const lab=(t,c)=>{ const l=el('label'); l.append(t,c); return l; };
  /* Comprobante (foto o captura de Mercado Pago, Ualá, etc.): se lee en el teléfono */
  const cam=el('button','btn'); cam.type='button'; cam.textContent='📷 Cargar comprobante';
  const fi=el('input'); fi.type='file'; fi.accept='image/*'; fi.hidden=true;
  const estado=el('p','small'); estado.setAttribute('role','status'); estado.style.margin='0';
  cam.addEventListener('click',()=>fi.click());
  f.append(cam,fi,estado);
  const iN=el('input','txt'); iN.type='text'; iN.placeholder='Ej.: Verdulería'; iN.maxLength=60; iN.autocomplete='off'; iN.setAttribute('aria-label','Concepto');
  const iM=el('input','txt num'); iM.type='text'; iM.inputMode='decimal'; iM.placeholder='Monto'; iM.autocomplete='off'; iM.setAttribute('aria-label','Monto');
  const iF=el('input','txt'); iF.type='date'; iF.setAttribute('aria-label','Fecha');
  iF.value=(cur===currentMonthId())?hoyISO():cur+'-01';
  const sC=catSelect('',()=>{});
  f.append(lab('Concepto',iN),lab('Monto',iM),lab('Fecha',iF),lab('Categoría',sC));
  let sQ=null;
  const qDeFecha=()=>{ const d=Number((iF.value||'').slice(8,10)); const m=(iF.value||'').slice(0,7); return (months[m]&&d)?qDeDia(d):qDeDia(Number(hoyISO().slice(8,10))); };
  if(QS.length>1){
    sQ=el('select'); sQ.setAttribute('aria-label','Período');
    QS.forEach(q=>{ const o=el('option'); o.value=q; o.textContent=qname(q); sQ.append(o); });
    sQ.value=QS.includes(qDeFecha())?qDeFecha():QS[0];
    f.append(lab('Va en',sQ));
    iF.addEventListener('change',()=>{ const q=qDeFecha(); if(QS.includes(q)) sQ.value=q; });
  }
  const rec=el('label'); rec.style.cssText='display:flex; gap:8px; align-items:center; font-weight:400';
  const cR=el('input'); cR.type='checkbox'; cR.checked=true; cR.style.cssText='width:20px; height:20px; flex:none';
  rec.append(cR,'Recordar este comercio y su categoría'); f.append(rec);
  const hint=el('p','small'); hint.textContent='Se guarda como egreso variable ya pagado.'; f.append(hint);
  const aplicarConocido=()=>{
    const c=comercioPorNombre(extras.comercios,iN.value);
    if(c&&c.cat&&!sC.value){ sC.value=c.cat; return c; }
    return c;
  };
  iN.addEventListener('change',()=>{ const c=aplicarConocido(); if(c&&c.cat) estado.textContent='Ya conozco "'+c.n+'": categoría '+c.cat+'.'; });
  let opLeida='';
  fi.addEventListener('change',async()=>{
    const file=fi.files&&fi.files[0]; if(!file) return;
    cam.disabled=true; estado.textContent='Leyendo el comprobante en tu teléfono… (la primera vez puede tardar un poco)';
    try{
      const txt=await leerComprobante(file);
      const r=parseComprobante(txt);
      const partes=[];
      if(r.monto!=null){ iM.value=fmt(r.monto); partes.push(cf.format(r.monto)); }
      if(r.destino){ iN.value=capIni(r.destino); partes.push(r.destino); }
      if(r.fecha){ iF.value=r.fecha; iF.dispatchEvent(new Event('change')); partes.push(r.fecha.split('-').reverse().join('/')); }
      opLeida=r.op||'';
      if(!partes.length){ estado.textContent='No pude leer datos claros en esa imagen. Prueba con una captura de pantalla más nítida o completa a mano.'; }
      else {
        let m='Leí: '+partes.join(' · ')+'. Revisa y confirma.';
        const c=r.destino?aplicarConocido():null;
        if(c&&c.cat) m+=' Ya conozco este comercio: categoría '+c.cat+'.';
        else if(r.destino) m+=' Elige la categoría y la app la recordará para la próxima.';
        if(r.op&&comprobanteYaCargado(extras,r.op)) m+=' ⚠ Este comprobante parece ya cargado antes (misma operación).';
        estado.textContent=m;
      }
    }catch(e){
      estado.textContent='No se pudo leer la imagen ('+(e&&e.message?e.message:'error')+'). Revisa tu conexión la primera vez o completa a mano.';
    }
    cam.disabled=false; fi.value='';
  });
  modal('Compra rápida',f,[
    {label:'Cancelar'},
    {label:'Guardar',cls:'primary',onClick:()=>{
      const m=parseMoney(iM.value);
      if(m==null||Number.isNaN(m)||m<=0){ toast('Escribe un monto válido'); iM.focus(); return false; }
      const fecha=/^\d{4}-\d{2}-\d{2}$/.test(iF.value)?iF.value:'';
      const mId=(fecha&&months[fecha.slice(0,7)])?fecha.slice(0,7):cur;
      const fueraDeMes=fecha&&mId!==fecha.slice(0,7);
      const q=(sQ&&mId===cur)?sQ.value:(QS.includes(qDeDia(Number(fecha.slice(8,10))||1))?qDeDia(Number(fecha.slice(8,10))||1):QS[0]);
      const arr=months[mId][q].anticipados;
      let row=arr.find(r=>isBlank(r,'anticipados'));
      if(!row){ row=blank('anticipados'); arr.push(row); }
      row.n=capIni(iN.value.trim())||'Compra rápida'; row.m=m; row.cat=normCat(sC.value); row.pagado=true;
      padSec(months[mId][q],'anticipados');
      if(mId===cur) renderList(q,'anticipados');
      refreshComputed(); markDirty(mId);
      if(cR.checked && iN.value.trim() && row.cat){ comercioAprender(extras,iN.value,row.cat); }
      if(opLeida){ comprobanteAnotar(extras,opLeida,fecha); }
      if((cR.checked&&iN.value.trim()&&row.cat)||opLeida) saveExtras();
      toast('Guardado en '+monthLabel(mId)+' · '+qname(q)+': '+row.n+(fueraDeMes?' (ese mes no existe en tu libro, quedó en el mes abierto)':''));
    }}
  ]);
  setTimeout(()=>iN.focus(),50);
}
(function(){ const b=document.getElementById('fabRapido'); if(b) b.addEventListener('click',compraRapida); })();
