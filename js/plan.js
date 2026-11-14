'use strict';
/* Presupuesto, deudas, metas, pagos repetidos, vista anual y reportes */
/* ---------- Extras del hogar: presupuesto, deudas, metas y pagos repetidos ---------- */
/* Se guardan en un solo documento (hogares/{id}/ahorro/extras), que las reglas ya permiten. */
const CATS_PRESU=CATS.concat(['Plataformas y servicios','Tarjeta de crédito']);
const presuExtra=new Set();
let extras={presupuesto:{},deudas:[],metas:[],repetidos:[],extraDeuda:null,orden:'bola'};
const extrasRef=()=>FS.doc(db,'hogares',hogarId,'ahorro','extras');
const posOrNull=v=>(typeof v==='number'&&isFinite(v)&&v>=0)?v:null;
const shortId=x=>String(x||uid()).replace(/[^A-Za-z0-9]/g,'').slice(0,20)||uid();
function normExtras(d){
  d=(d&&typeof d==='object')?d:{};
  const o={presupuesto:{},deudas:[],metas:[],repetidos:[],extraDeuda:posOrNull(d.extraDeuda),orden:d.orden==='avalancha'?'avalancha':'bola'};
  if(d.presupuesto&&typeof d.presupuesto==='object') CATS_PRESU.forEach(c=>{ const v=posOrNull(d.presupuesto[c]); if(v>0) o.presupuesto[c]=v; });
  (Array.isArray(d.deudas)?d.deudas:[]).slice(0,40).forEach(x=>{ if(x&&typeof x==='object') o.deudas.push({id:shortId(x.id),n:String(x.n||'').slice(0,80),saldo:posOrNull(x.saldo),cuota:posOrNull(x.cuota),tasa:posOrNull(x.tasa)}); });
  (Array.isArray(d.metas)?d.metas:[]).slice(0,40).forEach(x=>{ if(x&&typeof x==='object') o.metas.push({id:shortId(x.id),n:String(x.n||'').slice(0,80),meta:posOrNull(x.meta),ahorrado:posOrNull(x.ahorrado),fecha:MES_RE.test(x.fecha||'')?x.fecha:''}); });
  (Array.isArray(d.repetidos)?d.repetidos:[]).slice(0,60).forEach(x=>{
    if(x&&typeof x==='object'&&MES_RE.test(x.generado||'')&&String(x.texto||'').trim()) o.repetidos.push({id:shortId(x.id),tipo:String(x.tipo||'').slice(0,40),texto:String(x.texto).slice(0,100),monto:posOrNull(x.monto),dia:Math.min(31,Math.max(1,Math.round(Number(x.dia))||1)),generado:x.generado});
  });
  return o;
}
let baseExtras=null, extrasSaving=false, extrasAgain=false;
async function loadExtras(){
  try{ const s=await FS.getDoc(extrasRef()); if(s.exists()){ extras=normExtras(s.data()); baseExtras=normExtras(s.data()); } else baseExtras=normExtras({}); }catch(e){}
  renderPresupuesto(); renderVenc(); if(document.getElementById('view-plan')) renderPlan();
  generarRepetidos(); watchExtras();
}
/* Presupuesto, metas, deudas y repetidos: igual que los meses, se fusionan con lo que haya guardado la pareja. */
async function guardarExtras(){
  const local=normExtras(extras), ref=extrasRef();
  if(FS.runTransaction && navigator.onLine){
    await Promise.race([
      FS.runTransaction(db,async tx=>{
        const s=await tx.get(ref);
        const final=s.exists()?mergeExtras(baseExtras||normExtras({}),local,normExtras(s.data())):local;
        await tx.set(ref,{...final,actualizado:Date.now()});
      }),
      new Promise((_,rj)=>setTimeout(()=>rj(Object.assign(new Error('tiempo'),{code:'timeout'})),20000))
    ]);
  } else {
    await FS.setDoc(ref,{...local,actualizado:Date.now()});   /* sin internet: queda en cola en el teléfono */
  }
  baseExtras=local;
}
async function saveExtras(){
  if(extrasSaving){ extrasAgain=true; return; }
  extrasSaving=true;
  try{ do{ extrasAgain=false; await guardarExtras(); }while(extrasAgain); }
  catch(e){ toast('No se pudo guardar'); }
  finally{ extrasSaving=false; }
}
/* Cambios de la pareja en vivo (presupuesto, metas, deudas, repetidos y ahorro en dólares).
   Si estás escribiendo en un campo, se esperan a que lo sueltes para no pisar lo que tecleas. */
