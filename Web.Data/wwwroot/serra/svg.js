/* ========================================================================
   PRIMITIVAS DE DESENHO SVG
   Recebe numero, devolve marcacao. Nao busca dado.
   ======================================================================== */

import { nmin, nmax, smoothPath } from "./util.js";

/* Respeita quem pediu menos animacao no sistema. */
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --- texto ---------------------------------------------------------------
   Rotulo de SVG estava montado a mao em vinte lugares, cada um repetindo
   font-family="var(--font-sans)" e, nos que ficam sobre o desenho, as quatro
   propriedades de contorno (paint-order/stroke/stroke-width/stroke-linejoin).
   Uma troca de fonte pedia vinte edicoes. Agora pede uma. */
const ANCORA={fim:"end", meio:"middle", inicio:"start"};
export function svgText(txt, o){
  o=o||{};
  const at=[];
  if(o.cls) at.push('class="'+o.cls+'"');
  at.push('x="'+o.x+'"','y="'+o.y+'"');
  if(o.ancora) at.push('text-anchor="'+(ANCORA[o.ancora]||o.ancora)+'"');
  /* viaCss: a aparencia vem de uma classe (ex.: .now-tag). Nao emitimos
     tamanho/cor/fonte para nao competir com ela. */
  if(!o.viaCss){
    at.push('font-size="'+(o.tam==null?8:o.tam)+'"');
    if(o.peso) at.push('font-weight="'+o.peso+'"');
    at.push('fill="'+(o.cor||"var(--muted)")+'"');
    if(o.espaco) at.push('letter-spacing="'+o.espaco+'"');
    /* Contorno escuro atras do texto claro: o rotulo cruza encosta, rio e
       nuvem, e sem ele desaparece dependendo do que estiver por baixo. */
    if(o.contorno) at.push('paint-order="stroke"','stroke="oklch(0.26 0.045 238 / 0.8)"','stroke-width="1.8"','stroke-linejoin="round"');
    at.push('font-family="'+(o.fonte||"var(--font-sans)")+'"');
  }
  return "<text "+at.join(" ")+">"+txt+"</text>";
}

/* Escala linear de dominio para pixel, com margem. Tres graficos escreviam
   as mesmas duas funcoes xs/ys inline. */
export function escala(n, W, pad){ return i => pad + i*(W-2*pad)/((n-1)||1); }
export function escalaValor(mn, mx, Ht, pad){
  const rng=(mx-mn)||1;
  return v => (Ht-pad) - (v-mn)/rng*(Ht-2*pad);
}


/* A serie de nivel agora pode ter buraco (forward-fill limitado). Math.min
   com null coage para 0 e achatava a escala inteira do grafico. */
export function sparkline(lv){
  if(!lv) return "";
  const W=150, Ht=34, pad=3, mn=nmin(lv), mx=nmax(lv);
  if(mn==null) return "";
  const xs=escala(lv.length,W,pad), ys=escalaValor(mn,mx,Ht,pad);
  const pts=[];
  lv.forEach((v,i)=>{ if(v!=null) pts.push([xs(i),ys(v)]); });
  if(!pts.length) return "";
  const ponta=pts[pts.length-1];
  return '<svg viewBox="0 0 '+W+' '+Ht+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+smoothPath(pts)+'" fill="none" stroke="var(--teal-deep)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+ponta[0].toFixed(1)+'" cy="'+ponta[1].toFixed(1)+'" r="2.4" fill="var(--teal-deep)"/></svg>';
}

/* Prepara a animacao de "desenhar a linha": mede o traco e o esconde, o CSS
   solta com body.ready. Antes existiam prepDraw e prepDrawEl, byte a byte
   identicas — uma delas nunca era chamada. */
export function prepLines(el){ el.querySelectorAll(".chart-line").forEach(prepLine); }
function prepLine(pl){
  try{
    const len=pl.getTotalLength();
    pl.style.setProperty("--len", len);
    pl.style.setProperty("--off", reduceMotion?0:len);
  }catch(e){}
}
