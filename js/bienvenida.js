'use strict';
/* Bienvenida de 3 pantallas (primera vez en cada cuenta) y estados vacíos amistosos */

/* ---------- Estados vacíos ---------- */
const EV_ICO={
  compras:'<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.2h11L21 7H6"/>',
  meta:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  grafico:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  presupuesto:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>'
};
/* Devuelve un bloque con ícono, título, texto y (opcional) un botón. */
function estadoVacio(ico,titulo,texto,botonTxt,onClick){
  const d=el('div','evacio');
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('class','ico'); s.setAttribute('aria-hidden','true'); s.innerHTML=EV_ICO[ico]||EV_ICO.grafico;
  const b=el('b'); b.textContent=titulo; const p=el('span'); p.textContent=texto;
  d.append(s,b,p);
  if(botonTxt&&onClick){ const bt=el('button','btn primary'); bt.type='button'; bt.textContent=botonTxt; bt.addEventListener('click',onClick); d.append(bt); }
  return d;
}

/* ---------- Bienvenida ---------- */
const BV_SLIDES=[
  {ico:'<path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M8 9h7M8 13h7"/>',
   t:'Anota tu mes',
   x:'Cada quincena tiene sus ingresos y egresos. Escribe el nombre y el monto, y toca ✓ cuando algo ya esté pagado. Los ingresos pueden ser fijos o variables, y el súper tiene su propia lista de compras con unidades y último precio.'},
  {ico:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l5.5 3.5"/>',
   t:'Mira cómo vas',
   x:'En Resumen ves tu balance, cuánto llevas gastado y consejos del mes. Puedes ponerle tope a cada categoría, fijar metas de ahorro y calcular cómo salir de tus deudas.'},
  {ico:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.8 3-5.5 6-5.5s5.5 1.7 6 5.5"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M16.5 14.8c2.6.1 4.1 1.5 4.5 4.2"/>',
   t:'Compártelo y respáldalo',
   x:'Puedes invitar a tu pareja con el código de tu hogar: los dos ven lo mismo, en vivo. Y en Herramientas puedes bajar un respaldo cuando quieras. Activa el bloqueo con huella o PIN para proteger la app.'}
];
const bvKey=()=>'lfh.bienvenida.'+((typeof me!=='undefined'&&me&&me.uid)||'x');
function bvVista(){ try{ return localStorage.getItem(bvKey())==='1'; }catch(e){ return false; } }
function bvMarcar(){ try{ localStorage.setItem(bvKey(),'1'); }catch(e){} }
function mostrarBienvenida(){
  if(document.getElementById('bvRoot')) return;
  let i=0;
  const ov=el('div','overlay bvOv'); ov.id='bvRoot';
  const box=el('div','modal bvBox'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label','Bienvenida');
  const stage=el('div','bvStage'); const dots=el('div','bvDots'); const bar=el('div','actions bvBar');
  const skip=el('button','btn'); skip.type='button'; skip.textContent='Saltar';
  const next=el('button','btn primary'); next.type='button';
  bar.append(skip,next); box.append(stage,dots,bar); ov.append(box);
  const cerrar=()=>{ bvMarcar(); ov.remove(); document.body.classList.remove('modalOpen'); document.removeEventListener('keydown',esc); };
  const esc=e=>{ if(e.key==='Escape') cerrar(); };
  const pintar=()=>{
    const s=BV_SLIDES[i]; stage.replaceChildren();
    const ic=document.createElementNS('http://www.w3.org/2000/svg','svg'); ic.setAttribute('viewBox','0 0 24 24'); ic.setAttribute('class','bvIco'); ic.setAttribute('aria-hidden','true'); ic.innerHTML=s.ico;
    const h=el('h3'); h.textContent=s.t; const p=el('p'); p.textContent=s.x;
    stage.append(ic,h,p);
    dots.replaceChildren(); BV_SLIDES.forEach((_,k)=>{ const d=el('i'); if(k===i) d.className='on'; dots.append(d); });
    next.textContent=i===BV_SLIDES.length-1?'¡Empezar!':'Siguiente';
    skip.hidden=i===BV_SLIDES.length-1;
  };
  next.addEventListener('click',()=>{ if(i<BV_SLIDES.length-1){ i++; pintar(); } else cerrar(); });
  skip.addEventListener('click',cerrar);
  document.body.append(ov); document.body.classList.add('modalOpen'); document.addEventListener('keydown',esc);
  pintar(); next.focus();
}
/* La primera vez que alguien entra a la app en este teléfono. */
function bienvenidaSiHaceFalta(){ if(!bvVista()) mostrarBienvenida(); }
