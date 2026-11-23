'use strict';
/* Constantes, utilidades, modelo de datos, cálculos básicos y fusión de cambios de la pareja */
/* ---------- Constantes ---------- */
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const SECS=['ingresos','ingresosVar','plataformas','egresos','anticipados','fondo','retiro','tarjeta'];
const CUOTAS_OPC=[1,2,3,4,5,6,7,8,9,10,11,12];
const ALLQ=['q1','q2','q3','q4'];
const PERIODOS={mensual:{n:'Mensual',qs:['q1']},quincenal:{n:'Quincenal',qs:['q1','q2']},semanal:{n:'Semanal',qs:['q1','q2','q3','q4']}};
const PERIODO_OPC=[['mensual','Una vez por mes (mensual)'],['quincenal','Cada 15 días (quincenal)'],['semanal','Cada semana (semanal)']];
let periodo='quincenal', QS=['q1','q2'];
function setPeriodo(p){ periodo=PERIODOS[p]?p:'quincenal'; QS=PERIODOS[periodo].qs.slice(); }
const ORD=['','1ra','2da','3ra','4ta'];
function qname(q){ const i=Number(String(q).slice(1)); if(periodo==='mensual') return 'Mes completo'; if(periodo==='semanal') return 'Semana '+i; return ORD[i]+' quincena'; }
function qrange(q){ if(periodo!=='semanal') return ''; const i=Number(String(q).slice(1)); return ['','días 1 al 7','días 8 al 14','días 15 al 21','días 22 a fin de mes'][i]; }
const delP=()=>periodo==='mensual'?'del mes':(periodo==='semanal'?'de la semana':'de la quincena');
const estaP=()=>periodo==='mensual'?'este mes':(periodo==='semanal'?'esta semana':'esta quincena');
const porP=()=>periodo==='mensual'?'mes':(periodo==='semanal'?'semana':'quincena');
const BLANKS=4;   /* líneas vacías que cada lista muestra por defecto; el usuario puede agregar más (＋ Agregar línea) o quitarlas (×). Las vacías no se guardan en el servidor. */
const MES_RE=/^\d{4}-(0[1-9]|1[0-2])$/;
const CATS=['Alimentación','Servicios','Transporte','Regalos','Deudas','Vivienda','Salud','Hijos','Entretenimiento','Otros'];
const normCat=c=>{ if(c==='Alquiler') c='Vivienda'; return (typeof c==='string'&&CATS.includes(c))?c:''; };
const PIE_PAL=['#f28c28','#0f2a52','#111111','#2e7d32','#8e24aa','#c75c00','#00897b','#5d4037','#546e7a','#ad1457','#1565c0','#757575'];

/* ---------- Utilidades ---------- */
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(tag,cls)=>{const e=document.createElement(tag); if(cls) e.className=cls; return e;};
const nf=new Intl.NumberFormat('es-AR',{maximumFractionDigits:2});
const MONEDAS=[
  {c:'ARS',n:'Peso argentino',s:'$',d:0},
  {c:'USD',n:'Dólar estadounidense',s:'US$',d:2},
  {c:'VES',n:'Bolívar venezolano',s:'Bs.',d:2},
  {c:'BRL',n:'Real brasileño',s:'R$',d:2},
  {c:'COP',n:'Peso colombiano',s:'COL$',d:0},
  {c:'PEN',n:'Sol peruano',s:'S/',d:2},
  {c:'CLP',n:'Peso chileno',s:'CLP$',d:0},
  {c:'PYG',n:'Guaraní paraguayo',s:'₲',d:0},
  {c:'MXN',n:'Peso mexicano',s:'MX$',d:2},
  {c:'UYU',n:'Peso uruguayo',s:'$U',d:2},
  {c:'EUR',n:'Euro',s:'€',d:2},
  {c:'CAD',n:'Dólar canadiense',s:'CA$',d:2}
];
let moneda=MONEDAS[0], monedaNF=null;
function setMoneda(code){
  moneda=MONEDAS.find(m=>m.c===code)||MONEDAS[0];
  monedaNF=new Intl.NumberFormat('es-AR',{minimumFractionDigits:0,maximumFractionDigits:moneda.d});
}
setMoneda('ARS');
const cf={format:v=>{ const x=(typeof v==='number'&&isFinite(v))?v:0; return (x<0?'-':'')+moneda.s+' '+monedaNF.format(Math.abs(x)); }};
const fmt=v=>v==null?'':nf.format(v);
const num=v=>(typeof v==='number'&&isFinite(v))?v:0;
const monthLabel=id=>{const p=id.split('-'); return MESES[Number(p[1])-1]+' '+p[0];};
function parseMoney(s){
  s=String(s).replace(/[\s$]/g,'');
  if(!s) return null;
  if(s.indexOf(',')>=0 && s.indexOf('.')>=0){
    if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,'');
  }
  else if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=Number(s);
  return isFinite(n)?n:NaN;
}
/* Primera letra en mayúscula (el resto queda como lo escribió el usuario) */
function capIni(s){
  s=String(s==null?'':s);
  return s.replace(/^(\s*)(\S)/u,(m,a,b)=>a+b.toLocaleUpperCase('es'));
}
/* En toda la app: al terminar de escribir en un campo de texto libre, la primera letra pasa a mayúscula.
   No toca montos, correos, claves, PIN ni códigos (los campos con data-nocap o id nhCode/searchAll quedan igual). */
