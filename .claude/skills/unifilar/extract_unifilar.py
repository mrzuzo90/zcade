#!/usr/bin/env python3
"""Extract individual electrical symbols from a symbol-sheet PDF as clean SVGs.

Pure vector pipeline (no rasterization): PyMuPDF drawing extraction ->
per-drawing assignment to legend entries via label-anchored capture rects ->
one minimal SVG per symbol; symbol-internal texts kept as <text>.

Reusable core (bbox math, assignment, SVG emission, index merge) vs the
"PER-PDF CALIBRATION" section below, which is specific to one source PDF and
must be rebuilt for each new sheet — see SKILL.md for the calibration loop.
This file's calibration is the worked example for simbolos.pdf (ADG oct 2023).

NOTE: many strokes are axis-aligned segments whose bounding rects are
degenerate (zero width/height). fitz treats those as "empty" in
Rect.intersects()/unions, so all bbox math here is done manually on raw
coordinates — never trust fitz Rect set-ops on this kind of geometry.
"""
import fitz
import json
import os
import re
import sys

# ========================= PER-PDF CALIBRATION ================================
PDF = "/Users/zuzo/Downloads/simbolos.pdf"
SOURCE_NOTE = "simbolos.pdf — Símbolos eléctricos unifilares, Ingeniero Solitario (ADG), octubre 2023"
OUT = "/Users/zuzo/zcade/assets/symbols/unifilares"
REPORT = "--report" in sys.argv
S = 8.0          # uniform scale factor (pt -> svg units)
MARGIN = 1.2     # native pt margin around symbol bbox
# The source sheet draws 0.72pt strokes on ~2-8pt symbols (meant for A3 print at
# ~2mm size); reproduced 1:1 the shapes fill in. Halve stroke width for a usable
# symbol library while keeping all geometry exact.
STROKE_FACTOR = 0.5

BT_BOX = (210.2, 118.5, 426.1, 220.6)
AT_BOX = (445.7, 118.5, 583.1, 220.6)

BT_ENTRIES = [
    # CARGAS
    ("bt_puesta_a_tierra", "baja_tension", "Puesta a tierra", "Puesta a tierra"),
    ("bt_enchufe", "baja_tension", "Enchufe", "Enchufe"),
    ("bt_iluminacion", "baja_tension", "Iluminación", "Iluminación"),
    ("bt_motor", "maquinas", "Motor", "Motor"),
    ("bt_resistencia", "baja_tension", "Resistencia", "Resistencia"),
    ("bt_cuadro_de_protecciones", "baja_tension", "Cuadro de protecciones", "Cuadro de protecciones"),
    ("bt_bateria_condensadores", "maquinas", "Batería de condensadores", "Batería de condensadores"),
    # PROTECCIONES
    ("bt_seccionador", "protecciones", "Seccionador", "Seccionador"),
    ("bt_interruptor_seccionador", "protecciones", "Interruptor-seccionador", "Interruptor-seccionador"),
    ("bt_fusible", "protecciones", "Fusibles", "Fusibles"),
    ("bt_fusible_seccionable", "protecciones", "Fusible seccionable", "Fusible seccionable"),
    ("bt_interruptor_automatico", "protecciones", "Interruptor automático", "Interruptor automático"),
    ("bt_interruptor_diferencial", "protecciones", "Interruptor diferencial", "Interruptor diferencial"),
    ("bt_interruptor_automatico_rele", "protecciones", "Interruptor automático con relé", "Interruptor automático con relé"),
    ("bt_protector_sobretensiones", "protecciones", "Protector sobretensiones transitorias", "Protector sobretensiones transitorias"),
    ("bt_interruptor_temporizador", "protecciones", "Interruptor-temporizador", "Interruptor-temporizador"),
    # RED DE DISTRIBUCIÓN
    ("bt_transformador", "maquinas", "Transformador", "Transformador"),
    ("bt_caja_seccionamiento", "baja_tension", "Caja de seccionamiento (CS)", "Caja de seccionamiento (CS)"),
    ("bt_caja_general_proteccion", "baja_tension", "Caja general de protección (CGP)", "Caja general de protección (CGP)"),
    ("bt_medidor_directo", "medida", "Medidor directo", "Medidor directo"),
    ("bt_medidor_indirecto", "medida", "Medidor indirecto", "Medidor indirecto"),
    ("bt_embarrado", "lineas", "Embarrado", "Embarrado"),
    # FOTOVOLTAICA
    ("bt_modulos_fotovoltaicos", "maquinas", "Módulos fotovoltaicos", "Módulos fotovoltaicos"),
    ("bt_inversor", "maquinas", "Inversor de corriente", "Inversor de corriente"),
    ("bt_regulador_cc", "maquinas", "Regulador u optimizador de corriente continua", "Regulador u optimizador de corriente continua"),
    ("bt_bateria_almacenamiento", "maquinas", "Batería o almacenamiento", "Batería o almacenamiento"),
    ("bt_generador_ca", "maquinas", "Generador corriente alterna", "Generador corriente alterna"),
    ("bt_vatimetro_directo", "medida", "Vatímetro directo", "Vatímetro directo"),
    ("bt_vatimetro_indirecto", "medida", "Vatímetro indirecto", "Vatímetro indirecto"),
    ("bt_sumador_intensidades", "medida", "Sumador de intensidades", "Sumador de intensidades"),
    # CIRCUITOS
    ("bt_linea_monofasica", "lineas", "Línea monofásica (F/N/T)", "Línea monofásica (F/N/T)"),
    ("bt_linea_trifasica_fnt", "lineas", "Línea trifásica (3·F/N/T)", "Línea trifásica (3·F/N/T)"),
    ("bt_linea_trifasica_fn", "lineas", "Línea trifásica (3·F/N)", "Línea trifásica (3·F/N)"),
    ("bt_linea_trifasica_f", "lineas", "Línea trifásica (3·F)", "Línea trifásica (3·F)"),
    ("bt_linea_cc", "lineas", "Línea de corriente contínua (P+/-)", "Línea de corriente contínua (P+/-)"),
    ("bt_linea_cc_tierra", "lineas", "Línea de corriente contínua (P+/-/T)", "Línea de corriente contínua (P+/-/T)"),
    ("bt_indicador", "medida", "Indicador", "Indicador"),
]
TALL = {"bt_interruptor_temporizador": 5.5, "bt_protector_sobretensiones": 3.8,
        "bt_interruptor_diferencial": 4.2, "bt_medidor_indirecto": 4.2}

