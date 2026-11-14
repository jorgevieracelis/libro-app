'use strict';
/* Estado de la app, conexión y guardado en Firestore */
/* ---------- Estado ---------- */
let months={}, cur=null, tab='resumen';
let ready=false, inflight=null, saving=false, saveTimer=null, retryTimer=null, pendingRender=false;
const dirty=new Set();
let fbApp=null, auth=null, db=null, FS=null, AU=null, unsub=null, me=null, loadTimer=null, cacheTimer=null;
/* ---------- Sin conexión ---------- */
let netPend=false;
function netUI(){
  const b=document.getElementById('netBar'); if(!b) return;
  const off=!navigator.onLine;
  b.hidden=!(off||netPend);
  b.textContent=off
    ? 'Sin conexión. Sigue usando la app: tus cambios se guardan en el teléfono y se envían al volver internet.'
    : 'Enviando los cambios guardados en este teléfono…';
}
/* Si el navegador avisa que no hay red, Firestore trabaja de inmediato con la copia del teléfono (sin esperar 10 s). */
function netSync(){
  try{ if(db&&FS){ (navigator.onLine?FS.enableNetwork(db):FS.disableNetwork(db)).catch(()=>{}); } }catch(e){}
}
window.addEventListener('online',()=>{ netSync(); netUI(); if(typeof dirty!=='undefined'&&dirty.size) setTimeout(flush,800); }); window.addEventListener('offline',()=>{ netSync(); netUI(); });
/* Las escrituras no esperan la confirmación del servidor más de 4 s: sin internet quedan guardadas en el teléfono y se envían al volver. */
function wrapFS(m0){
  e2eRawFS=m0; const m=e2eWrapFS(m0);      /* cifrado de extremo a extremo transparente (cifrado.js) */
  const slow=p=>Promise.race([p,new Promise(r=>setTimeout(()=>{
    if(!netPend){ netPend=true; netUI(); try{ m.waitForPendingWrites(db).then(()=>{ netPend=false; netUI(); setStatus('saved'); }).catch(()=>{}); }catch(e){} }
    r();
  },4000))]);
  return {...m, setDoc:(...a)=>slow(m.setDoc(...a)), updateDoc:(...a)=>slow(m.updateDoc(...a)), deleteDoc:(...a)=>slow(m.deleteDoc(...a))};
}
const hogarCacheKey=()=>'lfh.hogar.'+(me&&me.uid);
let hogarId=null, hogarInfo=null, authMode='login';
function genCode(len){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s=''; const lim=256-(256%chars.length);
  while(s.length<len){ for(const b of crypto.getRandomValues(new Uint8Array(len*2))){ if(b<lim && s.length<len) s+=chars[b%chars.length]; } }
  return s;
}
const mesesCol=()=>FS.collection(db,'hogares',hogarId,'meses');
const mesDocRef=id=>FS.doc(db,'hogares',hogarId,'meses',id);