if(typeof document!=='undefined' && typeof document.addEventListener==='function'){
  document.addEventListener('change',e=>{
    const t=e.target; if(!t||!t.tagName) return;
    if(t.tagName!=='INPUT'&&t.tagName!=='TEXTAREA') return;
    if(t.tagName==='INPUT'&&t.type!=='text') return;
    if(t.classList.contains('num')||t.inputMode==='decimal'||t.hasAttribute('data-nocap')||t.id==='nhCode'||t.id==='searchAll') return;
    const v=capIni(t.value); if(v!==t.value) t.value=v;
  },true);
}
let toastTimer=null;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}
let vistaActual=null;
function setView(v){
  if(v!=='loading') ocultarSplash();
  if(v==='app' && vistaActual!=='app'){
    try{ marca('app lista'); localStorage.setItem('lfh.arranque',JSON.stringify({t:Date.now(),m:ARR_T})); }catch(e){}
    setTimeout(()=>nuevoVersiculo(),0); setTimeout(()=>{ try{ bienvenidaSiHaceFalta(); }catch(e){} },900); }
  vistaActual=v;
  $('#loading').hidden=v!=='loading'; $('#login').hidden=v!=='login'; $('#setup').hidden=v!=='setup';
  $('#nohogar').hidden=v!=='nohogar'; $('#verify').hidden=v!=='verify';
  document.body.classList.toggle('auth',v==='login'||v==='verify'||v==='nohogar');
  const app=v==='app'; $('#controls').hidden=!app; $('#main').hidden=!app; $('#versiculo').hidden=!app; $('#verFooter').hidden=!app;
  $('#tabs').hidden=!(app&&cur); $('#bottomNav').hidden=!(app&&cur); if(typeof sidebarMostrar==='function') sidebarMostrar(!!(app&&cur)); { const fab=$('#fabRapido'); if(fab) fab.hidden=!(app&&cur); }
}