ANSI_ENTRIES = [
    ("protecciones_rele_27_tension_minima", "Relé 27 — tensión mínima (ANSI)", 208.85),
    ("protecciones_rele_57_cortocircuito", "Relé 57 — cortocircuito (ANSI)", 210.3),
    ("protecciones_rele_59_tension_maxima", "Relé 59 — tensión máxima (ANSI)", 211.8),
    ("protecciones_rele_59n_tension_maxima_homopolar", "Relé 59N — tensión máxima homopolar (ANSI)", 213.25),
    ("protecciones_rele_64_fallo_tierra", "Relé 64 — fallo a tierra (ANSI)", 214.75),
    ("protecciones_rele_81_frecuencia", "Relé 81 — desviación de frecuencia (ANSI)", 216.2),
    ("protecciones_rele_87_diferencial", "Relé 87 — diferencial (ANSI)", 217.65),
]

AT_ENTRIES = [
    ("at_celda_interruptor_automatico", "Celda interruptor automático", (455.5, 137.2, 475.0, 172.5)),
    ("at_celda_interruptor_seccionador_fusible", "Celda interruptor-seccionador con fusible", (475.5, 137.2, 494.5, 172.5)),
    ("at_celda_interruptor_seccionador", "Celda interruptor-seccionador", (495.0, 137.2, 514.0, 172.5)),
    ("at_celda_interruptor_seccionador_telecontrol", "Celda interruptor-seccionador con telecontrol", (514.5, 137.2, 533.5, 172.5)),
    ("at_celda_servicios_auxiliares", "Celda servicios auxiliares", (534.0, 137.2, 553.5, 172.5)),
    ("at_celda_medida", "Celda de medida", (554.0, 137.2, 575.0, 172.5)),
    ("at_caja_celda_flechas_numeros", "Caja celda, flechas y números", (451.5, 176.8, 476.5, 219.5)),
    ("at_transformador_at_bt", "Transformador AT/BT", (478.5, 176.8, 494.5, 219.5)),
    ("at_celda_remonte", "Celda de remonte", (496.0, 176.8, 514.0, 219.5)),
    ("at_celda_interruptor_seccionador_seccionalizadora", "Celda interruptor-seccionador con función seccionalizadora", (514.5, 176.8, 533.5, 219.5)),
    ("at_celda_interruptor_seccionador_interruptor_automatico", "Celda interruptor-seccionador con interruptor automático", (534.5, 176.8, 553.5, 219.5)),
]

HEADERS = {"BAJA TENSIÓN", "ALTA TENSIÓN", "CARGAS", "PROTECCIONES",
           "RED DE DISTRIBUCIÓN", "FOTOVOLTAICA", "CIRCUITOS"}
