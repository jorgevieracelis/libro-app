'use strict';
/* Bloqueo por claves erróneas, verificación de correo, borrar cuenta y bloqueo de la app */
/* ---------- Bloqueo por claves erróneas (en este teléfono) ---------- */
/* 3 fallos → 10 min de espera. Otros 3 fallos tras la espera → hay que restablecer la clave por correo. */
const LOCK_KEY='lfh.loginLock', LOCK_MAX=3, LOCK_MIN=10;
function lockLeer(){ try{ return JSON.parse(localStorage.getItem(LOCK_KEY)||'null')||{n:0,until:0,fase:0,reset:false}; }catch(e){ return {n:0,until:0,fase:0,reset:false}; } }
function lockGuardar(s){ try{ localStorage.setItem(LOCK_KEY,JSON.stringify(s)); }catch(e){} }
function lockLimpiar(){ try{ localStorage.removeItem(LOCK_KEY); }catch(e){} }
function lockActivo(){ const s=lockLeer(); return s.reset || s.until>Date.now(); }
function lockFallo(){
  const s=lockLeer(); s.n=(s.n||0)+1;
  if(s.n>=LOCK_MAX){
    s.n=0;
    if(s.fase>=1){ s.reset=true; s.until=0; } else { s.fase=1; s.until=Date.now()+LOCK_MIN*60000; }
  }
  lockGuardar(s);
  if(!s.reset && !(s.until>Date.now())) $('#lErr').textContent='Correo o clave incorrectos. Te quedan '+(LOCK_MAX-s.n)+(LOCK_MAX-s.n===1?' intento.':' intentos.');
}
let lockTimer=null;
function lockPintar(){
  const s=lockLeer(), btn=$('#lBtn'), err=$('#lErr'), rs=$('#lReset');
  clearTimeout(lockTimer);
  if(authMode!=='login'){ btn.disabled=false; rs.classList.remove('attn'); return; }
  if(s.reset){
    btn.disabled=true; err.textContent='Por seguridad se bloqueó el ingreso por varios intentos fallidos. Toca "Olvidé mi clave" para cambiarla por correo.';
    rs.classList.add('attn'); return;
  }
  rs.classList.remove('attn');
  const resta=s.until-Date.now();
  if(resta>0){
    btn.disabled=true; const m=Math.floor(resta/60000), sg=Math.ceil((resta%60000)/1000);
    err.textContent='Ingreso bloqueado por seguridad (3 claves erróneas). Prueba de nuevo en '+m+':'+String(sg%60).padStart(2,'0')+', o toca "Olvidé mi clave".';
    lockTimer=setTimeout(lockPintar,1000);
  } else if(btn.disabled && s.until){ btn.disabled=false; if(/bloqueado/.test(err.textContent)) err.textContent=''; }
}
lockPintar();
$('#nhBtn').addEventListener('click',async()=>{
  const btn=$('#nhBtn'); $('#nhErr').textContent=''; btn.disabled=true;
  try{ await joinHogarByCode($('#nhCode').value); startData(); }
  catch(e){ $('#nhErr').textContent=e.message||'No se pudo vincular el código.'; }
  finally{ btn.disabled=false; }
});
$('#nhMoneda').replaceChildren(...MONEDAS.map(m=>{ const o=el('option'); o.value=m.c; o.textContent=m.n+' ('+m.c+')'; return o; }));
$('#nhPeriodo').replaceChildren(...PERIODO_OPC.map(([k,txt])=>{ const o=el('option'); o.value=k; o.textContent=txt; if(k==='quincenal') o.selected=true; return o; }));
$('#nhCrear').addEventListener('click',async()=>{
  const btn=$('#nhCrear'); $('#nhErr').textContent=''; btn.disabled=true;
  try{ await createHogar($('#nhNombre').value); setPeriodo($('#nhPeriodo').value); await e2eAsegurar(); await saveMoneda($('#nhMoneda').value); startData(); }
  catch(e){ $('#nhErr').textContent='No se pudo crear el hogar ('+((e&&e.code)||'error')+').'; }
  finally{ btn.disabled=false; }
});
$('#nhSalir').addEventListener('click',()=>{ if(auth) AU.signOut(auth); });

/* ---------- Verificación de correo ---------- */
function showVerify(){
  setView('verify'); $('#vErr').textContent='';
  $('#vMsg').textContent='Te mandamos un correo a '+(me.email||'')+' para confirmar que es tuyo.';
}
$('#vOk').addEventListener('click',async()=>{
  $('#vErr').textContent='';
  try{
    await me.reload(); await me.getIdToken(true);
    if(me.emailVerified) resolveHogar(); else $('#vErr').textContent='Todavía no figura verificado. Abre el enlace del correo y prueba de nuevo.';
  }catch(e){ $('#vErr').textContent='No se pudo comprobar ('+((e&&e.code)||'error')+').'; }
});
$('#vResend').addEventListener('click',async()=>{
  $('#vErr').textContent='';
  try{ await AU.sendEmailVerification(me); toast('Te lo reenviamos'); }
  catch(e){ $('#vErr').textContent=(e&&e.code==='auth/too-many-requests')?'Espera unos minutos antes de pedir otro.':'No se pudo reenviar.'; }
});
$('#vSalir').addEventListener('click',()=>{ if(auth) AU.signOut(auth); });

