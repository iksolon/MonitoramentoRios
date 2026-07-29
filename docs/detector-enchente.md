# Detector de enchente — método, calibração e como refinar

**Leia este arquivo antes de mexer em qualquer conta do detector de enchente do
`Web.Data/wwwroot/serra.html`.** Ele existe para que um próximo refinamento
parta do que já foi medido, e não do zero.

O detector foi reescrito e aferido contra o evento real de **29 de julho de
2026** em Rolante/RS. Toda constante aqui tem um número de campo por trás. Se
você for mudar uma, precisa dizer qual medida justifica a mudança.

---

## 1. O evento de referência (29/07/2026)

O que aconteceu, pelos boletins do Corpo de Bombeiros e por vídeos da cidade:

| Hora (BRT) | Fato |
|---|---|
| 03h30 | Rio Areia sai da caixa no bairro **Grassmann** (onde o Areia entra na cidade) |
| 07h00 | **Rótula da Cuca** intransitável — saída da cidade em direção a Taquara, já com o Rolante emendado ao Areia |
| manhã | Vídeos confirmam **enchente grande**: ruas do centro tomadas, saída trancada |

Números medidos pela própria rede (janela de 121 h, de 24/07 07h a 29/07 07h BRT):

| Grandeza | Valor no pico |
|---|---|
| Chuva total em 72 h | **180,8 mm** (em três pulsos separados, não um temporal) |
| Máximo em 12 h | **78,2 mm** |
| Máximo em 24 h | **141,3 mm** |
| Chuva nas 72 h *anteriores* às últimas 12 h | **98,5 mm** (solo já saturado) |
| Pico de intensidade | **17,8 mm/h** às 01h; 49 mm em 3 h |
| Régua RSRL-BE01 (limite 0,70 m) | passou do limite à **01h**; chegou a **1,24 m = 177%** às 06h |

### Por que o motor antigo errou

O motor antigo perguntava uma coisa só: *"choveu 100 mm em 12 h?"*. Replay hora
a hora sobre esse mesmo dado real mostrou o que a página dizia:

```
29/07 00h  "improvável"   (faltavam 38,8 mm)   <- 3h30 antes do Grassmann
29/07 01h  "possível em 2 h"                    <- único aviso, e curto
29/07 03h  "acontecendo"  por 4,5 mm de folga, já alagando
29/07 06h  "IMPROVÁVEL"   <- negou com o centro alagando
29/07 07h  "IMPROVÁVEL"   <- e com a rótula da Cuca fechada
```

Quatro causas, todas mensuráveis:

1. **Janela fixa de 12 h.** O pico de 12 h chegou a 78,2 mm e o limiar pedia
   80–100 mm. Um evento de três pulsos em 60 h era invisível para essa janela.
2. **Solo só contava para o futuro.** O fator `amp = 1 + chuva24/150` (teto 1,5)
   multiplicava a chuva *prevista*, e o teste de "acontecendo" olhava só a
   medida. Além disso ficou pregado em 1,50 por 21 h seguidas — parou de
   informar exatamente quando importava.
3. **Rio acima do limite valia 20%.** `frac = clamp(nível/cota, 0, 1)` dava no
   máximo 20% de desconto no limiar. A régua a 177% do limite mexeu 20%.
4. **Degrau seco no limiar.** O bônus de 10% exigia subida ≥ 10 cm/h; a
   tendência oscilou em torno de 10 e o limiar pulou 72 ↔ 80 mm. Foi isso que
   fez o veredito piscar de "acontecendo" para "improvável".

---

## 2. O método atual

**Dois canais independentes; vale o pior. Canal calado nunca cancela o outro** —
régua morta não pode deixar o alarme mais difícil de disparar. Essa é a regra
estrutural mais importante do desenho; não a quebre.

### Canal RIO — observação direta, terminal

Só régua validada (`LEVEL_TRUST`) e com leitura fresca.

```
f  = nível / limite        (SEM TETO — 1,77 é um valor legítimo)
f6 = máximo de f nas últimas 6 h

f >= 1                      -> enchente
f6 >= 1 e f >= 0,85         -> enchente (água de enchente escoa devagar)
f >= 0,85 e subindo >= 3    -> enchente
f >= 0,85                   -> atenção
f >= 0,70                   -> observação
```

A memória de 6 h existe porque uma leitura mais baixa não pode apagar o alarme
— foi o que derrubou o veredito às 06h no motor antigo.

