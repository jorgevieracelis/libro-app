'use strict';
/* Mejoras visuales: tarjeta "De un vistazo", avisos, logros suaves, gráfico interactivo, deslizar filas,
   apariencia (tema y color) y transición entre pestañas. Todo se calcula en el teléfono. */

/* ---------- Cálculos (sin DOM, probados en tests/calculos.test.js) ---------- */
/* Meses cerrados seguidos (hacia atrás desde el mes pasado) con ingresos y balance positivo. tot(id) → {ingresos,balance} o null si no hay mes. */
function rachaPositiva(hoyId,tot){
  let n=0, id=addMonthsId(hoyId,-1);
  for(let i=0;i<36;i++){
    const t=tot(id); if(!t||!(t.ingresos>0)||!(t.balance>0)) break;
    n++; id=addMonthsId(id,-1);
  }
  return n;
}
/* Categorías con tope que ya llegaron al 80 % (aviso) o al 100 % (pasado), de más a menos usadas */
function avisosPresupuesto(presu,gastado){
  const out=[];
  Object.keys(presu||{}).forEach(c=>{
    const tope=num(presu[c]); if(!(tope>0)) return;
    const p=num(gastado&&gastado[c])/tope;
    if(p>=0.8) out.push({c,p,nivel:p>=1?'b':'w'});
  });
  return out.sort((a,b)=>b.p-a.p);
}
/* Pago pendiente más cercano (o vencido) de la lista de notas; dias<0 = vencido */
function proximoPago(notas,hoyISO){
  const pend=(notas||[]).filter(n=>n&&n.tipo&&!n.hecho&&/^\d{4}-\d{2}-\d{2}$/.test(n.fecha||'')).sort((a,b)=>a.fecha<b.fecha?-1:(a.fecha>b.fecha?1:0));
  if(!pend.length) return null;
  const f=s=>{ const p=s.split('-').map(Number); return Date.UTC(p[0],p[1]-1,p[2]); };
  return {nota:pend[0], dias:Math.round((f(pend[0].fecha)-f(hoyISO))/86400000)};
}
/* Cuánto puedes gastar por día hasta fin de mes (cuenta el día de hoy) */
function porDiaHastaFinDeMes(balance,fecha){
  const dim=new Date(fecha.getFullYear(),fecha.getMonth()+1,0).getDate();
  const quedan=dim-fecha.getDate()+1;
  return {quedan,porDia:balance/quedan};
}
function textoDias(d){ return d<0?('vencido hace '+(-d)+(d===-1?' día':' días')):(d===0?'hoy':(d===1?'mañana':'en '+d+' días')); }

/* ---------- Pantalla: "De un vistazo" (arriba en Resumen) ---------- */
function renderGlance(){
  const host=document.getElementById('glanceCard'); if(!host) return;
  host.replaceChildren();
  if(!cur||!months[cur]){ host.hidden=true; return; }
  const filas=[]; let alerta=false;
  const t=monthTotals(cur), esMesActual=(cur===currentMonthId());
  /* 1) cuánto por día */
  if(esMesActual){
    if(t.balance>0){ const r=porDiaHastaFinDeMes(t.balance,new Date()); filas.push({ico:'💰',tit:'Te quedan '+cf.format(r.porDia)+' por día',sub:'hasta fin de mes ('+r.quedan+(r.quedan===1?' día':' días')+') con el balance de '+cf.format(t.balance)}); }
    else if(t.ingresos>0){ filas.push({ico:'⚠',tit:'Este mes ya gastaste todo lo que ingresó',sub:'El balance está en '+cf.format(t.balance),cls:'neg'}); alerta=true; }
  }
  /* 2) próximo pago */
  const pp=(typeof notas!=='undefined'&&notasListas)?proximoPago(notas,ymd(new Date())):null;
  if(pp){
    const n=pp.nota, urgente=pp.dias<=3;
    filas.push({ico:pp.dias<0?'⛔':(urgente?'⏰':'📅'),tit:(pp.dias<0?'Pago vencido: ':'Próximo pago: ')+n.texto,sub:textoDias(pp.dias)+(n.monto!=null?' · '+cf.format(n.monto):''),cls:pp.dias<0?'neg':(urgente?'warn':'')});
    if(urgente) alerta=true;
  }
  /* 3) presupuesto */
  const av=avisosPresupuesto(extras.presupuesto,gastoPorCategoria(months[cur]));
  if(av.length){
    av.slice(0,3).forEach(a=>filas.push({ico:a.nivel==='b'?'⛔':'⚠',tit:a.c+': '+(a.nivel==='b'?'pasaste el tope':'al '+Math.round(a.p*100)+' % del tope'),sub:cf.format(num(gastoPorCategoria(months[cur])[a.c]))+' de '+cf.format(extras.presupuesto[a.c]),cls:a.nivel==='b'?'neg':'warn'}));
    alerta=true;
  }
  /* 4) logro suave */
  const racha=rachaPositiva(cur,id=>months[id]?monthTotals(id):null);
  if(racha>=2) filas.push({ico:'🌱',tit:racha+' meses seguidos cerrando en positivo',sub:'¡Sigue así!',cls:'ok'});
  else if(racha===1) filas.push({ico:'🌱',tit:'Cerraste el mes pasado en positivo',sub:'Un buen comienzo',cls:'ok'});
  host.hidden=!filas.length;
  const h=el('header'); const h2=el('h2'); h2.textContent='De un vistazo'; h.append(h2); host.append(h);
  filas.forEach(f=>{
    const r=el('div','gRow'+(f.cls?' '+f.cls:''));
    const i=el('span','gIco'); i.textContent=f.ico; i.setAttribute('aria-hidden','true');
    const tx=el('div','gTxt'); const b=el('b'); b.textContent=f.tit; const s=el('span'); s.textContent=f.sub; tx.append(b,s);
    r.append(i,tx); host.append(r);
  });
  /* punto de aviso en "Resumen" de la barra de abajo */
  const nb=document.querySelector('#bottomNav button[data-g="inicio"]'); if(nb) nb.classList.toggle('alerta',alerta);
}

