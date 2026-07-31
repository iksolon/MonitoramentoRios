/* ========================================================================
   ORQUESTRACAO
   Junta as pecas, agenda o ciclo, liga o boot.
   ======================================================================== */

import { APP } from "./estado.js";
import { $ } from "./util.js";
import { loadStations, loadForecast, aggregateBasins, netSummary } from "./dados.js";
import { computeRisk } from "./enchente.js";
import { renderNetCard, renderRisk, renderForecast, renderGauges, renderBasins,
         renderContext } from "./painel.js";
import { chartRain, chartRainMap, buildContours } from "./graficos.js";
import { StormSky, applyStormMode, initStormBtn } from "./tempestade.js";

function renderAll(){
  buildContours();
  aggregateBasins(); APP.NET=netSummary(); computeRisk();
  $("#clock").textContent=APP.gen.split(" ")[1]+" BRT";
  renderNetCard(); renderRisk(); renderForecast(); renderGauges(); renderBasins(); chartRain(); chartRainMap(); renderContext(); applyStormMode();
  requestAnimationFrame(()=>document.body.classList.add("ready"));
}
function showEmpty(){ $("#risk-h").textContent="Sem dados das estações no momento."; $("#risk-drivers").textContent="Tentando novamente em instantes."; buildContours(); document.body.classList.add("ready"); }

function initTestRibbon(){
  var el=$("#testRibbon"); if(!el) return;
  if(localStorage.getItem("rios_ribbon_fechado")==="1"){ el.remove(); return; }
  var btn=$("#testRibbonClose");
  if(btn) btn.addEventListener("click", function(){ localStorage.setItem("rios_ribbon_fechado","1"); el.remove(); });
}

async function cycle(){
  try{ await Promise.all([loadStations(), loadForecast()]); if(!APP.ST.__anyData){ showEmpty(); return; } renderAll(); }
  catch(e){ console.error(e); showEmpty(); }
}

function boot(){ StormSky.init(document.getElementById("storm")); initStormBtn(); initTestRibbon(); cycle(); var DEV=(location.hostname==="localhost"||location.hostname==="127.0.0.1"); setInterval(cycle, (DEV?15:5)*60*1000); }
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();
