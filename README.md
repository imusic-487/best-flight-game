# Skyline Valley — Ring Runner

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/imusic-487/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/imusic-487/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete 2D chase-view flight game that plays offline in a desktop browser
from its own files. Take off from the valley runway, thread a course of
glowing rings over fields, river and town, mind your fuel and the wind, and
bring her home for the landing score.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with
`node serve.ts` and open http://localhost:8080). No network, no build step.

- **↑ / ↓** — pitch (climb / descend)
- **← / →** — bank and turn
- **W / S** — throttle up / down
- **Mouse** — steer toward the pointer
- **Space** — airbrake
- **P** — pause · **M** — mute · **R** — restart the sortie

## Missions

1. **Ring Course** — thread all 10 rings down the valley before the clock
   runs out, then land on the runway.
2. **Mail Run** — carry the valley mail to the far airfield on tight fuel
   and land there.
3. **Precision Landing** — short hop, tight fuel; touch down on the numbers,
   soft and centred.

Fuel burns with throttle, wind gusts push you sideways, a stall drops the
nose, and a hard landing costs airframe. The HUD shows altitude, speed,
heading, vertical speed, a compass strip, an attitude indicator, throttle
and fuel — and a guidance arrow points at the next ring.

## Screenshots

`?shot=takeoff`, `?shot=rings`, `?shot=landing` and `?shot=end` stage
reproducible frames of the game for the screenshots in `screenshots/`.

## Files

- `game/src/` — the game's own source, one file per job: `config.js`,
  `input.js`, `flight.js`, `terrain.js`, `aircraft.js`, `hud.js`,
  `rings.js`, `missions.js`, `audio.js`, `shots.js`, `render.js`, `main.js`
- `main.ts` — the hand-in program (Node 22, stdlib only): copies `game/`
  and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `shots.json` — how each screenshot was staged

All art is drawn in code and all sound is synthesised with WebAudio — no
image, font or audio files, nothing copied from any commercial game.

## License

MIT — see `LICENSE`.
