'use strict';
/* Facturas y tickets de supermercado (foto o PDF) → líneas de Compras.
   Todo se lee DENTRO del teléfono: fotos con el lector de texto (Tesseract, vendor/tesseract) y PDF con pdf.js (vendor/pdfjs).
   Nada se envía a ningún servidor. La persona revisa y corrige antes de agregar; la lista de Compras se ordena sola de la A a la Z. */

/* ---------- Texto del ticket → renglones (sin DOM, probado en tests/calculos.test.js) ---------- */
const TK_DINERO=/-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)|-?\d+[.,]\d{2}(?!\d)/g;
const TK_SALTAR=/\b(cuit|c\.?u\.?i\.?t|iva|i\.v\.a|subtotal|sub total|total|efectivo|tarjeta|debito|d[eé]bito|credito|cr[eé]dito|vuelto|cambio|descuento|desc\.?|ahorro|promo|ticket|factura|cae|caja|cajero|sucursal|fecha|hora|nro|n[°º]|tel[eé]?fono|www|gracias|cliente|monotributo|consumidor final|responsable|redondeo|percepci[oó]n|impuesto|ingresos brutos|comprobante|punto de venta|pos\b|cod\.?\s*autoriz|lote|cupon|cup[oó]n|items?|art[ií]culos?\s*:?\s*\d+|descripci[oó]n|cantidad|importe|p\.?\s*unit|precio unit)/i;
function tkNum(s){ const n=parseMoney(String(s).replace(/^-/,'')); return (n==null||Number.isNaN(n))?null:n; }
function tkDinero(linea){ return (String(linea).match(TK_DINERO)||[]).map(x=>({txt:x,v:tkNum(x),neg:x[0]==='-'})).filter(x=>x.v!=null); }
function tkNombre(s){
  s=String(s||'').replace(/^\W*\d{5,14}\s+/,'').replace(/\s+\d{5,14}\s*$/,'')           /* códigos de barras al principio o al final */
    .replace(/\b\d{1,2}[,.]\d{1,2}\s*%/g,'').replace(/\(\s*\d+[,.]?\d*\s*%?\s*\)/g,'')  /* "21%" o "(21,00)" de IVA */
    .replace(/[|_~=*#]+/g,' ').replace(/\s{2,}/g,' ').replace(/^[\s.,:;\-–]+|[\s.,:;\-–]+$/g,'').trim();
  if(s.length>60) s=s.slice(0,60).trim();
  s=s.toLocaleLowerCase('es');
  return capIni(s);
}
function tkTieneLetras(s){ return (String(s).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g)||[]).length>=3; }
/* Convierte cantidad × unitario en el formato de Compras: precio de UNA unidad × unidades (1 a 12). Si no cabe, 1 unidad por el total de la línea. */
function tkRenglon(nombre,cant,unit,total){
  let u=1,m=total;
  if(cant!=null&&Number.isInteger(cant)&&cant>=1&&cant<=12&&unit!=null){ u=cant; m=unit; }
  return {n:nombre,u,m};
}
function parsearTicket(texto){
  const lin=String(texto||'').replace(/\r/g,'').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
  const out={renglones:[],total:null,sugerido:'',omitidas:0};
  /* total del ticket: la línea "TOTAL" que no sea "SUBTOTAL" */
  for(let i=lin.length-1;i>=0;i--){
    if(/^(?!.*sub\s*total)(?:.*\b)?(total|importe total|total a pagar)\b/i.test(lin[i])){ const d=tkDinero(lin[i]).filter(x=>!x.neg); if(d.length){ out.total=d[d.length-1].v; break; } }
  }
  /* establecimiento: una cadena conocida en las primeras líneas, o la primera línea con nombre */
  const cab=lin.slice(0,8);
  const conocida=CADENAS.find(c=>cab.some(l=>normTxt(l).includes(normTxt(c))&&normTxt(c).length>=3));
  if(conocida) out.sugerido=conocida;
  else { const p=cab.find(l=>tkTieneLetras(l)&&!TK_SALTAR.test(l)&&!/\d{6,}/.test(l)); if(p) out.sugerido=capIni(p.toLocaleLowerCase('es').slice(0,40)); }
  const items=[]; let pendiente=null;
  const cierra=()=>{ pendiente=null; };
  for(let i=0;i<lin.length;i++){
    const l=lin[i], d=tkDinero(l);
    /* "3 x 900,00   2.700,00" o "0,850 kg x 1.500,00  1.275,00" (cantidad en una línea aparte, el nombre estaba arriba) */
    const mq=/^(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|gr|g|lt|lts|l|un|u|uni|unid)?\.?\s*(?:x|\*)\s*(-?\d[\d.,]*)/i.exec(l);
    if(mq&&pendiente&&d.length>=1){
      const cant=tkNum(mq[1]), unit=tkNum(mq[2]), tot=d[d.length-1].v;
      if(!d[d.length-1].neg&&tot>0){ items.push(tkRenglon(pendiente,cant,unit,tot)); }
      cierra(); continue;
    }
    if(TK_SALTAR.test(l)){ cierra(); if(!d.length||!/total|subtotal/i.test(l)) { /* descuentos, medios de pago, datos fiscales */ } continue; }
    if(d.length===0){
      /* línea con solo el nombre del producto: el precio puede venir en la línea de abajo */
      pendiente=(tkTieneLetras(l)&&!/\d{8,}\s*$/.test(l)&&l.length>=3&&l.length<=60)?tkNombre(l):null; continue;
    }
    const ult=d[d.length-1]; if(ult.neg||ult.v<=0){ cierra(); continue; }
    /* "NOMBRE  2 x 1.250,00  2.500,00" en una sola línea */
    const m1=/^(?:\W*\d{5,14}\s+)?(.*?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*?)\s+(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|un|u|uni|unid)?\.?\s*(?:x|\*)\s*(-?\d[\d.,]*)\s+(-?\d[\d.,]*)\s*$/i.exec(l);
    if(m1){ const nom=tkNombre(m1[1]); if(tkTieneLetras(nom)){ items.push(tkRenglon(nom,tkNum(m1[2]),tkNum(m1[3]),ult.v)); cierra(); continue; } }
    /* "NOMBRE  1.800,50" (una unidad) */
    const m2=l.slice(0,l.lastIndexOf(ult.txt)).trim();
    const nom=tkNombre(m2);
    if(tkTieneLetras(nom)){ items.push({n:nom,u:1,m:ult.v}); cierra(); }
    else { cierra(); out.omitidas++; }
  }
  out.renglones=items;
  return out;
}

/* ---------- PDF: texto por posición (sin DOM salvo el lector) ---------- */
/* Une los fragmentos de texto de una página en líneas, de arriba hacia abajo y de izquierda a derecha */
function pdfFragmentosALineas(frags){
  const f=frags.filter(x=>x&&typeof x.str==='string'&&x.str.trim()!=='').map(x=>({s:x.str,x:x.x,y:x.y}));
  f.sort((a,b)=>b.y-a.y||a.x-b.x);
  const lineas=[]; let cur=null;
  f.forEach(t=>{
    if(!cur||Math.abs(cur.y-t.y)>3){ cur={y:t.y,items:[]}; lineas.push(cur); }
    cur.items.push(t);
  });
  return lineas.map(l=>l.items.sort((a,b)=>a.x-b.x).map(t=>t.s.trim()).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
}

/* ---------- Pantalla: lectura de la foto o del PDF ---------- */
let pdfjsListo=null;
async function pdfjsCargar(){
  if(window.pdfjsLib) return window.pdfjsLib;
  if(!pdfjsListo) pdfjsListo=(async()=>{
    const base=new URL('vendor/pdfjs/',document.baseURI).href;
    await ocrCargarScript(base+'pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.js';
    return window.pdfjsLib;
  })().catch(e=>{ pdfjsListo=null; throw e; });
  return pdfjsListo;
}
/* Devuelve el texto de un PDF. Si una página no trae texto (PDF escaneado), la dibuja y la lee con el lector de imágenes. */
async function leerPDFTexto(file,avance){
  const lib=await pdfjsCargar();
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:false}).promise;
  const paginas=[]; const maxP=Math.min(pdf.numPages,6);
  for(let n=1;n<=maxP;n++){
    if(avance) avance('Leyendo página '+n+' de '+maxP+'…');
    const page=await pdf.getPage(n);
    const tc=await page.getTextContent();
    let lineas=pdfFragmentosALineas(tc.items.map(it=>({str:it.str,x:it.transform[4],y:it.transform[5]})));
    if(lineas.join(' ').length<40){
      const vp=page.getViewport({scale:2}); const c=document.createElement('canvas'); c.width=Math.round(vp.width); c.height=Math.round(vp.height);
      const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);
      await page.render({canvasContext:g,viewport:vp}).promise;
      const w=await ocrIniciar(); const r=await w.recognize(c); lineas=String((r&&r.data&&r.data.text)||'').split('\n');
    }
    paginas.push(lineas.join('\n'));
  }
  try{ ocrApagar(); }catch(e){}
  return paginas.join('\n');
}
async function leerTicketArchivo(file,avance){
  const esPDF=/pdf$/i.test(file.type||'')||/\.pdf$/i.test(file.name||'');
  if(esPDF) return leerPDFTexto(file,avance);
  if(avance) avance('Leyendo el ticket en tu teléfono… (la primera vez puede tardar un poco)');
  return leerComprobante(file);
}

