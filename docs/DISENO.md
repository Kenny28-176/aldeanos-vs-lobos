# Decisiones de diseño del juego

Este documento recoge **cómo funciona el juego en esta app** (las reglas tal como las implementa el motor) y los
criterios que se eligieron cuando había varias opciones. Si cambias una de estas decisiones, cambia también sus
pruebas en `tests/`. La definición de cada rol vive en datos: `src/data/roles.json` (guías) y
`src/engine/steps.js` (qué pasa en cada paso).

## Una partida

1. **Sala:** el anfitrión crea la sala en la tablet, los jugadores entran con un código y un nombre, y el anfitrión
   monta el mazo (una carta por jugador, o más cartas que jugadores: se reparte un subconjunto al azar).
2. **Reparto:** al empezar, la app reparte una carta secreta a cada jugador. Hasta que todos pulsan «Listo» (o se
   acaba el tiempo) no empieza la primera noche.
3. **Noche → día → noche…** hasta que alguien cumple su objetivo.

## Los roles y sus nombres

Cada rol tiene un **id** (el que usa el código y los datos; no cambia) y un nombre y un subtítulo en cada idioma (los de la carta). Esta tabla sale de `src/data/roles.json` y `roles.en.json` (`node tools/glosario-roles.js --escribir` la actualiza y una prueba vigila que no se quede anticuada).

<!-- roles:inicio -->
| Id | Español | Subtítulo | English | Subtitle |
|---|---|---|---|---|
| `lobo` | Hombre Lobo | The Werewolf • Luna Feral | The Werewolf | The Feral Moon |
| `aldeano` | El Aldeano | The Villager • Raíces Profundas | The Villager | Simple Lives, Deep Roots |
| `lobo_feroz` | El Lobo Feroz | The Dire Wolf • El Devorador | The Dire Wolf | The Voracious Hunter |
| `infecto` | El Corruptor | The Corruptor • Portador de la Mácula | The Corruptor | The Tread of Taints |
| `aldeano_aldeano` | El Aldeano de la Verdad | The Villager of Truth • Inocencia Revelada | The Villager of Truth | Innocence Revealed |
| `vidente` | La Vidente | The Seer • El Ojo Místico | The Seer | The Mystic Eye |
| `cupido` | El Arquero del Amor | The Archer • Destinos Unidos | The Archer | The Cherub of L'Amour |
| `bruja` | La Alquimista | The Alchemist • Brebajes del Destino | The Alchemist | The Witch's Brew |
| `cazador` | El Cazador | The Hunter • Último Disparo | The Hunter | The Last Arrow |
| `nina` | La Espía Silenciosa | The Quiet Spy • Ojos en la Noche | The Quiet Spy | Eyes in the Dark |
| `protector` | El Guardián | The Guardian • Protección Divina | The Guardian | Divine Protection |
| `anciano` | El Anciano Sabio | The Elder • Resistencia Ancestral | The Elder | Ancient Resilience |
| `cabeza_turco` | El Chivo Expiatorio | The Scapegoat • La Culpa del Pueblo | The Scapegoat | Village Blame |
| `tonto` | El Inocente del Pueblo | The Village Fool • Indulto Sagrado | The Village Fool | Sacred Pardon |
| `dos_hermanas` | Los Susurros | The Whispers • Confidencias en la Sombra | The Whispers | Secrets in the Shadows |
| `tres_hermanos` | La Hermandad | The Brotherhood • Vínculo de Sangre | The Brotherhood | Blood Bond |
| `zorro` | El Zorro | The Fox • Rastro de Bestias | The Fox | Beast Scent |
| `domador` | La Domadora | The Strength • La Fuerza y la Bestia | The Beast Tamer | The Strength |
| `juez` | El Juez | The Judge • Balanza de la Justicia | The Judge | Scales of Justice |
| `caballero` | El Caballero de las Espadas | The Knight of Swords • Hoja Vengadora | The Knight of Swords | Avenging Blade |
| `sirvienta` | La Doncella Leal | The Handmaiden • Sacrificio Supremo | The Handmaiden | Ultimate Sacrifice |
| `comediante` | El Bufón de las Mil Caras | The Jester & Actor • El Arte del Disfraz | The Jester & Actor | Master of Disguise |
| `nino_salvaje` | El Niño Salvaje | The Wild Child • Corazón Feral | The Wild Child | Feral Heart |
| `perro_lobo` | La Doble Naturaleza | The Dual Nature • Sabueso o Fiera | The Dual Nature | The Wolf Within the Hound |
| `flautista` | El Flautista de las Sombras | The Shadow Piper • Hechizo Nocturno | The Shadow Piper | Nocturnal Spell |
| `angel` | El Ángel Celestial | The Divine Angel • Deseo de Ascensión | The Divine Angel | Ascension Desire |
| `sectario` | El Cultista | The Cultist • Ritual Oscuro | The Cultist | Occult Rites |
| `albino` | El Lobo Lunar | The Moon Wolf • El Depredador Pálido | The Moon Wolf | The Pale Predator |
| `piromano` | El Portador del Fuego | The Fire-Bringer • Purificación Ígnea | The Fire-Bringer | Flames of Purity |
| `cuervo` | El Heraldo del Cuervo | The Raven's Omen • Augurio de Muerte | The Raven's Omen | Harbinger of Fate |
<!-- roles:fin -->