/* ---------- Eliminar cuenta y datos ---------- */
async function deleteAllInCol(colRef){
  const snap=await (e2eRawFS||FS).getDocs(colRef);      /* sin descifrar: borrar funciona aunque no se pueda abrir la llave */
  for(const d of snap.docs) await FS.deleteDoc(d.ref);
}
function askDeleteAccount(){
  const body=el('div');
  const p=el('p','small');
  p.textContent='Se borra tu cuenta para siempre. Si eres la única persona del hogar, también se borran todos sus datos (meses, papelera, ahorro y lista de compras). Si tu pareja sigue en el hogar, ella conserva los datos. No se puede deshacer.';
  const l=el('label'); l.append('Escribe tu clave para confirmar: ');
  const inp=el('input'); inp.type='password'; inp.className='txt'; inp.autocomplete='current-password'; l.append(inp);
  const err=el('p','err'); err.setAttribute('role','alert');
  body.append(p,l,err);
  modal('Eliminar mi cuenta',body,[
    {label:'Cancelar'},
    {label:'Eliminar para siempre',cls:'danger',onClick:()=>{ doDeleteAccount(inp.value,err); return false; }}
  ]);
}
async function doDeleteAccount(pass,errEl){
  errEl.textContent='';
  if(!pass){ errEl.textContent='Escribe tu clave.'; return; }
  try{
    await AU.reauthenticateWithCredential(me,AU.EmailAuthProvider.credential(me.email,pass));
  }catch(e){ errEl.textContent='La clave no es correcta.'; return; }
  errEl.textContent='Borrando…';
  try{
    const hRef=FS.doc(db,'hogares',hogarId);
    const hSnap=await FS.getDoc(hRef);
    const miembros=hSnap.exists()?(hSnap.data().miembros||[]):[];
    if(miembros.length<=1){
      stopListening();
      for(const c of ['meses','papelera','ahorro','catalogo','notas']) await deleteAllInCol(FS.collection(db,'hogares',hogarId,c));
      const code=hSnap.exists()?hSnap.data().codigoHogar:null;
      if(code) await FS.deleteDoc(FS.doc(db,'codigosHogar',code));
      await FS.deleteDoc(hRef);
    } else {
      stopListening();
      await FS.updateDoc(hRef,{miembros:miembros.filter(u=>u!==me.uid)});
    }
    await AU.deleteUser(me);
    closeModal(); toast('Tu cuenta fue eliminada');
  }catch(e){ errEl.textContent='No se pudo eliminar ('+((e&&e.code)||'error')+'). Prueba de nuevo.'; }
}
function stopListening(){ if(unsub){ try{unsub();}catch(e){} unsub=null; } clearTimeout(saveTimer); clearTimeout(retryTimer); dirty.clear(); }

/* ---------- Bloqueo de la app (huella/rostro o PIN) ---------- */
/* Es un bloqueo local de este teléfono: la sesión de Firebase sigue abierta, pero la pantalla
   queda tapada hasta verificar. El método biométrico lo decide el teléfono (huella, rostro o bloqueo de pantalla). */
