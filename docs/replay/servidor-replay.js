/* Servidor de replay do detector de enchente.
 *
 * Serve o serra.html REAL e finge a API da rede, cortando todo o dado num
 * instante escolhido. Serve para ver o que a pagina dizia, hora a hora, durante
 * um evento passado.
 *
 * Uso:
 *   node docs/replay/servidor-replay.js 5099 Web.Data/wwwroot/serra.html
 *   # depois, no navegador:
 *   #   http://127.0.0.1:5099/serra.html?api=&clock=2026-07-29T06
 *
 *   clock  = instante do corte, em UTC (BRT + 3 h). Ex.: 03h BRT -> T06.
 *   ?api=  = (vazio) forca a pagina a usar esta origem em vez da producao.
 *
 * Dados: /tmp/riosreplay/fixture.json, gerado por baixar-dados.py.
 *
 * Duas decisoes que parecem detalhe e nao sao:
 *
 *  1. O shim de relogio e injetado no PROPRIO HTML. Instalar via CDP
 *     (page.evaluateOnNewDocument) desanexa o frame depois de algumas dezenas
 *     de navegacoes, e a varredura morre no meio.
 *  2. A pagina e RELIDA do disco a cada requisicao. Se fizer cache, voce edita
 *     o serra.html e continua testando a versao antiga sem perceber.
 *
 * Ver docs/detector-enchente.md, secao 4.
 */
const http = require("http");
const fs = require("fs");

const PORT = Number(process.argv[2] || 5099);
const PAGEPATH = process.argv[3] || "Web.Data/wwwroot/serra.html";
const FXPATH = process.env.RIOS_FIXTURE || "/tmp/riosreplay/fixture.json";

if (!fs.existsSync(FXPATH)) {
  console.error("fixture nao encontrada: " + FXPATH);
  console.error("rode primeiro: python3 docs/replay/baixar-dados.py");
  process.exit(1);
}
const FX = JSON.parse(fs.readFileSync(FXPATH, "utf8"));

function shim(clock) {
  // Congela Date no instante do corte e propaga ?t= para toda chamada de API.
  return (
    "<script>(function(){var T=Date.parse('" + clock + ":40:00Z'),R=Date;" +
    "function F(){return arguments.length?Reflect.construct(R,arguments):new R(T);}" +
    "F.prototype=R.prototype;F.now=function(){return T;};F.parse=R.parse;F.UTC=R.UTC;" +
    "window.Date=F;var rf=window.fetch;window.fetch=function(u,o){" +
    "return rf(u+(String(u).indexOf('?')>=0?'&':'?')+'t=" + clock + "',o);};})();<\/script>"
  );
}

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const t = u.searchParams.get("t");
  const hk = t ? Math.floor(Date.parse(t + ":00:00Z") / 3600000) : Infinity;
  const json = (o) => {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(o));
  };

  if (u.pathname === "/estacoes/lastHourly") {
    const st = FX.stations[u.searchParams.get("estacao")];
    return json(st ? st.rows.filter((r) => r.hourKey <= hk) : []);
  }
  if (u.pathname === "/estacoes/ultimos") {
    // Pacote instantaneo: vazio no replay. Forca a pagina a decidir pela serie
    // horaria, que e o unico historico fiel que temos.
    return json([]);
  }
  if (u.pathname === "/weather/ext") {
    return json(FX.forecast.filter((r) => Date.parse(r.forecastUTC + "Z") / 3600000 >= hk));
  }

  const clock = u.searchParams.get("clock");
  let page = fs.readFileSync(PAGEPATH, "utf8");
  if (clock) page = page.replace("</head>", shim(clock) + "</head>");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(page);
}).listen(PORT, () => {
  console.log("replay listening on " + PORT + "  (pagina: " + PAGEPATH + ")");
  console.log("ex.: http://127.0.0.1:" + PORT + "/serra.html?api=&clock=2026-07-29T06");
});
