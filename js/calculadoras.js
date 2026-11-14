'use strict';
/* Calculadoras de la pestaña Herramientas (calculadora + conversor, dividir un gasto, préstamo/cuotas)
   y texto del resumen anual para compartir. Todo se calcula en el teléfono y NO se guarda ni se envía. */

/* ---------- Matemática (sin DOM, probada en tests/calculos.test.js) ---------- */
/* Evalúa una cuenta simple con + - * / y % (postfijo: 20% = 0,2). Devuelve NaN si no es válida. Sin eval. */
function calcEval(s){
  s=String(s==null?'':s).replace(/\s+/g,'');
  if(!s) return NaN;
  let i=0;
  const peek=()=>s[i];
  function numero(){
    const m=/^\d*\.?\d+|^\d+\.?/.exec(s.slice(i)); if(!m) return NaN;
    i+=m[0].length; let v=Number(m[0]);
    while(peek()==='%'){ v/=100; i++; }
    return v;
  }
  function unario(){ if(peek()==='-'){ i++; return -unario(); } if(peek()==='+'){ i++; return unario(); } return numero(); }
  function termino(){
    let v=unario();
    while(peek()==='*'||peek()==='/'){ const op=s[i++]; const w=unario(); v=op==='*'?v*w:v/w; }
    return v;
  }
  function expr(){
    let v=termino();
    while(peek()==='+'||peek()==='-'){ const op=s[i++]; const w=termino(); v=op==='+'?v+w:v-w; }
    return v;
  }
  const r=expr();
  if(i!==s.length||!isFinite(r)) return NaN;
  return Math.round(r*1e10)/1e10;
}
/* Cuota de un préstamo con tasa nominal anual (TNA, en %) y cuotas mensuales iguales (sistema francés). */
function calcPrestamo(monto,cuotas,tnaPct){
  const P=Number(monto), n=Math.round(Number(cuotas)), t=Number(tnaPct)||0;
  if(!(P>0)||!(n>=1)) return null;
  const r=t/100/12;
  const cuota=r>0?P*r/(1-Math.pow(1+r,-n)):P/n;
  const total=cuota*n;
  return {cuota,total,interes:total-P,extraPct:(total-P)/P*100};
}
/* Reparte un monto entre dos personas: pctA es el % de la primera (0 a 100). */
function calcDividir(monto,pctA){
  const M=Number(monto); let p=Number(pctA);
  if(!(M>=0)||!isFinite(p)) return null;
  p=Math.min(100,Math.max(0,p));
  const a=Math.round(M*p)/100;
  return {a,b:Math.round((M-a)*100)/100,pctA:p,pctB:100-p};
}
/* Convierte entre dólares y la moneda del hogar con la cotización (moneda por 1 USD). */
function calcConvertir(monto,cotizacion,haciaUSD){
  const M=Number(monto), C=Number(cotizacion);
  if(!isFinite(M)||!(C>0)) return null;
  return haciaUSD?M/C:M*C;
}

/* ---------- Pantallas ---------- */
const numCalc=v=>{ if(!isFinite(v)) return 'Error'; return new Intl.NumberFormat('es-AR',{maximumFractionDigits:8}).format(v); };
function calcCard(titulo,hint){
  const d=document.createElement('details'); d.className='card calcCard'; d.style.marginTop='16px';
  const s=document.createElement('summary'); s.style.cssText='cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; gap:8px';
  const h=document.createElement('h2'); h.textContent=titulo; h.style.margin='0';
  const fl=document.createElement('span'); fl.textContent='▾'; fl.setAttribute('aria-hidden','true'); fl.style.cssText='font-size:18px; color:var(--mut,#667085)';
  s.append(h,fl); d.append(s);
  const p=el('p','hint'); p.textContent=hint; p.style.marginTop='8px'; d.append(p);
  return d;
}
function fila(label,inp){
  const d=el('div','kpi'); const s=el('span'); s.textContent=label; d.append(s,inp); return d;
}
function estiloGrande(i){ i.style.cssText='width:100%; font-size:18px; font-weight:700; padding:0; border:0; background:transparent'; return i; }
function salida(){ const o=el('div'); o.setAttribute('aria-live','polite'); return o; }
function linea(out,t,fuerte){ const p=el('p',fuerte?'':'small'); p.style.margin='6px 4px'; if(fuerte){ p.style.fontWeight='700'; p.style.fontSize='16px'; } p.textContent=t; out.append(p); }

