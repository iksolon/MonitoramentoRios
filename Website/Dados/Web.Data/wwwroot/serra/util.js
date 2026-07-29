/* ========================================================================
   UTILITARIOS
   Funcoes puras de valor, data e geometria. Nao conhecem o app.
   ======================================================================== */

/* --- acesso ao DOM (unico ponto impuro deste arquivo) --- */
export const $=(s,r)=>(r||document).querySelector(s);

/* --- valores --- */
export function fmt(n,d){ if(n==null||isNaN(n)) return "-"; d=(d==null)?1:d; return Number(n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function mean(a){ const v=a.filter(x=>x!=null&&!isNaN(x)); return v.length? v.reduce((s,x)=>s+x,0)/v.length:0; }
export function sum(a){ return a.reduce((s,x)=>s+(x||0),0); }
export function num(v){ if(v==null) return null; const n=Number(v); return isFinite(n)?n:null; }
export function tsOf(v){ if(!v) return null; const t=Date.parse(/[Zz+]|\d-\d\d:\d\d$/.test(v)?v:(v+"Z")); return isFinite(t)?t:null; }
export function lastNonNull(a){ for(let i=a.length-1;i>=0;i--) if(a[i]!=null) return a[i]; return null; }
export function fillGaps(a){ const b=a.slice(); let last=null; for(let i=0;i<b.length;i++){ if(b[i]==null)b[i]=last; else last=b[i]; } let nx=null; for(let i=b.length-1;i>=0;i--){ if(b[i]==null)b[i]=nx; else nx=b[i]; } return b; }

/* min/max que ignoram buraco. Math.min.apply com null coage para 0 e
   achatava a escala do grafico de uma regua com falha de telemetria. */
export function nmin(a){ const v=(a||[]).filter(x=>x!=null&&isFinite(x)); return v.length?Math.min.apply(null,v):null; }
export function nmax(a){ const v=(a||[]).filter(x=>x!=null&&isFinite(x)); return v.length?Math.max.apply(null,v):null; }

export function median(a){ const v=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y); if(!v.length) return null; const m=v.length>>1; return v.length%2?v[m]:(v[m-1]+v[m])/2; }

/* --- geometria --- */
export function smoothPath(pts){ if(!pts.length) return ""; if(pts.length<3) return "M "+pts.map(p=>p[0]+" "+p[1]).join(" L "); let d="M "+pts[0][0]+" "+pts[0][1]; for(let i=0;i<pts.length-1;i++){ const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2; const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6; d+=" C "+c1x.toFixed(2)+" "+c1y.toFixed(2)+" "+c2x.toFixed(2)+" "+c2y.toFixed(2)+" "+p2[0].toFixed(2)+" "+p2[1].toFixed(2); } return d; }

/* --- datas e rede --- */
/* Zero a esquerda estava escrito a mao em nove lugares
   (String(x).padStart(2,"0")), em quatro arquivos. */
const dois = n => String(n).padStart(2,"0");
export const horaDe = d => dois(d.getHours())+"h";
export const diaMes = d => dois(d.getDate())+"/"+dois(d.getMonth()+1);
export const horaMin = d => dois(d.getHours())+":"+dois(d.getMinutes());

export function hkLabel(hk){ return horaDe(new Date(hk*3600*1000)); }
export const DOW=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
export async function fetchJSON(u){ const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw new Error(r.status); return r.json(); }

/* Data com hora do meio-dia quando so vem o dia: evita o fuso jogar para a
   vespera. */
const dataDe = iso => new Date(iso.length===10?iso+"T12:00":iso);
export function diaCurto(iso){
  const d=dataDe(iso), hoje=new Date();
  const soDia = x => new Date(x.getFullYear(),x.getMonth(),x.getDate());
  const dd=Math.round((soDia(d)-soDia(hoje))/86400000);
  if(dd===0) return "hoje";
  if(dd===1) return "amanhã";
  return DOW[d.getDay()]+" "+diaMes(d);
}
export function horaCurta(iso){ return horaDe(new Date(iso)); }
/* "amanhã 05h" em vez de "em 35 h": hora do relogio situa melhor e nao soa
   como contagem regressiva de alarme. */
export function quandoTxt(hAhead){ const iso=new Date(Date.now()+hAhead*3600000).toISOString(); return diaCurto(iso)+" "+horaCurta(iso); }

/* Nascer/por do sol para Rolante (-29.65,-50.57 · UTC-3 fixo, sem horario
   de verao no Brasil desde 2019). Formula solar padrao (NOAA simplificada):
   declinacao + equacao do tempo, com precisao de poucos minutos — o
   bastante pra uma faixa visual, sem precisar de API externa. */
function eqOfTime(doy){ const B=2*Math.PI/365*(doy-81); return 9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B); }
function solarDecl(doy){ return -23.44*Math.PI/180*Math.cos(2*Math.PI/365*(doy+10)); }
export function sunTimesFor(d){
  const y=d.getFullYear(),mo=d.getMonth(),da=d.getDate();
  const doy=Math.floor((Date.UTC(y,mo,da)-Date.UTC(y,0,1))/86400000)+1;
  const lat=-29.65*Math.PI/180, lng=-50.57, LSTM=-45;
  const decl=solarDecl(doy), eot=eqOfTime(doy);
  const solarNoonMin=12*60-(4*(lng-LSTM)+eot);
  let cosH=-Math.tan(lat)*Math.tan(decl); cosH=Math.max(-1,Math.min(1,cosH));
  const halfDayMin=Math.acos(cosH)*180/Math.PI/15*60;
  const mk=min=>new Date(y,mo,da,Math.floor(min/60),Math.round(min%60));
  return { sunrise:mk(solarNoonMin-halfDayMin), sunset:mk(solarNoonMin+halfDayMin) };
}