### Canal RIO — recuo (água saindo)

O limite da régua é nível de **aviso**, não nível de rua alagada. Na subida ele
vale justamente por isso: a `BE01` cruzou 0,70 m às 01h e o Grassmann alagou às
03h30 — 2h30 de antecedência. Na **descida** o mesmo número mente: a cidade
estava alagada com a régua entre 1,15 m e 1,24 m (1,64x a 1,77x) e já estava
limpa com a régua em 0,795 m (1,14x).

Por isso existe um estado de recuo, que exige as três condições **juntas**:

```
chuva medida nas últimas 3 h  <  2 mm      (parou de chover)
tendência da régua que define f  <=  -2 cm/h   (está caindo)
f  <  f6 - 0,15                            (bem abaixo do pico de 6 h)
```

Em recuo, duas coisas mudam:

```
f >= 1,45  -> enchente     (FLOOD_FRAC: onde a cidade alaga de fato)
f >= 1,00  -> "água baixando"  (atenção; rio ainda fora da caixa)
f >= 0,85  -> observação
```

e a **magnitude passa a sair de `f`, não de `f6`** — sem isso a memória de 6 h
mantinha "enchente grande" na tela por 6 h depois de a água sair.

As três condições são o que impede o recuo de disparar no meio do evento: às
03h de 29/07 a régua caía de 1,15 m para 1,04 m, mas chovia forte, então a
condição de chuva parada era falsa e o alarme seguiu aceso sem piscar.

`FLOOD_FRAC = 1,45` fica entre os dois valores observados na descida (1,64 com
água na rua, 1,14 sem), mais perto do lado com água. Vale **só em recuo**; na
subida quem manda continua sendo o limite da régua.

### Canal CHUVA — guia de enchente relâmpago, estilo FFG

Duas peças: um índice de solo, e limiares que descem conforme o solo satura,
testados em quatro durações ao mesmo tempo.

**Índice de solo (API)** — chuva acumulada com decaimento exponencial:

```
API = Σ chuva_i · k^(idade_i)        k = 0,5^(1/48)
```

Meia-vida de **48 h**, escolhida para bacia pequena e encaixada (cabeceira a
880 m, cidade a 44 m): esvazia rápido, mas guarda memória de dois a três dias.

**Saturação** — quanto o solo já está carregado, de 0 a 1:

```
sat = clamp((API - 40) / (140 - 40), 0, 1)
```

Âncoras aferidas: **40 mm** ainda é solo que absorve; **140 mm** é solo que
devolve quase tudo (no momento da enchente o índice estava em 142,6 mm).

**Limiares por duração** — `[horas, mm com solo seco, mm com solo saturado]`:

| Duração | Solo seco | Solo saturado |
|---|---|---|
| 3 h | 70 mm | 35 mm |
| 6 h | 95 mm | 48 mm |
| 12 h | 120 mm | 62 mm |
| 24 h | 150 mm | 85 mm |

```
limite(D) = seco(D) - (seco(D) - saturado(D)) · sat
razão(D)  = chuva_medida_em_D / limite(D)
razão crítica = máximo das quatro razões    (quem estourar primeiro manda)
```

Sublinear na duração (mm de aguaceiro curto pesa mais) e cai ~50% de seco a
saturado. No pico do evento a duração que estourou primeiro foi a de **24 h**:
141,3 mm contra limite de 85 mm.

```
razão >= 1,00  -> enchente
razão >= 0,75  -> atenção
razão >= 0,50  -> observação
```

**Previsão** entra na mesma máquina: hora a hora até 48 h à frente, o solo
também satura com a chuva prevista, então o limite continua descendo enquanto
chove. É o acoplamento certo — nunca infle a chuva artificialmente, faça o
limite descer.

### Magnitude

O limiar marca **onde a enchente começa**; o excedente mede **o tamanho**.

```
força = máx(razão crítica, f, f6)
força >= 1,35  ->  "enchente grande"
força >= 1,00  ->  "enchente"
```

O corte de 1,35 tem **82% de folga**: no evento a força chegou a 1,66, e fora
dele o máximo em 5 dias foi 0,74.

### Onde as constantes moram

O front-end de `serra.html` foi separado em três camadas: o HTML ficou só com a
estrutura, o estilo em `Web.Data/wwwroot/serra.css` e o comportamento em módulos
dentro de `Web.Data/wwwroot/serra/`. As contas do detector estão em
`serra/enchente.js`; os limiares de régua e a lista de confiança, em
`serra/config.js`.

