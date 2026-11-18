'use strict';
/* Arranque de Firebase y de la app */
/* ---------- Arranque ---------- */
async function boot(){
  setView('loading'); $('#loadingMsg').textContent='Cargando…'; splashFase(12,'Conectando…'); marca('boot');
  let cfg;
  try{ cfg=(await import(new URL('firebase-config.js',document.baseURI).href)).firebaseConfig; }catch(e){ cfg=null; }
  if(!cfg || !cfg.apiKey || /PEGAR/.test(cfg.apiKey+cfg.projectId)){ setView('setup'); return; }
  try{
    const acP=import(FB+'firebase-app-check.js').catch(()=>null);   /* se descarga en paralelo */
    const [A,AUm,FSm]=await Promise.all([import(FB+'firebase-app.js'),import(FB+'firebase-auth.js'),import(FB+'firebase-firestore.js')]);
    marca('firebase cargado'); splashFase(35,'Abriendo tu sesión…');
    AU=AUm; FS=wrapFS(FSm);
    fbApp=A.initializeApp(cfg);
    /* App Check: demuestra a Firebase que las solicitudes vienen de esta app (reCAPTCHA / Fraud Defense). */
    try{
      const AC=await acP; if(!AC) throw new Error('app-check');
      AC.initializeAppCheck(fbApp,{provider:new AC.ReCaptchaEnterpriseProvider('6LfdSRMuAAAAANDcFLuzLPgIYcr7wO_UH88kFpZ0'),isTokenAutoRefreshEnabled:true});
    }catch(e){ /* si falla, la app sigue; el cumplimiento se activa solo cuando está verificado */ }
    auth=AU.getAuth(fbApp);
    /* Copia local de los datos en el teléfono (funciona sin internet y se sincroniza al volver). */
    try{ db=FS.initializeFirestore(fbApp,{localCache:FS.persistentLocalCache({tabManager:FS.persistentMultipleTabManager()})}); }
    catch(e){ db=FS.getFirestore(fbApp); }
    netSync(); netUI();
  }catch(e){
    $('#loadingMsg').textContent='No se pudo cargar Firebase. Revisa tu conexión a internet y recarga.'; return;
  }
  AU.onAuthStateChanged(auth,user=>{
    marca('sesión'); splashFase(55,'Buscando tu hogar…');
    if(user){ if(idleExpirado()){ idleCerrar(); return; } me=user; idleMarcar(true); if(user.emailVerified) resolveHogar(); else showVerify(); }
    else { const hPrev=hogarId; me=null; stopData(); if(hPrev) e2eBorrarLlave(hPrev); if(lockCfg){ lkStore(null); } lkOcultar(); $('#lockCfg').hidden=true; setView('login'); }
  });
}
/* Con el hogar ya recordado en este teléfono la app abre al instante y lo confirma con el servidor por detrás (antes esperaba hasta 8 s). */
async function confirmarHogar(idPrevio){
  if(!navigator.onLine) return;
  try{
    const q=FS.query(FS.collection(db,'hogares'), FS.where('miembros','array-contains',me.uid));
    const snap=await Promise.race([FS.getDocs(q), new Promise((_,rj)=>setTimeout(()=>rj(new Error('tiempo')),15000))]);
    if(!snap||snap.metadata&&snap.metadata.fromCache) return;
    if(snap.empty){ try{ localStorage.removeItem(hogarCacheKey()); }catch(e){} if(hogarId===idPrevio) location.reload(); return; }
    const d=snap.docs[0];
    if(d.id!==idPrevio){ try{ localStorage.setItem(hogarCacheKey(),JSON.stringify({id:d.id,info:d.data()})); }catch(e){} location.reload(); return; }
    if(hogarId===idPrevio){ hogarInfo=d.data(); try{ localStorage.setItem(hogarCacheKey(),JSON.stringify({id:hogarId,info:hogarInfo})); }catch(e){} }
  }catch(e){ /* sin respuesta: se sigue con lo guardado */ }
}
async function resolveHogar(){
  setView('loading'); $('#loadingMsg').textContent='Buscando tu hogar…'; $('#loadingErr').textContent='';
  try{
    const c=JSON.parse(localStorage.getItem(hogarCacheKey())||'null');
    if(c && c.id && c.info){ hogarId=c.id; hogarInfo=c.info; marca('hogar (guardado)'); splashFase(70,'Cargando tus datos…'); startData(); confirmarHogar(c.id); return; }
  }catch(e){}
  let snap=null;
  if(navigator.onLine){
    try{
      const q=FS.query(FS.collection(db,'hogares'), FS.where('miembros','array-contains',me.uid));
      snap=await Promise.race([FS.getDocs(q), new Promise((_,rj)=>setTimeout(()=>rj(new Error('tiempo')),8000))]);
    }catch(e){ snap=null; }
  }
  if(snap && !snap.empty){
    const d=snap.docs[0];
    hogarId=d.id; hogarInfo=d.data(); marca('hogar (servidor)'); splashFase(70,'Cargando tus datos…');
    try{ localStorage.setItem(hogarCacheKey(),JSON.stringify({id:hogarId,info:hogarInfo})); }catch(e){}
    startData();
    return;
  }
  if(!snap || snap.empty && snap.metadata && snap.metadata.fromCache){
    /* Sin internet o sin respuesta: usa el hogar recordado en este teléfono. */
    try{
      const c=JSON.parse(localStorage.getItem(hogarCacheKey())||'null');
      if(c && c.id){ hogarId=c.id; hogarInfo=c.info||{}; startData(); return; }
    }catch(e){}
  }
  showNoHogar();
}
function showNoHogar(){
  setView('nohogar');
  $('#nhErr').textContent=''; $('#nhCode').value=''; nhInicio();
}
setAuthMode('login');
boot();
