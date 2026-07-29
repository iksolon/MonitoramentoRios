/* ============================================================
   CONSTANTES E ÍCONES
   ============================================================ */

const loraIcon = "<img src='lora.svg' class='icone-inline'>";
const noSigSvg = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368"><path d="M790-56 414-434q-47 11-87.5 33T254-346l-84-86q32-32 69-56t79-42l-90-90q-41 21-76.5 46.5T84-516L0-602q32-32 66.5-57.5T140-708l-84-84 56-56 736 736-58 56Zm-310-64q-42 0-71-29.5T380-220q0-42 29-71t71-29q42 0 71 29t29 71q0 41-29 70.5T480-120Zm236-238-29-29-29-29-144-144q81 8 151.5 41T790-432l-74 74Zm160-158q-77-77-178.5-120.5T480-680q-21 0-40.5 1.5T400-674L298-776q44-12 89.5-18t92.5-6q142 0 265 53t215 145l-84 86Z"/></svg>';

// Estações com dados nao confiaveis: ocultadas do site e ignoradas nas leituras.
const ESTACOES_OCULTAS = new Set([
    "AAA7CCD686C44D8E", // RSRL-CE02 - regua em manutencao, leitura invalida
]);

// Estações sem régua: o gráfico delas mostra chuva, não nível.
const ESTACOES_CHUVA = new Set([
    "5BA69743261D364A", // RSFP-RB02
    "CEF2144E84EF82A0", // EXRL-MG01
]);

// Ordem de exibição da tabela de últimas leituras:
// 1. 5BA69743261D364A // Tem chuva
// 2. CF98FCFA7E9EE7C1, 9A6EE7B45495BB7F, 04109F675953A131, 48B1162D47EC0FE6 // Tem Nível
// 3. 2CAED8D9CB62CEB5, BB45660B199C5677 // Resto com ordem
// 4. Resto/Resto
const PRIORIDADE_ESTACOES = {
    // Grupo 1 (Prioridade 1)
    '5BA69743261D364A': 1,
    // Grupo 2 (Prioridade 2, subprioridades 11, 12, 13, 14)
    'CF98FCFA7E9EE7C1': 11,
    '9A6EE7B45495BB7F': 12,
    '04109F675953A131': 13,
    '48B1162D47EC0FE6': 14,
    // Grupo 3 (Prioridade 3, subprioridades 21, 22)
    '2CAED8D9CB62CEB5': 21,
    'BB45660B199C5677': 22
};

/* ============================================================
   UTILITÁRIOS DE DOM
   ============================================================ */

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element === null || element === undefined) return;

    if (value || value == 0) {
        element.innerHTML = value;
    } else {
        element.innerHTML = '-';
    }
}

/* ============================================================
   NORMALIZAÇÃO DE LEITURA
   ============================================================ */

// Estações LORA não reportam percentual de bateria; a faixa é derivada
// da tensão medida. Muta o objeto, como o resto do código espera.
function estimaBateriaLora(dado) {
    if (dado.source != 3 || dado.percentBateria || !dado.tensaoBateria) return; // LORA

    if (dado.tensaoBateria < 3.2) dado.percentBateria = 0;
    else if (dado.tensaoBateria < 3.4) dado.percentBateria = 10;
    else if (dado.tensaoBateria < 3.6) dado.percentBateria = 40;
    else if (dado.tensaoBateria < 3.7) dado.percentBateria = 60;
    else if (dado.tensaoBateria < 4) dado.percentBateria = 80;
    else dado.percentBateria = 90;
}

// Pluviômetro: leitura zerada também é dado (é "não choveu"), por isso o == 0.
function temLeituraDeChuva(dado) {
    return dado.precipitacao10min || dado.precipitacao10min == 0;
}

/* ============================================================
   FRAGMENTOS DE HTML DE UMA LEITURA
   ============================================================ */

function htmlBateria(dado) {
    return (dado.percentBateria || dado.percentBateria == 0)
        ? `<i class="bi ${iconeBateria(dado.percentBateria)}"></i>`
        : '';
}

function htmlSinal(dado, wifiSigPerc) {
    if (dado.source == 3) return loraIcon;
    if (dado.source == 5) return `<i class="bi bi-globe"></i>`;
    if (dado.source == 9) return `<i class="bi bi-broadcast-pin"></i>`;
    return `<i class="${iconeWifi(wifiSigPerc)}"></i>`;
}

