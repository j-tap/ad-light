# Changelog

## [0.2.0] - 2026-11-14
- The Trench, the final level, is now a climb: from a warm vent on the trench floor up through solid cave walls and shelves, hand placed creatures, mollusk nests and currents, with a depth gauge instead of a counter
- The game has an ending: the climb opens into a glowing coral garden, as high as a blobfish can safely go
- The kraken chase is a real pursuit: the kraken creeps closer on its own, every hit or rammed rock lets it close in, and every dodged arm throws it back
- Kraken arm strikes are aimed at where the fish is heading, telegraphed with a closing ring, and come in pairs deeper into the tunnel
- The chase ends in a crack in the rock too narrow for the kraken, which slams into the rock face behind the fish
- The kraken is alive: swaying arms, breathing, a glowing eye and a dark throat instead of a see-through mouth
- SHIFT is now a full sneak: the light dims, and the fish swims slowly and silently, so both sight and sound hunters lose it
- Rock spikes in the kraken tunnel are solid and redrawn to match the rest of the art; the missing shadow texture is gone
- Mollusks on the first two levels are spread over the whole level again instead of being packed into its middle
- Level names on entry, a sparkle when a mollusk is eaten
- Fixed a crash when returning to the menu after the credits in development builds
- Levels narrower than the screen are centred, with rock filling the sides
- Cave wall artwork is painted only around the camera, which cuts the texture memory of the final level several times over

## [0.1.4] - 2026-08-19
- Fixed a freeze when a level soundtrack finished playing
- Fixed leftover timers and event listeners piling up when a level was replayed
- Fixed the level background not fitting the screen after a resize or fullscreen toggle
- Background layers no longer allocate a texture as wide as the level
- Diagonal swimming is no longer faster than straight swimming, touch steering follows the pointer exactly
- Fullscreen toggle on the F key
- Roughly 30% smaller bundle, fewer draw calls and timers

## [0.1.3] - 2025-04-10
- Updated Readme

## [0.1.3] - 2025-04-09
- Fixed Kraken spawn position
- Replaced wrong background on level 3
- Reduced mollusk spread on level 3

## [0.1.2] - 2025-04-09
- Fixed the appearance of shellfish behind the Kraken
- Kraken's speed has been increased slightly
- Changed the number of shellfish at levels 2 and 3
- Highlighting mollusks with animation
- Display version number
