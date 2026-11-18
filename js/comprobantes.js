'use strict';
/* Comprobantes de pago de billeteras virtuales y bancos: lectura de la foto o captura DENTRO del teléfono
   (OCR con Tesseract, guardado en vendor/tesseract). La imagen no se envía a ningún servidor.
   Aquí también viven los "comercios recordados": a quién le pagas y en qué categoría cae (se guardan cifrados dentro de extras). */

/* ---------- Texto del comprobante → datos (sin DOM, probado en tests/calculos.test.js) ---------- */
const COMP_MESES={enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,septiembre:9,setiembre:9,sep:9,set:9,octubre:10,oct:10,noviembre:11,nov:11,diciembre:12,dic:12};
const compSinAc=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
/* Clave para reconocer al mismo comercio aunque cambien mayúsculas, tildes o espacios */
function normComercio(n){
  return compSinAc(n).toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function compFecha(txt){
  const t=compSinAc(txt).toLowerCase();
  const ok=(d,m,y)=>{ d=+d; m=+m; y=+y; if(y<2000||y>2100||m<1||m>12||d<1||d>31) return null; const f=new Date(y,m-1,d); if(f.getMonth()!==m-1) return null; return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'); };
  let m=/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t);
  if(m){ const r=ok(m[1],m[2],m[3]); if(r) return r; }
  const re=/(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})\.?\s+(?:de\s+)?(\d{4})/g;
  while((m=re.exec(t))){ const mes=COMP_MESES[m[2]]; if(mes){ const r=ok(m[1],mes,m[3]); if(r) return r; } }
  return null;
}
function compMonto(lineas){
  const cand=[];
  lineas.forEach((l,i)=>{
    const re=/(?:\$|ARS|AR\$)\s*(\d[\d.,]*)/gi; let m;
    while((m=re.exec(l))){
      const v=parseMoney(m[1].replace(/[.,]+$/,''));
      if(v!=null&&!Number.isNaN(v)&&v>0){
        const ctx=(l+' '+(lineas[i-1]||''));
        cand.push({v,clave:/enviaste|pagaste|transferiste|monto|importe|total|pago|transferencia/i.test(ctx)});
      }
    }
  });
  if(!cand.length) return null;
  return (cand.find(c=>c.clave)||cand[0]).v;
}
const COMP_ETIQ_OTRAS=/^(cvu|cbu|cuit|cuil|dni|alias|banco|de|origen|desde|medio de pago|concepto|fecha|n[uú]mero|c[oó]digo|referencia|tipo|monto|importe|comprobante|operaci[oó]n|motivo)\b/i;
function compNombreValido(s){
  s=String(s||'').trim();
  if(s.length<3||s.length>60) return false;
  const letras=(s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g)||[]).length;
  if(letras<3||letras<s.length*0.6) return false;
  return !/^(las?|los|el)\s/i.test(s);
}
function compLimpiarNombre(s){
  return String(s||'').replace(/\s*[|·•]\s*.*$/,'').replace(/\s+-\s+.*$/,'').replace(/\s*\d{6,}.*$/,'').replace(/^[\s:.\-–]+|[\s:.\-–]+$/g,'').trim();
}
function compDestino(lineas){
  const etiquetas=[
    /^(?:le\s+)?(?:pagaste|enviaste|transferiste)\s+a\b[:\s]*(.*)$/i,
    /^(?:para|destinatario|beneficiario|cobrador|comercio|titular|destino)\b[:\s]*(.*)$/i,
    /^a\b[:\s]+(.*)$/
  ];
  for(let e=0;e<etiquetas.length;e++){
    for(let i=0;i<lineas.length;i++){
      const m=etiquetas[e].exec(lineas[i]); if(!m) continue;
      let v=compLimpiarNombre(m[1]);
      if(!v){
        for(let j=i+1;j<Math.min(lineas.length,i+3);j++){
          if(COMP_ETIQ_OTRAS.test(lineas[j])) continue;
          v=compLimpiarNombre(lineas[j]); break;
        }
      }
      if(e===2&&!/^[A-ZÁÉÍÓÚÑ]/.test(v)) continue;
      if(compNombreValido(v)&&!COMP_ETIQ_OTRAS.test(v)) return v;
    }
  }
  return '';
}
function compOperacion(lineas){
  const lab=/(operaci[oó]n|transacci[oó]n|referencia|comprobante|nro|n[uú]mero)/i;
  for(let i=0;i<lineas.length;i++){
    if(!lab.test(lineas[i])) continue;
    for(let j=i;j<Math.min(lineas.length,i+2);j++){
      const m=/\b[A-Z]{0,4}-?\d[\dA-Z-]{5,}\b/.exec(lineas[j]);
      if(m&&(m[0].match(/\d/g)||[]).length>=5) return m[0];
    }
  }
  return '';
}
/* texto leído → {monto, fecha:'AAAA-MM-DD'|null, destino, op}; lo que no se encuentra queda vacío */
function parseComprobante(texto){
  const lineas=String(texto||'').replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);
  return {monto:compMonto(lineas), fecha:compFecha(lineas.join(' \n ')), destino:compDestino(lineas), op:compOperacion(lineas)};
}
/* ---------- Comercios recordados (viven en extras.comercios; el comprobante no trae el rubro, lo aprende la app) ---------- */
function comercioPorNombre(lista,nombre){
  const k=normComercio(nombre); if(!k) return null;
  const orden=s=>s.split(' ').sort().join(' ');
  return (lista||[]).find(c=>c.k===k)||(lista||[]).find(c=>orden(c.k)===orden(k))||null;
}
/* Recuerda (o actualiza) el comercio con su categoría; devuelve el registro. */
function comercioAprender(ex,nombre,cat){
  const n=capIni(String(nombre||'').trim()).slice(0,60), k=normComercio(n); if(!k) return null;
  ex.comercios=ex.comercios||[];
  let c=comercioPorNombre(ex.comercios,n);
  if(c){ c.veces=Math.min(9999,(c.veces||1)+1); if(cat) c.cat=cat; }
  else { c={id:uid().replace(/[^A-Za-z0-9]/g,'').slice(0,20),n,k,cat:cat||'',veces:1}; ex.comercios.push(c); }
  if(ex.comercios.length>150){ ex.comercios.sort((a,b)=>(b.veces||1)-(a.veces||1)); ex.comercios.length=150; }
  return c;
}
/* Anota el número de operación para avisar si se vuelve a cargar el mismo comprobante */
function comprobanteYaCargado(ex,op){ const id=String(op||'').replace(/[^A-Za-z0-9]/g,'').slice(0,20); return !!id&&(ex.ops||[]).some(o=>o.id===id); }
function comprobanteAnotar(ex,op,fecha){
  const id=String(op||'').replace(/[^A-Za-z0-9]/g,'').slice(0,20); if(!id) return;
  ex.ops=ex.ops||[]; if(ex.ops.some(o=>o.id===id)) return;
  ex.ops.push({id,f:/^\d{4}-\d{2}-\d{2}$/.test(fecha||'')?fecha:''});
  if(ex.ops.length>300) ex.ops=ex.ops.slice(-300);
}


