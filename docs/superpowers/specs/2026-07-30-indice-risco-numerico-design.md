# Índice de risco numérico (1-10) — troca dos textos categóricos

## Contexto e motivação

Hoje o app comunica risco de enchente em palavras: o selo no topo diz "Risco
baixo/atenção/alto" (ou "Enchente grande"/"Água baixando" quando confirmado),
e o card "Enchente na cidade" diz "improvável/possível/iminente/acontecendo/
enchente grande". O dono do projeto pediu para trocar isso por uma escala
numérica de 1 a 10, com cor mudando por severidade, pelos seguintes motivos:

1. **Categorias escondem nuance.** "Risco baixo" pode significar "seco há
   dias" ou "choveu 77 mm ontem, parou agora, régua caindo" — situações bem
   diferentes que a palavra trata igual.
2. **Sensibilidade local varia.** Pontos baixos da cidade alagam num nível de
   água menor que pontos mais altos. Uma palavra ("vai dar enchente" / "não
   vai") tem que escolher um ponto de corte único; uma escala deixa cada
   morador calibrar mentalmente o próprio ponto de risco (ex.: "pra mim já é
   problema a partir de 7", "minha casa só some com 9").
3. **Não comprometer com diagnóstico que o dado não sustenta.** O projeto já
   tem a regra de nunca prometer ("bastam 85 mm para transbordar") — só
   publica medida. Um número honesto que sobe e desce com o dado é mais fiel
   a essa regra do que uma palavra que precisa cravar "vai" ou "não vai".

Este documento cobre a troca de exibição (texto → número) e o motor que
calcula o número. **Não muda** as regras de detecção que já existem em
`enchente.js` (`canalRio`, `cityFlood`, os limiares aferidos em 29/07/2026) —
o número é uma NOVA CAMADA de leitura em cima do que o motor já calcula,
reaproveitando os mesmos sinais.

## Restrição real da rede de medição (por que a régua não pode dominar)

A rede tem só duas réguas de nível confiáveis (`LEVEL_TRUST` em `config.js`):
`RSRL-GLLS` (Rolantinho, afluente, longe da cidade) e `RSRL-BE01` (Rio Areia,
~5 km da cidade, e some do ar com frequência). **O Rio Rolante — que também
alaga a cidade — não tem nenhuma régua confiável hoje.** Ou seja: o canal de
régua (`canalRio`) só enxerga uma fração da bacia, e só quando o sensor
específico está vivo.

O índice numérico por isso NÃO pode deixar a régua, sozinha, decidir o
resultado (é o que a fórmula atual `forca = max(chuva, rio, pico6)` faz hoje
implicitamente). O canal confiável e sempre disponível — porque agrega toda a
rede de chuva, não depende de nenhuma estação específica — é chuva medida +
saturação do solo. A régua entra como REFORÇO quando está fresca e concorda,
nunca como fundamento único.

## O número: fórmula

Reaproveita os sinais que `cityFlood()` já calcula em `enchente.js` — não
inventa métrica nova, só remapeia para 1-10.

### Índice "agora" (situação medida)

**Base — chuva medida vs. limiar ajustado pelo solo** (`agora.ratio` em
`ffgRatio`, já existe): cobre a bacia toda, sempre disponível.

| `agora.ratio` | índice | referência |
|---|---|---|
| 0 | 1 | seco |
| 0,50 | 4 | interpolado |
| 0,75 | 6 | corte que já vira "chuva=2" hoje |
| 1,00 | 8 | corte que já vira "chuva=3" hoje |
| 1,35 | 10 | `SEV_GRANDE`, mesmo corte de "enchente grande" |
| >1,35 | 10 (teto) | sem mais granularidade útil |

**Reforço — régua** (`rio.frac`), só quando a estação que define `frac` está
fresca, confiável, E não em recuo confirmado (reaproveita `arrefeceu`, a
correção feita em 29/07/2026 20h34 para não travar o alarme quando a régua já
confirma descida sem chuva). Teto próprio, mais baixo que o da chuva, porque
é um ou dois sensores intermitentes:

| `rio.frac` | teto da régua | referência |
|---|---|---|
| 0 | 1 | seco |
| 0,85 | 4 | precursor de subida já usado hoje |
| 1,00 | 6 | cruzou o limite oficial da régua |
| 1,35 | 7 (teto) | régua sozinha nunca passa disso |

`índice_agora = max(base_chuva, teto_régua se aplicável, senão 0)`

Quando `arrefeceu` é verdadeiro, o reforço da régua não entra — o índice
"agora" vem só da chuva, que naturalmente cai conforme as horas de chuva
saem da janela de 24 h. Isso é intencional: um evento real de 77 mm não some
do índice instantaneamente quando a chuva para, ele desce ao longo de
~1 dia — mais honesto que uma palavra binária que teria que escolher entre
"baixo" (esconde o evento recente) ou "atenção" (nega que já passou).

### Índice "futuro" (previsão)

Mesmos cortes de mm que `computeRisk` já usa hoje (`peakDay.mm` / `next72`),
remapeados com **teto em 9 — nunca 10**, porque previsão é estimativa, não
confirmação:

| mm previsto (pico do dia, ou equivalente em `next72`) | índice |
|---|---|
| 0 | 1 |
| 15 mm | 4 |
| 40 mm | 6 |
| 80 mm | 9 (teto) |

Interpolação linear entre os pontos, igual ao índice "agora".

### Índice final

`índice = max(índice_agora, índice_futuro)`, exibido arredondado para
inteiro. Mantém a lógica `drivenBy` que já existe (`"agora"` vs `"previsto"`)
para a legenda pequena embaixo do selo ("situação agora" / "motivado pela
previsão · <data>").

**Uma única fonte de verdade:** o índice é calculado dentro de `cityFlood()`
(`enchente.js`) e devolvido no objeto `F` (`F.indiceAgora`, `F.indiceFuturo`,
`F.indice`). Tanto o selo quanto o card de enchente leem o MESMO campo — é a
regra que o próprio arquivo já documenta no topo ("badge e card saem do
MESMO motor") e que evitou duas contradições nesta sessão.

## O que muda na tela

### Fica número (sempre, inclusive quando já é fato confirmado)

- **Selo do topo** (`#risk-label`): hoje mostra "Risco baixo/atenção/alto",
  "Enchente grande", "Enchente em curso", "Água baixando". Passa a mostrar
  sempre o índice (`"6/10"`), mesmo em enchente confirmada (aí o índice fica
  em 9-10). A legenda pequena ao lado (`#risk-when`, "situação agora" /
  "motivado pela previsão · <data>") continua igual — já é factual, não é
  veredito.
- **Card "Enchente na cidade"** (valor grande do `qk`, hoje
  "improvável/possível/iminente/acontecendo/enchente grande"/"baixando"):
  passa a mostrar o mesmo índice final. A linha pequena de contexto (`sub`,
  ex. "rio acima do limite e chuva acima do que o solo aguenta", "rio ainda
  acima do limite e descendo, sem chuva há 3 h") continua igual — já é
  descrição de fato, não categoria de risco.

### Continua em texto (fora de escopo desta mudança)

- **Manchete** (frase grande abaixo do selo — "Enchente na cidade.", "A água
  está baixando.", "Chovendo agora..."): já é frase descritiva de fato
  observado, não categoria de risco. Fica como está.
- Todos os outros cards (`cardDeSolo`, `cardDeRio`, `cardDeChuvaMedida`,
  `cardDeChuvaPrevista`, `cardDeProximaChuva`) e os status por bacia
  (`CLASSE_STATUS`: inund/alerta/atencao/observa/normal) já são dado bruto
  com unidade (mm, cm, %) — não fazem parte deste escopo.

### Cor: 5 faixas em degradê

Reaproveita a paleta OKLCH que já existe no projeto (`serra.css`), só
acrescenta uma cor nova (verde-amarelado, entre `--moss` e `--warn`) para
preencher o degradê:

| Índice | Cor | Variável CSS |
|---|---|---|
| 1-2 | verde | `--moss` (já existe) |
| 3-4 | verde-amarelado | nova, interpolada entre `--moss` e `--warn` |
| 5-6 | amarelo | `--warn` (já existe) |
| 7-8 | laranja | `--terra` (já existe, hoje usado noutro contexto) |
| 9-10 | vermelho | `--alert` (já existe) |

As classes CSS do selo (`.risk-badge.baixo/.atencao/.alto`) e do card
(`.qk.hl`) são substituídas por 5 classes novas (`.nivel-1` … `.nivel-5`),
seguindo o mesmo padrão de definição em `:root` + bloco de tema escuro que já
existe no arquivo.

## O aviso de calibração limitada

Por pedido do dono do projeto: um `*` ao lado do número em cada lugar onde
ele aparece (selo + card), apontando para uma linha nova no rodapé — o mesmo
`.disclaimer` que já existe, sem criar um segundo aviso solto na tela:

> "* Escala de 1 a 10 construída a partir de poucos eventos reais medidos
> (o principal: 29/07/2026) — não é uma probabilidade estatística calibrada.
> Conforme mais enchentes reais forem confirmadas, os pontos de corte serão
> reajustados."

## Caminho para virar estatística de verdade (nota para o futuro, não implementado agora)

A tabela de âncoras (`agora.ratio` → índice, `rio.frac` → índice, mm previsto
→ índice) fica isolada em uma função só (`escalaRisco()` e afins) dentro de
`enchente.js`, com comentário explicando a origem de cada ponto de corte —
o mesmo padrão já usado nos limiares de `FFG`, `SEV_GRANDE`, `FLOOD_FRAC`.
Isso deixa pronto para, no futuro, recalibrar os pontos (ou trocar por
regressão de verdade) à medida que mais eventos reais forem confirmados em
campo — sem precisar reescrever a integração com o resto do app.

## Fora de escopo

- Não muda nenhuma regra de detecção existente (`canalRio`, `cityFlood`,
  `computeRisk` continuam decidindo os estados internos do mesmo jeito;
  só a CAMADA DE EXIBIÇÃO do índice é nova).
- Não adiciona calibração estatística real agora (fica documentado como
  próximo passo, não implementado nesta mudança).
- Não mexe nos cards de dado bruto (`cardDeSolo`, `cardDeRio`, chuva medida/
  prevista) nem no status por bacia.
- Não muda a manchete nem os textos `sub` dos cards.

## Testes / verificação

Sem suíte automatizada no projeto para este módulo (é renderização client-side
lida via navegador). Verificação: recarregar `serra.html` no navegador headless,
ler o índice calculado (`F.indiceAgora`, `F.indiceFuturo`, `F.indice`) via
import dinâmico do módulo `estado.js`, e conferir:

1. Cenário de hoje (77 mm em 24 h, régua em recuo confirmado, sem previsão) →
   índice ~6, cor amarela, não verde nem vermelha.
2. Simular (ajustando dados de teste) um cenário de enchente confirmada
   (`rio.nivel=3`, `chuva.ratio>=1,35`) → índice 10, cor vermelha.
3. Simular previsão isolada de 80 mm sem chuva medida nem régua alta →
   índice futuro 9 (nunca 10).
4. Conferir que selo e card mostram o MESMO número na mesma leitura (fonte
   única em `F.indice`).
