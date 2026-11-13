'use strict';
/* Filas editables y vistas principales (Resumen, quincenas, Herramientas) */
/* ---------- Filas editables ---------- */
function txtInput(val,ph,onChange){
  const i=el('input'); i.type='text'; i.value=val; i.placeholder=ph; i.setAttribute('aria-label',ph); i.autocomplete='off';
  i.addEventListener('change',()=>onChange(i.value.trim(),i));
  return i;
}
function moneyInput(get,set,live,done,ph){
  const i=el('input','num'); i.type='text'; i.inputMode='decimal'; i.value=fmt(get()); i.placeholder=ph||'Monto';
  i.setAttribute('aria-label',ph||'Monto'); i.autocomplete='off';
  i.addEventListener('focus',()=>i.select());
  i.addEventListener('input',()=>{const v=parseMoney(i.value); if(!Number.isNaN(v)){ set(v); live(); }});
  i.addEventListener('change',()=>{
    const v=parseMoney(i.value);
    if(Number.isNaN(v)){ i.value=fmt(get()); toast('Ese monto no es válido'); return; }
    set(v); i.value=fmt(v); done();
  });
  return i;
}
function delBtn(onClick){
  const b=el('button','x'); b.type='button'; b.textContent='×'; b.title='Quitar esta línea'; b.setAttribute('aria-label','Quitar línea');
  b.addEventListener('click',onClick); return b;
}
function dupBtn(onClick){
  const b=el('button','dup'); b.type='button'; b.textContent='⎘'; b.title='Duplicar esta línea'; b.setAttribute('aria-label','Duplicar línea');
  b.addEventListener('click',onClick); return b;
}
function duplicateRow(q,sec,row){
  const qd=months[cur][q];
  const idx=qd[sec].indexOf(row);
  const copy=normRow(row,sec); copy.id=uid();
  if(sec==='egresos'||sec==='anticipados') copy.pagado=false;
  if(idx>=0) qd[sec].splice(idx+1,0,copy); else qd[sec].push(copy);
  renderList(q,sec); refreshComputed(); markDirty();
  toast('Línea duplicada');
}
const rowFor=(q,sec,row)=>{
  if(sec==='plataformas') return platRow(q,row);
  if(sec==='egresos'||sec==='anticipados') return catRow(q,sec,row);
  if(sec==='retiro') return retiroRow(q,row);
  if(sec==='tarjeta') return tarjetaRow(q,row);
  return simpleRow(q,sec,row);
};

