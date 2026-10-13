# mosaicartmaker.com — how it works (reverse-engineered 2026-10-13)

## Stack
- Marketing + checkout: Shopify (`www.mosaicartmaker.com`). Product page receives `?art=<ArtID>`.
- Maker app: Expo / React Native Web SPA at `make.mosaicartmaker.com`. React 19. Single JS bundle.
- Image processing: **100% server-side** (`make.mosaicartmaker.com/api/*`, nginx). Client only crops and shows JPEGs returned by the server. No TF.js / ONNX / WASM / canvas quantization in the browser.

## Flow
1. Pick size (26x26cm = 60x60 studs = 3600 pcs, 4mm bricks; up to 74x50 = 21600).
2. Upload photo -> `POST /api/uploadSrc` (client first resizes to max 600px wide via expo-image-manipulator). Returns `img` UUID.
3. `GET /api/preview_config?img&pixels=60` -> `{ facesBox:[x1,y1,x2,y2], defaultCropBox, preCropList:[4 suggested crops] }` -> **face detection on server** drives suggested crops.
4. Crop UI (react-easy-crop). Each crop thumbnail = `POST /api/preview_make?img&pixels&cropBox` -> JPEG of mosaic preview.
5. `GET /api/uploadCrop?x&y&width&height` saves crop. `GET /api/cfg_load` returns full config (see below).
6. Style tab: 4 palettes (Rich=full, Mild, Soft, B&W) x 8 presets. Presets are just brightness/contrast pairs (`tpl_listnew`), e.g. Rich_4 = brightness 0.9 / contrast 1.4. Toggle "AI face color correction" (`faceCorrect`).
7. Tune tab: sliders AI Beautify (0..N, `beautyData.beautyIndex`), Brightness, Contrast, Saturation.
8. Edit tab: pixel editor. Palette = the N colours actually used in this mosaic. Click colour then click brick. Undo/redo. Server re-renders via `edit_img` with `repBricks` / `replacedColors` / `excludedColors`.
9. Next -> Shopify product page with Art ID -> Add to cart. Brick counts and build guide live in "My Works" / "Smart Building App" after purchase (4 modes: standard, fast, number, printable PDF).

## Core render call
`POST /api/edit_img?img&cfg=1&bsize=m&frame=d` multipart body:
```
pixels=60  palette=full  contrast=1.4  brightness=0.9  saturation=1
mapWidth=60  mapHeight=60  maxColors=20
cropData={"x":81,"y":142,"width":394,"height":394}
beautyData={"beautyIndex":2}  faceCorrect=true  fsharpen=0
excludedColors=[]  replacedColors=[]  repBricks=[]
```
Returns JPEG. `cfg_load` returns the brick BOM:
```
bricks:[{color:"262223",count:981,lum:5.9,num:1,order:1}, ...]   // 20 entries, sum = 3600
maxColors:20  bricktype:"4mm"  palette:"full"
```
So: fixed physical palette, quantize with a cap of `maxColors` (20 of their full set), count per colour, assign cup numbers by count (`num`) and sort by luminance (`order`).

## What "AI" actually is
- Face detection (bounding box) -> auto-crop suggestions + face-region colour correction.
- "AI Beautify" = integer level 0..N; almost certainly classical skin smoothing / tone mapping, not generative.
- Everything else = brightness/contrast/saturation + nearest-colour quantization to a fixed palette, plus a colour-count cap.

## Mapping to client PoC
| Client asks | Reference does | PoC plan |
|---|---|---|
| 24x24 grid, 576 bricks | 60x60 / 3600 | same pipeline, `mapWidth=mapHeight=24` |
| only 40 approved colours | fixed "full" palette, cap 20 | 40-colour palette from xlsx, nearest in CIELAB, optional cap |
| accurate counts | `bricks[].count` | count per cell after quantize; sum must = 576 |
| recognizable faces | face detect + face correction + presets | face-aware auto crop, contrast/brightness presets, dithering off (dither kills faces at 24px) |
| edit preview updates counts | pixel editor, server re-render | client-side grid editor, counts recomputed on click |

Palette (40 colours, code / name / hex) is in `PhotoBricks 40 Colors Easy Codes.xlsx`, column E.

## Family sample run (2026-10-13)
- `preview_config` returned `facesBox:[55,107,480,507]` on the 600px-wide upload: one box around all 4 faces; suggested crop `[13,85,510,510]`.
- BOM: 20 colours, 3600 bricks, black 1262 (35%), cream `ddd5be` 377, light blue `b7cec6` 216.
- Their 1200x1504 "processed source" is the mosaic itself rendered with stud texture: no beautified photo exists, so no face-restoration / generative model.
- Fitting our pipeline to their 60x60 output (luminance error, grid-aligned): baseline 7.9 -> 5.3 with white point 220, gamma 1.2, contrast 1.4, face-box x1.3. Face lift was the single most consistent win, so "AI face color correction" = brighten inside the detected face box.
- Images: `compare_family.png`, `compare_family_tuned.png`.