let unsubExtras=null, unsubAhorro=null, pendingLive=null;
const campoEnEdicion=()=>{ const a=document.activeElement; return !!(a&&a.matches&&a.matches('input[type="text"],input[type="month"],input.num')); };
function aplicarCuandoLibre(fn){ if(campoEnEdicion()){ pendingLive=fn; return; } fn(); }
document.addEventListener('focusout',()=>{ if(!pendingLive) return; setTimeout(()=>{ if(campoEnEdicion()||!pendingLive) return; const f=pendingLive; pendingLive=null; f(); },120); });
function unwatchLive(){ [unsubExtras,unsubAhorro].forEach(u=>{ if(u){ try{u();}catch(e){} } }); unsubExtras=null; unsubAhorro=null; pendingLive=null; }
function watchExtras(){
  if(unsubExtras){ try{unsubExtras();}catch(e){} unsubExtras=null; }
  if(!FS.onSnapshot||!hogarId) return;
  unsubExtras=FS.onSnapshot(extrasRef(),snap=>{
    if(typeof snap.exists!=='function'||!snap.exists()||(snap.metadata&&snap.metadata.hasPendingWrites)) return;
    const remoto=normExtras(snap.data());
    if(baseExtras&&igualJ(remoto,baseExtras)) return;      /* nada nuevo (o es el eco de lo que guardé) */
    aplicarCuandoLibre(()=>{
      const mezcla=mergeExtras(baseExtras||normExtras({}),normExtras(extras),remoto);
      baseExtras=remoto; extras=normExtras(mezcla);
      if(ready) render();
    });
  },()=>{});
}
function watchAhorro(){
  if(unsubAhorro){ try{unsubAhorro();}catch(e){} unsubAhorro=null; }
  if(!FS.onSnapshot||!hogarId) return;
  unsubAhorro=FS.onSnapshot(ahorroRef(),snap=>{
    if(typeof snap.exists!=='function'||!snap.exists()||(snap.metadata&&snap.metadata.hasPendingWrites)) return;
    const d=snap.data();
    const nuevo={ahorrado:d.ahorrado==null?null:Number(d.ahorrado), cotizacion:d.cotizacion==null?null:Number(d.cotizacion), meta:d.meta==null?null:Number(d.meta), fechaMeta:MES_RE.test(d.fechaMeta||'')?d.fechaMeta:'2027-03'};
    if(igualJ(nuevo,ahorro)) return;
    aplicarCuandoLibre(()=>{ ahorro=nuevo; fillAhorro(document); if(ready) refreshComputed(); });
  },()=>{});
}
const addMonthsId=(id,n)=>{ let y=Number(id.slice(0,4)), m=Number(id.slice(5,7))-1+n; y+=Math.floor(m/12); m=((m%12)+12)%12; return y+'-'+String(m+1).padStart(2,'0'); };
const textoInp=(val,ph,max,onCh)=>{ const i=el('input','txt'); i.type='text'; i.value=val||''; i.placeholder=ph; i.maxLength=max; i.setAttribute('aria-label',ph); i.autocomplete='off'; i.addEventListener('change',()=>onCh(i.value.trim().slice(0,max))); return i; };
const lbl=(txt,child)=>{ const l=el('label','planLbl'); const s=el('span','small'); s.textContent=txt; l.append(s,child); return l; };
function gastoPorCategoria(md){
  const totals=monthCategoryTotals(md);
  QS.flatMap(q=>activeCuotasFor(cur,q)).forEach(it=>{ if(it.amount>0){ const k=it.row.cat||'Tarjeta de crédito'; totals[k]=(totals[k]||0)+it.amount; } });
  return totals;
}

/* --- 1) Presupuesto por categoría --- */
function renderPresupuesto(){
  const host=document.getElementById('presuCard'); if(!host||!months[cur]) return;
  host.replaceChildren();
  const h=el('header'); const t=el('h2'); t.textContent='Presupuesto por categoría'; h.append(t); host.append(h);
  const hint=el('p','hint'); hint.textContent='Ponle un tope mensual a las categorías que quieras controlar. La barra se llena con lo que gastas este mes y avisa al llegar al 80 %.'; host.append(hint);
  const spent=gastoPorCategoria(months[cur]);
  const visibles=CATS_PRESU.filter(c=>extras.presupuesto[c]>0||num(spent[c])>0||presuExtra.has(c));
  const mkRow=c=>{
    const row=el('div','presuRow');
    const top=el('div','presuTop'); const nm=el('span','presuNm'); nm.textContent=c;
    const bar=el('div','bar'); bar.style.cssText='grid-template-columns:1fr 130px; margin:2px 0 8px';
    const tk=el('div','track'); const f=el('div','fill'); tk.append(f); const em=el('em'); bar.append(tk,em);
    const upd=()=>{
      const g=num(spent[c]), tope=num(extras.presupuesto[c]);
      if(tope>0){ const p=g/tope; f.style.width=Math.min(100,p*100)+'%'; f.className='fill '+(p>=1?'b':p>=0.8?'w':'i'); em.textContent=cf.format(g)+' · '+Math.round(p*100)+' %'; }
      else { f.style.width='0'; em.textContent=cf.format(g)+' · sin tope'; }
    };
    const inp=moneyInput(()=>extras.presupuesto[c]==null?null:extras.presupuesto[c],v=>{ if(v>0) extras.presupuesto[c]=v; else delete extras.presupuesto[c]; },upd,()=>{ upd(); saveExtras(); refreshConsejos(); },'Tope');
    top.append(nm,inp); row.append(top,bar); upd(); return row;
  };
  visibles.forEach(c=>host.append(mkRow(c)));
  if(!visibles.length){ host.append(estadoVacio('presupuesto','Aún no hay gastos por categoría','Cuando anotes egresos con categoría, o le pongas un tope abajo, verás aquí cuánto llevas.')); }
  const rest=CATS_PRESU.filter(c=>!visibles.includes(c));
  if(rest.length){
    const sel=el('select','txt'); sel.setAttribute('aria-label','Poner tope a otra categoría'); sel.style.marginTop='8px';
    const o0=el('option'); o0.value=''; o0.textContent='＋ Poner tope a otra categoría…'; sel.append(o0);
    rest.forEach(c=>{ const o=el('option'); o.value=c; o.textContent=c; sel.append(o); });
    sel.addEventListener('change',()=>{ if(!sel.value) return; presuExtra.add(sel.value); renderPresupuesto(); const rows=document.querySelectorAll('#presuCard .presuRow input'); if(rows.length) rows[rows.length-1].focus(); });
    host.append(sel);
  }
}
function refreshConsejos(){ const md=months[cur]; if(md) refreshComputed(); }