function afterEdit(q,sec,row,rowEl){
  rowEl.classList.toggle('blank',isBlank(row,sec));
  const arr=months[cur][q][sec];
  if(arr[arr.length-1]===row && !isBlank(row,sec)){
    const b=blank(sec); arr.push(b); rowEl.parentNode.appendChild(rowFor(q,sec,b));
  }
  if(sec==='plataformas'){ renderList(q,'egresos'); renderList(q,'ingresos'); }
  if(sec==='anticipados' && document.getElementById(q+'-retiro')){ renderList(q,'retiro'); }
  refreshComputed(); markDirty();
}
function simpleRow(q,sec,row){
  const d=el('div','row r2'+(isBlank(row,sec)?' blank':''));
  d.append(
    txtInput(row.n,'Concepto',v=>{row.n=v; afterEdit(q,sec,row,d);}),
    moneyInput(()=>row.m,v=>{row.m=v;},()=>refreshComputed(),()=>afterEdit(q,sec,row,d)),
    delBtn(()=>removeRow(q,sec,row.id))
  );
  return d;
}
function catSelect(val,onChange){
  const s=el('select'); s.setAttribute('aria-label','Categoría');
  const opt0=el('option'); opt0.value=''; opt0.textContent='Sin categoría'; s.append(opt0);
  CATS.forEach(c=>{const o=el('option'); o.value=c; o.textContent=c; if(c===val) o.selected=true; s.append(o);});
  s.addEventListener('change',()=>onChange(s.value));
  return s;
}
function payBtn(row){
  const b=el('button','pay'); b.type='button';
  const render=()=>{
    const p=row.pagado===true;
    b.textContent=p?'✓':'×';
    b.classList.toggle('paid',p);
    b.title=p?'Pagado — toca para desmarcar':'Sin pagar — toca para marcar como pagado';
    b.setAttribute('aria-label',b.title);
  };
  render();
  b.addEventListener('click',()=>{ row.pagado=row.pagado!==true; render(); markDirty(); });
  return b;
}
function catRow(q,sec,row){
  const d=el('div','row r3'+(isBlank(row,sec)?' blank':''));
  const cn=el('div','c-n'); cn.append(txtInput(row.n,'Concepto',v=>{row.n=v; afterEdit(q,sec,row,d);}));
  const cc=el('div','c-c'); cc.append(catSelect(row.cat,v=>{row.cat=v; afterEdit(q,sec,row,d);}));
  const cm=el('div','c-m'); cm.append(moneyInput(()=>row.m,v=>{row.m=v;},()=>refreshComputed(),()=>afterEdit(q,sec,row,d)));
  const cp=el('div','c-p'); cp.append(payBtn(row));
  const cx=el('div','c-x'); cx.append(dupBtn(()=>duplicateRow(q,sec,row)), delBtn(()=>removeRow(q,sec,row.id)));
  d.append(cn,cc,cm,cp,cx);
  return d;
}
function retiroPickSelect(q,onPick){
  const s=el('select'); s.setAttribute('aria-label','Elegir de Egresos variables');
  const opt0=el('option'); opt0.value=''; opt0.textContent='Elegir de Egresos variables…'; s.append(opt0);
  const items=months[cur][q].anticipados.filter(r=>!isBlank(r,'anticipados') && String(r.n).trim());
  items.forEach(r=>{
    const o=el('option'); o.value=r.id; o.textContent=(r.n||'—')+' — '+cf.format(num(r.m)); s.append(o);
  });
  if(!items.length){ opt0.textContent='No hay gastos cargados en Egresos variables'; }
  s.addEventListener('change',()=>{
    if(!s.value) return;
    const item=items.find(r=>r.id===s.value);
    if(item) onPick(item);
    s.value='';
  });
  return s;
}
function retiroRow(q,row){
  const d=el('div','row rpick'+(isBlank(row,'retiro')?' blank':''));
  const cs=el('div','c-s'); cs.append(retiroPickSelect(q,item=>{
    row.n=String(item.n||''); row.m=(typeof item.m==='number'&&isFinite(item.m))?item.m:null;
    renderList(q,'retiro'); refreshComputed(); markDirty();
  }));
  const cn=el('div','c-n'); cn.append(txtInput(row.n,'Concepto',v=>{row.n=v; afterEdit(q,'retiro',row,d);}));
  const cm=el('div','c-m'); cm.append(moneyInput(()=>row.m,v=>{row.m=v;},()=>refreshComputed(),()=>afterEdit(q,'retiro',row,d)));
  const cx=el('div','c-x'); cx.append(delBtn(()=>removeRow(q,'retiro',row.id)));
  d.append(cs,cn,cm,cx);
  return d;
}
function tcField(label){
  const wrap=el('div','tcField');
  const l=el('label'); l.textContent=label; wrap.append(l);
  const body=el('div'); wrap.append(body);
  return {wrap,body};
}
function tarjetaRow(q,row){
  const box=el('div','tcItem'+(isBlank(row,'tarjeta')?' blank':''));
  const l1=el('div','l1');
  l1.append(txtInput(row.n,'Descripción',v=>{row.n=v; afterEdit(q,'tarjeta',row,box);}));
  l1.append(delBtn(()=>removeRow(q,'tarjeta',row.id)));
  box.append(l1);

  const l2=el('div','l2');

  const totalBox=el('div','amt-ro');
  const syncTotal=()=>{
    if(isBlank(row,'tarjeta')){ totalBox.textContent=''; return; }
    const n=row.cuotas||1;
    totalBox.textContent=cf.format(row.valorCuota!=null?row.valorCuota*n:0);
  };

  const vc=el('input'); vc.type='text'; vc.inputMode='decimal'; vc.placeholder='Valor cuota';
  vc.setAttribute('aria-label','Valor de la cuota'); vc.autocomplete='off'; vc.value=fmt(row.valorCuota);
  vc.addEventListener('focus',()=>vc.select());
  vc.addEventListener('input',()=>{ const v=parseMoney(vc.value); if(!Number.isNaN(v)){ row.valorCuota=v; syncTotal(); } });
  vc.addEventListener('change',()=>{
    const v=parseMoney(vc.value);
    if(Number.isNaN(v)){ vc.value=fmt(row.valorCuota); toast('Ese monto no es válido'); return; }
    row.valorCuota=v; vc.value=fmt(v); syncTotal(); afterEdit(q,'tarjeta',row,box);
  });

  const fMonto=tcField('Monto');
  fMonto.body.append(moneyInput(
    ()=>row.m,
    v=>{
      row.m=v;
      row.valorCuota=(v!=null && row.cuotas>0)?Math.round((v/row.cuotas)*100)/100:null;
      vc.value=fmt(row.valorCuota);
    },
    ()=>{ refreshComputed(); syncTotal(); },
    ()=>afterEdit(q,'tarjeta',row,box),
    'Monto'
  ));

  const fCuotas=tcField('Cuotas');
  const sel=el('select'); sel.setAttribute('aria-label','Cantidad de cuotas');
  CUOTAS_OPC.forEach(n=>{
    const o=el('option'); o.value=String(n); o.textContent=n===1?'Simple':n+' cuotas';
    if(n===(row.cuotas||1)) o.selected=true; sel.append(o);
  });
  sel.addEventListener('change',()=>{
    row.cuotas=Number(sel.value);
    row.valorCuota=(row.m!=null)?Math.round((row.m/row.cuotas)*100)/100:null;
    vc.value=fmt(row.valorCuota); syncTotal(); afterEdit(q,'tarjeta',row,box);
  });
  fCuotas.body.append(sel);

  const fFecha=tcField('1ª cuota');
  const fecha=el('input'); fecha.type='month'; fecha.setAttribute('aria-label','Mes de la primera cuota');
  fecha.value=row.inicio||'';
  fecha.addEventListener('change',()=>{ row.inicio=fecha.value||null; afterEdit(q,'tarjeta',row,box); });
  fFecha.body.append(fecha);

  const fValor=tcField('Valor cuota'); fValor.body.append(vc);
  const fTotal=tcField('Total compra'); fTotal.body.append(totalBox);

  const fCat=tcField('Categoría');
  fCat.body.append(catSelect(row.cat,v=>{row.cat=v; afterEdit(q,'tarjeta',row,box);}));

  l2.append(fMonto.wrap,fCat.wrap,fCuotas.wrap,fFecha.wrap,fValor.wrap,fTotal.wrap);
  box.append(l2);
  syncTotal();
  return box;
}
function tarjetaCarriedItem(it){
  const box=el('div','tcItem tcRO');
  const l1=el('div','l1');
  const nm=el('span'); nm.textContent=it.row.n||'—';
  const tag=el('span','tag'); tag.textContent='Cuota '+it.cuotaNum+'/'+it.totalCuotas;
  const amt=el('span','amt'); amt.textContent=cf.format(it.amount);
  l1.append(nm,tag);
  if(it.row.cat){ const catTag=el('span','tag'); catTag.textContent=it.row.cat; l1.append(catTag); }
  l1.append(amt);
  box.append(l1);
  return box;
}
function platRow(q,p){
  const d=el('div','row rpl'+(isBlank(p,'plataformas')?' blank':''));
  const cn=el('div','c-n'); cn.append(txtInput(p.n,'Plataforma o gasto fijo',v=>{p.n=v; afterEdit(q,'plataformas',p,d);}));
  const cm=el('div','c-m'); cm.append(moneyInput(()=>p.m,v=>{p.m=v;},()=>refreshComputed(),()=>afterEdit(q,'plataformas',p,d)));
  const cr=el('label','chk c-r'); cr.title='Reflejar en Egresos';
  const ck=el('input'); ck.type='checkbox'; ck.checked=p.r!==false; ck.setAttribute('aria-label','Reflejar en Egresos');
  ck.addEventListener('change',()=>{p.r=ck.checked; afterEdit(q,'plataformas',p,d);});
  const sp=el('span'); sp.textContent='En egresos'; cr.append(ck,sp);
  const cx=el('div','c-x'); cx.append(delBtn(()=>removeRow(q,'plataformas',p.id)));
  d.append(cn,cm,cr,cx);
  return d;
}
function autoRow(label,tag,bindAttr,bindVal,payRow){
  const d=el('div','row auto r2');
  const n=el('div','n'); const s=el('span'); s.textContent=label; const t=el('span','tag'); t.textContent=tag; n.append(s,t);
  const a=el('div','amt'); a.setAttribute(bindAttr,bindVal);
  d.append(n,a, payRow?payBtn(payRow):el('span'));
  return d;
}
function renderList(q,sec){
  const host=document.getElementById(q+'-'+sec); if(!host) return;
  const qd=months[cur][q]; padSec(qd,sec);
  host.replaceChildren();
  if(sec==='egresos') autoPlat(qd).forEach(p=>host.append(autoRow(p.n,'Plataformas','data-aut',p.id,p)));
  if(sec==='tarjeta') activeCuotasFor(cur,q).filter(it=>!it.isOrigin).forEach(it=>host.append(tarjetaCarriedItem(it)));
  qd[sec].forEach(r=>host.append(rowFor(q,sec,r)));
  refreshComputed();
}
function removeRow(q,sec,id){
  const qd=months[cur][q];
  qd[sec]=qd[sec].filter(r=>r.id!==id);
  renderList(q,sec);
  if(sec==='plataformas'){ renderList(q,'egresos'); renderList(q,'ingresos'); }
  refreshComputed(); markDirty();
}
function addLine(q,sec){
  months[cur][q][sec].push(blank(sec));
  renderList(q,sec);
  const host=document.getElementById(q+'-'+sec);
  const last=host&&host.lastElementChild&&host.lastElementChild.querySelector('input[type="text"]');
  if(last) last.focus();
}

