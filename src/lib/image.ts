/** Load an image from a src / data URL into an HTMLImageElement (browser-only).
 *  Shared so the composite, photo-check, and warp paths can't silently diverge
 *  (e.g. if we ever add crossOrigin, decode(), or a timeout). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
