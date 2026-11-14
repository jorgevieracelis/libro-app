'use strict';
/* Pantallas del cifrado de extremo a extremo: activar, escribir la clave, recuperar, cambiar clave y migrar lo existente.
   Las funciones de cifrado están en cifrado.js. */
const E2E_MIN=8;
let e2eRawFS=null;     /* Firestore sin la capa de cifrado (para migrar documentos viejos) */

function e2eRoot(){ return document.getElementById('e2eRoot'); }
function e2eCerrar(){ const r=e2eRoot(); if(r){ r.hidden=true; r.replaceChildren(); } }
/* Dibuja una pantalla completa con título, textos, campos y botones. Devuelve {box, err, setBusy}. */
function e2ePantalla(titulo,parrafos,opts){
  opts=opts||{};
  const r=e2eRoot(); r.hidden=false; r.replaceChildren();
  const box=el('div','e2eBox');
  const ic=document.createElementNS('http://www.w3.org/2000/svg','svg'); ic.setAttribute('viewBox','0 0 24 24'); ic.setAttribute('class','bvIco'); ic.setAttribute('aria-hidden','true');
  ic.innerHTML='<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  const h=el('h2'); h.textContent=titulo; box.append(ic,h);
  (parrafos||[]).forEach(t=>{ const p=el('p','small'); if(t instanceof Node) p.append(t); else p.textContent=t; box.append(p); });
  r.append(box); r.scrollTop=0;
  return box;
}
function e2eCampo(box,etiqueta,ph,auto){
  const l=el('label'); l.append(etiqueta+' '); const i=el('input'); i.type='password'; i.placeholder=ph||''; i.autocomplete=auto||'off'; i.setAttribute('autocapitalize','off'); l.append(i); box.append(l); return i;
}
function e2eBoton(box,txt,cls,fn){ const b=el('button','btn '+(cls||'')); b.type='button'; b.textContent=txt; b.addEventListener('click',fn); box.append(b); return b; }
function e2eLink(box,txt,fn){ const b=el('button','link'); b.type='button'; b.textContent=txt; b.addEventListener('click',fn); box.append(b); return b; }
function e2eSalir(box){ e2eLink(box,'Cerrar sesión',()=>{ e2eCerrar(); if(auth) AU.signOut(auth); }); }
function e2eErrEl(box){ const p=el('p','err'); p.setAttribute('role','alert'); box.append(p); return p; }
const e2eEspera=()=>new Promise(r=>setTimeout(r,30));
function e2eGuardarCacheHogar(){ try{ localStorage.setItem(hogarCacheKey(),JSON.stringify({id:hogarId,info:hogarInfo})); }catch(e){} }

/* ---------- Entrada: se llama antes de cargar los datos del hogar ---------- */
function e2eAsegurar(){
  if(e2eKey && e2eKeyHogar===hogarId) return Promise.resolve();
  e2eKey=null; e2eLegacy=false;
  return new Promise(async resolve=>{
    const fin=()=>{ e2eKeyHogar=hogarId; e2eCerrar(); resolve(); };
    const meta=hogarInfo&&hogarInfo.e2e;
    if(meta){
      const k=await e2eLeerLlave(hogarId);
      if(k){ e2eKey=k; fin(); return; }
      e2ePedirClave(fin);
    } else e2eActivar(fin);
  });
}

