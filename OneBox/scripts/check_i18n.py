#!/usr/bin/env python3
"""Every interface text in both languages?

    python scripts/check_i18n.py          # from OneBoxFrontEnd/OneBox

1. Keys used with t('…') that are missing in locales/en.json or es.json (the
   app then shows the English default written in the code, even in Spanish).
2. Visible English text written straight into the JSX (not translatable at
   all): text between tags and title / placeholder / aria-label attributes.
   Brand names are ignored. Exit code 1 if anything is missing.
"""
import glob
import json
import os
import re
import sys

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
BRANDS = {"OneBox", "Trello", "Gmail", "WhatsApp", "Google", "Meta", "Asana", "Slack", "AI", "IA", "OK",
          "English", "Español", "Email", "OneBox Agent", "PM"}


def flat(d, p=""):
    out = {}
    for k, v in d.items():
        out.update(flat(v, p + k + ".")) if isinstance(v, dict) else out.__setitem__(p + k, v)
    return out


def has(d, k):
    return k in d or k + "_one" in d or k + "_other" in d


def main() -> int:
    es = flat(json.load(open(os.path.join(SRC, "locales", "es.json"), encoding="utf-8")))
    en = flat(json.load(open(os.path.join(SRC, "locales", "en.json"), encoding="utf-8")))
    key_re = re.compile(r"""\bt\(\s*['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]""")
    text_re = re.compile(r">\s*([A-Z][A-Za-z'’]+(?:[ ,][A-Za-z'’.]+){0,6})\s*<")
    attr_re = re.compile(r"""(?:title|placeholder|aria-label)=["']([A-Z][^"'{}]{2,})["']""")
    missing, hard = {}, []
    files = sorted(glob.glob(os.path.join(SRC, "**", "*.tsx"), recursive=True)
                   + glob.glob(os.path.join(SRC, "**", "*.ts"), recursive=True))
    for f in files:
        name = os.path.relpath(f, SRC)
        for n, line in enumerate(open(f, encoding="utf-8"), 1):
            for m in key_re.finditer(line):
                k = m.group(1)
                langs = [lg for lg, d in (("es", es), ("en", en)) if not has(d, k)]
                if langs:
                    missing.setdefault(k, (name, n, langs))
            if f.endswith(".tsx"):
                for m in list(text_re.finditer(line)) + list(attr_re.finditer(line)):
                    txt = m.group(1).strip()
                    if txt not in BRANDS and "VITE_" not in line:
                        hard.append((name, n, txt))
    for k, (name, n, langs) in sorted(missing.items()):
        print(f"missing in {'/'.join(langs):5} {k:55} {name}:{n}")
    for name, n, txt in hard:
        print(f"hardcoded        {txt[:55]:55} {name}:{n}")
    print(f"\n{len(missing)} key(s) missing, {len(hard)} hardcoded text(s).")
    return 1 if missing or hard else 0


if __name__ == "__main__":
    sys.exit(main())
