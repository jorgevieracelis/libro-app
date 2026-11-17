'use strict';
/* Videos de ayuda: 7 videos cortos con voz y subtítulos (carpeta videos/ del sitio). Se ven con el reproductor del teléfono;
   hace falta internet para verlos (no se guardan en el teléfono). Más → Videos de ayuda. */
const VIDEOS=[
 {id:'por-que-libro-de-finanzas',t:'Lo mejor de la app (1 minuto)',d:'Un vistazo a lo que hace distinta a Libro de Finanzas.'},
 {id:'conoce-la-app',t:'1. Conoce la app',d:'Resumen, Libro, Compras, Calendario y Más.'},
 {id:'anotar-gastos',t:'2. Anota tus ingresos y gastos',d:'Libro, categorías, pagado, deslizar y compra rápida.'},
 {id:'comprobantes-y-tickets',t:'3. Comprobantes y tickets',d:'Carga pagos de billeteras y tickets del súper (foto o PDF).'},
 {id:'resumen-y-presupuesto',t:'4. Resumen, presupuesto y metas',d:'Entiende a dónde va tu dinero y ponle límites.'},
 {id:'calendario-y-ano',t:'5. Calendario y año',d:'Pagos que no se olvidan y tu año completo.'},
 {id:'seguridad-y-respaldo',t:'6. Seguridad y tu información',d:'Cifrado, bloqueo, respaldo y apariencia.'}
];
const videoUrl=(id,ext)=>new URL('videos/'+id+'.'+ext,document.baseURI).href;
function verVideo(i){
  const v=VIDEOS[i]; if(!v) return;
  const body=el('div');
  const vd=el('video'); vd.controls=true; vd.setAttribute('playsinline',''); vd.preload='metadata'; vd.poster=videoUrl(v.id,'jpg'); vd.src=videoUrl(v.id,'mp4');
  vd.style.cssText='width:100%; max-height:62vh; border-radius:12px; background:#0f2a52; display:block';
  vd.setAttribute('data-i18n-skip','');
  const p=el('p','small'); p.textContent=v.d; p.style.marginTop='8px'; p.setAttribute('data-i18n-skip','');
  const n=el('p','hint'); n.textContent='Con voz y subtítulos. Necesitas internet para verlo.';
  body.append(vd,p,n);
  const acc=[{label:'Todos los videos',onClick:()=>{ setTimeout(abrirVideos,0); }}];
  if(i<VIDEOS.length-1) acc.push({label:'Siguiente ▶',cls:'primary',onClick:()=>{ setTimeout(()=>verVideo(i+1),0); }});
  else acc.push({label:'Cerrar',cls:'primary'});
  modal(v.t,body,acc);
  const h=document.querySelector('#modal-root h3'); if(h) h.setAttribute('data-i18n-skip','');
  vd.play&&vd.play().catch(()=>{});
}
function abrirVideos(){
  const body=el('div'); body.className='masList';
  const intro=el('p','hint'); intro.textContent='Aprende a usar la app en 7 videos cortos, con voz y subtítulos (cada uno pesa unos 2 MB).'; body.append(intro);
  VIDEOS.forEach((v,i)=>{
    const b=el('button','btn masItem'); b.type='button';
    b.innerHTML='<img alt="" width="56" height="56" loading="lazy" style="border-radius:12px; object-fit:cover; flex:none; background:var(--chip)" src="'+videoUrl(v.id,'jpg')+'"><span><b></b><small></small></span>';
    b.querySelector('b').textContent=v.t; b.querySelector('small').textContent=v.d; b.querySelector('span').setAttribute('data-i18n-skip','');
    b.addEventListener('click',()=>{ closeModal(); verVideo(i); });
    body.append(b);
  });
  modal('Videos de ayuda',body,[{label:'Cerrar'}]);
}
/* Tarjeta en Herramientas */
function buildVideosCard(){
  const c=el('section','card'); c.id='videosCard'; c.style.marginTop='16px';
  const h=el('header'); const t=el('h2'); t.textContent='Videos de ayuda'; h.append(t); c.append(h);
  const p=el('p','hint'); p.textContent='Aprende a usar la app en 7 videos cortos, con voz y subtítulos. Necesitas internet para verlos.'; c.append(p);
  const tools=el('div','tools'); const b=el('button','btn primary'); b.type='button'; b.textContent='▶ Ver los videos'; b.addEventListener('click',abrirVideos); tools.append(b); c.append(tools);
  return c;
}