function htmlTemperatura(dado, decimais) {
    return dado.temperaturaAr
        ? `<i class="bi-thermometer"></i> ${formatValue(dado.temperaturaAr, decimais)}ºC`
        : '';
}

function htmlUmidade(dado) {
    return dado.umidadeAr
        ? `<i class="bi-droplet"></i> ${formatValue(dado.umidadeAr, 0)}%`
        : '';
}

function htmlPressao(dado) {
    return dado.pressaoAr
        ? `<i class="bi-box-arrow-in-down"></i> ${formatValue(dado.pressaoAr, 0)} hPa`
        : '';
}

function htmlNivel(dado) {
    return (dado.nivelRio || dado.nivelRio == 0)
        ? `<i class="bi-water"></i> ${formatValueUnit(dado.nivelRio, 1, 'm')}`
        : '';
}

function htmlChuva(dado) {
    if (!temLeituraDeChuva(dado)) return '';

    const icone = dado.precipitacao10min && dado.precipitacao10min > 0 ? 'bi-cloud-rain' : 'bi-cloud';
    return `<i class="${icone}"></i> <span>${formatValueUnit(dado.precipitacao10min, 1, 'mm/min')}</span>`;
}

/* ============================================================
   MAPA
   ============================================================ */

function adicionaEstacao(lst, lat, lng, label, id) {
    if (ESTACOES_OCULTAS.has(id)) return;
    let e = addCircleLabel(lat, lng, label, `/live.html?estacao=${id}`);
    e.id = `mcE_${id}`;
    lst.push(e);
}

function atualizaEstacao(lst, label, id) {
    // procurar o id na lst e setar o valor com label
    let e = lst.find(el => el.id === `mcE_${id}`);

    if (e === null || e === undefined) return;

    e._icon.innerHTML = label;
}

function addCircleLabel(lat, lng, label, url) {
    // Adiciona o texto dentro do círculo
    var circle = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'circle-label',
            html: label,
            iconSize: [55, 55],
            iconAnchor: [20, 20] // Centralizar o texto no ponto
        })
    }).addTo(map);

    if (url !== null) {
        circle.on('click', function () {
            window.open(url, '_blank');
        });
    }

    return circle;
}

// Texto exibido dentro da bolha do mapa: sempre a temperatura e,
// conforme o tipo de estação, a chuva ou o nível do rio.
function textoBolhaMapa(dado) {
    if (dado.nivelRio === null && dado.temperaturaAr === null) return `?/?`;

    if (temLeituraDeChuva(dado)) {
        return `${formatValue(dado.temperaturaAr, 1)}ºC<br>${formatValue(dado.precipitacao10min, 1)}mm`;
    }
    if (dado.nivelRio === null || dado.nivelRio === undefined) {
        return `${formatValue(dado.temperaturaAr, 1)}ºC`;
    }
    return `${formatValue(dado.temperaturaAr, 1)}ºC<br>${formatValue(dado.nivelRio, 1)}m`;
}