const LK='lfh.lock';
let lockCfg=null, lockBusy=false, lockHiddenAt=0, lockFails=0;
const lkEnc=new TextEncoder();
const lkB64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const lkUn64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const lkRand=n=>crypto.getRandomValues(new Uint8Array(n));
function lkLoad(){ try{ const c=JSON.parse(localStorage.getItem(LK)||'null'); if(c&&(c.mode==='bio'&&c.cred||c.mode==='pin'&&c.hash&&c.salt)) return c; }catch(e){} return null; }
function lkStore(c){ lockCfg=c; try{ if(c) localStorage.setItem(LK,JSON.stringify(c)); else localStorage.removeItem(LK); }catch(e){} }
async function lkHash(pin,salt){
  const k=await crypto.subtle.importKey('raw',lkEnc.encode(pin),'PBKDF2',false,['deriveBits']);
  return lkB64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:150000},k,256));
}
async function lkBioOk(){
  try{ return !!(window.PublicKeyCredential && navigator.credentials && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }catch(e){ return false; }
}
async function lkBioRegistrar(){
  const c=await navigator.credentials.create({publicKey:{
    challenge:lkRand(32), rp:{name:'Libro de Finanzas'},
    user:{id:lkRand(16),name:'hogar',displayName:'Libro de Finanzas'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},
    timeout:60000}});
  return lkB64(c.rawId);
}
async function lkBioVerificar(){
  await navigator.credentials.get({publicKey:{
    challenge:lkRand(32), userVerification:'required', timeout:60000,
    allowCredentials:[{type:'public-key',id:lkUn64(lockCfg.cred),transports:['internal']}]}});
}
function lkMostrar(){
  if(!lockCfg) return;
  $('#lockScreen').hidden=false; document.body.style.overflow='hidden';
  $('#lkErr').textContent=''; $('#lkPinIn').value='';
  const bio=lockCfg.mode==='bio';
  $('#lkBioBtn').hidden=!bio; $('#lkPinForm').hidden=bio;
  $('#lkSalir').textContent=bio?'Cerrar sesión':'Olvidé mi PIN / Cerrar sesión';
  if(bio) lkDesbloquearBio(); else setTimeout(()=>{ try{$('#lkPinIn').focus();}catch(e){} },50);
}
function lkOcultar(){ $('#lockScreen').hidden=true; document.body.style.overflow=''; lockFails=0; }
async function lkDesbloquearBio(){
  if(lockBusy) return; lockBusy=true; $('#lkErr').textContent='';
  try{ await lkBioVerificar(); lkOcultar(); }
  catch(e){ $('#lkErr').textContent='No se pudo verificar. Toca el botón para intentar de nuevo.'; }
  finally{ lockBusy=false; }
}
function lkFalla(){
  lockFails++;
  if(lockFails>=5){ lkStore(null); lkOcultar(); toast('Demasiados intentos. Inicia sesión de nuevo.'); if(auth) AU.signOut(auth); return; }
  $('#lkErr').textContent='PIN incorrecto. Intentos restantes: '+(5-lockFails);
}
$('#lkBioBtn').addEventListener('click',lkDesbloquearBio);
$('#lkPinForm').addEventListener('submit',async ev=>{
  ev.preventDefault(); const pin=$('#lkPinIn').value; $('#lkPinIn').value='';
  if(!lockCfg||!/^\d{4,6}$/.test(pin)){ lkFalla(); return; }
  try{ if(await lkHash(pin,lkUn64(lockCfg.salt))===lockCfg.hash) lkOcultar(); else lkFalla(); }catch(e){ lkFalla(); }
});
$('#lkSalir').addEventListener('click',()=>{ lkStore(null); lkOcultar(); if(auth) AU.signOut(auth); });
document.addEventListener('visibilitychange',()=>{
  if(!lockCfg) return;
  if(document.hidden){ if(!lockBusy) lockHiddenAt=Date.now(); return; }
  if(lockBusy||!lockHiddenAt||!me) return;
  const lejos=(Date.now()-lockHiddenAt)/60000; lockHiddenAt=0;
  if(lejos>=(lockCfg.min||0) && $('#lockScreen').hidden) lkMostrar();
});
/* Pantalla de configuración */
async function lkAbrirCfg(){
  const bioOk=await lkBioOk();
  $('#lkBioOpt').hidden=!bioOk;
  $('#lkBioNote').textContent=bioOk?'(según lo que tenga tu teléfono)':'';
  const modo=lockCfg?lockCfg.mode:'off';
  document.querySelectorAll('input[name=lkMode]').forEach(r=>{ r.checked=r.value===modo; });
  $('#lkTime').value=String(lockCfg?lockCfg.min:1);
  $('#lkPin1').value=''; $('#lkPin2').value=''; $('#lkCfgErr').textContent='';
  lkVistaCfg(); $('#lockCfg').hidden=false;
}
function lkModoSel(){ const r=document.querySelector('input[name=lkMode]:checked'); return r?r.value:'off'; }
function lkVistaCfg(){
  const m=lkModoSel();
  $('#lkPinBox').hidden=m!=='pin'; $('#lkTimeBox').hidden=m==='off';
}
document.querySelectorAll('input[name=lkMode]').forEach(r=>r.addEventListener('change',lkVistaCfg));
$('#lockBtn').addEventListener('click',lkAbrirCfg);
$('#lkCancel').addEventListener('click',()=>{ $('#lockCfg').hidden=true; });
$('#lkSave').addEventListener('click',async ()=>{
  const m=lkModoSel(), min=parseInt($('#lkTime').value,10)||0, err=$('#lkCfgErr'); err.textContent='';
  try{
    if(m==='off'){ lkStore(null); toast('Bloqueo desactivado'); }
    else if(m==='bio'){
      if(lockCfg&&lockCfg.mode==='bio') lkStore({...lockCfg,min});
      else lkStore({mode:'bio',cred:await lkBioRegistrar(),min});
      toast('Bloqueo con huella o rostro activado');
    } else {
      const p1=$('#lkPin1').value, p2=$('#lkPin2').value;
      if(!(lockCfg&&lockCfg.mode==='pin'&&!p1&&!p2)){
        if(!/^\d{4,6}$/.test(p1)){ err.textContent='El PIN debe tener de 4 a 6 números.'; return; }
        if(p1!==p2){ err.textContent='Los PIN no coinciden.'; return; }
        const salt=lkRand(16); lkStore({mode:'pin',salt:lkB64(salt),hash:await lkHash(p1,salt),min});
      } else lkStore({...lockCfg,min});
      toast('Bloqueo con PIN activado');
    }
    $('#lockCfg').hidden=true;
  }catch(e){ err.textContent='No se pudo activar. Si cancelaste la verificación del teléfono, inténtalo de nuevo.'; }
});
lockCfg=lkLoad();
if(lockCfg) lkMostrar();

