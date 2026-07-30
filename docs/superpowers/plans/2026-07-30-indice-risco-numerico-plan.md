# Índice de Risco Numérico (1-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar os textos categóricos de risco ("Risco baixo/atenção/alto",
"improvável/possível/iminente/acontecendo/enchente grande") por um índice
numérico 1-10, sempre visível (inclusive em enchente confirmada), com cor em
5 faixas — sem inventar métricas novas: remapeia os sinais que o motor de
`enchente.js` já calcula.

**Architecture:** Uma nova camada de cálculo em `enchente.js`
(`escala()` + tabelas de âncora + `indiceAgora()`/`indiceFuturo()`) roda
dentro de `cityFlood()` e expõe `F.indiceAgora`/`F.indiceFuturo`/`F.indice`
como fonte única de verdade. `computeRisk()` para de fazer sua própria conta
discreta (0-3) e passa a ler direto do que `cityFlood()` já calculou — assim
o selo (`painel.js`/`renderSelo`) e o card "Enchente na cidade"
(`painel.js`/`floodCard`) sempre mostram o MESMO número, lido da mesma fonte.
Nenhuma regra de detecção existente (`canalRio`, os limiares aferidos em
29/07/2026) muda — só a camada de exibição por cima.

**Tech Stack:** JavaScript client-side puro (ES modules), sem framework, sem
bundler, sem suíte de testes automatizada. Verificação é feita recarregando
`serra.html` num navegador headless e lendo o estado computado via import
dinâmico do módulo (`await import('/serra/estado.js')`), técnica já usada
nesta sessão para depurar `enchente.js` ao vivo.

**Spec:** `docs/superpowers/specs/2026-07-30-indice-risco-numerico-design.md`

**Caminho base de todos os arquivos deste plano:**
`Website/Dados/Web.Data/wwwroot/` (ex.: `serra/enchente.js` abaixo significa
`Website/Dados/Web.Data/wwwroot/serra/enchente.js`). Regras do Rafael:
só mexer em `serra*`; nunca tocar `index.html`, `rsrl*.html/css/js`,
`tempo.html`, nem backend C#; manter os arquivos HTML/CSS/JS separados.

**Servidor de dev local** (para as verificações no navegador):
```bash
hub start name=rios-dev \
  application=/Users/stim4444/.dotnet/dotnet \
  args=["run","--project","Website/Dados/Web.Data/Web.Data.csproj","--urls","http://0.0.0.0:5080"]
```
A página em dev busca dado de produção (`API`/`API_FC` em `serra/config.js`
apontam pra `https://rios.bitcoineaqui.com.br` quando `location.hostname`
é `localhost`), então os números vistos no navegador local são dado real,
não mock.

---

### Task 1: Tabelas de âncora e funções de escala em `enchente.js`

**Files:**
- Modify: `serra/enchente.js:131-137` (região logo após a constante
  `FLOOD_FRAC`, antes de `soilIndex`)

- [ ] **Step 1: Ler o estado atual do arquivo para confirmar que as linhas
  não mudaram desde a última leitura desta sessão**

Rode `read` em `serra/enchente.js:125-140` e confirme que a linha 136 ainda é
`const FLOOD_FRAC=1.45;` e a linha 138 ainda é
`function soilIndex(obs){ ... }`. Se os números de linha mudaram, ajuste os
próximos passos para os números reais — o conteúdo abaixo é o que importa,
não a numeração exata.

- [ ] **Step 2: Inserir as tabelas de âncora e a função `escala()` logo
  depois de `FLOOD_FRAC` (antes de `soilIndex`)**