## Route 1 result (2026-10-13, later)
- Sampling their rendered mosaic at cell centres hits the stud highlight and corrupts the reference grid (772 Black bricks read as Charcoal). Block-mean sampling between studs fixes it. All earlier fits were against the corrupted grid.
- With the clean grid, their pipeline is PIL: resize to 600 wide (Lanczos) -> crop -> Lanczos to 60 -> Sharpness(2.0) -> Brightness(1.05) -> Contrast(1.4) -> RGB nearest, no dither, 20-colour cap. 76.7% identical bricks (family), 72.9% (portrait). Face lift, blur, Lab metric and dither all reduce the match.
- Browser canvas resampling costs ~12 points; a byte-exact Lanczos port recovers it. In-app parity: 74.5%.
- Crop sensitivity: 1px shift costs ~3 points, 2px ~12. For the samples we start from their exact crop box.

## Residual investigation (route 1, part 2)
- Captured the exact 600px JPEG their client uploads (from the multipart body). Running our pipeline on THEIR source scores 76.5%, same as on ours: the input side is identical, the residual is their server step.
- Tested on their source: 2x render + downsample, bilinear/bicubic, weighted-RGB / redmean / Lab / luminance metrics, JPEG quality, face blur / median / brightness / contrast, pre-sharpen. All within +-0.3% of 76.5%.
- Toggled their "AI face color correction" OFF: re-render differs from ON on 11% of bricks, spread evenly over the image, mostly Tan->Brown, Dark Green->Charcoal, Pale Blue->Cream. It is not a face-region operation; it changes which bricks get picked. Our model scores 77% against both ON and OFF.
- Third image (family crop 0,0,600,600): 76.9%. The ~77% ceiling is consistent across three images.
- New brick observed: #B6618B (Orchid). Observed palette now 24 of ~44.
- Conclusion: their final matching step is not a nearest-colour rule in any colour space tried. Remaining mismatches are near-tie pixels (median RGB margin 8.7) between adjacent skin tones. Beyond this needs their code.

## API map from the live bundle (2026-10-13, re-checked)
Bundle: `make.mosaicartmaker.com/_expo/static/js/web/index-*.js`. Base `window.location.origin + '/api/'`. Every call sends headers `uid` + `apikey` from `GET /api/app_init?uid=&scid=` (anonymous session, returned on first load). Object params go as `h_<name>` headers (JSON-stringified). `_t` cache-buster on image calls.

| Helper | Endpoint | Params |
|---|---|---|
| getAppInit | `app_init` | uid, scid |
| getUploadSrc | `uploadSrc` (POST multipart) | artsize, file (`filename.jpeg`, client-resized: shorter side 600, JPEG q=1) |
| getPreviewConfig | `preview_config` | img, pixels |
| getPreviewMake | `preview_make` | img, pixels, cropBox |
| getPreviewImg | `preview_img` | img |
| getUploadCrop | `uploadCrop` | img, pixels, x,y,width,height |
| getConfig | `cfg_load` | img, art, instUse |
| getTplList | `tpl_listnew` | img (works with empty img) |
| getEditImg | `edit_img` (POST) | img, cfg=1, bsize=m/l/s/p, frame, saveData + style params |
| getEditSrcImg | `edit_src_img` | img + params |
| getEditData / getEditSave / getEditCancel | `edit_data` / `edit_save` / `edit_cancel` | img, cfg |
| getBeautyIndex / getBeautyImg / getBeautyOrgImg | `beauty_index` / `beauty_img` / `beauty_orgimg` | img, bindex, bsize, saveCfg |
| getRemoveBackground | `img_rembg` | img, mode |
| getBrickList | `brick_list` | img, sub, art (404 without a real img) |
| getBrickView | `brick` | c=<hex>, bsize → PNG of one stud (any hex accepted, not a palette lookup) |
| getBuildMap | `build_map` | img, art, instUse |
| getProdArtImg | `art_img` | img, imgInd |
| getImgInfo | `img_info` | img, sub |
| getLibList / getLibView / getLibRemove | `lib_list` / `lib_view` / `lib_remove` | sub / img |
| getImgUpload / getImgConv / getImgCreateRelate | `upload` / `img_conv` / `img_createRelate` | admin "Enhancer" path |
| userLogin / userLogout, tag_*, review_*, admin_artList, admin_lock, cloud_api | admin / misc | |

`GDefines`: `BRICKTYPE_4mm`, `PLATE_PIXELS_4mm: 20`, `SUB_PLATE_PIXELS_4mm: 60`, `PLATE_PIXELS_8mm: 16`. Products: C001 60 px 3600, C002 120 px 14000 (not 14400), C004 120×60 7200, C005 60×120 7200, C003 180×120 21600.