AT_LABEL_TEXTS = {"Celda interruptor-seccionador", "con fusible", "con telecontrol",
                  "Celda servicios auxiliares", "Celda de medida",
                  "Celda interruptor automático", "Caja celda, flechas y números",
                  "Transformador AT/BT", "Celda de remonte",
                  "con función seccionalizadora", "con interruptor automático"}

# ======================= END PER-PDF CALIBRATION ==============================

# ------------------------------------------------------------------ load -----
doc = fitz.open(PDF)
page = doc[0]
page.remove_rotation()

drawings = page.get_drawings()
tdict = page.get_text("dict")

lines = []
for block in tdict["blocks"]:
    if block["type"] != 0:
        continue
    for line in block["lines"]:
        text = "".join(s["text"] for s in line["spans"]).strip()
        if text:
            lines.append({"bbox": tuple(line["bbox"]), "text": text,
                          "spans": line["spans"]})

def rect_overlap(a, b):
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]

def in_rect(x, y, r):
    return r[0] <= x <= r[2] and r[1] <= y <= r[3]

def find_label(text, box):
    hits = [l for l in lines if l["text"] == text
            and in_rect(l["bbox"][0], l["bbox"][1], box)]
    if len(hits) != 1:
        raise SystemExit(f"label lookup failed for {text!r}: {len(hits)} hits")
    return hits[0]

label_rects = []
for l in lines:
    if l["text"] in HEADERS or l["text"] in AT_LABEL_TEXTS or \
       l["text"].startswith("Función de protección"):
        label_rects.append(l["bbox"])
for _, _, _, lbl in BT_ENTRIES:
    label_rects.append(find_label(lbl, BT_BOX)["bbox"])

# ---------------------------------------------------------------- entries ----
entries = []
for fid, cat, name, lbl in BT_ENTRIES:
    lb = find_label(lbl, BT_BOX)["bbox"]
    cy = (lb[1] + lb[3]) / 2
    half = TALL.get(fid, 3.6)
    entries.append({"id": fid, "category": cat, "name": name,
                    "capture": (lb[0] - 16.5, cy - half, lb[0] - 0.3, cy + half)})
for fid, name, cy in ANSI_ENTRIES:
    entries.append({"id": fid, "category": "protecciones", "name": name,
                    "capture": (267.5, cy - 0.72, 274.5, cy + 0.72)})
for fid, name, rect in AT_ENTRIES:
    entries.append({"id": fid, "category": "alta_tension", "name": name,
                    "capture": rect})

# ------------------------------------------------------------- assignment ----
def in_legend(r):
    return (in_rect(r[0], r[1], BT_BOX) and in_rect(r[2], r[3], BT_BOX)) or \
           (in_rect(r[0], r[1], AT_BOX) and in_rect(r[2], r[3], AT_BOX))

assigned = {e["id"]: [] for e in entries}
unassigned = []
for dr in drawings:
    r = tuple(dr["rect"])
    if not in_legend(r):
        continue
    if r[2] - r[0] > 100:  # legend box borders
        continue
    cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
    owners = [e for e in entries if in_rect(cx, cy, e["capture"])]
    if len(owners) == 1:
        assigned[owners[0]["id"]].append(dr)
    elif len(owners) == 0:
        unassigned.append(r)
    else:
        print(f"!! drawing {r} matches multiple: {[o['id'] for o in owners]}")

def union(rs):
    return (min(r[0] for r in rs), min(r[1] for r in rs),
            max(r[2] for r in rs), max(r[3] for r in rs))

if REPORT:
    for e in entries:
        drs = assigned[e["id"]]
        bb = union([tuple(d["rect"]) for d in drs]) if drs else None
        bbs = [round(v, 1) for v in bb] if bb else None
        print(f"{e['id']:55s} paths={len(drs):3d} bbox={bbs}")
    print("\n-- unassigned drawings inside legend boxes --")
    for r in unassigned:
        print("  ", [round(v, 2) for v in r])
    sys.exit(0)

# ------------------------------------------------------------ svg emission ---
def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s if s != "-0" else "0"

def path_d(dr, ox, oy):
    def tx(p):
        return f"{fmt((p.x - ox) * S)} {fmt((p.y - oy) * S)}"
    d = []
    cur = None
    for it in dr["items"]:
        kind = it[0]
        if kind == "l":
            p1, p2 = it[1], it[2]
            if cur is None or abs(cur.x - p1.x) > 1e-4 or abs(cur.y - p1.y) > 1e-4:
                d.append(f"M {tx(p1)}")
            d.append(f"L {tx(p2)}")
            cur = p2
        elif kind == "c":
            p1, p2, p3, p4 = it[1], it[2], it[3], it[4]
            if cur is None or abs(cur.x - p1.x) > 1e-4 or abs(cur.y - p1.y) > 1e-4:
                d.append(f"M {tx(p1)}")
            d.append(f"C {tx(p2)} {tx(p3)} {tx(p4)}")
            cur = p4
        elif kind == "re":
            r = it[1]
            d.append(f"M {tx(fitz.Point(r.x0, r.y0))} L {tx(fitz.Point(r.x1, r.y0))} "
                     f"L {tx(fitz.Point(r.x1, r.y1))} L {tx(fitz.Point(r.x0, r.y1))} Z")
            cur = None
        elif kind == "qu":
            q = it[1]
            d.append("M " + " L ".join(tx(p) for p in (q.ul, q.ur, q.lr, q.ll)) + " Z")
            cur = None
    if dr.get("closePath"):
        d.append("Z")
    return " ".join(d)