```javascript
/* ===== INDICE DE RISCO (1-10) ==========================================
   Camada de EXIBICAO por cima do motor acima — nao muda nenhuma regra de
   deteccao (canalRio/cityFlood continuam decidindo os estados internos do
   jeito que sempre decidiram). So remapeia os MESMOS sinais numa escala
   continua de 1 a 10, porque uma palavra ("risco baixo"/"improvavel") tem
   que escolher um corte binario que a rede de sensores nao sustenta.

   A rede so tem duas reguas confiaveis (LEVEL_TRUST em config.js: GLLS e
   BE01, as duas na bacia do Areia) e nenhuma no Rio Rolante, que tambem
   alaga a cidade. BE01 ainda cai do ar com frequencia. Por isso a regua
   NUNCA pode dominar sozinha o indice — quem manda e chuva medida + solo
   (cobre a bacia inteira, sempre disponivel); a regua so reforca quando
   esta fresca e concorda, com teto proprio bem mais baixo.

   Pontos de corte aferidos com o UNICO evento real medido ate agora
   (29/07/2026) — ver docs/superpowers/specs/2026-07-30-indice-risco-
   numerico-design.md para a justificativa de cada ancora. Conforme mais
   enchentes reais forem confirmadas em campo, estes pontos devem ser
   reajustados; e por isso ficam isolados aqui, numa unica tabela por
   canal, em vez de espalhados pelo codigo. */
function escala(pontos, x){
  if(x<=pontos[0][0]) return pontos[0][1];
  for(let i=1;i<pontos.length;i++){
    const [x0,y0]=pontos[i-1], [x1,y1]=pontos[i];
    if(x<=x1) return y0+(y1-y0)*(x-x0)/(x1-x0);
  }
  return pontos[pontos.length-1][1];
}
/* Base: chuva medida vs. limiar ajustado pelo solo (agora.ratio). 0,75 e
   1,00 sao os mesmos cortes que ja viram chuva=2/chuva=3 hoje; 1,35 e o
   SEV_GRANDE ja calibrado. */
const ESCALA_CHUVA=[[0,1],[0.5,4],[0.75,6],[1.0,8],[1.35,10]];
/* Reforco da regua (rio.frac), teto em 7 — nunca chega em 10 sozinha,
   porque e 1-2 sensores intermitentes, nunca no Rio Rolante. */
const ESCALA_REGUA=[[0,1],[0.85,4],[1.0,6],[1.35,7]];
/* Previsao: mesmos cortes de mm que computeRisk ja usa (15/40/80mm no pico
   do dia; 10mm em 24h; 60/100mm em 72h) — tres testes independentes, o
   pior vence, igual a logica OR que ja existia. Teto em 9: previsao nunca
   vira confirmacao. */
const ESCALA_PREV_DIA=[[0,1],[15,4],[40,6],[80,9]];
const ESCALA_PREV_24=[[0,1],[10,4]];
const ESCALA_PREV_72=[[0,1],[60,6],[100,9]];
/* indice "agora": o maior entre chuva+solo e o reforco da regua (quando
   fresca, confiavel, e nao em recuo confirmado — reaproveita `arrefeceu`).
   nowcast forte (chovendo >=10mm/h agora) da um empurrao extra; previsao
   que bate o limiar em ate 12h garante piso de 5 (faixa "atencao"). */
function indiceAgora(agoraRatio, rio, arrefeceu, eta){
  const base=escala(ESCALA_CHUVA, agoraRatio);
  const reforco=(rio.estacao && rio.estacao.lvFresh && !arrefeceu)
    ? escala(ESCALA_REGUA, rio.frac) : 0;
  let idx=Math.max(base, reforco);
  const nowcast=APP.FC?APP.FC.nowMm:0;
  if(nowcast>=10) idx+=2;
  if(eta!=null&&eta<=12) idx=Math.max(idx,5);
  return Math.round(Math.min(10, Math.max(1, idx)));
}
/* indice "futuro": o pior entre as tres janelas de previsao ja usadas
   hoje, cada uma na sua propria escala com o mesmo teto (9). */
function indiceFuturo(){
  if(!APP.FC) return 1;
  const pd=APP.FC.peakDay;
  const porDia=escala(ESCALA_PREV_DIA, pd?pd.mm:0);
  const porNext72=escala(ESCALA_PREV_72, APP.FC.next72||0);
  const porNext24=escala(ESCALA_PREV_24, APP.FC.next24||0);
  return Math.round(Math.max(porDia, porNext72, porNext24));
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/stim4444/Documents/APPs/Rios_BTCEA
git add "Website/Dados/Web.Data/wwwroot/serra/enchente.js"
git commit -m "feat(risco): adiciona tabelas de ancora e escala() pro indice 1-10"
```

---

### Task 2: Expor o índice em `cityFlood()`

**Files:**
- Modify: `serra/enchente.js` — função `cityFlood()` (era linhas 277-293
  antes do Task 1; vai deslocar ~50 linhas pra baixo depois do Task 1 —
  releia antes de editar)

- [ ] **Step 1: Reler `cityFlood()` para confirmar a numeração atual**

Rode `read` em `serra/enchente.js` na função `cityFlood`. O conteúdo atual
(antes desta mudança) é:

```javascript
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
          rio:rio.nivel, chuva, arrefeceu:rio.arrefeceu,
          api, sat:agora.sat, solo:soilLabel(agora.sat), lim12:limite12(agora.sat),
          now:agora, peak:futuro.pico, peakAt:futuro.picoEm, eta:futuro.eta, etaRio:etaDoRio(rio),
          sev:mag.sev, sevFut:mag.sevFut, forca:mag.forca, excesso:mag.excesso};
}
```

- [ ] **Step 2: Substituir por**

