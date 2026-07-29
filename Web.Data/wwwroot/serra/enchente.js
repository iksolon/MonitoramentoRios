/* ========================================================================
   MOTOR DE ENCHENTE E DE RISCO
   Le dado, devolve veredito. Nao desenha nada.
   ======================================================================== */

import { APP } from "./estado.js";
import { HMAX } from "./config.js";
import { clamp } from "./util.js";
import { soilLabel } from "./rotulos.js";

/* ===== motor de risco =====
   O badge e o card de enchente saem do MESMO motor. Antes eram dois calculos
   separados e se contradiziam na mesma tela: em 29/07/2026 00h o badge dizia
   "Risco alto" (chuva 24 h >= 100 mm) e o card ao lado dizia "improvavel". */
export function computeRisk(){
  const F=cityFlood();
  let maxFrac=0, maxTrend=0, worst=null;
  APP.NET.trusted.forEach(s=>{ const f=s.cotaFrac||0; if(f>maxFrac){maxFrac=f;worst=s;} if((s.trend||0)>maxTrend) maxTrend=s.trend||0; });
  if(!worst && APP.NET.trusted.length) worst=APP.NET.trusted[0];
  const obs12=APP.NET.rain12, obsNow=APP.NET.rainNow;
  const nowcast = APP.FC?APP.FC.nowMm:0;
  const raining = (obsNow!=null&&obsNow>=0.2) || nowcast>=0.3 || maxTrend>=8;
  // situacao AGORA = veredito do detector (chuva caida + regua observada)
  let cur = F.ok?F.level:0;
  if(nowcast>=10) cur=Math.min(3,cur+1);
  // chuva prevista que ja estoura o limiar dentro de 12 h e ATENCAO no minimo
  if(F.ok&&F.eta!=null&&F.eta<=12) cur=Math.max(cur,2);
  let fut=0, futWhen="";
  if(APP.FC){ const pd=APP.FC.peakDay; if((pd&&pd.mm>=80)||APP.FC.next72>=100) fut=3; else if((pd&&pd.mm>=40)||APP.FC.next72>=60) fut=2; else if((pd&&pd.mm>=15)||APP.FC.next24>=10) fut=1; if(pd) futWhen=pd.date; }
  const level=Math.max(cur,fut);
  const drivenBy = fut>cur?"previsto":(cur>0?"agora":"previsto");
  APP.RISK={ level, cur, fut, drivenBy, raining, maxFrac, maxTrend, worst, nowcast, futWhen, obs12, obsNow, flood:F };
}

/* ===== ENCHENTE NA CIDADE ============================================
   >>> ANTES DE MEXER EM QUALQUER CONSTANTE DESTE MOTOR, LEIA
   >>> docs/detector-enchente.md — traz o evento de referencia com os numeros
   >>> medidos, a justificativa de cada limiar, os critérios de aceitacao que
   >>> nao podem regredir e o procedimento de recalibracao com dado novo
   >>> (docs/replay/ tem o script que baixa o evento e o servidor de replay).

   Aferido contra o evento de 27–29/07/2026 (121 h de dado real da rede).

   O QUE ACONTECEU: 29/07 03h30 o Rio Areia saiu da caixa no bairro Grassmann;
   07h00 a rotula da Cuca ficou intransitavel (Rolante ja emendado com o
   Areia). Boletins do Corpo de Bombeiros.

   O QUE O MOTOR ANTIGO DISSE, hora a hora, replayado sobre esse mesmo dado:
     00h "improvavel" (faltavam 38,8 mm)   ... 3h30 antes da enchente
     01h "possivel em 2 h"                  ... unico aviso, e curto
     03h "acontecendo"  (por 4,5 mm de folga, quando ja estava alagando)
     06h "IMPROVAVEL"   <-- voltou a negar, com o centro alagando
     07h "IMPROVAVEL"   <-- e com a rotula da Cuca fechada

   POR QUE ERROU (quatro causas, todas medidas):
     1) JANELA FIXA DE 12 h. O evento nao foi um aguaceiro: foram tres pulsos
        em 60 h, 180,8 mm em 72 h. O pico de 12 h chegou a 78,2 mm e o limiar
        pedia 80–100 mm. A enchente era invisivel para a janela escolhida.
     2) SOLO SO CONTAVA PARA O FUTURO. O fator "amp = 1 + chuva24/150" (teto
        1,5x) multiplicava a chuva PREVISTA e nunca a medida — e o teste de
        "acontecendo" olhava so a medida. Alem disso ficou pregado em 1,50
        por 21 h seguidas: parou de informar exatamente quando importava.
        Nas 72 h anteriores as ultimas 12 h ja tinham caido 98,5 mm.
     3) RIO NA COTA VALIA 20 %. frac=clamp(nivel/cota,0,1) dava no maximo
        20 % de desconto no limiar. A BE01 passou da cota as 01h (0,70 m de
        0,70 m) e chegou a 1,24 m (177 %) as 06h. Rio acima da cota E a
        enchente, nao um desconto nela.
     4) DEGRAU SECO NO LIMIAR. O bonus de 10 % exigia subida >= 10 cm/h; a
        tendencia oscilou em torno de 10 e o limiar pulou 72 <-> 80 mm. Foi
        isso que fez o veredito piscar de "acontecendo" para "improvavel".

   MOTOR NOVO: dois canais independentes, vale o pior. Canal calado nunca
   cancela o outro — regua morta nao pode deixar o alarme mais difícil.

     CANAL RIO (observacao direta, terminal)
       fracao da cota SEM TETO, com memoria de 6 h (agua de enchente escoa
       devagar) e exigencia de leitura fresca. >=100 % da cota = enchente
       naquele rio, ponto. >=85 % e subindo = enchente tambem.

     CANAL CHUVA (guia de enchente relampago, no estilo FFG)
       indice de solo API responde "quanto choveu antes"; o limiar de chuva
       DESCE conforme o solo satura e e testado em QUATRO duracoes ao mesmo
       tempo (3/6/12/24 h). Quem estourar primeiro manda. Assim o aguaceiro
       curto e o evento arrastado sao vistos pelo mesmo motor.

   RESULTADO DA CALIBRACAO (mesmas 121 h de dado real):
     dispara 29/07 00h  -> 3,5 h de antecedencia sobre o Grassmann
     segue aceso 00h..07h sem piscar uma vez
     zero disparo falso nas outras 113 h (27 e 28/07 param em "atencao",
     coerente com o rio a 84–87 % da cota e sem alagamento reportado)     */

