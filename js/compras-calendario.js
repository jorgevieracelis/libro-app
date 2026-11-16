'use strict';
/* Compras del súper, versículo del día y calendario de notas */
/* ---------- Compras super/otros ---------- */
const CADENAS=['Día','Carrefour','Coto','Jumbo','Disco','Vea','Chino','Peruano','Fiambrería','Verdulería'];
const normTxt=s=>String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim().replace(/\s+/g,' ');
const chainName=r=>r.cadena==='Otros'?(String(r.otra||'').trim()||'Otros'):String(r.cadena||'');
const compraBlank=r=>!String(r.n==null?'':r.n).trim() && r.m==null;
/* Unidades: 1 a 12 (por defecto 1). El precio escrito es el de UNA unidad; el costo de la línea es precio × unidades. */
const unidadesDe=r=>{ const u=Math.round(Number(r&&r.u)); return (u>=1&&u<=12)?u:1; };
const compraTotal=r=>num(r.m)*unidadesDe(r);
function normCompra(r){
  r=r||{};
  const cad=(typeof r.cadena==='string'&&(CADENAS.includes(r.cadena)||r.cadena==='Otros'))?r.cadena:'';
  return {id:String(r.id||uid()), n:capIni(r.n), m:numOrNull(r.m), u:unidadesDe(r), cadena:cad, otra:cad==='Otros'?capIni(r.otra||''):'', ult:numOrNull(r.ult), ok:r.ok===true};
}
function setChainFrom(row,name){
  if(CADENAS.includes(name)){ row.cadena=name; row.otra=''; }
  else if(name && name!=='Otros'){ row.cadena='Otros'; row.otra=name; }
  else if(name==='Otros'){ row.cadena='Otros'; row.otra=''; }
}
/* Lista de artículos del hogar: un documento por producto + cadena */
let catalogo=new Map();
const catId=(n,cad)=>(normTxt(n)+'__'+normTxt(cad)).replace(/[\/\\]/g,'-').slice(0,400);
const catDoc=id=>FS.doc(db,'hogares',hogarId,'catalogo',id);
function refreshComprasDL(){
  let d=document.getElementById('dlProductos');
  if(!d){ d=el('datalist'); d.id='dlProductos'; document.body.append(d); }
  d.replaceChildren(); const seen=new Set();
  [...catalogo.values()].sort((a,b)=>a.n.localeCompare(b.n,'es')).forEach(e=>{
    const k=normTxt(e.n); if(seen.has(k)) return; seen.add(k);
    const o=el('option'); o.value=e.n; d.append(o);
  });
}
async function loadCatalogo(){
  try{
    const s=await FS.getDocs(FS.collection(db,'hogares',hogarId,'catalogo'));
    catalogo=new Map();
    s.docs.forEach(d=>{ const x=d.data(); if(x&&x.n) catalogo.set(d.id,{id:d.id,n:String(x.n),cadena:String(x.cadena||''),ult:numOrNull(x.ult),fecha:Number(x.fecha)||0}); });
  }catch(e){}
  refreshComprasDL();
}
function saveCat(e){
  FS.setDoc(catDoc(e.id),{n:e.n,cadena:e.cadena,ult:e.ult,fecha:e.fecha}).catch(()=>toast('No se pudo guardar en tu lista de artículos'));
}
/* price>0 = lo marcaron como comprado a ese precio; sin price solo se registra el artículo */
function upsertCat(n,cad,price){
  n=String(n).trim(); if(!n||!db||!hogarId) return null;
  const id=catId(n,cad); let e=catalogo.get(id), changed=false;
  if(!e){ e={id,n,cadena:cad,ult:null,fecha:0}; catalogo.set(id,e); changed=true; }
  if(price>0){ e.ult=price; e.fecha=Date.now(); changed=true; }
  if(changed){ saveCat(e); refreshComprasDL(); }
  return e;
}
function findCat(n,cad){
  const k=normTxt(n); if(!k) return null;
  const all=[...catalogo.values()].filter(e=>normTxt(e.n)===k);
  if(!all.length) return null;
  if(cad) return all.find(e=>normTxt(e.cadena)===normTxt(cad))||null;
  return all.sort((a,b)=>b.fecha-a.fecha)[0];
}
function lookupCompra(row){
  const e=findCat(row.n,row.cadena?chainName(row):'');
  if(e){
    if(!row.cadena) setChainFrom(row,e.cadena);
    if(row.m==null && e.ult>0) row.m=e.ult;
    row.ult=e.ult;
  } else row.ult=null;
  if(row.cadena && !(row.cadena==='Otros' && !String(row.otra).trim()) && String(row.n).trim()) upsertCat(row.n,chainName(row));
}
function buildCompras(q){
  const v=el('div'); v.id='view-c'+q.slice(1); v.hidden=true; return v;
}
function updateComprasTotals(q,c){
  const rows=months[cur][q].compras.filter(r=>!compraBlank(r));
  const total=rows.reduce((s,r)=>s+compraTotal(r),0), hecho=rows.filter(r=>r.ok).reduce((s,r)=>s+compraTotal(r),0);
  $('.tot',c).textContent=cf.format(total);
  const rs=$('.cresumen',c); rs.replaceChildren();
  const t=el('span'); t.textContent='Comprado: '+cf.format(hecho)+' · Falta: '+cf.format(total-hecho); rs.append(t);
  const by={}; rows.forEach(r=>{ const k=chainName(r)||'Sin cadena'; by[k]=(by[k]||0)+compraTotal(r); });
  Object.keys(by).sort().forEach(k=>{ const g=el('span','tag'); g.textContent=k+': '+cf.format(by[k]); rs.append(g); });
}
function compraRow(q,row,c){
  const d=el('div','crow'); d._row=row;
  const cn=el('div','c-n'); const ti=el('input'); ti.type='text'; ti.value=row.n; ti.placeholder='Producto (ej: Aceite 1,5 lt)';
  ti.setAttribute('aria-label','Producto'); ti.autocomplete='off'; ti.setAttribute('list','dlProductos'); cn.append(ti);
  const cc=el('div','c-c'); const sel=el('select'); sel.setAttribute('aria-label','Cadena');
  [['','Cadena…'],...CADENAS.map(x=>[x,x]),['Otros','Otros']].forEach(([v,t])=>{ const o=el('option'); o.value=v; o.textContent=t; sel.append(o); });
  const ot=el('input'); ot.type='text'; ot.placeholder='¿Cuál?'; ot.setAttribute('aria-label','Nombre de la otra cadena'); ot.autocomplete='off';
  cc.append(sel,ot);
  const totals=()=>updateComprasTotals(q,c);
  const cq=el('div','c-q'); const qs=el('select'); qs.setAttribute('aria-label','Unidades'); qs.title='Unidades';
  for(let i=1;i<=12;i++){ const o=el('option'); o.value=String(i); o.textContent=String(i); qs.append(o); }
  cq.append(qs);
  const cu=el('div','c-u');
  const paintUlt=()=>{
    cu.replaceChildren();
    const un=unidadesDe(row);
    if(un>1 && num(row.m)>0){ const t=el('span','ctot'); t.textContent=un+' × '+cf.format(row.m)+' = '+cf.format(compraTotal(row)); cu.append(t); }
    if(!(row.ult>0)){ if(!cu.firstChild){ cu.textContent='—'; cu.title='Todavía no hay una compra anterior'; } return; }
    cu.title='Último precio (por unidad) al que lo compraste'; cu.append('Últ. '+cf.format(row.ult));
    if(num(row.m)>0){
      const p=(row.m-row.ult)/row.ult;
      if(Math.abs(p)>=0.005){ const s=el('span',p>0?'up':'dn'); s.textContent=' '+(p>0?'▲':'▼')+Math.round(Math.abs(p)*100)+'%'; cu.append(s); }
    }
  };
  const cm=el('div','c-m');
  const mi=moneyInput(()=>row.m,v=>{row.m=v;},()=>{paintUlt(); totals();},()=>{paintUlt(); totals(); markDirty();},'Precio'); cm.append(mi);
  const cp=el('div','c-p'); const pb=el('button','pay'); pb.type='button'; cp.append(pb);
  const cx=el('div','c-x'); cx.append(delBtn(()=>{
    const arr=months[cur][q].compras; const i=arr.indexOf(row); if(i>=0) arr.splice(i,1);
    renderCompras(q); markDirty();
  }));
  const sync=()=>{
    qs.value=String(unidadesDe(row)); sel.value=row.cadena; ot.hidden=row.cadena!=='Otros'; ot.value=row.otra; mi.value=fmt(row.m); paintUlt();
    pb.textContent=row.ok?'✓':'×'; pb.classList.toggle('paid',row.ok);
    pb.title=row.ok?'Comprado — toca para desmarcar':'Sin comprar — toca para marcar como comprado'; pb.setAttribute('aria-label',pb.title);
    d.classList.toggle('done',row.ok);
  };
  qs.addEventListener('change',()=>{ row.u=unidadesDe({u:qs.value}); paintUlt(); totals(); markDirty(); });
  ti.addEventListener('change',()=>{ row.n=ti.value.trim(); lookupCompra(row); sync(); totals(); markDirty(); });
  sel.addEventListener('change',()=>{ row.cadena=sel.value; if(row.cadena!=='Otros') row.otra=''; lookupCompra(row); sync(); totals(); markDirty(); });
  ot.addEventListener('change',()=>{ row.otra=ot.value.trim(); lookupCompra(row); sync(); totals(); markDirty(); });
  pb.addEventListener('click',()=>{
    row.ok=!row.ok;
    if(row.ok && String(row.n).trim() && !(row.cadena==='Otros' && !String(row.otra).trim())) upsertCat(row.n,chainName(row),num(row.m)>0?num(row.m):undefined);
    sync(); totals(); markDirty();
  });
  d.append(cn,cc,cq,cm,cu,cp,cx); sync();
  return d;
}
/* Orden alfabético por producto (sin importar mayúsculas ni tildes). Las líneas sin nombre quedan al final. */
function ordenarCompras(list){
  const orden=list.map((r,i)=>[r,i]).sort((a,b)=>{
    const na=normTxt(a[0].n), nb=normTxt(b[0].n);
    if(!na!==!nb) return na?-1:1;
    return na.localeCompare(nb,'es')||a[1]-b[1];
  }).map(x=>x[0]);
  const cambio=orden.some((r,i)=>r!==list[i]);
  if(cambio) list.splice(0,list.length,...orden);
  return cambio;
}
/* Reordena las filas ya dibujadas sin volver a dibujar, y solo si el cursor no está dentro de la lista (para no cortar lo que se escribe) */
function reordenarComprasEnPantalla(q,box){
  const list=months[cur]&&months[cur][q]&&months[cur][q].compras; if(!list||!box.isConnected) return;
  if(box.contains(document.activeElement)) return;
  if(!ordenarCompras(list)) return;
  const por=new Map([...box.children].filter(x=>x._row).map(x=>[x._row,x]));
  list.forEach(r=>{ const d=por.get(r); if(d) box.append(d); });
  markDirty();
}
/* ---------- CSV de compras: plantilla en blanco e importación ---------- */
const CSV_COLS=['producto','cantidad','comercio','precio_unitario'];
const INSTRUCCIONES_IA='Voy a pasarte la foto o el PDF de una factura de supermercado. Llena un archivo CSV con estas columnas, en este orden y con esta primera fila exacta:\n'+CSV_COLS.join(',')+'\nUna fila por producto. Reglas:\n- producto: nombre del artículo tal como aparece en la factura.\n- cantidad: cuántas unidades compré (número entero; si es por peso, el peso con punto decimal, por ejemplo 0.75).\n- comercio: nombre del supermercado o comercio de la factura (el mismo en todas las filas).\n- precio_unitario: precio de UNA unidad, solo el número, sin símbolo de moneda y sin separador de miles (por ejemplo 1250.50). Si la factura solo muestra el total de la línea, divídelo entre la cantidad.\nNo agregues columnas, títulos ni comentarios. Entrégame solo el contenido del CSV.';
function descargarPlantillaCSV(){
  const txt='﻿'+CSV_COLS.join(',')+'\r\n';
  downloadBlob(new Blob([txt],{type:'text/csv;charset=utf-8'}),'plantilla-compras.csv');
  toast('Plantilla descargada');
}
/* Lee texto CSV con comas o punto y coma, y comillas */
function parseCSV(txt){
  txt=String(txt).replace(/^﻿/,'');
  const primera=txt.split(/\r?\n/)[0]||'';
  const sep=(primera.split(';').length>primera.split(',').length)?';':',';
  const filas=[]; let f=[],c='',q=false;
  for(let i=0;i<txt.length;i++){
    const ch=txt[i];
    if(q){ if(ch==='"'){ if(txt[i+1]==='"'){ c+='"'; i++; } else q=false; } else c+=ch; }
    else if(ch==='"') q=true;
    else if(ch===sep){ f.push(c); c=''; }
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&txt[i+1]==='\n') i++; f.push(c); c=''; if(f.some(x=>x.trim()!=='')) filas.push(f); f=[]; }
    else c+=ch;
  }
  f.push(c); if(f.some(x=>x.trim()!=='')) filas.push(f);
  return filas;
}
/* Convierte las filas del CSV en líneas de compra; devuelve {lineas, omitidas} */
function lineasDesdeCSV(filas){
  if(!filas.length) return {lineas:[],omitidas:0};
  const norm=s=>normTxt(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const enc=filas[0].map(norm);
  const idx=(...nombres)=>enc.findIndex(h=>nombres.includes(h));
  let iN=idx('producto','articulo','item','descripcion','nombre'), iQ=idx('cantidad','cant','unidades','qty');
  let iC=idx('comercio','supermercado','cadena','tienda','super'), iP=idx('precio_unitario','precio','costo','costo_unitario','precio_unit','valor');
  let datos=filas.slice(1);
  if(iN<0){ /* sin encabezado reconocible: se toma el orden de la plantilla */ iN=0; iQ=1; iC=2; iP=3; datos=filas; }
  const lineas=[]; let omitidas=0;
  datos.forEach(r=>{
    const n=capIni(String(r[iN]||'').trim());
    if(!n){ omitidas++; return; }
    let cant=iQ>=0?parseMoney(r[iQ]||''):null; if(cant==null||Number.isNaN(cant)||cant<=0) cant=1;
    let precio=iP>=0?parseMoney(r[iP]||''):null; if(Number.isNaN(precio)) precio=null;
    let u=1, m=precio;
    if(Number.isInteger(cant)&&cant<=12) u=cant;
    else if(precio!=null) m=Math.round(precio*cant*100)/100; /* más de 12 o con decimales (peso): se guarda el total de la línea como 1 unidad */
    const com=capIni(String(iC>=0?(r[iC]||''):'').trim());
    lineas.push({n,u,m,comercio:com});
  });
  return {lineas,omitidas};
}
async function leerArchivoCSV(file){
  const buf=await file.arrayBuffer();
  try{ return new TextDecoder('utf-8',{fatal:true}).decode(buf); }
  catch(e){ return new TextDecoder('windows-1252').decode(buf); }
}
function importarCSVCompras(q,file){
  leerArchivoCSV(file).then(txt=>{
    const {lineas,omitidas}=lineasDesdeCSV(parseCSV(txt));
    if(!lineas.length){ toast('No encontré productos en ese archivo. Revisa que use la plantilla.'); return; }
    const body=el('div');
    const p=el('p','small'); p.textContent='Encontré '+lineas.length+' producto'+(lineas.length===1?'':'s')+(omitidas?' ('+omitidas+' fila'+(omitidas===1?'':'s')+' sin nombre se omitieron)':'')+'. Se agregan a la lista de '+qname(q)+'.'; body.append(p);
    const tot=lineas.reduce((s,l)=>s+num(l.m)*l.u,0);
    const p2=el('p','small'); p2.textContent='Total del archivo: '+cf.format(tot); body.append(p2);
    const lab=el('label'); lab.style.cssText='display:flex; gap:8px; align-items:flex-start; margin:10px 0; font-size:14px';
    const ck=el('input'); ck.type='checkbox'; ck.checked=true; ck.style.cssText='width:auto; margin-top:3px'; ck.setAttribute('data-nocap','');
    lab.append(ck,document.createTextNode('Marcarlos como comprados ✓ (así el precio queda como "último precio" de cada artículo)')); body.append(lab);
    const lst=el('div'); lst.style.cssText='max-height:32vh; overflow:auto; font-size:13px';
    lineas.slice(0,50).forEach(l=>{ const d=el('div'); d.textContent=l.u+' × '+l.n+(l.comercio?' · '+l.comercio:'')+(l.m!=null?' · '+cf.format(l.m):' · sin precio'); lst.append(d); });
    if(lineas.length>50){ const d=el('div'); d.textContent='… y '+(lineas.length-50)+' más'; lst.append(d); }
    body.append(lst);
    modal('Importar compras desde CSV',body,[
      {label:'Cancelar'},
      {label:'Agregar a la lista',cls:'primary',onClick:()=>{
        const arr=months[cur][q].compras; while(arr.length && compraBlank(arr[arr.length-1])) arr.pop();
        lineas.forEach(l=>{
          const row=normCompra({n:l.n,m:l.m,u:l.u}); if(l.comercio) setChainFrom(row,CADENAS.find(c=>normTxt(c)===normTxt(l.comercio))||l.comercio);
          lookupCompra(row); row.ok=ck.checked;
          if(row.ok && row.cadena && !(row.cadena==='Otros'&&!String(row.otra).trim()) && num(row.m)>0) upsertCat(row.n,chainName(row),num(row.m));
          arr.push(row);
        });
        renderCompras(q); markDirty(); toast('Se agregaron '+lineas.length+' productos');
      }}
    ]);
  }).catch(()=>toast('No se pudo leer el archivo'));
}
function ayudaCSV(){
  const body=el('div');
  const p=el('p','small'); p.textContent='1) Descarga la plantilla en blanco. 2) Pásale a una IA (Claude u otra) la foto de tu factura junto con las instrucciones de abajo y pídele que llene el CSV. 3) Guarda lo que te devuelva como archivo .csv y cárgalo con "Cargar compras (.csv)".'; body.append(p);
  const ta=el('textarea'); ta.readOnly=true; ta.value=INSTRUCCIONES_IA; ta.rows=9; ta.setAttribute('data-nocap',''); ta.style.cssText='width:100%; font-size:12.5px; margin-top:8px'; body.append(ta);
  modal('Compras con factura (CSV)',body,[
    {label:'Copiar instrucciones',cls:'primary',onClick:()=>{ (navigator.clipboard?navigator.clipboard.writeText(INSTRUCCIONES_IA):Promise.reject()).then(()=>toast('Instrucciones copiadas')).catch(()=>{ ta.select(); toast('Selecciónalas y cópialas'); }); return false; }},
    {label:'Cerrar'}
  ]);
}
function renderCompras(q){
  const v=document.getElementById('view-c'+q.slice(1)); if(!v||!months[cur]) return;
  const list=months[cur][q].compras;
  ordenarCompras(list);
  v.replaceChildren();
  const c=el('section','card'); c.dataset.sec='compras';
  const h=el('header'); const h2=el('h2'); h2.textContent='Compras super/otros · '+qname(q); const tot=el('span','tot'); h.append(h2,tot); c.append(h);
  const hint=el('p','hint'); hint.innerHTML='Arma tu lista antes de salir: elige artículos de <b>Mi lista</b> o escribe uno nuevo (queda guardado para la próxima). Escribe el precio de <b>una</b> unidad y elige cuántas llevas (1 a 12): la lista suma precio × unidades. Al tildar ✓ como comprado, el precio unitario pasa a ser el "último precio" de ese artículo en esa cadena. Es solo una lista: <b>no se resta del balance</b>.'; c.append(hint);
  c.append(el('div','cresumen'));
  const head=el('div','chead'); ['Producto','Cadena','Unid.','Precio unidad','Último / total','✓',''].forEach(t=>{ const s=el('span'); s.textContent=t; head.append(s); }); c.append(head);
  const box=el('div','list'); c.append(box);
  box.addEventListener('focusout',()=>setTimeout(()=>reordenarComprasEnPantalla(q,box),150));
  list.forEach(r=>box.append(compraRow(q,r,c)));
  if(!list.length){ box.append(estadoVacio('compras','Tu lista de '+estaP()+' está vacía','Agrega lo que necesitas comprar, o elige de los artículos que ya usaste.','＋ Agregar el primero',()=>{ list.push(normCompra({})); renderCompras(q); const ins=document.querySelectorAll('#view-c'+q.slice(1)+' .crow .c-n input'); if(ins.length) ins[ins.length-1].focus(); })); }
  const bar=el('div','tools'); bar.style.marginTop='8px';
  const pick=el('button','btn primary'); pick.type='button'; pick.textContent='Elegir de mi lista'; pick.addEventListener('click',()=>openPicker(q));
  const add=el('button','add'); add.type='button'; add.textContent='＋ Agregar línea';
  add.addEventListener('click',()=>{
    list.push(normCompra({})); renderCompras(q);
    const ins=document.querySelectorAll('#view-c'+q.slice(1)+' .crow .c-n input'); if(ins.length) ins[ins.length-1].focus();
  });
  const bCsv=el('button','btn primary'); bCsv.type='button'; bCsv.textContent='Plantilla (.csv)'; bCsv.addEventListener('click',descargarPlantillaCSV);
  const fCsv=el('input'); fCsv.type='file'; fCsv.accept='.csv,text/csv,text/plain'; fCsv.hidden=true;
  fCsv.addEventListener('change',()=>{ const f=fCsv.files&&fCsv.files[0]; fCsv.value=''; if(f) importarCSVCompras(q,f); });
  const bUp=el('button','btn primary'); bUp.type='button'; bUp.textContent='Cargar compras (.csv)'; bUp.addEventListener('click',()=>fCsv.click());
  const bHelp=el('button','btn'); bHelp.type='button'; bHelp.textContent='¿Cómo uso el CSV?'; bHelp.addEventListener('click',ayudaCSV);
  bar.append(pick); c.append(bar,add);
  const csvBox=el('div','csvbox'); csvBox.style.cssText='margin-top:22px; padding-top:14px; border-top:1px solid var(--line,#d9d9d9)';
  const csvT=el('p','small'); csvT.style.cssText='margin:0 0 8px; font-weight:600'; csvT.textContent='Cargar una factura o ticket (foto, PDF o archivo CSV)';
  const fTk=el('input'); fTk.type='file'; fTk.accept='image/*,application/pdf,.pdf'; fTk.hidden=true;
  fTk.addEventListener('change',()=>{ const f=fTk.files&&fTk.files[0]; fTk.value=''; if(f) cargarTicket(q,f); });
  const bTk=el('button','btn primary'); bTk.type='button'; bTk.textContent='📷 Foto o PDF del ticket'; bTk.addEventListener('click',()=>fTk.click());
  const csvBar=el('div','tools'); csvBar.append(bTk,bCsv,bUp,bHelp,fCsv,fTk); csvBox.append(csvT,csvBar); c.append(csvBox);
  v.append(c); updateComprasTotals(q,c);
}
function openPicker(q){
  const body=el('div');
  const s=el('input','txt'); s.type='text'; s.placeholder='Buscar artículo…'; s.setAttribute('aria-label','Buscar artículo'); s.style.cssText='width:100%; margin-bottom:8px';
  const f=el('select'); f.setAttribute('aria-label','Filtrar por cadena'); f.style.cssText='width:100%; max-width:none; margin-bottom:8px';
  const lst=el('div'); lst.style.cssText='max-height:48vh; overflow:auto';
  const fill=()=>{
    const keep=f.value; f.replaceChildren();
    const o0=el('option'); o0.value=''; o0.textContent='Todas las cadenas'; f.append(o0);
    [...new Set([...catalogo.values()].map(e=>e.cadena).filter(Boolean))].sort().forEach(k=>{ const o=el('option'); o.value=k; o.textContent=k; f.append(o); });
    f.value=[...f.options].some(o=>o.value===keep)?keep:'';
  };
  const draw=()=>{
    lst.replaceChildren(); const k=normTxt(s.value);
    const items=[...catalogo.values()].filter(e=>(!k||normTxt(e.n).includes(k))&&(!f.value||e.cadena===f.value))
      .sort((a,b)=>a.n.localeCompare(b.n,'es')||a.cadena.localeCompare(b.cadena,'es'));
    if(!items.length){ const p=el('p','small'); p.textContent=catalogo.size?'No hay artículos con ese filtro.':'Tu lista está vacía. Se va armando sola: escribe un producto con su cadena en la lista de compras y queda guardado acá.'; lst.append(p); return; }
    items.forEach(e=>{
      const r=el('div','pickRow'); const pn=el('div','pn'); const b=el('b'); b.textContent=e.n;
      const sm=el('small'); sm.textContent=(e.cadena||'Sin cadena')+' · '+(e.ult>0?'último '+cf.format(e.ult):'sin compras'); pn.append(b,sm);
      const add=el('button','btn primary'); add.type='button'; add.textContent='＋'; add.setAttribute('aria-label','Agregar '+e.n);
      add.addEventListener('click',()=>{
        const arr=months[cur][q].compras; while(arr.length && compraBlank(arr[arr.length-1])) arr.pop();
        const row=normCompra({n:e.n,m:e.ult,ult:e.ult}); setChainFrom(row,e.cadena); arr.push(row);
        renderCompras(q); markDirty(); toast('Agregado: '+e.n);
      });
      const del=el('button','btn danger'); del.type='button'; del.textContent='🗑'; del.title='Quitar de mi lista'; del.setAttribute('aria-label','Quitar '+e.n+' de mi lista');
      del.addEventListener('click',()=>{ catalogo.delete(e.id); FS.deleteDoc(catDoc(e.id)).catch(()=>{}); refreshComprasDL(); fill(); draw(); });
      r.append(pn,add,del); lst.append(r);
    });
  };
  s.addEventListener('input',draw); f.addEventListener('change',draw);
  body.append(s,f,lst); fill(); draw();
  modal('Mi lista de artículos',body,[{label:'Listo',cls:'primary'}]);
}

/* ---------- Versículo del día ---------- */
const VERSICULOS=[
 ['Protección en la angustia','Nuestro Dios es bondadoso y cuida de los que en él confían. En momentos de angustia, él nos brinda protección.','Nahúm 1:7 (TLA)'],
 ['Ven y descansa','Ustedes viven siempre angustiados y preocupados. Vengan a mí, y yo los haré descansar. Obedezcan mis mandamientos y aprendan de mí, pues yo soy paciente y humilde de verdad. Conmigo podrán descansar. Lo que yo les impongo no es difícil de cumplir, ni es pesada la carga que les hago llevar.','Mateo 11:28-30 (TLA)'],
 ['Un día a la vez','Así que no se preocupen por lo que pasará mañana. Ya tendrán tiempo para eso. Recuerden que ya tenemos bastante con los problemas de cada día.','Mateo 6:34 (TLA)'],
 ['Sé fuerte y valiente','Yo te pido que seas fuerte y valiente, que no te desanimes ni tengas miedo, porque yo soy tu Dios, y te ayudaré por dondequiera que vayas.','Josué 1:9 (TLA)'],
 ['Pondré mi confianza en Dios','¡Pero no hay razón para que me inquiete! ¡No hay razón para que me preocupe! ¡Pondré mi confianza en Dios mi salvador! ¡Solo a él alabaré!','Salmo 42:11 (TLA)'],
 ['Un Padre que da cosas buenas','Si ustedes, que son malos, saben dar cosas buenas a sus hijos, con mayor razón Dios, su Padre que está en el cielo, dará buenas cosas a quienes se las pidan.','Mateo 7:11 (TLA)'],
 ['Cambia la ansiedad por oración','No se preocupen por nada. Más bien, oren y pídanle a Dios todo lo que necesiten, y sean agradecidos. Así Dios les dará su paz, esa paz que la gente de este mundo no alcanza a comprender, pero que protege el corazón y el entendimiento de los que ya son de Cristo.','Filipenses 4:6-7 (TLA)'],
 ['Cuánto te ama Dios','Dios amó tanto a la gente de este mundo, que me entregó a mí, que soy su único Hijo, para que todo el que crea en mí no muera, sino que tenga vida eterna.','Juan 3:16 (TLA)'],
 ['Vive en paz','Si alguien los trata mal, no le paguen con la misma moneda. Al contrario, busquen siempre hacer el bien a todos. Hagan todo lo posible por vivir en paz con todo el mundo.','Romanos 12:17-18 (TLA)'],
 ['Dios no abandona','Ni antes cuando era joven, ni ahora que ya soy viejo, he visto jamás gente honrada viviendo en la miseria, ni tampoco que sus hijos anden pidiendo pan.','Salmo 37:25 (TLA)'],
 ['Lo que Dios espera de ti','Pero ya Dios les ha dicho qué es lo mejor que pueden hacer y lo que espera de ustedes. Es muy sencillo: Dios quiere que ustedes sean justos los unos con los otros, que sean bondadosos con los más débiles, y que lo adoren como su único Dios.','Miqueas 6:8 (TLA)'],
 ['De dónde viene tu ayuda','Dirijo la mirada a las montañas; ¿de dónde vendrá mi ayuda? Mi ayuda viene de Dios, creador del cielo y de la tierra.','Salmo 121:1-2 (TLA)'],
 ['No vivas preocupado','No vivan pensando en qué van a comer, qué van a beber o qué ropa se van a poner. La vida no consiste solamente en comer, ni Dios creó el cuerpo solo para que lo vistan.','Mateo 6:25 (TLA)'],
 ['Él da de comer a todos','Los ojos de todos están fijos en ti; esperando que los alimentes. De buena gana abres la mano, y das de comer en abundancia a todos los seres vivos.','Salmo 145:15-16 (TLA)'],
 ['Un pueblo elegido','Pero ustedes son miembros de la familia de Dios, son sacerdotes al servicio del Rey, y son su pueblo. Dios mismo los sacó de la oscuridad del pecado, y los hizo entrar en su luz maravillosa. Por eso, anuncien las maravillas que Dios ha hecho.','1 Pedro 2:9 (TLA)'],
 ['Amanece la alegría','Cuando Dios se enoja, el enojo pronto se le pasa; pero cuando ama, su amor dura toda la vida. Tal vez lloremos por la noche, pero en la mañana estaremos felices.','Salmo 30:5 (TLA)'],
 ['Vales mucho para Dios','Dos pajaritos no valen más que una moneda. Sin embargo, ningún pajarito muere sin que Dios, el Padre de ustedes, lo permita. ¡Dios sabe hasta cuántos cabellos tienen ustedes en la cabeza! Por eso, no tengan miedo. Ustedes valen mucho más que todos los pajaritos.','Mateo 10:29-31 (TLA)'],
 ['Edificar el hogar','La mujer sabia une a su familia; la mujer tonta la desbarata.','Proverbios 14:1 (TLA)'],
 ['Bondad y perdón','Por el contrario, sean buenos y compasivos los unos con los otros, y perdónense, así como Dios los perdonó a ustedes por medio de Cristo.','Efesios 4:32 (TLA)'],
 ['Lo mejor está por venir','Estoy seguro de que los sufrimientos por los que ahora pasamos no son nada, si los comparamos con la gloriosa vida que Dios nos dará junto a él.','Romanos 8:18 (TLA)'],
 ['Un hogar con respeto','Y ustedes los esposos deben amar a sus esposas y no ser groseros ni duros con ellas. Ustedes, los hijos, deben obedecer a sus padres en todo, pues eso agrada al Señor.','Colosenses 3:19-20 (TLA)'],
 ['Los hijos, un regalo','Los hijos que tenemos son un regalo de Dios. Los hijos que nos nacen son nuestra recompensa.','Salmo 127:3 (TLA)'],
 ['Una promesa para tus descendientes','Dios dijo: Yo hago un pacto con ustedes: les prometo que mi poder, y las enseñanzas que les he dado, nunca se apartarán de ustedes ni de sus descendientes.','Isaías 59:21 (TLA)'],
 ['Comparte lo que tienes','Nunca se olviden de hacer lo bueno, ni de compartir lo que tienen con los que no tienen nada. Esos son los sacrificios que agradan a Dios.','Hebreos 13:16 (TLA)'],
 ['Generosidad y buenos negocios','La gente buena es generosa: presta a quienes le piden, y maneja bien sus negocios.','Salmo 112:5 (TLA)'],
 ['Dios tiene un plan para ti','Mis planes para ustedes solamente yo los sé, y no son para su mal, sino para su bien. Voy a darles un futuro lleno de bienestar.','Jeremías 29:11 (TLA)'],
 ['La paz de Cristo','Les doy la paz, mi propia paz, que no es como la paz que se desea en este mundo. No se preocupen ni tengan miedo por lo que pronto va a pasar.','Juan 14:27 (TLA)'],
 ['Nada te separa de su amor','Yo estoy seguro de que nada podrá separarnos del amor de Dios: ni la vida ni la muerte, ni los ángeles ni los espíritus, ni lo presente ni lo futuro, ni los poderes del cielo ni los del infierno, ni nada de lo creado por Dios. ¡Nada, absolutamente nada, podrá separarnos del amor que Dios nos ha mostrado por medio de nuestro Señor Jesucristo!','Romanos 8:38-39 (TLA)'],
 ['Dios te da más de lo necesario','Dios puede darles muchas cosas, a fin de que tengan todo lo necesario, y aun les sobre. Así podrán hacer algo en favor de otros.','2 Corintios 9:8 (TLA)'],
 ['Firmes en la esperanza','Mientras esperan al Señor, muéstrense alegres; cuando sufran por el Señor, muéstrense pacientes; cuando oren al Señor, muéstrense constantes.','Romanos 12:12 (TLA)'],
 ['Todo es de Él y para Él','En realidad, todo fue creado por Dios; todo existe por él y para él. Así que, ¡alabemos a Dios por siempre! Amén.','Romanos 11:36 (TLA)'],
 ['Para Dios todo es posible','Eso demuestra que para Dios todo es posible.','Lucas 1:37 (TLA)'],
 ['Creados para hacer el bien','Nosotros somos creación de Dios. Por nuestra unión con Jesucristo, nos creó para que vivamos haciendo el bien, lo cual Dios ya había planeado desde antes.','Efesios 2:10 (TLA)'],
 ['Dios no te abandonará','Sean fuertes y valientes, pues Dios peleará por ustedes; no tengan miedo de esos países, porque Dios no los abandonará.','Deuteronomio 31:6 (TLA)'],
 ['Dios bendice al generoso','Dios bendice al que es generoso y al que comparte su pan con los pobres.','Proverbios 22:9 (TLA)'],
 ['Así es el amor','El que ama tiene paciencia en todo, y siempre es amable. El que ama no es envidioso, ni se cree más que nadie. No es orgulloso. No es grosero ni egoísta. No se enoja por cualquier cosa. No se pasa la vida recordando lo malo que otros le han hecho. No aplaude a los malvados, sino a los que hablan con la verdad. El que ama es capaz de aguantarlo todo, de creerlo todo, de esperarlo todo, de soportarlo todo.','1 Corintios 13:4-7 (TLA)'],
 ['Ayuda con alegría','Mejor ayuden siempre al pobre, y háganlo con alegría. Si lo hacen, les irá bien y Dios los bendecirá en todo lo que hagan.','Deuteronomio 15:10 (TLA)'],
 ['Pon tus asuntos en orden','Si piensas construir tu casa, atiende primero a tus negocios, y no desatiendas a tu familia.','Proverbios 24:27 (TLA)'],
 ['Para Dios sea la gloria','Tú mereces alabanzas, Dios nuestro, y no nosotros; tú mereces alabanzas por tu amor y tu fidelidad.','Salmo 115:1 (TLA)'],
 ['Ya somos hijos de Dios','Queridos hermanos, ¡nosotros ya somos hijos de Dios! Y aunque todavía no sabemos cómo seremos en el futuro, sí sabemos que, cuando Jesucristo aparezca otra vez, nos pareceremos a él, porque lo veremos como él es en realidad.','1 Juan 3:2 (TLA)'],
 ['Dios suple lo que falta','Por eso, de sus riquezas maravillosas mi Dios les dará, por medio de Jesucristo, todo lo que les haga falta.','Filipenses 4:19 (TLA)'],
 ['Un regalo de Dios','Si ya tienes esposa, ya tienes lo mejor: ¡Dios te ha demostrado su amor!','Proverbios 18:22 (TLA)'],
 ['Anímense unos a otros','Por eso, anímense los unos a los otros, y ayúdense a fortalecer su vida cristiana, como ya lo están haciendo.','1 Tesalonicenses 5:11 (TLA)'],
 ['El mayor amor','Nadie muestra más amor que quien da la vida por sus amigos.','Juan 15:13 (TLA)'],
 ['La alegría de los abuelos','El orgullo de los padres son los hijos; la alegría de los abuelos son los nietos.','Proverbios 17:6 (TLA)'],
 ['Una herencia para tus nietos','Las riquezas del hombre bueno serán para sus nietos; las riquezas del pecador serán la herencia de la gente honrada.','Proverbios 13:22 (TLA)'],
 ['Serás de bendición','Con tus descendientes formaré una gran nación. Voy a bendecirte y hacerte famoso, y serás de bendición para otros.','Génesis 12:2 (TLA)'],
 ['Qué es la fe','Confiar en Dios es estar totalmente seguro de que uno va a recibir lo que espera. Es estar convencido de que algo existe, aun cuando no se pueda ver.','Hebreos 11:1 (TLA)'],
 ['Enséñame tu camino','Dios mío, enséñame a vivir como tú siempre has querido. Tú eres mi Dios y salvador, y en ti siempre confío.','Salmo 25:4-5 (TLA)'],
 ['Para ayudar a otros','Dios da la semilla que se siembra y el pan que nos alimenta, así que también les dará a ustedes todo lo necesario, y hará que tengan cada vez más, para que puedan ayudar a otros. Los hará ricos, para que puedan dar mucho. Así, serán más los que den gracias a Dios por el dinero que ustedes van a reunir y que nosotros vamos a llevar.','2 Corintios 9:10-11 (TLA)'],
 ['Mi familia y yo, con Dios','Si no quieren serle obedientes, decidan hoy a quién van a dedicar su vida. Tendrán que elegir entre los dioses a quienes sus antepasados adoraron en Mesopotamia, y los dioses de los amorreos en cuyo territorio ustedes viven ahora. Pero mi familia y yo hemos decidido dedicar nuestra vida a nuestro Dios.','Josué 24:15 (TLA)'],
 ['No temeré, tú estás conmigo','Puedo cruzar lugares peligrosos y no tener miedo de nada, porque tú eres mi pastor y siempre estás a mi lado; me guías por el buen camino y me llenas de confianza.','Salmo 23:4 (TLA)'],
 ['Dios bendice a los compasivos','Dios bendice a los que son compasivos, pues él será compasivo con ellos.','Mateo 5:7 (TLA)'],
 ['Amor en la mesa','Las verduras son mejores que la carne cuando se comen con amor.','Proverbios 15:17 (TLA)'],
 ['Dormir en paz','Cuando me acuesto, me duermo enseguida, porque solo tú, mi Dios, me das tranquilidad.','Salmo 4:8 (TLA)'],
 ['Respeta a los necesitados','Quien le quita todo al pobre ofende a Dios, su creador; quien obedece a Dios trata bien al pobre.','Proverbios 14:31 (TLA)'],
 ['Dar mucho fruto','Si ustedes dan mucho fruto y viven realmente como discípulos míos, mi Padre estará orgulloso de ustedes.','Juan 15:8 (TLA)'],
 ['Dios está de tu parte','Solo nos queda decir que, si Dios está de nuestra parte, nadie podrá estar en contra de nosotros.','Romanos 8:31 (TLA)'],
 ['Dios hace algo nuevo','Y ahora, Dios le dice a su pueblo: No recuerden ni piensen más en las cosas del pasado. Yo voy a hacer algo nuevo, y ya he empezado a hacerlo. Estoy abriendo un camino en el desierto y haré brotar ríos en la tierra seca.','Isaías 43:18-19 (TLA)'],
 ['Una creación maravillosa','Soy una creación maravillosa, y por eso te doy gracias. Todo lo que haces es maravilloso, ¡de eso estoy bien seguro!','Salmo 139:14 (TLA)'],
 ['Vive tranquilo y trabaja','Traten de vivir tranquilos, ocúpense de sus propios asuntos y trabajen, como ya antes les hemos ordenado que lo hagan. De ese modo se ganarán el respeto de la gente que no confía en Dios, y no tendrán que pedirle nada a nadie.','1 Tesalonicenses 4:11-12 (TLA)'],
 ['Cada mañana, un nuevo comienzo','Sé que no hemos sido destruidos porque Dios nos tiene compasión. Sé que cada mañana se renuevan su gran amor y su fidelidad.','Lamentaciones 3:22-23 (TLA)'],
 ['El Señor te protege del mal','Pero el Señor Jesucristo les dará una firme confianza y los protegerá del mal, porque él siempre cumple lo que dice.','2 Tesalonicenses 3:3 (TLA)'],
 ['No debas nada a nadie','No le deban nada a nadie. La única deuda que deben tener es la de amarse unos a otros. El que ama a los demás ya ha cumplido con todo lo que la ley exige.','Romanos 13:8 (TLA)'],
 ['De generación en generación','Nosotros hablaremos del poder, belleza y majestad de tus hechos maravillosos; yo pensaré mucho en ellos y los daré a conocer a mis propios hijos.','Salmo 145:4-6 (TLA)'],
 ['Cerca de los desanimados','Dios siempre está cerca para salvar a los que no tienen ni ánimo ni esperanza.','Salmo 34:18 (TLA)'],
 ['Más bendición en dar','Les he enseñado que deben trabajar y ayudar a los que nada tienen. Recuerden lo que nos dijo el Señor Jesús: “Dios bendice más al que da que al que recibe.”','Hechos 20:35 (TLA)'],
 ['El trabajo da fruto','Si no trabajas, te quedas pobre; si trabajas, te vuelves rico.','Proverbios 10:4 (TLA)'],
 ['Una bendición para tu familia','“Que Dios te bendiga y siempre te cuide; que Dios te mire con agrado y te muestre su bondad; que Dios te mire con agrado y te llene de paz”.','Números 6:24-26 (TLA)'],
 ['Bendice a todos','No maldigan a sus perseguidores; más bien, pídanle a Dios que los bendiga.','Romanos 12:14 (TLA)'],
 ['El Señor es mi luz','Dios mío, tú eres mi luz y mi salvación; ¿de quién voy a tener miedo? Tú eres quien protege mi vida; ¡nadie me infunde temor!','Salmo 27:1 (TLA)'],
 ['Usa bien lo que Dios te dio','Cada uno de ustedes ha recibido de Dios alguna capacidad especial. Úsela bien en el servicio a los demás.','1 Pedro 4:10 (TLA)'],
 ['Todo le pertenece a Dios','Dios es dueño de toda la tierra y de todo lo que hay en ella; también es dueño del mundo y de todos sus habitantes.','Salmo 24:1 (TLA)'],
 ['Que el dinero no mande','Porque todos los males comienzan cuando solo se piensa en el dinero. Por el deseo de amontonarlo, muchos se olvidaron de obedecer a Dios y acabaron por tener muchos problemas y sufrimientos.','1 Timoteo 6:10 (TLA)'],
 ['Dios marca el rumbo','El hombre planea su futuro, pero Dios le marca el rumbo.','Proverbios 16:9 (TLA)'],
 ['Pon tu vida en sus manos','Pon tu vida en sus manos, confía plenamente en él, y él actuará en tu favor…','Salmo 37:5 (TLA)'],
 ['Tus preocupaciones, en sus manos','Así que pongan sus preocupaciones en las manos de Dios, pues él tiene cuidado de ustedes.','1 Pedro 5:7 (TLA)'],
 ['Dos en uno','Esto explica por qué el hombre deja a su padre y a su madre, y se une a su mujer para formar un solo cuerpo.','Génesis 2:24 (TLA)'],
 ['Mejores son dos','La verdad, «más valen dos que uno», porque sacan más provecho de lo que hacen. Además, si uno de ellos se tropieza, el otro puede levantarlo. Pero ¡pobre del que cae y no tiene quien lo ayude a levantarse!','Eclesiastés 4:9-10 (TLA)'],
 ['Todo tiene un propósito','Sabemos que Dios va preparando todo para el bien de los que lo aman, es decir, de los que él ha llamado de acuerdo con su plan.','Romanos 8:28 (TLA)'],
 ['Dios quiere darte su reino','¡No tengan miedo, mi pequeño grupo de discípulos! Dios, el Padre de ustedes, quiere darles su reino.','Lucas 12:32 (TLA)'],
 ['Vivir en armonía','¡No hay nada más bello ni más agradable que ver a los hermanos vivir juntos y en armonía!','Salmo 133:1 (TLA)'],
 ['Inmensamente rico','¡Dios es inmensamente rico! ¡Su inteligencia y su conocimiento son tan grandes que no se pueden medir! Nadie es capaz de entender sus decisiones, ni de explicar sus hechos.','Romanos 11:33 (TLA)'],
 ['Las riquezas vuelan','No hagas de las riquezas tu única meta en la vida, pues son como las águilas: abren las alas y salen volando. Si acaso llegas a verlas, muy pronto desaparecen.','Proverbios 23:4-5 (TLA)'],
 ['No tengas miedo, Él está contigo','Por tanto, no tengan miedo, pues yo soy su Dios y estoy con ustedes. Mi mano victoriosa les dará fuerza y ayuda; mi mano victoriosa siempre les dará su apoyo.','Isaías 41:10 (TLA)'],
 ['No te canses de hacer el bien','Así que no nos cansemos de hacer el bien porque, si seguimos haciéndolo, Dios nos premiará a su debido tiempo. Siempre que nos sea posible, hagamos el bien a todos, pero especialmente a los seguidores de Cristo.','Gálatas 6:9-10 (TLA)'],
 ['Espera con calma','Calla en presencia de Dios, y espera paciente a que actúe; no te enojes por causa de los que prosperan ni por los que hacen planes malvados.','Salmo 37:7 (TLA)'],
 ['La promesa es para tus hijos','Esta promesa es para ustedes y para sus hijos, y para todos los que nuestro Dios quiera salvar en otras partes del mundo.','Hechos 2:39 (TLA)'],
 ['Tú eres mi fuerza','¡Bendito seas, Dios mío, por atender a mis ruegos! Tú eres mi fuerza; me proteges como un escudo. En ti confío de corazón, pues de ti recibo ayuda. El corazón se me llena de alegría, por eso te alabo en mis cantos.','Salmo 28:6-7 (TLA)'],
 ['Todo para honrar a Dios','Siempre que ustedes coman o beban, o hagan cualquier otra cosa, háganlo para honrar a Dios.','1 Corintios 10:31 (TLA)'],
 ['Nadie detiene sus planes','Reconozco tu gran poder; nadie puede impedirte llevar a cabo tus planes.','Job 42:2 (TLA)'],
 ['Un futuro sin lágrimas','Él secará sus lágrimas, y no morirán jamás. Tampoco volverán a llorar, ni a lamentarse, ni sentirán ningún dolor, porque lo que antes existía ha dejado de existir.','Apocalipsis 21:4 (TLA)'],
 ['Ánimo y valentía','Todos ustedes, los que confían en Dios, ¡anímense y sean valientes!','Salmo 31:24 (TLA)'],
 ['La casa del sabio','En casa del sabio hay riquezas y perfumes; en casa del tonto solo hay desperdicios.','Proverbios 21:20 (TLA)'],
 ['El hombre propone, Dios dispone','El hombre propone, y Dios dispone.','Proverbios 19:21 (TLA)'],
 ['Cuéntalo a tus hijos y nietos','Por eso, jamás olviden todo lo que les ha pasado; al contrario, deben contárselo a sus hijos y nietos.','Deuteronomio 4:9 (TLA)'],
 ['Tu Padre sabe lo que necesitas','Ya no se preocupen por lo que van a comer, o lo que van a beber, o por la ropa que se van a poner. Solo los que no conocen a Dios se preocupan por eso. Ustedes tienen como padre a Dios que está en el cielo, y él sabe lo que ustedes necesitan. Lo más importante es que reconozcan a Dios como único rey, y que hagan lo que él les pide. Dios les dará a su tiempo todo lo que necesiten.','Mateo 6:31-33 (TLA)'],
 ['Ahorra poco a poco','Lo que fácilmente se gana, fácilmente se acaba; ahorra poco a poco, y un día serás rico.','Proverbios 13:11 (TLA)'],
 ['Esperar con paciencia','Por eso digo que en él confío; ¡Dios es todo para mí! Invito a todos a confiar en Dios porque él es bondadoso. Es bueno esperar con paciencia que Dios venga a salvarnos…','Lamentaciones 3:24-26 (TLA)'],
 ['Dios de esperanza','Que Dios, quien nos da seguridad, los llene de alegría. Que les dé la paz que trae el confiar en él. Y que, por el poder del Espíritu Santo, los llene de esperanza.','Romanos 15:13 (TLA)'],
 ['Nuestra capacidad viene de Dios','Pero nosotros no somos capaces de hacer algo por nosotros mismos; es Dios quien nos da la capacidad de hacerlo.','2 Corintios 3:5 (TLA)'],
 ['Deja tus planes en sus manos','Deja en manos de Dios todo lo que haces, y tus proyectos se harán realidad.','Proverbios 16:3 (TLA)'],
 ['Cuando siento miedo','Cuando siento miedo, confío en ti, mi Dios, y te alabo por tus promesas; Confío en ti, mi Dios, y ya no siento miedo. ¡Nadie podrá hacerme daño jamás!','Salmo 56:3-4 (TLA)'],
 ['Responde con bendición','Si alguien les hace algo malo, no hagan ustedes lo mismo; si alguien los insulta, no contesten con otro insulto. Al contrario, pídanle a Dios que bendiga a esas personas, pues él los eligió a ustedes para que reciban bendición.','1 Pedro 3:9 (TLA)'],
 ['Un jardín bien regado','Yo los guiaré constantemente, les daré agua en el calor del desierto, daré fuerzas a su cuerpo, y serán como un jardín bien regado, como una corriente de agua.','Isaías 58:11 (TLA)'],
 ['Confiemos siempre en Él','Dios hará vivir en paz a quienes le son fieles y confían en él. Dios es nuestro refugio eterno; ¡confiemos siempre en él!','Isaías 26:3-4 (TLA)'],
 ['Hijos bendecidos','¡Alabemos a nuestro Dios! ¡Dios bendice a quienes lo adoran y gozan cumpliendo sus mandamientos! Los hijos de la gente honrada dominarán el país y serán siempre bendecidos.','Salmo 112:1-2 (TLA)'],
 ['Como un árbol junto al río','¡Pero benditos sean aquellos que solo confían en mí! Son como árboles plantados a la orilla de un río: extienden sus raíces hacia la corriente, el calor no les causa ningún daño, sus hojas siempre están verdes y todo el año dan fruto.','Jeremías 17:7-8 (TLA)'],
 ['Pon tu confianza en Dios','¡Pero yo sé que viviré para disfrutar de tu bondad junto con todo tu pueblo! Por eso me armo de valor, y me digo a mí mismo: «Pon tu confianza en Dios. ¡Sí, pon tu confianza en él!»','Salmo 27:13-14 (TLA)'],
 ['Un hogar bendecido','¡Dios bendice a todos los que lo obedecen y siguen sus enseñanzas! Si tú eres uno de ellos, Dios te bendecirá mucho. En el seno de tu hogar comerás y disfrutarás de lo que ganes con tu trabajo. Tu esposa tendrá muchos hijos. ¡Parecerá un racimo de uvas! Nunca en tu mesa faltará comida, y tus hijos crecerán fuertes como los olivos.','Salmo 128:1-3 (TLA)'],
 ['Refugio bajo su sombra','Dios mío, ¡tu amor es incomparable! Bajo tu sombra protectora todos hallamos refugio.','Salmo 36:7 (TLA)'],
 ['Ámense y respétense','Ámense unos a otros como hermanos, y respétense siempre.','Romanos 12:10 (TLA)'],
 ['Como un padre con sus hijos','Su amor por quienes lo honran es tan grande e inmenso como grande es el universo. Apartó de nosotros los pecados que cometimos del mismo modo que apartó los extremos de la tierra. Con quienes lo honran, Dios es tan tierno como un padre con sus hijos.','Salmo 103:11-13 (TLA)'],
 ['Tesoros en el cielo','No traten de amontonar riquezas aquí en la tierra. Esas cosas se echan a perder o son destruidas por la polilla. Además, los ladrones pueden entrar y robarlas. Es mejor que amontonen riquezas en el cielo. Allí nada se echa a perder ni la polilla lo destruye. Tampoco los ladrones pueden entrar y robar. Recuerden que la verdadera riqueza consiste en obedecerme de todo corazón.','Mateo 6:19-21 (TLA)'],
 ['Cuida lo que Dios te encargó','Las riquezas no son eternas ni el dinero dura para siempre. Las cosechas se acaban, y la hierba se seca. Por eso, cuida bien tus rebaños.','Proverbios 27:23-25 (TLA)'],
 ['Mejor confiar en Dios','Vale más confiar en Dios que confiar en gente importante.','Salmo 118:8-9 (TLA)'],
 ['Dios te guía','Tú me dijiste: Yo te voy a instruir; te voy a enseñar cómo debes portarte. Voy a darte buenos consejos y a cuidar siempre de ti.','Salmo 32:8 (TLA)'],
 ['No se puede servir a dos amos','Ningún esclavo puede trabajar al mismo tiempo para dos amos, porque siempre obedecerá o amará a uno más que al otro. Del mismo modo, tampoco ustedes pueden servir al mismo tiempo a Dios y a las riquezas.','Mateo 6:24 (TLA)'],
 ['Él nos amó primero','Nosotros amamos a nuestros hermanos porque Dios nos amó primero.','1 Juan 4:19 (TLA)'],
 ['Salvados por su amor','Pero Dios es muy compasivo, y su amor por nosotros es inmenso. Por eso, aunque estábamos muertos por culpa de nuestros pecados, él nos dio vida al resucitar a Cristo. Nos hemos salvado gracias al amor de Dios.','Efesios 2:4-5 (TLA)'],
 ['Solo en Dios hay tranquilidad','Solo Dios me da tranquilidad, solo él puede salvarme; solo él me da su protección, ¡jamás seré derrotado!','Salmo 62:1-2 (TLA)'],
 ['Sin Él no podemos nada','El discípulo que se mantiene unido a mí, y con quien yo me mantengo unido, es como una rama que da mucho fruto; pero si uno de ustedes se separa de mí, no podrá hacer nada.','Juan 15:5 (TLA)'],
 ['Vales más que las aves','Miren a los cuervos: no siembran ni cosechan, ni tienen graneros para guardar las semillas. Sin embargo, Dios les da de comer. ¡Recuerden que ustedes son más importantes que las aves!','Lucas 12:24 (TLA)'],
 ['Nada es imposible para Dios','Dios de Israel, tú, con tu extraordinario poder, has creado el cielo y la tierra. ¡No hay nada que tú no puedas hacer!','Jeremías 32:17 (TLA)'],
 ['Trabaja para poder compartir','Quien antes fue ladrón, debe dejar de robar, y ahora trabajar bien y con sus propias manos. Así tendrá dinero para ayudar a las personas necesitadas.','Efesios 4:28 (TLA)'],
 ['Lo que haces por otros','Yo, el Rey, les diré: “Lo que ustedes hicieron para ayudar a una de las personas menos importantes de este mundo, a quienes yo considero como hermanos, es como si lo hubieran hecho para mí.”','Mateo 25:40 (TLA)'],
 ['Dios puede hacer mucho más','Dios tiene poder para hacer mucho más de lo que le pedimos. ¡Ni siquiera podemos imaginar lo que Dios puede hacer para ayudarnos con su poder!','Efesios 3:20 (TLA)'],
 ['Dios primero en todo','Demuéstrale a Dios que para ti él es lo más importante. Dale de lo que tienes y de todo lo que ganes; así nunca te faltará ni comida ni bebida.','Proverbios 3:9-10 (TLA)'],
 ['Su entendimiento no tiene fin','Grande es nuestro Dios, y grande es su poder; ¡su entendimiento no tiene fin!','Salmo 147:5 (TLA)'],
 ['Torre de refugio','Dios es como una alta torre; hacia él corren los buenos para ponerse a salvo.','Proverbios 18:10 (TLA)'],
 ['Ayudarnos y amarnos','Tratemos de ayudarnos unos a otros, y de amarnos y hacer lo bueno.','Hebreos 10:24 (TLA)'],
 ['Lo que Dios unió','Si Dios ha unido a un hombre y a una mujer, nadie debe separarlos.','Marcos 10:9 (TLA)'],
 ['Vístete de bondad','Dios los ama mucho a ustedes, y los ha elegido para que formen parte de su pueblo. Por eso, vivan como se espera de ustedes: amen a los demás, sean buenos, humildes, amables y pacientes.','Colosenses 3:12 (TLA)'],
 ['Pensar antes de actuar','Cuando las cosas se piensan bien, el resultado es provechoso. Cuando se hacen a la carrera, el resultado es desastroso.','Proverbios 21:5 (TLA)'],
 ['Solo Él hace maravillas','¡Solo tú eres imponente! ¡Solo tú haces grandes maravillas!','Salmo 86:10 (TLA)'],
 ['Mi única fuerza eres tú','Ya casi no tengo fuerzas, pero a ti siempre te tendré; ¡mi única fuerza eres tú!','Salmo 73:26 (TLA)'],
 ['Con Dios al frente de tu casa','Si Dios no construye la casa, de nada sirve que se esfuercen los constructores. Si Dios no vigila la ciudad, de nada sirve que se desvelen los vigilantes.','Salmo 127:1 (TLA)'],
 ['Grande es nuestro Dios','¡Grande eres, nuestro Dios, y mereces nuestras alabanzas! ¡Tanta es tu grandeza que no podemos comprenderla!','Salmo 145:3 (TLA)'],
 ['Más vale paz que riqueza','Más vale ser pobre y obedecer a Dios que ser rico y vivir en problemas.','Proverbios 15:16 (TLA)'],
 ['Él cumple lo que promete','Sigamos confiando en que Dios nos salvará. No lo dudemos ni un instante, porque él cumplirá lo que prometió.','Hebreos 10:23 (TLA)'],
 ['Enseña a tus hijos cada día','Apréndete de memoria todas las enseñanzas que hoy te he dado, y repítelas a tus hijos a todas horas y en todo lugar: cuando estés en tu casa o en el camino, y cuando te levantes o cuando te acuestes.','Deuteronomio 6:6-7 (TLA)'],
 ['Educa desde niño','Educa a tu hijo desde niño, y aun cuando llegue a viejo seguirá tus enseñanzas.','Proverbios 22:6 (TLA)'],
 ['Bondadoso y compasivo','Pero tú, mi Dios, eres bondadoso y compasivo; no te enojas fácilmente, y tu amor es siempre el mismo.','Salmo 86:15 (TLA)'],
 ['El Dios que hace milagros','Tú eres el Dios que hace milagros, que muestra su poder entre los pueblos.','Salmo 77:14 (TLA)'],
 ['Trabaja como para el Señor','Todo lo que hagan, háganlo de buena gana, como si estuvieran sirviendo al Señor Jesucristo y no a la gente.','Colosenses 3:23 (TLA)'],
 ['Amor y respeto','En todo caso, el esposo debe amar a su esposa, como si se tratara de sí mismo, y la esposa debe respetar a su esposo.','Efesios 5:33 (TLA)'],
 ['Mira las aves','Miren los pajaritos que vuelan por el aire. Ellos no siembran ni cosechan, ni guardan semillas en graneros. Sin embargo, Dios, el Padre que está en el cielo, les da todo lo que necesitan. ¡Y ustedes son más importantes que ellos!','Mateo 6:26 (TLA)'],
 ['Contento con lo que tienes','Por supuesto, la religión cristiana hace que nuestra vida sea mucho mejor, pero solo cuando uno está contento con lo que tiene. Porque, cuando nacimos no trajimos nada al mundo, y cuando muramos tampoco podremos llevarnos nada. Así que debemos estar contentos de que tenemos ropa y comida.','1 Timoteo 6:6-8 (TLA)'],
 ['Permanece en su amor','Así como el Padre me ama a mí, también yo los amo a ustedes. Nunca dejen de amarme.','Juan 15:9 (TLA)'],
 ['La medida con que das','Denles a otros lo necesario, y Dios les dará a ustedes lo que necesiten. En verdad, Dios les dará la misma medida que ustedes den a los demás. Si dan trigo, recibirán una bolsa llena de trigo, bien apretada y repleta, sin que tengan que ir a buscarla.','Lucas 6:38 (TLA)'],
 ['Amar como Cristo amó','Los esposos deben amar a sus esposas, así como Cristo amó a la iglesia y dio su vida por ella.','Efesios 5:25 (TLA)'],
 ['Cosas que nadie imaginó','Como dice la Biblia: «Para aquellos que lo aman, Dios ha preparado cosas que nadie jamás pudo ver, ni escuchar ni imaginar.»','1 Corintios 2:9 (TLA)'],
 ['Palabras que edifican','No digan malas palabras. Al contrario, digan siempre cosas buenas, que ayuden a los demás a crecer espiritualmente, pues eso es muy necesario.','Efesios 4:29 (TLA)'],
 ['Nuevas fuerzas','Dios les da nuevas fuerzas a los débiles y cansados. Los jóvenes se cansan por más fuertes que sean, pero los que confían en Dios siempre tendrán nuevas fuerzas. Podrán volar como las águilas, podrán caminar sin cansarse y correr sin fatigarse.','Isaías 40:29-31 (TLA)'],
 ['Palabras amables','Las palabras amables son como la miel: endulzan la vida y sanan el cuerpo.','Proverbios 16:24 (TLA)'],
 ['Quien da, recibe','Quienes son generosos, reciben en abundancia; quienes ni sus deudas pagan, acaban en la miseria. El que es generoso, progresa; el que siembra, también cosecha.','Proverbios 11:24-25 (TLA)'],
 ['Una casa edificada con sabiduría','Construye tu casa con sabiduría y entendimiento, y llena sus cuartos de conocimiento que es el más bello tesoro.','Proverbios 24:3-4 (TLA)'],
 ['Cuidado con las deudas','El pobre trabaja para el rico; el que pide prestado se hace esclavo del prestamista.','Proverbios 22:7 (TLA)'],
 ['Todo en el nombre de Jesús','Y todo lo que hagan o digan, háganlo como verdaderos seguidores del Señor Jesucristo, y denle gracias a Dios el Padre por lo que Cristo ha hecho por ustedes.','Colosenses 3:17 (TLA)'],
 ['Ángeles que te cuidan','Dios mismo les dirá a sus ángeles que nos cuiden por todas partes.','Salmo 91:11 (TLA)'],
 ['Por su amor los conocerán','Si se aman de verdad, entonces todos sabrán que ustedes son mis seguidores.','Juan 13:35 (TLA)'],
 ['Confía en Dios de todo corazón','Pon toda tu confianza en Dios y no en lo mucho que sabes. Toma en cuenta a Dios en todas tus acciones, y él te ayudará en todo.','Proverbios 3:5-6 (TLA)'],
 ['Somos hijos de Dios','¡Miren! Dios el Padre nos ama tanto que la gente nos llama hijos de Dios, y la verdad es que lo somos. Por eso los pecadores de este mundo no nos conocen, porque tampoco han conocido a Dios.','1 Juan 3:1 (TLA)'],
 ['Su amor, aun sin merecerlo','Pero Dios nos demostró su gran amor al enviar a Jesucristo a morir por nosotros, a pesar de que nosotros todavía éramos pecadores.','Romanos 5:8 (TLA)'],
 ['Servir a los que sufren','Porque cuando tuve hambre, ustedes me dieron de comer; cuando tuve sed, me dieron de beber; cuando tuve que salir de mi país, ustedes me recibieron en su casa; cuando no tuve ropa, ustedes me la dieron; cuando estuve enfermo, me visitaron; cuando estuve en la cárcel, ustedes fueron a verme.','Mateo 25:35-36 (TLA)'],
 ['Una fe que se hereda','Tu abuela Loida y tu madre Eunice confiaron sinceramente en Dios; y cuando me acuerdo de ti, me siento seguro de que también tú tienes esa misma confianza.','2 Timoteo 1:5 (TLA)'],
 ['Esposos comprensivos','En cuanto a ustedes, los esposos, sean comprensivos con sus esposas. Reconozcan que ellas no tienen la fuerza de ustedes, pero que también a ellas Dios les ha prometido la vida eterna. Si ustedes lo hacen así, Dios escuchará sus oraciones.','1 Pedro 3:7 (TLA)'],
 ['Que tu luz brille','De la misma manera, la conducta de ustedes debe ser como una luz que ilumine y muestre cómo se obedece a Dios. Hagan buenas acciones. Así los demás las verán y alabarán a Dios, el Padre de ustedes que está en el cielo.','Mateo 5:16 (TLA)'],
 ['Nada les falta a los que confían','Dios bendice a los que en él confían. Ustedes, pueblo de Dios, vengan y prueben su bondad; verán que a quienes lo adoran nunca les falta nada. Los ricos pasarán hambre, pero a los que confían en Dios nunca les faltará nada bueno.','Salmo 34:8-10 (TLA)'],
 ['Vivir para Cristo','Así que, si Cristo murió por nosotros, ya no debemos vivir más para nosotros mismos, sino para Cristo, que murió y resucitó para darnos vida.','2 Corintios 5:15 (TLA)'],
 ['Nuestra confianza está en Dios','Algunos confían en sus carros de guerra, otros confían en sus caballos, pero nosotros solo confiamos en nuestro Dios.','Salmo 20:7 (TLA)'],
 ['Amar con hechos','Si un rico ve que alguno de su propia iglesia tiene alguna necesidad, y no lo ayuda, ese rico no ama como Dios ama. Hijos míos, no debemos limitarnos a decir que amamos, sino que debemos demostrarlo por medio de lo que hacemos.','1 Juan 3:17-18 (TLA)'],
 ['El ejemplo de los padres','Dios bendice a los hijos del hombre honrado, cuando ellos siguen su ejemplo.','Proverbios 20:7 (TLA)'],
 ['Él ya venció','Les digo estas cosas para que estén unidos a mí y así sean felices de verdad. Pero tengan valor: yo he vencido a los poderes que gobiernan este mundo.','Juan 16:33 (TLA)'],
 ['Su fidelidad no cambia','Él es un Dios bueno; su amor es siempre el mismo, y su fidelidad jamás cambia.','Salmo 100:5 (TLA)'],
 ['Calcula antes de gastar','Si alguno de ustedes quiere construir una torre, ¿qué es lo primero que hace? Pues se sienta a pensar cuánto va a costarle, para ver si tiene suficiente dinero.','Lucas 14:28 (TLA)'],
 ['Ámense unos a otros','Les doy un mandamiento nuevo: Ámense unos a otros. Ustedes deben amarse de la misma manera que yo los amo.','Juan 13:34 (TLA)'],
 ['El verdadero amor','Dios nos dio muestras de su amor al enviar al mundo a Jesús, su único Hijo, para que por medio de él todos nosotros tengamos vida eterna. El verdadero amor no consiste en que nosotros hayamos amado a Dios, sino en que él nos amó y envió a su Hijo, para que nosotros fuéramos perdonados por medio de su sacrificio.','1 Juan 4:9-10 (TLA)'],
 ['Hogares abiertos','Compartan lo que tengan con los pobres de la iglesia. Reciban en sus hogares a los que vengan de otras ciudades y países.','Romanos 12:13 (TLA)'],
 ['La regla de oro','Traten a los demás como les gustaría que los demás los trataran a ustedes.','Lucas 6:31 (TLA)'],
 ['Bajo su protección','Vivamos bajo el cuidado del Dios altísimo; pasemos la noche bajo la protección del Dios todopoderoso. Él es nuestro refugio, el Dios que nos da fuerzas, ¡el Dios en quien confiamos!','Salmo 91:1-2 (TLA)'],
 ['Educar sin exasperar','Y ustedes, padres, no hagan enojar a sus hijos. Más bien edúquenlos y denles enseñanzas cristianas.','Efesios 6:4 (TLA)'],
 ['Paciencia y unidad','Sean humildes, amables y pacientes, y bríndense apoyo, por amor, los unos a los otros. Hagan todo lo posible por vivir en paz, para que no pierdan la unidad que el Espíritu les dio.','Efesios 4:2-3 (TLA)'],
 ['Fiel en lo poco','Al que cuida bien lo que vale poco, también se le puede confiar lo que vale mucho. Y el que es deshonesto con lo de poco valor, también lo será con lo de mucho valor.','Lucas 16:10 (TLA)'],
 ['Vence el mal con el bien','No se dejen vencer por el mal. Al contrario, triunfen sobre el mal haciendo el bien.','Romanos 12:21 (TLA)'],
 ['Ora en todo momento','Oren en todo momento.','1 Tesalonicenses 5:17 (TLA)'],
 ['Dar con alegría','Cada uno debe dar según crea que deba hacerlo. No tenemos que dar con tristeza ni por obligación. ¡Dios ama al que da con alegría!','2 Corintios 9:7 (TLA)'],
 ['Consejero admirable','Nos ha nacido un niño, Dios nos ha dado un hijo: a ese niño se le ha dado el poder de gobernar; y se le darán estos nombres: Consejero admirable, Dios invencible, Padre eterno, Príncipe de paz.','Isaías 9:6 (TLA)'],
 ['Hagan discípulos','Ustedes vayan y hagan más discípulos míos en todos los países de la tierra. Bautícenlos en el nombre del Padre, del Hijo y del Espíritu Santo. Enséñenles a obedecer todo lo que yo les he enseñado. Yo estaré siempre con ustedes, hasta el fin del mundo.','Mateo 28:19-20 (TLA)'],
 ['Todo viene de tu mano','¡Dios mío, a ti te pertenecen la grandeza y el poder, la gloria, el dominio y la majestad! Porque todo lo que existe es tuyo. ¡Tú reinas sobre todo el mundo! Tú das las riquezas y el honor, y tú dominas a todas tus criaturas. Tuyos son el poder y la fuerza, y das grandeza y poder a todos.','1 Crónicas 29:11-12 (TLA)'],
 ['Prestarle a Dios','Prestarle al pobre es como prestarle a Dios. ¡Y Dios siempre paga sus deudas!','Proverbios 19:17 (TLA)'],
 ['Contigo nada me falta','Tú, Dios mío, eres mi pastor; contigo nada me falta.','Salmo 23:1 (TLA)'],
 ['Se busca fidelidad','Los que están encargados de alguna tarea deben demostrar que se puede confiar en ellos.','1 Corintios 4:2 (TLA)'],
 ['Dios te cuidará siempre','Dios te protegerá y te pondrá a salvo de todos los peligros. Dios te cuidará ahora y siempre por dondequiera que vayas.','Salmo 121:7-8 (TLA)'],
 ['Un castillo de protección','Nuestro Dios es como un castillo que nos brinda protección. Dios siempre nos ayuda cuando estamos en problemas.','Salmo 46:1 (TLA)'],
 ['Mejor juntos que solos','Una sola persona puede ser vencida, pero dos ya pueden defenderse; y si tres unen sus fuerzas, ya no es fácil derrotarlas.','Eclesiastés 4:12 (TLA)'],
 ['Una casa que recibe','Reciban en su casa a los demás, y no hablen mal de ellos, sino hagan que se sientan bienvenidos.','1 Pedro 4:9 (TLA)'],
 ['El trabajo da fruto','El que trabaja tendrá suficiente comida; el que no trabaja acabará en la pobreza.','Proverbios 28:19 (TLA)'],
 ['Dormir sin preocupaciones','Cuando te acuestes, podrás dormir tranquilo y sin preocupaciones.','Proverbios 3:24 (TLA)'],
 ['Cuéntale a Dios tus problemas','Pueblo mío, ¡confía siempre en Dios! Cuando vayas a su templo, cuéntale todos tus problemas. ¡Dios es nuestro refugio!','Salmo 62:8 (TLA)'],
 ['Ningún arma prosperará','Sin embargo, nadie ha hecho un arma capaz de destruirte. Israel, tú harás callar a todo el que te acuse, porque yo, el único Dios, hago triunfar a los que me adoran. Te juro que así será.','Isaías 54:17 (TLA)'],
 ['Dios no se olvida de ti','Pero Dios respondió: Jerusalén, ¿acaso puede una madre olvidar o dejar de amar a su hijo? Y aunque ella lo olvidara, yo no me olvidaré de ti. Yo te llevo grabada como un tatuaje en mis manos, siempre tengo presentes tus murallas.','Isaías 49:15-16 (TLA)'],
 ['Su palabra no vuelve vacía','Lo mismo pasa con mi palabra cuando sale de mis labios: no vuelve a mí sin antes cumplir mis órdenes, sin antes hacer lo que yo quiero.','Isaías 55:11 (TLA)'],
 ['Eres suyo','Isaías dijo: Ahora, pueblo de Israel, Dios tu creador te dice: No tengas miedo. Yo te he liberado; te he llamado por tu nombre y tú me perteneces.','Isaías 43:1 (TLA)'],
 ['Antes que clamen, responde','Antes de que me llamen, yo les responderé; antes de que terminen de hablar, ya los habré escuchado.','Isaías 65:24 (TLA)'],
 ['Clama y te responderá','Llámame y te responderé. Te haré conocer cosas maravillosas y misteriosas que nunca has conocido.','Jeremías 33:3 (TLA)'],
 ['Amor eterno','Hace mucho, mucho tiempo me aparecí ante ellos y les dije: Pueblo de Israel, siempre te he amado, siempre te he sido fiel. Por eso nunca dejaré de tratarte con bondad. Volveré a reconstruirte, y volverás a danzar alegremente, a ritmo de panderetas.','Jeremías 31:3 (TLA)'],
 ['Cuando lo busques de corazón','Cuando ustedes me pidan algo en oración, yo los escucharé. Cuando ustedes me busquen, me encontrarán, siempre y cuando me busquen de todo corazón.','Jeremías 29:12-13 (TLA)'],
 ['Dios restaura lo perdido','Dios habrá de devolvernos todo lo que perdimos estos años por culpa de los saltamontes que él mandó contra nosotros. Tendremos mucha comida, y alabaremos a nuestro Dios por todas las grandes maravillas que ha hecho en favor nuestro. Dios le dijo al profeta: Yo soy el Dios de los israelitas. Yo vivo en medio de mi pueblo. Ellos me reconocerán como su único Dios, pues no hay otro como yo. ¡Y no volverán a ser humillados!','Joel 2:25-26 (TLA)'],
 ['Abre las ventanas de los cielos','Traigan a mi templo sus diezmos, y échenlos en el cofre de las ofrendas; así no les faltará alimento. ¡Pónganme a prueba con esto! Verán que abriré las ventanas del cielo, y les enviaré abundantes lluvias.','Malaquías 3:10 (TLA)'],
 ['Su presencia te da descanso','Dios le contestó: —Yo mismo voy a acompañarte y te haré estar tranquilo.','Éxodo 33:14 (TLA)'],
 ['Dios cumple su palabra','¡Dios no es como nosotros! No dice mentira alguna ni cambia de parecer. Dios cumple lo que promete.','Números 23:19 (TLA)'],
 ['Dios fiel que guarda el pacto','Por eso ustedes deben reconocer a nuestro Dios, que es el Dios verdadero. Nuestro Dios cumple su pacto con todos los descendientes de quienes lo aman y obedecen sus mandamientos.','Deuteronomio 7:9 (TLA)'],
 ['Brazos eternos debajo de ti','Dios es el Dios eterno, y siempre te protegerá; pondrá en fuga a tus enemigos, para que los destruyas.','Deuteronomio 33:27 (TLA)'],
 ['Ni una palabra ha faltado','Grande es Dios, que le dio paz a su pueblo Israel, cumpliendo así todo lo que prometió. No ha dejado de cumplir ni una sola de las promesas que nos dio por medio de Moisés.','1 Reyes 8:56 (TLA)'],
 ['Mi roca y mi fortaleza','Tú eres para mí la roca que me da refugio; ¡tú me cuidas y me libras! Me proteges como un escudo, y me salvas con tu poder. ¡Tú eres mi más alto escondite!','Salmo 18:2 (TLA)'],
 ['Cuán grande es su bondad','Tú eres muy bondadoso con la gente que te honra; a la vista de todo el mundo derramas tu bondad sobre los que en ti confían.','Salmo 31:19 (TLA)'],
 ['Los ojos de Jehová están sobre los que le temen','Pero tú cuidas siempre de quienes te respetan y confían en tu amor. En tiempos de escasez, no los dejas morir de hambre.','Salmo 33:18-19 (TLA)'],
 ['Me libró de todos mis temores','Le pedí a Dios que me ayudara, y su respuesta fue positiva: ¡me libró del miedo que tenía!','Salmo 34:4 (TLA)'],
 ['El ángel de Jehová acampa alrededor','Dios envía a su ángel para que salve del peligro a todos los que lo honran.','Salmo 34:7 (TLA)'],
 ['Los oye y los libra','Dios escucha a los suyos y los libra de su angustia.','Salmo 34:17 (TLA)'],
 ['Los libra de todas sus aflicciones','Los que son de Dios podrán tener muchos problemas, pero él los ayuda a vencerlos.','Salmo 34:19 (TLA)'],
 ['Pon tu delicia en Jehová','Entrégale a Dios tu amor, y él te dará lo que más deseas.','Salmo 37:4 (TLA)'],
 ['Sus pasos son ordenados','Cuando a Dios le agrada la conducta de un hombre, lo ayuda a mantenerse firme. Tal vez tenga tropiezos, pero no llegará a fracasar porque Dios le dará su apoyo.','Salmo 37:23-24 (TLA)'],
 ['No quitará el bien a los que andan en integridad','Señor y Dios nuestro, tú nos das calor y protección; nos das honor y gloria. Tu bondad no tiene medida para los que siempre hacen lo bueno.','Salmo 84:11 (TLA)'],
 ['Con él estaré en la angustia','Dios dice: Mi pueblo me ama y me conoce; por eso yo lo pondré a salvo. Cuando me llame, le responderé y estaré con él en su angustia; lo libraré y lo llenaré de honores.','Salmo 91:14-15 (TLA)'],
 ['Sus consuelos alegran mi alma','En medio de mis angustias y grandes preocupaciones, tú me diste consuelo y alegría.','Salmo 94:19 (TLA)'],
 ['Sacia al alma menesterosa','¡Dios calma la sed del sediento, y el hambre del hambriento!','Salmo 107:9 (TLA)'],
 ['Como los montes rodean a Jerusalén','Las montañas protegen a Jerusalén, y Dios protege a Israel ahora y siempre.','Salmo 125:2 (TLA)'],
 ['Con regocijo segarán','Las lágrimas que derramamos cuando sembramos la semilla se volverán cantos de alegría cuando cosechemos el trigo.','Salmo 126:5-6 (TLA)'],
 ['Jehová cumplirá su propósito en mí','Dios mío, tú cumplirás en mí todo lo que has pensado hacer. Tu amor por mí no cambia, pues tú mismo me hiciste. ¡No me abandones!','Salmo 138:8 (TLA)'],
 ['Cercano a los que le invocan','Siempre estás cerca de los que te llaman con sinceridad. Tú atiendes los ruegos de los que te honran; les das lo que necesitan y los pones a salvo.','Salmo 145:18-19 (TLA)'],
 ['Sana a los quebrantados de corazón','Dios sanó las heridas de los que habían perdido toda esperanza.','Salmo 147:3 (TLA)'],
 ['La bendición de Jehová enriquece','La bendición de Dios es riqueza que viene libre de preocupaciones.','Proverbios 10:22 (TLA)'],
 ['Pedid, buscad, llamad','Pidan a Dios, y él les dará. Hablen con Dios, y encontrarán lo que buscan. Llámenlo, y él los atenderá. Porque el que confía en Dios recibe lo que pide, encuentra lo que busca y, si llama, es atendido.','Mateo 7:7-8 (TLA)'],
 ['Donde dos o tres se reúnen','Porque allí donde dos o tres de ustedes se reúnan en mi nombre, allí estaré yo.','Mateo 18:20 (TLA)'],
 ['Lo imposible para los hombres','Jesús les respondió: —Para la gente eso es imposible, pero todo es posible para Dios.','Lucas 18:27 (TLA)'],
 ['No se turbe vuestro corazón','Poco después, Jesús les dijo a sus discípulos: —No se preocupen. Confíen en Dios y confíen también en mí. En la casa de mi Padre hay lugar para todos. Si no fuera cierto, no les habría dicho que voy allá a prepararles un lugar. Después de esto, volveré para llevarlos conmigo. Así estaremos juntos.','Juan 14:1-3 (TLA)'],
 ['Nadie las arrebatará de su mano','Mis seguidores me conocen, y yo también los conozco a ellos. Son como las ovejas, que reconocen la voz de su pastor, y él las conoce a ellas. Mis seguidores me obedecen, y yo les doy vida eterna; nadie me los quitará.','Juan 10:27-28 (TLA)'],
 ['Si permanecéis en él','Si ustedes se mantienen unidos a mí y obedecen todo lo que les he enseñado, recibirán de mi Padre todo lo que pidan.','Juan 15:7 (TLA)'],
 ['Hijos y no esclavos','Porque el Espíritu que Dios les ha dado no los esclaviza ni les hace tener miedo. Por el contrario, el Espíritu nos convierte en hijos de Dios y nos permite llamar a Dios: ¡Papá! El Espíritu de Dios se une a nuestro espíritu, y nos asegura que somos hijos de Dios.','Romanos 8:15-16 (TLA)'],
 ['Si dio a su Hijo, ¿cómo no nos dará todo?','Dios no nos negó ni siquiera a su propio Hijo, sino que lo entregó por nosotros, así que también nos dará junto con él todas las cosas.','Romanos 8:32 (TLA)'],
 ['Fiel es Dios','Ustedes no han pasado por ninguna tentación que otros no hayan tenido. Y pueden confiar en Dios, pues él no va a permitir que sufran más tentaciones de las que pueden soportar. Además, cuando vengan las tentaciones, Dios mismo les mostrará cómo vencerlas, y así podrán resistir.','1 Corintios 10:13 (TLA)'],
 ['En Cristo todas las promesas son sí','Y todas las promesas que Dios ha hecho se cumplen por medio de Jesucristo. Por eso, cuando alabamos a Dios por medio de Jesucristo, decimos Amén.','2 Corintios 1:20 (TLA)'],
 ['Ya no eres esclavo, sino hijo y heredero','Ustedes ya no son como los esclavos de cualquier familia, sino que son hijos de Dios. Y como son sus hijos, gracias a él tienen derecho a recibir su herencia.','Gálatas 4:7 (TLA)'],
 ['Él terminará la obra que comenzó','Dios empezó el buen trabajo en ustedes, y estoy seguro de que lo irá perfeccionando hasta el día en que Jesucristo vuelva.','Filipenses 1:6 (TLA)'],
 ['Todo lo puedo en Cristo','Cristo me da fuerzas para enfrentarme a toda clase de situaciones.','Filipenses 4:13 (TLA)'],
 ['Fiel es el que os llama','Él los eligió para ser parte de su pueblo, y hará todo esto porque siempre cumple lo que promete.','1 Tesalonicenses 5:24 (TLA)'],
 ['Acerquémonos confiadamente al trono de gracia','Así que, cuando tengamos alguna necesidad, acerquémonos con confianza al trono de Dios. Él nos ayudará, porque es bueno y nos ama.','Hebreos 4:16 (TLA)'],
 ['No te desampararé','No vivan preocupados por tener más dinero. Estén contentos con lo que tienen, porque Dios ha dicho en la Biblia: Nunca te dejaré desamparado.','Hebreos 13:5 (TLA)'],
 ['Si alguno tiene falta de sabiduría','Si alguno de ustedes no tiene sabiduría, pídasela a Dios. Él se la da a todos en abundancia, sin echarles nada en cara.','Santiago 1:5 (TLA)'],
 ['Preciosas y grandísimas promesas','Dios utilizó su poder para darnos todo lo que necesitamos, y para que vivamos como él quiere. Dios nos dio todo eso cuando nos hizo conocer a Jesucristo. Por medio de él, nos eligió para que seamos parte de su reino maravilloso. Además, nos ha dado todas las cosas importantes y valiosas que nos prometió. Por medio de ellas, ustedes podrán ser como Dios y no como la gente pecadora de este mundo, porque los malos deseos de esa gente destruyen a los demás.','2 Pedro 1:3-4 (TLA)'],
 ['Si pedimos conforme a su voluntad','Confiamos en Dios, pues sabemos que él nos oye, si le pedimos algo que a él le agrada. Y así como sabemos que él oye nuestras oraciones, también sabemos que ya nos ha dado lo que le hemos pedido.','1 Juan 5:14-15 (TLA)'],
 ['Te toma de la mano','Israelitas, yo soy su Dios y los he tomado de la mano; no deben tener miedo, porque cuentan con mi ayuda.','Isaías 41:13 (TLA)'],
 ['Su bondad te acompaña','Estoy completamente seguro de que tu bondad y tu amor me acompañarán mientras yo viva, y de que para siempre viviré donde tú vives.','Salmo 23:6 (TLA)'],
 ['En su presencia hay alegría','Tú me enseñaste a vivir como a ti te gusta. ¡En tu presencia soy muy feliz! ¡A tu lado soy siempre dichoso!','Salmo 16:11 (TLA)'],
 ['Él hace lo que le pides','Yo haré todo lo que ustedes me pidan. De ese modo haré que la gente vea, a través de mí, el poder que tiene Dios el Padre.','Juan 14:13 (TLA)'],
 ['Dios salva a los que lo reconocen','Pues la Biblia también dice: Dios salvará a los que lo reconozcan como su Dios.','Romanos 10:13 (TLA)'],
 ['Nunca te fallará','Nadie podrá derrotarte jamás, porque yo te ayudaré, así como ayudé a Moisés. Nunca te fallaré ni te abandonaré.','Josué 1:5 (TLA)'],
 ['Dios mismo es tu guía','Dios mismo será tu guía, y te ayudará en todo; él jamás te abandonará. ¡Echa fuera el miedo y la cobardía!','Deuteronomio 31:8 (TLA)'],
];
let versIdx=-1, versOcultoDesde=0, versUltimo=0;
function leerVistos(){
  try{ const a=JSON.parse(localStorage.getItem('lfh.versVistos')||'[]'); return Array.isArray(a)?a.filter(i=>Number.isInteger(i)&&i>=0&&i<VERSICULOS.length):[]; }
  catch(e){ return []; }
}
function guardarVistos(a){ try{ localStorage.setItem('lfh.versVistos',JSON.stringify(a)); }catch(e){} }
// Elige un versículo al azar entre los que todavía no se mostraron (cuando se agotan, vuelve a empezar sin repetir el último).
function nuevoVersiculo(){
  const N=VERSICULOS.length; let vistos=leerVistos();
  if(vistos.length>=N) vistos=vistos.slice(-1);
  let libres=[]; for(let i=0;i<N;i++) if(!vistos.includes(i)&&i!==versIdx) libres.push(i);
  if(!libres.length) for(let i=0;i<N;i++) if(i!==versIdx) libres.push(i);
  versIdx=libres[Math.floor(Math.random()*libres.length)];
  vistos.push(versIdx); guardarVistos(vistos); versUltimo=Date.now(); renderVersiculo();
}
function renderVersiculo(){
  const v=VERSICULOS[versIdx]; if(!v) return;
  $('#vsTitle').textContent=v[0]; $('#vsText').textContent='“'+v[1]+'”'; $('#vsRef').textContent='— '+v[2];
}
$('#vsOtro').addEventListener('click',nuevoVersiculo);
/* El versículo cambia solo cada 5 minutos mientras la app está abierta a la vista; "Ver otro" lo cambia cuando quieras y reinicia la cuenta. */
const VERS_CADA_MS=5*60*1000;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ versOcultoDesde=Date.now(); return; }
  if(versOcultoDesde && Date.now()-versOcultoDesde>=VERS_CADA_MS && !$('#versiculo').hidden) nuevoVersiculo();
});
setInterval(()=>{ if(!document.hidden && !$('#versiculo').hidden && Date.now()-versUltimo>=VERS_CADA_MS) nuevoVersiculo(); },15000);