/* --- 2) Pagos repetidos y vencimientos --- */
let notasListas=false, genBusy=false;
async function generarRepetidos(){
  if(genBusy||!notasListas||!hogarId||!extras.repetidos.length) return;
  genBusy=true;
  try{
    const limite=addMonthsId(currentMonthId(),1);
    let cambio=false;
    for(const r of extras.repetidos){
      let n=0;
      while(r.generado<limite && n<24){
        n++; const m=addMonthsId(r.generado,1);
        const dim=new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate();
        const fecha=m+'-'+String(Math.min(r.dia,dim)).padStart(2,'0');
        const id='rep_'+r.id+'_'+m;
        if(!notas.some(x=>x.id===id)){
          const nota={id,fecha,texto:r.texto,hecho:false,creado:Date.now()+n,tipo:r.tipo||'Otros',monto:r.monto,exportada:false};
          try{ await FS.setDoc(notaRef(id),notaDatos(nota)); notas.push(nota); }catch(e){ throw e; }
        }
        r.generado=m; cambio=true;
      }
    }
    if(cambio){ await saveExtras(); if(tab==='cal') renderCal(); renderVenc(); }
  }catch(e){ /* se reintenta en la próxima carga */ }
  finally{ genBusy=false; }
}
function renderVenc(){
  const host=document.getElementById('vencCard'); if(!host) return;
  const hoy=ymd(new Date()); const lim=ymd(new Date(Date.now()+7*86400000));
  const lista=notas.filter(n=>n.tipo&&!n.hecho&&n.fecha<=lim).sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0).slice(0,8);
  host.replaceChildren(); host.hidden=!lista.length; if(!lista.length) return;
  const h=el('header'); const t=el('h2'); t.textContent='Pagos próximos y vencidos'; h.append(t); host.append(h);
  lista.forEach(n=>{
    const r=el('div','notaRow'); const pp=n.fecha.split('-');
    const tx=el('span','notaTxt'); const venc=n.fecha<hoy;
    tx.textContent=(venc?'⚠ Vencido ':'')+pp[2]+'/'+pp[1]+' · '+n.texto+(n.monto!=null?' — '+cf.format(n.monto):'');
    if(venc) tx.style.color='var(--neg)';
    const b=el('button','btn'); b.type='button'; b.textContent='Pagado'; b.addEventListener('click',async()=>{ await toggleNota(n); renderVenc(); });
    r.append(tx,b); host.append(r);
  });
}
function repetidosCard(){
  const c=el('section','card'); c.style.marginTop='16px';
  const h=el('header'); const t=el('h2'); t.textContent='Pagos que se repiten'; h.append(t); c.append(h);
  if(!extras.repetidos.length){ const p=el('p','small'); p.style.padding='4px'; p.textContent='Cuando agendes un pago fijo y marques "Se repite todos los meses", aparece acá.'; c.append(p); return c; }
  extras.repetidos.forEach(r=>{
    const row=el('div','notaRow'); const tx=el('span','notaTxt'); tx.textContent=r.texto+(r.monto!=null?' — '+cf.format(r.monto):'')+' · el día '+r.dia+' de cada mes';
    row.append(tx,delBtn(()=>{
      const p=el('p'); p.textContent='Se dejará de agendar "'+r.texto+'" y se quitarán los próximos que aún no pasaron a Egresos fijos. Lo ya registrado no se toca.';
      modal('¿Dejar de repetir este pago?',p,[{label:'Cancelar'},{label:'Dejar de repetir',cls:'danger solid',onClick:async()=>{
        extras.repetidos=extras.repetidos.filter(x=>x!==r); await saveExtras();
        const hoy=ymd(new Date());
        for(const n of notas.filter(x=>x.id.startsWith('rep_'+r.id+'_')&&x.fecha>hoy&&!x.exportada&&!x.hecho)) await delNota(n);
        renderCal();
      }}]);
    }));
    c.append(row);
  });
  return c;
}