/* ---------- Modelo de datos ---------- */
const blank=sec=>{
  if(sec==='plataformas') return {id:uid(),n:'',m:null,r:true,pagado:false};
  if(sec==='egresos'||sec==='anticipados') return {id:uid(),n:'',m:null,cat:'',pagado:false};
  if(sec==='tarjeta') return {id:uid(),n:'',m:null,cuotas:1,valorCuota:null,inicio:cur||null,cat:''};
  return {id:uid(),n:'',m:null};
};
const isBlank=(r,sec)=>!String(r.n||'').trim() && r.m==null;
function normRow(r,sec){
  const o={id:String(r.id||uid()), n:capIni(r.n), m:(typeof r.m==='number'&&isFinite(r.m))?r.m:null};
  if(sec==='plataformas'){ o.r=r.r!==false; o.pagado=r.pagado===true; }
  if(sec==='egresos'||sec==='anticipados'){ o.cat=normCat(r.cat); o.pagado=r.pagado===true; }
  if(sec==='tarjeta'){
    o.cuotas=(typeof r.cuotas==='number'&&CUOTAS_OPC.includes(r.cuotas))?r.cuotas:1;
    o.valorCuota=(typeof r.valorCuota==='number'&&isFinite(r.valorCuota))?r.valorCuota:null;
    o.inicio=(typeof r.inicio==='string'&&MES_RE.test(r.inicio))?r.inicio:null;
    o.cat=normCat(r.cat);
  }
  return o;
}
const autoPlat=qd=>qd.plataformas.filter(p=>p.r && String(p.n).trim());
function padSec(qd,sec){
  const arr=qd[sec];
  for(let i=arr.filter(r=>isBlank(r,sec)).length;i<BLANKS;i++) arr.push(blank(sec));
}
function categoryTotals(qd){
  const totals={};
  const add=(cat,amt)=>{ if(!(amt>0)) return; const k=cat||'Sin categoría'; totals[k]=(totals[k]||0)+amt; };
  autoPlat(qd).forEach(p=>add('Plataformas y servicios',num(p.m)));
  qd.egresos.forEach(r=>{ if(!isBlank(r,'egresos')) add(r.cat,num(r.m)); });
  qd.anticipados.forEach(r=>{ if(!isBlank(r,'anticipados')) add(r.cat,num(r.m)); });
  return totals;
}
function monthCategoryTotals(md){
  const out={};
  QS.map(q=>categoryTotals(md[q])).forEach(t=>Object.keys(t).forEach(k=>{ out[k]=(out[k]||0)+t[k]; }));
  return out;
}
/* Gráfico de egresos por categoría: 5 tipos a elegir en Más → Opciones → Apariencia (se guarda solo en cada teléfono).
   Todas las marcas llevan la clase "gx" y su número (data-i) para que se puedan tocar y resaltar igual que en la torta. */