function atualizaMapa(lst) {
    fetch('/estacoes/ultimos')
        .then(response => response.json())
        .then(data => {
            // exibe
            data.filter(dado => !ESTACOES_OCULTAS.has(dado.estacao)).forEach(dado => {
                atualizaEstacao(lst, textoBolhaMapa(dado), dado.estacao);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar dados das estações:', error);
        });
}

/* ============================================================
   TABELA FIXA DE PONTOS DE LEITURA (rsrl2.html)
   Os spans já existem no markup; aqui só preenchemos o conteúdo.
   ============================================================ */

function exibeDadosEstacaoTabelaChuva(idSpan, idEstacao) {
    // Resumo 24h
    fetch('/estacoes/agregado?hour=24&estacao=' + idEstacao)
        .then(response => response.json())
        .then(dado => {
            setValue(`spn_${idSpan}_PC`, `${formatValue(dado.precipitacaoTotal_Hora, 0) || '-'}mm`);
        })
        .catch(error => {
            console.error('Erro ao carregar dados das estações:', error);
        });
    // Chama a geral para preencher dados atuais
    exibeDadosEstacaoTabelaRio(idSpan, idEstacao);
}

function exibeDadosEstacaoTabelaRio(idSpan, idEstacao) {
    // Chama a geral para preencher dados atuais
    let url = '/estacoes/dados?limit=2&estacao=' + idEstacao;
    fetch(url)
        .then(response => response.json())
        .then(rows => {
            if (rows.length == 0) {
                console.log('Estação não tem dados: ' + idEstacao);
                return;
            }
            const dado = rows[0];
            if (isOlderThan(dado.dataHoraDadosUTC, 2)) return;

            preencheSpansEstacao(idSpan, dado);
        })
        .catch(error => {
            console.error('Erro ao carregar dados da estação: ' + idEstacao, error);
        });
}

function preencheSpansEstacao(idSpan, dado) {
    estimaBateriaLora(dado);

    const wifiSigPerc = wifiSignalToPercent(dado.forcaSinal);
    const temp = htmlTemperatura(dado, 0);
    const prss = htmlPressao(dado);
    // Célula estreita: com temperatura e pressão presentes a umidade
    // fica de fora para a linha não quebrar.
    const humd = (dado.temperaturaAr && dado.pressaoAr) ? '' : htmlUmidade(dado);

    setValue(`spn_${idSpan}_SigBat`, `${htmlBateria(dado)} ${htmlSinal(dado, wifiSigPerc)}`);
    setValue(`spn_${idSpan}_Air`, `${temp} ${humd} ${prss}`);
    setValue(`spn_${idSpan}_Temp`, `${temp}`);
    setValue(`spn_${idSpan}_WL`, `${htmlNivel(dado)}`);
}

/* ============================================================
   TABELA DINÂMICA DE ÚLTIMAS LEITURAS (rsrl.html)
   ============================================================ */

function ordenaEstacoes(data) {
    return data.sort((a, b) => {
        // Obtém a prioridade de cada estação, default 999 para as não listadas
        const prioridadeA = PRIORIDADE_ESTACOES[a.estacao] || 999;
        const prioridadeB = PRIORIDADE_ESTACOES[b.estacao] || 999;

        // Compara prioridades
        return prioridadeA - prioridadeB;
    });
}

function montaLinhaEstacao(dado) {
    estimaBateriaLora(dado);

    const wifiSigPerc = wifiSignalToPercent(dado.forcaSinal);
    const idCh = `ch_${dado.estacao}`;

    const row = document.createElement('tr');
    row.innerHTML = `
                                        <td class='col-estacao'>${dado.nomeEstacao || dado.estacao}</td>
                                        <td class='col-status'><span title="Bateria: ${(dado.percentBateria ?? 0).toFixed(0)}%">${htmlBateria(dado)}</span> <span title="WiFi: ${wifiSigPerc}">${htmlSinal(dado, wifiSigPerc)}</span></td>
                                        <td><span>${htmlUmidade(dado)}</span> <span>${htmlTemperatura(dado, 1)}</span> <span>${htmlPressao(dado)}</span></td>
                                        <td><span>${htmlNivel(dado)}</span> <span id='${idCh}'>${htmlChuva(dado)}</span></td>
                                        <td><a class="btn" href="live.html?estacao=${dado.estacao}">Ver Estação</a></td>
                                     `;
    return row;
}

function montaTabelaEstacoes(lst) {
    fetch('/estacoes/ultimos')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#ultimasLeituras tbody');
            tableBody.innerHTML = "";

            data = ordenaEstacoes(data);

            // exibe
            data.forEach(dado => {
                if (ESTACOES_OCULTAS.has(dado.estacao)) return;
                if (dado.nomeEstacao.startsWith('EX')) return; // Estações externas ficam fora desta tabela

                // Bloco Tabela
                tableBody.appendChild(montaLinhaEstacao(dado));
                if (temLeituraDeChuva(dado)) carregaChuvaEstacao(dado.estacao);

                // Bloco Mapa
                atualizaEstacao(lst, textoBolhaMapa(dado), dado.estacao);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar dados das estações:', error);
        });
}

// Troca a chuva instantânea da linha pela média por hora das últimas 2h.
function carregaChuvaEstacao(estacao) {
    fetch('/estacoes/agregado?hour=2&estacao=' + estacao)
        .then(response => response.json())
        .then(data => {
            const span = document.querySelector(`#ch_${estacao}`);
            if (!span) return;

            // O agregado vem somado na janela de 2h; dividimos para exibir mm/h.
            const prec = formatValue(data.precipitacaoTotal_Hora / 2, 1);
            const icone = data.precipitacaoTotal_Hora && data.precipitacaoTotal_Hora > 0 ? 'bi-cloud-rain' : 'bi-cloud';
            span.innerHTML = `<i class="${icone}"></i> <span>${prec}</span>`;
        });
}

/* ============================================================
   GRÁFICO HISTÓRICO: PREPARAÇÃO DOS DADOS
   ============================================================ */

// Gera acumulado móvel de chuva em cada hora da série.
function calculaAcumuladosMoveis(data) {
    for (let i = 0; i < data.length; i++) {
        if (!data[i]) continue;
        data[i].acumulado24h = somaPrecipitacao(data, Math.max(0, i - 23), i); // i - 23 porque queremos incluir até i (24 horas no total)
        data[i].acumulado12h = somaPrecipitacao(data, Math.max(0, i - 12), i);
    }
}

function somaPrecipitacao(data, inicio, fim) {
    let acumulado = 0;
    for (let j = inicio; j <= fim; j++) {
        if (!data[j]) continue;
        acumulado += data[j].precipitacaoTotal_Hora || 0; // Soma o valor, tratando null/undefined como 0
    }
    return acumulado;
}

// Gera todos os rótulos horários entre 24h atrás e agora, para que as
// janelas sem leitura apareçam como lacuna no gráfico.
function geraRotulosUltimas24h() {
    const now = new Date(); // Horário atual
    //const endDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // Retira 1h
    const endDate = new Date(now.getTime());
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 horas atrás
    return generateHourlyLabels(startDate, endDate);
}

// Criar um mapa dos dados existentes para facilitar a busca
function indexaDadosPorHora(data) {
    const dataMap = new Map();
    data.filter(dado => dado !== undefined && dado !== null).forEach(dado => {
        if (!dado.dataHoraDadosUTC.endsWith('Z')) dado.dataHoraDadosUTC = dado.dataHoraDadosUTC + 'Z';
        const current = new Date(dado.dataHoraDadosUTC);
        dataMap.set(getDateTimeForTimezone(current, -3), dado);
    });
    return dataMap;
}

// Preencher os arrays com os dados, inserindo null nas janelas
function montaSeriesGrafico(rotulos, dadosPorHora, modoNivel, nivelNormal, nivelAlerta) {
    const series = { valor: [], acumulado12: [], acumulado24: [], normal: [], alerta: [] };

    rotulos.forEach(rotulo => {
        const dado = dadosPorHora.get(rotulo);
        if (dado) {
            acrescentaValorMedido(series, dado, modoNivel);
        } else {
            series.valor.push(null); // Janela sem dados
        }
        series.normal.push(formatValue(nivelNormal, 2) || null);
        series.alerta.push(formatValue(nivelAlerta, 2) || null);
    });

    return series;
}

function acrescentaValorMedido(series, dado, modoNivel) {
    if (modoNivel) {
        if (dado.nivelRio_AVG < 0) dado.nivelRio_AVG = 0; // Nível negativo não vai ao gráfico
        series.valor.push(formatValue(dado.nivelRio_AVG, 2) || null);
        return;
    }

    series.valor.push(formatValue(dado.precipitacaoTotal_Hora, 1) || null);
    series.acumulado24.push(formatValue(dado.acumulado24h, 1) || null);
    series.acumulado12.push(formatValue(dado.acumulado12h, 1) || null);
}

/* ============================================================
   GRÁFICO HISTÓRICO: CONFIGURAÇÃO DO CHART.JS
   ============================================================ */

function montaDatasetsGrafico(series, modoNivel, nivelNormal, nivelAlerta) {
    const datasets = [datasetPrincipal(series, modoNivel)];

    if (!modoNivel) datasets.push(...datasetsAcumulados(series));
    if (nivelNormal) datasets.push(datasetLimiteNormal(series));
    if (nivelAlerta) datasets.push(datasetLimiteAlerta(series, modoNivel));

    return datasets;
}

function datasetPrincipal(series, modoNivel) {
    return {
        type: modoNivel ? 'line' : 'bar',
        pointStyle: modoNivel ? 'circle' : 'rect',
        label: modoNivel ? 'Nível do Rio (m)' : 'Chuva (mm/h)',
        fill: modoNivel ? 'origin' : false,
        data: series.valor, // Usar os dados preparados
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
        pointBorderColor: '#fff'
    };
}

function datasetsAcumulados(series) {
    return [
        {
            type: 'line',
            pointStyle: 'circle',
            label: 'Acumulado 12h (mm)',
            data: series.acumulado12,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgb(54, 162, 235,0.5)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: 'rgb(54, 162, 235)',
            pointBorderColor: '#fff',
        },
        {
            type: 'line',
            pointStyle: 'circle',
            label: 'Acumulado 24h (mm)',
            data: series.acumulado24,
            borderColor: 'aquamarine',
            backgroundColor: 'aquamarine',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: 'aquamarine',
            pointBorderColor: '#fff',
            hidden: true,
        }
    ];
}

function datasetLimiteNormal(series) {
    return {
        type: 'line',
        pointStyle: 'rect',
        label: 'Normal',
        data: series.normal, // Usar os dados preparados
        borderColor: 'gray',
        backgroundColor: 'gray',
        borderWidth: 2,
        pointRadius: 1,
        pointBackgroundColor: 'gray',
        pointBorderColor: '#fff'
    };
}

function datasetLimiteAlerta(series, modoNivel) {
    return {
        type: 'line',
        pointStyle: 'rect',
        label: modoNivel ? 'Alerta (m)' : 'Alerta (mm)',
        data: series.alerta, // Usar os dados preparados
        color: 'yellow',
        borderColor: 'yellow',
        backgroundColor: 'yellow',
        borderWidth: 2,
        pointRadius: 1,
        pointBackgroundColor: 'yellow',
        pointBorderColor: '#fff',
    };
}

function opcoesGrafico(modoNivel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: 'white', // Cor dos nomes das séries na legenda
                    usePointStyle: true,
                },
                display: true,
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: escalasGrafico(modoNivel)
    };
}