/* ---------- 1) Activar el cifrado (hogar nuevo o hogar que todavía tiene datos sin cifrar) ---------- */
function e2eActivar(fin){
  const box=e2ePantalla('Protege tus datos',[
    'Tus finanzas son privadas. Con el cifrado, tus datos se convierten en texto ilegible EN TU TELÉFONO antes de enviarse: ni Google ni el creador de la app pueden leerlos.',
    'Elige la clave del hogar. La usarán tú y tu pareja para abrir los datos en cada teléfono nuevo.'
  ]);
  const c1=e2eCampo(box,'Clave del hogar (mínimo '+E2E_MIN+' caracteres)','Una frase fácil de recordar','new-password');
  const c2=e2eCampo(box,'Repite la clave','','new-password');
  const aviso=el('p','small'); aviso.style.cssText='background:var(--chip); padding:10px 12px; border-radius:12px; text-align:left';
  aviso.innerHTML='<b>Importante:</b> si olvidas esta clave y también pierdes el código de recuperación que te daremos, <b>nadie podrá recuperar tus datos</b>. Tampoco nosotros.';
  box.append(aviso);
  const err=e2eErrEl(box);
  const btn=e2eBoton(box,'Activar cifrado','primary',async()=>{
    err.textContent='';
    const a=e2eNormClave(c1.value), b=e2eNormClave(c2.value);
    if(a.length<E2E_MIN){ err.textContent='La clave debe tener al menos '+E2E_MIN+' caracteres.'; return; }
    if(a!==b){ err.textContent='Las dos claves no coinciden.'; return; }
    if(!navigator.onLine){ err.textContent='Para activar el cifrado necesitas conexión a internet.'; return; }
    btn.disabled=true; btn.textContent='Protegiendo…'; await e2eEspera();
    try{
      const {dek,cod,meta}=await e2eCrear(a);
      const ref=FS.doc(db,'hogares',hogarId); let ya=null;
      await FS.runTransaction(db,async tx=>{ const s=await tx.get(ref); const d=s.data()||{}; if(d.e2e){ ya=d; return; } tx.update(ref,{e2e:meta}); });
      if(ya){ hogarInfo=ya; e2eGuardarCacheHogar(); e2ePedirClave(fin,'Tu pareja ya activó el cifrado de este hogar. Escribe la clave del hogar que eligió.'); return; }
      hogarInfo={...hogarInfo,e2e:meta}; e2eGuardarCacheHogar();
      const k=await e2eFija(dek); e2eKey=k; await e2eGuardarLlave(hogarId,k);
      e2eMostrarCodigo(cod,()=>e2eMigrarPantalla(fin));
    }catch(e){
      btn.disabled=false; btn.textContent='Activar cifrado';
      err.textContent='No se pudo activar ('+((e&&e.code)||'error')+'). Revisa tu conexión y prueba de nuevo.';
    }
  });
  e2eSalir(box); c1.focus();
}

/* ---------- 2) Código de recuperación ---------- */
function e2eMostrarCodigo(cod,siguiente){
  const box=e2ePantalla('Guarda tu código de recuperación',[
    'Este código es la única forma de recuperar tus datos si olvidas la clave del hogar. Guárdalo en un lugar seguro (papel, gestor de contraseñas o Drive personal). No se vuelve a mostrar.'
  ]);
  const code=el('div'); code.textContent=e2eFmtCod(cod); code.style.cssText='font:700 20px/1.3 ui-monospace,Menlo,Consolas,monospace; letter-spacing:.08em; text-align:center; padding:14px 10px; border-radius:12px; background:var(--chip); word-break:break-all; user-select:all';
  box.append(code);
  const fila=el('div','tools'); fila.style.justifyContent='center';
  const bC=el('button','btn'); bC.type='button'; bC.textContent='Copiar';
  bC.addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(e2eFmtCod(cod)); toast('Código copiado'); }catch(e){ toast('No se pudo copiar: anótalo a mano'); } });
  const bD=el('button','btn'); bD.type='button'; bD.textContent='Descargar (.txt)';
  bD.addEventListener('click',()=>{
    const txt='Libro de Finanzas — código de recuperación\n\nGuárdalo en un lugar seguro. Con este código puedes volver a abrir tus datos si olvidas la clave del hogar.\n\n'+e2eFmtCod(cod)+'\n';
    const a=el('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'})); a.download='codigo-recuperacion-libro-de-finanzas.txt'; document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
  });
  fila.append(bC,bD); box.append(fila);
  const lab=el('label'); lab.style.cssText='display:flex; gap:8px; align-items:flex-start; text-align:left; font-size:13px';
  const ck=el('input'); ck.type='checkbox'; ck.style.cssText='width:auto; margin-top:3px'; lab.append(ck,document.createTextNode('Ya guardé mi código de recuperación en un lugar seguro.'));
  box.append(lab);
  const go=e2eBoton(box,'Continuar','primary',siguiente); go.disabled=true;
  ck.addEventListener('change',()=>{ go.disabled=!ck.checked; });
}

