import json
import sys
from pathlib import Path

import fitz  # PyMuPDF
from paddleocr import PaddleOCR

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ocr = PaddleOCR(
    lang="fr",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=True,
)


def pdf_to_images(pdf_path: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    images = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        pix = page.get_pixmap(dpi=200)
        image_path = output_dir / f"page_{page_index + 1}.png"
        pix.save(image_path)
        images.append(image_path)

    doc.close()
    return images


def normaliser_position(position):
    if position is None:
        return None

    try:
        return position.tolist()
    except AttributeError:
        return position


def ocr_image(image_path: Path):
    result = ocr.predict(str(image_path))

    lignes = []
    textes = []

    if not result:
        return {
            "texte": "",
            "lignes": [],
        }

    for res in result:
        data = res.json if hasattr(res, "json") else {}

        if callable(data):
            data = data()

        contenu = data.get("res", {})

        rec_texts = contenu.get("rec_texts", [])
        rec_scores = contenu.get("rec_scores", [])
        rec_polys = contenu.get("rec_polys", [])

        for index, texte in enumerate(rec_texts):
            confiance = float(rec_scores[index]) if index < len(rec_scores) else 0
            position = normaliser_position(rec_polys[index]) if index < len(rec_polys) else None

            lignes.append({
                "texte": texte,
                "confiance": confiance,
                "position": position,
            })

            textes.append(texte)

    return {
        "texte": "\n".join(textes),
        "lignes": lignes,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Chemin du fichier manquant",
        }, ensure_ascii=False))
        sys.exit(1)

    fichier = Path(sys.argv[1])

    if not fichier.exists():
        print(json.dumps({
            "success": False,
            "error": f"Fichier introuvable: {fichier}",
        }, ensure_ascii=False))
        sys.exit(1)

    temp_dir = fichier.parent / "_ocr_temp" / fichier.stem

    if fichier.suffix.lower() == ".pdf":
        images = pdf_to_images(fichier, temp_dir)
    elif fichier.suffix.lower() in [".jpg", ".jpeg", ".png"]:
        images = [fichier]
    else:
        print(json.dumps({
            "success": False,
            "error": "Format non supporté. Formats acceptés : PDF, JPG, PNG.",
        }, ensure_ascii=False))
        sys.exit(1)

    pages = []
    texte_complet = []

    for index, image_path in enumerate(images, start=1):
        resultat_page = ocr_image(image_path)

        pages.append({
            "page": index,
            "texte": resultat_page["texte"],
            "lignes": resultat_page["lignes"],
        })

        texte_complet.append(resultat_page["texte"])

    print(json.dumps({
        "success": True,
        "fichier": str(fichier),
        "texte": "\n\n".join(texte_complet),
        "pages": pages,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()