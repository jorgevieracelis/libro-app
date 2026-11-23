'use strict';
/* Asistentes (parte 1): matemática SIN pantalla, probada en tests/calculos.test.js.
   Usa las globales de la app: months, cur, QS, extras, monthTotals, monthCategoryTotals, activeCuotasFor, simDeudas, normTxt, num, etc.
   Va justo después de premium.js. La parte de pantallas está en asistentes.js. deudasComparar, metaRitmo y sobresSugerir también los usan «Metas y deudas» y «Presupuesto por categoría» (plan.js). */

/* ---------- Utilidades ---------- */
/* Redondea hacia arriba a 2 cifras significativas: 183.400 → 190.000 (para proponer topes redondos). */
function kitRed(x){
  x=Number(x); if(!(x>0)) return 0;
  const p=Math.pow(10,Math.max(0,Math.floor(Math.log10(x))-1));
  return Math.ceil(x/p-1e-9)*p;
}
/* Meses anteriores a 'id' que tienen datos (ingresos o egresos), del más reciente al más antiguo. */
function kitPrevios(id,n){
  return Object.keys(months).filter(m=>m<id&&months[m]).sort().reverse().filter(m=>{ const t=monthTotals(m); return t.egresos>0||t.ingresos>0; }).slice(0,n);
}
/* Gasto por categoría de un mes cualquiera (incluye las cuotas de la tarjeta). */
function kitCatMes(id){
  const md=months[id]; if(!md) return {};
  const t=monthCategoryTotals(md);
  QS.flatMap(q=>activeCuotasFor(id,q)).forEach(it=>{ if(it.amount>0){ const k=it.row.cat||'Tarjeta de crédito'; t[k]=(t[k]||0)+it.amount; } });
  return t;
}
/* Promedio de gasto por categoría en los últimos n meses con datos antes de 'id'. Devuelve {prom, n}. */
function kitPromCats(id,n){
  const ids=kitPrevios(id,n); const prom={};
  ids.forEach(m=>{ const c=kitCatMes(m); Object.keys(c).forEach(k=>{ prom[k]=(prom[k]||0)+c[k]; }); });
  Object.keys(prom).forEach(k=>{ prom[k]/=ids.length; });
  return {prom,n:ids.length,ids};
}
/* Promedio mensual de egresos y de balance (últimos n meses con datos, contando el abierto si es lo único que hay). */
function kitPromMeses(id,n){
  let ids=kitPrevios(id,n); if(!ids.length&&months[id]) ids=[id];
  if(!ids.length) return {egresos:0,balance:0,ingresos:0,n:0,ids};
  const t=ids.map(monthTotals), S=k=>t.reduce((s,x)=>s+x[k],0)/ids.length;
  return {egresos:S('egresos'),balance:S('balance'),ingresos:S('ingresos'),n:ids.length,ids};
}

/* ---------- 1) Fondo de emergencia ---------- */
function feCalc(guardado,gastoMes,metaMeses){
  const G=num(guardado), E=num(gastoMes), M=Math.min(24,Math.max(1,Math.round(num(metaMeses))||3));
  if(!(E>0)) return null;
  const objetivo=E*M, meses=G/E;
  return {meses,objetivo,falta:Math.max(0,objetivo-G),pct:Math.min(1,G/objetivo),metaMeses:M,nivel:meses>=M?'ok':(meses>=1?'medio':'bajo')};
}

/* ---------- Topes de «Presupuesto por categoría» ---------- */
/* Topes sugeridos (promedio + 10 %, redondeado) para las categorías que todavía no tienen. */
function sobresSugerir(prom,presuActual){
  const o={};
  Object.keys(prom||{}).forEach(c=>{ if(CATS_PRESU.includes(c)&&!(num(presuActual&&presuActual[c])>0)&&prom[c]>0) o[c]=kitRed(prom[c]*1.10); });
  return o;
}

