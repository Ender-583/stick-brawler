# Stick Brawler

Fan-inspired original local 2-player arena brawler.
A fan-inspired original local two-player arena brawler. Tiny stick fighters, chaotic ragdoll physics, flying weapons, last one standing.

This is an original game. It is inspired by the idea of physics stick-figure brawlers (including Stick Fight: The Game) but is not affiliated with, endorsed by, or connected to Landfall Games. It does not use Landfall branding, official names as the product title, sprites, audio, maps, or any ripped assets. All art is procedural canvas drawing. All sound is generated at runtime with the Web Audio API.

Intended later hosting: github.com/Ender-583/stick-brawler

## How to run

Need Node.js 18 or newer. From this folder, install packages, then start the Vite dev server with the dev script. Open the URL Vite prints, usually localhost port 5173.

Production: run the build script, then the preview script.

Play in a desktop browser. Two players share one keyboard.

## Controls

Player 1 Ember (orange)
- W A S D move / jump
- F punch, pick up a weapon, fire, or swing
- S plus F throw the held weapon

Player 2 Tide (teal)
- Arrow keys move / jump
- L or Enter punch, pick up, fire, or swing
- Down plus action throw the held weapon

Global
- Esc or P pause
- M mute
- R or Space rematch after a round

On-screen control hints sit at the bottom of the canvas.

## How a round works

1. Three-two-one countdown, then fight.
2. Weapons rain in with sparkles. Walk over one and press action to grab it.
3. Last fighter still on the arena wins. Falling off the map or losing all health ragdolls you out.
4. Scores persist. Press rematch to go again.

## Weapons

- Fists: default melee. Punch with hitstop and knockback.
- Pistol: single shots, modest recoil.
- Scattergun: pellet spread, huge recoil. Airborne shots can launch you.
- Buzzgun: fast SMG, light recoil, burns ammo.
- Bat: heavy melee swing.
- Boom Tube: rocket. Explosions ragdoll anyone in the blast.
- Glove Cannon: silly boxing-glove launcher with meaty knockback.
- Banana: thrown fruit. Hits spawn a peel that makes fighters slip.

Guns have recoil and knockback. Explosions flop the articulated ragdolls (head, torso, arms, legs).

## Tech

- Vite plus TypeScript
- Matter.js physics
- Canvas 2D rendering
- Procedural Web Audio SFX
- No backend, no online multiplayer in v1

## Project layout

- src/main.ts: game loop, canvas resize
- src/game.ts: rounds, collisions, weapons, HUD
- src/fighter.ts: ragdoll construction and control
- src/weapons.ts: definitions, projectiles, icons
- src/physics.ts: Matter engine setup and stepping
- src/arena.ts: geometric platforms
- src/camera.ts: framing and screen shake
- src/effects.ts: sparks, ink, muzzle flashes, hitstop
- src/audio.ts: generated beeps and noise
- src/input.ts: keyboard
- src/config.ts: tunables
- src/types.ts: shared types

## Known v1 limits

- Local only (one keyboard, two players). No online play.
- One handmade arena.
- Ragdolls can get a little tangled in corners.
- First sound may wait until a click unlocks AudioContext.

## Scripts

package.json defines "dev", "build", and "preview". Install packages first, then use the dev script to play.
