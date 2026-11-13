'use strict';
/* Novedades, ventanas, instalación, ingreso y registro */
/* ---------- Versión y novedades ---------- */
/* Para cada mejora nueva: subir APP_VERSION, agregar una entrada ARRIBA de NOVEDADES y subir el service worker. */
const APP_VERSION='1.6.2';
const NOVEDADES=[
 {v:'1.6.2', fecha:'13 nov 2026', items:[
  'Aviso de derechos de autor al pie de la app y en la política de privacidad']},
 {v:'1.6.1', fecha:'13 nov 2026', items:[
  'Arreglo: la lista de Novedades y otras ventanas largas ahora se pueden desplazar hacia arriba y hacia abajo en el teléfono']},
 {v:'1.6', fecha:'13 nov 2026', items:[
  'Pantalla de inicio animada con el logo mientras abre la app',
  'Nueva tipografía Plus Jakarta Sans, guardada dentro de la app (se ve igual en todos los teléfonos y funciona sin internet)']},
 {v:'1.5', fecha:'13 nov 2026', items:[
  'Diseño renovado: Resumen con anillo de gasto y balance destacado, tarjetas y tipografía más modernas',
  'Barra de navegación abajo en el teléfono (Resumen, Libro, Compras, Calendario y Más)',
  'Encabezado más compacto y íconos de línea en lugar de emojis',
  'Animaciones suaves al cambiar de pantalla']},
 {v:'1.4', fecha:'13 nov 2026', items:[
  'Presupuesto, metas, deudas, pagos repetidos y ahorro en dólares se actualizan solos cuando tu pareja los cambia',
  'Mejoras internas para que la app sea más estable y fácil de mantener']},
 {v:'1.3', fecha:'13 nov 2026', items:[
  'Si tu pareja y tú editan el mismo mes a la vez, la app junta los cambios de los dos en vez de quedarse con el último',
  'Lo mismo para presupuesto, metas, deudas y pagos repetidos',
  'Sin internet, tus cambios quedan guardados en el teléfono y se envían al volver la conexión, aunque cierres la app']},
 {v:'1.2.1', fecha:'13 nov 2026', items:[
  'Respaldo más simple: botones Descargar e Importar en azul cromado (se quitó Compartir / Drive / WhatsApp / correo, que no funcionaba bien en todos los teléfonos)']},
 {v:'1.2', fecha:'13 nov 2026', items:[
  'Más seguridad: tras 3 claves erróneas el ingreso se bloquea 10 minutos; si vuelve a fallar 3 veces, hay que cambiar la clave por correo',
  'Recuperar mis datos con tu respaldo (.json) desde la pantalla de ingreso',
  'Botones con acabado azul cromado y luz naranja al pulsarlos',
  'Consejos del mes ahora se abren desde un botón junto a la Guía de uso, con la opción de ver otros']},
 {v:'1.1', fecha:'12 nov 2026', items:[
  'Pagos fijos en el calendario (alquiler, luz, internet, seguros…) y opción de repetirlos cada mes',
  'Aviso de pagos próximos y vencidos en Resumen',
  'Consejos del mes calculados en tu teléfono',
  'Presupuesto por categoría con barras de avance',
  'Metas de ahorro y calculadora de deudas (pestaña Metas y deudas)',
  'Gráfico de evolución del año y reporte anual en PDF',
  'Recordatorio de respaldo semanal, quincenal o mensual',
  'Esta lista de novedades']},
 {v:'1.0', fecha:'9 nov 2026', items:[
  'Modo sin internet',
  '12 monedas (se sumaron euro y dólar canadiense)',
  'Bloqueo con huella, rostro o PIN',
  'Guía de uso en PDF']}
];
const VER_KEY='lfh.verVista';
function verVista(){ try{ return localStorage.getItem(VER_KEY); }catch(e){ return null; } }
function verPintar(){
  const t=$('#verTxt'), d=$('#verDot'); if(!t||!d) return;
  t.textContent='Versión '+APP_VERSION+' · Novedades';
  d.hidden=verVista()===APP_VERSION;
}
function verAbrir(){
  const body=el('div');
  NOVEDADES.forEach((n,i)=>{
    const h=el('div','verHead'); const a=el('b'); a.textContent='Versión '+n.v+(i===0?' (la tuya)':''); const f=el('span'); f.textContent=n.fecha; h.append(a,f); body.append(h);
    const ul=el('ul','verList'); n.items.forEach(x=>{ const li=el('li'); li.textContent=x; ul.append(li); }); body.append(ul);
  });
  modal('Novedades',body,[{label:'Cerrar',cls:'primary'}]);
  try{ localStorage.setItem(VER_KEY,APP_VERSION); }catch(e){}
  verPintar();
}
document.getElementById('verBtn').addEventListener('click',verAbrir);
verPintar();