function escalasGrafico(modoNivel) {
    return {
        x: {
            title: {
                display: false,
                text: 'Hora',
                color: 'white'
            },
            ticks: {
                color: 'white' // Cor dos textos do eixo X
            }
        },
        y: {
            title: {
                display: true,
                text: modoNivel ? 'Nível do Rio (m)' : 'Chuva (mm/h)',
                color: 'white'
            },
            ticks: {
                color: 'white' // Cor dos textos do eixo X
            },
            beginAtZero: true
        }
    };
}

/* ============================================================
   GRÁFICO HISTÓRICO: CARGA E DESENHO
   ============================================================ */

function carregaHistoricoGrafico(idEstacao, canvasId, nivelNormal, nivelAlerta) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    fetch('/estacoes/lastHourly?lastHours=36&estacao=' + idEstacao)
        .then(response => response.json())
        .then(data => desenhaHistoricoGrafico(canvas, idEstacao, data, nivelNormal, nivelAlerta))
        .catch(error => {
            console.error('Erro ao carregar dados das estações:', error);
        });
}

function desenhaHistoricoGrafico(canvas, idEstacao, data, nivelNormal, nivelAlerta) {
    calculaAcumuladosMoveis(data);

    const rotulos = geraRotulosUltimas24h();
    const dadosPorHora = indexaDadosPorHora(data);
    const modoNivel = !ESTACOES_CHUVA.has(idEstacao);
    const series = montaSeriesGrafico(rotulos, dadosPorHora, modoNivel, nivelNormal, nivelAlerta);

    // Criar o gráfico
    new Chart(canvas.getContext('2d'), {
        data: {
            labels: rotulos, // Usar os rótulos preparados
            datasets: montaDatasetsGrafico(series, modoNivel, nivelNormal, nivelAlerta)
        },
        options: opcoesGrafico(modoNivel)
    });
}

