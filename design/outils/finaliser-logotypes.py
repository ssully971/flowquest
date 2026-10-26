"""Recadre les PNG produits par generer-logotypes.mjs et les exporte en WebP transparent.

    python3 design/outils/finaliser-logotypes.py [dossier-sortie-png] [dossier-public-brand]

Rogne au contenu exact (marge minime), redimensionne à ~960 px de large (la hauteur de
lettres reste très supérieure à l'affichage réel) et écrit public/brand/logo-wordmark-*.webp.
Nécessite Pillow et NumPy (outils de travail, pas des dépendances du projet).
"""
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "design/outils/sortie"
DST = sys.argv[2] if len(sys.argv) > 2 else "public/brand"
WIDTH = 960
MARGIN = 0.012  # part de la plus grande dimension

for name in ("white", "black", "color"):
    img = Image.open(f"{SRC}/logotype-{name}.png").convert("RGBA")
    alpha = np.array(img.split()[-1])
    ys, xs = np.where(alpha > 8)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    m = int(max(x1 - x0, y1 - y0) * MARGIN)
    box = (max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m))
    img = img.crop(box)
    img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
    out = f"{DST}/logo-wordmark-{name}.webp"
    img.save(out, "WEBP", quality=95, alpha_quality=100, method=6)
    print(out, img.size, "lettres ≈", y1 - y0, "px avant réduction")