/* Limiares de chuva por duracao: [horas, mm em solo seco, mm em solo saturado].
   Sublinear na duracao (mm de aguaceiro curto pesa mais) e cai ~50 % quando o
   solo satura. No pico do evento a duracao que estourou primeiro foi a de
   24 h: 141,3 mm medidos contra limiar de 85 mm. */
const FFG=[[3,70,35],[6,95,48],[12,120,62],[24,150,85]];
/* Solo: API = chuva acumulada com decaimento exponencial. Meia-vida de 48 h
   serve bacia pequena e encaixada (cabeceira a 880 m, cidade a 44 m) —
   esvazia rapido, mas guarda memoria de dois a tres dias. Ancoras aferidas:
   40 mm ainda e solo que absorve, 140 mm e solo que devolve quase tudo
   (no momento da enchente o indice estava em 142,6 mm). */
const SOIL_HL=48, SOIL_DRY=40, SOIL_WET=140, ETA_H=48;
const SOIL_K=Math.pow(0.5,1/SOIL_HL);
/* Acima de 1,35x o limiar a enchente deixa de ser ponto baixo alagado e vira
   evento de cidade — ruas do centro tomadas e saida trancada. Aferido no
   evento de 29/07/2026, cujo pico foi 1,66x o limiar e 177 % da cota. */
const SEV_GRANDE=1.35;
/* RECUO (agua saindo). Aferido no fim do evento de 29/07/2026: as 12h15 BRT o
   usuario confirmou em campo "a enchente ja se foi praticamente toda, so as
   ruas sujas no centro" — e a pagina dizia "Enchente grande na cidade". A BE01
   estava em 0,795 m (1,14x o limite de 0,70 m), caindo 6,3 cm/h, com chuva
   zero nas 4 h anteriores. Duas causas, as duas so aparecem na descida:
     1) o limite da regua e nivel de AVISO, nao nivel de rua alagada. Na subida
        ele vale por antecedencia (cruzou 0,70 m as 01h, Grassmann alagou
        03h30). Na descida nao: a cidade estava alagada com a regua em 1,15 a
        1,24 m (1,64 a 1,77x) e limpa em 1,14x.
     2) a memoria de 6 h (pico6) nao tinha saida. Ela existe para um vale de
        leitura nao apagar o alarme, o que e certo durante o evento; depois de a
        agua sair ela mantinha a magnitude pregada no pico por 6 h.
   O recuo exige as tres coisas juntas, e por isso nao dispara no meio do
   evento: chuva parada, regua caindo e regua bem abaixo do pico de 6 h. As
   03h BRT de 29/07 (regua caindo de 1,15 para 1,04) chovia forte — a condicao
   de chuva parada era falsa e o alarme seguiu aceso, sem piscar. */