/* ---------- Gráfico de categorías: toca una porción o una categoría para ver el detalle ---------- */
let pieSel=-1, pieMes=null;
function pieInteractivo(host){
  const svg=host.querySelector('.pie-svg'); if(!svg) return;
  const paths=[...svg.querySelectorAll('path')], rows=[...host.querySelectorAll('.pie-row')], det=host.querySelector('.pie-det');
  if(pieMes!==cur){ pieMes=cur; pieSel=-1; }
  const poner=i=>{
    pieSel=(i===pieSel)?-1:i;
    paths.forEach((p,j)=>p.classList.toggle('on',j===pieSel)); rows.forEach((r,j)=>{ r.classList.toggle('on',j===pieSel); r.setAttribute('aria-pressed',String(j===pieSel)); });
    svg.classList.toggle('sel',pieSel>=0);
    if(det){ const r=rows[pieSel]; det.textContent=r?(r.dataset.det||''):'Toca una porción o una categoría para ver el detalle.'; }
  };
  paths.forEach((p,i)=>{ p.style.setProperty('--i',i); p.addEventListener('click',()=>poner(i)); });
  rows.forEach((r,i)=>{ r.setAttribute('role','button'); r.tabIndex=0; r.setAttribute('aria-pressed','false'); r.addEventListener('click',()=>poner(i)); r.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); poner(i); } }); });
  if(pieSel>=0&&pieSel<paths.length){ const k=pieSel; pieSel=-1; poner(k); }
}

/* ---------- Deslizar una fila: → marca pagado, ← quita (con confirmación) ---------- */
(function(){
  const main=document.getElementById('main'); if(!main) return;
  let st=null;
  const UMBRAL=72;
  main.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch') return;
    const row=e.target.closest&&e.target.closest('.row'); if(!row||row.classList.contains('blank')) return;
    if(e.target.closest('button,select')) return;
    st={row,x:e.clientX,y:e.clientY,dx:0,activo:false,id:e.pointerId};
  },{passive:true});
  main.addEventListener('pointermove',e=>{
    if(!st||e.pointerId!==st.id) return;
    const dx=e.clientX-st.x, dy=e.clientY-st.y;
    if(!st.activo){ if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)){ st=null; return; } if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.6){ st.activo=true; try{ st.row.setPointerCapture(e.pointerId); }catch(x){} } else return; }
    st.dx=Math.max(-110,Math.min(110,dx));
    const hayPago=!!st.row.querySelector('.pay'); const accion=st.dx>0?(hayPago?'pay':''):'del';
    st.row.style.transform='translateX('+st.dx+'px)'; st.row.style.transition='none';
    st.row.dataset.sw=Math.abs(st.dx)>=UMBRAL?accion:'';
  },{passive:true});
  const fin=e=>{
    if(!st||(e&&e.pointerId!==st.id)) return;
    const {row,dx,activo}=st; st=null;
    row.style.transition='transform .18s ease'; row.style.transform=''; setTimeout(()=>{ row.style.transition=''; },220);
    const acc=row.dataset.sw; row.dataset.sw='';
    if(!activo||!acc) return;
    if(acc==='pay'){ const b=row.querySelector('.pay'); if(b){ b.click(); try{ navigator.vibrate&&navigator.vibrate(12); }catch(x){} } }
    else if(acc==='del'){
      const x=row.querySelector('.x'); if(!x) return;
      const nombre=(row.querySelector('input[type="text"]')||{}).value||'esta línea';
      const p=el('p'); p.textContent='¿Quitar “'+nombre+'”?';
      modal('Quitar línea',p,[{label:'Cancelar'},{label:'Quitar',cls:'danger solid',onClick:()=>{ x.click(); }}]);
    }
  };
  main.addEventListener('pointerup',fin,{passive:true});
  main.addEventListener('pointercancel',fin,{passive:true});
})();