/* ---------- Importar gastos desde Excel o CSV (filas → gastos; sin DOM, probado en tests) ---------- */
function importFechaCelda(v){
  const pad=n=>String(n).padStart(2,'0');
  if(v instanceof Date && !isNaN(v)){ const d=new Date(v.getTime()+12*3600e3); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  const t=String(v==null?'':v).trim(); if(!t) return null;
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if(m){ const y=+m[1],mo=+m[2],d=+m[3]; const f=new Date(y,mo-1,d); if(y>=2000&&y<=2100&&f.getMonth()===mo-1&&f.getDate()===d) return y+'-'+pad(mo)+'-'+pad(d); return null; }
  return compFecha(t);
}
function importMontoCelda(v){
  if(typeof v==='number') return isFinite(v)?Math.abs(v):null;
  const t=String(v==null?'':v).replace(/[^\d.,\-]/g,''); if(!t) return null;
  const n=parseMoney(t.replace(/^-/,'')); return (n==null||Number.isNaN(n))?null:Math.abs(n);
}
/* aoa = filas (lista de listas) de la planilla. Busca la fila de títulos (Fecha, Concepto, Monto, Categoría) en las primeras 10 filas. */
function parsearGastosImport(aoa){
  const norm=x=>compSinAc(String(x==null?'':x)).toLowerCase().trim();
  let h=-1, col={};
  for(let i=0;i<Math.min((aoa||[]).length,10);i++){
    const c={};
    (aoa[i]||[]).forEach((x,j)=>{
      const t=norm(x); if(!t) return;
      if(c.f==null&&/^(fecha|date|dia)\b/.test(t)) c.f=j;
      else if(c.n==null&&/^(concepto|descripcion|detalle|comercio|nombre|motivo|gasto|producto|referencia)\b/.test(t)) c.n=j;
      else if(c.m==null&&/^(monto|importe|debito|egreso|total|valor)\b/.test(t)) c.m=j;
      else if(c.c==null&&/^(categoria|rubro|tipo)\b/.test(t)) c.c=j;
    });
    if(c.f!=null&&c.m!=null){ h=i; col=c; break; }
  }
  if(h<0) return {gastos:[],omitidas:0,error:'No encontré las columnas “Fecha” y “Monto”. Usa la plantilla: Fecha, Concepto, Monto, Categoría.'};
  const gastos=[]; let omitidas=0;
  for(let i=h+1;i<aoa.length;i++){
    const r=aoa[i]||[]; if(!r.some(x=>String(x==null?'':x).trim()!=='')) continue;
    const fecha=importFechaCelda(r[col.f]), m=importMontoCelda(r[col.m]);
    if(!fecha||!(m>0)){ omitidas++; continue; }
    const nom=col.n!=null?String(r[col.n]==null?'':r[col.n]).trim().slice(0,60):'';
    const cn=col.c!=null?norm(r[col.c]):'';
    gastos.push({fecha,n:capIni(nom)||'Gasto importado',m,cat:cn?(CATS.find(c=>norm(c)===cn)||''):''});
  }
  return {gastos,omitidas,error:''};
}
/* Id fijo por gasto: si se importa el mismo archivo dos veces, no se duplica */
function importIdGasto(g,veces){
  let h=5381; const t=g.fecha+'|'+normComercio(g.n)+'|'+g.m+'|'+veces;
  for(let i=0;i<t.length;i++) h=((h<<5)+h+t.charCodeAt(i))|0;
  return 'imp_'+(h>>>0).toString(36);
}

/* ---------- Pantalla: lectura de la imagen (OCR dentro del teléfono) ---------- */
/* Pantalla */
let ocrWorker=null, ocrPromesa=null;
function ocrCargarScript(src){
  return new Promise((ok,err)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>err(new Error('No se pudo cargar el lector')); document.head.append(s); });
}
async function ocrIniciar(){
  if(ocrWorker) return ocrWorker;
  if(!ocrPromesa) ocrPromesa=(async()=>{
    const base=new URL('vendor/tesseract/',document.baseURI).href;
    if(typeof Tesseract==='undefined') await ocrCargarScript(base+'tesseract.min.js');
    const w=await Tesseract.createWorker('spa',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:true,workerBlobURL:false});
    ocrWorker=w; return w;
  })().catch(e=>{ ocrPromesa=null; throw e; });
  return ocrPromesa;
}
function ocrApagar(){ const w=ocrWorker; ocrWorker=null; ocrPromesa=null; if(w){ try{ w.terminate(); }catch(e){} } }
/* Achica la foto (las del teléfono son enormes) y la pasa a fondo blanco: más rápido y más preciso */
async function imagenParaOcr(file){
  const bmp=await createImageBitmap(file);
  const k=Math.min(1,1800/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(bmp.width*k)); c.height=Math.max(1,Math.round(bmp.height*k));
  const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(bmp,0,0,c.width,c.height);
  if(bmp.close) bmp.close();
  return c;
}
async function leerComprobante(file){
  try{
    const w=await ocrIniciar();
    const c=await imagenParaOcr(file);
    const r=await w.recognize(c);
    return (r&&r.data&&r.data.text)||'';
  } finally { ocrApagar(); }
}