```javascript
function cityFlood(){
  const obs=netRainSeries();
  if(!obs&&!APP.FC) return {ok:false, level:0, indiceAgora:1, indiceFuturo:1, indice:1};
  const hist=obs||new Array(HMAX).fill(0);
  const rio=canalRio(chuvaRecente(hist,RECUO_SECO_H)<RECUO_SECO_MM);
  /* CANAL CHUVA, parte medida: o que ja caiu. */
  const api=soilIndex(hist);
  const agora=ffgRatio(hist,HMAX-1,api);
  const futuro=projetaChuva(hist, api, agora);
  const chuva = agora.ratio>=1?3 : agora.ratio>=0.75?2 : agora.ratio>=0.5?1 : 0;
  const mag=magnitude(agora, rio, futuro.pico);
  const idxAgora=indiceAgora(agora.ratio, rio, rio.arrefeceu, futuro.eta);
  const idxFuturo=indiceFuturo();
  return {ok:true, level:Math.max(rio.nivel,chuva),
          rio:rio.nivel, chuva, arrefeceu:rio.arrefeceu,
          indiceAgora:idxAgora, indiceFuturo:idxFuturo, indice:Math.max(idxAgora,idxFuturo),
          api, sat:agora.sat, solo:soilLabel(agora.sat), lim12:limite12(agora.sat),
          now:agora, peak:futuro.pico, peakAt:futuro.picoEm, eta:futuro.eta, etaRio:etaDoRio(rio),
          sev:mag.sev, sevFut:mag.sevFut, forca:mag.forca, excesso:mag.excesso};
}
```

(Só duas mudanças reais: o `return` do caso `!obs&&!APP.FC` ganha os três
campos de índice com piso 1; e depois de `mag` são calculados `idxAgora`/
`idxFuturo` e adicionados ao objeto retornado.)

- [ ] **Step 3: Commit**

```bash
git add "Website/Dados/Web.Data/wwwroot/serra/enchente.js"
git commit -m "feat(risco): expoe F.indiceAgora/indiceFuturo/indice em cityFlood()"
```

---

### Task 3: Simplificar `computeRisk()` para ler direto de `F`

**Files:**
- Modify: `serra/enchente.js` — função `computeRisk()` (linhas 15-40 antes
  desta mudança)

- [ ] **Step 1: Reler `computeRisk()` para confirmar a numeração atual**

Conteúdo atual (antes desta mudança):

```javascript
export function computeRisk(){
  const F=cityFlood();
  let maxFrac=0, maxTrend=0, worst=null;
  APP.NET.trusted.forEach(s=>{ const f=s.cotaFrac||0; if(f>maxFrac){maxFrac=f;worst=s;} if((s.trend||0)>maxTrend) maxTrend=s.trend||0; });
  if(!worst && APP.NET.trusted.length) worst=APP.NET.trusted[0];
  const obs12=APP.NET.rain12, obsNow=APP.NET.rainNow;
  const nowcast = APP.FC?APP.FC.nowMm:0;
  const raining = (obsNow!=null&&obsNow>=0.2) || nowcast>=0.3 || maxTrend>=8;
  /* situacao AGORA = veredito do detector (chuva caida + regua observada).
     Com `arrefeceu` (regua confirmando descida, sem chuva), o canal de chuva
     medida (F.chuva) e so um corroborador redundante de quando a regua nao
     e confiavel — com regua fresca dizendo que ja baixou, ele nao deve
     segurar "Risco atencao" sozinho. Aferido 29/07/2026 20h34: BE01 a 89,9 %
     da cota e caindo, chuva de 24 h ainda em 77 % do limiar (solo encharcado)
     — sem este ajuste o selo dizia "Risco atencao" com o rio ja abaixo do
     limite, sem chuva e sem previsao. */
  let cur = F.ok ? (F.arrefeceu ? F.rio : F.level) : 0;
  if(nowcast>=10) cur=Math.min(3,cur+1);
  // chuva prevista que ja estoura o limiar dentro de 12 h e ATENCAO no minimo
  if(F.ok&&F.eta!=null&&F.eta<=12) cur=Math.max(cur,2);
  let fut=0, futWhen="";
  if(APP.FC){ const pd=APP.FC.peakDay; if((pd&&pd.mm>=80)||APP.FC.next72>=100) fut=3; else if((pd&&pd.mm>=40)||APP.FC.next72>=60) fut=2; else if((pd&&pd.mm>=15)||APP.FC.next24>=10) fut=1; if(pd) futWhen=pd.date; }
  const level=Math.max(cur,fut);
  const drivenBy = fut>cur?"previsto":(cur>0?"agora":"previsto");
  APP.RISK={ level, cur, fut, drivenBy, raining, maxFrac, maxTrend, worst, nowcast, futWhen, obs12, obsNow, flood:F };
}
```

- [ ] **Step 2: Substituir por**

