// Une los textos de un idioma (nombres y guías de los roles) con los datos base de roles.json.
// roles.en.json solo trae lo que cambia: { "roles": { "vidente": { "nombre": "Seer", "guia": { … } } } }.
export function mezclarRoles(base, traducidos) {
  const roles = structuredClone(base.roles ?? base);
  for (const [id, textos] of Object.entries(traducidos?.roles ?? {})) {
    if (!roles[id]) continue;
    roles[id] = { ...roles[id], ...textos, guia: { ...roles[id].guia, ...textos.guia } };
  }
  return base.roles ? { ...base, roles } : roles;
}
