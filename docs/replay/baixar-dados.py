#!/usr/bin/env python3
"""Baixa as leituras da rede e a previsao vigente da producao, para replay.

Producao e SOMENTE LEITURA: este script apenas faz GET. Nunca escreva nada la.

Uso:
    python3 docs/replay/baixar-dados.py
    python3 docs/replay/baixar-dados.py --horas 240 --saida /tmp/evento.json

O arquivo gerado alimenta docs/replay/servidor-replay.js, que serve o
serra.html real fingindo a API e cortando o dado num instante escolhido.
Ver docs/detector-enchente.md, secao 4.
"""
import argparse
import json
import os
import sys
import urllib.request

BASE = "https://rios.bitcoineaqui.com.br"

# Mesmo registro do serra.html (const REG). Se uma estacao for adicionada la,
# adicione aqui tambem, senao o replay roda com a rede incompleta.
REG = [
    ("A954066DFFE75CEB", "EXFP-RK01", "Faxinal (cabeceira)"),
    ("D251E57DD415F69E", "EXFP-AR01", "Rio Areia (alto)"),
    ("9A6EE7B45495BB7F", "RSRL-GLLS", "Rolantinho"),
    ("936F7F3769D0B500", "EXRL-IN01", "Rio dos Indios"),
    ("D01D80E734592AFB", "EXRZ-CH01", "Chuvisca (alto)"),
    ("CEF2144E84EF82A0", "EXRL-MG01", "Mascarada"),
    ("91661F2504450922", "EXRL-BV01", "Boa Vista"),
    ("726A95A4D3247CB4", "EXFP-CP01", "Corticeiras"),
    ("48B1162D47EC0FE6", "RSRZ-CH01", "Rio Chuvisca"),
    ("80500E0214FFDAF4", "RSRL-CE01", "Rio Rolante"),
    ("2CAED8D9CB62CEB5", "RSRL-BV01", "Boa Vista (baixo)"),
    ("CF98FCFA7E9EE7C1", "RSRL-AR01", "Rio Areia"),
    ("04109F675953A131", "RSRL-BE01", "Rio Areia (norte)"),
    ("BB45660B199C5677", "RSRL-RB01", "Rolante (centro)"),
    ("5BA69743261D364A", "RSRL-RB02", "Rolante (ponte)"),
]


def get(url):
    with urllib.request.urlopen(url, timeout=90) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horas", type=int, default=120,
                    help="horas de historico por estacao (padrao 120)")
    ap.add_argument("--saida", default="/tmp/riosreplay/fixture.json")
    ap.add_argument("--base", default=BASE)
    args = ap.parse_args()

    os.makedirs(os.path.dirname(args.saida) or ".", exist_ok=True)
    fx = {"stations": {}, "forecast": []}

    for sid, code, rio in REG:
        try:
            rows = get(f"{args.base}/estacoes/lastHourly?lastHours={args.horas}&estacao={sid}")
            rows = [r for r in (rows or []) if r]
        except Exception as e:                       # estacao fora do ar nao aborta o resto
            print(f"  ! {code}: {e}", file=sys.stderr)
            rows = []
        fx["stations"][sid] = {"code": code, "rio": rio, "rows": rows}
        print(f"  {code:<10} {len(rows):>4} horas")

    try:
        fx["forecast"] = get(f"{args.base}/weather/ext?hours=168")
    except Exception as e:
        print(f"  ! previsao: {e}", file=sys.stderr)

    with open(args.saida, "w") as f:
        json.dump(fx, f)

    total = sum(len(s["rows"]) for s in fx["stations"].values())
    print(f"\n{args.saida}  ({os.path.getsize(args.saida)/1e6:.1f} MB)")
    print(f"{total} leituras horarias · {len(fx['forecast'])} horas de previsao")
    print("\nAtencao: a previsao e a VIGENTE, nao a que valia durante o evento —")
    print("a TBWeather nao guarda historico. Ver limitacao 4 em docs/detector-enchente.md")


if __name__ == "__main__":
    main()