```javascript
export function computeRisk(){
  const F=cityFlood();
  let maxFrac=0, maxTrend=0, worst=null;
  APP.NET.trusted.forEach(s=>{ const f=s.cotaFrac||0; if(f>maxFrac){maxFrac=f;worst=s;} if((s.trend||0)>maxTrend) maxTrend=s.trend||0; });
  if(!worst && APP.NET.trusted.length) worst=APP.NET.trusted[0];
  const obs12=APP.NET.rain12, obsNow=APP.NET.rainNow;
  const nowcast = APP.FC?APP.FC.nowMm:0;
  const raining = (obsNow!=null&&obsNow>=0.2) || nowcast>=0.3 || maxTrend>=8;
  /* cur/fut vem prontos de cityFlood() — a mesma fonte que o card
     "Enchente na cidade" le (F.indiceAgora/F.indiceFuturo), pra selo e card
     nunca mostrarem numeros diferentes na mesma leitura. O nowcast forte, o
     piso de previsao <=12h e o reforco/teto da regua (inclusive `arrefeceu`)
     ja estao dentro de indiceAgora()/indiceFuturo(), em enchente.js. */
  const cur = F.ok ? F.indiceAgora : 1;
  const fut = F.ok ? F.indiceFuturo : 1;
  const futWhen = (APP.FC&&APP.FC.peakDay) ? APP.FC.peakDay.date : "";
  const level=Math.max(cur,fut);
  const drivenBy = fut>cur?"previsto":(cur>1?"agora":"previsto");
  APP.RISK={ level, cur, fut, drivenBy, raining, maxFrac, maxTrend, worst, nowcast, futWhen, obs12, obsNow, flood:F };
}
```

- [ ] **Step 3: Commit**

```bash
git add "Website/Dados/Web.Data/wwwroot/serra/enchente.js"
git commit -m "refactor(risco): computeRisk le indice pronto de cityFlood(), sem logica duplicada"
```

---

### Task 4: Verificação do motor (antes de mexer na tela)

**Files:** nenhum (só leitura/verificação)

- [ ] **Step 1: Subir o servidor de dev, se não estiver rodando**

```bash
hub start name=rios-dev \
  application=/Users/stim4444/.dotnet/dotnet \
  args=["run","--project","Website/Dados/Web.Data/Web.Data.csproj","--urls","http://0.0.0.0:5080"]
```

Esperar `hub wait name=rios-dev for=ready`.

- [ ] **Step 2: Abrir `serra.html` no navegador e ler o índice calculado**

```
action=open url=http://localhost:5080/serra.html
```
depois
```javascript
await tab.waitFor(2500).catch(()=>{});
const r = await tab.evaluate(async () => {
  const {APP} = await import('/serra/estado.js');
  return {
    ok: APP.RISK.flood.ok,
    indiceAgora: APP.RISK.flood.indiceAgora,
    indiceFuturo: APP.RISK.flood.indiceFuturo,
    indice: APP.RISK.flood.indice,
    riskLevel: APP.RISK.level,
    riskCur: APP.RISK.cur,
    riskFut: APP.RISK.fut,
  };
});
return r;
```

**Esperado:** `APP.RISK.level === APP.RISK.flood.indice` (mesma fonte,
mesmo número) e todos os campos entre 1 e 10 (nunca 0, nunca >10). Se
`riskLevel !== flood.indice`, tem bug de sincronização entre `computeRisk` e
`cityFlood` — parar e revisar o Task 3 antes de seguir.

- [ ] **Step 3: Não precisa commitar (passo de verificação, sem mudança de
  arquivo)**

---

### Task 5: Selo do topo mostra o número (`painel.js`)

**Files:**
- Modify: `serra/painel.js:30-50`

- [ ] **Step 1: Reler `serra/painel.js:26-50` para confirmar a numeração
  atual**

Conteúdo atual:

```javascript
const RISKLBL=["BAIXO","BAIXO","ATENÇÃO","ALTO"];
const RISKCLS=["baixo","baixo","atencao","alto"];

/* Com enchente em curso o selo para de falar em "risco": risco e o que pode
   acontecer, e isso ja aconteceu. */
function textoDoSelo(R){
  const F=R.flood;
  if(F&&F.ok&&F.level>=3) return F.sev>=2?"Enchente grande":"Enchente em curso";
  /* Estado medido, entre a enchente e o normal: o rio ainda esta acima do
     limite mas descendo, sem chuva. Dizer "Risco atenção" aqui apagava o fato
     de a agua ainda estar fora da caixa; dizer "Enchente" negava o campo. */
  if(F&&F.ok&&F.recuo&&F.rf>=1) return "Água baixando";
  return "Risco "+(R.level===0?"baixo":RISKLBL[R.level].toLowerCase());
}
function renderSelo(R){
  $("#risk-badge").className="risk-badge "+RISKCLS[R.level];
  $("#risk-label").textContent=textoDoSelo(R);
  $("#risk-when").textContent = (R.drivenBy==="previsto"&&R.futWhen)
    ? ("motivado pela previsão · "+diaCurto(R.futWhen))
    : "situação agora";
}
```

- [ ] **Step 2: Substituir por**

