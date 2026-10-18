export function textureDimensions(width, height, limit) {
  if (!(width > 0 && height > 0 && limit > 0)) throw new Error('Invalid texture dimensions');
  const ratio = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function prepareTextures(data, limit) {
  const manifest = structuredClone(data.manifest);
  manifest.url = `${location.origin}/models/${data.id}/manifest.json`;
  try {
    for (const [index, reference] of manifest.FileReferences.Textures.entries()) {
      const cached=await window.companion.cachedTexture(data.id,index,limit);if(cached){manifest.FileReferences.Textures[index]=cached;continue;}
      const response = await fetch(new URL(reference, manifest.url));
      if (!response.ok) throw new Error(`Texture HTTP ${response.status}: ${reference}`);
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const size = textureDimensions(bitmap.width, bitmap.height, limit);
        const canvas = new OffscreenCanvas(size.width, size.height);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0, size.width, size.height);
        const png = await canvas.convertToBlob({ type: 'image/png' });
        manifest.FileReferences.Textures[index] = await window.companion.previewTexture(data.id, index, await png.arrayBuffer(), limit);
        console.log(`[texture] ${reference}: ${bitmap.width}×${bitmap.height} → ${size.width}×${size.height}`);
      } finally { bitmap.close(); }
    }
    return { manifest, dispose: () => window.companion.clearPreviewTextures(data.id) };
  } catch (error) { await window.companion.clearPreviewTextures(data.id); throw error; }
}
