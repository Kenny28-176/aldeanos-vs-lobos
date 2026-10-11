# Genera el icono de la app (original del proyecto): una cabeza de lobo frente a una luna creciente.
#   python tools/generarIconos.py
# Escribe public/img/icono.svg y public/img/icono-192.png / icono-512.png.
# El dibujo es geométrico y propio: no deriva de ninguna ilustración de terceros.
import os
from PIL import Image, ImageDraw, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'public', 'img')

# Geometría en un lienzo de 512 × 512.
CABEZA = [(132, 250), (170, 78), (238, 176), (256, 168), (274, 176), (342, 78), (380, 250), (420, 320),
          (350, 412), (300, 446), (256, 458), (212, 446), (162, 412), (92, 320)]
OREJA_IZQ = [(160, 230), (178, 120), (222, 186)]
OREJA_DER = [(352, 230), (334, 120), (290, 186)]
HOCICO = [(256, 300), (214, 360), (232, 430), (256, 440), (280, 430), (298, 360)]
OJO_IZQ = [(180, 270), (224, 282), (212, 300), (172, 288)]
OJO_DER = [(332, 270), (288, 282), (300, 300), (340, 288)]
LUNA = dict(cx=414, cy=100, r=54, corte_dx=22, corte_dy=-10, corte_r=46)
ESTRELLAS = [(70, 90, 5), (130, 150, 3), (60, 200, 3), (210, 60, 4), (460, 190, 3), (470, 270, 4)]

COLORES = dict(fondo_centro=(36, 48, 104), fondo_borde=(4, 5, 11), cabeza=(43, 49, 80), borde=(207, 216, 255),
               oreja=(92, 70, 112), hocico=(70, 78, 118), ojo=(255, 178, 30), nariz=(11, 13, 22), luna=(244, 240, 224))


def png(lado):
    S = 1024  # se dibuja el doble de grande y se reduce, para suavizar los bordes
    k = S / 512
    sc = lambda pts: [(x * k, y * k) for x, y in pts]

    g = Image.radial_gradient('L').resize((S * 2, S * 2))
    g = g.crop((int(S * 0.55), 0, int(S * 0.55) + S, S))  # el brillo queda arriba a la derecha
    lienzo = ImageOps.colorize(g, black=COLORES['fondo_centro'], white=COLORES['fondo_borde']).convert('RGBA')
    d = ImageDraw.Draw(lienzo)

    for x, y, r in ESTRELLAS:
        d.ellipse((x * k - r * k, y * k - r * k, x * k + r * k, y * k + r * k), fill=(255, 255, 240, 220))

    # Luna creciente: círculo menos otro círculo desplazado.
    m = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(m)
    L = LUNA
    md.ellipse(((L['cx'] - L['r']) * k, (L['cy'] - L['r']) * k, (L['cx'] + L['r']) * k, (L['cy'] + L['r']) * k), fill=255)
    cx, cy = L['cx'] + L['corte_dx'], L['cy'] + L['corte_dy']
    md.ellipse(((cx - L['corte_r']) * k, (cy - L['corte_r']) * k, (cx + L['corte_r']) * k, (cy + L['corte_r']) * k), fill=0)
    lienzo.paste(Image.new('RGBA', (S, S), COLORES['luna'] + (255,)), (0, 0), m)

    d.polygon(sc(CABEZA), fill=COLORES['cabeza'])
    d.line(sc(CABEZA) + [sc(CABEZA)[0]], fill=COLORES['borde'], width=int(7 * k), joint='curve')
    d.polygon(sc(OREJA_IZQ), fill=COLORES['oreja'])
    d.polygon(sc(OREJA_DER), fill=COLORES['oreja'])
    d.polygon(sc(HOCICO), fill=COLORES['hocico'])
    d.polygon(sc(OJO_IZQ), fill=COLORES['ojo'])
    d.polygon(sc(OJO_DER), fill=COLORES['ojo'])
    d.ellipse((234 * k, 428 * k, 278 * k, 452 * k), fill=COLORES['nariz'])

    # Esquinas redondeadas.
    mascara = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, S, S), radius=int(S * 0.2), fill=255)
    lienzo.putalpha(mascara)
    return lienzo.resize((lado, lado), Image.LANCZOS)


def svg():
    def pts(p):
        return ' '.join(f'{x},{y}' for x, y in p)
    L = LUNA
    cx, cy = L['cx'] + L['corte_dx'], L['cy'] + L['corte_dy']
    c = COLORES
    rgb = lambda t: '#%02x%02x%02x' % t
    estrellas = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fffff0" opacity=".85"/>' for x, y, r in ESTRELLAS)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Aldeanos vs Lobos">
  <defs>
    <radialGradient id="cielo" cx="75%" cy="12%" r="95%"><stop offset="0" stop-color="{rgb(c['fondo_centro'])}"/><stop offset="1" stop-color="{rgb(c['fondo_borde'])}"/></radialGradient>
    <mask id="creciente"><rect width="512" height="512" fill="#000"/><circle cx="{L['cx']}" cy="{L['cy']}" r="{L['r']}" fill="#fff"/><circle cx="{cx}" cy="{cy}" r="{L['corte_r']}" fill="#000"/></mask>
  </defs>
  <rect width="512" height="512" rx="102" fill="url(#cielo)"/>
  {estrellas}
  <rect width="512" height="512" fill="{rgb(c['luna'])}" mask="url(#creciente)"/>
  <polygon points="{pts(CABEZA)}" fill="{rgb(c['cabeza'])}" stroke="{rgb(c['borde'])}" stroke-width="7" stroke-linejoin="round"/>
  <polygon points="{pts(OREJA_IZQ)}" fill="{rgb(c['oreja'])}"/><polygon points="{pts(OREJA_DER)}" fill="{rgb(c['oreja'])}"/>
  <polygon points="{pts(HOCICO)}" fill="{rgb(c['hocico'])}"/>
  <polygon points="{pts(OJO_IZQ)}" fill="{rgb(c['ojo'])}"/><polygon points="{pts(OJO_DER)}" fill="{rgb(c['ojo'])}"/>
  <ellipse cx="256" cy="440" rx="22" ry="12" fill="{rgb(c['nariz'])}"/>
</svg>
'''


if __name__ == '__main__':
    os.makedirs(SALIDA, exist_ok=True)
    open(os.path.join(SALIDA, 'icono.svg'), 'w', encoding='utf8').write(svg())
    for lado in (192, 512):
        png(lado).quantize(colors=200, method=Image.Quantize.FASTOCTREE).save(os.path.join(SALIDA, f'icono-{lado}.png'), optimize=True)
    print('Iconos generados en', SALIDA)