const RECUO_SECO_H=3, RECUO_SECO_MM=2, RECUO_QUEDA=2, RECUO_MARGEM=0.15;
/* Fracao do limite em que a cidade alaga DE FATO, medida na descida: 1,64x com
   a rotula da Cuca fechada, 1,14x com as ruas ja livres. 1,45 fica no meio,
   mais perto do lado observado com agua na rua. Vale so em recuo; na subida
   quem manda continua sendo o limite da regua, que da a antecedencia. */
const FLOOD_FRAC=1.45;

function soilIndex(obs){ let a=0; for(let i=0;i<obs.length;i++) a=a*SOIL_K+(obs[i]||0); return a; }
function soilSat(api){ return clamp((api-SOIL_DRY)/(SOIL_WET-SOIL_DRY),0,1); }
/* Limiar da janela FIXA de 12 h com o solo atual. O motor continua decidindo
   pela duracao que estoura primeiro (3/6/12/24 h), mas o card mostra sempre
   12 h: limiar de duracao variavel muda de janela de uma hora para a outra e
   nao da para comparar dia com dia. */
const FFG12=FFG.find(l=>l[0]===12);
function limite12(sat){ return FFG12[1]-(FFG12[1]-FFG12[2])*sat; }

/* Razao critica: para cada duracao, quanto da chuva necessaria ja caiu.
   >=1 significa que aquela duracao estourou o limiar do solo atual. */
function ffgRatio(line,end,api){
  /* best=-1 e nao 0: com chuva zero em todas as duracoes nenhuma ganhava e a
     funcao devolvia dur=null/lim=0, o que virava "faltam 0 mm em null h" —
     texto de enchente iminente em dia seco, e erro ao montar o painel. */
  const sat=soilSat(api); let best=-1,dur=null,got=0,lim=0;
  for(let j=0;j<FFG.length;j++){
    const D=FFG[j][0], l=FFG[j][1]-(FFG[j][1]-FFG[j][2])*sat;
    let g=0; for(let i=Math.max(0,end-D+1);i<=end;i++) g+=line[i]||0;
    const r=g/l;
    if(r>best){ best=r; dur=D; got=g; lim=l; }
  }
  return {ratio:best, dur, got, lim, sat, falta:Math.max(0,lim-got)};
}
/* chuva medida na rede, hora a hora: usa o maximo entre estacoes, que e o
   nucleo do evento — e o que enche o rio, nao a media diluida da bacia. */

function netRainSeries(){
  const sts=APP.NET?APP.NET.rainSt.filter(s=>Array.isArray(s.rain)):[];
  if(!sts.length) return null;
  const out=[]; for(let i=0;i<HMAX;i++){ let m=0; sts.forEach(s=>{ const v=s.rain[i]||0; if(v>m)m=v; }); out.push(m); }
  return out;
}

function fcRainAt(hAhead){
  if(!APP.FC||!APP.FC.hourly||!APP.FC.hourly.t.length) return 0;
  const now=Date.now(), t=APP.FC.hourly.t, p=APP.FC.hourly.p;
  const target=now+hAhead*3600000;
  let best=-1,bd=Infinity;
  for(let i=0;i<t.length;i++){ const d=Math.abs(new Date(t[i]).getTime()-target); if(d<bd){bd=d;best=i;} }
  return (best>=0&&bd<=5400000)?(p[best]||0):0;
}

/* Chuva medida na rede nas ultimas h horas (maximo entre estacoes, ja agregado
   em netRainSeries). Serve para saber se a chuva parou. */
function chuvaRecente(hist,h){
  let s=0; for(let i=Math.max(0,HMAX-h);i<HMAX;i++) s+=hist[i]||0;
  return s;
}
/* CANAL RIO: observacao direta, terminal. So regua validada e com leitura
   fresca. Na SUBIDA, >=100 % da cota = enchente naquele rio, ponto; >=85 % e
   subindo, tambem. Em RECUO (ver comentario de RECUO_*), o limite da regua
   deixa de valer como enchente e quem decide e FLOOD_FRAC. */