/* ============================================================
   PREVISÃO DO TEMPO: MONTAGEM DOS CARDS
   A probabilidade de chuva (item.precipitacaoProb, presente em /weather)
   está fora do card por decisão de layout; a classe .card-chuva-prob
   continua no CSS para quando voltar.
   ============================================================ */

// Abaixo de 10 ºC a casa decimal ainda cabe no card.
function textoTemperaturaPrevista(item) {
    return item.temperatura < 10 ? item.temperatura.toFixed(1) : item.temperatura.toFixed(0);
}

function iconeChuvaPrevista(precipitacao) {
    if (precipitacao > 9) return 'bi-cloud-rain-heavy';
    if (precipitacao > 4) return 'bi-cloud-rain';
    if (precipitacao > 0.5) return 'bi-cloud-drizzle';
    if (precipitacao > 0.1) return 'bi-cloud';
    return 'bi-cloud-slash';
}

// Na Beaufort Wind Scale
//  "Brisa leve" é de 4 a 7km/h (Wind felt on face; leaves rustle; ordinary vanes moved by wind)
//  "Brisa gentil" é de 8 a 12km/h (Leaves and small twigs in constant motion; wind extends light flag.)
//  "Brisa moderada" é de 13 a 18km/h (Raises dust and loose paper; small branches are moved.)
//  ...
//  "Quase vendaval" é de 32 a 38km/h (Whole trees in motion; inconvenience felt when walking against the wind.)
//  "Vendaval" é de 39 a 46km/h (Breaks twigs off trees; generally impedes progress.)
//  Vou exibir a partir da faixa superior da leve, em 6
function htmlVentoPrevisto(item) {
    // Negado desta forma para também sair fora quando não há leitura de vento.
    if (!(item.ventoVelocidade > 6)) return '';

    const estado = item.ventoVelocidade > 30 ? ' card-vento-alerta' : '';
    return `<div class="card-linha"> <span class="card-vento${estado}"><i class="bi bi-wind"></i> ${item.ventoVelocidade.toFixed(0)} km/h</span> </div>`;
}

