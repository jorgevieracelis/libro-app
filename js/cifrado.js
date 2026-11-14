'use strict';
/* Cifrado de extremo a extremo (E2E).
   - Los datos del hogar (meses, ahorro, metas/deudas, lista de compras, notas y papelera) se cifran EN EL TELÉFONO con AES-GCM
     antes de enviarse a Firebase; el servidor solo guarda texto cifrado ({v:'e1', iv, ct}).
   - La llave de datos (DEK) es aleatoria y la guarda el hogar "envuelta" dos veces (en hogares/{id}.e2e):
       a) con la CLAVE DEL HOGAR (PBKDF2-SHA256, 600.000 vueltas)   b) con el CÓDIGO DE RECUPERACIÓN (24 caracteres aleatorios).
     Ni Google ni el administrador conocen la clave ni el código: si se pierden los dos, los datos no se pueden recuperar.
   - En cada teléfono la llave se guarda como "no exportable" en IndexedDB para no pedir la clave cada vez.
   - Esta capa es transparente: wrapFS (guardado.js) pasa todo por e2eWrapFS, así el resto de la app no cambia. */
const E2E_COLS=['meses','papelera','ahorro','catalogo','notas'];
const E2E_IT=600000, E2E_IT_REC=100000;
const e2eEncPath=p=>{ const s=String(p||'').split('/'); return s[0]==='hogares' && s.length>=4 && E2E_COLS.includes(s[2]); };
let e2eKey=null;          /* llave del hogar actual (CryptoKey no exportable) */
let e2eKeyHogar=null;     /* hogar al que pertenece e2eKey */
let e2eReintento=false;   /* ya se intentó volver a pedir la clave tras un error de descifrado */
let e2eLegacy=false;      /* se vio algún documento sin cifrar: hay que migrarlo */
const e2eTE=new TextEncoder(), e2eTD=new TextDecoder();
const e2eRand=n=>crypto.getRandomValues(new Uint8Array(n));
function e2eB64(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
function e2eUnB64(s){ const b=atob(String(s)); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
const e2eNormClave=s=>String(s==null?'':s).normalize('NFKC').trim();
const e2eNormCod=s=>String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');
const e2eFmtCod=c=>String(c).replace(/(.{5})(?=.)/g,'$1-');
const E2E_AES={name:'AES-GCM',length:256};

async function e2eKek(secret,saltB64,iters){
  const base=await crypto.subtle.importKey('raw',e2eTE.encode(secret),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:e2eUnB64(saltB64),iterations:iters},base,E2E_AES,false,['wrapKey','unwrapKey']);
}
async function e2eEnvolver(dek,kek){
  const iv=e2eRand(12);
  const ct=await crypto.subtle.wrapKey('raw',dek,kek,{name:'AES-GCM',iv});
  return {iv:e2eB64(iv),ct:e2eB64(new Uint8Array(ct))};
}
/* Crea la llave de datos y devuelve todo lo necesario: la llave, el código de recuperación y el bloque "e2e" que se guarda en el hogar. */
async function e2eCrear(clave){
  const dek=await crypto.subtle.generateKey(E2E_AES,true,['encrypt','decrypt']);
  const cod=genCode(24);
  const meta=await e2eMeta(dek,clave,cod);
  return {dek,cod,meta};
}
async function e2eMeta(dek,clave,cod){
  const s=e2eB64(e2eRand(16)), rs=e2eB64(e2eRand(16));
  const kek=await e2eKek(e2eNormClave(clave),s,E2E_IT), rkek=await e2eKek(e2eNormCod(cod),rs,E2E_IT_REC);
  return {v:1,it:E2E_IT,s,w:await e2eEnvolver(dek,kek),ri:E2E_IT_REC,rs,rw:await e2eEnvolver(dek,rkek)};
}
/* Abre la llave con la clave del hogar ('clave') o con el código de recuperación ('rec'). Si no coincide, lanza error. */
async function e2eDesenvolver(meta,secreto,tipo,extraible){
  const rec=tipo==='rec';
  const kek=await e2eKek(rec?e2eNormCod(secreto):e2eNormClave(secreto), rec?meta.rs:meta.s, rec?meta.ri:meta.it);
  const w=rec?meta.rw:meta.w;
  return crypto.subtle.unwrapKey('raw',e2eUnB64(w.ct),kek,{name:'AES-GCM',iv:e2eUnB64(w.iv)},E2E_AES,!!extraible,['encrypt','decrypt']);
}
/* Convierte una llave extraíble en una no exportable (la que se guarda en el teléfono). */
async function e2eFija(dek){
  const raw=await crypto.subtle.exportKey('raw',dek);
  const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
  new Uint8Array(raw).fill(0);
  return k;
}
/* Nueva clave del hogar (con la llave ya abierta de forma extraíble). Conserva el código de recuperación. */
async function e2eCambiarClave(meta,dek,claveNueva){
  const s=e2eB64(e2eRand(16)); const kek=await e2eKek(e2eNormClave(claveNueva),s,E2E_IT);
  return {...meta,it:E2E_IT,s,w:await e2eEnvolver(dek,kek)};
}
/* Código de recuperación nuevo (con la llave ya abierta). Conserva la clave del hogar. */
async function e2eNuevoCodigo(meta,dek){
  const cod=genCode(24), rs=e2eB64(e2eRand(16)); const rkek=await e2eKek(e2eNormCod(cod),rs,E2E_IT_REC);
  return {cod,meta:{...meta,ri:E2E_IT_REC,rs,rw:await e2eEnvolver(dek,rkek)}};
}

/* ---------- Sellar / abrir documentos ---------- */
function e2eError(code){ return Object.assign(new Error(code),{code}); }
async function e2eSeal(path,obj,key){
  key=key||e2eKey; if(!key) throw e2eError('e2e-locked');
  const iv=e2eRand(12);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:e2eTE.encode(path)},key,e2eTE.encode(JSON.stringify(obj)));
  return {v:'e1',iv:e2eB64(iv),ct:e2eB64(new Uint8Array(ct))};
}
const e2eEsSobre=d=>!!d && typeof d==='object' && d.v==='e1' && typeof d.iv==='string' && typeof d.ct==='string';
async function e2eOpen(path,data,key){
  if(data==null) return data;
  if(!e2eEsSobre(data)){ e2eLegacy=true; return data; }      /* documento viejo, todavía sin cifrar */
  key=key||e2eKey; if(!key) throw e2eError('e2e-locked');
  try{
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:e2eUnB64(data.iv),additionalData:e2eTE.encode(path)},key,e2eUnB64(data.ct));
    return JSON.parse(e2eTD.decode(pt));
  }catch(e){ throw e2eError('e2e-decrypt'); }
}