function buildCalculadora(){
  const c=calcCard('Calculadora y conversor','Una calculadora simple, y un conversor entre dólares y tu moneda. No guarda nada.');
  let ex=''; let hecho=false;
  const disp=el('div'); disp.style.cssText='background:var(--soft,#eef2f9); border-radius:12px; padding:10px 14px; text-align:right; min-height:64px';
  const l1=el('div','small'); l1.style.cssText='min-height:18px; word-break:break-all'; const l2=el('div'); l2.style.cssText='font-size:28px; font-weight:800; word-break:break-all';
  disp.append(l1,l2); disp.setAttribute('role','status');
  const pinta=()=>{ l1.textContent=ex.replace(/\*/g,'×').replace(/\//g,'÷').replace(/-/g,'−').replace(/\./g,','); const v=calcEval(ex.replace(/[+\-*/.]+$/,'')); l2.textContent=ex?(Number.isNaN(v)?'…':numCalc(v)):'0'; };
  const toca=k=>{
    const op=/[+\-*/]/.test(k);
    if(hecho&&!op&&k!=='%'&&k!=='back'&&k!=='C'&&k!=='='){ ex=''; }
    hecho=false;
    if(k==='C') ex='';
    else if(k==='back') ex=ex.slice(0,-1);
    else if(k==='='){ const v=calcEval(ex.replace(/[+\-*/.]+$/,'')); if(!Number.isNaN(v)){ ex=String(v); hecho=true; } else toast('La cuenta no es válida'); }
    else if(op){ if(!ex&&k!=='-') return; ex=ex.replace(/[+\-*/]+$/,'')+k; }
    else if(k==='.'){ const ult=ex.split(/[+\-*/]/).pop(); if(ult.includes('.')) return; ex+=ult===''?'0.':'.'; }
    else if(k==='%'){ if(!/\d$/.test(ex)) return; ex+='%'; }
    else{ if(ex.length>40) return; ex+=k; }
    pinta();
  };
  const grid=el('div'); grid.style.cssText='display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:10px';
  [['C','C'],['back','⌫'],['%','%'],['/','÷'],['7','7'],['8','8'],['9','9'],['*','×'],['4','4'],['5','5'],['6','6'],['-','−'],['1','1'],['2','2'],['3','3'],['+','+'],['0','0'],['.',','],['=','=']].forEach(([k,t])=>{
    const b=el('button','btn'+(k==='='?' primary':'')); b.type='button'; b.textContent=t; b.style.cssText='padding:12px 0; font-size:18px; font-weight:700; width:100%';
    if(k==='0'){ b.style.gridColumn='span 2'; }
    b.setAttribute('aria-label',k==='back'?'Borrar último':k==='.'?'Coma decimal':t);
    b.addEventListener('click',()=>toca(k)); grid.append(b);
  });
  c.append(disp,grid);
  /* Conversor */
  const h3=el('p'); h3.style.cssText='margin:18px 4px 6px; font-weight:700'; h3.textContent='Conversor de dólares';
  const st={monto:null,cot:(ahorro&&ahorro.cotizacion>0)?ahorro.cotizacion:null,haciaUSD:false};
  const out=salida();
  const redo=()=>{
    out.replaceChildren();
    if(moneda.c==='USD'){ linea(out,'Tu moneda ya es el dólar: no hay nada que convertir.'); return; }
    const r=calcConvertir(st.monto,st.cot,st.haciaUSD);
    if(r==null){ linea(out,st.cot>0?'Escribe un monto para convertir.':'Escribe la cotización (cuántos '+moneda.c+' vale 1 USD) para convertir.'); return; }
    linea(out,st.haciaUSD?(cf.format(st.monto)+' = USD '+nf.format(Math.round(r*100)/100)):('USD '+nf.format(st.monto)+' = '+cf.format(r)),true);
  };
  let cotTocada=false;
  const mk=(key,ph)=>estiloGrande(moneyInput(()=>st[key],v=>{st[key]=v; if(key==='cot') cotTocada=true;},redo,redo,ph));
  const sentido=el('select'); sentido.setAttribute('aria-label','Sentido de la conversión');
  [['usd','De dólares a '+moneda.c],['mon','De '+moneda.c+' a dólares']].forEach(([v,t])=>{ const o=el('option'); o.value=v; o.textContent=t; sentido.append(o); });
  sentido.addEventListener('change',()=>{ st.haciaUSD=sentido.value==='mon'; redo(); });
  const g=el('div','kpis'); g.style.marginTop='4px';
  g.append(fila('Monto',mk('monto','Monto')),fila('Cotización ('+moneda.c+' por USD)',mk('cot','Cotización')));
  const ayuda=el('p','small'); ayuda.textContent='La cotización se toma de "Ahorro en dólares" si ya la cargaste; aquí puedes cambiarla sin afectar tu ahorro.';
  const inpCot=g.querySelectorAll('input')[1];
  /* El ahorro se carga después de armar la pantalla: al abrir la tarjeta se toma la cotización guardada (si no la cambiaste aquí). */
  const sync=()=>{ if(!cotTocada&&ahorro&&ahorro.cotizacion>0){ st.cot=ahorro.cotizacion; inpCot.value=fmt(st.cot); } redo(); };
  c.addEventListener('toggle',()=>{ if(c.open) sync(); });
  c.append(h3,sentido,g,ayuda,out); sync(); pinta();
  return c;
}

function buildDividir(){
  const c=calcCard('Dividir un gasto','Reparte un gasto entre dos personas según el porcentaje que pone cada una. No guarda nada.');
  const st={monto:null,pct:50};
  const out=salida();
  const redo=()=>{
    out.replaceChildren();
    const r=calcDividir(st.monto,st.pct);
    if(r==null||!(st.monto>0)){ linea(out,'Escribe el monto del gasto.'); return; }
    linea(out,'Tú pones '+cf.format(r.a)+' ('+nf.format(r.pctA)+' %)',true);
    linea(out,'Tu pareja pone '+cf.format(r.b)+' ('+nf.format(r.pctB)+' %)',true);
  };
  const m=estiloGrande(moneyInput(()=>st.monto,v=>{st.monto=v;},redo,redo,'Monto'));
  const p=estiloGrande(moneyInput(()=>st.pct,v=>{st.pct=v;},redo,redo,'% tuyo'));
  const g=el('div','kpis'); g.style.marginTop='4px'; g.append(fila('Monto del gasto',m),fila('Tu porcentaje (%)',p));
  const bt=el('div','tools'); bt.style.marginTop='8px';
  [[50,'50 / 50'],[60,'60 / 40'],[70,'70 / 30']].forEach(([v,t])=>{ const b=el('button','btn'); b.type='button'; b.textContent=t; b.addEventListener('click',()=>{ st.pct=v; p.value=fmt(v); redo(); }); bt.append(b); });
  c.append(g,bt,out); redo();
  return c;
}

function buildPrestamo(){
  const c=calcCard('Calculadora de préstamo o cuotas','Mira cuánto pagarías por cuota y cuánto pagas de más en total antes de comprar en cuotas o pedir un préstamo. No guarda nada.');
  const st={monto:null,n:null,tna:null};
  const out=salida();
  const redo=()=>{
    out.replaceChildren();
    const r=calcPrestamo(st.monto,st.n,st.tna);
    if(!r){ linea(out,'Escribe el monto y la cantidad de cuotas. Si no tiene interés, deja la tasa en blanco o en 0.'); return; }
    linea(out,'Cuota mensual: '+cf.format(r.cuota),true);
    linea(out,'Total a pagar: '+cf.format(r.total));
    linea(out,r.interes>0.005?('Pagas de más (intereses): '+cf.format(r.interes)+' ('+(Math.round(r.extraPct*10)/10).toString().replace('.',',')+' % sobre el monto).'):'Sin intereses: pagas exactamente el monto.');
    const T=num(st.tna); if(T>0) linea(out,'Se calcula con tasa nominal anual (TNA) dividida en 12 y cuotas mensuales iguales. El costo real (CFT) del banco puede ser mayor por seguros y gastos.');
  };
  const m=estiloGrande(moneyInput(()=>st.monto,v=>{st.monto=v;},redo,redo,'Monto'));
  const n=estiloGrande(moneyInput(()=>st.n,v=>{st.n=v;},redo,redo,'Cuotas'));
  const t=estiloGrande(moneyInput(()=>st.tna,v=>{st.tna=v;},redo,redo,'TNA %'));
  const g=el('div','kpis'); g.style.marginTop='4px'; g.append(fila('Monto a financiar',m),fila('Cantidad de cuotas (meses)',n),fila('Tasa anual TNA (%)',t));
  c.append(g,out); redo();
  return c;
}

function buildCalculadoras(){
  const f=document.createDocumentFragment();
  f.append(buildCalculadora(),buildDividir(),buildPrestamo());
  return f;
}

/* ---------- Resumen del año para compartir (texto) ---------- */
function resumenAnualTexto(rows,T,y){
  const u=rows.filter(r=>r.t);
  let t='Libro de Finanzas — Resumen '+y+'\n';
  t+='Ingresos: '+cf.format(T.ingresos)+'\nEgresos: '+cf.format(T.egresos)+'\nFondo de emergencia: '+cf.format(T.fondo)+'\nBalance: '+cf.format(T.balance)+'\n';
  if(u.length){
    t+='\nMes por mes:\n';
    u.forEach(r=>{ t+=MESES[r.m-1]+': ingresos '+cf.format(r.t.ingresos)+' · egresos '+cf.format(r.t.egresos)+' · balance '+cf.format(r.t.balance)+'\n'; });
    const mp=mejorPeor(rows); if(mp) t+='\nMejor mes: '+MESES[mp.mejor.m-1]+'. Mes más ajustado: '+MESES[mp.peor.m-1]+'.\n';
  }
  return t.trim();
}
async function compartirResumenAnual(rows,T,y){
  const texto=resumenAnualTexto(rows,T,y);
  if(navigator.share){
    try{ await navigator.share({title:'Resumen '+y+' · Libro de Finanzas',text:texto}); return; }
    catch(e){ if(e&&e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(texto); toast('Resumen copiado: pégalo en WhatsApp, correo o notas'); }
  catch(e){ toast('No se pudo compartir ni copiar'); }
}