## Noche

- Los pasos van en un orden fijo (`src/data/nightOrder.json`). Un paso solo existe si hay un jugador vivo actuando
  como ese rol.
- Quien no actúa ve una pantalla neutra «Noche…». De día, los celulares pueden vibrar; **de noche nunca suenan ni
  vibran** (delataría a quien está despierto).
- **Ritmo rápido** (por defecto): cada acción tiene un botón «Listo» y el paso termina cuando todos los que actúan
  lo pulsan (siempre pasan al menos 5 s). **Ritmo clásico:** los pasos nocturnos duran su tiempo completo.
- **Lobos:** eligen víctima por **unanimidad**; si no se ponen de acuerdo, nadie muere. Nunca pueden elegir a otro lobo.

### Resolución de la noche (`src/engine/resolveNight.js`)

1. Víctima de la manada: si el Corruptor la infecta, no muere (se vuelve lobo); si no, se aplican protección,
   curación y la segunda vida del Anciano Sabio antes de morir.
2. Víctima del Lobo Feroz: igual que la anterior (protección, curación, Anciano Sabio).
3. Víctima del Lobo Lunar: ni se protege ni se cura.
4. Veneno de la Alquimista.
5. Muerte diferida del Caballero de las Espadas (el lobo contagiado por su espada).

Las muertes de una misma resolución son **simultáneas**: por ejemplo, un Niño Salvaje que muere la misma noche que su
mentor no llega a convertirse en lobo.

## Día

1. **Amanecer:** se anuncian las muertes (sin decir cómo murieron de noche) y el oso de la Domadora gruñe si toca.
2. **Alguacil** (opcional, solo la primera mañana): se vota; su voto vale doble. Desempate al azar. Al morir designa
   sucesor (si no elige, al azar).
3. **Debate:** termina cuando se acaba el tiempo o cuando el **75 %** de los vivos pide pasar a votar.
4. **Votación:** se puede abstener. Los votos se revelan todos a la vez. **Empate = nadie es linchado** (salvo que
   esté el Chivo Expiatorio). Un enamorado nunca puede votar contra su pareja.
5. **Resultado:** al morir se **revela el rol** (celebración si era lobo, tristeza si era aldeano). Excepciones: los
   roles con `revelarAlMorir: false` (Niño Salvaje, La Doble Naturaleza) y la carta del linchado cuando la Doncella Leal ocupa su lugar.

Si el Juez lo pidió, hay una segunda votación inmediata sin debate (no si se indulta al Inocente del Pueblo).

## Muertes en cadena (`src/engine/deaths.js`)

