/* ========================================================================
   ESTADO COMPARTILHADO
   Um objeto, com dono anotado por campo.
   ======================================================================== */

/* Antes eram sete variaveis livres no fecho de um IIFE de 1100 linhas:
   qualquer funcao escrevia em qualquer uma sem deixar rastro. Reunidas aqui,
   fica explicito quem produz cada campo e quem so le. Renderizador nunca
   escreve; quem escreve esta nomeado ao lado. */
export const APP = {
  ST: {},       // series por estacao          <- dados.js/carregarEstacoes
  BAS: {},      // agregado por bacia          <- dados.js/agregarBacias
  NET: null,    // resumo da rede              <- app.js/renderAll
  FC: null,     // previsao                    <- dados.js/carregarPrevisao
  RISK: null,   // veredito do motor de risco  <- enchente.js/computeRisk
  labels: [],   // rotulos de hora do eixo     <- dados.js/carregarEstacoes
  gen: ""       // horario da geracao          <- dados.js/carregarEstacoes
};