/* ---------- Transición suave al cambiar de pestaña ---------- */
let vistaPrevia=null;
function animarVista(id){
  if(id===vistaPrevia) return; vistaPrevia=id;
  const v=document.getElementById('view-'+id); if(!v) return;
  v.classList.remove('vistaNueva'); void v.offsetWidth; v.classList.add('vistaNueva');
  setTimeout(()=>v.classList.remove('vistaNueva'),900);
}

/* ---------- Apariencia: tema (automático, claro, oscuro) y color. Se guarda solo en este teléfono ---------- */
const TEMAS=[['auto','Automático'],['claro','Claro'],['oscuro','Oscuro']];
const ACENTOS=[['clasico','Clásico','#1b3f7a'],['azul','Azul','#14327a'],['celeste','Celeste','#1fa3e0'],['verde','Verde','#1e6b45'],['violeta','Violeta','#5b3fb0'],['rojo','Rojo','#c4262e'],['rosado','Rosado','#e0508a'],['naranja','Naranja','#d9761a'],['amarillo','Amarillo','#f2c200'],['negro','Negro','#2a2a2e']];
function aparienciaLeer(){ let t='auto',a='clasico'; try{ t=localStorage.getItem('lfh.tema')||'auto'; a=localStorage.getItem('lfh.acento')||'clasico'; }catch(e){} return {t:TEMAS.some(x=>x[0]===t)?t:'auto',a:ACENTOS.some(x=>x[0]===a)?a:'clasico'}; }
function aparienciaAplicar(t,a){
  const r=document.documentElement;
  if(t==='claro') r.setAttribute('data-theme','light'); else if(t==='oscuro') r.setAttribute('data-theme','dark'); else r.removeAttribute('data-theme');
  if(a&&a!=='clasico') r.setAttribute('data-acento',a); else r.removeAttribute('data-acento');
}
function aparienciaGuardar(t,a){ try{ localStorage.setItem('lfh.tema',t); localStorage.setItem('lfh.acento',a); }catch(e){} aparienciaAplicar(t,a); }
function buildApariencia(){
  const c=el('section','card'); c.id='aparienciaCard'; c.style.marginTop='16px';
  const h=el('header'); const t=el('h2'); t.textContent='Apariencia'; h.append(t); c.append(h);
  const p=el('p','hint'); p.textContent='Elige el tema y el color de la app. Se guarda solo en este teléfono.'; c.append(p);
  let {t:tema,a:acento}=aparienciaLeer();
  const sel=el('select'); sel.setAttribute('aria-label','Tema');
  TEMAS.forEach(([k,n])=>{ const o=el('option'); o.value=k; o.textContent=n; if(k===tema) o.selected=true; sel.append(o); });
  sel.addEventListener('change',()=>{ tema=sel.value; aparienciaGuardar(tema,acento); });
  const lt=el('label','planLbl'); const st=el('span','small'); st.textContent='Tema'; lt.append(st,sel); c.append(lt);
  const sl=el('select'); sl.setAttribute('aria-label','Idioma');
  [['es','Español'],['en','English']].forEach(([k,n])=>{ const o=el('option'); o.value=k; o.textContent=n; if(k===idiomaLeer()) o.selected=true; sl.append(o); });
  sl.addEventListener('change',()=>idiomaGuardar(sl.value));
  const ll=el('label','planLbl'); ll.style.marginTop='8px'; const sx=el('span','small'); sx.textContent='Idioma'; ll.append(sx,sl); c.append(ll);
  const nt=el('p','hint'); nt.textContent='En English la pantalla se traduce; los versículos bíblicos y la guía en PDF siguen en español.'; nt.setAttribute('data-i18n-skip',''); c.append(nt);
  const sc=el('p','small'); sc.style.margin='12px 4px 6px'; sc.textContent='Color'; c.append(sc);
  const fila=el('div'); fila.style.cssText='display:flex; gap:10px; flex-wrap:wrap'; fila.setAttribute('role','group'); fila.setAttribute('aria-label','Color de la app');
  ACENTOS.forEach(([k,n,col])=>{
    const b=el('button','btn swatch'); b.type='button'; b.setAttribute('aria-pressed',String(k===acento)); b.setAttribute('aria-label','Color '+n);
    const d=el('span','swDot'); d.style.background=col; d.style.background='linear-gradient(180deg,color-mix(in srgb,'+col+' 45%,#fff) 0%,'+col+' 50%,color-mix(in srgb,'+col+' 75%,#000) 52%,'+col+' 100%)'; d.setAttribute('aria-hidden','true'); const tx=el('span'); tx.textContent=n; b.append(d,tx);
    b.addEventListener('click',()=>{ acento=k; aparienciaGuardar(tema,acento); fila.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false')); b.setAttribute('aria-pressed','true'); });
    fila.append(b);
  });
  c.append(fila); return c;
}