| Constante | Arquivo | Valor |
|---|---|---|
| `FFG` (limiares por duração) | `serra/enchente.js` | `[[3,70,35],[6,95,48],[12,120,62],[24,150,85]]` |
| `SOIL_HL`, `SOIL_DRY`, `SOIL_WET`, `ETA_H` | `serra/enchente.js` | `48, 40, 140, 48` |
| `SEV_GRANDE` | `serra/enchente.js` | `1.35` |
| `RECUO_SECO_H`, `RECUO_SECO_MM`, `RECUO_QUEDA`, `RECUO_MARGEM` | `serra/enchente.js` | `3, 2, 2, 0.15` |
| `FLOOD_FRAC` | `serra/enchente.js` | `1.45` |
| `LV_CARRY`, `LV_MAXAGE`, `LV_MINCOV` | `serra/config.js` | `3, 3, 3` |
| `LEVEL_TRUST` / `LEVEL_CHECK` | `serra/config.js` | `{GLLS, BE01}` / `{AR01}` |

Funções do motor, todas em `serra/enchente.js`: `soilIndex()`, `soilSat()`,
`ffgRatio()`, `chuvaRecente()`, `canalRio()`, `projetaChuva()`, `magnitude()`,
`cityFlood()`, `computeRisk()`. O texto do card de enchente é `floodCard()`, em
`serra/painel.js` — é apresentação, não conta.

Quem lê a régua e monta as séries é `serra/dados.js`; os filtros de série
(despike Hampel, Theil-Sen, confirmação de duas amostras) estão em
`serra/serie.js`.

---

## 3. Resultado da calibração (o que não pode regredir)

Replay do detector atual sobre 121 h de dado real, hora a hora (varredura de
24/07 03h a 29/07 15h BRT, servidor de replay + navegador em 420 px):

| Hora (BRT) | Selo | Veredito |
|---|---|---|
| 24/07 a 27/07 | Risco baixo | improvável (todas as 93 horas) |
| 28/07 09h–15h | baixo/atenção | improvável |
| 28/07 16h–22h | atenção | **possível amanhã 03h** — 11h30 de antecedência |
| 28/07 23h | atenção | possível amanhã 01h, faltam 14 mm |
| 29/07 00h | **Enchente em curso** | **acontecendo** — 3h30 antes do Grassmann |
| 29/07 02h–09h | **Enchente grande** | força ≥ 1,35 · Grassmann alaga 03h30, rótula da Cuca fecha 07h |
| 29/07 10h–11h | Enchente em curso | rio descendo, ainda chovendo na janela de 3 h |
| 29/07 12h–15h | **Água baixando** | rio ainda acima do limite e descendo, sem chuva há 3 h |

A virada para "Água baixando" às 12h casa com a observação de campo: às 12h15
de 29/07 o dono do projeto confirmou "a enchente já se foi praticamente toda,
só as ruas sujas no centro".

**Critérios de aceitação para qualquer mudança futura:**

1. Dispara "acontecendo" em **29/07 00h ou antes**.
2. **Não pisca**: uma vez aceso às 00h, segue aceso de 00h a 11h sem voltar.
3. **Zero falso positivo** nas 93 h de 24/07 a 27/07. Dia 28 para em "atenção" —
   correto, o rio esteve a 84–87% do limite e não houve alagamento reportado.
4. "enchente grande" só nas horas em que a força passa de 1,35 (02h–09h).
5. **Sai da enchente pelo recuo, não pelo limite da régua**: às 12h de 29/07 diz
   "água baixando" com a régua ainda a 1,14x o limite. Dizer "enchente" ali é
   regressão; dizer "improvável" também.
6. Zero erro de JS e zero overflow horizontal em tela de 420 px.

---

## 4. Como recalibrar com dados novos

O procedimento abaixo foi o que produziu esta calibração. Siga na ordem.

### 4.1 Baixar os dados do evento (somente leitura da produção)

```bash
python3 docs/replay/baixar-dados.py            # grava /tmp/riosreplay/fixture.json
python3 docs/replay/baixar-dados.py --horas 240 --saida /tmp/ev2.json
```

Produção é **somente leitura**. Nunca escrever nada lá.

### 4.2 Medir o que o app DIZIA, hora a hora

Antes de mudar qualquer constante, porte o motor atual para Python e rode
replay hora a hora sobre o dado do evento. Sem essa tabela você está adivinhando
onde está o erro. Foi ela que revelou que o motor antigo voltava a dizer
"improvável" às 06h.

