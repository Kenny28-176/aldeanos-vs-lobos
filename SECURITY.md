# Seguridad

## Cómo avisar de un fallo de seguridad

**No abras un issue público** con los detalles. Usa el aviso privado de GitHub:
[Informar de una vulnerabilidad](https://github.com/Kenny28-176/aldeanos-vs-lobos/security/advisories/new). Solo lo ve el equipo
mantenedor. Cuéntanos qué has encontrado, cómo reproducirlo y qué impacto tiene; responderemos lo antes posible.

## Qué es (y qué no es) un problema de seguridad aquí

El juego está pensado para **grupos de amigos**, así que algunas cosas son decisiones de diseño, no fallos:

- La `apiKey` de Firebase que ves en `src/net/firebaseConfig.js` **es pública por diseño** (identifica el proyecto, no
  es una contraseña). Lo que protege los datos son las **reglas** de la base de datos (`database.rules.json`) y las
  restricciones de la clave. Detalles en [`docs/ALOJAR_TU_COPIA.md`](docs/ALOJAR_TU_COPIA.md).
- Quien abre las herramientas de desarrollo del navegador puede ver los datos de la sala (incluidas las cartas de otros
  jugadores). El juego **no se blinda contra trampas técnicas** entre amigos; sí se evita que la interfaz muestre nada
  ajeno.

Sí nos interesan, por ejemplo:

- Una forma de escribir en la base de datos datos que las reglas deberían rechazar, o de saltarse su validación.
- Una forma de que un celular lea o haga lo que solo debería poder hacer la tablet.
- Código que cargue contenido de servidores externos o ejecute código ajeno (la web no debería depender de ninguno).
- Cualquier fuga de datos personales.

## Si alojas tu propia copia

Eres responsable de tu proyecto de Firebase: publica las reglas del repositorio, restringe la clave de API a tu dominio,
no cambies al plan de pago sin configurar alertas de presupuesto y revisa de vez en cuando el uso en la consola.