/* Ventana de revisión: establecimiento, renglones editables, total contra el del ticket */
function revisarTicket(q,res){
  const body=el('div'); body.className='tkForm';
  const aviso=el('p','small'); body.append(aviso);
  /* establecimiento */
  const selC=el('select'); selC.setAttribute('aria-label','Supermercado o establecimiento');
  [['','Elige el establecimiento…'],...CADENAS.map(x=>[x,x]),['Otros','Otro (escribirlo)']].forEach(([v,t])=>{ const o=el('option'); o.value=v; o.textContent=t; selC.append(o); });
  const inOtra=el('input','txt'); inOtra.type='text'; inOtra.placeholder='Nombre del establecimiento'; inOtra.maxLength=40; inOtra.setAttribute('aria-label','Nombre del establecimiento'); inOtra.hidden=true;
  const sug=res.sugerido||'';
  const conocida=CADENAS.find(c=>normTxt(c)===normTxt(sug));
  if(conocida) selC.value=conocida; else if(sug){ selC.value='Otros'; inOtra.value=sug; inOtra.hidden=false; }
  selC.addEventListener('change',()=>{ inOtra.hidden=selC.value!=='Otros'; });
  const lc=el('label'); lc.style.cssText='display:grid; gap:4px; font-weight:600; font-size:13px; margin:8px 0'; lc.append('Supermercado o establecimiento',selC,inOtra);
  body.append(lc);
  /* renglones */
  const filas=res.renglones.map(r=>({...r,on:true}));
  const lst=el('div'); lst.style.cssText='max-height:36vh; overflow:auto; display:grid; gap:8px';
  const tot=el('p','small'); tot.style.fontWeight='600';
  const pintarTotales=()=>{
    const suma=filas.filter(f=>f.on).reduce((s,f)=>s+num(f.m)*f.u,0);
    let t='Suma de lo marcado: '+cf.format(suma)+'.';
    if(res.total!=null){ const d=Math.round((suma-res.total)*100)/100; t+=' El ticket dice '+cf.format(res.total)+(Math.abs(d)<0.01?' ✓ coincide.':' · diferencia de '+cf.format(Math.abs(d))+': revisa precios, cantidades o renglones que faltan.'); }
    tot.textContent=t;
  };
  filas.forEach(f=>{
    const r=el('div'); r.style.cssText='display:grid; grid-template-columns:auto minmax(0,1fr) minmax(0,1fr); gap:6px; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--line)';
    const ck=el('input'); ck.type='checkbox'; ck.checked=true; ck.setAttribute('aria-label','Incluir'); ck.style.cssText='width:22px; height:22px'; ck.addEventListener('change',()=>{ f.on=ck.checked; pintarTotales(); });
    const n=el('input','txt'); n.type='text'; n.value=f.n; n.setAttribute('aria-label','Producto'); n.addEventListener('change',()=>{ f.n=capIni(n.value.trim()); });
    const u=el('input','txt num'); u.type='text'; u.inputMode='numeric'; u.value=String(f.u); u.setAttribute('aria-label','Unidades'); u.addEventListener('change',()=>{ const v=Math.round(Number(u.value)); f.u=(v>=1&&v<=12)?v:1; u.value=String(f.u); pintarTotales(); });
    const m=el('input','txt num'); m.type='text'; m.inputMode='decimal'; m.value=fmt(f.m); m.setAttribute('aria-label','Precio de una unidad'); m.addEventListener('change',()=>{ const v=parseMoney(m.value); f.m=(v==null||Number.isNaN(v))?null:v; m.value=fmt(f.m); pintarTotales(); });
    ck.style.gridRow='1 / span 2'; n.style.gridColumn='2 / span 2'; r.append(ck,n,u,m); lst.append(r);
  });
  const cab=el('p','small'); cab.style.margin='4px 0 0'; cab.textContent='Cada producto: nombre, y abajo unidades y precio de UNA unidad.';
  body.append(cab,lst,tot);
  const lab=el('label'); lab.style.cssText='display:flex; gap:8px; align-items:flex-start; margin:10px 0; font-size:14px';
  const ckOk=el('input'); ckOk.type='checkbox'; ckOk.checked=true; ckOk.style.cssText='width:22px; height:22px; margin-top:2px'; ckOk.setAttribute('data-nocap','');
  lab.append(ckOk,document.createTextNode('Marcarlos como comprados ✓ (el precio queda como “último precio” de cada artículo)')); body.append(lab);
  pintarTotales();
  aviso.textContent='Encontré '+filas.length+(filas.length===1?' renglón':' renglones')+'. Corrige lo que haga falta, desmarca lo que no sea un producto y elige el establecimiento. Se agregan a la lista de '+qname(q)+' y quedan ordenados de la A a la Z.';
  modal('Cargar ticket o factura',body,[
    {label:'Cancelar'},
    {label:'Agregar a la lista',cls:'primary',onClick:()=>{
      const elegidas=filas.filter(f=>f.on&&String(f.n||'').trim());
      if(!elegidas.length){ toast('No hay renglones marcados'); return false; }
      const est=selC.value==='Otros'?capIni(inOtra.value.trim()):selC.value;
      if(!est){ toast('Elige el supermercado o escribe el establecimiento'); selC.focus(); return false; }
      const arr=months[cur][q].compras; while(arr.length && compraBlank(arr[arr.length-1])) arr.pop();
      elegidas.forEach(l=>{
        const row=normCompra({n:l.n,m:l.m,u:l.u}); setChainFrom(row,est);
        lookupCompra(row); row.ok=ckOk.checked;
        if(row.ok && row.cadena && !(row.cadena==='Otros'&&!String(row.otra).trim()) && num(row.m)>0) upsertCat(row.n,chainName(row),num(row.m));
        arr.push(row);
      });
      renderCompras(q); markDirty(); toast('Se agregaron '+elegidas.length+' producto'+(elegidas.length===1?'':'s')+' de '+est);
    }}
  ]);
}
async function cargarTicket(q,file){
  const msg=el('p','small'); msg.setAttribute('role','status'); msg.textContent='Preparando…';
  modal('Leyendo ticket',msg,[{label:'Cancelar',onClick:()=>{ tkCancelado=true; }}]);
  tkCancelado=false;
  try{
    const txt=await leerTicketArchivo(file,t=>{ msg.textContent=t; });
    if(tkCancelado) return;
    const res=parsearTicket(txt);
    closeModal();
    if(!res.renglones.length){
      toast('No pude reconocer productos en ese ticket. Prueba con una foto más nítida y de frente, un PDF, o usa el CSV.');
      return;
    }
    revisarTicket(q,res);
  }catch(e){
    if(tkCancelado) return;
    closeModal();
    toast('No se pudo leer el archivo ('+(e&&e.message?e.message:'error')+'). Revisa tu conexión la primera vez o prueba con otra foto.');
  }
}
let tkCancelado=false;
