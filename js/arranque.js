'use strict';
/* Arranque de Firebase y de la app */
/* ---------- Arranque ---------- */
async function boot(){
  setView('loading'); $('#loadingMsg').textContent='Cargando…';
  let cfg;
  try{ cfg=(await import(new URL('firebase-config.js',document.baseURI).href)).firebaseConfig; }catch(e){ cfg=null; }
  if(!cfg || !cfg.apiKey || /PEGAR/.test(cfg.apiKey+cfg.projectId)){ setView('setup'); return; }
  try{
    const [A,AUm,FSm]=await Promise.all([import(FB+'firebase-app.js'),import(FB+'firebase-auth.js'),import(FB+'firebase-firestore.js')]);
    AU=AUm; FS=wrapFS(FSm);
    fbApp=A.initializeApp(cfg);
    /* App Check: demuestra a Firebase que las solicitudes vienen de esta app (reCAPTCHA / Fraud Defense). */
    try{
      const AC=await import(FB+'firebase-app-check.js');
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
    if(user){ me=user; if(user.emailVerified) resolveHogar(); else showVerify(); }
    else { me=null; stopData(); if(lockCfg){ lkStore(null); } lkOcultar(); $('#lockCfg').hidden=true; setView('login'); }
  });
}
async function resolveHogar(){
  setView('loading'); $('#loadingMsg').textContent='Buscando tu hogar…'; $('#loadingErr').textContent='';
  let snap=null;
  if(navigator.onLine){
    try{
      const q=FS.query(FS.collection(db,'hogares'), FS.where('miembros','array-contains',me.uid));
      snap=await Promise.race([FS.getDocs(q), new Promise((_,rj)=>setTimeout(()=>rj(new Error('tiempo')),8000))]);
    }catch(e){ snap=null; }
  }
  if(snap && !snap.empty){
    const d=snap.docs[0];
    hogarId=d.id; hogarInfo=d.data();
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
  $('#nhErr').textContent=''; $('#nhCode').value='';
}
setAuthMode('login');
boot();