/* ---------- Calendario de notas ---------- */
let notas=[], unsubNotas=null, calY=null, calM=null, calSel=null;
const NOTA_RE=/^\d{4}-\d{2}-\d{2}$/;
const notasCol=()=>FS.collection(db,'hogares',hogarId,'notas');
const notaRef=id=>FS.doc(db,'hogares',hogarId,'notas',id);
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const DOW=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
function startNotas(){
  stopNotas();
  try{
    unsubNotas=FS.onSnapshot(notasCol(),snap=>{
      notas=snap.docs.map(d=>{ const x=d.data()||{}; return {id:d.id,fecha:String(x.fecha||''),texto:String(x.texto||''),hecho:x.hecho===true,creado:Number(x.creado)||0,
        tipo:typeof x.tipo==='string'?x.tipo.slice(0,40):'',monto:(typeof x.monto==='number'&&isFinite(x.monto))?x.monto:null,exportada:x.exportada===true}; })
        .filter(n=>NOTA_RE.test(n.fecha)&&n.texto);
      notasListas=true; renderVenc(); generarRepetidos();
      const a=document.activeElement;
      if(tab==='cal' && !(a&&a.id==='calInput'&&a.value)) renderCal();
    },()=>{});
  }catch(e){}
}
function stopNotas(){ notasListas=false; if(unsubNotas){ try{unsubNotas();}catch(e){} unsubNotas=null; } notas=[]; }
function buildCal(){ const v=el('div'); v.id='view-cal'; v.hidden=true; return v; }
const PAGOS_FIJOS=['Alquiler','Expensas','Condominio','Seguro personal','Seguro del auto','Renta del teléfono','Plan de internet','Agua','Luz','Gas','ABL'];
function notaDatos(n){
  const o={fecha:n.fecha,texto:n.texto,hecho:n.hecho,creado:n.creado};
  if(n.tipo){ o.tipo=n.tipo; o.exportada=n.exportada===true; if(n.monto!=null) o.monto=n.monto; }
  return o;
}
async function addPagoFijo(tipo,nombre,monto,repite){
  nombre=String(nombre||'').trim().slice(0,100);
  const esOtros=tipo==='Otros';
  if(esOtros&&!nombre){ toast('Escribe el nombre del pago'); return false; }
  const texto=esOtros?nombre:tipo;
  const n={id:uid(),fecha:calSel,texto,hecho:false,creado:Date.now(),tipo:esOtros?'Otros':tipo,monto:monto,exportada:false};
  notas.push(n); renderCal();
  try{ await FS.setDoc(notaRef(n.id),notaDatos(n));
    if(repite){ extras.repetidos.push({id:uid(),tipo:n.tipo,texto:n.texto,monto:n.monto,dia:Number(calSel.slice(8,10)),generado:calSel.slice(0,7)}); await saveExtras(); generarRepetidos(); }
    return true; }
  catch(e){ notas=notas.filter(x=>x.id!==n.id); toast('No se pudo guardar el pago'); renderCal(); return false; }
}
function periodoDeFecha(f){
  const d=Number(f.slice(8,10));
  if(QS.length===1) return QS[0];
  if(QS.length===2) return d<=15?QS[0]:QS[1];
  return d<=7?QS[0]:d<=14?QS[1]:d<=21?QS[2]:QS[3];
}
async function exportarPagoFijo(n){
  const id=n.fecha.slice(0,7);
  if(!months[id]){ toast('Ese mes no está creado todavía. Créalo en Resumen y vuelve a intentarlo.'); return; }
  const q=periodoDeFecha(n.fecha), qd=months[id][q];
  if(!qd){ toast('No se encontró el período de ese mes'); return; }
  const msg='¿Pasar "'+n.texto+'"'+(n.monto!=null?' por '+cf.format(n.monto):'')+' a Egresos fijos de '+monthLabel(id)+'?';
  if(!window.confirm(msg)) return;
  const row=blank('egresos'); row.n=n.texto; row.m=n.monto; row.cat=(n.tipo==='Otros')?'':(n.tipo==='Agua'||n.tipo==='Luz'||n.tipo==='Gas'||n.tipo==='Plan de internet'||n.tipo==='Renta del teléfono')?'Servicios':(n.tipo==='Seguro del auto')?'Transporte':(n.tipo==='Seguro personal')?'Salud':'Vivienda';
  const i=qd.egresos.findIndex(r=>isBlank(r,'egresos'));
  if(i>=0) qd.egresos.splice(i,0,row); else qd.egresos.push(row);
  padSec(qd,'egresos');
  markDirty(id);
  if(id===cur){ try{ render(); }catch(e){} }
  n.exportada=true; renderCal();
  try{ await FS.setDoc(notaRef(n.id),notaDatos(n)); }catch(e){ n.exportada=false; toast('Se agregó, pero no se pudo marcar como exportado'); renderCal(); return; }
  toast('Agregado a Egresos fijos');
}
async function addNota(texto){
  texto=String(texto||'').trim().slice(0,500); if(!texto) return;
  const n={id:uid(),fecha:calSel,texto,hecho:false,creado:Date.now(),tipo:'',monto:null,exportada:false};
  notas.push(n); renderCal(true);
  try{ await FS.setDoc(notaRef(n.id),notaDatos(n)); }
  catch(e){ notas=notas.filter(x=>x.id!==n.id); toast('No se pudo guardar la nota'); renderCal(true); }
}
async function toggleNota(n){
  n.hecho=!n.hecho; renderCal();
  try{ await FS.setDoc(notaRef(n.id),notaDatos(n)); }
  catch(e){ n.hecho=!n.hecho; toast('No se pudo guardar el cambio'); renderCal(); }
}
async function delNota(n){
  const prev=notas.slice(); notas=notas.filter(x=>x.id!==n.id); renderCal();
  try{ await FS.deleteDoc(notaRef(n.id)); }
  catch(e){ notas=prev; toast('No se pudo borrar la nota'); renderCal(); }
}
function renderCal(focusInput){
  const v=document.getElementById('view-cal'); if(!v) return;
  const hoy=new Date(), hoyS=ymd(hoy);
  if(calY==null){ calY=hoy.getFullYear(); calM=hoy.getMonth(); }
  if(!calSel) calSel=hoyS;
  v.replaceChildren();
  const byDay={}; notas.forEach(n=>{ (byDay[n.fecha]=byDay[n.fecha]||[]).push(n); });
  Object.values(byDay).forEach(a=>a.sort((x,y)=>x.creado-y.creado));
  // --- mes ---
  const c=el('section','card');
  const h=el('header'); const h2=el('h2'); h2.textContent=MESES[calM]+' '+calY; h.append(h2);
  const nav=el('div','calNav');
  const mkb=(txt,lab,fn)=>{ const b=el('button','btn'); b.type='button'; b.textContent=txt; b.setAttribute('aria-label',lab); b.addEventListener('click',fn); return b; };
  nav.append(
    mkb('◀','Mes anterior',()=>{ calM--; if(calM<0){calM=11;calY--;} renderCal(); }),
    mkb('Hoy','Ir a hoy',()=>{ calY=hoy.getFullYear(); calM=hoy.getMonth(); calSel=hoyS; renderCal(); }),
    mkb('▶','Mes siguiente',()=>{ calM++; if(calM>11){calM=0;calY++;} renderCal(); }));
  h.append(nav); c.append(h);
  const grid=el('div','calGrid');
  DOW.forEach(d=>{ const s=el('div','calDow'); s.textContent=d; grid.append(s); });
  const lead=(new Date(calY,calM,1).getDay()+6)%7, dim=new Date(calY,calM+1,0).getDate();
  for(let i=0;i<lead;i++) grid.append(el('div','calEmpty'));
  for(let d=1;d<=dim;d++){
    const ds=calY+'-'+String(calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const list=byDay[ds]||[];
    const b=el('button','calDay'+(ds===hoyS?' today':'')+(ds===calSel?' sel':'')); b.type='button';
    const nm=el('span','calNum'); nm.textContent=d; b.append(nm);
    if(list.length){
      const cnt=el('span','calCnt'); cnt.textContent=list.length; b.append(cnt);
      const sn=el('span','calSnip'); sn.textContent=list[0].texto; b.append(sn);
    }
    b.setAttribute('aria-label',d+' de '+MESES[calM]+(list.length?(', '+list.length+(list.length===1?' nota':' notas')):''));
    b.addEventListener('click',()=>{ calSel=ds; renderCal(true); });
    grid.append(b);
  }
  c.append(grid); v.append(c);
  // --- día elegido ---
  const sp=calSel.split('-').map(Number);
  const sdt=new Date(sp[0],sp[1]-1,sp[2]);
  let tit=sdt.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); tit=tit.charAt(0).toUpperCase()+tit.slice(1);
  const p=el('section','card'); p.style.marginTop='16px';
  const ph=el('header'); const pt=el('h2'); pt.textContent=tit; ph.append(pt); p.append(ph);
  const dl=byDay[calSel]||[];
  if(!dl.length){ const e=el('p','small'); e.style.padding='4px'; e.textContent='No hay notas para este día. Escribe una abajo.'; p.append(e); }
  dl.forEach(n=>{
    const r=el('div','notaRow'+(n.hecho?' hecha':''));
    const cb=el('input'); cb.type='checkbox'; cb.checked=n.hecho; cb.setAttribute('aria-label','Marcar como hecha'); cb.addEventListener('change',()=>toggleNota(n));
    const tx=el('span','notaTxt'); tx.textContent=n.texto+(n.tipo&&n.monto!=null?' — '+cf.format(n.monto):'')+(n.id.startsWith('rep_')?' 🔁':'');
    r.append(cb,tx);
    if(n.tipo){
      if(n.exportada){ const ok=el('span','small'); ok.textContent='✓ En egresos fijos'; r.append(ok); }
      else { const eb=el('button','btn'); eb.type='button'; eb.textContent='Pasar a egresos fijos'; eb.addEventListener('click',()=>exportarPagoFijo(n)); r.append(eb); }
    }
    r.append(delBtn(()=>delNota(n))); p.append(r);
  });
  const add=el('div','notaAdd');
  const inp=el('input','txt'); inp.type='text'; inp.id='calInput'; inp.maxLength=500; inp.placeholder='Ej: Vence la tarjeta, pagar el seguro del auto…'; inp.setAttribute('aria-label','Nueva nota'); inp.autocomplete='off';
  const go=el('button','btn primary'); go.type='button'; go.textContent='Agregar nota';
  const enviar=()=>{ const tx=inp.value; inp.value=''; addNota(tx); };
  go.addEventListener('click',enviar);
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); enviar(); } });
  add.append(inp,go); p.append(add);
  // --- pago fijo ---
  const pf=el('div','notaAdd pagoFijo');
  const pfl=el('p','small'); pfl.style.width='100%'; pfl.style.margin='14px 0 0'; pfl.innerHTML='<b>Agendar un pago fijo</b> (servicios, alquiler, etc.)'; p.append(pfl);
  const sel=el('select','txt'); sel.id='pfTipo'; sel.setAttribute('aria-label','Tipo de pago fijo');
  PAGOS_FIJOS.concat(['Otros']).forEach(t=>{ const o=el('option'); o.value=t; o.textContent=t==='Otros'?'Otros (escribir nombre)':t; sel.append(o); });
  const nm=el('input','txt'); nm.type='text'; nm.maxLength=100; nm.placeholder='Nombre del pago'; nm.setAttribute('aria-label','Nombre del pago'); nm.hidden=true; nm.autocomplete='off';
  const mo=el('input','txt'); mo.type='text'; mo.inputMode='decimal'; mo.placeholder='Monto (opcional)'; mo.setAttribute('aria-label','Monto del pago'); mo.autocomplete='off';
  const rl=el('label'); rl.style.cssText='width:100%; display:flex; gap:8px; align-items:center; font-size:14px'; const rc=el('input'); rc.type='checkbox'; rc.id='pfRepite'; rl.append(rc,'Se repite todos los meses');
  const gp=el('button','btn primary'); gp.type='button'; gp.textContent='Agendar pago';
  sel.addEventListener('change',()=>{ nm.hidden=sel.value!=='Otros'; if(!nm.hidden) nm.focus(); });
  gp.addEventListener('click',async()=>{
    const m=parseMoney(mo.value);
    if(Number.isNaN(m)||(m!=null&&m<0)){ toast('Revisa el monto'); return; }
    await addPagoFijo(sel.value,nm.value,m,rc.checked);
  });
  pf.append(sel,nm,mo,rl,gp); p.append(pf); v.append(p);
  // --- próximas ---
  const prox=notas.filter(n=>!n.hecho&&n.fecha>=hoyS).sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:a.creado-b.creado).slice(0,8);
  const q=el('section','card'); q.style.marginTop='16px';
  const qh=el('header'); const qt=el('h2'); qt.textContent='Próximas notas'; qh.append(qt); q.append(qh);
  if(!prox.length){ const e=el('p','small'); e.style.padding='4px'; e.textContent='No tienes notas pendientes desde hoy en adelante.'; q.append(e); }
  prox.forEach(n=>{
    const pp=n.fecha.split('-').map(Number);
    const r=el('button','notaProx'); r.type='button';
    const f=el('b'); f.textContent=String(pp[2]).padStart(2,'0')+'/'+String(pp[1]).padStart(2,'0')+'/'+pp[0];
    const tx=el('span'); tx.textContent=n.texto+(n.tipo&&n.monto!=null?' — '+cf.format(n.monto):''); r.append(f,tx);
    r.addEventListener('click',()=>{ calSel=n.fecha; calY=pp[0]; calM=pp[1]-1; renderCal(); window.scrollTo(0,0); });
    q.append(r);
  });
  v.append(q);
  v.append(repetidosCard());
  if(focusInput) inp.focus();
}