/* ---------- Ventanas ---------- */
function closeModal(){ $('#modal-root').replaceChildren(); document.body.classList.remove('modalOpen'); document.removeEventListener('keydown',escClose); }
function escClose(e){ if(e.key==='Escape') closeModal(); }
function modal(title,body,actions){
  const root=$('#modal-root'); root.replaceChildren();
  const ov=el('div','overlay'); const box=el('div','modal'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  const h=el('h3'); h.textContent=title; const sc=el('div','modalBody'); sc.append(body); box.append(h,sc);
  const bar=el('div','actions');
  actions.forEach(a=>{
    const b=el('button','btn'+(a.cls?' '+a.cls:'')); b.type='button'; b.textContent=a.label;
    b.addEventListener('click',()=>{ if(a.onClick && a.onClick()===false) return; closeModal(); });
    bar.append(b);
  });
  box.append(bar); ov.append(box);
  ov.addEventListener('click',e=>{ if(e.target===ov) closeModal(); });
  root.append(ov); document.body.classList.add('modalOpen'); document.addEventListener('keydown',escClose);
}
function currentMonthId(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function nextMonthId(){
  const ids=Object.keys(months).sort(); if(!ids.length) return currentMonthId();
  const last=ids[ids.length-1];
  let y=Number(last.slice(0,4)), m=Number(last.slice(5,7))+1; if(m>12){m=1;y++;}
  return y+'-'+String(m).padStart(2,'0');
}
const cloneRows=(rows,sec)=>rows.filter(r=>!isBlank(r,sec)).map(r=>{const o=normRow(r,sec); o.id=uid(); if('pagado' in o) o.pagado=false; return o;});
function createMonth(id,opts){
  if(months[id]){ cur=id; tab='resumen'; render(); toast('Ese mes ya existía: te lo muestro'); return; }
  const src=(opts&&months[cur])?months[cur]:null; const md={v:1, ...normMonthFields(src||{})};
  cur=id;
  ALLQ.forEach(q=>{
    md[q]={};
    SECS.forEach(sec=>{
      const keep=src&&((sec==='plataformas'&&opts.plat)||(sec==='ingresos'&&opts.ing)||(sec==='egresos'&&opts.egr));
      md[q][sec]=keep?cloneRows(src[q][sec],sec):[];
    });
    SECS.forEach(sec=>padSec(md[q],sec));
    md[q].compras=[];
  });
  months[id]=md; tab='resumen'; dirty.add(id); persistPend(); render(); flush();
}
function newMonthDialog(){
  const body=el('div');
  const l1=el('label'); l1.append('Mes: ');
  const inp=el('input'); inp.type='month'; inp.value=nextMonthId(); inp.className='txt'; inp.setAttribute('aria-label','Mes nuevo'); l1.append(inp);
  const l2=el('label'); const c1=el('input'); c1.type='checkbox'; c1.checked=true; l2.append(c1,'Copiar plataformas y reparto');
  const l3=el('label'); const c2=el('input'); c2.type='checkbox'; c2.checked=true; l3.append(c2,'Copiar ingresos (después cambias los montos)');
  const l4=el('label'); const c4=el('input'); c4.type='checkbox'; c4.checked=true; l4.append(c4,'Copiar egresos fijos (sin marcar como pagados)');
  const note=el('p','small');
  note.textContent = cur
    ? ('Los egresos variables arrancan vacíos. Se copia desde '+monthLabel(cur)+'.')
    : 'Es tu primer mes: arranca vacío para que cargues todo.';
  body.append(l1);
  if(cur) body.append(l2,l3,l4);
  body.append(note);
  modal('Nuevo mes',body,[
    {label:'Cancelar'},
    {label:'Crear mes',cls:'primary',onClick:()=>{
      const id=inp.value.trim();
      if(!MES_RE.test(id)){ toast('Escribe el mes como AAAA-MM'); return false; }
      createMonth(id,{plat:c1.checked,ing:c2.checked,egr:c4.checked});
    }}
  ]);
}
function askDeleteMonth(){
  if(Object.keys(months).length<2){ toast('No se puede eliminar el único mes'); return; }
  const id=cur;
  const p=el('p'); p.textContent='Se mueve '+monthLabel(id)+' (con todo lo que cargaste) a la Papelera. Puedes restaurarlo durante '+PAPELERA_DIAS+' días.';
  modal('¿Eliminar '+monthLabel(id)+'?',p,[
    {label:'Cancelar'},
    {label:'Eliminar',cls:'danger solid',onClick:async()=>{
      dirty.delete(id); delete baseMes[id]; persistPend();
      const entry={id, eliminadoEn:Date.now(), datos:serialize(months[id])};
      try{
        await FS.setDoc(papeleraRef(id),{eliminadoEn:entry.eliminadoEn, datos:entry.datos});
        await FS.deleteDoc(mesDocRef(id));
      }catch(e){ toast('No se pudo eliminar'); return; }
      papelera=papelera.filter(x=>x.id!==id); papelera.unshift(entry);
      delete months[id];
      const all=Object.keys(months).sort(); const today=currentMonthId();
      cur = months[today] ? today : all[all.length-1]; render(); toast('Mes movido a la Papelera');
    }}
  ]);
}

/* ---------- Eventos ---------- */
$('#mes').addEventListener('change',e=>{ cur=e.target.value; render(); });
$('#nuevoMes').addEventListener('click',newMonthDialog);
$('#salir').addEventListener('click',()=>{ if(auth) AU.signOut(auth); });

/* ---------- Instalar como app (Android/Windows) ---------- */
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredInstall=e; $('#installBtn').hidden=false;
});
$('#installBtn').addEventListener('click',async()=>{
  if(!deferredInstall) return;
  $('#installBtn').hidden=true;
  deferredInstall.prompt();
  try{ await deferredInstall.userChoice; }catch(e){}
  deferredInstall=null;
});
window.addEventListener('appinstalled',()=>{ $('#installBtn').hidden=true; deferredInstall=null; toast('Instalada. Ya la tienes en tu equipo.'); });
if(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone){ $('#installBtn').hidden=true; }
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('service-worker.js').catch(()=>{}); });
}

