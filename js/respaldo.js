'use strict';
/* Respaldo e importación, ahorro en dólares y papelera */
/* ---------- Respaldo e importación ---------- */
function backupFile(){
  const all={}; Object.keys(months).forEach(id=>{all[id]=serialize(months[id]);});
  all._extras=normExtras(extras);
  const d=new Date();
  const name='respaldo-libro-de-finanzas-'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.json';
  return {name,text:JSON.stringify(all,null,2)};
}
function marcarRespaldo(){
  try{ localStorage.setItem(RESP_KEY(),String(Date.now())); }catch(e){}
  updateRespaldoAviso(document);
}
function exportBackup(){
  const f=backupFile();
  const blob=new Blob([f.text],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=f.name;
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  marcarRespaldo();
  toast('Respaldo descargado');
}
/* Compartir el respaldo (Drive, WhatsApp, correo, etc.) con el menú de compartir del teléfono; si no existe, se descarga. */
async function shareBackup(){
  const f=backupFile();
  if(!navigator.share){ exportBackup(); return; }
  /* Android/Chrome suele rechazar application/json en el menú de compartir: se prueba también como text/plain con nombre .json. */
  const intentos=[];
  ['application/json','text/plain'].forEach(tp=>{ try{ intentos.push(new File([f.text],f.name,{type:tp})); }catch(e){} });
  for(const file of intentos){
    let ok=false;
    try{ ok=!navigator.canShare || navigator.canShare({files:[file]}); }catch(e){ ok=false; }
    if(!ok) continue;
    try{
      await navigator.share({files:[file],title:'Respaldo Libro de Finanzas',text:'Respaldo de Libro de Finanzas'});
      marcarRespaldo(); toast('Respaldo enviado. Revisa que quedó guardado donde lo elegiste.');
      return;
    }catch(e){
      if(e&&e.name==='AbortError') return;
    }
  }
  /* Último recurso: compartir el contenido como texto (WhatsApp, correo, notas) */
  if(f.text.length<400000){
    try{
      await navigator.share({title:'Respaldo Libro de Finanzas '+f.name,text:f.text});
      marcarRespaldo(); toast('Respaldo enviado como texto. Guárdalo con extensión .json si lo vas a importar.');
      return;
    }catch(e){ if(e&&e.name==='AbortError') return; }
  }
  exportBackup();
}
const RESP_KEY=()=>'libroCasa.ultimoRespaldo.'+(hogarId||'');
const DIA_MS=86400000;
const RESP_FREQ=[['semanal','Cada semana',7],['quincenal','Cada 15 días',14],['mensual','Cada mes',30]];
const RESP_FREQ_KEY='lfh.respFreq';
function respFreq(){ let k='quincenal'; try{ k=localStorage.getItem(RESP_FREQ_KEY)||k; }catch(e){} return RESP_FREQ.find(f=>f[0]===k)||RESP_FREQ[1]; }
function setRespFreq(k){ try{ localStorage.setItem(RESP_FREQ_KEY,(RESP_FREQ.find(f=>f[0]===k)||RESP_FREQ[1])[0]); }catch(e){} }
const respFreqSelect=(id,sel)=>{ const s=el('select'); if(id) s.id=id; s.setAttribute('aria-label','Cada cuánto recordar el respaldo'); RESP_FREQ.forEach(([k,t])=>{ const o=el('option'); o.value=k; o.textContent=t; if(k===sel) o.selected=true; s.append(o); }); return s; };
function updateRespaldoAviso(root){
  const w=$('#respWarn',root), info=$('#respInfo',root); if(!w||!info) return;
  let t=0; try{ t=Number(localStorage.getItem(RESP_KEY()))||0; }catch(e){}
  const dias=t?Math.floor((Date.now()-t)/DIA_MS):null;
  info.textContent=t?('Último respaldo en este dispositivo: '+new Date(t).toLocaleDateString('es-AR')+(dias?' (hace '+dias+(dias===1?' día':' días')+')':' (hoy)')+'.'):'Todavía no bajaste ningún respaldo desde este dispositivo.';
  w.replaceChildren();
  if(t && dias<respFreq()[2]){ w.hidden=true; return; }
  w.hidden=false;
  w.append(t?('Hace '+dias+' días que no bajas un respaldo. '):'Todavía no bajaste ningún respaldo. ');
  const b=el('button','btn'); b.type='button'; b.textContent='Respaldar ahora'; b.style.marginLeft='6px';
  b.addEventListener('click',shareBackup); w.append(b);
}

/* ---------- Ahorro en dólares (a nivel hogar, no por mes) ---------- */
let ahorro={ahorrado:null, cotizacion:null, meta:null, fechaMeta:'2027-03'};
const ahorroRef=()=>FS.doc(db,'hogares',hogarId,'ahorro','usd');
const usd=v=>'USD '+nf.format(v);
async function loadAhorro(){
  try{
    const s=await FS.getDoc(ahorroRef());
    if(s.exists()){ const d=s.data(); ahorro={ahorrado:d.ahorrado==null?null:Number(d.ahorrado), cotizacion:d.cotizacion==null?null:Number(d.cotizacion),
      meta:d.meta==null?null:Number(d.meta), fechaMeta:MES_RE.test(d.fechaMeta||'')?d.fechaMeta:'2027-03'}; }
  }catch(e){}
  fillAhorro(document); watchAhorro();
}
async function saveAhorro(){
  try{ await FS.setDoc(ahorroRef(),{ahorrado:ahorro.ahorrado,cotizacion:ahorro.cotizacion,meta:ahorro.meta,fechaMeta:ahorro.fechaMeta,actualizado:Date.now()}); }
  catch(e){ toast('No se pudo guardar el ahorro'); }
}
function fillAhorro(root){
  const c=$('#ahorroCard',root); if(!c) return;
  c.replaceChildren();
  const h=el('header'); const h2=el('h2'); h2.textContent='Ahorro en dólares'; h.append(h2); c.append(h);
  const hint=el('p','hint'); hint.textContent='Es un acumulado del hogar (no depende del mes). Carga lo que ya ahorraste en dólares, la cotización a tu moneda y tu meta.'; c.append(hint);
  const grid=el('div','kpis'); grid.style.marginTop='4px';
  const box=(label,inp)=>{ const d=el('div','kpi'); const s=el('span'); s.textContent=label; d.append(s,inp); return d; };
  const stl=i=>{ i.style.cssText='width:100%; font-size:18px; font-weight:700; padding:0; border:0; background:transparent'; return i; };
  const mk=(key,ph)=>stl(moneyInput(()=>ahorro[key],v=>{ahorro[key]=v;},()=>calcAhorro(c),()=>{calcAhorro(c); saveAhorro();},ph));
  const fm=el('input','txt'); fm.type='month'; fm.value=ahorro.fechaMeta; fm.setAttribute('aria-label','Fecha de la meta'); stl(fm);
  fm.addEventListener('change',()=>{ if(MES_RE.test(fm.value)){ ahorro.fechaMeta=fm.value; calcAhorro(c); saveAhorro(); } });
  grid.append(box('Total ahorrado (USD)',mk('ahorrado','USD ahorrados')),...(moneda.c==='USD'?[]:[box('Cotización ('+moneda.c+' por USD)',mk('cotizacion','Cotización'))]),
              box('Meta (USD)',mk('meta','Meta en USD')),box('Fecha de la meta',fm));
  c.append(grid);
  const dep=el('div','tools'); dep.style.marginTop='10px';
  const di=el('input','num'); di.type='text'; di.inputMode='decimal'; di.placeholder='Sumar depósito (USD)'; di.setAttribute('aria-label','Sumar depósito en USD'); di.autocomplete='off';
  const db1=el('button','btn'); db1.type='button'; db1.textContent='Sumar al ahorro';
  db1.addEventListener('click',()=>{
    const v=parseMoney(di.value);
    if(Number.isNaN(v)||v===0){ toast('Escribe un monto válido'); return; }
    ahorro.ahorrado=num(ahorro.ahorrado)+v; saveAhorro(); fillAhorro(root); toast('Sumados '+usd(v));
  });
  dep.append(di,db1); c.append(dep);
  const out=el('div'); out.className='ahorroOut'; c.append(out);
  calcAhorro(c);
}
function calcAhorro(c){
  const out=$('.ahorroOut',c); if(!out) return; out.replaceChildren();
  const A=num(ahorro.ahorrado), C=moneda.c==='USD'?0:num(ahorro.cotizacion), M=num(ahorro.meta);
  const line=t=>{ const p=el('p','small'); p.style.margin='6px 4px'; p.textContent=t; out.append(p); };
  if(C>0) line('Equivale a '+cf.format(A*C)+' a la cotización cargada.');
  if(M<=0){ line('Carga una meta para ver tu progreso.'); return; }
  const pct=Math.min(100,A/M*100);
  const bar=el('div','bar'); bar.style.cssText='grid-template-columns:1fr 64px; margin:10px 4px 4px';
  const tk=el('div','track'); const f=el('div','fill i'); f.style.width=pct+'%'; tk.append(f);
  const em=el('em'); em.textContent=(Math.round(A/M*1000)/10).toString().replace('.',',')+' %'; bar.append(tk,em); out.append(bar);
  const falta=Math.max(0,M-A);
  if(falta===0){ line('🎉 ¡Meta cumplida! Ahorraste '+usd(A)+' de '+usd(M)+'.'); return; }
  line('Faltan '+usd(falta)+(C>0?' (≈ '+cf.format(falta*C)+')':'')+' para llegar a '+usd(M)+'.');
  const meses=monthDiff(currentMonthId(),ahorro.fechaMeta);
  if(meses<=0) line('La fecha de la meta ('+monthLabel(ahorro.fechaMeta)+') ya llegó o pasó.');
  else{ const pm=falta/meses; line('Hasta '+monthLabel(ahorro.fechaMeta)+' quedan '+meses+(meses===1?' mes':' meses')+': tendrías que ahorrar unos '+usd(pm)+' por mes'+(C>0?' (≈ '+cf.format(pm*C)+')':'')+'.'); }
}

/* ---------- Papelera (meses eliminados, 30 días) ---------- */
const PAPELERA_DIAS=30;
let papelera=[];
const papeleraCol=()=>FS.collection(db,'hogares',hogarId,'papelera');
const papeleraRef=id=>FS.doc(db,'hogares',hogarId,'papelera',id);
async function loadPapelera(){
  try{
    const snap=await FS.getDocs(papeleraCol()); const now=Date.now(); papelera=[];
    for(const d of snap.docs){
      const x=d.data();
      if(!x.eliminadoEn || now-x.eliminadoEn>PAPELERA_DIAS*DIA_MS){ try{ await FS.deleteDoc(d.ref); }catch(e){} continue; }
      papelera.push({id:d.id, eliminadoEn:x.eliminadoEn, datos:x.datos});
    }
    papelera.sort((a,b)=>b.eliminadoEn-a.eliminadoEn);
  }catch(e){ papelera=[]; }
  updatePapeleraBtn(document);
}
function updatePapeleraBtn(root){
  const b=$('#btnPapelera',root); if(b) b.textContent='Papelera'+(papelera.length?' ('+papelera.length+')':'');
}
function openPapelera(){
  const body=el('div');
  if(!papelera.length){ const p=el('p','small'); p.textContent='La papelera está vacía. Los meses eliminados se guardan acá '+PAPELERA_DIAS+' días.'; body.append(p); }
  else{
    const p=el('p','small'); p.textContent='Los meses se borran definitivamente a los '+PAPELERA_DIAS+' días.'; body.append(p);
    papelera.forEach(it=>{
      const row=el('div'); row.style.cssText='display:flex; gap:8px; align-items:center; justify-content:space-between; margin:8px 0; flex-wrap:wrap';
      const dias=Math.max(0,PAPELERA_DIAS-Math.floor((Date.now()-it.eliminadoEn)/DIA_MS));
      const t=el('span'); t.textContent=monthLabel(it.id)+' · se borra en '+dias+(dias===1?' día':' días');
      const bar=el('span');
      const r=el('button','btn primary'); r.type='button'; r.textContent='Restaurar'; r.addEventListener('click',()=>{ closeModal(); restoreMonth(it); });
      const x=el('button','btn danger'); x.type='button'; x.textContent='Borrar'; x.addEventListener('click',()=>{ closeModal(); purgeMonth(it); });
      bar.append(r,' ',x); row.append(t,bar); body.append(row);
    });
  }
  modal('Papelera',body,[{label:'Cerrar'}]);
}
async function restoreMonth(it){
  const doIt=async()=>{
    try{
      months[it.id]=hydrate(it.datos); dirty.add(it.id);
      await FS.setDoc(mesDocRef(it.id),serialize(months[it.id])); baseMes[it.id]=serialize(months[it.id]); dirty.delete(it.id); persistPend();
      await FS.deleteDoc(papeleraRef(it.id));
    }catch(e){ toast('No se pudo restaurar'); return; }
    papelera=papelera.filter(p=>p.id!==it.id); cur=it.id; tab='resumen'; render(); toast('Restaurado '+monthLabel(it.id));
  };
  if(!months[it.id]){ doIt(); return; }
  const p=el('p'); p.textContent=monthLabel(it.id)+' ya existe. Si restauras, se reemplaza por la versión de la papelera.';
  modal('¿Reemplazar mes?',p,[{label:'Cancelar'},{label:'Reemplazar',cls:'primary',onClick:()=>{doIt();}}]);
}
function purgeMonth(it){
  const p=el('p'); p.textContent='Se borra '+monthLabel(it.id)+' para siempre. Esto no se puede deshacer.';
  modal('¿Borrar definitivamente?',p,[{label:'Cancelar'},{label:'Borrar',cls:'danger solid',onClick:async()=>{
    try{ await FS.deleteDoc(papeleraRef(it.id)); }catch(e){ toast('No se pudo borrar'); return; }
    papelera=papelera.filter(x=>x.id!==it.id); updatePapeleraBtn(document); toast('Borrado definitivamente');
  }}]);
}
function exportExcel(){
  if(typeof XLSX==='undefined'){ toast('No se pudo cargar la herramienta de Excel. Revisa tu conexión a internet.'); return; }
  const ids=Object.keys(months).sort();
  const resumen=[['Mes','Ingresos','Egresos fijos','Egresos variables','Egresos totales','Fondo de emergencia','Balance','% gastado','Tarjeta (informativo)']];
  const detalle=[['Mes','Período','Sección','Descripción','Categoría','Monto','Pagado']];
  ids.forEach(id=>{
    const md=months[id]; const label=monthLabel(id);
    const C={}; QS.forEach(q=>{ C[q]=calc(md[q],md); });
    const s=k=>QS.reduce((a,q)=>a+C[q][k],0);
    const ing=s('ingresos'), eg=s('egresosTotales'), fon=s('fondo');
    resumen.push([label,ing,s('egresos'),s('antic'),eg,fon,ing-eg-fon,ing>0?eg/ing:0,QS.reduce((a,q)=>a+monthTarjetaTotal(id,q),0)]);
    QS.forEach(q=>{
      const qd=md[q], Q=q.toUpperCase(), qn=qname(q);
      const add=(sec,desc,cat,monto,pagado)=>detalle.push([label,qn,sec,desc,cat||'',monto,pagado==null?'':(pagado?'Sí':'No')]);
      qd.ingresos.filter(r=>!isBlank(r,'ingresos')).forEach(r=>add('Ingresos fijos',r.n,'',num(r.m)));
      (qd.ingresosVar||[]).filter(r=>!isBlank(r,'ingresosVar')).forEach(r=>add('Ingresos variables',r.n,'',num(r.m)));
      autoPlat(qd).forEach(p=>add('Egresos fijos',p.n,'',num(p.m),p.pagado));
      qd.egresos.filter(r=>!isBlank(r,'egresos')).forEach(r=>add('Egresos fijos',r.n,r.cat,num(r.m),r.pagado));
      qd.anticipados.filter(r=>!isBlank(r,'anticipados')).forEach(r=>add('Egresos variables',r.n,r.cat,num(r.m),r.pagado));
      qd.fondo.filter(r=>!isBlank(r,'fondo')).forEach(r=>add('Fondo de emergencia',r.n,'',num(r.m)));
      qd.retiro.filter(r=>!isBlank(r,'retiro')).forEach(r=>add('Retiro de efectivo (informativo)',r.n,'',num(r.m)));
      (qd.compras||[]).filter(r=>!compraBlank(r)).forEach(r=>add('Compras super/otros (informativo)',r.n,chainName(r),num(r.m),r.ok));
      activeCuotasFor(id,q).forEach(it=>add('Tarjeta (informativo)',it.row.n+(it.totalCuotas>1?' (cuota '+it.cuotaNum+'/'+it.totalCuotas+')':''),it.row.cat,it.amount));
    });
  });
  const ws1=XLSX.utils.aoa_to_sheet(resumen), ws2=XLSX.utils.aoa_to_sheet(detalle);
  ws1['!cols']=[{wch:18},{wch:14},{wch:14},{wch:16},{wch:16},{wch:18},{wch:14},{wch:10},{wch:20}];
  ws2['!cols']=[{wch:18},{wch:14},{wch:30},{wch:34},{wch:16},{wch:14},{wch:8}];
  for(let r=1;r<resumen.length;r++){
    [1,2,3,4,5,6,8].forEach(c=>{ const a=ws1[XLSX.utils.encode_cell({r,c})]; if(a) a.z='#,##0'; });
    const p=ws1[XLSX.utils.encode_cell({r,c:7})]; if(p) p.z='0.0%';
  }
  for(let r=1;r<detalle.length;r++){ const a=ws2[XLSX.utils.encode_cell({r,c:5})]; if(a) a.z='#,##0'; }
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws1,'Resumen por mes');
  XLSX.utils.book_append_sheet(wb,ws2,'Detalle');
  const d=new Date();
  XLSX.writeFile(wb,'libro-finanzas-hogar-'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.xlsx');
  toast('Excel descargado');
}
function downloadBlob(blob,filename){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
async function captureAndDeliver(innerHTML,width,filenameBase,format){
  if(typeof html2canvas==='undefined' || (format==='pdf' && !(window.jspdf&&window.jspdf.jsPDF))){
    toast('No se pudo cargar la herramienta de exportación. Revisa tu conexión a internet.'); return;
  }
  toast('Generando…');
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed; left:-9999px; top:0; width:'+width+'px;';
  wrap.innerHTML=innerHTML;
  document.body.append(wrap);
  try{
    const canvas=await html2canvas(wrap,{scale:2,backgroundColor:'#ffffff'});
    if(format==='jpg'){
      canvas.toBlob(blob=>{ if(blob) downloadBlob(blob,filenameBase+'.jpg'); else toast('No se pudo generar la imagen'); },'image/jpeg',0.92);
    } else {
      const {jsPDF}=window.jspdf;
      const img=canvas.toDataURL('image/jpeg',0.95);
      const pdf=new jsPDF({orientation:canvas.width>=canvas.height?'landscape':'portrait',unit:'px',format:[canvas.width,canvas.height]});
      pdf.addImage(img,'JPEG',0,0,canvas.width,canvas.height);
      pdf.save(filenameBase+'.pdf');
    }
    toast('Listo');
  }catch(e){ toast('No se pudo generar el archivo'); }
  finally{ wrap.remove(); }
}
async function exportFullPDF(){
  if(typeof html2canvas==='undefined' || !(window.jspdf&&window.jspdf.jsPDF)){
    toast('No se pudo cargar la herramienta de exportación. Revisa tu conexión a internet.'); return;
  }
  const main=$('#main'); if(!main) return;
  toast('Generando PDF…');
  const vistas=['resumen',...QS];
  const prevHidden=vistas.map(t=>{
    const v=document.getElementById('view-'+t); const h=v?v.hidden:true; if(v) v.hidden=false; return h;
  });
  try{
    const canvas=await html2canvas(main,{scale:2,backgroundColor:getComputedStyle(document.body).backgroundColor||'#ffffff'});
    const {jsPDF}=window.jspdf;
    const img=canvas.toDataURL('image/jpeg',0.95);
    const pdf=new jsPDF({orientation:'portrait',unit:'px',format:[canvas.width,canvas.height]});
    pdf.addImage(img,'JPEG',0,0,canvas.width,canvas.height);
    pdf.save('libro-finanzas-hogar-'+cur+'.pdf');
    toast('Listo');
  }catch(e){ toast('No se pudo generar el PDF'); }
  finally{
    vistas.forEach((t,i)=>{ const v=document.getElementById('view-'+t); if(v) v.hidden=prevHidden[i]; });
    showTab();
  }
}
function importFile(file){
  const rd=new FileReader();
  rd.onerror=()=>toast('No se pudo leer el archivo');
  rd.onload=()=>{
    let obj; try{ obj=JSON.parse(String(rd.result)); }catch(e){ toast('El archivo no es un respaldo válido'); return; }
    const ids=(obj&&typeof obj==='object')?Object.keys(obj).filter(k=>MES_RE.test(k)&&obj[k]&&typeof obj[k]==='object'):[];
    if(!ids.length){ toast('No encontré meses en ese archivo'); return; }
    const clash=ids.filter(id=>months[id]);
    const apply=()=>{
      cur=ids.slice().sort()[ids.length-1];
      ids.forEach(id=>{ months[id]=hydrate(obj[id]); dirty.add(id); }); persistPend();
      if(obj._extras&&typeof obj._extras==='object'){ extras=normExtras(obj._extras); saveExtras(); }
      tab='resumen'; render(); setStatus('editing'); flush();
      toast('Importados '+ids.length+(ids.length===1?' mes':' meses'));
    };
    if(!clash.length){ apply(); return; }
    const body=el('div'); const p=el('p'); p.textContent='Estos meses ya existen y se van a reemplazar:'; const ul=el('ul');
    clash.sort().forEach(id=>{const li=el('li'); li.textContent=monthLabel(id); ul.append(li);});
    body.append(p,ul);
    modal('¿Reemplazar meses?',body,[{label:'Cancelar'},{label:'Reemplazar',cls:'primary',onClick:()=>{apply();}}]);
  };
  rd.readAsText(file);
}
$('#fileImp').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0]; e.target.value='';
  if(f&&ready) importFile(f);
});