const GRAFICOS=[['torta','Torta'],['dona','Dona'],['barrash','Barras horizontales'],['barrasv','Barras verticales'],['puntos','Puntos']];
function graficoTipo(){ let t='torta'; try{ t=localStorage.getItem('lfh.grafico')||'torta'; }catch(e){} return GRAFICOS.some(g=>g[0]===t)?t:'torta'; }
function graficoGuardar(t){ try{ localStorage.setItem('lfh.grafico',t); }catch(e){} }
function buildPieSVG(totals,tipo){
  tipo=tipo||graficoTipo();
  const entries=Object.entries(totals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((s,[,v])=>s+v,0);
  const col=i=>PIE_PAL[i%PIE_PAL.length];
  const n=entries.length, max=n?entries[0][1]:1;
  let marks='';
  if(tipo==='torta'||tipo==='dona'){
    const CX=100,CY=100,R=92,r0=tipo==='dona'?56:0; let ang=-Math.PI/2;
    entries.forEach(([k,v],i)=>{
      const frac=v/total, a2=ang+(n===1?0.9999:frac)*Math.PI*2, large=(a2-ang)>Math.PI?1:0;
      const P=(r,a)=>(CX+r*Math.cos(a)).toFixed(2)+' '+(CY+r*Math.sin(a)).toFixed(2);
      const d=r0
        ? 'M'+P(R,ang)+' A'+R+' '+R+' 0 '+large+' 1 '+P(R,a2)+' L'+P(r0,a2)+' A'+r0+' '+r0+' 0 '+large+' 0 '+P(r0,ang)+' Z'
        : 'M'+CX+' '+CY+' L'+P(R,ang)+' A'+R+' '+R+' 0 '+large+' 1 '+P(R,a2)+' Z';
      marks+='<path class="gx" data-i="'+i+'" d="'+d+'" fill="'+col(i)+'"></path>';
      ang=a2;
    });
  } else if(tipo==='barrash'||tipo==='puntos'){
    const gap=Math.min(6,120/Math.max(n,1)/4), h=(196-gap*(n-1))/Math.max(n,1);
    entries.forEach(([k,v],i)=>{
      const y=2+i*(h+gap), len=Math.max(2,v/max*176);
      if(tipo==='barrash'){
        marks+='<rect class="gx" data-i="'+i+'" x="2" y="'+y.toFixed(2)+'" width="'+len.toFixed(2)+'" height="'+h.toFixed(2)+'" rx="'+Math.min(5,h/2).toFixed(1)+'" fill="'+col(i)+'"></rect>';
      } else {
        const rad=Math.max(3,Math.min(9,h/2)), cy=(y+h/2).toFixed(2), x2=(rad+len*0.97).toFixed(2);
        marks+='<g class="gx" data-i="'+i+'"><line x1="'+rad+'" y1="'+cy+'" x2="'+x2+'" y2="'+cy+'" stroke="'+col(i)+'" stroke-width="'+Math.max(2,Math.min(4,h/3)).toFixed(1)+'" stroke-linecap="round"></line><circle cx="'+x2+'" cy="'+cy+'" r="'+rad.toFixed(1)+'" fill="'+col(i)+'"></circle><rect x="0" y="'+y.toFixed(2)+'" width="200" height="'+h.toFixed(2)+'" fill="transparent"></rect></g>';
      }
    });
  } else {   /* barras verticales */
    const gap=Math.min(6,120/Math.max(n,1)/4), w=(196-gap*(n-1))/Math.max(n,1);
    entries.forEach(([k,v],i)=>{
      const hh=Math.max(2,v/max*176), x=2+i*(w+gap);
      marks+='<rect class="gx" data-i="'+i+'" x="'+x.toFixed(2)+'" y="'+(198-hh).toFixed(2)+'" width="'+w.toFixed(2)+'" height="'+hh.toFixed(2)+'" rx="'+Math.min(5,w/2).toFixed(1)+'" fill="'+col(i)+'"></rect>';
    });
  }
  if(!n) marks='<circle cx="100" cy="100" r="92" fill="var(--chip)"></circle>';
  const svg='<svg viewBox="0 0 200 200" role="img" aria-label="Egresos por categoría" data-tipo="'+tipo+'">'+marks+'</svg>';
  const legend=entries.map(([k,v],i)=>({color:col(i),label:k,amt:v,pct:total>0?v/total:0}));
  return {svg,legend,total};
}
function numOrNull(v){ return (typeof v==='number'&&isFinite(v))?v:null; }
function normMonthFields(src){
  return { limiteTarjeta: numOrNull(src&&src.limiteTarjeta) };
}
function hydrate(src){
  const md={v:1, ...normMonthFields(src)};
  ALLQ.forEach(q=>{
    md[q]={};
    SECS.forEach(sec=>{
      const a=(src&&src[q]&&Array.isArray(src[q][sec]))?src[q][sec]:[];
      md[q][sec]=a.map(r=>normRow(r||{},sec));
    });
    SECS.forEach(sec=>padSec(md[q],sec));
    md[q].compras=((src&&src[q]&&Array.isArray(src[q].compras))?src[q].compras:[]).map(normCompra);
  });
  return md;
}
function serialize(md){
  const o={v:1, ...normMonthFields(md)};
  ALLQ.forEach(q=>{
    o[q]={};
    SECS.forEach(sec=>{ o[q][sec]=md[q][sec].filter(r=>!isBlank(r,sec)).map(r=>normRow(r,sec)); });
    o[q].compras=(md[q].compras||[]).filter(r=>!compraBlank(r)).map(normCompra);
  });
  return o;
}
/* ---------- Fusión de cambios (pareja) ---------- */
/* Cuando dos personas editan el mismo mes, al guardar no se reemplaza todo el mes: se toma lo último del servidor
   y se le aplican SOLO los cambios que hizo esta persona desde la última vez que vio el servidor ("base").
   Cada línea tiene su id: una línea nueva, editada o borrada se aplica sola, y dos personas pueden tocar líneas distintas.
   Si las dos tocan el mismo campo de la misma línea, gana quien guarda último. Editar le gana a borrar (no se pierde lo escrito). */
const igualJ=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function mergeLista(base,local,server){
  const bm=new Map((base||[]).map(r=>[r.id,r]));
  const lm=new Set(local.map(r=>r.id));
  const out=server.map(r=>({...r}));
  const quitar=new Set();
  bm.forEach((b,id)=>{ if(!lm.has(id)){ const s=out.find(r=>r.id===id); if(s&&igualJ(s,b)) quitar.add(id); } });
  local.forEach((l,li)=>{
    const b=bm.get(l.id), pos=out.findIndex(r=>r.id===l.id);
    if(pos>=0){
      if(b){ if(!igualJ(l,b)) Object.keys(l).forEach(k=>{ if(!igualJ(l[k],b[k])) out[pos][k]=l[k]; }); }
      else out[pos]={...out[pos],...l};
    } else if(!b || !igualJ(l,b)){
      let at=0;
      for(let j=li-1;j>=0;j--){ const p=out.findIndex(r=>r.id===local[j].id); if(p>=0){ at=p+1; break; } }
      out.splice(at,0,{...l});
    }
  });
  return out.filter(r=>!quitar.has(r.id));
}
const MES_LISTAS=SECS.concat(['compras']);
function mergeMes(base,local,server){
  const o={...server, v:1};
  o.limiteTarjeta=base ? (igualJ(local.limiteTarjeta,base.limiteTarjeta)?server.limiteTarjeta:local.limiteTarjeta)
                       : (local.limiteTarjeta!=null?local.limiteTarjeta:server.limiteTarjeta);
  if(o.limiteTarjeta===undefined) o.limiteTarjeta=null;
  ALLQ.forEach(q=>{
    o[q]={...(server[q]||{})};
    MES_LISTAS.forEach(sec=>{ o[q][sec]=mergeLista(base&&base[q]&&base[q][sec], (local[q]&&local[q][sec])||[], (server[q]&&server[q][sec])||[]); });
  });
  return o;
}
function mergeExtras(base,local,server){
  const o={...server};
  ['deudas','metas','repetidos','comercios','ops','recurrentes','cpPersonas','cpGastos','cpPagos'].forEach(k=>{ o[k]=mergeLista(base&&base[k],local[k]||[],server[k]||[]); });
  const pb=(base&&base.presupuesto)||{}, pl=local.presupuesto||{}, p={...(server.presupuesto||{})};
  new Set([...Object.keys(pb),...Object.keys(pl)]).forEach(c=>{ if(!igualJ(pl[c],pb[c])){ if(pl[c]==null) delete p[c]; else p[c]=pl[c]; } });
  o.presupuesto=p;
  ['extraDeuda','orden','feBase','feMeses'].forEach(k=>{ if(!base||!igualJ(local[k],base[k])) o[k]=local[k]; });
  return o;
}
function monthDiff(aId,bId){
  const a=aId.split('-').map(Number), b=bId.split('-').map(Number);
  return (b[0]-a[0])*12+(b[1]-a[1]);
}
function activeCuotasFor(monthId,q){
  const out=[];
  Object.keys(months).forEach(mId=>{
    const qd=months[mId] && months[mId][q]; if(!qd) return;
    qd.tarjeta.forEach(row=>{
      if(isBlank(row,'tarjeta')) return;
      const n=row.cuotas||1;
      const start=(row.inicio&&MES_RE.test(row.inicio))?row.inicio:mId;
      const idx=monthDiff(start,monthId);
      if(idx<0||idx>=n) return;
      out.push({storageMonth:mId,row,cuotaNum:idx+1,totalCuotas:n,amount:num(row.valorCuota),isOrigin:(mId===monthId)});
    });
  });
  return out;
}
const monthTarjetaTotal=(monthId,q)=>activeCuotasFor(monthId,q).reduce((s,it)=>s+it.amount,0);
function calc(qd,md){
  const ingresosFijos=qd.ingresos.reduce((s,r)=>s+num(r.m),0);
  const ingresosVar=(qd.ingresosVar||[]).reduce((s,r)=>s+num(r.m),0);
  const ingresos=ingresosFijos+ingresosVar; /* ingresos totales */
  const egresos=autoPlat(qd).reduce((s,p)=>s+num(p.m),0)+qd.egresos.reduce((s,r)=>s+num(r.m),0);
  const antic=qd.anticipados.reduce((s,r)=>s+num(r.m),0);
  const platTotal=qd.plataformas.reduce((s,p)=>s+num(p.m),0);
  const fondo=qd.fondo.reduce((s,r)=>s+num(r.m),0);
  const retiro=qd.retiro.reduce((s,r)=>s+num(r.m),0);
  const egresosTotales=egresos+antic;
  return {ingresos,ingresosFijos,ingresosVar,egresos,antic,egresosTotales,fondo,retiro,balance:ingresos-egresosTotales-fondo,platTotal,pct:ingresos>0?egresosTotales/ingresos:0};
}