function canalRio(secou){
  let frac=0, pico6=0, subida=0, estacao=null, reguas=0;
  APP.NET.trusted.forEach(s=>{
    if(s.cotaFrac==null) return;
    reguas++;
    if(s.cotaFrac>frac){ frac=s.cotaFrac; estacao=s; }
    if(s.cotaFrac6!=null&&s.cotaFrac6>pico6) pico6=s.cotaFrac6;
    if((s.trend||0)>subida) subida=s.trend;
  });
  /* a queda vem da regua que define frac, nao da menor tendencia da rede: uma
     regua qualquer secando nao descreve o rio que esta acima do limite. */
  const desce = !!estacao && estacao.trend!=null && estacao.trend<=-RECUO_QUEDA;
  const recuo = secou && desce && frac < pico6-RECUO_MARGEM;
  let nivel=0;
  if(recuo){
    if(frac>=FLOOD_FRAC) nivel=3;
    else if(frac>=1) nivel=2;
    else if(frac>=0.85) nivel=1;
  }
  else if(frac>=1 || (pico6>=1&&frac>=0.85) || (frac>=0.85&&subida>=3)) nivel=3;
  else if(frac>=0.85) nivel=2;
  else if(frac>=0.70) nivel=1;
  return {nivel, frac, pico6, subida, recuo, estacao, reguas};
}
/* CANAL CHUVA, parte futura: hora a hora ate 48 h. O solo tambem satura com a
   chuva prevista, entao o limiar continua descendo enquanto chove — e o
   acoplamento certo, sem inflar a chuva artificialmente.
   `agora` entra pronto: e o mesmo ffgRatio do instante, ja calculado. */
function projetaChuva(hist, api, agora){
  const linha=hist.slice();
  let apiFut=api, eta=null, pico=agora, picoEm=0;
  for(let t=1;t<=ETA_H;t++){
    const mm=fcRainAt(t);
    linha.push(mm);
    apiFut=apiFut*SOIL_K+mm;
    const r=ffgRatio(linha,linha.length-1,apiFut);
    if(r.ratio>pico.ratio){ pico=r; picoEm=t; }
    if(eta==null&&r.ratio>=1) eta=t;
  }
  return {eta, pico, picoEm};
}
/* Horas para a regua bater a cota pela tendencia atual (so se subindo). */
function etaDoRio(rio){
  if(!(rio.estacao&&rio.subida>=1&&rio.frac<1&&rio.frac>=0.5)) return null;
  return Math.max(1, Math.round((rio.estacao.reg.cotaAlerta-rio.estacao.nowLevel)*100/rio.subida));
}
/* MAGNITUDE. "Acontecendo" nao distingue agua lambendo a guia de cidade tomada,
   e a diferenca e tudo pra quem decide sair de casa. O excedente sobre o limiar
   mede isso: o limiar marca onde a enchente COMECA, quanto passou dele mede o
   tamanho.
   Aferido em 29/07/2026, quando o centro alagou e a saida da cidade (rotula da
   Cuca) ficou trancada: a razao chegou a 1,66 e a regua a 177 % da cota. Fora do
   evento, nas outras 113 h, o maximo foi 0,74 — o corte de 1,35 para "grande"
   tem 82 % de folga e nao gera falso positivo. */
function magnitude(agora, rio, pico){
  /* em recuo a magnitude sai do nivel ATUAL, nao do pico de 6 h: depois de a
     agua sair, pico6 mantinha "enchente grande" na tela por 6 h (as 12h15 de
     29/07 a regua estava em 1,14x e o card dizia "grande" por causa do 1,81x
     das 06h). Durante o evento pico6 continua valendo. */
  const forca=rio.recuo ? Math.max(agora.ratio, rio.frac)
                        : Math.max(agora.ratio, rio.frac, rio.pico6);
  return {
    forca,
    sev: forca>=SEV_GRANDE?2 : (forca>=1?1:0),
    sevFut: Math.max(pico.ratio,0)>=SEV_GRANDE?2 : 1,
    excesso: Math.max(0, agora.got-agora.lim)
  };
}
function cityFlood(){
  const obs=netRainSeries();
  if(!obs&&!APP.FC) return {ok:false, level:0};
  const hist=obs||new Array(HMAX).fill(0);
  const rio=canalRio(chuvaRecente(hist,RECUO_SECO_H)<RECUO_SECO_MM);
  /* CANAL CHUVA, parte medida: o que ja caiu. */
  const api=soilIndex(hist);
  const agora=ffgRatio(hist,HMAX-1,api);
  const futuro=projetaChuva(hist, api, agora);
  const chuva = agora.ratio>=1?3 : agora.ratio>=0.75?2 : agora.ratio>=0.5?1 : 0;
  const mag=magnitude(agora, rio, futuro.pico);
  return {ok:true, level:Math.max(rio.nivel,chuva),
          rio:rio.nivel, chuva,
          rf:rio.frac, rf6:rio.pico6, rise:rio.subida, recuo:rio.recuo, rioSt:rio.estacao, nGauge:rio.reguas,
          api, sat:agora.sat, solo:soilLabel(agora.sat), lim12:limite12(agora.sat),
          now:agora, peak:futuro.pico, peakAt:futuro.picoEm, eta:futuro.eta, etaRio:etaDoRio(rio),
          sev:mag.sev, sevFut:mag.sevFut, forca:mag.forca, excesso:mag.excesso};
}