/* ---------- 3) Simulador «¿y si…?» ---------- */
/* ajustes: [{cat, pct}] con pct = cambio del gasto (−20 = gastas 20 % menos, +10 = gastas 10 % más). */
function simulaAhorro(balanceMes,prom,ajustes,ingresoExtra){
  let delta=Number(ingresoExtra)||0; const det=[];
  (ajustes||[]).forEach(a=>{
    const g=num(prom&&prom[a.cat]), p=Math.max(-100,Math.min(300,Number(a.pct)||0));
    if(!a.cat||!p||!(g>0)) return;
    const d=-g*p/100; delta+=d; det.push({cat:a.cat,gasto:g,pct:p,efecto:d});
  });
  const antes=num(balanceMes)||0;
  return {antes,despues:antes+delta,difMes:delta,difAnio:delta*12,det};
}

/* ---------- 4) Estrategia de deudas: bola de nieve contra avalancha ---------- */
function deudasComparar(ds,extra){
  const e=num(extra);
  const bola=simDeudas(ds,e,'bola',true), avalancha=simDeudas(ds,e,'avalancha',true), base=simDeudas(ds,0,'bola',false);
  const sinFin=bola.sinFin||avalancha.sinFin;
  let mejor='igual';
  if(!sinFin){
    if(avalancha.interes<bola.interes-0.5) mejor='avalancha';
    else if(bola.interes<avalancha.interes-0.5) mejor='bola';
    else if(bola.meses!==avalancha.meses) mejor=bola.meses<avalancha.meses?'bola':'avalancha';
  }
  return {bola,avalancha,base,sinFin,mejor,ahorroInteres:sinFin?0:Math.abs(bola.interes-avalancha.interes),difMeses:Math.abs(bola.meses-avalancha.meses)};
}

/* ---------- 5) Gastos compartidos ---------- */
/* personas: [{id,n}] · gastos: [{id,m,quien,entre:[ids]}] (entre vacío = todos) · pagos: [{id,m,de,a}] (de le pagó a).
   Devuelve el saldo de cada persona (+ le deben, − debe) y la lista mínima de pagos para quedar a mano. */
function cpSaldos(personas,gastos,pagos){
  const ids=(personas||[]).map(p=>p.id), s={};
  ids.forEach(i=>{ s[i]=0; });
  (gastos||[]).forEach(g=>{
    const m=num(g.m); if(!(m>0)||!Object.prototype.hasOwnProperty.call(s,g.quien)) return;
    const ent=((g.entre&&g.entre.length)?g.entre:ids).filter(i=>Object.prototype.hasOwnProperty.call(s,i)); if(!ent.length) return;
    s[g.quien]+=m; ent.forEach(i=>{ s[i]-=m/ent.length; });
  });
  (pagos||[]).forEach(p=>{
    const m=num(p.m); if(!(m>0)||!Object.prototype.hasOwnProperty.call(s,p.de)||!Object.prototype.hasOwnProperty.call(s,p.a)) return;
    s[p.de]+=m; s[p.a]-=m;
  });
  ids.forEach(i=>{ s[i]=Math.round(s[i]*100)/100; });
  const deud=ids.filter(i=>s[i]<-0.005).map(i=>({id:i,m:-s[i]})).sort((a,b)=>b.m-a.m);
  const acre=ids.filter(i=>s[i]>0.005).map(i=>({id:i,m:s[i]})).sort((a,b)=>b.m-a.m);
  const mov=[]; let i=0, j=0;
  while(i<deud.length&&j<acre.length){
    const x=Math.min(deud[i].m,acre[j].m);
    if(x>0.005) mov.push({de:deud[i].id,a:acre[j].id,m:Math.round(x*100)/100});
    deud[i].m-=x; acre[j].m-=x;
    if(deud[i].m<=0.005) i++;
    if(acre[j].m<=0.005) j++;
  }
  return {saldo:s,mov};
}