/* ---------- Pantalla: lista de comercios recordados (Herramientas) ---------- */
function renderComercios(){
  const host=document.getElementById('comerciosCard'); if(!host) return;
  host.replaceChildren();
  const h=el('header'); const t=el('h2'); t.textContent='Comercios recordados'; h.append(t); host.append(h);
  const p=el('p','hint'); p.textContent='Al cargar un comprobante o una compra rápida, la app recuerda a quién le pagaste y en qué categoría. La próxima vez la categoría se completa sola. Aquí puedes cambiarla o quitar un comercio.'; host.append(p);
  const lista=(extras.comercios||[]).slice().sort((a,b)=>String(a.n).localeCompare(String(b.n),'es'));
  if(!lista.length){ const e=el('p','small'); e.textContent='Todavía no hay comercios recordados.'; host.append(e); return; }
  lista.forEach(c=>{
    const row=el('div'); row.style.cssText='display:flex; gap:8px; align-items:center; margin:6px 0';
    const n=el('span'); n.textContent=c.n; n.style.cssText='flex:1 1 auto; min-width:0; overflow-wrap:anywhere';
    const s=catSelect(c.cat,v=>{ const x=extras.comercios.find(y=>y.id===c.id); if(x){ x.cat=normCat(v); saveExtras(); } });
    s.style.flex='0 0 auto'; s.style.maxWidth='46%'; s.setAttribute('aria-label','Categoría de '+c.n);
    const d=el('button','btn'); d.type='button'; d.textContent='×'; d.setAttribute('aria-label','Quitar '+c.n); d.style.cssText='flex:none; min-width:44px; min-height:44px';
    d.addEventListener('click',()=>{ extras.comercios=extras.comercios.filter(y=>y.id!==c.id); saveExtras(); renderComercios(); toast('Quitado: '+c.n); });
    row.append(n,s,d); host.append(row);
  });
}