Monte uma tabela com, para cada hora: chuva 3/6/12/24 h, API, razão crítica por
duração, fração do limite em cada régua validada, e o veredito resultante.

### 4.3 Ajustar e checar os dois lados

Toda mudança de limiar tem dois custos. Meça os dois:

- **Sensibilidade**: em que hora passa a disparar no evento novo?
- **Falso positivo**: quantas horas *sem* enchente passam a disparar?

Relate sempre a folga: a distância entre o pior valor durante o evento e o
maior valor fora dele. Um limiar sem folga declarada não está calibrado, está
ajustado no olho.

### 4.4 Confirmar na página real, não só no Python

O Python valida a conta; o navegador valida o que o usuário vê. Suba o servidor
de replay, que serve o `serra.html` de verdade fingindo a API e cortando o dado
num instante escolhido:

```bash
node docs/replay/servidor-replay.js 5099 Web.Data/wwwroot/serra.html
# depois, no navegador:
#   http://127.0.0.1:5099/serra.html?api=&clock=2026-07-29T06
# clock = instante em UTC (BRT + 3 h). O servidor injeta o shim de relógio
# no próprio HTML e corta todo o dado nesse ponto.
```

Varra várias horas e confira: veredito, selo, ausência de erro de JS e
`scrollWidth == clientWidth` em 420 px de largura.

**Três armadilhas que custaram tempo:**

- Instalar o shim de relógio via CDP (`page.evaluateOnNewDocument`) **desanexa o
  frame** depois de algumas dezenas de navegações. Por isso o shim é injetado no
  HTML pelo servidor.
- O servidor relê o arquivo a cada requisição. Se ele fizer cache, você vai
  testar a versão antiga sem perceber.
- O servidor precisa servir `serra.css` e `serra/*.js` **como arquivo, com o
  content-type de javascript**. Enquanto ele devolvia o HTML para qualquer
  caminho, o navegador recebia HTML no lugar do módulo e a página não subia.

### 4.5 Depois de editar, sempre

```bash
# sintaxe de cada módulo (o comportamento vem em módulos ES, não mais inline)
for f in Web.Data/wwwroot/serra/*.js; do node --check "$f" || echo "FALHOU: $f"; done
```


Um `}` comido não aparece em lugar nenhum até a página abrir em branco. Este
check é obrigatório. Depois dele, confirme que **todo import resolve**: um nome
exportado que você renomeou quebra só em tempo de carga, e o sintoma é a página
em branco sem erro visível no servidor.

---

## 5. Limitações conhecidas (candidatas ao próximo refinamento)

Em ordem de impacto:

1. **Calibração com n = 1.** As quatro linhas da tabela `FFG` vêm de um único
   evento. Cada evento novo deve ser adicionado ao registro da seção 7 e os
   limiares reavaliados contra o conjunto, não contra o último.

2. **A bacia do Areia não tem régua utilizável perto da cidade.** A `RSRL-AR01`
   (Rio Areia, o rio que alagou o Grassmann) tem ruído de ~35 cm/h e não
   responde ao evento — leu 2,87 m no pico e 4,20 m antes de começar. Está em
   `LEVEL_CHECK` e não decide nada. **Consertar esse sensor é o maior ganho
   possível** para o detector: hoje toda a decisão de nível vem da `RSRL-BE01`.

3. **A `RSRL-GLLS` está praticamente morta**: mandou 1 leitura em 121 h. E essa
   leitura era 2,04 m com limite de 2,00 m — Rolantinho acima do limite,
   informação perdida por falta de telemetria.

4. **Não guardamos o histórico da previsão.** A tabela `TBWeather` só tem a
   previsão vigente, então não é possível replayar o que o modelo dizia na
   véspera. Isso limita a aferição da antecedência: os 10h30 medidos são um
   piso, o valor real provavelmente era maior. **Gravar a previsão com o
   `coletaUTC` e nunca apagar** permitiria medir a antecedência de verdade.

5. **Sem limiar de intensidade explícito.** A duração de 3 h captura burst
   indiretamente, mas não existe critério de "x mm em 30 min". Se um evento
   futuro for de aguaceiro curto e o de 3 h não pegar, é aqui que se mexe.

6. **`SEV_GRANDE` tem um degrau só.** Só distingue "enchente" de "enchente
   grande". Com mais eventos catalogados dá para escalonar melhor.

---