/* --- 3 y 4) Metas de ahorro y deudas (pestaña "Metas y deudas") --- */
function buildPlan(){ const v=el('div'); v.id='view-plan'; v.hidden=true; return v; }
function simDeudas(ds,extra,orden,roll){
  const st=ds.filter(d=>num(d.saldo)>0&&num(d.cuota)>0).map(d=>({id:d.id,n:d.n,s:d.saldo,c:d.cuota,r:num(d.tasa)/1200,fin:null}));
  const ord=()=>st.filter(x=>x.s>0.005).sort(orden==='avalancha'?(a,b)=>b.r-a.r||a.s-b.s:(a,b)=>a.s-b.s);
  let mes=0, interes=0;
  while(st.some(x=>x.s>0.005)&&mes<600){
    mes++; let libre=roll?num(extra):0;
    st.forEach(x=>{ if(x.s>0.005){ const i=x.s*x.r; interes+=i; x.s+=i; } });
    st.forEach(x=>{ if(x.s>0.005){ const p=Math.min(x.c,x.s); x.s-=p; if(roll) libre+=x.c-p; } else if(roll) libre+=x.c; });
    for(const x of ord()){ if(libre<=0.005) break; const p=Math.min(libre,x.s); x.s-=p; libre-=p; }
    st.forEach(x=>{ if(x.fin==null&&x.s<=0.005) x.fin=mes; });
  }
  return {meses:mes,interes,fin:st,sinFin:st.some(x=>x.s>0.005)};
}
function metaItem(m){
  const c=el('div','planItem');
  const top=el('div','planTop');
  top.append(textoInp(m.n,'Nombre de la meta (ej: Vacaciones)',80,v=>{ m.n=v; saveExtras(); }),
    delBtn(()=>{ extras.metas=extras.metas.filter(x=>x!==m); saveExtras(); renderPlan(); }));
  const track=el('div','track'); track.style.margin='8px 0 4px'; const fill=el('div','fill i'); track.append(fill);
  const bar=el('div','bar'); bar.style.cssText='grid-template-columns:1fr; margin:0'; bar.append(track);
  const sum=el('p','small'); sum.style.margin='2px 0 8px';
  const upd=()=>{
    const A=num(m.ahorrado), M=num(m.meta);
    fill.style.width=(M>0?Math.min(100,A/M*100):0)+'%';
    if(M<=0){ sum.textContent='Pon el monto de la meta para ver tu progreso.'; return; }
    if(A>=M){ sum.textContent='🎉 ¡Meta cumplida! Ahorraste '+cf.format(A)+' de '+cf.format(M)+'.'; return; }
    let t='Llevas '+cf.format(A)+' de '+cf.format(M)+' ('+pctTxt(A/M)+'). Faltan '+cf.format(M-A)+'.';
    if(m.fecha){ const k=monthDiff(currentMonthId(),m.fecha); t+=k>0?' Para llegar en '+monthLabel(m.fecha)+' ahorra unos '+cf.format((M-A)/k)+' por mes.':' La fecha elegida ya pasó.'; }
    sum.textContent=t;
  };
  const g=el('div','planGrid');
  g.append(lbl('Meta',moneyInput(()=>m.meta,v=>{ m.meta=v; },upd,()=>{ upd(); saveExtras(); },'Meta')),
    lbl('Ya ahorrado',moneyInput(()=>m.ahorrado,v=>{ m.ahorrado=v; },upd,()=>{ upd(); saveExtras(); },'Ahorrado')));
  const fi=el('input','txt'); fi.type='month'; fi.value=m.fecha||''; fi.setAttribute('aria-label','Fecha objetivo');
  fi.addEventListener('change',()=>{ m.fecha=MES_RE.test(fi.value)?fi.value:''; upd(); saveExtras(); });
  g.append(lbl('Fecha objetivo',fi));
  const ap=el('div','notaAdd'); ap.style.marginTop='6px';
  let aporte=null; const ai=moneyInput(()=>aporte,v=>{ aporte=v; },()=>{},()=>{},'Sumar aporte');
  const ab=el('button','btn'); ab.type='button'; ab.textContent='Sumar';
  ab.addEventListener('click',()=>{ if(!(aporte>0)){ toast('Escribe cuánto sumar'); return; } m.ahorrado=num(m.ahorrado)+aporte; saveExtras(); toast('Sumados '+cf.format(aporte)); renderPlan(); });
  ap.append(ai,ab);
  c.append(top,track,sum,g,ap); upd(); return c;
}
function deudaItem(d){
  const c=el('div','planItem');
  const top=el('div','planTop');
  top.append(textoInp(d.n,'Nombre de la deuda (ej: Préstamo del auto)',80,v=>{ d.n=v; saveExtras(); renderPlanResumenDeudas(); }),
    delBtn(()=>{ extras.deudas=extras.deudas.filter(x=>x!==d); saveExtras(); renderPlan(); }));
  const g=el('div','planGrid');
  const done=()=>{ saveExtras(); renderPlanResumenDeudas(); };
  g.append(lbl('Saldo que debes',moneyInput(()=>d.saldo,v=>{ d.saldo=v; },()=>{},done,'Saldo')),
    lbl('Cuota por mes',moneyInput(()=>d.cuota,v=>{ d.cuota=v; },()=>{},done,'Cuota')),
    lbl('Interés anual % (opcional)',moneyInput(()=>d.tasa,v=>{ d.tasa=v; },()=>{},done,'0')));
  c.append(top,g); return c;
}
function renderPlanResumenDeudas(){
  const host=document.getElementById('deudaRes'); if(!host) return;
  host.replaceChildren();
  const ds=extras.deudas.filter(d=>num(d.saldo)>0);
  if(!ds.length){ const p=el('p','small'); p.textContent='Carga tus deudas (tarjeta, préstamos) con saldo y cuota para ver cuándo terminas de pagar.'; host.append(p); return; }
  const line=(t,cls)=>{ const p=el('p',cls||'small'); p.style.margin='6px 4px'; p.textContent=t; host.append(p); };
  const total=ds.reduce((s,d)=>s+num(d.saldo),0), cuotas=ds.reduce((s,d)=>s+num(d.cuota),0);
  line('Debes en total '+cf.format(total)+' y pagas '+cf.format(cuotas)+' por mes en cuotas.');
  const ing=months[cur]?monthTotals(cur).ingresos:0;
  if(ing>0){ const r=cuotas/ing; line('Las cuotas son el '+pctTxt(r)+' de tu ingreso de '+monthLabel(cur)+(r>0.3?'. Lo ideal es que no pasen del 30 %.':'.')); }
  const sin=ds.filter(d=>!(num(d.cuota)>0)).length; if(sin) line('⚠ '+sin+(sin===1?' deuda no tiene':' deudas no tienen')+' cuota cargada y no entra en el cálculo.');
  const base=simDeudas(extras.deudas,0,extras.orden,false);
  const plan=simDeudas(extras.deudas,num(extras.extraDeuda),extras.orden,true);
  const fin=k=>monthLabel(addMonthsId(currentMonthId(),k));
  if(base.sinFin) line('⚠ Alguna cuota no alcanza ni para cubrir los intereses: la deuda no se termina así. Sube la cuota o hace un pago extra.','small neg');
  else line('Pagando solo las cuotas actuales terminas en '+base.meses+(base.meses===1?' mes':' meses')+' ('+fin(base.meses)+') y pagas '+cf.format(base.interes)+' de intereses.');
  if(!plan.sinFin && (num(extras.extraDeuda)>0||ds.length>1)){
    const ah=base.interes-plan.interes, mm=base.meses-plan.meses;
    line('Con el plan ('+(extras.orden==='avalancha'?'avalancha':'bola de nieve')+(num(extras.extraDeuda)>0?', con '+cf.format(extras.extraDeuda)+' extra por mes':'')+') terminas en '+plan.meses+(plan.meses===1?' mes':' meses')+' ('+fin(plan.meses)+')'+(!base.sinFin&&(mm>0||ah>1)?': '+(mm>0?mm+(mm===1?' mes':' meses')+' antes':'')+(mm>0&&ah>1?' y ':'')+(ah>1?'ahorras '+cf.format(ah)+' en intereses':'')+'.':'.'),'small pos');
    const ordn=plan.fin.slice().sort((a,b)=>(a.fin||999)-(b.fin||999));
    const ul=el('ol','small'); ul.style.margin='6px 4px 0 22px';
    ordn.forEach(x=>{ const li=el('li'); li.textContent=(x.n||'Deuda')+': libre en '+(x.fin?fin(x.fin):'—'); ul.append(li); });
    host.append(ul);
  }
}
function renderPlan(){
  const v=document.getElementById('view-plan'); if(!v) return;
  v.replaceChildren();
  // metas
  const mc=el('section','card'); const mh=el('header'); const mt=el('h2'); mt.textContent='Metas de ahorro'; mh.append(mt); mc.append(mh);
  const mp=el('p','hint'); mp.textContent='Crea una meta por cada cosa para la que ahorras (vacaciones, auto, estudios…). Los montos van en tu moneda ('+moneda.c+').'; mc.append(mp);
  extras.metas.forEach(m=>mc.append(metaItem(m)));
  if(!extras.metas.length){ mc.append(estadoVacio('meta','Aún no tienes metas','Crea una para algo que quieras lograr: vacaciones, un auto, estudios…')); }
  const nb=el('button','btn primary'); nb.type='button'; nb.textContent='＋ Nueva meta'; nb.style.marginTop='10px';
  nb.addEventListener('click',()=>{ if(extras.metas.length>=40){ toast('Llegaste al máximo de metas'); return; } extras.metas.push({id:uid(),n:'',meta:null,ahorrado:null,fecha:''}); saveExtras(); renderPlan(); });
  mc.append(nb); v.append(mc);
  // deudas
  const dc=el('section','card'); dc.style.marginTop='16px'; const dh=el('header'); const dt=el('h2'); dt.textContent='Deudas'; dh.append(dt); dc.append(dh);
  const dp=el('p','hint'); dp.textContent='Anota lo que debes y la app calcula cuándo terminas y cuánto ahorras si pagas un extra. Es solo una guía: usa los datos de tu banco para el número exacto. Bola de nieve: pagas primero la deuda más chica. Avalancha: pagas primero la de mayor interés.'; dc.append(dp);
  extras.deudas.forEach(d=>dc.append(deudaItem(d)));
  const nd=el('button','btn primary'); nd.type='button'; nd.textContent='＋ Nueva deuda'; nd.style.marginTop='10px';
  nd.addEventListener('click',()=>{ if(extras.deudas.length>=40){ toast('Llegaste al máximo de deudas'); return; } extras.deudas.push({id:uid(),n:'',saldo:null,cuota:null,tasa:null}); saveExtras(); renderPlan(); });
  dc.append(nd);
  const og=el('div','planGrid'); og.style.marginTop='12px';
  og.append(lbl('Pago extra por mes (opcional)',moneyInput(()=>extras.extraDeuda,x=>{ extras.extraDeuda=x; },()=>{},()=>{ saveExtras(); renderPlanResumenDeudas(); },'Extra')));
  const os=el('select','txt'); os.setAttribute('aria-label','Qué deuda pagar primero');
  [['bola','Bola de nieve'],['avalancha','Avalancha']].forEach(([k,t])=>{ const o=el('option'); o.value=k; o.textContent=t; if(k===extras.orden) o.selected=true; os.append(o); });
  os.addEventListener('change',()=>{ extras.orden=os.value==='avalancha'?'avalancha':'bola'; saveExtras(); renderPlanResumenDeudas(); });
  og.append(lbl('Qué pagar primero',os)); dc.append(og);
  const res=el('div'); res.id='deudaRes'; res.style.marginTop='10px'; dc.append(res);
  v.append(dc); renderPlanResumenDeudas();
}

