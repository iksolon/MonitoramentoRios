/* ========================================================================
   FILTROS DE SERIE DE REGUA
   Entra serie crua, sai serie tratada. Sem DOM, sem estado global.
   ======================================================================== */

import { LV_CARRY } from "./config.js";
import { median } from "./util.js";

/* forward-fill LIMITADO e sem back-fill: leitura antiga vale por poucas horas
   e NUNCA vale para tras. fillGaps() continua servindo grafico de contexto,
   onde emendar a linha e cosmetico. */
export function ffill(a,carry){ carry=carry==null?LV_CARRY:carry; const b=a.slice(); let last=null,age=0;
  for(let i=0;i<b.length;i++){ if(b[i]==null){ age++; b[i]=(last!=null&&age<=carry)?last:null; } else { last=b[i]; age=0; } }
  return b; }

/* Confirmacao de duas amostras: min(leitura, leitura anterior). Nenhum valor
   entra sem ter sido medido duas vezes seguidas — mata pico solto sem cortar
   degrau real. Usada so no canal de DECISAO; grafico e tendencia seguem na
   serie suavizada. */
export function confirmSeries(a){ const o=new Array(a.length).fill(null);
  for(let i=1;i<a.length;i++) if(a[i]!=null&&a[i-1]!=null) o[i]=Math.min(a[i],a[i-1]);
  return o; }

/* ---- nivel: filtro de pico ----------------------------------------------
   A regua manda leitura suja (bolha de ar, detrito, telemetria). Um unico
   ponto fora da curva estourava min/max de 96 h e virava "subindo 38 cm/h".
   Hampel: compara cada ponto com a mediana da vizinhanca; se desviar mais que
   k*MAD (com piso absoluto, senao serie parada rejeita ruido normal), troca
   pela mediana. Nao inventa dado onde nao ha (null continua null). */

export function despike(a,win,k,floor){
  win=win||3; k=k||3; floor=floor==null?0.06:floor;
  const out=a.slice();
  for(let i=0;i<a.length;i++){
    if(a[i]==null) continue;
    const w=a.slice(Math.max(0,i-win),Math.min(a.length,i+win+1));
    const med=median(w); if(med==null) continue;
    const mad=median(w.filter(x=>x!=null).map(x=>Math.abs(x-med)));
    const lim=Math.max(floor,k*1.4826*(mad||0));
    if(Math.abs(a[i]-med)>lim) out[i]=med;
  }
  return out;
}

/* Theil-Sen: mediana das inclinacoes par a par. Resiste a ponto solto no fim
   da serie, que e exatamente onde a diferenca simples (a-b)/3 explodia. */
export function robustSlope(a){
  const pts=[]; for(let i=0;i<a.length;i++) if(a[i]!=null) pts.push([i,a[i]]);
  if(pts.length<3) return null;
  const sl=[];
  for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++) sl.push((pts[j][1]-pts[i][1])/(pts[j][0]-pts[i][0]));
  return median(sl);
}

/* Media movel centrada: mata o ruido branco que a mediana nao pega
   (regua com dispersao alta hora a hora, nao pico isolado). */
function rollMean(a,w){ return a.map((_,i)=>{ const s=a.slice(Math.max(0,i-w),Math.min(a.length,i+w+1)).filter(x=>x!=null); return s.length?s.reduce((x,y)=>x+y,0)/s.length:a[i]; }); }
/* Ruido tipico da regua: MAD das variacoes hora a hora, em m/h. */
function levelNoise(a){ const d=[]; for(let i=1;i<a.length;i++) if(a[i]!=null&&a[i-1]!=null) d.push(Math.abs(a[i]-a[i-1])); const m=median(d); return m==null?0:1.4826*m; }

/* Suavizacao adaptativa: regua limpa (BE01, ~1 cm/h) passa intacta;
   regua suja (AR01, ~35 cm/h) leva janela larga. Sem isso o mesmo filtro
   ou nao resolve o ruido de uma ou apaga o sinal real da outra. */
export function smoothLevel(a){
  const n=levelNoise(a);
  const w = n<0.03?0 : n<0.08?1 : n<0.15?2 : n<0.25?3 : 4;
  return { series: w?rollMean(a,w):a, noise:n, win:w };
}