/* ---------- 6) Suscripciones ---------- */
/* Une los gastos recurrentes, las plataformas del mes y los cobros que se repiten solos. Sin duplicados por nombre. */
function subsUnir(recurrentes,plataformas,detectados){
  const vistos=new Set(), out=[];
  const add=(n,m,dia,fuente,extra)=>{
    const k=normTxt(n); if(!k||!(m>0)||vistos.has(k)) return;
    vistos.add(k); out.push({n:String(n),m,dia:dia||null,fuente,...extra});
  };
  (recurrentes||[]).forEach(r=>add(r.n,num(r.m),r.dia,'recurrente',{id:r.id}));
  (plataformas||[]).forEach(p=>add(p.n,num(p.m),null,'plataforma'));
  (detectados||[]).forEach(d=>add(d.n,num(d.m),null,'detectado'));
  return out.sort((a,b)=>b.m-a.m);
}
/* Nombres que se repiten en 3 o más de los meses dados con un monto parecido (±25 %). */
function subsDetectar(ms,ids){
  if(!ids||ids.length<3) return [];
  const mapa=new Map();
  ids.forEach(id=>{
    const md=ms[id]; if(!md) return;
    QS.forEach(q=>{
      const filas=[].concat(md[q].egresos||[],md[q].plataformas||[]);
      filas.forEach(r=>{
        const k=normTxt(r.n), m=num(r.m); if(!k||!(m>0)) return;
        const e=mapa.get(k)||{n:r.n,meses:new Set(),montos:[]};
        e.meses.add(id); e.montos.push({id,m}); mapa.set(k,e);
      });
    });
  });
  const out=[];
  mapa.forEach(e=>{
    if(e.meses.size<3) return;
    const ms_=e.montos.map(x=>x.m), mx=Math.max(...ms_), mn=Math.min(...ms_);
    if(mn<=0||mx/mn>1.25) return;
    const ult=e.montos.filter(x=>x.id===[...e.meses].sort().pop()).pop();
    out.push({n:e.n,m:ult.m});
  });
  return out;
}
/* Días que faltan para el próximo cobro de un día del mes (0 = hoy). */
function subsDiasHasta(dia,hoy){
  const y=hoy.getFullYear(), m=hoy.getMonth(), t0=new Date(y,m,hoy.getDate());
  const dd=(yy,mm)=>Math.min(dia,new Date(yy,mm+1,0).getDate());
  let f=new Date(y,m,dd(y,m));
  if(f<t0) f=new Date(y,m+1,dd(y,m+1));
  return Math.round((f-t0)/86400000);
}

/* ---------- 7) Meta con fecha: ¿voy a tiempo? ---------- */
function metaRitmo(m,hoyId){
  const M=num(m.meta), A=num(m.ahorrado);
  if(!(M>0)) return null;
  if(A>=M) return {estado:'cumplida',restante:0};
  const restante=M-A;
  if(!m.fecha) return {estado:'sinfecha',restante};
  const k=monthDiff(hoyId,m.fecha);
  if(k<0) return {estado:'vencida',restante};
  const meses=Math.max(1,k), porMes=restante/meses;
  let esperado=null, dif=null, estado='camino';
  if(m.inicio&&MES_RE.test(m.inicio)){
    const tot=monthDiff(m.inicio,m.fecha), pas=monthDiff(m.inicio,hoyId);
    if(tot>0){
      esperado=M*Math.min(1,Math.max(0,pas/tot)); dif=A-esperado;
      estado=A>=esperado*1.05?'adelantado':(A<esperado*0.95?'atrasado':'camino');
    }
  }
  return {estado,restante,meses,porMes,esperado,dif};
}