/* ---------- Vistas ---------- */
function moneyField(label,get,set,ph){
  const wrap=el('div','fijoRow');
  const lab=el('div','fijoLab'); lab.textContent=label; wrap.append(lab);
  const inp=el('input'); inp.type='text'; inp.inputMode='decimal'; inp.className='num'; inp.placeholder=ph||'Monto';
  inp.setAttribute('aria-label',label); inp.autocomplete='off'; inp.value=fmt(get());
  inp.addEventListener('focus',()=>inp.select());
  inp.addEventListener('input',()=>{ const v=parseMoney(inp.value); if(!Number.isNaN(v)){ set(v); refreshComputed(); } });
  inp.addEventListener('change',()=>{
    const v=parseMoney(inp.value);
    if(Number.isNaN(v)){ inp.value=fmt(get()); toast('Ese monto no es válido'); return; }
    set(v); inp.value=fmt(v); refreshComputed(); markDirty();
  });
  wrap.append(inp);
  return {wrap,inp};
}
function payToggleField(getFn,setFn){
  const b=el('button','pay'); b.type='button';
  const render=()=>{
    const p=getFn()===true;
    b.textContent=p?'✓':'×';
    b.classList.toggle('paid',p);
    b.title=p?'Pagado — toca para desmarcar':'Sin pagar — toca para marcar como pagado';
    b.setAttribute('aria-label',b.title);
  };
  render();
  b.addEventListener('click',()=>{ setFn(!(getFn()===true)); render(); markDirty(); });
  return b;
}
function renderSearchResults(term,host){
  if(!host) return;
  term=(term||'').trim().toLowerCase();
  if(!term){ host.innerHTML=''; return; }
  const secLabel={ingresos:'Ingreso fijo',ingresosVar:'Ingreso variable',egresos:'Egreso fijo',anticipados:'Egreso variable',fondo:'Fondo emergencia',retiro:'Retiro efectivo',tarjeta:'Tarjeta crédito'};
  const out=[];
  Object.keys(months).sort().forEach(mId=>{
    QS.forEach(q=>{
      const qd=months[mId][q]; if(!qd) return;
      qd.plataformas.forEach(p=>{ if(String(p.n||'').toLowerCase().includes(term)) out.push({mId,q,sec:'plataformas',n:p.n,m:num(p.m)}); });
      ['ingresos','ingresosVar','egresos','anticipados','fondo','retiro','tarjeta'].forEach(sec=>{
        (qd[sec]||[]).forEach(r=>{
          if(isBlank(r,sec)) return;
          if(String(r.n||'').toLowerCase().includes(term)) out.push({mId,q,sec,n:r.n,m:num(r.m)});
        });
      });
    });
  });
  if(!out.length){ host.innerHTML='<p class="small">Sin resultados.</p>'; return; }
  const rows=out.slice(0,60).map(r=>
    '<div class="searchRow"><span class="searchWhen">'+monthLabel(r.mId)+' · '+qname(r.q)+'</span>'+
    '<span class="searchName">'+(esc(r.n)||'—')+'</span>'+
    '<span class="tag">'+(secLabel[r.sec]||'Plataforma')+'</span>'+
    '<span class="searchAmt">'+cf.format(r.m)+'</span></div>'
  ).join('');
  host.innerHTML = rows + (out.length>60?'<p class="small">Mostrando los primeros 60 resultados.</p>':'');
}
function card(q,sec,title,totalKey,hint){
  const c=el('section','card'); c.dataset.sec=sec;
  const h=el('header'); const t=el('h2'); t.textContent=title;
  const tot=el('span','tot'); tot.setAttribute('data-k',q+'.'+totalKey); h.append(t,tot); c.append(h);
  if(hint){ const p=el('p','hint'); p.innerHTML=hint.replace('{q}',q); c.append(p); }
  const isCat=(sec==='egresos'||sec==='anticipados');
  const isRetiro=sec==='retiro';
  const isTarjeta=sec==='tarjeta';
  if(!isTarjeta){
    const head=el('div','head '+(sec==='plataformas'?'rpl':(isCat?'r3':(isRetiro?'rpick':'r2'))));
    const labels=sec==='plataformas'?['Plataforma','Monto','En egr.']:(isCat?[sec==='egresos'?'Gasto':'Concepto','Categoría','Monto']:(isRetiro?['Elegir de Egresos variables','Concepto','Monto']:['Concepto','Monto']));
    labels.forEach(l=>{const s=el('span'); s.textContent=l; head.append(s);});
    if(sec==='plataformas'){ head.children[2].title='Reflejar en Egresos'; }
    if(isCat){ const sp=el('span'); sp.textContent='Pagado'; head.append(sp); }
    head.append(el('span'));
    c.append(head);
  }
  const list=el('div','list'); list.id=q+'-'+sec; c.append(list);
  const add=el('button','add'); add.type='button'; add.textContent='＋ Agregar línea';
  add.addEventListener('click',()=>addLine(q,sec)); c.append(add);
  return c;
}
function buildQ(q){
  const v=el('div'); v.id='view-'+q; v.hidden=true;
  const k=el('div','kpis');
  k.innerHTML='<div class="kpi"><span>Ingresos totales</span><b data-k="'+q+'.ingresos"></b></div>'+
    '<div class="kpi"><span>Egresos totales</span><b data-k="'+q+'.egresosTotales"></b></div>'+
    '<div class="kpi soft"><span>Balance '+delP()+'</span><b data-k="'+q+'.balance"></b></div>'+
    '<div class="kpi"><span>% gastado</span><b data-k="'+q+'.pct"></b></div>';
  v.append(k);
  const g=el('div','qgrid');
  g.append(
    card(q,'ingresos','Ingresos fijos','ingresosFijos','Puedes cambiar los montos cuando quieras; los ingresos pueden variar.'),
    card(q,'ingresosVar','Ingresos variables','ingresosVar','Cualquier ingreso extra: una changa, una venta, un trabajo puntual…'),
    card(q,'plataformas','Plataformas y suscripciones','platTotal','Netflix, internet, celulares, etc. Lo que anotes acá se refleja en <b>Egresos fijos</b> (puedes destildar "En egresos" si no quieres que cuente).'),
    card(q,'egresos','Egresos fijos','egresos','Los gastos que se repiten cada mes: tú decides cuáles cargar (la cuota de la casa o el alquiler, el seguro del auto, el colegio, los servicios…). Cada hogar es distinto.'),
    card(q,'anticipados','Egresos variables','antic',null)
  );
  v.append(g);
  v.append(card(q,'fondo','Fondo de emergencia','fondo','Lo que apartes acá se resta del balance '+delP()+', como un ahorro aparte.'));
  v.append(card(q,'retiro','Retiro de efectivo por banco','retiro','Elige un gasto de <b>Egresos variables</b> y te completa el concepto y el monto solo (lo puedes ajustar después). Es solo para saber cuánto sacar: no se resta de nuevo del balance, porque ese gasto ya está contado en Egresos fijos o Egresos variables.'));
  const tarjCard=card(q,'tarjeta','Gastos tarjeta de crédito','tarjeta','El valor de la cuota se autocompleta (Monto ÷ cuotas), editalo si el banco cobra interés. Elige el mes de la <b>1ª cuota</b> y las siguientes van a aparecer solas (de solo lectura) en los meses que vengan, hasta agotarse. Entra en el gráfico de torta como "Tarjeta de crédito". Es informativo: no se resta del balance, porque el pago de la tarjeta ya lo cargas aparte en Egresos.');
  const sums=el('div','kpis'); sums.style.cssText='margin:4px 4px 0; gap:10px';
  sums.innerHTML='<div class="kpi" style="padding:10px 12px"><span>Pagos simples</span><b style="font-size:16px" data-k="'+q+'.tarjetaSimple"></b></div>'+
    '<div class="kpi" style="padding:10px 12px"><span>En cuotas</span><b style="font-size:16px" data-k="'+q+'.tarjetaCuotas"></b></div>';
  tarjCard.append(sums);
  v.append(tarjCard);
  return v;
}
function tablaPeriodos(){
  const multi=QS.length>1;
  const row=(label,k,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><td>'+label+'</td>'+QS.map(q=>'<td data-k="'+q+'.'+k+'"></td>').join('')+(multi?'<td data-k="mes.'+k+'"></td>':'')+'</tr>';
  return '<section class="card"><header><h2>'+(multi?'Por '+porP():'Detalle del mes')+'</h2></header><div class="tbl-wrap"><table class="tbl">'+
    '<thead><tr><th></th>'+QS.map(q=>'<th>'+qname(q)+'</th>').join('')+(multi?'<th>Total del mes</th>':'')+'</tr></thead><tbody>'+
    row('Ingresos fijos','ingresosFijos')+row('Ingresos variables','ingresosVar')+row('Ingresos totales','ingresos')+row('Egresos fijos','egresos')+row('Egresos variables','antic')+row('Egresos totales','egresosTotales')+
    row('Fondo de emergencia','fondo')+row('Balance','balance','strong')+row('% gastado','pct')+row('Retiro de efectivo sugerido','retiro')+row('Gastos tarjeta de crédito','tarjeta')+
    '</tbody></table></div></section>';
}
function cambiarPeriodo(nuevo,selEl){
  const prev=periodo; if(nuevo===prev) return;
  const aplicar=async()=>{
    setPeriodo(nuevo);
    if(await saveMoneda(moneda.c)){ render(); toast('Listo: el libro ahora es '+PERIODOS[nuevo].n.toLowerCase()); }
    else { setPeriodo(prev); selEl.value=prev; }
  };
  if(PERIODOS[nuevo].qs.length>=PERIODOS[prev].qs.length){ aplicar(); return; }
  const body=el('div'); const p=el('p');
  p.textContent='Lo que cargaste en los períodos que dejan de mostrarse no se borra, pero no se suma en los totales mientras uses este modo (si vuelves al anterior, reaparece). Los gastos fijos del mes se reparten entre la nueva cantidad de períodos.';
  body.append(p);
  modal('¿Cambiar a '+PERIODOS[nuevo].n.toLowerCase()+'?',body,[{label:'Cancelar',onClick:()=>{ selEl.value=prev; }},{label:'Cambiar',cls:'primary',onClick:()=>{ aplicar(); }}]);
}
function buildResumen(){
  const v=el('div'); v.id='view-resumen'; v.hidden=true;
  v.innerHTML=
   '<section class="hero" aria-label="Resumen del mes">'+
   '<div class="ringBox" id="ringBox" role="img" aria-label="Porcentaje del ingreso gastado"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rBg" cx="60" cy="60" r="52"></circle><circle class="rFg" id="ringFg" cx="60" cy="60" r="52"></circle></svg>'+
   '<div class="ringTxt"><b data-k="mes.pct"></b><span>gastado</span></div></div>'+
   '<div class="heroMain"><span class="lab">Balance del mes</span><b class="big" data-k="mes.balance"></b>'+
   '<div class="heroChips"><span class="hchip"><i></i>Ingresos totales <b data-k="mes.ingresos"></b></span><span class="hchip out"><i></i>Egresos totales <b data-k="mes.egresosTotales"></b></span></div></div></section>'+
   '<div class="quick"><a class="btn" href="guia-libro-de-finanzas.pdf" target="_blank" rel="noopener">'+icono('guia')+'Guía de uso (PDF)</a>'+
   '<button type="button" class="btn" id="consejosBtn" aria-expanded="false" aria-controls="consejosCard">'+icono('idea')+'Consejos del mes</button></div>'+
   '<p class="warnBox" id="respWarn" hidden></p>'+
   '<section class="card" id="vencCard" style="margin:0 0 16px" hidden></section>'+
   '<section class="card" id="consejosCard" style="margin:0 0 16px" hidden></section>'+
   '<div class="two">'+
   tablaPeriodos()+
   '<section class="card"><header><h2>Ingresos vs. egresos</h2></header><div class="bars">'+
   QS.map(q=>'<div class="bar-grp"><b>'+qname(q)+'</b>'+
     '<div class="bar"><span>Ingresos</span><div class="track"><div class="fill i" data-bar="'+q+'.ingresos"></div></div><em data-barv="'+q+'.ingresos"></em></div>'+
     '<div class="bar"><span>Egresos</span><div class="track"><div class="fill e" data-bar="'+q+'.egresosTotales"></div></div><em data-barv="'+q+'.egresosTotales"></em></div></div>').join('')+
   '</div></section></div>'+
   '<section class="card" style="margin-top:16px"><header><h2>Egresos del mes por categoría</h2></header>'+
   '<p class="hint">Se arma con la categoría que le pongas a cada línea de Egresos fijos y Egresos variables.</p>'+
   '<div class="pie-wrap" id="pieWrap"></div></section>'+
   '<section class="card" id="presuCard" style="margin-top:16px"></section>'+
   '<section class="card" style="margin-top:16px"><header><h2>Tarjeta de crédito</h2></header>'+
   '<p class="hint">Carga el límite una sola vez; queda guardado para los meses siguientes.</p>'+
   '<div class="kpis" style="margin-top:4px">'+
   '<div class="kpi"><span>Límite de la tarjeta</span><div id="limiteTarjetaWrap"></div></div>'+
   '<div class="kpi"><span>Gastado este mes</span><b data-k="mes.tarjeta"></b></div>'+
   '<div class="kpi soft"><span>Disponible</span><b data-k="mes.disponibleTarjeta"></b></div>'+
   '</div><p class="warnBox" id="tcWarn" hidden></p></section>'+
   '<section class="card" style="margin-top:16px"><header><h2>Buscar en todos los meses</h2></header>'+
   '<p class="hint">Busca un gasto o ingreso por nombre, en todos los meses cargados.</p>'+
   '<input type="text" class="txt" id="searchAll" placeholder="Ej: Netflix" autocomplete="off" style="width:100%; margin:4px 0 10px">'+
   '<div id="searchResults" class="small"></div></section>'+
   '<section class="card" id="ahorroCard" style="margin-top:16px"></section>'+
   '<section class="card" style="margin-top:16px"><header><h2>Tu hogar</h2></header>'+
   '<p class="hint" id="hogarNombre"></p>'+
   '<p class="small">Para que tu pareja vea este mismo libro: que cree su cuenta, verifique su correo y elija "Unirme con código" con este código.</p>'+
   '<div class="tools" id="hogarCodeTools"></div></section>'+
   '<section class="card" style="margin-top:16px"><header><h2>Moneda</h2></header>'+
   '<p class="hint">Es la moneda en que se muestran todos los montos del hogar. Cambiarla no convierte los números cargados: solo cambia el símbolo.</p>'+
   '<div class="tools" id="monedaTools"></div></section>'+
   '<section class="card" style="margin-top:16px"><header><h2>Cómo cobras</h2></header>'+
   '<p class="hint">Elige cada cuánto cobras y organizas tus gastos: una vez por mes, cada 15 días o cada semana. La app arma las pestañas y los totales según tu elección.</p>'+
   '<div class="tools" id="periodoTools"></div></section>'+
   '<section class="card" style="margin-top:16px"><header><h2>Herramientas</h2></header>'+
   '<p class="hint">Baja un respaldo de vez en cuando. También puedes restaurarlo o pasar datos de otro libro.</p>'+
   '<p class="small" id="respInfo"></p>'+
   '<p class="hint" style="margin-top:10px">Recordarme hacer un respaldo:</p><div class="tools" id="respFreqTools"></div>'+
   '<div class="tools" id="tools"></div>'+
   '<p class="hint" style="margin-top:14px">Para guardar o imprimir todo el mes:</p>'+
   '<div class="tools" id="toolsExport"></div>'+
   '<p class="small" id="sesion" style="margin-top:14px"></p></section>';
  const searchBox=$('#searchAll',v);
  searchBox.addEventListener('input',()=>renderSearchResults(searchBox.value, $('#searchResults',v)));
  const lf=moneyField('',()=>months[cur].limiteTarjeta,v2=>{months[cur].limiteTarjeta=v2;},'Límite');
  lf.wrap.style.cssText='gap:0; margin:0'; lf.inp.style.cssText='width:100%; font-size:20px; font-weight:700; padding:0; border:0; background:transparent';
  $('#limiteTarjetaWrap',v).append(lf.inp);
  const tools=$('#tools',v);
  const b1=el('button','btn primary'); b1.type='button'; b1.textContent='Descargar respaldo (.json)'; b1.addEventListener('click',exportBackup);
  const b2=el('button','btn primary'); b2.type='button'; b2.textContent='Importar respaldo (.json)'; b2.addEventListener('click',()=>$('#fileImp').click());
  const del=el('button','btn danger'); del.type='button'; del.textContent='Eliminar este mes'; del.addEventListener('click',askDeleteMonth);
  const bp=el('button','btn'); bp.type='button'; bp.id='btnPapelera'; bp.addEventListener('click',openPapelera);
  const bAcc=el('button','btn danger'); bAcc.type='button'; bAcc.textContent='Eliminar mi cuenta y mis datos'; bAcc.addEventListener('click',askDeleteAccount);
  /* Compartir / Drive / WhatsApp / correo: quitado por ahora (en el teléfono no funcionó). shareBackup() queda para un futuro botón único. */
  tools.append(b1,b2,del,bp);
  const rf=respFreqSelect('',respFreq()[0]); rf.addEventListener('change',()=>{ setRespFreq(rf.value); updateRespaldoAviso(document); toast('Recordatorio: '+respFreq()[1].toLowerCase()); }); $('#respFreqTools',v).append(rf);
  const priv=el('a','link'); priv.href='privacidad.html'; priv.target='_blank'; priv.rel='noopener'; priv.textContent='Política de privacidad';
  $('#sesion',v).after(el('div','tools')); const t3=$('#sesion',v).nextSibling; t3.append(bAcc); t3.after(priv);
  updatePapeleraBtn(v); updateRespaldoAviso(v); fillAhorro(v);
  const te=$('#toolsExport',v);
  const m3=el('button','btn primary'); m3.type='button'; m3.textContent='Descargar plantilla completa (PDF)'; m3.addEventListener('click',exportFullPDF);
  const m4=el('button','btn'); m4.type='button'; m4.textContent='Excel (.xlsx)'; m4.addEventListener('click',exportExcel);
  te.append(m3,m4);
  $('#hogarNombre',v).textContent='Hogar: '+(hogarInfo&&hogarInfo.nombre?hogarInfo.nombre:'(sin nombre)');
  const hc=$('#hogarCodeTools',v);
  const pill=el('span','pill'); pill.style.cssText='font-weight:700; letter-spacing:.06em; font-size:14px';
  pill.textContent=(hogarInfo&&hogarInfo.codigoHogar)||'—';
  const copyBtn=el('button','btn'); copyBtn.type='button'; copyBtn.textContent='Copiar código';
  copyBtn.addEventListener('click',async()=>{
    const code=(hogarInfo&&hogarInfo.codigoHogar)||'';
    try{ await navigator.clipboard.writeText(code); toast('Código copiado'); }
    catch(e){ toast('No se pudo copiar: '+code); }
  });
  hc.append(pill,copyBtn);
  const mt=$('#monedaTools',v);
  const sel=el('select'); sel.setAttribute('aria-label','Moneda');
  MONEDAS.forEach(m=>{ const o=el('option'); o.value=m.c; o.textContent=m.n+' ('+m.c+')'; if(m.c===moneda.c) o.selected=true; sel.append(o); });
  sel.addEventListener('change',async()=>{ const prev=moneda.c; setMoneda(sel.value); if(await saveMoneda(sel.value)){ render(); toast('Moneda cambiada'); } else { setMoneda(prev); sel.value=prev; } });
  mt.append(sel);
  const pt=$('#periodoTools',v);
  const ps=el('select'); ps.setAttribute('aria-label','Cómo cobras');
  PERIODO_OPC.forEach(([k,txt])=>{ const o=el('option'); o.value=k; o.textContent=txt; if(k===periodo) o.selected=true; ps.append(o); });
  ps.addEventListener('change',()=>cambiarPeriodo(ps.value,ps));
  pt.append(ps);
  $('#sesion',v).textContent=me?('Sesión: '+(me.email||'')+' · ID de usuario: '+me.uid):'';
  return v;
}