```javascript
/* Indice de risco 1-10 (ver enchente.js: escala/ESCALA_*): 5 faixas de cor,
   ceil(n/2) mapeia 1-2/3-4/5-6/7-8/9-10 pra nivel-1..nivel-5. O numero
   substitui TODA categoria em palavra ("baixo/atencao/alto", "enchente
   grande", "agua baixando") — inclusive quando ja e fato confirmado, por
   pedido do dono do projeto: consistencia visual em vez de dois vocabularios
   diferentes (fato vs. previsao) competindo no mesmo selo. A frase que diz
   O QUE esta acontecendo continua na manchete (function manchete(), abaixo),
   que fica de fato descritiva. */
function faixaDoIndice(n){ return "nivel-"+Math.min(5, Math.max(1, Math.ceil(n/2))); }
/* Nota de calibracao: a escala foi aferida com poucos eventos reais (o
   principal, 29/07/2026) — nao e probabilidade estatistica. O * aponta pro
   aviso no rodape (.disclaimer), sem duplicar o texto em cada card. */
const NOTA_ESCALA='<sup class="idx-nota" title="Escala com poucos dados reais para calibração — ver rodapé">*</sup>';
function renderSelo(R){
  $("#risk-badge").className="risk-badge "+faixaDoIndice(R.level);
  $("#risk-label").innerHTML=R.level+"/10"+NOTA_ESCALA;
  $("#risk-when").textContent = (R.drivenBy==="previsto"&&R.futWhen)
    ? ("motivado pela previsão · "+diaCurto(R.futWhen))
    : "situação agora";
}
```

(Remove `RISKLBL`, `RISKCLS` e `textoDoSelo` inteiros — não são mais usados
em lugar nenhum. `$("#risk-label")` muda de `.textContent` pra `.innerHTML`
porque agora carrega o `<sup>` da nota.)

- [ ] **Step 3: Confirmar que `textoDoSelo` não é chamada em nenhum outro
  lugar do arquivo antes de apagar**

```bash
grep -n "textoDoSelo\|RISKLBL\|RISKCLS" "Website/Dados/Web.Data/wwwroot/serra/painel.js"
```

Esperado: nenhuma ocorrência sobrando fora do bloco que acabou de ser
substituído.

- [ ] **Step 4: Commit**

```bash
git add "Website/Dados/Web.Data/wwwroot/serra/painel.js"
git commit -m "feat(risco): selo do topo mostra indice 1-10 em vez de categoria em palavra"
```

---

### Task 6: Card "Enchente na cidade" mostra o número (`painel.js`)

**Files:**
- Modify: `serra/painel.js:161-183` (função `floodCard`)

- [ ] **Step 1: Reler `serra/painel.js` na função `floodCard` para
  confirmar a numeração atual**

Conteúdo atual:

```javascript
function floodCard(F){
  if(!F.ok) return qk("Enchente na cidade","--","","sem chuva medida ou prevista",false);
  const grande = F.sev>=2;
  // valor longo ("enchente grande") sem unidade ao lado, senao quebra a linha
  const v = grande?"enchente grande":"acontecendo", u = grande?"":"agora";
  if(F.rio>=3&&F.chuva>=3) return qk("Enchente na cidade",v,u, "rio acima do limite e chuva acima do que o solo aguenta", true);
  if(F.rio>=3)             return qk("Enchente na cidade",v,u, "rio acima do limite", true);
  if(F.chuva>=3)           return qk("Enchente na cidade",v,u, "chuva acima do que o solo aguenta", true);
  /* Recuo com regua ainda acima do limite: sem esta linha o card caia direto em
     "improvável", que e falso enquanto a agua nao voltou para a caixa. */
  if(F.recuo&&F.rf>=1)
    return qk("Enchente na cidade","baixando","", "rio ainda acima do limite e descendo, sem chuva há 3 h", true);
  /* "iminente" exige CORROBORACAO: extrapolar a subida da regua sozinha da
     falso positivo. Em 28/07 09h a BE01 subia 4,5 cm/h a 80 % da cota e a
     reta batia a cota em 3 h — mas o solo ainda absorvia (razao 0,49) e nao
     houve alagamento. Só vale com a chuva ja em faixa de atencao. */
  if(F.etaRio!=null&&F.etaRio<=6&&F.chuva>=2)
    return qk("Enchente na cidade","iminente", quandoTxt(F.etaRio), "pelo ritmo de subida do rio", true);
  if(F.eta!=null)
    return qk("Enchente na cidade","possível", quandoTxt(F.eta),
      "pela chuva prevista · faltam "+fmt(F.now.falta,0)+" mm", true);
  return qk("Enchente na cidade","improvável","nas próximas 48 h", "chuva prevista abaixo do limite", false);
}
```

- [ ] **Step 2: Substituir por**