/* ---------- 3) Cifrar lo que ya existía ---------- */
async function e2eMigrar(progreso){
  const raw=e2eRawFS; if(!raw||!e2eKey||!hogarId) return 0;
  let n=0;
  for(const col of E2E_COLS){
    const snap=await raw.getDocs(raw.collection(db,'hogares',hogarId,col));
    for(const d of snap.docs){
      const dato=d.data();
      if(e2eEsSobre(dato)) continue;
      await Promise.race([raw.setDoc(d.ref,await e2eSeal(d.ref.path,dato)), new Promise(r=>setTimeout(r,15000))]); n++;
      if(progreso) progreso(n);
    }
  }
  e2eLegacy=false;
  return n;
}
async function e2eMigrarPantalla(fin){
  const box=e2ePantalla('Cifrando tus datos',['Estamos protegiendo lo que ya tenías guardado. No cierres la app.']);
  const st=el('p','small'); st.textContent='Un momento…'; box.append(st);
  try{ const n=await e2eMigrar(k=>{ st.textContent='Documentos protegidos: '+k; }); if(n) toast('Tus datos ya están cifrados'); }
  catch(e){ toast('Parte de tus datos se cifrará más tarde'); e2eLegacy=true; }
  fin();
}
/* Si más tarde aparece algún documento sin cifrar (por ejemplo, de una versión vieja de la app), se cifra solo. */
let e2eMigTimer=null;
function e2eMigrarSiHaceFalta(){
  if(!e2eLegacy||!e2eKey) return;
  clearTimeout(e2eMigTimer);
  e2eMigTimer=setTimeout(()=>{ if(e2eLegacy&&e2eKey&&navigator.onLine) e2eMigrar().catch(()=>{}); },2500);
}

/* ---------- 4) Escribir la clave del hogar (teléfono nuevo, o se cerró sesión) ---------- */
function e2ePedirClave(fin,aviso){
  const meta=hogarInfo&&hogarInfo.e2e;
  const box=e2ePantalla('Abre tus datos',[aviso||'Tus datos están cifrados. Escribe la clave del hogar para abrirlos en este teléfono.']);
  const c=e2eCampo(box,'Clave del hogar','','current-password');
  const err=e2eErrEl(box);
  const entrar=async()=>{
    err.textContent=''; if(!c.value) return;
    btn.disabled=true; btn.textContent='Abriendo…'; await e2eEspera();
    try{
      const k=await e2eDesenvolver(meta,c.value,'clave',false);
      e2eKey=k; await e2eGuardarLlave(hogarId,k); fin(); e2eMigrarSiHaceFalta();
    }catch(e){ err.textContent='Esa clave no es correcta.'; btn.disabled=false; btn.textContent='Abrir'; c.select(); }
  };
  const btn=e2eBoton(box,'Abrir','primary',entrar);
  c.addEventListener('keydown',ev=>{ if(ev.key==='Enter') entrar(); });
  e2eLink(box,'Olvidé la clave del hogar',()=>e2eRecuperar(fin));
  e2eSalir(box); c.focus();
}

/* ---------- 5) Olvidé la clave: se usa el código de recuperación y se elige una clave nueva ---------- */
function e2eRecuperar(fin){
  const meta=hogarInfo&&hogarInfo.e2e;
  const box=e2ePantalla('Recuperar con el código',['Escribe el código de recuperación que guardaste y elige una clave del hogar nueva.']);
  const c0=e2eCampo(box,'Código de recuperación','XXXXX-XXXXX-XXXXX-XXXXX-XXXXX','off');
  const c1=e2eCampo(box,'Clave nueva (mínimo '+E2E_MIN+' caracteres)','','new-password');
  const c2=e2eCampo(box,'Repite la clave nueva','','new-password');
  const err=e2eErrEl(box);
  const btn=e2eBoton(box,'Recuperar','primary',async()=>{
    err.textContent='';
    const a=e2eNormClave(c1.value);
    if(a.length<E2E_MIN){ err.textContent='La clave debe tener al menos '+E2E_MIN+' caracteres.'; return; }
    if(a!==e2eNormClave(c2.value)){ err.textContent='Las dos claves no coinciden.'; return; }
    if(!navigator.onLine){ err.textContent='Para cambiar la clave necesitas conexión a internet.'; return; }
    btn.disabled=true; btn.textContent='Recuperando…'; await e2eEspera();
    try{
      let dek; try{ dek=await e2eDesenvolver(meta,c0.value,'rec',true); }catch(e){ err.textContent='Ese código no es correcto.'; btn.disabled=false; btn.textContent='Recuperar'; return; }
      const nuevo=await e2eCambiarClave(meta,dek,a);
      await FS.updateDoc(FS.doc(db,'hogares',hogarId),{e2e:nuevo});
      hogarInfo={...hogarInfo,e2e:nuevo}; e2eGuardarCacheHogar();
      const k=await e2eFija(dek); e2eKey=k; await e2eGuardarLlave(hogarId,k);
      toast('Listo: tu clave del hogar es la nueva'); fin(); e2eMigrarSiHaceFalta();
    }catch(e){ err.textContent='No se pudo recuperar ('+((e&&e.code)||'error')+').'; btn.disabled=false; btn.textContent='Recuperar'; }
  });
  e2eLink(box,'Volver',()=>e2ePedirClave(fin));
  e2eSalir(box); c0.focus();
}

