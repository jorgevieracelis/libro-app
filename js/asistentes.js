'use strict';
/* Asistentes (parte 2): la página «Asistentes» con 7 herramientas (deudas, metas y sobres viven en «Metas y deudas» y «Presupuesto por categoría»). Todo se calcula en el teléfono con lo que ya cargaste.
   Solo se guarda lo mínimo, dentro del documento de extras del hogar (cifrado como el resto): gastos compartidos, fondo de emergencia
   y desde cuándo ahorras para cada meta. Usa asistentes-calculo.js y las globales de la app. Va después de asistentes-calculo.js. */
Object.assign(ICONOS,{
  kFondo:'<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  kSimula:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  kCompartir:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c3 .2 5 2.2 5 5.2"/>',
  kSubs:'<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  kReporte:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 17v-3M12 17v-5M15 17v-2"/>',
  kAlerta:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  kFuturo:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'
});

/* ---------- Ayudas de pantalla ---------- */
const kitSt={};   /* lo que escribes en cada asistente mientras la app está abierta (no se guarda) */
const kitNum1=x=>(Math.round(x*10)/10).toString().replace('.',',');
function kitSec(v,hint,primera){
  const c=el('section','card'); c.style.marginTop=primera?'0':'16px';
  if(hint){ const p=el('p','hint'); p.textContent=hint; c.append(p); }
  v.append(c); return c;
}
function kitP(c,t,cls){ const p=el('p',cls||'small'); p.style.margin='6px 4px'; p.textContent=t; c.append(p); return p; }
function kitBig(c,t,cls){ const d=el('div','kitBig'+(cls?' '+cls:'')); d.textContent=t; c.append(d); return d; }
function kitBarra(pct,cls){
  const bar=el('div','bar'); bar.style.cssText='grid-template-columns:1fr; margin:6px 0';
  const tk=el('div','track'), f=el('div','fill '+(cls||'i')); f.style.width=Math.min(100,Math.max(0,pct*100))+'%'; tk.append(f); bar.append(tk); return bar;
}
function kitMonto(label,get,set,live,done,ph){ return lbl(label,moneyInput(get,set,live||(()=>{}),done||(()=>{}),ph||label)); }
function kitSelect(opts,val,onCh,aria){
  const s=el('select','txt'); s.setAttribute('aria-label',aria||'Elegir'); s.style.cssText='width:100%; max-width:100%';
  opts.forEach(([k,t])=>{ const o=el('option'); o.value=k; o.textContent=t; if(String(k)===String(val)) o.selected=true; s.append(o); });
  s.addEventListener('change',()=>onCh(s.value)); return s;
}
function kitIrA(t){ tab=t; showTab(); window.scrollTo(0,0); }
async function kitCompartirTexto(texto,titulo){
  if(navigator.share){ try{ await navigator.share({title:titulo,text:texto}); return; }catch(e){ if(e&&e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(texto); toast('Copiado: pégalo en WhatsApp, correo o notas'); }catch(e){ toast('No se pudo compartir ni copiar'); }
}
const kitMes=()=>currentMonthId();

/* ---------- 1) Fondo de emergencia ---------- */
function kitFondo(v){
  const ids=Object.keys(months).filter(m=>!cur||m<=cur).sort();     /* solo hasta el mes abierto: lo que vino después no cuenta todavía */
  const aportes=ids.reduce((s,id)=>s+monthTotals(id).fondo,0);
  const prom=kitPromMeses(cur,6);
  const f3=ids.slice(-3).map(id=>monthTotals(id).fondo), aporteProm=f3.length?f3.reduce((a,b)=>a+b,0)/f3.length:0;
  const meta=()=>Math.min(24,Math.max(1,Math.round(num(extras.feMeses))||3));
  const c=kitSec(v,'Cuántos meses de gastos podrías cubrir con lo que tienes guardado para emergencias. Suma lo que anotas en «Fondo de emergencia» cada mes más lo que ya tenías ahorrado antes.',true);
  const out=el('div'); out.setAttribute('aria-live','polite');
  const pinta=()=>{
    out.replaceChildren();
    const guardado=num(extras.feBase)+aportes, r=feCalc(guardado,prom.egresos,meta());
    if(!r){ kitP(out,'Carga los egresos de uno o más meses y te digo cuántos meses cubres.'); return; }
    kitBig(out,kitNum1(r.meses)+(kitNum1(r.meses)==='1'?' mes cubierto':' meses cubiertos'),r.nivel==='ok'?'pos':(r.nivel==='bajo'?'neg':''));
    out.append(kitBarra(r.pct,r.nivel==='ok'?'i':(r.nivel==='bajo'?'b':'w')));
    kitP(out,'Tienes '+cf.format(guardado)+' guardados y gastas cerca de '+cf.format(prom.egresos)+' por mes (promedio de '+prom.n+(prom.n===1?' mes':' meses')+').');
    if(r.nivel==='ok') kitP(out,'🎉 Llegaste a tu meta de '+r.metaMeses+' meses. Cuida este fondo para emergencias de verdad.','small pos');
    else {
      kitP(out,(r.nivel==='bajo'?'Todavía no cubres ni un mes. Un buen primer objetivo es juntar 1 mes de gastos ('+cf.format(prom.egresos)+').':'Vas bien: ya cubres más de un mes.')+' Para tu meta de '+r.metaMeses+' meses necesitas '+cf.format(r.objetivo)+' y te faltan '+cf.format(r.falta)+'.');
      if(aporteProm>0){ const k=Math.ceil(r.falta/aporteProm); kitP(out,'Al ritmo de tus últimos meses ('+cf.format(aporteProm)+' por mes) llegas en '+k+(k===1?' mes':' meses')+' ('+monthLabel(addMonthsId(cur||kitMes(),k))+').'); }
      else kitP(out,'Si apartas '+cf.format(r.falta/12)+' por mes, llegas en 12 meses. Anótalo en «Fondo de emergencia» del Libro.');
    }
  };
  const g=el('div','planGrid');
  g.append(kitMonto('Ya tenía guardado antes (opcional)',()=>extras.feBase,x=>{ extras.feBase=x>0?x:null; },pinta,()=>{ saveExtras(); pinta(); },'Monto'));
  g.append(lbl('Meta de meses cubiertos',kitSelect([3,4,6,9,12].map(n=>[n,n+' meses']),meta(),x=>{ extras.feMeses=Number(x); saveExtras(); pinta(); },'Meta en meses')));
  c.append(g,out); pinta();
  kitP(c,'Lo ideal para empezar es entre 3 y 6 meses de gastos. Si tus ingresos cambian mucho, apunta a más.','hint');
}

/* ---------- 2) Simulador «¿y si…?» ---------- */
function kitSimula(v){
  const c=kitSec(v,'Prueba cambios sin tocar tus datos: ¿qué pasaría si gastas menos en algo o ganas un extra? Usa el promedio de tus últimos meses.',true);
  if(!cur||!months[cur]){ kitP(c,'Abre un mes para simular.'); return; }
  const pm=kitPromMeses(cur,3), pc=kitPromCats(cur,3), prom=pc.n?pc.prom:kitCatMes(cur);
  const cats=Object.entries(prom).filter(([k,x])=>x>0&&k!=='Sin categoría').sort((a,b)=>b[1]-a[1]).slice(0,12);
  if(!cats.length){ kitP(c,'Todavía no hay gastos con categoría para simular. Anota egresos con su categoría y vuelve.'); return; }
  const st=kitSt.sim||(kitSt.sim={aj:[{cat:cats[0][0],pct:-10},{cat:'',pct:0},{cat:'',pct:0}],extra:null});
  kitP(c,'Base: promedio de '+pm.n+(pm.n===1?' mes':' meses')+'. Hoy te sobran en promedio '+cf.format(pm.balance)+' por mes.');
  const out=el('div'); out.setAttribute('aria-live','polite');
  const pinta=()=>{
    out.replaceChildren();
    const r=simulaAhorro(pm.balance,prom,st.aj,st.extra);
    if(!r.det.length&&!(num(st.extra)!==0)){ kitP(out,'Elige una categoría y mueve el control para ver el efecto.'); return; }
    kitBig(out,'Te sobrarían '+cf.format(r.despues)+' por mes',r.difMes>=0?'pos':'neg');
    kitP(out,(r.difMes>=0?'▲ ':'▼ ')+cf.format(Math.abs(r.difMes))+' '+(r.difMes>=0?'más':'menos')+' cada mes · '+(r.difAnio>=0?'+':'−')+cf.format(Math.abs(r.difAnio))+' en 12 meses.','small '+(r.difMes>=0?'pos':'neg'));
    r.det.forEach(d=>kitP(out,'· '+d.cat+': gastas '+Math.abs(d.pct)+' % '+(d.pct<0?'menos':'más')+' ('+(d.efecto>=0?'+':'−')+cf.format(Math.abs(d.efecto))+' por mes)'));
  };
  st.aj.forEach((a,i)=>{
    const it=el('div','planItem');
    const val=el('span','small'); val.style.cssText='display:block; margin-top:6px; font-weight:700';
    const rotulo=()=>{ val.textContent=a.pct===0?'Sin cambio':'Gastas '+Math.abs(a.pct)+' % '+(a.pct<0?'menos':'más'); };
    const sel=kitSelect([['','— Elige un gasto —']].concat(cats.map(([k,x])=>[k,k+' (promedio '+cf.format(x)+')'])),a.cat,x=>{ a.cat=x; pinta(); },'Gasto a cambiar '+(i+1));
    const rg=el('input'); rg.type='range'; rg.min='-50'; rg.max='50'; rg.step='5'; rg.value=String(a.pct); rg.setAttribute('aria-label','Cambio del gasto en porcentaje'); rg.style.width='100%';
    rg.addEventListener('input',()=>{ a.pct=Number(rg.value); rotulo(); pinta(); });
    rotulo(); it.append(lbl('Gasto '+(i+1),sel),rg,val); c.append(it);
  });
  const g=el('div','planGrid'); g.append(kitMonto('Ingreso extra por mes (opcional)',()=>st.extra,x=>{ st.extra=x; },pinta,pinta,'Monto'));
  c.append(g,out); pinta();
  kitP(c,'Es una proyección con tus promedios: no cambia nada en tu libro.','hint');
}

/* ---------- 5) Gastos compartidos ---------- */
function kitCompartidos(v){
  const P=extras.cpPersonas, nom=id=>{ const p=P.find(x=>x.id===id); return p?p.n:'(quitada)'; };
  const c=kitSec(v,'Para un viaje, la casa o una salida: anota quién pagó cada gasto y la app calcula quién le debe a quién para quedar a mano.',true);
  /* personas */
  const t0=el('p'); t0.style.cssText='margin:6px 4px; font-weight:700'; t0.textContent='Quiénes comparten'; c.append(t0);
  const chips=el('div','kitChips');
  P.forEach(p=>{
    const s=el('span','kitChip'); s.append(document.createTextNode(p.n));
    s.append(delBtn(()=>{
      if(extras.cpGastos.some(g=>g.quien===p.id||(g.entre||[]).includes(p.id))||extras.cpPagos.some(x=>x.de===p.id||x.a===p.id)){ toast('No se puede quitar: ya tiene gastos o pagos. Primero borra esos movimientos.'); return; }
      extras.cpPersonas=extras.cpPersonas.filter(x=>x!==p); saveExtras(); renderKit();
    }));
    chips.append(s);
  });
  c.append(chips);
  const nuevo=el('input','txt'); nuevo.type='text'; nuevo.maxLength=30; nuevo.placeholder='Nombre (ej: Ana)'; nuevo.setAttribute('aria-label','Nombre de la persona'); nuevo.autocomplete='off';
  const addP=el('button','btn'); addP.type='button'; addP.textContent='＋ Agregar persona';
  const agregarPersona=n=>{ if(extras.cpPersonas.length>=8){ toast('Máximo 8 personas'); return false; } extras.cpPersonas.push({id:shortId(uid()),n:capIni(n).slice(0,30)}); return true; };
  addP.addEventListener('click',()=>{ const n=nuevo.value.trim(); if(!n){ toast('Escribe el nombre'); return; } if(agregarPersona(n)){ saveExtras(); renderKit(); } });
  const fp=el('div','notaAdd'); fp.style.cssText='display:flex; gap:8px; flex-wrap:wrap; margin-top:8px'; nuevo.style.flex='1 1 160px'; fp.append(nuevo,addP); c.append(fp);
  if(P.length<2){
    const q=el('button','btn primary'); q.type='button'; q.textContent='Usar «Yo» y «Mi pareja»'; q.style.marginTop='10px';
    q.addEventListener('click',()=>{ if(!P.length) agregarPersona('Yo'); while(extras.cpPersonas.length<2) agregarPersona('Mi pareja'); saveExtras(); renderKit(); });
    c.append(q); kitP(c,'Agrega al menos dos personas para empezar.'); return;
  }
  /* nuevo gasto */
  const c2=kitSec(v,null); const h2=el('h2'); h2.textContent='Anotar un gasto'; c2.append(h2);
  const st=kitSt.cp||(kitSt.cp={quien:'',n:'',m:null,f:'',entre:null});
  if(!P.some(x=>x.id===st.quien)) st.quien=P[0].id;
  if(!st.f) st.f=hoyISO();
  st.entre=(st.entre||P.map(x=>x.id)).filter(i=>P.some(x=>x.id===i)); if(!st.entre.length) st.entre=P.map(x=>x.id);
  const fi=el('input','txt'); fi.type='text'; fi.maxLength=60; fi.placeholder='Concepto (ej: Cena)'; fi.value=st.n; fi.setAttribute('aria-label','Concepto'); fi.autocomplete='off'; fi.addEventListener('input',()=>{ st.n=fi.value; });
  const fd=el('input','txt'); fd.type='date'; fd.value=st.f; fd.setAttribute('aria-label','Fecha'); fd.addEventListener('change',()=>{ st.f=fd.value; });
  const g=el('div','planGrid');
  g.append(lbl('Concepto',fi),kitMonto('Monto',()=>st.m,x=>{ st.m=x; }),lbl('Pagó',kitSelect(P.map(x=>[x.id,x.n]),st.quien,x=>{ st.quien=x; },'Quién pagó')),lbl('Fecha',fd));
  c2.append(g);
  const ent=el('div','kitChips'); ent.style.marginTop='8px';
  const e0=el('p','small'); e0.style.margin='8px 4px 0'; e0.textContent='Se reparte en partes iguales entre:'; c2.append(e0);
  P.forEach(p=>{
    const l=el('label','kitChk'); const ck=el('input'); ck.type='checkbox'; ck.checked=st.entre.includes(p.id);
    ck.addEventListener('change',()=>{ st.entre=ck.checked?[...new Set([...st.entre,p.id])]:st.entre.filter(i=>i!==p.id); });
    l.append(ck,document.createTextNode(' '+p.n)); ent.append(l);
  });
  c2.append(ent);
  const ab=el('button','btn primary'); ab.type='button'; ab.textContent='Agregar gasto'; ab.style.marginTop='10px';
  ab.addEventListener('click',()=>{
    if(!(st.m>0)){ toast('Escribe el monto'); return; }
    if(!st.entre.length){ toast('Elige entre quiénes se reparte'); return; }
    if(extras.cpGastos.length>=300){ toast('Llegaste al máximo de gastos: borra los viejos o empieza de nuevo'); return; }
    extras.cpGastos.push({id:shortId(uid()),f:st.f,n:capIni(st.n.trim())||'Gasto compartido',quien:st.quien,m:st.m,entre:P.length===st.entre.length?[]:st.entre.slice()});
    st.n=''; st.m=null; saveExtras(); toast('Gasto anotado'); renderKit();
  });
  c2.append(ab);
  /* quién le debe a quién */
  const c3=kitSec(v,null); const h3=el('h2'); h3.textContent='Cómo están las cuentas'; c3.append(h3);
  const r=cpSaldos(P,extras.cpGastos,extras.cpPagos);
  P.forEach(p=>{ const s=r.saldo[p.id]; kitP(c3,p.n+': '+(s>0.005?'le deben '+cf.format(s):(s<-0.005?'debe '+cf.format(-s):'está a mano')),s>0.005?'small pos':(s<-0.005?'small neg':'small')); });
  if(!r.mov.length){ kitP(c3,extras.cpGastos.length?'✓ Todo a mano: nadie le debe nada a nadie.':'Cuando anotes gastos, aquí verás quién le debe a quién.','small pos'); }
  r.mov.forEach(m=>{
    const row=el('div','planTop'); row.style.margin='8px 0';
    const tx=el('b'); tx.style.flex='1'; tx.textContent=nom(m.de)+' le paga '+cf.format(m.m)+' a '+nom(m.a);
    const pb=el('button','btn'); pb.type='button'; pb.textContent='Ya pagó';
    pb.addEventListener('click',()=>{ if(extras.cpPagos.length>=200) extras.cpPagos.shift(); extras.cpPagos.push({id:shortId(uid()),f:hoyISO(),de:m.de,a:m.a,m:m.m}); saveExtras(); toast('Pago registrado'); renderKit(); });
    row.append(tx,pb); c3.append(row);
  });
  const tools=el('div','tools');
  if(r.mov.length){ const sb=el('button','btn'); sb.type='button'; sb.textContent='Compartir resumen'; sb.addEventListener('click',()=>kitCompartirTexto('Gastos compartidos — Libro de Finanzas\n'+r.mov.map(m=>nom(m.de)+' le paga '+cf.format(m.m)+' a '+nom(m.a)).join('\n'),'Gastos compartidos')); tools.append(sb); }
  c3.append(tools);
  /* movimientos */
  if(extras.cpGastos.length||extras.cpPagos.length){
    const c4=kitSec(v,null); const h4=el('h2'); h4.textContent='Movimientos'; c4.append(h4);
    const todos=[...extras.cpGastos.map(g=>({t:'g',x:g})),...extras.cpPagos.map(p=>({t:'p',x:p}))].sort((a,b)=>(b.x.f||'')<(a.x.f||'')?-1:1).slice(0,40);
    todos.forEach(({t,x})=>{
      const row=el('div','planTop'); row.style.cssText+='; border-top:1px solid var(--line); padding:8px 0';
      const tx=el('div'); tx.style.flex='1'; const a=el('b'); const b=el('span','small'); b.style.display='block';
      const f=(x.f||'').split('-').reverse().join('/');
      if(t==='g'){ a.textContent=x.n+' · '+cf.format(x.m); b.textContent=f+' · pagó '+nom(x.quien)+' · entre '+((x.entre&&x.entre.length)?x.entre.length:P.length); }
      else { a.textContent='Pago: '+nom(x.de)+' → '+nom(x.a)+' · '+cf.format(x.m); b.textContent=f; }
      tx.append(a,b);
      row.append(tx,delBtn(()=>{ if(t==='g') extras.cpGastos=extras.cpGastos.filter(i=>i!==x); else extras.cpPagos=extras.cpPagos.filter(i=>i!==x); saveExtras(); renderKit(); }));
      c4.append(row);
    });
    const rb=el('button','btn danger'); rb.type='button'; rb.textContent='Borrar todos los movimientos'; rb.style.marginTop='10px';
    rb.addEventListener('click',()=>{ const p=el('p'); p.textContent='Se borrarán todos los gastos y pagos compartidos (las personas se quedan). Esto no se puede deshacer.'; modal('¿Empezar de nuevo?',p,[{label:'Cancelar'},{label:'Borrar',cls:'danger',onClick:()=>{ extras.cpGastos=[]; extras.cpPagos=[]; saveExtras(); renderKit(); }}]); });
    c4.append(rb);
  }
}

/* ---------- 6) Suscripciones ---------- */
function kitSubsDatos(){
  const ultimos=Object.keys(months).filter(m=>!cur||m<=cur).sort().reverse().slice(0,4);
  const plat=(cur&&months[cur])?QS.flatMap(q=>autoPlat(months[cur][q])):[];
  return subsUnir(extras.recurrentes,plat,subsDetectar(months,ultimos));
}
function kitSubs(v){
  const c=kitSec(v,'Todos tus cobros que se repiten: gastos recurrentes, plataformas y los que la app detecta que aparecen mes tras mes. Mira cuánto suman al año.',true);
  const lista=kitSubsDatos();
  if(!lista.length){ c.append(estadoVacio('recurrente','Aún no hay cobros que se repitan','Anota tus suscripciones como gastos recurrentes o márcalas como plataformas en tus egresos y aparecerán aquí.','Cargar gastos recurrentes',()=>kitIrA('plan'))); return; }
  const mes=lista.reduce((s,x)=>s+x.m,0), ing=cur&&months[cur]?monthTotals(cur).ingresos:0;
  kitBig(c,cf.format(mes)+' por mes');
  kitP(c,'Son '+cf.format(mes*12)+' al año en '+lista.length+(lista.length===1?' cobro':' cobros')+(ing>0?' ('+pctTxt(mes/ing)+' de tu ingreso de '+monthLabel(cur)+')':'')+'. El más caro es «'+lista[0].n+'» ('+cf.format(lista[0].m)+' al mes).');
  const hoy=new Date();
  lista.forEach(s=>{
    const it=el('div','planItem'); const t=el('div','planTop'); const n=el('b'); n.style.flex='1'; n.textContent=s.n; const m=el('b'); m.textContent=cf.format(s.m); t.append(n,m); it.append(t);
    let d=cf.format(s.m*12)+' al año';
    if(s.fuente==='recurrente'&&s.dia){ const k=subsDiasHasta(s.dia,hoy); d+=' · se cobra el día '+s.dia+' ('+textoDias(k)+')'; }
    else if(s.fuente==='plataforma') d+=' · plataforma o servicio';
    else d+=' · parece recurrente: aparece en 3 o más de tus últimos meses';
    kitP(it,d);
    if(s.fuente==='detectado'){
      const b=el('button','btn'); b.type='button'; b.textContent='Cargar como gasto recurrente';
      b.addEventListener('click',()=>{ if(extras.recurrentes.length>=40){ toast('Llegaste al máximo de gastos recurrentes'); return; } extras.recurrentes.push({id:shortId(uid()),n:s.n,m:s.m,cat:'',dia:1,generado:cur||kitMes()}); saveExtras(); toast('Listo. Ajusta el día y la categoría en Metas y deudas'); renderKit(); });
      it.append(b);
    }
    c.append(it);
  });
  kitP(c,'Revisa cada tanto si usas todas: cancelar una que no usas es ahorro seguro.','hint');
}

/* ---------- 8) Reporte mensual ---------- */
function repMesHTML(d){
  const td='style="padding:6px 8px; border-bottom:1px solid #e4e8f0; text-align:right"', tdl='style="padding:6px 8px; border-bottom:1px solid #e4e8f0; text-align:left"';
  const mx=Math.max(1,...d.cats.map(([,x])=>x));
  let h='<div style="font-family:Arial,Helvetica,sans-serif; color:#111827; background:#fff; padding:28px">'+
   '<h1 style="margin:0; color:#0f2a52; font-size:26px">Libro de Finanzas — '+esc(monthLabel(d.id))+'</h1>'+
   '<p style="margin:4px 0 18px; color:#5d6679; font-size:13px">Un hogar organizado con propósito · Generado el '+esc(new Date().toLocaleDateString('es-AR'))+'</p>'+
   '<table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:16px"><tr>'+
   [['Ingresos',d.ingresos],['Egresos',d.egresos],['Fondo de emergencia',d.fondo],['Balance',d.balance]].map(([l,x])=>'<td style="padding:10px; background:#eef2f9; width:25%"><div style="font-size:12px; color:#5d6679">'+l+'</div><b style="font-size:16px">'+esc(cf.format(x))+'</b></td>').join('<td style="width:6px"></td>')+'</tr></table>';
  if(d.anterior&&d.anterior.egresos>0){ const dif=d.egresos-d.anterior.egresos; h+='<p style="font-size:13px">Contra '+esc(monthLabel(d.anterior.id))+': gastaste <b>'+(dif>=0?'▲ ':'▼ ')+esc(cf.format(Math.abs(dif)))+'</b> '+(dif>=0?'más':'menos')+'.</p>'; }
  if(d.cats.length){
    h+='<h3 style="color:#0f2a52; font-size:15px; margin:16px 0 6px">En qué se fue el dinero</h3>';
    d.cats.forEach(([c,x])=>{ h+='<div style="font-size:13px; margin:5px 0"><div style="display:flex; justify-content:space-between"><span>'+esc(c)+'</span><b>'+esc(cf.format(x))+'</b></div><div style="background:#eef2f9; height:10px; border-radius:5px"><div style="width:'+Math.max(2,x/mx*100).toFixed(0)+'%; background:#f28c28; height:10px; border-radius:5px"></div></div></div>'; });
  }
  if(d.top.length){
    h+='<h3 style="color:#0f2a52; font-size:15px; margin:16px 0 6px">Mayores gastos del mes</h3><table style="width:100%; border-collapse:collapse; font-size:13px">';
    d.top.forEach(x=>{ h+='<tr><td '+tdl+'>'+esc(x.n)+(x.cat?' <span style="color:#5d6679">· '+esc(x.cat)+'</span>':'')+'</td><td '+td+'>'+esc(cf.format(x.m))+'</td></tr>'; });
    h+='</table>';
  }
  return h+'<p style="font-size:11px; color:#5d6679; margin-top:14px">Moneda: '+esc(moneda.n)+' ('+esc(moneda.c)+'). Reporte informativo generado en tu teléfono.</p></div>';
}
function kitReporte(v){
  const c=kitSec(v,'Un resumen de una página de cualquier mes, listo para guardar en PDF, como imagen o para compartir.',true);
  const ids=Object.keys(months).sort().reverse();
  if(!ids.length){ kitP(c,'Todavía no hay meses cargados.'); return; }
  const st=kitSt.rep||(kitSt.rep={id:''}); if(!months[st.id]) st.id=(cur&&months[cur])?cur:ids[0];
  const sel=kitSelect(ids.map(i=>[i,monthLabel(i)]),st.id,x=>{ st.id=x; renderKit(); },'Mes del reporte');
  c.append(lbl('Mes',sel));
  const d=repMesDatos(st.id);
  const k=el('div','kpis'); k.style.marginTop='10px';
  [['Ingresos',d.ingresos],['Egresos',d.egresos],['Balance',d.balance]].forEach(([l,x])=>{ const dv=el('div','kpi'+(l==='Balance'?' soft':'')); const s=el('span'); s.textContent=l; const b=el('b'); b.textContent=cf.format(x); if(l==='Balance') b.classList.add(x<0?'neg':'pos'); dv.append(s,b); k.append(dv); });
  c.append(k);
  if(d.anterior&&d.anterior.egresos>0){ const dif=d.egresos-d.anterior.egresos; kitP(c,'Contra '+monthLabel(d.anterior.id)+': gastaste '+(dif>=0?'▲ ':'▼ ')+cf.format(Math.abs(dif))+(dif>=0?' más.':' menos.'),dif>0?'small neg':'small pos'); }
  if(d.cats.length){ kitP(c,'En qué se fue el dinero:'); d.cats.slice(0,3).forEach(([k2,x])=>kitP(c,'· '+k2+': '+cf.format(x)+' ('+pctTxt(d.catsTotal>0?x/d.catsTotal:0)+')')); }
  if(d.top.length){ kitP(c,'Mayores gastos:'); d.top.slice(0,3).forEach(x=>kitP(c,'· '+x.n+': '+cf.format(x.m))); }
  const tools=el('div','tools');
  const bp=el('button','btn primary'); bp.type='button'; bp.textContent='Descargar PDF'; bp.addEventListener('click',()=>captureAndDeliver(repMesHTML(d),680,'libro-finanzas-'+st.id,'pdf'));
  const bi=el('button','btn'); bi.type='button'; bi.textContent='Descargar imagen'; bi.addEventListener('click',()=>captureAndDeliver(repMesHTML(d),680,'libro-finanzas-'+st.id,'jpg'));
  const bs=el('button','btn'); bs.type='button'; bs.textContent='Compartir texto'; bs.addEventListener('click',()=>kitCompartirTexto(repMesTexto(d),'Resumen de '+monthLabel(st.id)));
  tools.append(bp,bi,bs); c.append(tools);
}

/* ---------- 9) Alertas de gasto inusual ---------- */
function kitAlertasDatos(){
  if(!cur||!months[cur]) return null;
  const previos=kitPrevios(cur,3);
  const r=alertasCalc(kitCatMes(cur),previos.map(kitCatMes),monthTotals(cur).ingresos,cur<kitMes());
  return {...r,previos};
}
function kitAlertas(v){
  const c=kitSec(v,'Te aviso con calma cuando una categoría se sale de tu promedio de los últimos 3 meses, para que revises si fue algo puntual.',true);
  const r=kitAlertasDatos();
  if(!r){ kitP(c,'Abre un mes para ver los avisos.'); return; }
  if(r.n<2){ kitP(c,'Necesito al menos 2 meses anteriores con gastos por categoría para comparar. Sigue cargando tus egresos con su categoría y volverás a ver esto con avisos.'); return; }
  kitP(c,'Se compara '+monthLabel(cur)+' con tus '+r.n+' meses anteriores.'+(cur===kitMes()?' Como el mes sigue en curso, los gastos pueden seguir subiendo.':''));
  if(!r.alertas.length) kitP(c,'✓ Todo en orden: ninguna categoría se salió de tu promedio.','small pos');
  r.alertas.forEach(a=>{
    const it=el('div','planItem'+(a.nivel==='alto'?' kitAlto':'')); const t=el('div','planTop'); const n=el('b'); n.style.flex='1'; n.textContent=(a.nivel==='alto'?'⚠ ':'• ')+a.c; const m=el('b'); m.className='neg'; m.textContent='▲ '+Math.round(a.pct*100)+' %'; t.append(n,m); it.append(t);
    kitP(it,'Llevas '+cf.format(a.actual)+' y tu promedio es '+cf.format(a.prom)+' ('+cf.format(a.dif)+' de más). ¿Fue algo puntual?');
    c.append(it);
  });
  if(r.mejor.length){ kitP(c,'Vas mejor que tu promedio en:'); r.mejor.forEach(a=>kitP(c,'▼ '+a.c+': '+cf.format(a.actual)+' contra '+cf.format(a.prom)+' de promedio','small pos')); }
}

/* ---------- 10) Largo plazo ---------- */
function kitFuturo(v){
  const c=kitSec(v,'Mira en qué se puede convertir lo que ahorras si lo aportas cada mes durante años. Es una simulación con números que tú eliges.',true);
  const st=kitSt.fu||(kitSt.fu={inicial:null,aporte:null,tasa:8,infl:3,anios:20,meta:null});
  const out=el('div'); out.setAttribute('aria-live','polite');
  const pinta=()=>{
    out.replaceChildren();
    if(!(num(st.inicial)>0||num(st.aporte)>0)){ kitP(out,'Escribe cuánto tienes hoy y/o cuánto puedes aportar por mes.'); return; }
    const anios=[...new Set([10,20,30,Math.round(num(st.anios))].filter(a=>a>=1&&a<=60))].sort((a,b)=>a-b);
    const tbl=el('div'); tbl.style.cssText='display:grid; grid-template-columns:auto 1fr 1fr; gap:6px 12px; font-size:13px; margin:10px 4px';
    ['Años','Tendrías','Tú pondrías'].forEach(h=>{ const b=el('b'); b.textContent=h; tbl.append(b); });
    anios.forEach(a=>{
      const r=futuroCalc(st.inicial,st.aporte,st.tasa,a,st.infl); if(!r) return;
      const x=el('b'); x.textContent=a+(a===Math.round(num(st.anios))?' ★':''); const y=el('span'); y.textContent=cf.format(r.total)+(num(st.infl)>0?' (hoy valdría '+cf.format(r.real)+')':''); const z=el('span'); z.textContent=cf.format(r.aportado)+' · ganancia '+cf.format(r.ganancia);
      tbl.append(x,y,z);
    });
    out.append(tbl);
    kitP(out,'★ = los años que elegiste arriba. «Hoy valdría» descuenta la inflación.','hint');
    if(num(st.meta)>0){ const ap=futuroAporte(st.meta,st.inicial,st.tasa,st.anios); kitP(out,ap===0?'Con lo que tienes hoy ya llegarías a '+cf.format(st.meta)+' en '+st.anios+' años.':'Para llegar a '+cf.format(st.meta)+' en '+Math.round(num(st.anios))+' años necesitas aportar unos '+cf.format(ap)+' por mes.','small pos'); }
    kitP(out,'Si la tasa real es distinta, el resultado cambia. Prueba con una tasa más baja para ser prudente.','hint');
  };
  const g=el('div','planGrid');
  g.append(kitMonto('Lo que tienes hoy',()=>st.inicial,x=>{ st.inicial=x; },pinta,pinta),
           kitMonto('Aporte por mes',()=>st.aporte,x=>{ st.aporte=x; },pinta,pinta),
           kitMonto('Rendimiento anual (%)',()=>st.tasa,x=>{ st.tasa=x; },pinta,pinta,'%'),
           kitMonto('Inflación anual (%)',()=>st.infl,x=>{ st.infl=x; },pinta,pinta,'%'),
           kitMonto('Años (1 a 60)',()=>st.anios,x=>{ st.anios=x; },pinta,pinta,'Años'),
           kitMonto('Quiero llegar a (opcional)',()=>st.meta,x=>{ st.meta=x; },pinta,pinta,'Meta'));
  c.append(g);
  const aprom=kitPromFondo();
  if(aprom>0){ const b=el('button','btn'); b.type='button'; b.textContent='Usar mi aporte al fondo ('+cf.format(aprom)+')'; b.style.marginTop='8px'; b.addEventListener('click',()=>{ st.aporte=Math.round(aprom); renderKit(); }); c.append(b); }
  c.append(out); pinta();
  kitP(c,'Esto es solo un cálculo para orientarte, no una promesa de ganancia ni una recomendación de inversión. Los rendimientos reales suben y bajan.','hint');
}
function kitPromFondo(){
  const t=Object.keys(months).filter(m=>!cur||m<=cur).sort().slice(-3).map(id=>monthTotals(id).fondo);
  return t.length?t.reduce((a,b)=>a+b,0)/t.length:0;
}

/* ---------- Lista de asistentes y menú ---------- */
const KIT=[
 {k:'fondo',ic:'kFondo',n:'Fondo de emergencia',d:'Cuántos meses de gastos tienes cubiertos',f:kitFondo},
 {k:'simula',ic:'kSimula',n:'Simulador «¿y si…?»',d:'Prueba un recorte o un ingreso extra',f:kitSimula},
 {k:'compartidos',ic:'kCompartir',n:'Gastos compartidos',d:'Quién le debe a quién',f:kitCompartidos},
 {k:'subs',ic:'kSubs',n:'Suscripciones',d:'Todo lo que se cobra solo',f:kitSubs},
 {k:'reporte',ic:'kReporte',n:'Reporte del mes',d:'Una página en PDF o imagen',f:kitReporte},
 {k:'alertas',ic:'kAlerta',n:'Alertas de gasto',d:'Avisos cuando algo se sale de lo normal',f:kitAlertas},
 {k:'futuro',ic:'kFuturo',n:'Largo plazo',d:'Qué pasa si ahorras por años',f:kitFuturo}
];
/* Texto corto en vivo de cada tarjeta del menú (si algo falla, se deja sin texto). */
function kitResumen(k){
  try{
    if(!cur||!months[cur]) return '';
    if(k==='fondo'){ const ids=Object.keys(months).filter(m=>m<=cur).sort(), ap=ids.reduce((s,id)=>s+monthTotals(id).fondo,0), r=feCalc(num(extras.feBase)+ap,kitPromMeses(cur,6).egresos,extras.feMeses); return r?('Cubres '+kitNum1(r.meses)+(kitNum1(r.meses)==='1'?' mes':' meses')):''; }
    if(k==='compartidos'){ if(extras.cpPersonas.length<2) return 'Sin configurar'; const r=cpSaldos(extras.cpPersonas,extras.cpGastos,extras.cpPagos); return r.mov.length?(r.mov.length+(r.mov.length===1?' pago pendiente':' pagos pendientes')):'Todo a mano'; }
    if(k==='subs'){ const l=kitSubsDatos(); return l.length?(l.length+' · '+cf.format(l.reduce((s,x)=>s+x.m,0))+'/mes'):''; }
    if(k==='reporte') return monthLabel(cur);
    if(k==='alertas'){ const r=kitAlertasDatos(); if(!r||r.n<2) return 'Faltan meses'; return r.alertas.length?(r.alertas.length+(r.alertas.length===1?' aviso':' avisos')):'Todo en orden'; }
  }catch(e){}
  return '';
}
let kitSel=null;
function buildKit(){ const v=el('div'); v.id='view-kit'; v.hidden=true; return v; }
function renderKit(){
  const v=document.getElementById('view-kit'); if(!v) return;
  v.replaceChildren();
  const t=KIT.find(x=>x.k===kitSel);
  if(!t){
    const c=kitSec(v,'Siete ayudas para decidir mejor con tu dinero. Se calculan con lo que ya cargaste en el libro y solo guardan lo mínimo, siempre cifrado dentro de tu hogar.',true);
    const h=el('h2'); h.textContent='Asistentes'; c.prepend(h);
    const g=el('div','kitGrid');
    KIT.forEach(x=>{
      const b=el('button','kitTile'); b.type='button'; b.dataset.k=x.k;
      b.innerHTML='<span class="bub">'+icono(x.ic)+'</span><b></b><small></small><em></em>';
      b.querySelector('b').textContent=x.n; b.querySelector('small').textContent=x.d; b.querySelector('em').textContent=kitResumen(x.k);
      b.addEventListener('click',()=>{ kitSel=x.k; renderKit(); window.scrollTo(0,0); });
      g.append(b);
    });
    c.append(g); return;
  }
  const bar=el('div','kitBar'); const back=el('button','btn'); back.type='button'; back.textContent='‹ Asistentes';
  back.addEventListener('click',()=>{ kitSel=null; renderKit(); window.scrollTo(0,0); });
  const h=el('h2'); h.textContent=t.n; bar.append(back,h); v.append(bar);
  try{ t.f(v); }catch(e){ const p=el('p','small'); p.textContent='No se pudo mostrar este asistente. Vuelve atrás e inténtalo de nuevo.'; v.append(p); }
}