/* ---------- 8) Reporte mensual ---------- */
/* Los mayores gastos sueltos del mes (egresos, anticipados y plataformas). */
function topGastosMes(md,n){
  const filas=[];
  QS.forEach(q=>{
    const qd=md[q]; if(!qd) return;
    autoPlat(qd).forEach(p=>{ if(num(p.m)>0) filas.push({n:p.n,m:num(p.m),cat:'Plataformas y servicios'}); });
    ['egresos','anticipados'].forEach(sec=>qd[sec].forEach(r=>{ if(!isBlank(r,sec)&&num(r.m)>0) filas.push({n:r.n||'Sin nombre',m:num(r.m),cat:r.cat||''}); }));
  });
  return filas.sort((a,b)=>b.m-a.m).slice(0,n);
}
function repMesDatos(id){
  if(!months[id]) return null;
  const t=monthTotals(id), cats=Object.entries(kitCatMes(id)).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const ant=addMonthsId(id,-1), ta=months[ant]?monthTotals(ant):null;
  return {id,...t,cats:cats.slice(0,6),catsTotal:cats.reduce((s,[,v])=>s+v,0),top:topGastosMes(months[id],5),
          anterior:ta?{id:ant,egresos:ta.egresos,ingresos:ta.ingresos,balance:ta.balance}:null};
}
function repMesTexto(d){
  let t='Libro de Finanzas — '+monthLabel(d.id)+'\n';
  t+='Ingresos: '+cf.format(d.ingresos)+'\nEgresos: '+cf.format(d.egresos)+'\nFondo de emergencia: '+cf.format(d.fondo)+'\nBalance: '+cf.format(d.balance)+'\n';
  if(d.anterior&&d.anterior.egresos>0){ const dif=d.egresos-d.anterior.egresos; t+='Contra '+monthLabel(d.anterior.id)+': gastaste '+(dif>=0?'+':'−')+cf.format(Math.abs(dif))+' ('+(dif>=0?'más':'menos')+').\n'; }
  if(d.cats.length){ t+='\nEn qué se fue el dinero:\n'; d.cats.slice(0,3).forEach(([c,v])=>{ t+='· '+c+': '+cf.format(v)+'\n'; }); }
  if(d.top.length){ t+='\nMayores gastos:\n'; d.top.slice(0,3).forEach(x=>{ t+='· '+x.n+': '+cf.format(x.m)+'\n'; }); }
  return t.trim();
}

/* ---------- 9) Alertas de gasto inusual ---------- */
/* actual y cada previo: {categoría: monto}. Solo avisa de categorías con gasto en 2 o más de los meses anteriores. */
function alertasCalc(actual,previos,ingresos,cerrado){
  const alertas=[], mejor=[], n=(previos||[]).length;
  if(n<2) return {alertas,mejor,n};
  const cats=new Set(Object.keys(actual||{})); previos.forEach(p=>Object.keys(p).forEach(c=>cats.add(c)));
  const minAbs=num(ingresos)>0?num(ingresos)*0.01:0;
  cats.forEach(c=>{
    if(c==='Sin categoría') return;
    const con=previos.filter(p=>num(p[c])>0); if(con.length<2) return;
    const prom=con.reduce((s,p)=>s+p[c],0)/n, a=num(actual&&actual[c]), dif=a-prom;
    if(a>prom*1.3&&dif>=minAbs) alertas.push({c,actual:a,prom,dif,pct:dif/prom,nivel:a>prom*1.6?'alto':'medio'});
    else if(cerrado&&a>0&&a<prom*0.8&&prom-a>=minAbs) mejor.push({c,actual:a,prom,dif,pct:dif/prom});
  });
  alertas.sort((x,y)=>y.dif-x.dif); mejor.sort((x,y)=>x.dif-y.dif);
  return {alertas,mejor,n};
}

/* ---------- 10) Largo plazo ---------- */
/* Interés compuesto mensual, aportes al final de cada mes. 'real' = en valor de hoy si hay inflación. */
function futuroCalc(inicial,aporte,tasaAnual,anios,inflacion){
  const P=num(inicial), A=num(aporte), n=Math.round(Number(anios)*12);
  if(!(n>=1)) return null;
  const r=(Number(tasaAnual)||0)/100/12;
  const total=r>0?(P*Math.pow(1+r,n)+A*(Math.pow(1+r,n)-1)/r):(P+A*n);
  const aportado=P+A*n, inf=(Number(inflacion)||0)/100;
  return {total,aportado,ganancia:total-aportado,real:inf>0?total/Math.pow(1+inf,n/12):total};
}
/* Cuánto aportar por mes para llegar a una meta en 'anios'. 0 si el capital inicial ya alcanza. */
function futuroAporte(meta,inicial,tasaAnual,anios){
  const M=num(meta), P=num(inicial), n=Math.round(Number(anios)*12);
  if(!(M>0)||!(n>=1)) return null;
  const r=(Number(tasaAnual)||0)/100/12;
  const falta=M-(r>0?P*Math.pow(1+r,n):P);
  if(falta<=0) return 0;
  return r>0?falta*r/(Math.pow(1+r,n)-1):falta/n;
}