function loginError(e){
  const c=(e&&e.code)||'';
  if(/invalid-credential|wrong-password|user-not-found|invalid-email|missing-password/.test(c)) return 'Correo o clave incorrectos.';
  if(c==='auth/email-already-in-use') return 'Ya existe una cuenta con ese correo. Prueba "Ingresar".';
  if(c==='auth/weak-password') return 'La clave tiene que tener al menos 6 caracteres.';
  if(c==='auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos y prueba de nuevo.';
  if(c==='auth/network-request-failed') return 'Sin conexión a internet. Para ingresar la primera vez en este teléfono necesitas conexión; después podrás usar la app sin internet.';
  if(c==='auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase (ver LEEME).';
  return 'No se pudo ingresar ('+(c||'error')+').';
}
async function joinHogarByCode(rawCode){
  const code=String(rawCode||'').trim().toUpperCase();
  if(!code) throw new Error('Escribe un código.');
  let chSnap;
  try{ chSnap=await FS.getDoc(FS.doc(db,'codigosHogar',code)); }catch(e){ chSnap=null; }
  if(!chSnap || !chSnap.exists()) throw new Error('Ese código no es válido.');
  const hId=chSnap.data().hogarId;
  try{ await FS.updateDoc(FS.doc(db,'hogares',hId),{miembros:FS.arrayUnion(me.uid)}); }
  catch(e){ throw new Error('No se pudo sumar a ese hogar (puede estar completo).'); }
  hogarId=hId;
  try{ const hSnap=await FS.getDoc(FS.doc(db,'hogares',hId)); hogarInfo=hSnap.data(); }catch(e){}
}
async function createHogar(nombre){
  const hogarRef=FS.doc(FS.collection(db,'hogares'));
  const codigoHogar=genCode(8);
  const info={nombre:String(nombre||'').trim()||'Mi hogar', creadoPor:me.uid, miembros:[me.uid], codigoHogar};
  const batch=FS.writeBatch(db);
  batch.set(hogarRef,info);
  batch.set(FS.doc(db,'codigosHogar',codigoHogar),{hogarId:hogarRef.id});
  await batch.commit();
  hogarId=hogarRef.id; hogarInfo=info;
}
function setAuthMode(mode){
  authMode=mode;
  const signup=mode==='signup';
  $('#authTitle').textContent=signup?'Crear cuenta':'Ingresar';
  $('#lBtn').textContent=signup?'Crear cuenta':'Entrar';
  $('#lReset').hidden=signup;
  $('#lToggle').textContent=signup?'¿Ya tienes cuenta? Ingresa':'¿No tienes cuenta? Crea una';
  $('#lErr').textContent='';
  lockPintar();
}
$('#lToggle').addEventListener('click',()=>setAuthMode(authMode==='login'?'signup':'login'));
$('#loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  if(authMode==='login' && lockActivo()){ lockPintar(); return; }
  const btn=$('#lBtn'); $('#lErr').textContent=''; btn.disabled=true;
  const email=$('#lEmail').value.trim(), pass=$('#lPass').value;
  try{
    if(authMode==='signup'){
      const cred=await AU.createUserWithEmailAndPassword(auth,email,pass);
      try{ await AU.sendEmailVerification(cred.user); }catch(e){}
    } else {
      await AU.signInWithEmailAndPassword(auth,email,pass);
      lockLimpiar();
    }
    $('#lPass').value='';
  }
  catch(e){
    if(authMode==='login' && /invalid-credential|wrong-password/.test((e&&e.code)||'')){ lockFallo(); $('#lPass').value=''; }
    else $('#lErr').textContent=loginError(e);
  }
  finally{ btn.disabled=false; lockPintar(); }
});
$('#lReset').addEventListener('click',async()=>{
  const email=$('#lEmail').value.trim();
  if(!email){ $('#lErr').textContent='Escribe tu correo arriba y toca de nuevo.'; return; }
  try{ await AU.sendPasswordResetEmail(auth,email); $('#lErr').textContent=''; lockLimpiar(); lockPintar(); toast('Si el correo existe, te llegó un mensaje para cambiar la clave'); }
  catch(e){ $('#lErr').textContent=loginError(e); }
});
$('#lRecover').addEventListener('click',()=>{
  const body=el('div');
  const p=el('p'); p.textContent='Si perdiste el acceso a tu cuenta pero guardaste un respaldo (.json), tus datos se pueden recuperar así:'; body.append(p);
  const ol=el('ol');
  ['Si olvidaste la clave: toca "Olvidé mi clave" y cámbiala desde el correo que te llega. Entra con la clave nueva.',
   'Si ya no puedes usar ese correo: crea una cuenta nueva ("¿No tienes cuenta? Crea una") y crea tu hogar.',
   'Dentro de la app ve a Herramientas, toca "Importar respaldo (.json)" y elige tu archivo. Vuelven todos tus meses, presupuesto, metas y deudas.'].forEach(t=>{ const li=el('li'); li.textContent=t; ol.append(li); });
  body.append(ol);
  const n=el('p','small'); n.textContent='Por seguridad, el archivo de respaldo no sirve para entrar ni para cambiar la clave: solo para recuperar los datos una vez que tengas una cuenta.'; body.append(n);
  modal('Recuperar mis datos',body,[{label:'Crear cuenta nueva',onClick:()=>{ setAuthMode('signup'); }},{label:'Entendido',cls:'primary'}]);
});