/* ---------- Capa transparente sobre Firestore ---------- */
function e2eWrapFS(m){
  const docPlano=async d=>{
    const dato=d.data();
    const plano=await e2eOpen(d.ref.path,dato);
    return {id:d.id,ref:d.ref,exists:()=>true,data:()=>plano,metadata:d.metadata};
  };
  const wrapSnap=async s=>{
    if(!s) return s;
    if(Array.isArray(s.docs)){
      if(!s.docs.some(d=>d.ref&&e2eEncPath(d.ref.path))) return s;
      const docs=[];
      for(const d of s.docs){
        /* Si un documento no se puede abrir NO se ignora (la app creería que ese mes no existe y podría pisarlo): falla todo el listado. */
        docs.push(e2eEncPath(d.ref.path)?await docPlano(d):d);
      }
      return {docs,empty:docs.length===0,size:docs.length,metadata:s.metadata,forEach:f=>docs.forEach(f)};
    }
    if(s.ref && typeof s.exists==='function' && e2eEncPath(s.ref.path) && s.exists()) return docPlano(s);
    return s;
  };
  const wrapTx=tx=>({
    get:async r=>e2eEncPath(r.path)?wrapSnap(await tx.get(r)):tx.get(r),
    set:async(r,data,...x)=>{ if(e2eEncPath(r.path)) tx.set(r,await e2eSeal(r.path,data)); else tx.set(r,data,...x); return tx; },
    update:(...a)=>tx.update(...a), delete:(...a)=>tx.delete(...a)
  });
  return {...m,
    setDoc:async(r,data,...x)=>e2eEncPath(r.path)?m.setDoc(r,await e2eSeal(r.path,data)):m.setDoc(r,data,...x),
    getDoc:async r=>wrapSnap(await m.getDoc(r)),
    getDocs:async q=>wrapSnap(await m.getDocs(q)),
    runTransaction:(d,fn)=>m.runTransaction(d,tx=>fn(wrapTx(tx))),
    onSnapshot:(ref,...a)=>{
      const i=a.findIndex(x=>typeof x==='function'); if(i<0) return m.onSnapshot(ref,...a);
      const cb=a[i], ecb=(typeof a[i+1]==='function')?a[i+1]:null;
      let cadena=Promise.resolve(), vivo=true;
      a[i]=snap=>{ cadena=cadena.then(()=>wrapSnap(snap)).then(s=>{ if(vivo) cb(s); }).catch(err=>{ if(vivo&&ecb) ecb(err); }); };
      const un=m.onSnapshot(ref,...a);
      return ()=>{ vivo=false; try{un();}catch(e){} };
    }
  };
}

/* ---------- Llave guardada en el teléfono (IndexedDB, no exportable) ---------- */
function e2eIDB(){
  return new Promise((ok,no)=>{
    try{
      const r=indexedDB.open('lfh-e2e',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('k');
      r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error);
    }catch(e){ no(e); }
  });
}
async function e2eGuardarLlave(hId,key){
  try{ const d=await e2eIDB(); await new Promise((ok,no)=>{ const t=d.transaction('k','readwrite'); t.objectStore('k').put(key,hId); t.oncomplete=ok; t.onerror=()=>no(t.error); }); d.close(); }catch(e){}
}
async function e2eLeerLlave(hId){
  try{ const d=await e2eIDB(); const k=await new Promise((ok,no)=>{ const r=d.transaction('k').objectStore('k').get(hId); r.onsuccess=()=>ok(r.result||null); r.onerror=()=>no(r.error); }); d.close(); return k; }catch(e){ return null; }
}
async function e2eBorrarLlave(hId){
  try{ const d=await e2eIDB(); await new Promise(ok=>{ const t=d.transaction('k','readwrite'); t.objectStore('k').delete(hId); t.oncomplete=ok; t.onerror=ok; }); d.close(); }catch(e){}
}