def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

os.makedirs(OUT, exist_ok=True)
index = []
skipped = []

for e in entries:
    drs = assigned[e["id"]]
    if not drs:
        skipped.append(e["id"])
        continue
    bb = union([tuple(d["rect"]) for d in drs])

    # symbol-internal text spans: centered inside the capture rect, not part of
    # any legend label line
    tspans = []
    for l in lines:
        if any(rect_overlap(l["bbox"], lr) for lr in label_rects):
            continue
        for sp in l["spans"]:
            sb = sp["bbox"]
            if in_rect((sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2, e["capture"]):
                tspans.append(sp)
    if tspans:
        bb = union([bb] + [tuple(sp["bbox"]) for sp in tspans])

    bb = (bb[0] - MARGIN, bb[1] - MARGIN, bb[2] + MARGIN, bb[3] + MARGIN)
    ox, oy = bb[0], bb[1]
    W, H = (bb[2] - bb[0]) * S, (bb[3] - bb[1]) * S

    body = []
    for dr in drs:
        d = path_d(dr, ox, oy)
        if not d:
            continue
        t = dr["type"]
        attrs = []
        if "f" in t:
            attrs.append('fill="currentColor"')
            if dr.get("even_odd"):
                attrs.append('fill-rule="evenodd"')
        else:
            attrs.append('fill="none"')
        if "s" in t:
            attrs.append('stroke="currentColor"')
            attrs.append(f'stroke-width="{fmt(max(dr.get("width") or 0.72, 0.4) * STROKE_FACTOR * S)}"')
            dash = dr.get("dashes")
            if dash and dash not in ("[] 0", "[ ] 0", ""):
                nums = [float(x) for x in re.findall(r"[\d.]+", dash.split("]")[0])]
                if nums and any(n > 0 for n in nums):
                    attrs.append(f'stroke-dasharray="{" ".join(fmt(n * S) for n in nums)}"')
            cap = dr.get("lineCap")
            if cap and max(cap) == 1:
                attrs.append('stroke-linecap="round"')
        body.append(f'  <path d="{d}" {" ".join(attrs)}/>')
    for sp in tspans:
        o = sp.get("origin", (sp["bbox"][0], sp["bbox"][3]))
        x, y = (o[0] - ox) * S, (o[1] - oy) * S
        body.append(f'  <text x="{fmt(x)}" y="{fmt(y)}" font-family="Arial, Helvetica, sans-serif" '
                    f'font-size="{fmt(sp["size"] * S)}" fill="currentColor">{esc(sp["text"].strip())}</text>')

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(H)}">\n'
           + "\n".join(body) + "\n</svg>\n")
    fname = f"{e['id']}.svg"
    with open(os.path.join(OUT, fname), "w") as f:
        f.write(svg)
    index.append({"file": fname, "category": e["category"], "name": e["name"]})

# Merge into any existing index.json (later PDFs must not clobber earlier
# symbols): upsert by file name, union the source notes.
index_path = os.path.join(OUT, "index.json")
existing = {"sources": [], "symbols": []}
if os.path.exists(index_path):
    with open(index_path) as f:
        existing = json.load(f)
    if "source" in existing:  # migrate old single-source shape
        existing["sources"] = [existing.pop("source")]
if SOURCE_NOTE not in existing["sources"]:
    existing["sources"].append(SOURCE_NOTE)
by_file = {s["file"]: s for s in existing["symbols"]}
for s in index:
    by_file[s["file"]] = s
merged = [by_file[s["file"]] for s in existing["symbols"] if s["file"] in by_file]
merged += [s for s in index if s["file"] not in {m["file"] for m in merged}]

with open(index_path, "w") as f:
    json.dump({"sources": existing["sources"],
               "extraction": "vector (PyMuPDF path extraction, no rasterization)",
               "symbols": merged}, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"created {len(index)} SVGs in {OUT}")
if skipped:
    print("!! entries with no drawings:", skipped)
if unassigned:
    print(f"!! {len(unassigned)} unassigned drawings inside legend boxes")
