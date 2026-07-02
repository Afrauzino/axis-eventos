#!/usr/bin/env python3
# Hook UserPromptSubmit: anexa cada mensagem do Anderson em docs/IDEIAS_LOG.md
# com timestamp, para nunca perder ideias. Nunca bloqueia o prompt (sempre exit 0).
import sys, json, datetime, os

LOG = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "IDEIAS_LOG.md")

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    prompt = (data.get("prompt") or data.get("user_prompt") or "").strip()
    if not prompt:
        return
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    path = os.path.abspath(LOG)
    novo = not os.path.exists(path)
    try:
        with open(path, "a", encoding="utf-8") as f:
            if novo:
                f.write("# AXIS — Log automático de mensagens (ideias)\n\n"
                        "> Gerado por hook a cada mensagem. NÃO editar à mão — é o backup bruto.\n"
                        "> A caixa organizada é `docs/IDEIAS.md`.\n\n")
            f.write(f"## {ts}\n{prompt}\n\n")
    except Exception:
        pass

if __name__ == "__main__":
    main()
    sys.exit(0)