Toda muerte pasa por un único sitio, que encadena sus consecuencias hasta que no quede ninguna pendiente: el otro
enamorado muere de pena, el Cazador dispara, el Alguacil designa sucesor, el Chivo Expiatorio elige quién vota, el
Anciano Sabio (si lo mata la aldea) deja a los aldeanos sin poderes, el Lobo Feroz pierde su segundo ataque cuando cae un
lobo (o un Niño Salvaje / la Doble Naturaleza), el Niño Salvaje se transforma si muere su mentor, y el Caballero de las Espadas contagia al lobo
más cercano a su izquierda. **La victoria se comprueba cuando no queda ninguna interrupción pendiente.**

## Victoria (`src/engine/victory.js`)

Prioridad si se cumplen varias a la vez: nadie vivo → Ángel Celestial → enamorados mixtos → Flautista de las Sombras → Lobo Lunar → Cultista →
aldea / lobos.

- **Aldea:** no queda ningún lobo (el Lobo Lunar y los infectados cuentan como lobos).
- **Lobos:** todos los vivos son lobos y no hay un Lobo Lunar vivo.
- **Enamorados mixtos** (uno lobo, otro no): quedan solo ellos dos.
- **Flautista de las Sombras:** todos los vivos (menos él) están hechizados.
- **Lobo Lunar:** es el único superviviente.
- **Cultista:** sigue vivo y ha caído todo el otro grupo.
- **Ángel Celestial:** lo linchan en la primera votación de la partida (que ocurre antes de la primera noche).
- **Nadie:** no queda nadie con vida.

## Idiomas (`src/i18n/`)

Las reglas no dependen del idioma: el motor decide qué ocurre y **qué texto mostrar** (una clave con sus datos), y el idioma solo cambia las palabras.

- Los textos del motor y de las pantallas están en diccionarios planos (`es.json` y `en.json`): `motor.*` para lo que sale del motor (vistas, errores, crónica) y `ui.*` para las pantallas. Admiten `{marcadores}` y plurales (`clave.uno` / `clave.otros`).
- El español es la **base**: si a un idioma le falta una clave, se usa la española (nunca se enseña la clave en pantalla). El nombre y la guía de cada rol (`roles.<idioma>.json`) y las frases del narrador (`narration.<idioma>.json`) siguen la misma idea.
- El idioma de la sala es el de la **tablet** y se publica en la vista pública (`public.idioma`): los celulares lo siguen, así que todos leen los mismos nombres de roles y frases. Si se cambia el idioma a media partida, la tablet vuelve a publicar las vistas ya traducidas (las vistas se calculan al publicar; solo la crónica ya escrita conserva el idioma en que se escribió).
- Una prueba (`tests/i18n.test.js`) juega cientos de partidas en inglés y comprueba que ninguna pantalla deja claves sueltas ni palabras en español.

## Criterios elegidos en los casos dudosos

- La curación de la Alquimista **no deshace** una infección. El Guardián **no protege** de la infección, del veneno, del
  Lobo Lunar, del hechizo ni de la Espía Silenciosa si la descubren.
- La Alquimista ve las víctimas de la manada y del Lobo Feroz y puede salvar a una.
- El Anciano Sabio aguanta el primer mordisco de los lobos (también el primer intento de infección).
- La Espía Silenciosa espía durante el turno de los lobos; el riesgo de que la descubran es configurable (20 % por
  defecto) y, si la descubren, muere en lugar de la víctima.
- El Inocente del Pueblo indultado pierde el voto y el cargo de Alguacil, y ese día no hay otra votación.
- Bufón de las Mil Caras: la app elige tres cartas con poder entre las que **no** están en el mazo (si no alcanzan, se repiten).
- Cultista: la aldea se divide al azar en dos grupos públicos («Sol» y «Luna»).
- Doncella Leal: tras cada linchamiento, antes de revelar la carta, puede ocupar el lugar del linchado (con sus poderes
  restaurados y como si fuese su primera noche). No hereda infección, enamoramiento, hechizo ni Alguacil.
- **El Portador del Fuego y el Heraldo del Cuervo** son una versión simplificada, sin edificios; la versión completa llegará con el modo Pueblo.
