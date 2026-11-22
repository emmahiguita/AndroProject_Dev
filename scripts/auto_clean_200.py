#!/usr/bin/env python3
"""
ARCHIVO: auto_clean_200.py
QUÉ HACE: Detector y depurador universal para archivos de código >= 200 líneas
          en cualquier proyecto (.ts, .tsx, .js, .py, .kt, .dart, .swift, .cpp).
CÓMO FUNCIONA: Escanea rutas ignorando builds (`node_modules`, `.next`, `target`),
               con `--fix` depura líneas en blanco excesivas y trailing spaces,
               y si un archivo sigue >= 200L genera su mapa SRP de símbolos para
               extraer submódulos sin romper lógica.
POR QUÉ EXISTE: Garantizar arquitectura limpia y mantenible (< 200 líneas/archivo).
"""

import os
import re
import sys

CODE_EXTS = {".swift", ".kt", ".java", ".py", ".dart", ".ts", ".tsx", ".js", ".jsx", ".c", ".cpp", ".h"}
IGNORE_DIRS = {".git", "build", "dist", "out", ".next", "target", "node_modules", ".dart_tool", ".gradle", "__pycache__", "DerivedData", "Pods"}
LIMIT = 200
SYMBOL_RE = re.compile(r"^\s*(?:export\s+(?:async\s+)?)?(?:function|class|interface|const|def|fn|func)\s+([A-Za-z_][A-Za-z0-9_]*)")


def collect_paths(targets: list[str]) -> list[str]:
    paths: list[str] = []
    for t in targets:
        if os.path.isfile(t):
            paths.append(t)
        elif os.path.isdir(t):
            for root, dirs, files in os.walk(t):
                dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
                for f in files:
                    if os.path.splitext(f)[1].lower() in CODE_EXTS:
                        paths.append(os.path.join(root, f))
    return sorted(set(paths))


def clean_safe_whitespace(path: str) -> tuple[int, int]:
    """Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código."""
    with open(path, "r", encoding="utf-8", errors="ignore") as fp:
        orig = fp.readlines()
    cleaned: list[str] = []
    blank_run = 0
    for line in orig:
        stripped = line.rstrip() + "\n"
        if stripped == "\n":
            blank_run += 1
            if blank_run <= 1:
                cleaned.append(stripped)
        else:
            blank_run = 0
            cleaned.append(stripped)
    if cleaned != orig:
        with open(path, "w", encoding="utf-8", newline="\n") as fp:
            fp.writelines(cleaned)
    return len(orig), len(cleaned)


def list_srp_symbols(path: str) -> list[str]:
    """Identifica símbolos principales para guiar extracción modular SRP."""
    out: list[str] = []
    with open(path, "r", encoding="utf-8", errors="ignore") as fp:
        for idx, line in enumerate(fp, 1):
            m = SYMBOL_RE.match(line)
            if m:
                out.append(f"L{idx}:{m.group(1)}")
    return out[:10]


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--fix"]
    do_fix = "--fix" in sys.argv[1:]
    targets = args if args else ["."]
    violations: list[tuple[int, str]] = []

    for p in collect_paths(targets):
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as fp:
                count = sum(1 for _ in fp)
        except OSError:
            continue
        if count >= LIMIT and do_fix:
            before, after = clean_safe_whitespace(p)
            if after < before:
                print(f"[AUTO-DEPURADO] {p}: {before} -> {after} líneas")
            count = after
        if count >= LIMIT:
            violations.append((count, p))

    violations.sort(reverse=True)
    for count, p in violations:
        syms = ", ".join(list_srp_symbols(p)) or "sin símbolos"
        print(f"[VIOLACION >= {LIMIT}] {count:4d} lines: {p} | SRP: {syms}")
    print(f"Files >= {LIMIT} lines: {len(violations)}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