/* ---------- Guardado ---------- */
function setStatus(kind,err){
  const s=$('#status'); s.classList.remove('err');
  const map={saved:netPend?'✓ Guardado en el teléfono':'✓ Guardado',saving:'Guardando…',editing:'Editando…',ready:'Listo',pend:'⏳ En el teléfono; se envía al volver internet'};
  if(kind==='error'){
    s.classList.add('err');
    s.textContent=(err&&err.code==='permission-denied')?'⚠ Sin permiso para guardar':'⚠ No se pudo guardar';
  } else s.textContent=map[kind]||'';
}
/* "baseMes": lo último que se vio del servidor para cada mes; sirve para saber qué cambió esta persona (ver fusión). */
const baseMes={};
const PEND_KEY=()=>'lfh.pend.'+(hogarId||'');
let pendTimer=null;
/* Copia de seguridad en el teléfono de lo que falta enviar: si se cierra la app o no hay internet, no se pierde. */
function persistPend(){
  clearTimeout(pendTimer);
  pendTimer=setTimeout(()=>{
    try{
      const o={};
      dirty.forEach(id=>{ if(months[id]) o[id]={base:baseMes[id]||null,local:serialize(months[id])}; });
      if(inflight&&months[inflight]&&!o[inflight]) o[inflight]={base:baseMes[inflight]||null,local:serialize(months[inflight])};
      if(Object.keys(o).length) localStorage.setItem(PEND_KEY(),JSON.stringify(o)); else localStorage.removeItem(PEND_KEY());
    }catch(e){}
  },250);
}
function restorePend(){
  let p=null; try{ p=JSON.parse(localStorage.getItem(PEND_KEY())||'null'); }catch(e){}
  if(!p||typeof p!=='object') return false;
  let any=false;
  Object.keys(p).forEach(id=>{
    const e=p[id]; if(!MES_RE.test(id)||!e||typeof e!=='object'||!e.local||typeof e.local!=='object') return;
    baseMes[id]=(e.base&&typeof e.base==='object')?e.base:null;
    months[id]=hydrate(e.local); dirty.add(id); any=true;
  });
  return any;
}
function markDirty(id){
  if(!ready) return;
  dirty.add(id||cur); setStatus('editing'); persistPend();
  clearTimeout(saveTimer); saveTimer=setTimeout(flush,700);
}
/* Guarda un mes: lee lo último del servidor, le aplica solo los cambios de esta persona y escribe todo junto (transacción). */
async function guardarMes(id){
  const local=serialize(months[id]);
  const ref=mesDocRef(id);
  if(FS.runTransaction){
    await Promise.race([
      FS.runTransaction(db,async tx=>{
        const s=await tx.get(ref);
        await tx.set(ref, s.exists() ? mergeMes(baseMes[id]||null,local,serialize(hydrate(s.data()))) : local);
      }),
      new Promise((_,rj)=>setTimeout(()=>rj(Object.assign(new Error('tiempo'),{code:'timeout'})),20000))
    ]);
  } else {
    await FS.setDoc(ref,local);
  }
  baseMes[id]=local;      /* el servidor ya tiene esto (y lo de la pareja); si hay novedades, llegan por el listado en vivo */
}
async function flush(){
  if(saving||!db) return;
  if(!navigator.onLine && FS.runTransaction){ if(dirty.size) setStatus('pend'); return; }   /* sin internet: queda pendiente en el teléfono */
  saving=true;
  try{
    while(dirty.size){
      const id=dirty.values().next().value; dirty.delete(id);
      if(!months[id]) continue;
      inflight=id; setStatus('saving');
      try{ await guardarMes(id); }
      catch(e){ dirty.add(id); throw e; }
      finally{ inflight=null; }
    }
    persistPend();
    setStatus('saved');
  }catch(e){
    setStatus('error',e);
    clearTimeout(retryTimer); retryTimer=setTimeout(()=>{retryTimer=null; flush();},6000);
  }finally{
    saving=false;
    if(dirty.size && !retryTimer){ clearTimeout(saveTimer); saveTimer=setTimeout(flush,400); }
  }
}
/* Si llega una novedad del servidor (por ejemplo, el eco de tu propio guardado) mientras escribes en una línea,
   NO se reemplaza el mes en pantalla: las líneas que ves quedarían desconectadas y lo que escribas se perdería.
   Se espera a que sueltes el campo y entonces se aplica. */
let remoteDiferida=null;
const escribiendoAhora=()=>{ const a=document.activeElement; return !!(ready && a && a.matches && a.matches('input[type="text"]')); };
function onRemote(map,definitive){
  let changed=false;
  Object.keys(map).forEach(id=>{
    if(dirty.has(id)||inflight===id) return;
    if(ready && id===cur && escribiendoAhora()){ remoteDiferida=map; return; }
    const inc=hydrate(map[id]), incS=serialize(inc);
    if(!months[id] || JSON.stringify(serialize(months[id]))!==JSON.stringify(incS)){ months[id]=inc; changed=true; }
    baseMes[id]=incS;
  });
  Object.keys(baseMes).forEach(id=>{ if(!map[id] && !dirty.has(id) && inflight!==id) delete baseMes[id]; });
  Object.keys(months).forEach(id=>{
    if(!map[id] && !dirty.has(id) && inflight!==id){ delete months[id]; changed=true; }
  });
  if(!months[cur]){
    const all=Object.keys(months).sort();
    const today=currentMonthId();
    cur = months[today] ? today : (all.length?all[all.length-1]:null);
    changed=true;
  }
  if(!ready && definitive){
    ready=true; clearTimeout(loadTimer); restorePend(); if(!cur){ const all=Object.keys(months).sort(); cur=all.length?all[all.length-1]:null; } setView('app'); changed=true; setStatus('ready'); loadPapelera(); loadAhorro(); loadCatalogo(); startNotas(); loadExtras();
    if(dirty.size) flush();
  }
  if(changed && ready) safeRender();
  e2eMigrarSiHaceFalta();
}
function safeRender(){
  const a=document.activeElement;
  if(a && a.matches && a.matches('input[type="text"]')){ pendingRender=true; return; }
  render();
}
document.addEventListener('focusout',()=>{
  if(!pendingRender && !remoteDiferida) return;
  setTimeout(()=>{
    const a=document.activeElement;
    if(a && a.matches && a.matches('input[type="text"]')) return;
    if(remoteDiferida){ const m=remoteDiferida; remoteDiferida=null; onRemote(m,true); }
    pendingRender=false; render();
  },80);
});

