# 🐺 Villagers vs Wolves

[![CI](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/ci.yml/badge.svg)](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/codeql.yml/badge.svg)](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/codeql.yml)

> 🌐 **Español:** [README.md](README.md) · This is the English version of the README. The app itself is available in Spanish and English.

**An automatic narrator for hidden-role games** (the “find the impostor” kind): a **tablet in the middle of the table** tells the story, keeps time and applies the rules, and **each player uses their phone** to see their secret card and act in silence.

Nobody has to be the narrator, so **everybody plays**. There is nothing to install: it runs in the browser, on Android and iPhone.

> A **free, open and non-profit** project under the [MIT](LICENSE) license. It is not affiliated with any game publisher and includes no material from any. Read the [legal notice](AVISO_LEGAL.md) (in Spanish).

**▶ Try it:** <https://kenny28-176.github.io/aldeanos-vs-lobos/public/en/index.html> (read [Server and limits](#server-and-limits) first).

---

## Contents

- [The game in one minute](#the-game-in-one-minute)
- [What you need](#what-you-need)
- [How a game works](#how-a-game-works)
- [Languages, accessibility and offline use](#languages-accessibility-and-offline-use)
- [Roles](#roles)
- [Server and limits](#server-and-limits)
- [Set up your own copy](#set-up-your-own-copy)
- [Development](#development)
- [FAQ](#faq)
- [Status and roadmap](#status-and-roadmap)
- [Contributing](#contributing)
- [License, credits and legal notice](#license-credits-and-legal-notice)

---

## The game in one minute

Villagers live in the village… but hidden among them are some **wolves** in disguise. The wolves know who they are; the villagers don't.

- **At night**, everyone closes their eyes. The wolves secretly choose a victim, and other roles use their powers (investigate, protect, heal, poison…).
- **During the day**, the village finds out who has fallen, debates out loud and **votes on who to eliminate**.
- The **villagers** win if they eliminate all the wolves; the **wolves** win if they finish off the villagers. There are also roles with goals of their own (lovers, a piper, an angel…).

Lying, bluffing and distrusting are part of the game. Showing your screen is not.

## What you need

| | |
|---|---|
| 🌕 **A tablet or laptop** | In the middle of the table. It is the narrator: it talks and keeps track of the time and the rules. Best with Chrome and the volume up. |
| 📱 **One phone per player** | Android or iPhone, with any modern browser. That is where you see your card and take your actions. |
| 📶 **Internet** | On every device (wifi or mobile data). If the wifi fails, tethering from a phone works. |
| 👥 **3 to 42 players** | It works very well with 4 to 20. For a first game, 6–10 with the “Easy” deck. |

No physical cards are needed: the app deals a secret card at random to every player.

## How a game works

1. **Tablet:** open the website, tap **I'm the narrator** and **Create a new room**. A 4-letter code and a QR code appear.
2. **Phones:** each player scans the QR code (or opens the website, taps **I'm a player** and types the code) and enters their name.
3. **Tablet — the deck:** tap **✨ Suggest a deck** and the app proposes a balanced one for the number of players (levels *Easy*, *Balanced*, *Advanced* or *Random*), or build your own card by card. Check the timings.
4. **Start the game.** Each phone gets a **secret random card**: tap it to see it (nobody else should look), read what you have to do and tap **Ready**.
5. **Night:** the tablet announces that night falls and calls the roles one by one. When it is your turn, your phone lights up; otherwise you see a dark “Night…” screen (act just as seriously whether you are awake or not: nobody should be able to work out who is acting).
6. **Day:** the tablet says who has died (and reveals their card), there is a debate and the vote happens on the phones. The votes are revealed all at once. And night comes again, until one side wins.

Details that help the game flow:

- **✓ Ready** on every action: as soon as everyone who is acting taps it, the step ends without waiting for the clock. During the debate, if 75% of the living players tap **Move on to the vote**, the vote starts. In the vote you can **abstain**.
- **See my card** (on the phone) shows your card, your guide and what you secretly know; it hides again with one tap. **📖** shows the cards in the deck.
- **⚙** on the tablet: pause, add 30 s, skip a step, undo, repeat the last sentence, choose the voice, the sound, the language and the display (large text, high contrast…).
- **Phones never ring or vibrate at night** (it would give away who is awake).
- If the tablet reloads or runs out of battery, the game **carries on where it was** (the state is saved on the server).
- **Rehearsal mode:** in the room, **🤖 Add a bot** creates fake players that decide on their own, to try the flow without people.

The guide for people who have never played is in the app itself: [`public/en/como-jugar.html`](public/en/como-jugar.html).

## Languages, accessibility and offline use

- **Languages:** Spanish and English. The tablet chooses the language (selector on the start screen and in ⚙, or `?lang=en` in the link) and the phones follow it automatically; the narrator's voice changes with it. Adding another language is just a few text files: see [`CONTRIBUTING.md`](CONTRIBUTING.md#traducciones) (in Spanish).
- **Accessibility:** in ⚙ (tablet) and on the phone you can choose the **text size** (normal, large, extra large), **high contrast** and **less motion**; the app also respects what your system asks for. Buttons, notices and timers are labelled for screen readers and can be used with the keyboard.
- **History and statistics:** the tablet remembers the finished games (who played, with which role and who won) under **📜 History**, with counts, average length and most frequent roles. It is stored only in that browser; it can be exported (JSON) and deleted.
- **Offline use:** the website is saved on the device (service worker): it opens faster and survives network outages, and if the server does not answer, a notice explains it instead of leaving a blank screen. **Playing** still needs a connection to the server.

## Roles

Each game uses only the cards the host picks. There are **28 playable roles**:

| Side | Roles |
|---|---|
| 🐺 **Wolves** | The Werewolf · The Dire Wolf (attacks twice) · The Corruptor (converts a victim) |
| 🏘️ **Village** | The Villager · The Villager of Truth (public card) · The Seer · The Alchemist · The Hunter · The Archer · The Quiet Spy · The Guardian · The Elder · The Scapegoat · The Village Fool · The Whispers · The Brotherhood · The Fox · The Beast Tamer · The Judge · The Knight of Swords |
| 🎭 **Ambiguous** (can switch sides) | The Handmaiden · The Jester & Actor · The Wild Child · The Dual Nature |
| 🌙 **Loners** (own goal) | The Shadow Piper · The Divine Angel · The Cultist · The Moon Wolf |
| 🏚️ **Village mode** (in preparation) | The Fire-Bringer and The Raven's Omen, in a simplified version: they need the buildings of the Village mode, which does not exist yet |

What each one does is summarised in the guide that players see on their phone ([`src/data/roles.en.json`](src/data/roles.en.json)); the names and subtitles of the cards are in the [glossary](docs/DISENO.md#los-roles-y-sus-nombres) and the rule decisions in [`docs/DISENO.md`](docs/DISENO.md) (both in Spanish).

## Server and limits

To sync the tablet with the phones in real time, the game uses a small **Firebase Realtime Database** (Google). It only stores nicknames, cards and the state of the game, and it is deleted when the room is discarded. More details in the [legal and privacy notice](AVISO_LEGAL.md#5-privacidad) (in Spanish) and on the website's “About” page.

The **public instance** behind the link above runs on its author's free project:

- It is meant for **groups of friends** and is “best effort”: it may be paused if the free quota runs out or is abused, and it comes with no guarantees.
- If you use it a lot, or you want it never to depend on anyone else, **set up your own copy** (below): it is free, asks for no card and takes about 10–15 minutes.

## Set up your own copy

You can have your own version, with your own free server, without depending on anybody:

1. **Fork** this repository.
2. Create a free **Firebase project** (Spark plan, no card) with a **Realtime Database**.
3. Paste your configuration into [`src/net/firebaseConfig.js`](src/net/firebaseConfig.js) and publish the rules from [`database.rules.json`](database.rules.json).
4. Turn on **GitHub Pages** in your fork.
5. (Recommended) Restrict the API key to your domain.

The full guide, with screenshots of the menus and what to do if something fails, is in **[`docs/ALOJAR_TU_COPIA.md`](docs/ALOJAR_TU_COPIA.md)** (in Spanish).

## Development

There is no build step: native ES modules and [Preact](https://preactjs.com/) + [htm](https://github.com/developit/htm). You need **Node.js 22 or later** (for the tests and the local server; the browser used by the end-to-end tests is Chrome).

```bash
git clone https://github.com/Kenny28-176/aldeanos-vs-lobos.git
cd aldeanos-vs-lobos

npm test                      # engine tests (hundreds of simulated games included)
node tests/simulate.js 7 12   # one simulated, narrated game (seed 7, 12 players)
npm run serve                 # local server at http://localhost:8080/public/
npm run e2e:emulador          # security rules + full games in Chrome against the Firebase EMULATOR
node tools/e2e.js             # a full game in Chrome with 1 tablet + 6 phones (with the server running)
node tools/e2e-ensayo.js      # the same with 6 bots and 2 humans on autopilot
IDIOMA=en node tools/e2e-ensayo.js   # that game in English (fails if anything in Spanish is left on screen)
npm run sitio                 # checks the website and builds it into _sitio/, just as GitHub Pages publishes it
npm run vendor                # updates the libraries copied into public/vendor/
npm run revisar:imagenes      # checks the images: real format, 512 px at most and credits (it blocks the release)
```

`npm run e2e:emulador` does not touch any real database (it needs Java 21 or later). The stand-alone `tools/e2e*.js` scripts use **your** Firebase by default (the one in `src/net/firebaseConfig.js`) and delete the room when they finish; with `EMULADOR=127.0.0.1:9000` (and the emulator running: `npm run emulador`) they use the emulator. If your Chrome is not in the usual Windows path, say where it is with `CHROME=/path/to/chrome`; to test your already published website, use `BASE=https://YOUR-USER.github.io/YOUR-REPO/public/ node tools/e2e.js`.

### Continuous integration, publishing and versions

- Every push and pull request runs, on **GitHub Actions**, the engine tests, the website check (no external dependencies, every file exists) and full games against the Firebase emulator.
- What reaches `main` and passes the tests is **published automatically to GitHub Pages**, with the version stamped in `version.json`.
- The changes of each version are recorded in [`CHANGELOG.md`](CHANGELOG.md) (in Spanish). Pushing a tag (`v0.2.0`) makes an Action create the GitHub release with those notes.

### Structure

```
src/engine/   The engine: pure rules, no network or screen. step(state, action) → { state, events, error }
src/net/      Firebase and the tablet controller (the tablet is the authority; phones never compute rules)
src/ui/       Screens: narrator.js (tablet), player.js (phone), scene, effects, audio, voice, display settings
src/i18n/     Interface and engine texts in each language (es.json, en.json) and the functions that translate them
src/data/     Roles, night call order and narrator lines (data, not code; one version per language)
public/       The pages (home, narrator, player, how to play, about; the English ones in public/en/), images and vendor/
tests/        Tests for the engine, the dealing, the deck assistant, languages, the website and the game simulator
tools/        Local server, Chrome remote control (cdp.js), end-to-end tests and website tools
docs/         Design decisions and the guide to hosting your own copy
.github/      Continuous integration, Pages publishing, issue and pull request templates
```

### Ideas for understanding the code

- The **game state is plain JSON** and the engine is a pure function with a seeded random generator: any game can be reproduced and tested without a network.
- The **tablet** reads the phones' actions, resolves the rules and writes what each player should see (`views/{id}`) and what is public (`public`). Each phone only listens to its own view.
- **Roles live in data** (`src/data/roles.json`) and their night/day steps in `src/engine/steps.js`. To **add a role**: define its card and guide in `roles.json`, its step in `steps.js` (and its place in `nightOrder.json` if it acts at night), add its lines to the narration and the dictionaries, and write its tests in `tests/`.
- Chain deaths (lovers, Hunter, Sheriff, Elder…) always go through [`src/engine/deaths.js`](src/engine/deaths.js).
- Ambiguous rules and the criteria chosen are in [`docs/DISENO.md`](docs/DISENO.md) (in Spanish): if you change one, change its test too.
- **Texts are not in the code.** Spanish is the base language; every engine and interface text has a key in `src/i18n/es.json` and `src/i18n/en.json`, and a test checks that a full English game leaves no keys or Spanish words on any screen.

## FAQ

**Do I need a physical card game?** No. The app deals the cards and shows them on each phone.

**What if someone has no phone?** Every player needs one (the host plays with theirs too). A phone can be lent without a problem, but not shared between two players at the same time.

**Can people cheat by looking at someone else's phone?** Of course you can peek over a shoulder, just as with real cards: that is why there is a button to hide your card. The project is made for playing with friends and is not hardened against someone opening the browser's developer tools.

**Does it work offline?** To play you need a connection to the server (even a hotspot shared from a phone). The website itself is saved on the device: it opens faster and survives brief outages, and if the server does not answer the app says so. A server-less version is one of the pending ideas.

**What happens if the tablet goes down?** When you reopen the website and enter the same room, the game carries on where it was.

**Can I change the narrator's voice?** Yes: the tablet uses the voices for the game's language that the device has installed, and in ⚙ you can choose the voice, speed and pitch. Effects and music can also be turned down or off.

**Which languages is it in?** Spanish and English. The language of the room is the tablet's and the phones follow it; the narrator's voice uses the voices the device has for that language.

## Status and roadmap

✅ **Done**
- A full game with the **28 playable roles**, chain deaths, victories for every side, and thousands of simulated games in the tests.
- Automatic card dealing, a deck assistant, rehearsal mode with bots, fast pace with “Ready” and a shortened debate.
- Voice narration, music and effects generated by code, an animated night and day scene, reveals with a card that flips over.
- Works on Android and iPhone (nothing to install), with the screen always on.
- **New illustrations and names** for every role (Tarot style, light enough for phones: about 2.5 MB in total; see [`public/img/CREDITOS.md`](public/img/CREDITOS.md)).
- **Spanish and English**, accessibility (large text, high contrast, less motion), game history and partial offline use (the website is saved on the device).
- Continuous integration, automatic publishing, strict security rules and every library inside the repository (the website loads nothing from third parties).

🚧 **In progress**
- **Village mode** (buildings, with The Fire-Bringer and The Raven's Omen in full).

💡 **Ideas**
- A server-less mode (direct connection between devices), to play without internet.
- More languages (each one is just a few text files) and reviewing the existing ones with native speakers.
- More accessibility: screen readers throughout the game and colour-blind palettes.

The “In progress” and “Ideas” items have their own issue on GitHub, in case you want to help: [issues labelled *help wanted*](https://github.com/Kenny28-176/aldeanos-vs-lobos/labels/help%20wanted).

## Contributing

Help is welcome! Open an **issue** to suggest ideas or report a bug, or a **pull request** if you already have the change. Before sending it, run `npm test`.

- Whoever looks after the project has a checklist in [`docs/MANTENIMIENTO.md`](docs/MANTENIMIENTO.md) (in Spanish).
- Contribute only **your own material or material with a compatible license** (MIT, CC0, CC-BY…). **Do not copy** texts, images or trade names from third-party games.
- Spanish is the base language and English a translation: if you change a text, change its translation too (the tests tell you what is missing). New narration lines must be written in your own words.
- Especially useful: tests for ambiguous rules, reviewing the translations, and hosting your own copy to tell us what could be explained better.

## License, credits and legal notice

- **Code and game texts:** [MIT](LICENSE) license.
- **Illustrations:** see [`public/img/CREDITOS.md`](public/img/CREDITOS.md) (author, license and date of each group of images).
- **Libraries:** Preact (MIT), htm (Apache-2.0), Firebase JS SDK (Apache-2.0), qrcode-generator (MIT). Cinzel and IM Fell English typefaces (SIL OFL). Everything is copied into [`public/vendor/`](public/vendor/) with its licenses, so the website depends on no CDN.
- It is an **independent, non-profit project with no affiliation** with any publisher or trademark holder of commercial games. If you think some content infringes your rights, open an [issue](https://github.com/Kenny28-176/aldeanos-vs-lobos/issues) and we will review it as quickly as possible.

All the detail (licenses, privacy, takedown of content) is in [`AVISO_LEGAL.md`](AVISO_LEGAL.md) (in Spanish).
