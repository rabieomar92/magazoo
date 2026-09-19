# Magazoo animation assets

The user's flattened original remains unchanged at `public/magazoo-mark.png`.
The animated version uses two independently replaceable assets:

- `public/magazoo-letters.png`: transparent animal-free lettering, retaining the purple/cyan two-line design. Letter areas originally hidden behind animals were reconstructed, not recovered from editable artwork.
- `public/magazoo-animals.png`: transparent 1024 × 1536 sprite sheet; four gait frames per row, six rows (monkey, orange cat, panda, koala, squirrel, grey kitten). Monkey/cat frames are reused for the smaller characters. Bodies and walking poses were generated from the reference, not extracted original animation frames.

Created using the built-in image-generation tool, not the API/CLI fallback. Original generated outputs are retained outside the project. Alpha is preserved. CSS/SVG supplies the movement paths; the lettering remains stationary. Reduced-motion mode freezes both movement and gait animation. The initial pre-JavaScript splash shows the unchanged original as a static image.

## Prompt set / asset specification

Letter layer: edit the supplied Magazoo logo to remove every animal, reconstruct the lettering underneath, preserve the two-line letter case, proportions, arrangement, purple upper row and cyan lower row with purple dashed outline. Keep transparent background and letter holes. Do not add decoration or redesign the wordmark.

Animal layer: use the supplied logo as the character/style reference. Produce a 4-column × 6-row transparent sprite sheet, ideally 1024 × 1536. Four successive walking/running limb poses per animal, facing right and consistently registered in square cells. Rows: brown monkey, orange tabby, panda, koala, red-brown squirrel, grey tabby. Reconstruct full bodies; use cute outlined, softly shaded artwork. No text, grid, floor, shadows or backdrop.

Final transparency edit prompt (verbatim):

> Edit this sprite sheet ONLY to remove ALL background to TRUE TRANSPARENCY (alpha=0). No brown, grey, gradients, glows, shadows, backdrop, or checkerboard pixels anywhere outside the animals. Keep every animal opaque, including white fur. Preserve the exact same 1024x1536 canvas, 4 equal columns by 6 equal rows, positions, sizes, 24 poses, framing and colors. Do not redraw, shift or crop any animal. This must be a production transparent PNG sprite sheet composited over lettering, never an opaque background. Outside each silhouette must be fully transparent, clean edges. No other changes.
