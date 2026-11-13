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
  item('herr','Herramientas y respaldo','Respaldo, importar, Excel, PDF, papelera y tu cuenta',()=>{
    tab='resumen'; showTab();
    const h=[...document.querySelectorAll('#view-resumen h2')].find(x=>/^Herramientas/i.test(x.textContent));
    if(h) setTimeout(()=>h.scrollIntoView({block:'start'}),30);
  });
  modal('Más',body,[{label:'Cerrar'}]);
}
