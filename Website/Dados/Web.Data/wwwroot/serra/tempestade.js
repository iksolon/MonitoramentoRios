/* ========================================================================
   MODO TEMPESTADE
   Canvas de chuva em tela cheia. Le estado, nao escreve estado.
   ======================================================================== */

import { APP } from "./estado.js";
import { clamp } from "./util.js";

/* ===== Modo tempestade (motor de canvas do Tema 5, adaptado) ===== */
export var StormSky=(function(){
  var cv,ctx,W=0,H=0,DPR=1,raf=0,running=false,last=0;
  /* Ligado/desligado e estado do componente, guardado aqui. Antes o codigo
     PERGUNTAVA para o estilo (cv.style.display!=="none") e ESCREVIA display no
     elemento — o CSS ja mostra e esconde #storm por body.storm, entao eram duas
     fontes de verdade para a mesma coisa. */
  var ativo=false;
  var drops=[],splashes=[],clouds=[],pulses=[],nextBolt=0,bolt=null;
  var CAP=120,dropTarget=0,rainMm=0,levelRatio=0.3,waterCover=0,waterProg=0,reduced=false;
  function cl(v,a,b){return v<a?a:(v>b?b:v);}
  function computeDrop(){ var c=Math.round(85*Math.sqrt(Math.max(0,rainMm))); return cl(c, rainMm>0?48:0, CAP); }
  /* Tamanho do canvas: cv.width/height e o buffer de pixels (dado de desenho).
     A caixa na tela precisa casar com o buffer / DPR, senao a chuva aparece
     ampliada e vazando da tela — canvas e elemento substituido, entao inset:0
     NAO o estica: sem tamanho declarado ele assume o proprio buffer em px CSS.
     O valor vai como custom property e quem aplica largura/altura e o CSS. */
  function fit(){ W=window.innerWidth; H=window.innerHeight; DPR=Math.min(2,window.devicePixelRatio||1); cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); cv.style.setProperty("--cvw",W+"px"); cv.style.setProperty("--cvh",H+"px"); ctx.setTransform(DPR,0,0,DPR,0,0); CAP=cl(Math.round(W*H/2600),60,300); dropTarget=computeDrop(); waterCover=cl(0.10+levelRatio*0.22,0.10,0.34)*H; clouds=[]; for(var i=0;i<3;i++) clouds.push({x:Math.random()*W,y:H*(0.05+0.12*i),r:H*(0.28+0.12*i),vx:(0.004+0.003*i)*(i%2?-1:1)}); sync(); }
  function spawn(top){ return {x:Math.random()*W,y:top?(-20-Math.random()*H):(Math.random()*H),len:8+Math.random()*14,spd:520+Math.random()*380,a:0.18+Math.random()*0.3,w:0.8+Math.random()*1.1}; }
  function sync(){ while(drops.length<dropTarget) drops.push(spawn(true)); if(drops.length>dropTarget) drops.length=dropTarget; }
  function schedule(now){ nextBolt=now+(5000+Math.random()*8000); }
  function trigger(now){ pulses.push({t0:now,tau:120,mag:1}); pulses.push({t0:now+90,tau:220,mag:0.7}); if(Math.random()<0.6){ var x=W*(0.2+Math.random()*0.6),segs=[{x:x,y:-4}],y=0; while(y<H*(0.45+Math.random()*0.25)){ y+=H*(0.05+Math.random()*0.06); x+=(Math.random()-0.5)*W*0.09; segs.push({x:x,y:y}); } bolt={segs:segs,t0:now,life:260}; } schedule(now); }
  function flashAt(now){ var f=0; for(var i=pulses.length-1;i>=0;i--){ var p=pulses[i],dt=now-p.t0; if(dt<0)continue; var v=p.mag*Math.exp(-dt/p.tau); if(v<0.01&&dt>0){pulses.splice(i,1);continue;} f+=v; } return cl(f,0,1); }
  function drawWater(now,wy,flash){ var step=W<520?16:22; ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(0,wy); var surf=[]; for(var x=0;x<=W;x+=step){ var y=wy+(reduced?0:(Math.sin(x*0.012+now*0.0016)*3+Math.sin(x*0.03-now*0.0026)*1.6)); surf.push([x,y]); ctx.lineTo(x,y); } ctx.lineTo(W,H); ctx.closePath(); var wg=ctx.createLinearGradient(0,wy,0,H); wg.addColorStop(0,"rgba(96,150,196,"+(0.5+flash*0.22)+")"); wg.addColorStop(1,"rgba(30,58,92,0.82)"); ctx.fillStyle=wg; ctx.fill(); ctx.beginPath(); surf.forEach(function(p,i){ i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); }); ctx.strokeStyle="rgba(188,218,244,"+(0.5+flash*0.4)+")"; ctx.lineWidth=1.6; ctx.stroke(); }
  function draw(now,dt){ ctx.clearRect(0,0,W,H); var flash=reduced?0:flashAt(now);
    var g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"hsl(222,40%,"+((0.11+flash*0.16)*100).toFixed(1)+"%)"); g.addColorStop(0.5,"hsl(218,38%,"+((0.17+flash*0.14)*100).toFixed(1)+"%)"); g.addColorStop(1,"hsl(210,40%,"+((0.24+flash*0.1)*100).toFixed(1)+"%)"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.save(); clouds.forEach(function(c){ if(!reduced){ c.x+=c.vx*dt*60; if(c.x<-c.r)c.x=W+c.r; if(c.x>W+c.r)c.x=-c.r; } var rg=ctx.createRadialGradient(c.x,c.y,c.r*0.1,c.x,c.y,c.r); rg.addColorStop(0,"hsla(220,30%,"+(14+flash*10).toFixed(0)+"%,0.5)"); rg.addColorStop(1,"hsla(220,30%,14%,0)"); ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,7); ctx.fill(); }); ctx.restore();
    var wy=H-waterCover*waterProg; drawWater(now,wy,flash);
    var wind=reduced?0:Math.sin(now*0.0004)*140+60; ctx.lineCap="round";
    for(var i=0;i<drops.length;i++){ var d=drops[i]; if(!reduced){ d.y+=d.spd*dt; d.x+=wind*dt; } var dx=wind*0.03,dy=d.len; ctx.strokeStyle="rgba(196,216,238,"+d.a+")"; ctx.lineWidth=d.w; ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-dx,d.y-dy); ctx.stroke(); if(d.y>=wy){ if(!reduced&&splashes.length<46) splashes.push({x:d.x,y:wy,r:1,a:0.5}); if(!reduced){ var nd=spawn(true); d.x=nd.x;d.y=nd.y;d.len=nd.len;d.spd=nd.spd;d.a=nd.a;d.w=nd.w; } } else if(d.y>H+20||d.x<-30||d.x>W+30){ var n2=spawn(true); d.x=n2.x; d.y=n2.y; } }
    for(var j=splashes.length-1;j>=0;j--){ var sp=splashes[j]; sp.r+=dt*26; sp.a-=dt*1.4; if(sp.a<=0){ splashes.splice(j,1); continue; } ctx.strokeStyle="rgba(200,222,242,"+sp.a.toFixed(3)+")"; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(sp.x,sp.y,sp.r,sp.r*0.4,0,0,7); ctx.stroke(); }
    if(!reduced){ if(flash>0.001){ ctx.fillStyle="rgba(222,226,255,"+(flash*0.4).toFixed(3)+")"; ctx.fillRect(0,0,W,H); } if(bolt){ var bl=(now-bolt.t0)/bolt.life; if(bl>1) bolt=null; else { var ba=(1-bl)*0.9; ctx.strokeStyle="rgba(226,228,255,"+ba.toFixed(3)+")"; ctx.lineWidth=2.2; ctx.shadowColor="rgba(200,210,255,0.9)"; ctx.shadowBlur=16; ctx.beginPath(); ctx.moveTo(bolt.segs[0].x,bolt.segs[0].y); for(var b=1;b<bolt.segs.length;b++) ctx.lineTo(bolt.segs[b].x,bolt.segs[b].y); ctx.stroke(); ctx.shadowBlur=0; } } if(now>nextBolt) trigger(now); }
  }
  function frame(now){ var dt=last?Math.min(0.05,(now-last)/1000):0.016; last=now; if(!reduced) waterProg+=(1-waterProg)*Math.min(1,dt*0.9); else waterProg=1; draw(now,dt); if(running) raf=requestAnimationFrame(frame); }
  return {
    init:function(canvas){ cv=canvas; ctx=cv.getContext("2d"); reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches; window.addEventListener("resize",function(){ if(ativo) fit(); }); document.addEventListener("visibilitychange",function(){ if(document.hidden){ if(running){cancelAnimationFrame(raf);raf=0;} } else if(running){ last=0; raf=requestAnimationFrame(frame); } }); },
    set:function(mm,ratio){ rainMm=mm; levelRatio=cl(ratio||0.3,0,1); if(cv&&ativo&&W){ dropTarget=computeDrop(); waterCover=cl(0.10+levelRatio*0.22,0.10,0.34)*H; sync(); } },
    on:function(){ if(!cv) return; ativo=true; fit(); waterProg=reduced?1:0; if(reduced){ draw(performance.now(),0); } else if(!running){ running=true; last=0; if(!nextBolt) schedule(performance.now()); raf=requestAnimationFrame(frame); } },
    off:function(){ running=false; ativo=false; if(raf)cancelAnimationFrame(raf); raf=0; }
  };
})();
var stormManual = new URLSearchParams(location.search).get("modo");
var lastRainTs = 0;
function stormInputs(){ var mm = (APP.RISK&&APP.RISK.obsNow!=null&&APP.RISK.obsNow>0)?APP.RISK.obsNow:(APP.FC?APP.FC.nowMm:0); var g=APP.NET?(APP.NET.trusted[0]||APP.NET.gauges.find(function(x){return !x.levelCheck;})||null):null; var ratio=0.3; if(g&&g.reg.cotaAlerta) ratio=clamp(g.nowLevel/g.reg.cotaAlerta,0,1); return {mm:mm,ratio:ratio}; }
function decideStorm(){ if(stormManual==="chuva") return true; if(stormManual==="seco") return false; var now=Date.now(); if(APP.RISK&&APP.RISK.raining) lastRainTs=now; return lastRainTs>0 && (now-lastRainTs)<1800000; }
export function applyStormMode(){ var inp=stormInputs(); var on=decideStorm(); document.body.classList.toggle("storm",on); if(on){ StormSky.set((stormManual==="chuva"&&inp.mm<0.5)?7:inp.mm, inp.ratio); StormSky.on(); } else StormSky.off(); var b=document.getElementById("stormBtn"); if(b){ b.setAttribute("aria-pressed", (stormManual==="chuva")?"true":"false"); b.textContent = on?"tempestade ativa":"modo tempestade"; } }
export function initStormBtn(){ var b=document.getElementById("stormBtn"); if(!b) return; b.addEventListener("click",function(){ stormManual=(stormManual==="chuva")?null:"chuva"; applyStormMode(); }); }
