import sharp from "sharp";
import { RENDERER_IDS } from "./types.js";

/**
 * Production foundation renderer: composites Shopify product cutouts onto the room.
 * Can be replaced later (e.g. GPU / diffusion) via getPlacementRenderer().
 */
export function createSharpCompositor() {
  return {
    id: RENDERER_IDS.SHARP_COMPOSITOR,

    /**
     * @param {{ roomImage: Buffer, layers: Array<object> }} input
     */
    async render(input) {
      const room = sharp(input.roomImage, { failOn: "none" });
      const meta = await room.metadata();
      const roomWidth = meta.width || 1024;
      const roomHeight = meta.height || 1024;

      const composites = [];

      for (const layer of input.layers || []) {
        if (!layer?.productImage) {
          continue;
        }

        const widthPx = Math.max(8, Math.round(layer.widthPx));
        const heightPx = Math.max(8, Math.round(layer.heightPx));
        const anchorX = Number.isFinite(layer.anchorX) ? layer.anchorX : 0.5;
        const anchorY = Number.isFinite(layer.anchorY) ? layer.anchorY : 0;
        const opacity = Number.isFinite(layer.opacity) ? layer.opacity : 1;

        let product = sharp(layer.productImage, { failOn: "none" }).ensureAlpha();

        // Soft key: lift near-white studio backgrounds toward transparent
        // so fixtures blend on the ceiling instead of showing white boxes.
        const { data, info } = await product
          .raw()
          .toBuffer({ resolveWithObject: true });

        const keyed = Buffer.from(data);
        for (let i = 0; i < keyed.length; i += info.channels) {
          const r = keyed[i];
          const g = keyed[i + 1];
          const b = keyed[i + 2];
          const a = info.channels > 3 ? keyed[i + 3] : 255;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          // Soft edge key: remove studio white and feather near-white fringes
          // so fixtures don't look pasted or floating.
          if (luminance > 245 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12) {
            keyed[i + 3] = 0;
          } else if (luminance > 238 && a > 0) {
            keyed[i + 3] = Math.min(a, 55);
          } else if (luminance > 228 && a > 0) {
            keyed[i + 3] = Math.min(a, Math.round(a * 0.72));
          }
        }

        let cutout = sharp(keyed, {
          raw: {
            width: info.width,
            height: info.height,
            channels: 4,
          },
        }).resize(widthPx, heightPx, {
          fit: "inside",
          withoutEnlargement: false,
        });

        if (opacity < 0.999) {
          cutout = cutout.ensureAlpha(opacity);
        }

        const resized = await cutout.png().toBuffer({ resolveWithObject: true });
        const drawW = resized.info.width;
        const drawH = resized.info.height;

        const markerX = (Number(layer.xPercent) / 100) * roomWidth;
        const markerY = (Number(layer.yPercent) / 100) * roomHeight;

        // Canopy stays exactly at the mount point; body hangs via taller bitmap
        let left = Math.round(markerX - drawW * anchorX);
        let top = Math.round(markerY - drawH * anchorY);

        // Keep mostly on-canvas while allowing slight overflow for realism
        left = Math.min(roomWidth - 4, Math.max(-drawW + 4, left));
        top = Math.min(roomHeight - 4, Math.max(-drawH + 4, top));

        // Soft contact shadow at canopy + subtle cast under hanging body
        if (layer.hangFromCeiling) {
          const canopyShadow = await sharp({
            create: {
              width: Math.max(8, Math.round(drawW * 0.32)),
              height: Math.max(4, Math.round(drawH * 0.035)),
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0.22 },
            },
          })
            .blur(4)
            .png()
            .toBuffer();

          composites.push({
            input: canopyShadow,
            left: Math.round(markerX - drawW * 0.16),
            top: Math.round(markerY + 1),
            blend: "over",
          });

          const bodyShadow = await sharp({
            create: {
              width: Math.max(10, Math.round(drawW * 0.72)),
              height: Math.max(5, Math.round(drawH * 0.09)),
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0.18 },
            },
          })
            .blur(6)
            .png()
            .toBuffer();

          composites.push({
            input: bodyShadow,
            left: Math.round(markerX - drawW * 0.36),
            top: Math.round(top + drawH * 0.9),
            blend: "over",
          });
        }

        composites.push({
          input: resized.data,
          left,
          top,
          blend: "over",
        });
      }

      const image = await sharp(input.roomImage, { failOn: "none" })
        .ensureAlpha()
        .composite(composites)
        .jpeg({ quality: 90 })
        .toBuffer();

      return {
        image,
        mimeType: "image/jpeg",
        engineId: RENDERER_IDS.SHARP_COMPOSITOR,
        meta: {
          roomWidth,
          roomHeight,
          layerCount: composites.length,
        },
      };
    },
  };
}
