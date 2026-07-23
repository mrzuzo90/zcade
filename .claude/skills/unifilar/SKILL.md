---
name: unifilar
description: Use when Zuzo provides a PDF of electrical symbols (unifilares, IEC, CADe-style sheets) to extract, vectorize to SVG, and catalog for zCADe — e.g. "extrae los símbolos de este PDF", /unifilar <ruta.pdf>, or any symbol-sheet vectorization request.
---

# Extracción vectorial de símbolos desde PDF

## Overview

Extrae cada símbolo de una lámina PDF de símbolos como SVG mínimo **sin rasterizar** (nada de Potrace): los trazados vectoriales se leen directamente con PyMuPDF y se reagrupan por entrada de leyenda. Herramienta central: `extract_unifilar.py` (en este directorio) — núcleo reutilizable + sección `PER-PDF CALIBRATION` que se rehace para cada lámina nueva. La calibración actual es el ejemplo funcional (simbolos.pdf ADG 2023, 55 símbolos).

## Entorno

Venv persistente: `~/.claude/venvs/pymupdf/bin/python` (pymupdf + pillow). Si falta: `python3 -m venv ~/.claude/venvs/pymupdf && ~/.claude/venvs/pymupdf/bin/pip install pymupdf pillow`.

## Flujo por PDF nuevo

1. **Inspección**: `Read` del PDF (vista visual) + script corto: `page.rect`, `page.rotation`, nº de drawings, y volcado de líneas de texto con bboxes (`get_text("dict")`). Si `rotation != 0` → `page.remove_rotation()` antes de todo.
2. **Calibración**: copia `extract_unifilar.py` al scratchpad; reescribe la sección `PER-PDF CALIBRATION`: cajas de leyenda, tabla de entradas (id snake_case con prefijo de categoría, categoría, nombre, etiqueta exacta), rects de captura. Etiqueta a la derecha del símbolo → captura anclada a `label.x0`; etiqueta encima → rect explícito.
3. **Iterar `--report`** hasta: cero huérfanos ("unassigned"), cero multi-asignados, bboxes plausibles. Huérfanos pegados a un símbolo → ampliar su ventana de captura (dict `TALL`).
4. **Generar + verificar**: ejecutar sin `--report`; validar XML (`ET.parse` sobre cada SVG); renderizar muestra (`qlmanage -t -s 256 -o . *.svg`) y **mirar** el contact sheet — la geometría correcta con trazos ilegibles también es un fallo (ajustar `STROKE_FACTOR`).
5. **Tests del repo**: `npx vitest run tests/symbols/` debe seguir verde.

## Contrato de salida

- SVGs en `assets/symbols/unifilares/`, nombres snake_case con prefijo (`bt_`, `at_`, `protecciones_rele_`…).
- Solo `<svg viewBox>` + `<path>` + `<text>` (rótulos internos: M, Wh, números ANSI…), todo `currentColor`.
- `index.json` se **fusiona** (upsert por `file`, unión de `sources`) — el script ya lo hace; nunca sobrescribir a mano.
- El registro de zcade usa glob **no recursivo** `/assets/symbols/*.svg`: la subcarpeta no se auto-registra. Si eso cambia alguna vez, estos SVGs romperían los tests de paridad.

## Trampas conocidas (todas observadas en la primera extracción)

| Síntoma | Causa real | Corrección |
|---|---|---|
| Texto con bboxes verticales / coords sin sentido | Página con `/Rotate` (p. ej. 270°) | `page.remove_rotation()` antes de leer nada |
| "No hay drawings" en una zona que se ve renderizada | Segmentos axis-aligned → rects degenerados (área 0); fitz los trata como *empty*: `Rect.intersects()` da False y las uniones `\|` los descartan | Toda la aritmética de bbox/overlap a mano sobre coordenadas crudas (ya en el script) |
| Símbolos vecinos fusionados (p. ej. relés ANSI apilados) | Clustering por proximidad encadena filas contiguas | Asignación **por trazado individual** (centro de bbox → rect de captura), no por cluster |
| Círculos que parecen discos rellenos | La lámina usa trazo 0,72pt sobre símbolos de 2–8pt pensados para imprimir a ~2mm | `STROKE_FACTOR` (0.5 por defecto); geometría intacta |
| Falta el remate superior/inferior de un símbolo | Trazado cae fuera de la ventana de captura por décimas de pt | Revisar la lista de huérfanos del `--report` y ampliar esa entrada en `TALL` |

## Errores a evitar

- No rasterizar "para simplificar": el output debe ser vector puro salvo que el PDF sea un escaneo (en ese caso, avisar a Zuzo antes de tirar de Potrace).
- No inventar símbolos ausentes: si la lámina no trae contactor, no hay `bt_contactor`; decirlo en el resumen.
- Fidelidad a la fuente incluso si parece errónea (p. ej. la lámina ADG etiqueta el relé de cortocircuito como ANSI 57, no 50/51) — extraer tal cual y señalarlo.
