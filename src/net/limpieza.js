// Limpieza de salas viejas: decide qué salas borrar o marcar. Es una función pura (sin red) para poder probarla.
//   salas: { CODIGO: { claves: ['state', 'meta', …], creada: número|null } }
//   - Con fecha de creación: se borra si tiene más de `dias` días.
//   - Con partida pero sin fecha (versiones antiguas): se marca con la hora actual y empieza a contar desde ahora.
//   - Sin partida ni fecha (restos de un celular que seguía conectado): se borra.
export function planLimpieza(salas, ahoraMs, dias = 2) {
  const limite = ahoraMs - dias * 86_400_000;
  const borrar = [];
  const marcar = [];
  for (const [codigo, { claves = [], creada = null }] of Object.entries(salas)) {
    if (creada) {
      if (creada < limite) borrar.push(codigo);
    } else if (claves.includes('state')) {
      marcar.push(codigo);
    } else {
      borrar.push(codigo);
    }
  }
  return { borrar, marcar };
}