`tpl_listnew` (no image needed): 4 palettes `full | mild | soft | BW` × 8 presets `<Palette>_0..7`, each `{brightness, contrast, saturation:1, fsdetail:0}`: (0.7,1.8) (0.75,1.7) (0.8,1.6) (0.85,1.5) (0.9,1.4) (0.95,1.3) (1.0,1.2) (1.1,1.1). Top-level default (1.3,1.3). Note their `brightness 0.9` corresponds to our fitted PIL `Brightness(1.05)`: their brightness is not raw PIL factor.

No colour table in the bundle (no hex strings for the known bricks). Full physical palette only via `brick_list` / `cfg_load` on an uploaded image.

## Live probe with an uploaded sample (2026-10-13, family.webp)
- Session: cookies `uid` / `apikey` (set by the app after `app_init`). A fresh `app_init` gives a different uid whose storage dir does not hold the upload → `preview_config` answers `preSrcFile not exists`. Always reuse the app's cookies.
- `preview_config` on the 600×752 upload: `facesBox [55,107,480,507]`, `defaultCropBox [0,76,600,676]`, `preCropList` = 4 boxes as [x1,y1,x2,y2]. Identical to the earlier capture.
- `edit_img` returns 500 until `uploadCrop?img&pixels&x&y&width&height` has been called once. `uploadCrop` also writes the site defaults into the config: `brightness 0.9, contrast 1.4, beautyIndex 2, faceCorrect true, maxColors 20, palette full`.
- `cfg_load` exposes server-only knobs the client never sends: `cmatch: "default"` (colour-matching mode), `sharpness: 1`, `channel_r/g/b: 1`, `coreColors`, `pltrep`, `minBricks`, `bricksLimit`, `rate {brightness -33, contrast 20}` (auto-analysis of the crop). `cmatch` is the likely home of the unexplained matching step.
- `maxColors` is clamped to 20 server-side (100 → 20).
- `edit_img` with `saveData=true` persists the posted params into the config; `saveData=false` renders only.
- **`POST edit_data?img&cfg=1` returns the full palette**: `allColors` = 44 bricks, `paletteColors` / `generatedColors` = the ≤20 used with `count`, `lum`, `num` (cup number by count), `order` (1-based index into `allColors`). `palette = full | mild | soft | BW` all return the same 44 `allColors`; the palette name only changes the quantization. Saved to `src/data/palette-mam.json` as M01–M44 in their order.
- `edit_img&bsize=p` returns a 60×60 JPEG with one pixel per brick. Chroma subsampling corrupts single-pixel colours (snap error up to 70 RGB units, 22 distinct colours where the BOM has 20), so it is not an exact grid. Counts are exact from `edit_data` instead: `docs/mam_family_counts.json`.

## Exact brick grid extraction (2026-10-13)
`replacedColors = [[fromHex, toHex], ...]` (post-quantization remap), `excludedColors = [hex, ...]`, `repBricks = [{row, col, color}]` (1-based).
Trick: for each of the ≤20 bricks in the BOM, render `edit_img&bsize=s&frame=` (180×180, 3 px per brick) with that colour remapped to `ebc728` and every other BOM colour to `3c2164`, then classify each cell centre by luma. 20 renders → full 60×60 grid; every per-colour count equals `edit_data.generatedColors` and no cell is claimed twice. Shaded stud renders could not do this (Skin Mid `d3a77a` and Skin Light `d4b390` render to the same colour), the remap sidesteps it.
Family sample (crop 13,85,510,510) and portrait sample (crop 81,142,394,394; upload 600×869, facesBox [133,149,424,477]) at their defaults (brightness 0.9 · contrast 1.4 · beauty 2 · faceCorrect on · 20 colours): `src/data/mam-grid-family.json`, `src/data/mam-grid-single.json` (indices into `palette-mam.json`). `public/reference/family.jpg` replaced by the same render (`bsize=m&frame=d`), so the app's compare view and its grid are the same run.
App: with the Mosaic Art Maker palette, their 60×60 size and their crop selected, the sample uses this grid verbatim; any other crop/size falls back to the engine.

## Their stud look, reproduced (2026-10-13)
Their render is not flat hex: each brick is a shaded stud tile. From the saved `bsize=m&frame=d` render (636 px; mosaic occupies rows/cols 27–607, 581 px = 9.68 px per brick) and the exact grid, every brick's 10×10 tile was sampled bilinearly and a per-tile-pixel linear model `pixel = a · brickHex + b` fitted across the 20 bricks present (weighted by count). Mean reconstruction error vs their render: 4.9/255 per pixel, i.e. JPEG noise. Model in `src/data/mam-stud.json`; `MosaicCanvas` uses it whenever the active palette has `display` colours (Mosaic Art Maker), rendering at 10 px per brick and scaling. `public/reference/family.jpg` is now the inner 581 px of their render (frame removed) so both sides of the compare are the same mosaic at the same size.
Note: their server deletes the uploaded source after a while (`preSrcFile not exists`); re-upload before pulling more renders.
