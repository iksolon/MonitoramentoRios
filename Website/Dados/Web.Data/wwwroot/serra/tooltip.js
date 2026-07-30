/* ========================================================================
   TOOLTIP
   Componente independente: os graficos usam, ele nao conhece grafico.
   ======================================================================== */

import { $ } from "./util.js";

let TIPEL=null;
export function tipShow(html,ev){
  const t=TIPEL||(TIPEL=$("#tip")); if(!t) return;
  t.innerHTML=html; t.classList.add("on");
  const r=t.getBoundingClientRect();
  let x=ev.clientX+14, y=ev.clientY-r.height-12;
  if(x+r.width>window.innerWidth-8) x=ev.clientX-r.width-14;
  if(y<8) y=ev.clientY+18;
  t.style.setProperty("--x", Math.max(8,x)+"px");
  t.style.setProperty("--y", y+"px");
}
export function tipHide(){ const t=TIPEL||(TIPEL=$("#tip")); if(t) t.classList.remove("on"); }
