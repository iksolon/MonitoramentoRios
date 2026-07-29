/* ========================================================================
   ROTULOS
   Converte valor medido na palavra e na classe CSS da interface.
   ======================================================================== */

/* Aqui vive o vocabulario da pagina, num lugar so: "limite" e nunca "cota"
   (jargao), centimetros acima/abaixo e nunca "% da cota". Quem muda o texto
   mexe aqui, nao espalhado por seis renderizadores. */

import { fmt } from "./util.js";

export function statusRel(s){
  if(!s||s.nowLevel==null) return {k:"normal",label:"sem sinal"};
  const c=s.reg.cotaAlerta;
  // vocabulario unico na interface: "limite" em vez de "cota" (jargao)
  if(c){ const f=s.nowLevel/c; if(f>=1) return {k:"inund",label:"Acima do limite"}; if(f>=0.9) return {k:"alerta",label:"No limite"}; if(f>=0.7) return {k:"atencao",label:"Atenção"}; if(f>=0.45) return {k:"observa",label:"Observação"}; return {k:"normal",label:"Normal"}; }
  const t=s.trend||0; if(t>=15) return {k:"atencao",label:"Subindo rápido"}; if(t>=3) return {k:"observa",label:"Subindo"}; if(t<=-3) return {k:"normal",label:"Baixando"}; return {k:"normal",label:"Estável"};
}

export function chuvaStatus(mm){
  if(mm==null) return {k:"normal",label:"sem chuva medida"};
  if(mm>=80) return {k:"alerta",label:"chuva de alerta"};
  if(mm>=40) return {k:"atencao",label:"chuva alta"};
  if(mm>=15) return {k:"observa",label:"chuva moderada"};
  if(mm>=0.2) return {k:"normal",label:"chuva fraca"};
  return {k:"normal",label:"sem chuva"};
}
export function rainCls(mm){ return mm>=80?"alerta":mm>=40?"atencao":"observa"; }

export function trendTxt(s){ if(!s||s.trend==null) return "sem tendência"; if(s.trend>=1) return "subindo "+fmt(s.trend,1)+" cm/h"; if(s.trend<=-1) return "baixando "+fmt(Math.abs(s.trend),1)+" cm/h"; return "estável"; }

/* % da cota SEM teto: a BE01 chegou a 177 % em 29/07 e o painel mostrava
   "100%", escondendo a gravidade justamente no pico. */
export function cotaTxt(s){ if(!s.reg.cotaAlerta) return "sem limite definido";
  const cm=Math.round((s.nowLevel-s.reg.cotaAlerta)*100);
  return (cm>=0?(cm+" cm acima do limite"):(Math.abs(cm)+" cm abaixo do limite"))+" de "+fmt(s.reg.cotaAlerta,2)+" m"; }

export function pulseTxt(q){ return q.now? (fmt(q.mm,1)+" mm/h") : (fmt(q.mm,1)+" mm há "+q.h+" h"); }

export function rainWord(mm){ return mm>=8?"forte":mm>=3?"moderada":mm>0?"fraca":"sem chuva"; }

export function soilLabel(sat){ return sat>=0.85?"saturado":sat>=0.5?"encharcado":sat>=0.2?"úmido":"seco"; }