```javascript
function floodCard(F){
  if(!F.ok) return qk("Enchente na cidade","--","","sem chuva medida ou prevista",false);
  /* O VALOR vira o mesmo indice 1-10 do selo (F.indice — fonte unica, ver
     cityFlood() em enchente.js), em vez da palavra-veredito
     (grande/acontecendo/iminente/possivel/improvavel). O "sub" (linha
     pequena de explicacao) e o "u" (contexto de tempo: "agora"/"em Xh"/
     "nas proximas 48h") continuam EXATAMENTE como estavam — sao descricao
     de fato, nao categoria de risco, entao nao precisam virar numero.
     `hl` (realce visual do card) passa a acompanhar o proprio indice
     (>=7, faixas laranja/vermelho) em vez de ligado por branch — antes TODO
     estado "preditivo" (ate "possivel", o mais fraco) ja vinha com hl=true;
     agora so realca quando o numero de fato justifica. */
  const v = F.indice+"/10"+NOTA_ESCALA, hl = F.indice>=7;
  if(F.rio>=3&&F.chuva>=3) return qk("Enchente na cidade",v,"agora", "rio acima do limite e chuva acima do que o solo aguenta", hl);
  if(F.rio>=3)             return qk("Enchente na cidade",v,"agora", "rio acima do limite", hl);
  if(F.chuva>=3)           return qk("Enchente na cidade",v,"agora", "chuva acima do que o solo aguenta", hl);
  if(F.recuo&&F.rf>=1)
    return qk("Enchente na cidade",v,"", "rio ainda acima do limite e descendo, sem chuva há 3 h", hl);
  if(F.etaRio!=null&&F.etaRio<=6&&F.chuva>=2)
    return qk("Enchente na cidade",v, quandoTxt(F.etaRio), "pelo ritmo de subida do rio", hl);
  if(F.eta!=null)
    return qk("Enchente na cidade",v, quandoTxt(F.eta),
      "pela chuva prevista · faltam "+fmt(F.now.falta,0)+" mm", hl);
  return qk("Enchente na cidade",v,"nas próximas 48 h", "chuva prevista abaixo do limite", hl);
}
```

- [ ] **Step 3: Commit**

```bash
git add "Website/Dados/Web.Data/wwwroot/serra/painel.js"
git commit -m "feat(risco): card 'Enchente na cidade' mostra indice 1-10, mantem contexto de tempo"
```

---

### Task 7: CSS — 5 faixas de cor e nota de escala

**Files:**
- Modify: `serra.css:1-31` (bloco `:root`)
- Modify: `serra.css:388-393` (bloco `.risk-badge`)
- Modify: `serra.css:481-499` (bloco `body.storm`, tema escuro)

- [ ] **Step 1: Reler `serra.css:16-31` para confirmar a numeração atual e
  inserir a cor nova logo depois de `--alert`**

Conteúdo atual (linhas 28-31):
```css
  --warn:      oklch(0.720 0.135 78);
  --warn-deep: oklch(0.590 0.130 66);
  --alert:     oklch(0.585 0.155 38);

```

Substituir por:
```css
  --warn:      oklch(0.720 0.135 78);
  --warn-deep: oklch(0.590 0.130 66);
  --alert:     oklch(0.585 0.155 38);
  /* Faixa 2 do indice de risco (1-10): entre --moss (verde) e --warn
     (amarelo), pra completar o degrade de 5 cores sem inventar paleta nova. */
  --verdeamarelo:      oklch(0.680 0.122 105);
  --verdeamarelo-deep: oklch(0.555 0.114 100);

```

- [ ] **Step 2: Reler `serra.css:385-404` (bloco `.risk-badge`) e
  substituir as 3 classes de faixa por 5**

Conteúdo atual (linhas 391-393):
```css
.risk-badge.baixo{ background: oklch(0.64 0.11 132 / 0.16); color: var(--moss-deep); } .risk-badge.baixo .pdot{ background: var(--moss); }
.risk-badge.atencao{ background: oklch(0.72 0.135 78 / 0.18); color: var(--warn-deep); } .risk-badge.atencao .pdot{ background: var(--warn); }
.risk-badge.alto{ background: oklch(0.585 0.155 38 / 0.16); color: var(--alert); } .risk-badge.alto .pdot{ background: var(--alert); animation: pulse 2.4s ease-out infinite; }
```

Substituir por:
```css
/* 5 faixas do indice de risco 1-10 (ver painel.js/faixaDoIndice): 1-2 verde,
   3-4 verde-amarelado, 5-6 amarelo, 7-8 laranja, 9-10 vermelho (pulsa,
   igual ao "alto" de 3 faixas que existia antes). */
.risk-badge.nivel-1{ background: oklch(0.64 0.11 132 / 0.16); color: var(--moss-deep); } .risk-badge.nivel-1 .pdot{ background: var(--moss); }
.risk-badge.nivel-2{ background: oklch(0.680 0.122 105 / 0.16); color: var(--verdeamarelo-deep); } .risk-badge.nivel-2 .pdot{ background: var(--verdeamarelo); }
.risk-badge.nivel-3{ background: oklch(0.72 0.135 78 / 0.18); color: var(--warn-deep); } .risk-badge.nivel-3 .pdot{ background: var(--warn); }
.risk-badge.nivel-4{ background: oklch(0.610 0.120 55 / 0.18); color: var(--terra-deep); } .risk-badge.nivel-4 .pdot{ background: var(--terra); }
.risk-badge.nivel-5{ background: oklch(0.585 0.155 38 / 0.16); color: var(--alert); } .risk-badge.nivel-5 .pdot{ background: var(--alert); animation: pulse 2.4s ease-out infinite; }
```

