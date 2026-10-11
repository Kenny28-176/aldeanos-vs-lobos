# Créditos de las ilustraciones

Aquí se anota **de dónde sale cada imagen** del proyecto y bajo qué licencia se publica.
Solo se aceptan imágenes que sean **propias** o tengan una **licencia que permita su uso y redistribución**
(por ejemplo CC0, CC BY, CC BY-SA). No se aceptan capturas, escaneos ni recortes de juegos de terceros.

## Cómo completarlo

Una fila por grupo de imágenes:

| Archivos | Autoría / herramienta | Licencia | Fecha | Notas |
|---|---|---|---|---|
| `roles/*.webp`, `portada.webp` | Obra propia, generadas con IA (modelo Gemini 3.1 Pro de Google, usado desde el IDE Antigravity) y adaptadas al proyecto | CC0 | 2026-10-11 | Ilustraciones estilo Tarot de los roles y portada |
| `icono.svg`, `icono-192.png`, `icono-512.png` | Generadas por `tools/generarIconos.py` (dibujo geométrico propio) | MIT | 2026-10-10 | Icono de la app |

## Recomendaciones

- Guarda los originales en alta resolución **fuera** del repo y sube versiones de **512 px** como máximo
  (`python tools/optimizarImagenes.py` las reduce). Una partida carga todas las cartas del mazo en cada celular.
- Si una imagen se generó con IA, anota la herramienta y no pidas ni uses el estilo de una obra o autor concretos.
