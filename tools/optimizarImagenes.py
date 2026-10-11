# Reduce las ilustraciones de los roles para que la app cargue rápido en los celulares.
#   python tools/optimizarImagenes.py            → solo informa (no cambia nada)
#   python tools/optimizarImagenes.py --aplicar  → reescribe las imágenes grandes a 512 px, WebP calidad 82
# Cada partida carga las cartas del mazo en cada celular: 30 imágenes de 1 MB serían ~30 MB.
# Guarda los originales en alta resolución FUERA del repositorio.
import os
import sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA = os.path.join(RAIZ, 'public', 'img', 'roles')
LADO = 512
CALIDAD = 82
LIMITE_KB = 120  # lo que pese más que esto se considera grande


def main():
    sys.stdout.reconfigure(encoding='utf-8')  # la consola de Windows usa cp1252
    aplicar = '--aplicar' in sys.argv
    antes = despues = 0
    for nombre in sorted(os.listdir(CARPETA)):
        if not nombre.lower().endswith('.webp'):
            continue
        ruta = os.path.join(CARPETA, nombre)
        kb = os.path.getsize(ruta) / 1024
        img = Image.open(ruta)
        grande = max(img.size) > LADO or kb > LIMITE_KB
        antes += kb
        if not grande:
            despues += kb
            continue
        if aplicar:
            img = img.convert('RGB')
            if max(img.size) > LADO:
                img = img.resize((LADO, int(img.height * LADO / img.width)) if img.width >= img.height
                                 else (int(img.width * LADO / img.height), LADO), Image.LANCZOS)
            img.save(ruta, 'WEBP', quality=CALIDAD, method=6)
            nuevo = os.path.getsize(ruta) / 1024
            despues += nuevo
            print(f'{nombre}: {kb:.0f} KB → {nuevo:.0f} KB')
        else:
            print(f'{nombre}: {kb:.0f} KB ({img.width}×{img.height}) — se reduciría')
            despues += 60  # estimación
    print(f'\nTotal: {antes / 1024:.1f} MB' + (f' → {despues / 1024:.1f} MB' if aplicar else f' (≈ {despues / 1024:.1f} MB tras optimizar)'))
    if not aplicar:
        print('Para aplicar los cambios: python tools/optimizarImagenes.py --aplicar')


if __name__ == '__main__':
    main()