- [ ] **Step 3: Adicionar o estilo da nota `*` — inserir logo depois do
  bloco `.qk.hl` (linha 404 antes desta mudança)**

Conteúdo atual (linha 404):
```css
.qk.hl{ background: linear-gradient(180deg, oklch(0.72 0.135 78 / 0.09), var(--surface)); border-color: oklch(0.72 0.135 78 / 0.28); }
```

Inserir logo depois:
```css
.idx-nota{ font-size:0.62em; color:var(--muted); font-weight:600; margin-left:1px; cursor:help; vertical-align:super; }
```

- [ ] **Step 4: Reler `serra.css:481-499` (bloco `body.storm`, tema escuro)
  e adicionar a variante escura da cor nova**

Conteúdo atual (linha 487):
```css
  --moss-deep: oklch(0.80 0.11 150); --teal-deep: oklch(0.82 0.10 210); --teal: oklch(0.80 0.10 205); --terra-deep: oklch(0.82 0.13 55); --terra: oklch(0.80 0.13 55);
```

Substituir por:
```css
  --moss-deep: oklch(0.80 0.11 150); --teal-deep: oklch(0.82 0.10 210); --teal: oklch(0.80 0.10 205); --terra-deep: oklch(0.82 0.13 55); --terra: oklch(0.80 0.13 55);
  --verdeamarelo-deep: oklch(0.83 0.11 100); --verdeamarelo: oklch(0.81 0.11 105);
```

- [ ] **Step 5: Commit**

```bash
git add "Website/Dados/Web.Data/wwwroot/serra.css"
git commit -m "feat(risco): 5 faixas de cor pro indice 1-10, tema claro e escuro"
```

---

### Task 8: HTML — classe inicial do selo e aviso de calibração no rodapé

**Files:**
- Modify: `serra.html:62` (classe inicial do selo, antes do JS rodar)
- Modify: `serra.html:118-122` (rodapé `.disclaimer`)

- [ ] **Step 1: Reler `serra.html:58-67` e trocar a classe inicial do
  selo**

Conteúdo atual (linha 62):
```html
        <span class="risk-badge baixo" id="risk-badge"><span class="pdot"></span><span id="risk-label">avaliando</span></span>
```

Substituir por:
```html
        <span class="risk-badge nivel-1" id="risk-badge"><span class="pdot"></span><span id="risk-label">avaliando</span></span>
```

- [ ] **Step 2: Reler `serra.html:118-122` e acrescentar a frase de
  calibração no rodapé**

Conteúdo atual:
```html
  <p class="disclaimer">
    Leituras das estações da rede e previsão do Open-Meteo, publicadas como medidas, sem
    garantia de disponibilidade ou exatidão. Não é aviso oficial: alertas e orientações de
    segurança são da Defesa Civil e do Corpo de Bombeiros.
  </p>
```

Substituir por:
```html
  <p class="disclaimer">
    Leituras das estações da rede e previsão do Open-Meteo, publicadas como medidas, sem
    garantia de disponibilidade ou exatidão. Não é aviso oficial: alertas e orientações de
    segurança são da Defesa Civil e do Corpo de Bombeiros.
    <br>* Escala de risco de 1 a 10 construída a partir de poucos eventos reais medidos
    (o principal: 29/07/2026) — não é uma probabilidade estatística calibrada. Conforme
    mais enchentes reais forem confirmadas, os pontos de corte serão reajustados.
  </p>
```

- [ ] **Step 3: Commit**

```bash
git add "Website/Dados/Web.Data/wwwroot/serra.html"
git commit -m "feat(risco): classe inicial nivel-1 no selo e nota de calibracao no rodape"
```

---

### Task 9: Verificação end-to-end no navegador

**Files:** nenhum (só leitura/verificação)

- [ ] **Step 1: Recarregar `serra.html` e ler texto + classes renderizadas**

```
action=open url=http://localhost:5080/serra.html
```
depois
```javascript
await tab.waitFor(2500).catch(()=>{});
const r = await tab.evaluate(async () => {
  const {APP} = await import('/serra/estado.js');
  const badgeLabel = document.getElementById('risk-label')?.textContent;
  const badgeClass = document.getElementById('risk-badge')?.className;
  const cards = [...document.querySelectorAll('.qk')].map(el => el.outerHTML);
  const floodCard = cards.find(c => c.includes('Enchente na cidade'));
  return {
    badgeLabel, badgeClass,
    indiceAgora: APP.RISK.flood.indiceAgora,
    indiceFuturo: APP.RISK.flood.indiceFuturo,
    riskLevel: APP.RISK.level,
    floodCard,
  };
});
return r;
```