/* --- 5) Gráfico de evolución y reporte anual --- */
function lineChartSVG(rows,pal,w,h){
  const pts=rows.filter(r=>r.t); if(!pts.length) return '';
  const L=46,R=10,T=10,B=24; const W=w-L-R, H=h-T-B;
  const vals=pts.flatMap(r=>[r.t.ingresos,r.t.egresos,r.t.balance]);
  let mn=Math.min(0,...vals), mx=Math.max(1,...vals); if(mx===mn) mx=mn+1;
  const X=m=>L+(m-1)/11*W, Y=v=>T+(mx-v)/(mx-mn)*H;
  const compact=v=>{ const a=Math.abs(v); const s=a>=1e6?(a/1e6).toFixed(1).replace('.0','')+' M':a>=1e3?Math.round(a/1e3)+' mil':String(Math.round(a)); return (v<0?'-':'')+s; };
  let s='<svg viewBox="0 0 '+w+' '+h+'" width="100%" role="img" aria-label="Evolución mensual de ingresos, egresos y balance" style="color:'+pal.txt+'; font-family:inherit">';
  [mx,(mx+mn)/2,mn].forEach(v=>{ s+='<line x1="'+L+'" x2="'+(w-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="'+pal.grid+'" stroke-width="1"/><text x="'+(L-4)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end" font-size="9" fill="currentColor" opacity=".75">'+compact(v)+'</text>'; });
  if(mn<0) s+='<line x1="'+L+'" x2="'+(w-R)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'" stroke="currentColor" stroke-width="1" opacity=".5"/>';
  for(let m=1;m<=12;m++) s+='<text x="'+X(m).toFixed(1)+'" y="'+(h-8)+'" text-anchor="middle" font-size="9" fill="currentColor" opacity=".75">'+MESES[m-1].slice(0,3)+'</text>';
  [['ingresos',pal.i],['egresos',pal.e],['balance',pal.b]].forEach(([k,col])=>{
    const d=pts.map((r,i)=>(i?'L':'M')+X(r.m).toFixed(1)+' '+Y(r.t[k]).toFixed(1)).join(' ');
    s+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round"'+(k==='balance'?' stroke-dasharray="5 3"':'')+'/>';
    pts.forEach(r=>{ s+='<circle cx="'+X(r.m).toFixed(1)+'" cy="'+Y(r.t[k]).toFixed(1)+'" r="3" fill="'+col+'"><title>'+MESES[r.m-1]+' · '+k+': '+esc(cf.format(r.t[k]))+'</title></circle>'; });
  });
  return s+'</svg>';
}
const PAL_APP={i:'var(--inc)',e:'var(--exp)',b:'var(--pos)',grid:'var(--line)',txt:'var(--ink)'};
const PAL_PDF={i:'#1b3f7a',e:'#f28c28',b:'#00703c',grid:'#e4e8f0',txt:'#111827'};
function legendHTML(){ return '<div style="display:flex; gap:14px; flex-wrap:wrap; font-size:12px; margin:6px 4px 0"><span><b style="color:var(--inc)">━</b> Ingresos</span><span><b style="color:var(--exp)">━</b> Egresos</span><span><b style="color:var(--pos)">╍</b> Balance</span></div>'; }
function mejorPeor(rows){
  const u=rows.filter(r=>r.t); if(u.length<2) return null;
  const s=u.slice().sort((a,b)=>b.t.balance-a.t.balance); return {mejor:s[0],peor:s[s.length-1]};
}
function reporteAnualHTML(rows,T,y){
  const u=rows.filter(r=>r.t); const mp=mejorPeor(rows);
  const td='style="padding:6px 8px; border-bottom:1px solid #e4e8f0; text-align:right"', tdl='style="padding:6px 8px; border-bottom:1px solid #e4e8f0; text-align:left"';
  let h='<div style="font-family:Arial,Helvetica,sans-serif; color:#111827; background:#fff; padding:28px">'+
   '<h1 style="margin:0; color:#0f2a52; font-size:26px">Libro de Finanzas — Reporte '+esc(y)+'</h1>'+
   '<p style="margin:4px 0 18px; color:#667085; font-size:13px">Un hogar organizado con propósito · Generado el '+esc(new Date().toLocaleDateString('es-AR'))+'</p>'+
   '<table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:16px"><tr>'+
   [['Ingresos del año',T.ingresos],['Egresos del año',T.egresos],['Fondo de emergencia',T.fondo],['Balance del año',T.balance]].map(([l,v])=>'<td style="padding:10px; background:#eef2f9; border-radius:6px; width:25%"><div style="font-size:12px; color:#667085">'+l+'</div><b style="font-size:16px">'+esc(cf.format(v))+'</b></td>').join('<td style="width:6px"></td>')+'</tr></table>'+
   lineChartSVG(rows,PAL_PDF,640,230)+
   '<div style="font-size:12px; margin:4px 0 14px"><b style="color:#1b3f7a">━</b> Ingresos &nbsp; <b style="color:#f28c28">━</b> Egresos &nbsp; <b style="color:#00703c">╍</b> Balance</div>';
  if(mp) h+='<p style="font-size:13px">Mejor mes: <b>'+MESES[mp.mejor.m-1]+'</b> (balance '+esc(cf.format(mp.mejor.t.balance))+'). Mes más ajustado: <b>'+MESES[mp.peor.m-1]+'</b> (balance '+esc(cf.format(mp.peor.t.balance))+').</p>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:13px"><tr style="background:#0f2a52; color:#fff"><th style="padding:7px 8px; text-align:left">Mes</th><th style="padding:7px 8px; text-align:right">Ingresos</th><th style="padding:7px 8px; text-align:right">Egresos</th><th style="padding:7px 8px; text-align:right">Fondo</th><th style="padding:7px 8px; text-align:right">Balance</th><th style="padding:7px 8px; text-align:right">% gastado</th></tr>';
  u.forEach(r=>{ h+='<tr><td '+tdl+'>'+MESES[r.m-1]+'</td><td '+td+'>'+esc(cf.format(r.t.ingresos))+'</td><td '+td+'>'+esc(cf.format(r.t.egresos))+'</td><td '+td+'>'+esc(cf.format(r.t.fondo))+'</td><td '+td+'>'+esc(cf.format(r.t.balance))+'</td><td '+td+'>'+pctTxt(r.t.pct)+'</td></tr>'; });
  h+='<tr style="font-weight:bold"><td '+tdl+'>Total</td><td '+td+'>'+esc(cf.format(T.ingresos))+'</td><td '+td+'>'+esc(cf.format(T.egresos))+'</td><td '+td+'>'+esc(cf.format(T.fondo))+'</td><td '+td+'>'+esc(cf.format(T.balance))+'</td><td '+td+'>'+(T.ingresos>0?pctTxt(T.egresos/T.ingresos):'0 %')+'</td></tr></table>'+
   '<p style="font-size:11px; color:#667085; margin-top:14px">Moneda: '+esc(moneda.n)+' ('+esc(moneda.c)+'). Reporte informativo generado en tu teléfono.</p></div>';
  return h;
}

/* ---------- Vista anual ---------- */
let anio=null;
function buildAnio(){
  const v=el('div'); v.id='view-anio'; v.hidden=true; return v;
}
function monthTotals(id){
  const md=months[id]; const cs=QS.map(q=>calc(md[q],md)); const S=k=>cs.reduce((s,c)=>s+c[k],0);
  const ingresos=S('ingresos'), egresos=S('egresosTotales'), fondo=S('fondo');
  return {ingresos, egresos, fondo, balance:ingresos-egresos-fondo, pct:ingresos>0?egresos/ingresos:0,
          tarjeta:QS.reduce((a,q)=>a+monthTarjetaTotal(id,q),0)};
}
function renderAnio(){
  const v=document.getElementById('view-anio'); if(!v) return;
  const years=[...new Set(Object.keys(months).map(id=>id.slice(0,4)))].sort().reverse();
  if(!anio || !years.includes(anio)) anio=(cur&&years.includes(cur.slice(0,4)))?cur.slice(0,4):years[0];
  v.replaceChildren();
  const head=el('section','card'); const h=el('header'); const h2=el('h2'); h2.textContent='Resumen del año'; h.append(h2);
  const sel=el('select','txt'); sel.setAttribute('aria-label','Año');
  years.forEach(y=>{ const o=el('option'); o.value=y; o.textContent=y; if(y===anio) o.selected=true; sel.append(o); });
  sel.addEventListener('change',()=>{ anio=sel.value; renderAnio(); v.hidden=false; });
  h.append(sel); head.append(h);
  const rows=[]; let T={ingresos:0,egresos:0,fondo:0,balance:0,tarjeta:0};
  for(let m=1;m<=12;m++){
    const id=anio+'-'+String(m).padStart(2,'0');
    if(!months[id]){ rows.push({id,m,t:null}); continue; }
    const t=monthTotals(id); rows.push({id,m,t});
    Object.keys(T).forEach(k=>{T[k]+=t[k];});
  }
  const used=rows.filter(r=>r.t);
  const kp=el('div','kpis'); kp.style.marginTop='4px';
  const kpi=(l,val,cls)=>{ const d=el('div','kpi'+(cls?' '+cls:'')); const s=el('span'); s.textContent=l; const b=el('b'); b.textContent=val; if(l==='Balance del año') b.classList.add(val.includes('-')?'neg':'pos'); d.append(s,b); return d; };
  kp.append(kpi('Ingresos del año',cf.format(T.ingresos)),kpi('Egresos del año',cf.format(T.egresos)),kpi('Balance del año',cf.format(T.balance),'soft'),
    kpi('Promedio de balance mensual',used.length?cf.format(T.balance/used.length):cf.format(0)));
  head.append(kp);
  const note=el('p','hint'); note.textContent='Suma de '+used.length+(used.length===1?' mes cargado':' meses cargados')+'. Toca un mes para abrirlo.'; head.append(note);
  v.append(head);
  // evolución
  const ec=el('section','card'); ec.style.marginTop='16px'; const eh=el('header'); const e2=el('h2'); e2.textContent='Evolución mes a mes'; eh.append(e2); ec.append(eh);
  if(used.length){
    const ch=el('div'); ch.innerHTML=lineChartSVG(rows,PAL_APP,340,210)+legendHTML(); ec.append(ch);
    const mp=mejorPeor(rows); if(mp){ const p=el('p','hint'); p.textContent='Mejor mes: '+MESES[mp.mejor.m-1]+' (balance '+cf.format(mp.mejor.t.balance)+'). Mes más ajustado: '+MESES[mp.peor.m-1]+' (balance '+cf.format(mp.peor.t.balance)+').'; ec.append(p); }
    const pb=el('button','btn primary'); pb.type='button'; pb.textContent='Descargar reporte del año (PDF)'; pb.style.marginTop='8px';
    pb.addEventListener('click',()=>captureAndDeliver(reporteAnualHTML(rows,T,anio),680,'libro-finanzas-reporte-'+anio,'pdf')); ec.append(pb);
  } else { ec.append(estadoVacio('grafico','Sin datos en '+anio,'Cuando cargues meses de este año, aquí verás su evolución.')); }
  v.append(ec);
  // tabla
  const tc=el('section','card'); tc.style.marginTop='16px';
  const th=el('header'); const t2=el('h2'); t2.textContent='Mes por mes'; th.append(t2); tc.append(th);
  const wrap=el('div','tbl-wrap'); const tb=el('table','tbl');
  tb.innerHTML='<thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Fondo</th><th>Balance</th><th>% gastado</th></tr></thead>';
  const body=el('tbody');
  rows.forEach(r=>{
    const tr=el('tr'); const td0=el('td');
    if(r.t){ const a=el('button','btn'); a.type='button'; a.textContent=MESES[r.m-1]; a.style.cssText='padding:2px 8px; font-size:13px';
      a.addEventListener('click',()=>{ cur=r.id; tab='resumen'; render(); window.scrollTo(0,0); }); td0.append(a); }
    else td0.textContent=MESES[r.m-1];
    tr.append(td0);
    const vals=r.t?[cf.format(r.t.ingresos),cf.format(r.t.egresos),cf.format(r.t.fondo),cf.format(r.t.balance),(Math.round(r.t.pct*1000)/10).toString().replace('.',',')+' %']:['—','—','—','—','—'];
    vals.forEach((x,i)=>{ const td=el('td'); td.textContent=x; if(r.t&&i===3) td.className=r.t.balance<0?'neg':'pos'; tr.append(td); });
    body.append(tr);
  });
  const tr=el('tr','strong'); tr.append(el('td'));
  tr.firstChild.textContent='Total';
  [T.ingresos,T.egresos,T.fondo,T.balance].forEach(x=>{ const td=el('td'); td.textContent=cf.format(x); tr.append(td); });
  const tdp=el('td'); tdp.textContent=T.ingresos>0?(Math.round(T.egresos/T.ingresos*1000)/10).toString().replace('.',',')+' %':'0 %'; tr.append(tdp);
  body.append(tr); tb.append(body); wrap.append(tb); tc.append(wrap); v.append(tc);
  // barras
  const bc=el('section','card'); bc.style.marginTop='16px';
  const bh=el('header'); const b2=el('h2'); b2.textContent='Ingresos vs. egresos por mes'; bh.append(b2); bc.append(bh);
  const bars=el('div','bars');
  const mx=Math.max(1,...used.map(r=>Math.max(r.t.ingresos,r.t.egresos)));
  used.forEach(r=>{
    const g=el('div','bar-grp'); const b=el('b'); b.textContent=MESES[r.m-1]; g.append(b);
    [['Ingresos','i',r.t.ingresos],['Egresos','e',r.t.egresos]].forEach(([lab,cls,val])=>{
      const row=el('div','bar'); const s=el('span'); s.textContent=lab;
      const tk=el('div','track'); const f=el('div','fill '+cls); f.style.width=Math.max(0,Math.min(100,val/mx*100))+'%'; tk.append(f);
      const em=el('em'); em.textContent=cf.format(val); row.append(s,tk,em); g.append(row);
    });
    bars.append(g);
  });
  if(!used.length){ bars.append(estadoVacio('grafico','Sin datos en '+anio,'Cuando cargues meses de este año, verás aquí sus barras.')); }
  bc.append(bars); v.append(bc);
}
function buildEmpty(){
  const e=el('div','empty');
  e.innerHTML='<h2>Todavía no hay datos</h2><p class="small">Puedes importar el respaldo de tu libro anterior o empezar con un mes en blanco.</p><div class="tools"></div>';
  const t=$('.tools',e);
  const a=el('button','btn primary'); a.type='button'; a.textContent='Importar respaldo (.json)'; a.addEventListener('click',()=>$('#fileImp').click());
  const b=el('button','btn'); b.type='button'; b.textContent='Empezar en blanco'; b.addEventListener('click',()=>createMonth(currentMonthId(),null));
  t.append(a,b); return e;
}
function renderHeader(){
  const sel=$('#mes'); sel.replaceChildren();
  Object.keys(months).sort().reverse().forEach(id=>{
    const o=el('option'); o.value=id; o.textContent=monthLabel(id); if(id===cur) o.selected=true; sel.append(o);
  });
  $('#tabs').hidden=!cur; sel.hidden=!cur; $('#bottomNav').hidden=!cur;
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.tab===tab)));
}
function tabsValidas(){ return ['resumen',...QS.flatMap(q=>[q,'c'+q.slice(1)]),'anio','cal','plan']; }
function renderTabs(){
  const nav=$('#tabs'); nav.replaceChildren();
  const add=(k,label,title,short)=>{
    const b=el('button','tab'); b.type='button'; b.setAttribute('role','tab'); b.dataset.tab=k; b.dataset.grupo=grupoDe(k); if(title) b.title=title;
    const f=el('span','full'); f.textContent=label; const s=el('span','short'); s.textContent=short||label; b.append(f,s);
    b.addEventListener('click',()=>{ tab=k; showTab(); window.scrollTo(0,0); }); nav.append(b);
  };
  add('resumen','Resumen');
  QS.forEach(q=>{
    const i=q.slice(1);
    add(q,periodo==='mensual'?'Ingresos y egresos':qname(q),qrange(q),qname(q));
    add('c'+i,periodo==='semanal'?'Compras '+i:'Compras super/otros','Compras: '+qname(q),qname(q));
  });
  add('anio','Año'); add('cal','Calendario'); add('plan','Metas y deudas');
  renderBottomNav();
}
function showTab(){
  if(!tabsValidas().includes(tab)) tab='resumen';
  if(tab!=='resumen') consejosCerrar();
  if(tab==='anio') renderAnio();
  if(tab==='cal') renderCal();
  if(tab==='plan') renderPlan();
  tabsValidas().forEach(t=>{const v=document.getElementById('view-'+t); if(v) v.hidden=(t!==tab);});
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.tab===tab)));
  marcarNav();
}
function render(){
  renderTabs(); renderHeader();
  const main=$('#main'); main.replaceChildren();
  if(!cur||!months[cur]){ main.append(buildEmpty()); return; }
  main.append(buildResumen(),...QS.flatMap(q=>[buildQ(q),buildCompras(q)]),buildAnio(),buildCal(),buildPlan());
  QS.forEach(q=>SECS.forEach(sec=>renderList(q,sec)));
  QS.forEach(renderCompras);
  refreshComputed(); showTab();
}

