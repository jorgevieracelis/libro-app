'use strict';
/* Cálculos en pantalla y consejos del mes */
/* ---------- Cálculos en pantalla ---------- */
function refreshComputed(){
  const md=months[cur]; if(!md) return;
  const C={}; QS.forEach(q=>{ C[q]=calc(md[q],md); C[q].tarjeta=monthTarjetaTotal(cur,q); });
  QS.forEach(qq=>{
    const items=activeCuotasFor(cur,qq);
    C[qq].tarjetaSimple=items.filter(it=>it.totalCuotas===1).reduce((s,it)=>s+it.amount,0);
    C[qq].tarjetaCuotas=items.filter(it=>it.totalCuotas>1).reduce((s,it)=>s+it.amount,0);
  });
  const S=k=>QS.reduce((s,q)=>s+C[q][k],0);
  const mes={ingresos:S('ingresos'), egresos:S('egresos'), antic:S('antic'), egresosTotales:S('egresosTotales'),
             fondo:S('fondo'), retiro:S('retiro'), tarjeta:S('tarjeta'), platTotal:0};
  mes.balance=mes.ingresos-mes.egresosTotales-mes.fondo;
  mes.pct=mes.ingresos>0?mes.egresosTotales/mes.ingresos:0;
  mes.disponibleTarjeta=(months[cur].limiteTarjeta!=null)?(months[cur].limiteTarjeta-mes.tarjeta):0;
  C.mes=mes;
  document.querySelectorAll('[data-k]').forEach(e=>{
    const p=e.dataset.k.split('.'); const v=C[p[0]]&&C[p[0]][p[1]]; if(v===undefined) return;
    e.textContent=p[1]==='pct'?(Math.round(v*1000)/10).toString().replace('.',',')+' %':cf.format(v);
    if(p[1]==='balance'){ e.classList.toggle('neg',v<0); e.classList.toggle('pos',v>=0); }
    if(p[1]==='disponibleTarjeta'){ e.classList.toggle('neg',v<0); e.classList.toggle('pos',v>=0); }
  });
  const tcWarn=document.getElementById('tcWarn');
  if(tcWarn){
    const lim=months[cur].limiteTarjeta;
    if(lim!=null && lim>0){
      const disp=mes.disponibleTarjeta, pct=disp/lim;
      if(disp<0){ tcWarn.hidden=false; tcWarn.textContent='⚠ Te pasaste del límite por '+cf.format(-disp)+'.'; tcWarn.className='warnBox warnBad'; }
      else if(pct<=0.15){ tcWarn.hidden=false; tcWarn.textContent='⚠ Te queda poco límite disponible ('+cf.format(disp)+').'; tcWarn.className='warnBox'; }
      else tcWarn.hidden=true;
    } else tcWarn.hidden=true;
  }
  QS.forEach(q=>{
    md[q].plataformas.forEach(p=>{
      const a=document.querySelector('[data-aut="'+p.id+'"]');
      if(a) a.textContent=cf.format(num(p.m));
    });
  });
  const mx=Math.max(1,...QS.flatMap(q=>[C[q].ingresos,C[q].egresosTotales]));
  document.querySelectorAll('[data-bar]').forEach(b=>{
    const p=b.dataset.bar.split('.'); b.style.width=Math.max(0,Math.min(100,C[p[0]][p[1]]/mx*100))+'%';
  });
  document.querySelectorAll('[data-barv]').forEach(b=>{
    const p=b.dataset.barv.split('.'); b.textContent=cf.format(C[p[0]][p[1]]);
  });
  renderPie(md);
  renderPresupuesto(); renderVenc();
  renderConsejos(md,mes);
}
/* ---------- Consejos del mes (reglas simples, calculadas en el teléfono) ---------- */
const pctTxt=x=>(Math.round(x*1000)/10).toString().replace('.',',')+' %';
function consejosMes(md,mes){
  const out=[]; // {p:prioridad (menor=primero), t:'warn'|'ok'|'info', x:texto}
  const add=(p,t,x)=>out.push({p,t,x});
  const ing=mes.ingresos, eg=mes.egresosTotales;
  if(!(ing>0)){ add(0,'info','Carga tus ingresos del mes para que la app pueda darte consejos.'); return out; }
  const bal=mes.balance;
  const totals=monthCategoryTotals(md);
  QS.flatMap(q=>activeCuotasFor(cur,q)).forEach(it=>{ if(it.amount>0){ const k=it.row.cat||'Tarjeta de crédito'; totals[k]=(totals[k]||0)+it.amount; } });
  const totalCat=Object.values(totals).reduce((s,v)=>s+v,0);
  // 1) Balance y porcentaje gastado
  if(bal<0) add(1,'warn','Este mes gastas '+cf.format(-bal)+' más de lo que ingresa. Revisa tus egresos variables y qué puedes recortar o postergar.');
  else if(mes.pct>=0.9) add(2,'warn','Estás gastando el '+pctTxt(mes.pct)+' de tu ingreso: te queda muy poco margen para imprevistos.');
  else if(mes.pct>=0.8) add(4,'info','Gastas el '+pctTxt(mes.pct)+' de tu ingreso. Una guía útil es dejar al menos un 20 % para ahorro y emergencias.');
  else add(8,'ok','Vas bien: gastas el '+pctTxt(mes.pct)+' de tu ingreso y te sobran '+cf.format(bal)+'.');
  // 2) Fondo de emergencia
  if(mes.fondo<=0) add(3,'info','Este mes no aportas al fondo de emergencia. Empezar con el 5 a 10 % del ingreso (unos '+cf.format(ing*0.05)+' a '+cf.format(ing*0.1)+') ayuda a cubrir imprevistos sin endeudarte.');
  else add(9,'ok','Aportas '+cf.format(mes.fondo)+' al fondo de emergencia ('+pctTxt(mes.fondo/ing)+' del ingreso). Sigue así.');
  // 3) Vivienda
  const viv=totals['Vivienda']||0;
  if(viv/ing>0.35) add(3,'warn','Vivienda (alquiler, cuota, expensas) ocupa el '+pctTxt(viv/ing)+' del ingreso. Lo recomendable es no superar un 30 a 35 %.');
  // 4) Categoría dominante
  const top=Object.entries(totals).filter(([k])=>k!=='Sin categoría'&&k!=='Vivienda').sort((a,b)=>b[1]-a[1])[0];
  if(top && totalCat>0 && top[1]/ing>0.25) add(5,'info','"'+top[0]+'" es tu categoría más pesada: '+cf.format(top[1])+' ('+pctTxt(top[1]/ing)+' del ingreso). Mira si hay algo para ajustar ahí.');
  // 5) Suscripciones
  const plat=QS.reduce((s,q)=>s+autoPlat(md[q]).reduce((a,p)=>a+num(p.m),0),0);
  if(plat/ing>0.08) add(5,'info','Plataformas y suscripciones suman '+cf.format(plat)+' ('+pctTxt(plat/ing)+' del ingreso). Revisa si todas las usas.');
  // 6) Tarjeta
  const lim=md.limiteTarjeta;
  if(lim!=null&&lim>0&&mes.tarjeta/lim>0.7) add(2,'warn','Usaste el '+pctTxt(mes.tarjeta/lim)+' del límite de tu tarjeta. Mantenerlo bajo el 30 a 50 % cuida tu capacidad de pago.');
  const cuotas=QS.flatMap(q=>activeCuotasFor(cur,q)).filter(it=>it.totalCuotas>1).reduce((s,it)=>s+it.amount,0);
  if(cuotas/ing>0.2) add(4,'info','Las cuotas de tarjeta ya comprometen el '+pctTxt(cuotas/ing)+' de tu ingreso. Antes de sumar otra compra en cuotas, conviene terminar las actuales.');
  // 6b) Presupuesto por categoría
  Object.entries(extras.presupuesto).forEach(([c,tope])=>{ const g=num(totals[c]); if(tope>0){ if(g>=tope) add(2,'warn','Superaste el tope de '+c+': gastaste '+cf.format(g)+' de '+cf.format(tope)+'.'); else if(g>=tope*0.8) add(3,'info','Estás al '+pctTxt(g/tope)+' del tope de '+c+' ('+cf.format(g)+' de '+cf.format(tope)+').'); } });
  // 6c) Deudas
  const cuotasDeuda=extras.deudas.reduce((s,d)=>s+num(d.cuota),0);
  if(cuotasDeuda/ing>0.3) add(2,'warn','Las cuotas de tus deudas suman el '+pctTxt(cuotasDeuda/ing)+' de tu ingreso. Pasar del 30 % deja poco margen: mira la pestaña Metas y deudas para armar un plan.');
  // 7) Gastos sin categoría
  const sinCat=totals['Sin categoría']||0;
  if(sinCat>0) add(7,'info','Hay '+cf.format(sinCat)+' en gastos sin categoría. Si les pones una, los consejos y el gráfico serán más precisos.');
  // 8) Comparación con el mes anterior
  const prevId=Object.keys(months).sort().filter(id=>id<cur).pop();
  if(prevId){
    const pt=monthTotals(prevId);
    if(pt.egresos>0 && eg>pt.egresos*1.15) add(4,'info','Tus egresos subieron un '+pctTxt(eg/pt.egresos-1)+' frente a '+monthLabel(prevId)+' ('+cf.format(pt.egresos)+' antes).');
    else if(pt.egresos>0 && eg<pt.egresos*0.9 && eg>0) add(9,'ok','Tus egresos bajaron un '+pctTxt(1-eg/pt.egresos)+' frente a '+monthLabel(prevId)+'. ¡Buen trabajo!');
  }
  // 9) Meta de ahorro en dólares (si hay cotización y no es USD)
  const A=num(ahorro.ahorrado), Cz=moneda.c==='USD'?0:num(ahorro.cotizacion), M=num(ahorro.meta);
  if(M>A && Cz>0 && ahorro.fechaMeta){
    const meses=monthDiff(currentMonthId(),ahorro.fechaMeta);
    if(meses>0){ const pm=(M-A)/meses*Cz;
      if(bal>0 && bal>=pm) add(6,'ok','Para tu meta en dólares necesitas ahorrar unos '+cf.format(pm)+' por mes y este mes te sobran '+cf.format(bal)+': ¡alcanza!');
      else add(5,'info','Para tu meta en dólares necesitas ahorrar unos '+cf.format(pm)+' por mes'+(bal>0?', y este mes te sobran '+cf.format(bal)+'.':'. Hoy tu balance no alcanza; ajusta la meta o los gastos.')); }
  }
  return out;
}
let consejosAbiertos=false, consejosPag=0, consejosCtx=null;
const CONSEJOS_POR_PAG=3;
function consejosCerrar(){
  consejosAbiertos=false; consejosPag=0;
  const host=document.getElementById('consejosCard'); if(host) host.hidden=true;
  const b=document.getElementById('consejosBtn'); if(b) b.setAttribute('aria-expanded','false');
}
function renderConsejos(md,mes){
  consejosCtx={md,mes};
  const host=document.getElementById('consejosCard'); if(!host) return;
  const btn=document.getElementById('consejosBtn');
  if(btn && !btn.dataset.ok){ btn.dataset.ok='1'; btn.addEventListener('click',()=>{ if(consejosAbiertos){ consejosCerrar(); } else { consejosAbiertos=true; consejosPag=0; if(consejosCtx) renderConsejos(consejosCtx.md,consejosCtx.mes); } }); }
  host.hidden=!consejosAbiertos;
  if(btn) btn.setAttribute('aria-expanded',String(consejosAbiertos));
  host.replaceChildren();
  if(!consejosAbiertos) return;
  const h=el('header'); const t=el('h2'); t.textContent='Consejos del mes'; h.append(t); host.append(h);
  const all=consejosMes(md,mes).sort((a,b)=>a.p-b.p);
  const pags=Math.max(1,Math.ceil(all.length/CONSEJOS_POR_PAG));
  if(consejosPag>=pags) consejosPag=0;
  const list=all.slice(consejosPag*CONSEJOS_POR_PAG,(consejosPag+1)*CONSEJOS_POR_PAG);
  const ICON={warn:'⚠️',ok:'✅',info:'💡'};
  list.forEach(c=>{ const d=el('div','consejo '+c.t); const i=el('span','cIcon'); i.textContent=ICON[c.t]; const x=el('span'); x.textContent=c.x; d.append(i,x); host.append(d); });
  const row=el('p','hint'); row.style.cssText='display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px';
  if(pags>1){ const o=el('button','btn'); o.type='button'; o.textContent='Ver otros consejos ('+(consejosPag+1)+' de '+pags+')'; o.addEventListener('click',()=>{ consejosPag=(consejosPag+1)%pags; renderConsejos(md,mes); }); row.append(o); }
  const c2=el('button','btn'); c2.type='button'; c2.textContent='Cerrar'; c2.addEventListener('click',consejosCerrar); row.append(c2);
  host.append(row);
  const f=el('p','hint'); f.textContent='Son consejos orientativos, calculados en tu teléfono con los datos que cargaste. No son asesoría financiera.'; host.append(f);
}
function renderPie(md){
  const host=document.getElementById('pieWrap'); if(!host) return;
  const totals=monthCategoryTotals(md);
  QS.flatMap(q=>activeCuotasFor(cur,q)).forEach(it=>{
    if(it.amount<=0) return;
    const k=it.row.cat||'Tarjeta de crédito';
    totals[k]=(totals[k]||0)+it.amount;
  });
  const {svg,legend,total}=buildPieSVG(totals);
  const rows=legend.map(e=>
    '<div class="pie-row"><span class="pie-dot" style="background:'+e.color+'"></span>'+
    '<span class="pie-label">'+esc(e.label)+'</span>'+
    '<span class="pie-amt">'+cf.format(e.amt)+'</span>'+
    '<span class="pie-pct">'+(Math.round(e.pct*1000)/10).toString().replace('.',',')+' %</span></div>'
  ).join('');
  host.innerHTML='<div class="pie-svg">'+svg+'</div><div class="pie-legend">'+
    (legend.length?rows:'<p class="small">Todavía no hay egresos con categoría este mes.</p>')+'</div>';
}