## 6. Regras que não são sobre cálculo, e valem igual

Decisões do dono do projeto. Respeite-as ao mexer em qualquer texto:

- **A página publica DADO, não conselho.** É proibido orientar conduta ("fique
  atento", "acompanhar de perto"), prever local específico ("ruas do centro sob
  risco de bloqueio") ou especular trajeto da água. Risco jurídico.
- **Não explicar o método na tela.** Já existiu um painel "Como o app decidiu"
  com um parágrafo ensinando hidrologia. Foi removido. Não recrie.
- Número em prosa que soa promessa ("bastam 85 mm para transbordar") é proibido.
  O mesmo número dentro de um card rotulado é dado, e pode.
- Vocabulário sem jargão: **"limite"**, nunca "cota". Centímetros acima/abaixo
  do limite, nunca "% da cota". Código de estação só como rótulo em card de
  régua, nunca em frase.
- Não duplicar: se um card mostra "Rio acima do limite · 54 cm", a prosa não
  repete a mesma coisa.
- O aviso legal fica **uma vez**, no rodapé.
- **Deploy em produção é do usuário.** O agente commita e para.

Para revisar texto, carregue a página e liste todos os nós de texto acima de ~35
caracteres com um `TreeWalker`. Cada trecho precisa se justificar como dado,
legenda de gráfico, fonte, estado atual ou aviso legal. Isso revela duplicação
que grep não pega.

---

## 7. Registro de eventos

Acrescente um bloco por evento. É este registro que transforma n = 1 em
calibração de verdade.

### 2026-07-29 — Rolante, enchente grande

| | |
|---|---|
| **Observado** | 03h30 Rio Areia sai da caixa no Grassmann; 07h00 rótula da Cuca intransitável; ruas do centro tomadas |
| **Fim observado** | 12h15 — "a enchente já se foi praticamente toda, só as ruas sujas no centro" (dono do projeto, em campo) |
| **Fonte** | Boletins do Corpo de Bombeiros + vídeos da cidade |
| **Chuva 72 h** | 180,8 mm em três pulsos |
| **Chuva 24 h (pico)** | 141,3 mm |
| **Chuva 12 h (pico)** | 78,2 mm |
| **Antecedente (72 h antes das últimas 12 h)** | 98,5 mm |
| **API no pico** | 142,6 mm |
| **Régua BE01 (limite 0,70 m)** | pico 1,24 m = 177% |
| **Força máxima** | 1,66 |
| **Duração que estourou primeiro** | 24 h |
| **Detector antigo** | "improvável" às 00h e de novo às 06h e 07h |
| **Detector novo** | "possível" 28/07 17h; "acontecendo" 29/07 00h; "enchente grande" 02h; aceso até 07h |
| **Commits** | `a07741e` motor, `aed12cd` linguagem, `628dadf` remoção de prosa |

#### Recessão do mesmo evento (o que ela ensinou)

A subida estava calibrada; a descida não. Números medidos na `BE01` (limite
0,70 m), com a chuva já parada:

| Hora (BRT) | Régua | Fração do limite | Campo |
|---|---|---|---|
| 02h | 1,15 m | 1,64x | cidade alagando |
| 06h | 1,24 m | 1,77x | pico; centro tomado |
| 07h | 1,15 m | 1,64x | rótula da Cuca fechada |
| 10h | 0,91 m | 1,29x | não observado |
| 12h15 | 0,795 m (caindo 6,3 cm/h) | 1,14x | **ruas livres, só sujas** |

Com isso a página dizia "Enchente grande na cidade" às 12h15, por duas causas
que só existem na descida:

1. `f >= 1` declarava enchente. Correto na subida (dá antecedência), falso na
   descida: a cidade estava limpa em 1,14x.
2. A memória `f6` não tinha saída, e mantinha a magnitude pregada no pico de
   1,81x por 6 h depois de a água sair.

Correção: estado de **recuo** (chuva parada + régua caindo + bem abaixo do pico
de 6 h), com `FLOOD_FRAC = 1,45` e magnitude por `f`. Ver seção 2.

| | |
|---|---|
| **Antes** | 12h15 → "Enchente grande na cidade" (força 1,81 vinda do pico de 6 h) |
| **Depois** | 12h15 → "Água baixando · rio ainda acima do limite e descendo, sem chuva há 3 h" |
| **Regressão** | nenhuma: replay hora a hora mantém "acontecendo" às 00h e aceso sem piscar de 00h a 11h |
