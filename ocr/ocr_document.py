import json
import shutil
import sys
import traceback
from pathlib import Path

import os
import time

os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"

import fitz  # PyMuPDF
from paddleocr import PaddleOCR
from PIL import Image


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


PDF_DPI = 200
MAX_SIDE = 2200
FORMATS_IMAGE = {".jpg", ".jpeg", ".png"}


debut_initialisation = time.perf_counter()

ocr = PaddleOCR(
    lang="fr",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
    cpu_threads=4,
)

duree_initialisation = time.perf_counter() - debut_initialisation


def journaliser(message: str) -> None:
    """Écrit les informations techniques sur stderr pour préserver le JSON stdout."""
    print(f"[OCR] {message}", file=sys.stderr, flush=True)


def supprimer_dossier_temporaire(temp_dir: Path) -> None:
    """
    Supprime le dossier temporaire du document puis le dossier parent _ocr_temp
    uniquement s'il est devenu vide.
    """
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)

    dossier_parent = temp_dir.parent

    if dossier_parent.exists():
        try:
            dossier_parent.rmdir()
        except OSError:
            # Le dossier contient encore le traitement temporaire d'un autre document.
            pass


def pdf_to_images(pdf_path: Path, output_dir: Path) -> list[Path]:
    """Convertit chaque page PDF en PNG à 200 DPI."""
    output_dir.mkdir(parents=True, exist_ok=True)
    images: list[Path] = []

    with fitz.open(pdf_path) as document:
        for page_index, page in enumerate(document, start=1):
            image_path = output_dir / f"page_{page_index}.png"
            pixmap = page.get_pixmap(dpi=PDF_DPI, alpha=False)
            pixmap.save(str(image_path))
            images.append(image_path)

            journaliser(
                f"Page {page_index}/{len(document)} convertie : "
                f"{pixmap.width}x{pixmap.height}"
            )

    return images


def copier_image_source(image_path: Path, output_dir: Path) -> list[Path]:
    """
    Copie une image source dans le dossier temporaire.

    L'image originale n'est jamais redimensionnée ni modifiée.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    destination = output_dir / f"page_1{image_path.suffix.lower()}"
    shutil.copy2(image_path, destination)

    return [destination]


def optimiser_image(image_path: Path) -> None:
    """Réduit une image lorsque son côté le plus long dépasse MAX_SIDE."""
    with Image.open(image_path) as image_source:
        image_source.load()

        largeur, hauteur = image_source.size
        plus_grand_cote = max(largeur, hauteur)

        if plus_grand_cote <= MAX_SIDE:
            journaliser(
                f"Image conservée sans redimensionnement : {largeur}x{hauteur}"
            )
            return

        ratio = MAX_SIDE / plus_grand_cote
        nouvelle_taille = (
            max(1, round(largeur * ratio)),
            max(1, round(hauteur * ratio)),
        )

        image_redimensionnee = image_source.resize(
            nouvelle_taille,
            Image.Resampling.LANCZOS,
        )

        if image_redimensionnee.mode != "RGB":
            image_redimensionnee = image_redimensionnee.convert("RGB")

        image_redimensionnee.save(image_path, format="PNG", optimize=True)
        image_redimensionnee.close()

    journaliser(
        f"Image redimensionnée : "
        f"{largeur}x{hauteur} -> {nouvelle_taille[0]}x{nouvelle_taille[1]}"
    )


def normaliser_position(position):
    if position is None:
        return None

    try:
        return position.tolist()
    except AttributeError:
        return position


def ocr_image(image_path: Path) -> dict:
    optimiser_image(image_path)

    journaliser(f"Analyse PaddleOCR : {image_path.name}")

    debut_ocr = time.perf_counter()

    resultats = ocr.predict(str(image_path))

    duree_ocr = time.perf_counter() - debut_ocr

    journaliser(
        f"Analyse PaddleOCR terminée : {image_path.name} "
        f"en {duree_ocr:.2f} s"
    )

    lignes = []
    textes = []

    if not resultats:
        return {
            "texte": "",
            "lignes": [],
        }

    for resultat in resultats:
        data = resultat.json if hasattr(resultat, "json") else {}

        if callable(data):
            data = data()

        contenu = data.get("res", {})
        rec_texts = contenu.get("rec_texts", [])
        rec_scores = contenu.get("rec_scores", [])
        rec_polys = contenu.get("rec_polys", [])

        for index, texte in enumerate(rec_texts):
            confiance = (
                float(rec_scores[index])
                if index < len(rec_scores)
                else 0.0
            )

            position = (
                normaliser_position(rec_polys[index])
                if index < len(rec_polys)
                else None
            )

            lignes.append(
                {
                    "texte": str(texte),
                    "confiance": confiance,
                    "position": position,
                }
            )

            textes.append(str(texte))

    return {
        "texte": "\n".join(textes),
        "lignes": lignes,
    }


def traiter_document(fichier: Path, temp_dir: Path) -> dict:
    extension = fichier.suffix.lower()

    if extension == ".pdf":
        images = pdf_to_images(fichier, temp_dir)
    elif extension in FORMATS_IMAGE:
        images = copier_image_source(fichier, temp_dir)
    else:
        return {
            "success": False,
            "error": (
                "Format non supporté. "
                "Formats acceptés : PDF, JPG, JPEG, PNG."
            ),
        }

    pages = []
    texte_complet = []

    for numero_page, image_path in enumerate(images, start=1):
        journaliser(f"Traitement de la page {numero_page}/{len(images)}")

        resultat_page = ocr_image(image_path)

        pages.append(
            {
                "page": numero_page,
                "texte": resultat_page["texte"],
                "lignes": resultat_page["lignes"],
            }
        )
        texte_complet.append(resultat_page["texte"])

    return {
        "success": True,
        "fichier": str(fichier),
        "texte": "\n\n".join(texte_complet),
        "pages": pages,
    }


def main() -> None:
    debut_total = time.perf_counter()

    journaliser(
        f"Initialisation PaddleOCR : {duree_initialisation:.2f} s"
    )

    if len(sys.argv) < 2:
        resultat = {
            "success": False,
            "error": "Chemin du fichier manquant",
        }
        print(json.dumps(resultat, ensure_ascii=False))
        return

    fichier = Path(sys.argv[1]).expanduser().resolve()

    if not fichier.exists():
        resultat = {
            "success": False,
            "error": f"Fichier introuvable : {fichier}",
        }
        print(json.dumps(resultat, ensure_ascii=False))
        return

    temp_dir = fichier.parent / "_ocr_temp" / fichier.stem

    # Nettoie un éventuel reliquat d'un traitement précédent interrompu.
    supprimer_dossier_temporaire(temp_dir)

    try:
        resultat = traiter_document(fichier, temp_dir)
    except Exception as erreur:
        journaliser("Échec du traitement OCR.")
        traceback.print_exc(file=sys.stderr)

        resultat = {
            "success": False,
            "fichier": str(fichier),
            "error": f"{type(erreur).__name__}: {erreur}",
        }
    finally:
        supprimer_dossier_temporaire(temp_dir)
        
    duree_totale = time.perf_counter() - debut_total
    journaliser(f"Traitement total : {duree_totale:.2f} s")

    # Une seule sortie JSON sur stdout, y compris en cas d'erreur.
    print(json.dumps(resultat, ensure_ascii=False))


if __name__ == "__main__":
    main()
