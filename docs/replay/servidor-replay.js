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
 * Tres decisoes que parecem detalhe e nao sao:
 *
 *  1. O shim de relogio e injetado no PROPRIO HTML. Instalar via CDP
 *     (page.evaluateOnNewDocument) desanexa o frame depois de algumas dezenas
 *     de navegacoes, e a varredura morre no meio.
 *  2. A pagina e RELIDA do disco a cada requisicao. Se fizer cache, voce edita
 *     o serra.html e continua testando a versao antiga sem perceber.
 *  3. O CSS e os modulos JS sao servidos como ARQUIVO, com o content-type
 *     certo. Antes qualquer caminho caia no HTML: quando a pagina passou a
 *     carregar serra.css e serra/*.js, o navegador recebia HTML no lugar do
 *     modulo e a pagina nao subia. Modulo ES exige MIME de javascript.
 *
 * Ver docs/detector-enchente.md, secao 4.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2] || 5099);
const PAGEPATH = process.argv[3] || "Web.Data/wwwroot/serra.html";
const RAIZ = path.resolve(path.dirname(PAGEPATH));   // wwwroot: de onde saem css/js
const FXPATH = process.env.RIOS_FIXTURE || "/tmp/riosreplay/fixture.json";

const TIPO = {".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8",
              ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml",
              ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp",
              ".ico":"image/x-icon", ".woff2":"font/woff2"};

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

  /* Arquivo real dentro da wwwroot (serra.css, serra/*.js, imagens): serve como
     arquivo, com o content-type certo. Sem isso o modulo ES chegava como HTML.
     Confere que o caminho resolvido nao escapa da raiz. */
  if (u.pathname !== "/" && !u.pathname.endsWith(".html")) {
    const alvo = path.resolve(RAIZ, "." + u.pathname);
    if (alvo.startsWith(RAIZ + path.sep) && fs.existsSync(alvo) && fs.statSync(alvo).isFile()) {
      res.writeHead(200, {
        "content-type": TIPO[path.extname(alvo)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      return res.end(fs.readFileSync(alvo));
    }
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