**Esperado (checar os quatro):**
1. `badgeLabel` bate com `riskLevel+"/10"` (mais o `*` da nota).
2. `badgeClass` é `risk-badge nivel-N`, onde `N = Math.min(5, Math.max(1,
   Math.ceil(riskLevel/2)))`.
3. `floodCard` contém o MESMO número que `badgeLabel` (fonte única —
   `F.indice === APP.RISK.level`).
4. Nenhum texto categórico sobrou na tela: rodar
   `document.body.innerText.match(/risco (baixo|atenção|alto)|improvável|possível|iminente|acontecendo|enchente grande/i)`
   dentro do mesmo `tab.evaluate` e confirmar que retorna `null`.

- [ ] **Step 2: Checar o rodapé**

```javascript
const r = await tab.evaluate(() => document.querySelector('.disclaimer')?.textContent);
return r;
```

**Esperado:** contém "Escala de risco de 1 a 10" e "não é uma probabilidade
estatística calibrada".

- [ ] **Step 3: Verificar por cálculo direto os 2 cenários do spec que
  não dá pra reproduzir com dado real de hoje (`escala()`/`ESCALA_*` não
  são exportados do módulo — a verificação replica a MESMA fórmula do
  Task 1 fora do app, não testa o código publicado; é checagem de
  matemática, não de integração)**

```python
def escala(pontos, x):
    if x <= pontos[0][0]: return pontos[0][1]
    for i in range(1, len(pontos)):
        x0, y0 = pontos[i-1]; x1, y1 = pontos[i]
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pontos[-1][1]

ESCALA_CHUVA = [(0,1),(0.5,4),(0.75,6),(1.0,8),(1.35,10)]
ESCALA_REGUA = [(0,1),(0.85,4),(1.0,6),(1.35,7)]
ESCALA_PREV_DIA = [(0,1),(15,4),(40,6),(80,9)]

# Cenario 1 (spec): enchente confirmada — rio.frac=1.35 E chuva ratio=1.35 (ambos concordam)
base = escala(ESCALA_CHUVA, 1.35)   # 10
reforco = escala(ESCALA_REGUA, 1.35)  # 7 (teto da regua sozinha)
indice_confirmado = round(min(10, max(base, reforco)))
assert indice_confirmado == 10, indice_confirmado

# Cenario 2 (spec): previsao isolada de 80mm no pico do dia, sem chuva medida
# nem regua alta — indice futuro nunca deve chegar a 10.
indice_futuro_isolado = round(escala(ESCALA_PREV_DIA, 80))
assert indice_futuro_isolado == 9, indice_futuro_isolado
assert indice_futuro_isolado < 10

print("OK:", indice_confirmado, indice_futuro_isolado)
```

Rode isso no `eval` (linguagem `py`). **Esperado:** imprime `OK: 10 9` sem
`AssertionError`. Se algum assert falhar, a fórmula implementada no Task 1
diverge do que o spec pede — corrigir lá antes de seguir.

- [ ] **Step 4: TWINS — buscar qualquer outro lugar do app que ainda
  mostre texto categórico de risco fora de escopo (deve dar zero, porque o
  design já definiu que manchete/sub/outros cards ficam como estão — isto
  é só uma confirmação de que a busca foi feita, não uma correção)**

```bash
grep -rn "Risco baixo\|Risco atenção\|Risco alto\|RISKLBL\|RISKCLS\|textoDoSelo" "Website/Dados/Web.Data/wwwroot/serra/"
```

**Esperado:** nenhuma ocorrência (o vocabulário só existia em `painel.js`,
já removido no Task 5).

- [ ] **Step 5: Sem commit neste task** (é só verificação — se algo falhar,
  volte ao task correspondente, corrija, e repita a verificação)

---

## Resumo do que muda por arquivo

- `serra/enchente.js`: +1 seção nova (tabelas de âncora + `escala()` +
  `indiceAgora()`/`indiceFuturo()`), `cityFlood()` ganha 3 campos no
  retorno, `computeRisk()` fica mais simples (menos lógica duplicada).
- `serra/painel.js`: `RISKLBL`/`RISKCLS`/`textoDoSelo` removidos,
  `faixaDoIndice`/`NOTA_ESCALA` novos, `renderSelo`/`floodCard` reescritos
  pra mostrar número. `manchete`, `linhaDeApoio`, `cardDeSolo`, `cardDeRio`,
  `cardDeChuvaMedida`, `cardDeChuvaPrevista`, `cardDeProximaChuva`,
  `qk()` — **nenhum muda**.
- `serra.css`: 2 variáveis de cor novas (clara + escura), 3 classes
  `.risk-badge.*` viram 5, 1 classe nova `.idx-nota`. Resto do arquivo
  intocado.
- `serra.html`: 1 atributo `class` trocado, 1 frase a mais no rodapé
  existente. Resto do arquivo intocado.

## Fora de escopo (confirmado no design doc, não repetir aqui)

Backend C#, `index.html`/`rsrl*`/`tempo.html`, calibração estatística real,
qualquer junção dos arquivos separados HTML/CSS/JS.