const monedaRef=()=>FS.doc(db,'hogares',hogarId,'ahorro','config');
async function loadMoneda(){
  setMoneda('ARS'); setPeriodo('quincenal');
  const ck='lfh.cfg.'+hogarId; let d=null;
  try{
    const s=await Promise.race([FS.getDoc(monedaRef()), new Promise((_,rj)=>setTimeout(()=>rj(new Error('tiempo')),5000))]);
    if(s.exists()){ d=s.data(); try{ localStorage.setItem(ck,JSON.stringify({moneda:d.moneda,periodo:d.periodo})); }catch(e){} }
  }catch(e){
    try{ d=JSON.parse(localStorage.getItem(ck)||'null'); }catch(e2){}
  }
  if(d){ if(d.moneda) setMoneda(d.moneda); if(d.periodo) setPeriodo(d.periodo); }
}
async function saveMoneda(code){
  try{ await FS.setDoc(monedaRef(),{moneda:code,periodo:periodo,actualizado:Date.now()}); return true; }
  catch(e){ toast('No se pudo guardar la moneda'); return false; }
}
async function startData(){ await e2eAsegurar(); loadMoneda().then(startData0,startData0); }
function startData0(){
  ready=false; months={}; cur=null; dirty.clear(); Object.keys(baseMes).forEach(k=>delete baseMes[k]); unwatchLive();
  setView('loading'); $('#loadingMsg').textContent='Cargando tus datos…'; $('#loadingErr').textContent='';
  clearTimeout(loadTimer);
  loadTimer=setTimeout(()=>{ if(!ready) $('#loadingMsg').textContent='Sigue cargando… revisa tu conexión a internet.'; },8000);
  unsub=FS.onSnapshot(mesesCol(),snap=>{
    const map={};
    snap.docs.forEach(d=>{ map[d.id]=JSON.parse(JSON.stringify(d.data())); });
    clearTimeout(cacheTimer);
    if(snap.metadata.fromCache && !ready){
      /* Datos guardados en el teléfono: si el servidor no responde (sin internet o señal mala) se usan igual. */
      if(!navigator.onLine){ onRemote(map,true); return; }
      if(snap.docs.length) cacheTimer=setTimeout(()=>{ if(!ready) onRemote(map,true); },3500);
    }
    onRemote(map,!snap.metadata.fromCache);
  },err=>{
    if(err&&(err.code==='e2e-decrypt'||err.code==='e2e-locked')&&!e2eReintento){ e2eReintento=true; e2eBorrarLlave(hogarId).then(()=>{ e2eKey=null; e2eKeyHogar=null; startData(); }); return; }
    if(!ready){
      $('#loadingMsg').textContent='No se pudieron cargar los datos.';
      $('#loadingErr').textContent=(err&&err.code==='permission-denied')
        ? 'Tu cuenta no tiene permiso sobre este hogar. Cierra sesión y vuelve a entrar.'
        : 'Error: '+((err&&err.code)||'desconocido');
    } else setStatus('error',err);
  });
}
function stopData(){ e2eKey=null; e2eKeyHogar=null; e2eReintento=false; clearTimeout(e2eMigTimer);
  if(unsub){ try{unsub();}catch(e){} unsub=null; }
  clearTimeout(loadTimer); clearTimeout(saveTimer); clearTimeout(retryTimer); retryTimer=null;
  setMoneda('ARS'); setPeriodo('quincenal'); stopNotas(); calSel=null; calY=null; months={}; papelera=[]; catalogo=new Map(); ahorro={ahorrado:null,cotizacion:null,meta:null,fechaMeta:'2027-03'}; extras={presupuesto:{},deudas:[],metas:[],repetidos:[],extraDeuda:null,orden:'bola'}; presuExtra.clear(); baseExtras=null; unwatchLive(); cur=null; ready=false; dirty.clear(); Object.keys(baseMes).forEach(k=>delete baseMes[k]); hogarId=null; hogarInfo=null; $('#main').replaceChildren(); closeModal();
}