/* ---------- 6) Dentro de la app: estado, cambiar clave y código nuevo ---------- */
function e2eAjustes(v){
  const host=$('#e2eTools',v); if(!host) return;
  host.replaceChildren();
  const st=el('p','small'); st.textContent=(hogarInfo&&hogarInfo.e2e)?'✓ Cifrado de extremo a extremo activado en este hogar.':'El cifrado todavía no está activado.'; host.before(st);
  const b1=el('button','btn'); b1.type='button'; b1.textContent='Cambiar la clave del hogar'; b1.addEventListener('click',()=>e2eDialogoClave());
  const b2=el('button','btn'); b2.type='button'; b2.textContent='Generar código de recuperación nuevo'; b2.addEventListener('click',()=>e2eDialogoCodigo());
  host.append(b1,b2);
}
function e2eDialogoPide(titulo,texto,campos,okTxt,accion){
  const body=el('div'); const p=el('p','small'); p.textContent=texto; body.append(p);
  const ins=campos.map(([et,auto])=>{ const l=el('label'); l.style.cssText='display:block; margin-top:8px'; l.append(et+' '); const i=el('input','txt'); i.type='password'; i.autocomplete=auto||'off'; i.style.cssText='width:100%; margin-top:4px'; l.append(i); body.append(l); return i; });
  const err=el('p','err'); err.setAttribute('role','alert'); body.append(err);
  modal(titulo,body,[{label:'Cancelar'},{label:okTxt,cls:'primary',onClick:()=>{
    err.textContent='';
    (async()=>{ try{ const r=await accion(ins.map(i=>i.value),err); if(r!==false) closeModal(); }catch(e){ err.textContent='No se pudo ('+((e&&e.code)||'error')+').'; } })();
    return false;
  }}]);
}
function e2eDialogoClave(){
  e2eDialogoPide('Cambiar la clave del hogar','Tu pareja tendrá que usar la clave nueva si abre la app en un teléfono nuevo. Los teléfonos que ya la tienen no se ven afectados.',
    [['Clave actual','current-password'],['Clave nueva (mínimo '+E2E_MIN+')','new-password'],['Repite la clave nueva','new-password']],'Cambiar',
    async([act,nu,rep],err)=>{
      if(e2eNormClave(nu).length<E2E_MIN){ err.textContent='La clave nueva debe tener al menos '+E2E_MIN+' caracteres.'; return false; }
      if(e2eNormClave(nu)!==e2eNormClave(rep)){ err.textContent='Las dos claves nuevas no coinciden.'; return false; }
      if(!navigator.onLine){ err.textContent='Necesitas conexión a internet.'; return false; }
      const meta=hogarInfo.e2e; let dek;
      try{ dek=await e2eDesenvolver(meta,act,'clave',true); }catch(e){ err.textContent='La clave actual no es correcta.'; return false; }
      const nuevo=await e2eCambiarClave(meta,dek,nu);
      await FS.updateDoc(FS.doc(db,'hogares',hogarId),{e2e:nuevo}); hogarInfo={...hogarInfo,e2e:nuevo}; e2eGuardarCacheHogar();
      toast('Clave del hogar cambiada');
    });
}
function e2eDialogoCodigo(){
  e2eDialogoPide('Código de recuperación nuevo','El código anterior dejará de servir. Escribe la clave del hogar para generar uno nuevo.',
    [['Clave del hogar','current-password']],'Generar',
    async([act],err)=>{
      if(!navigator.onLine){ err.textContent='Necesitas conexión a internet.'; return false; }
      const meta=hogarInfo.e2e; let dek;
      try{ dek=await e2eDesenvolver(meta,act,'clave',true); }catch(e){ err.textContent='La clave no es correcta.'; return false; }
      const r=await e2eNuevoCodigo(meta,dek);
      await FS.updateDoc(FS.doc(db,'hogares',hogarId),{e2e:r.meta}); hogarInfo={...hogarInfo,e2e:r.meta}; e2eGuardarCacheHogar();
      closeModal(); e2eMostrarCodigo(r.cod,()=>e2eCerrar());
      return false;
    });
}
