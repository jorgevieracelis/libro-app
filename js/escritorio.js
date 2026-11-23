'use strict';
/* Navegación de ESCRITORIO: barra lateral con grupos que se pliega a una columna de íconos.
   Solo se ve en pantalla ancha con mouse (min-width:900px, hover y pointer fino); en el teléfono y en la tablet NO existe ni se ve:
   todas las reglas de estilo están dentro de esa condición. Va después de premium.js (usa grupoDe, irAGrupo, icono, abrirVideos,
   QS, qname, periodo, PREMIUM_PAGINAS y puedeUsar). */
const SB_GRUPOS=[
  {t:'Principal', items:[{k:'resumen',ic:'inicio',n:'Resumen',c:'Resumen'},{g:'libro',ic:'libro',n:'Libro',c:'Libro'},{g:'compras',ic:'compras',n:'Compras',c:'Compras'},{k:'cal',ic:'cal',n:'Calendario',c:'Calend.'}]},
  {t:'Análisis', items:[{k:'anio',ic:'anio',n:'Año',c:'Año'},{k:'comp',ic:'comp',n:'Comparativas',c:'Compar.'},{k:'precios',ic:'precios',n:'Precios',c:'Precios'}]},
  {t:'Planificar', items:[{k:'plan',ic:'metas',n:'Metas y deudas',c:'Metas'},{k:'kit',ic:'idea',n:'Asistentes',c:'Asist.'},{k:'extra',ic:'tarjeta',n:'Tarjeta y fondos',c:'Tarjeta'}]},
  {t:'Más', items:[{k:'herr',ic:'herr',n:'Herramientas',c:'Herram.'},{v:1,ic:'video',n:'Videos de ayuda',c:'Videos'},{k:'opc',ic:'tuerca',n:'Opciones',c:'Opciones'}]}
];
const SB_TITULOS={resumen:'Resumen',cal:'Calendario',anio:'Año',comp:'Comparativas',precios:'Evolución de precios',plan:'Metas y deudas',kit:'Asistentes',extra:'Tarjeta y fondos',herr:'Herramientas',opc:'Opciones'};
function sbPlegado(){ try{ return localStorage.getItem('lfh.sbMin')==='1'; }catch(e){ return false; } }
function sbAplicarPlegado(){ document.documentElement.classList.toggle('sb-min',sbPlegado()); }
sbAplicarPlegado();
function sbTituloDe(t){
  if(SB_TITULOS[t]) return SB_TITULOS[t];
  if(/^q\d$/.test(t)) return (QS.length>1?'Libro · '+qname(t):'Ingresos y egresos');
  if(/^c\d$/.test(t)) return 'Compras · '+(QS.length>1?qname('q'+t.slice(1)):'super y otros');
  return '';
}
function renderSidebar(){
  const sb=document.getElementById('sidebar'); if(!sb) return;
  sb.replaceChildren();
  const lg=el('div','sbLogo'); const im=el('img'); im.src='icon-192.png'; im.alt=''; const tx=el('div','sbLogoTx'); const b=el('b'); b.textContent='Libro de Finanzas'; const sm=el('small'); sm.textContent='Un hogar organizado con propósito'; tx.append(b,sm); lg.append(im,tx); sb.append(lg);
  SB_GRUPOS.forEach(gr=>{
    const h=el('div','sbGrp'); h.textContent=gr.t; sb.append(h);
    gr.items.forEach(it=>{
      const btn=el('button','sbIt'); btn.type='button'; if(it.k) btn.dataset.k=it.k; if(it.g) btn.dataset.g=it.g;
      btn.title=it.n; btn.setAttribute('aria-label',it.n);
      btn.innerHTML='<span class="bub">'+icono(it.ic)+'</span><span class="sbN">'+it.n+'</span><span class="sbC" aria-hidden="true">'+it.c+'</span>';
      if(it.k && PREMIUM_PAGINAS.includes(it.k) && !puedeUsar(it.k)){ const l=el('span','sbLock'); l.textContent='🔒'; l.setAttribute('aria-label','versión completa'); btn.append(l); }
      btn.addEventListener('click',()=>{
        if(it.v){ abrirVideos(); return; }
        if(it.g) irAGrupo(it.g); else { tab=it.k; showTab(); }
        window.scrollTo(0,0);
      });
      sb.append(btn);
      if(it.g && QS.length>1){      /* las quincenas (o semanas) cuelgan de Libro y Compras */
        const sub=el('div','sbSub'); sub.dataset.g=it.g;
        QS.forEach(q=>{
          const k=it.g==='libro'?q:'c'+q.slice(1);
          const s=el('button'); s.type='button'; s.dataset.k=k; s.textContent=qname(q);
          s.addEventListener('click',()=>{ tab=k; showTab(); window.scrollTo(0,0); });
          sub.append(s);
        });
        sb.append(sub);
      }
    });
  });
  const pie=el('div','sbPie');
  const tg=el('button','sbToggle'); tg.type='button'; tg.id='sbToggle';
  tg.innerHTML='<span class="sbArrow" aria-hidden="true">«</span><span class="sbTgTx">Plegar menú</span>';
  tg.addEventListener('click',()=>{ try{ localStorage.setItem('lfh.sbMin',sbPlegado()?'0':'1'); }catch(e){} sbAplicarPlegado(); sbTextoToggle(); });
  pie.append(tg); sb.append(pie);
  sbTextoToggle(); sidebarMarcar();
}
function sbTextoToggle(){
  const t=document.getElementById('sbToggle'); if(!t) return;
  const min=sbPlegado();
  t.title=min?'Desplegar menú':'Plegar menú'; t.setAttribute('aria-label',t.title); t.setAttribute('aria-expanded',String(!min));
  t.querySelector('.sbArrow').textContent=min?'»':'«'; t.querySelector('.sbTgTx').textContent=min?'Desplegar menú':'Plegar menú';
}
/* Marca la sección activa, muestra las quincenas del grupo activo y pone el título de la sección arriba. */
function sidebarMarcar(){
  const sb=document.getElementById('sidebar'); if(!sb) return;
  const g=grupoDe(tab);
  sb.querySelectorAll('.sbIt').forEach(b=>{
    const act=b.dataset.k?b.dataset.k===tab:b.dataset.g===g;
    if(act) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  sb.querySelectorAll('.sbSub').forEach(s=>{
    s.classList.toggle('abierto',s.dataset.g===g);
    s.querySelectorAll('button').forEach(b=>{ if(b.dataset.k===tab) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  });
  const t=document.getElementById('secTit'); if(t) t.textContent=sbTituloDe(tab);
}
/* Se muestra junto con el resto de la navegación, cuando ya hay un mes abierto. */
function sidebarMostrar(v){
  const sb=document.getElementById('sidebar'); if(sb) sb.hidden=!v;
  document.body.classList.toggle('sbOn',!!v);
}
