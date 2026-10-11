// Servidor estático para probar en casa: node tools/serve.js [puerto]
// Sirve la carpeta del proyecto y muestra la dirección para abrirla desde los celulares (misma wifi).
// Ojo: por http en la red local la pantalla puede apagarse (Wake Lock exige https).
// También se puede importar (crearServidor) desde las pruebas, que así pueden apagarlo para simular un corte de red.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
};

// Devuelve un servidor http (sin arrancar) que sirve los archivos de `raiz`.
export function crearServidor(raiz = RAIZ) {
  return createServer(async (req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = normalize(join(raiz, ruta));
    if (!archivo.startsWith(normalize(raiz))) { res.writeHead(403).end(); return; }
    try {
      const datos = await readFile(archivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(datos);
    } catch {
      res.writeHead(404).end('No encontrado');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.argv[2] ?? 8080);
  crearServidor().listen(puerto, '0.0.0.0', () => {
    console.log(`Tablet/PC:  http://localhost:${puerto}/public/narrator.html`);
    for (const ifs of Object.values(networkInterfaces())) {
      for (const i of ifs ?? []) {
        if (i.family === 'IPv4' && !i.internal) console.log(`Celulares:  http://${i.address}:${puerto}/public/`);
      }
    }
  });
}
