"""Fabrique les icones de l'app mobile a partir de logo-master.png.

    python brand/generer-icones.py

Pourquoi un script plutot que cinq PNG poses a la main : les coordonnees de
l'embleme dans le logo maitre (CX, CY, R plus bas) sont le seul savoir non
reconstituable de l'operation. Sans elles, refaire une icone apres une retouche
du logo veut dire re-mesurer au pixel. Les images generees sont versionnees,
ce script sert a les regenerer, pas a les produire au build.

Seul l'embleme est repris — le cercle, la goutte et « YANI ». Le lockup complet
« Concept By Fati » devient une tache doree sous 100 px et se fait rogner par
le masque circulaire d'Android. Il reste destine a la communication, aux
recus et aux emails.

Dependance : Pillow (`pip install Pillow`).
"""
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "brand" / "logo-master.png"
DST = RACINE / "mobile" / "assets"

# Position de l'embleme, mesuree sur le logo maitre (2048x2048).
CX, CY, R = 1091, 702, 470

# Fond de marque, releve sur le logo lui-meme : gris tres sombre au centre,
# noir aux bords. #080808 est aussi la couleur du splash natif (app.json).
CENTRE, BORD = 0x25, 0x08

# Android compose deux calques de 108 dp mais ne garantit d'afficher que le
# cercle central de 66 dp : au-dela, chaque fabricant rogne comme il l'entend.
ZONE_SURE = 66 / 108

src = Image.open(SRC).convert("RGB")


def fond_radial(taille):
    """Reproduit le degrade du logo maitre."""
    img = Image.new("RGB", (taille, taille), (BORD, BORD, BORD))
    d = ImageDraw.Draw(img)
    for i in range(taille // 2, 0, -1):
        t = i / (taille / 2)
        v = int(BORD + (CENTRE - BORD) * (1 - t) ** 1.5)
        d.ellipse([taille // 2 - i] * 2 + [taille // 2 + i] * 2, fill=(v, v, v))
    return img


def cercle(taille, surechantillon=4):
    """Masque circulaire anticrenele."""
    m = Image.new("L", (taille * surechantillon,) * 2, 0)
    ImageDraw.Draw(m).ellipse([0, 0, m.width, m.height], fill=255)
    return m.resize((taille, taille), Image.LANCZOS)


def or_seul(img):
    """Ne garde que le dore, sur transparence.

    L'alpha vient de la chrominance (r - b) et non de la luminosite : le fond du
    logo est un gris neutre, dont l'or reste tres eloigne meme dans ses parties
    les plus sombres. Un seuil sur la seule luminosite trouait le bronze de
    l'anneau.
    """
    px = img.convert("RGB").load()
    out = Image.new("RGBA", img.size)
    op = out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            a = max((r - b - 6) / 26.0, (max(r, g, b) - 52) / 55.0)
            op[x, y] = (r, g, b, 0 if a < 0 else (255 if a > 1 else int(a * 255)))
    return out


def poser(canevas, motif, occupation):
    """Centre `motif` sur `canevas`, dimensionne a `occupation` du cote."""
    d = int(canevas.width * occupation)
    motif = motif.resize((d, d), Image.LANCZOS)
    o = (canevas.width - d) // 2
    canevas.paste(motif, (o, o), motif)
    return canevas


embleme = src.crop((CX - R, CY - R, CX + R, CY + R))
embleme.putalpha(cercle(embleme.width))

# L'or detoure, puis reduit au disque de l'embleme : sans ce second masque, le
# haut des lettres de « Concept » ressortirait dans les angles du recadrage.
dore = or_seul(embleme)
dore.putalpha(
    Image.composite(
        dore.getchannel("A"), Image.new("L", dore.size, 0), cercle(dore.width)
    )
)

# 1. Icone principale : iOS et repli general. Pleine page, coins arrondis par le
#    systeme, et aucune transparence — iOS refuse les icones a canal alpha.
icone = poser(fond_radial(1024).convert("RGBA"), embleme, 0.82).convert("RGB")
icone.save(DST / "icon.png")

# 2. Calque de fond Android.
fond_radial(512).convert("RGBA").save(DST / "android-icon-background.png")

# 3. Calque avant Android : l'or seul, pour que le degrade du fond traverse
#    l'interieur de l'anneau. Decouper l'embleme avec son propre fond laissait
#    un disque plus clair, visible sur les grandes tailles.
poser(Image.new("RGBA", (512, 512), (0, 0, 0, 0)), dore, ZONE_SURE).save(
    DST / "android-icon-foreground.png"
)

# 4. Calque monochrome : icones thematiques d'Android 13+, que le systeme
#    teinte selon le fond d'ecran. On ne fournit que la silhouette.
blanc = Image.new("RGBA", dore.size, (255, 255, 255, 0))
blanc.putalpha(dore.getchannel("A"))
poser(Image.new("RGBA", (432, 432), (0, 0, 0, 0)), blanc, ZONE_SURE).save(
    DST / "android-icon-monochrome.png"
)

# 5. Favicon du build web.
icone.resize((48, 48), Image.LANCZOS).convert("RGBA").save(DST / "favicon.png")

print(f"icones regenerees dans {DST}")