/* ---------- Pantalla: importar gastos desde Excel o CSV (Herramientas) ---------- */
function plantillaGastosCSV(){
  const csv='﻿Fecha;Concepto;Monto;Categoría\r\n16/11/2026;Verdulería Juan Díaz;12500;Alimentación\r\n15/11/2026;Nafta;30000;Transporte\r\n';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='plantilla-gastos.csv'; document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}
async function importarGastosArchivo(file){
  if(typeof XLSX==='undefined'){ toast('No se pudo cargar la herramienta de Excel. Revisa tu conexión a internet.'); return; }
  let aoa;
  try{
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true,raw:true,codepage:65001});
    aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});
  }catch(e){ toast('No pude leer ese archivo. Usa .csv o .xlsx'); return; }
  const r=parsearGastosImport(aoa);
  if(r.error){ toast(r.error); return; }
  const aplicables=[], sinMes=[];
  const veces=new Map();
  r.gastos.forEach(g=>{
    const k=g.fecha+'|'+normComercio(g.n)+'|'+g.m; const v=(veces.get(k)||0)+1; veces.set(k,v);
    g.id=importIdGasto(g,v);
    const mId=g.fecha.slice(0,7);
    if(!months[mId]){ sinMes.push(g); return; }
    const q0=qDeDia(Number(g.fecha.slice(8,10))), q=QS.includes(q0)?q0:QS[0];
    if(months[mId][q].anticipados.some(x=>x.id===g.id)) return;   /* ya importado antes */
    aplicables.push({...g,mId,q});
  });
  if(!aplicables.length){ toast(r.gastos.length?'No hay gastos nuevos para importar'+(sinMes.length?' ('+sinMes.length+(sinMes.length===1?' es de un mes que no tienes cargado)':' son de meses que no tienes cargados)'):''):'No encontré gastos válidos en el archivo'); return; }
  const body=el('div');
  const p1=el('p'); p1.textContent='Encontré '+aplicables.length+' gasto'+(aplicables.length===1?'':'s')+' para cargar como egresos variables (ya pagados), por un total de '+cf.format(aplicables.reduce((s,g)=>s+g.m,0))+'.'; body.append(p1);
  const ul=el('ul','small'); aplicables.slice(0,8).forEach(g=>{ const li=el('li'); li.textContent=g.fecha.split('-').reverse().join('/')+' · '+g.n+' · '+cf.format(g.m)+(g.cat?' · '+g.cat:''); ul.append(li); }); body.append(ul);
  if(aplicables.length>8){ const m=el('p','small'); m.textContent='…y '+(aplicables.length-8)+' más.'; body.append(m); }
  const notas=[]; if(sinMes.length) notas.push(sinMes.length+(sinMes.length===1?' es de un mes que no tienes cargado en el libro y se omite':' son de meses que no tienes cargados en el libro y se omiten')+' (crea ese mes y vuelve a importar)'); if(r.omitidas) notas.push(r.omitidas+' fila'+(r.omitidas===1?'':'s')+' sin fecha o monto válido se omiten');
  if(notas.length){ const n=el('p','small'); n.textContent='Ojo: '+notas.join('; ')+'.'; body.append(n); }
  modal('Importar gastos',body,[{label:'Cancelar'},{label:'Importar',cls:'primary',onClick:()=>{
    const tocados=new Set();
    aplicables.forEach(g=>{
      const arr=months[g.mId][g.q].anticipados;
      const c=g.cat?null:comercioPorNombre(extras.comercios,g.n);
      const fila={id:g.id,n:g.n,m:g.m,cat:g.cat||(c&&c.cat)||'',pagado:true};
      const i=arr.findIndex(x=>isBlank(x,'anticipados')); if(i>=0) arr[i]=fila; else arr.push(fila);
      padSec(months[g.mId][g.q],'anticipados'); tocados.add(g.mId);
    });
    tocados.forEach(id=>markDirty(id)); render();
    toast('Importé '+aplicables.length+' gasto'+(aplicables.length===1?'':'s'));
  }}]);
}
function buildImportarGastos(){
  const c=el('section','card'); c.id='importGastosCard'; c.style.marginTop='16px';
  const h=el('header'); const t=el('h2'); t.textContent='Importar gastos (Excel o CSV)'; h.append(t); c.append(h);
  const p=el('p','hint'); p.textContent='Carga de una vez los gastos de una planilla (.xlsx o .csv) con las columnas Fecha, Concepto, Monto y, si quieres, Categoría. Cada gasto va al mes y a la quincena (o semana) de su fecha, como egreso variable ya pagado. Solo se cargan los meses que ya tienes en el libro, y si importas el mismo archivo dos veces no se duplica nada.'; c.append(p);
  const tools=el('div','tools');
  const fi=el('input'); fi.type='file'; fi.accept='.csv,.xlsx,.xls,text/csv'; fi.hidden=true;
  fi.addEventListener('change',()=>{ const f=fi.files&&fi.files[0]; fi.value=''; if(f) importarGastosArchivo(f); });
  const b1=el('button','btn primary'); b1.type='button'; b1.textContent='Elegir archivo…'; b1.addEventListener('click',()=>fi.click());
  const b2=el('button','btn'); b2.type='button'; b2.textContent='Descargar plantilla (.csv)'; b2.addEventListener('click',plantillaGastosCSV);
  tools.append(b1,b2,fi); c.append(tools); return c;
}