function montaCardPrevisao(item, textoHora) {
    const card = document.createElement('div');
    card.className = 'card-previsao';
    card.innerHTML = `
                        <div class="card-hora">${textoHora}</div>
                        <div class="card-temp">${textoTemperaturaPrevista(item)}°C</div>

                        ${htmlVentoPrevisto(item)}
                        <div class="card-linha">
                            <span class="card-chuva"><i class="bi ${iconeChuvaPrevista(item.precipitacao)}"></i> ${item.precipitacao.toFixed(1)} mm</span>
                        </div>
                    `;
    return card;
}

/* ============================================================
   PREVISÃO DO TEMPO: CARGA
   ============================================================ */

function carregaPrevisao() {
    fetch('/weather')
        .then(response => response.json())
        .then(data => renderizaPrevisao(data, horaLocalDaPrevisao))
        .catch(exibeErroPrevisao);
}

function carregaPrevisaoAgrupado() {
    fetch('/weather/blocks')
        .then(response => response.json())
        .then(data => renderizaPrevisao(data, item => item.horarioLocal))
        .catch(exibeErroPrevisao);
}

function horaLocalDaPrevisao(item) {
    return new Date(item.forecastUTC + 'Z').toLocaleString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Criar cards visuais
function renderizaPrevisao(data, textoHora) {
    const cardsContainer = document.querySelector('#previsaoCards');
    cardsContainer.innerHTML = ''; // Limpar container

    exibeDataColetaPrevisao(data);

    data.forEach(item => cardsContainer.appendChild(montaCardPrevisao(item, textoHora(item))));
}

function exibeDataColetaPrevisao(data) {
    if (data.length == 0) return;

    const dataHora = new Date(data[0].coletaUTC + 'Z').toLocaleString('pt-BR');
    const spanDH = document.querySelector('#dataHoraColetaPrevisao');
    spanDH.textContent = `Coleta dos Dados: ${dataHora}`;
}

function exibeErroPrevisao(error) {
    console.error('Erro ao buscar previsão:', error);
    document.querySelector('#previsaoTempo').innerHTML = '<p class="erro-previsao">Erro ao carregar previsão do tempo.</p>';
}

function carregaPrevisaoEstendida() {
    // Limpa card
    const cardsContainer = document.querySelector('#previsaoCards');
    cardsContainer.innerHTML = 'Consultando previsão estendida, aguarde ...';
    setTimeout(function () {
        /*carregaPrevisao(true);*/
        window.location = "/tempo.html"
    }, 5000); // Wait
};

/* ============================================================
   EVENTOS
   Chamada pelo bloco de init de rsrl.html / rsrl2.html, depois que
   o markup da página já foi lido pelo navegador.
   ============================================================ */

function ligaEventosPagina() {
    const btnEstendida = document.getElementById('btnPrevisaoEstendida');
    if (btnEstendida) btnEstendida.addEventListener('click', carregaPrevisaoEstendida);

    // Títulos de gráfico marcados com data-estacao abrem a página da estação.
    document.querySelectorAll('[data-estacao]').forEach(el => {
        el.addEventListener('click', () => abrirEstacao(el.dataset.estacao));
    });
}
