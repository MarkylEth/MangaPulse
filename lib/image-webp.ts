// lib/image-webp.ts
import sharp from 'sharp';

const WEBP_DIM_LIMIT = 16383;

export type RasterOpts = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;      // WebP 1..100
  effort?: number;       // WebP 1..6
  jpegQuality?: number;  // JPEG fallback
};

export type RasterResult = {
  buffer: Buffer;
  width: number | null;
  height: number | null;
  contentType:
    | 'image/webp'
    | 'image/jpeg'
    | 'image/gif'
    | 'image/png'
    | 'image/avif'
    | 'image/heic'
    | 'image/heif';
  ext: 'webp' | 'jpg' | 'gif' | 'png' | 'avif' | 'heic' | 'heif';
};

function mapFmt(fmt?: string): { ext: RasterResult['ext']; ct: RasterResult['contentType'] } {
  switch ((fmt || '').toLowerCase()) {
    case 'jpeg':
    case 'jpg': return { ext: 'jpg', ct: 'image/jpeg' };
    case 'png': return { ext: 'png', ct: 'image/png' };
    case 'gif': return { ext: 'gif', ct: 'image/gif' };
    case 'webp': return { ext: 'webp', ct: 'image/webp' };
    case 'avif': return { ext: 'avif', ct: 'image/avif' };
    case 'heic': return { ext: 'heic', ct: 'image/heic' };
    case 'heif': return { ext: 'heif', ct: 'image/heif' };
    default:     return { ext: 'jpg', ct: 'image/jpeg' };
  }
}

export async function rasterizeToBest(buffer: Buffer, opts: RasterOpts = {}): Promise<RasterResult> {
  const quality = opts.quality ?? 82;
  const effort  = opts.effort ?? 5;
  const jpegQ   = opts.jpegQuality ?? Math.min(95, Math.max(60, quality));

  // top-level страховка: на любой неожиданный сбой — отдать оригинал
  try {
    const base = sharp(buffer, { failOn: 'none', limitInputPixels: 0 }).rotate();
    const meta = await base.metadata();
    const srcFmt = (meta.format || '').toLowerCase();
    const { ext: srcExt, ct: srcCt } = mapFmt(srcFmt);

    // 0) GIF — не трогаем (сохраняет анимацию)
    if (srcFmt === 'gif') {
      return { buffer, width: meta.width ?? null, height: meta.height ?? null, contentType: srcCt, ext: srcExt };
    }

    // 1) опциональный «inside»-ресайз
    const resized = (opts.maxWidth || opts.maxHeight)
      ? base.clone().resize({
          width: opts.maxWidth,
          height: opts.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : base.clone();

    const tMeta = await resized.metadata();
    const tW = tMeta.width ?? 0;
    const tH = tMeta.height ?? 0;

    // если размеры неизвестны — отдаём оригинал
    if (!tW || !tH) {
      return { buffer, width: meta.width ?? null, height: meta.height ?? null, contentType: srcCt, ext: srcExt };
    }

    // 2) превышаем лимит WebP? — сразу оригинал, никаких .webp()
    if (tW > WEBP_DIM_LIMIT || tH > WEBP_DIM_LIMIT) {
      return { buffer, width: meta.width ?? null, height: meta.height ?? null, contentType: srcCt, ext: srcExt };
    }

    // 3) пробуем WebP
    try {
      const { data, info } = await resized.webp({ quality, effort }).toBuffer({ resolveWithObject: true });
      return { buffer: data, width: info.width ?? null, height: info.height ?? null, contentType: 'image/webp', ext: 'webp' };
    } catch (e: any) {
      const msg = String(e?.message || e).toLowerCase();
      // любые «too large for the webp» → отдать оригинал
      if (msg.includes('too large for the webp') || msg.includes('maximum dimension') || msg.includes('exceeds')) {
        return { buffer, width: meta.width ?? null, height: meta.height ?? null, contentType: srcCt, ext: srcExt };
      }
      // на прочие ошибки — свалимся в JPEG
    }

    // 4) универсальный фолбэк — JPEG
    const { data: jpg, info } = await resized
      .jpeg({ quality: jpegQ, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer({ resolveWithObject: true });

    return { buffer: jpg, width: info.width ?? null, height: info.height ?? null, contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    // «план С»: отдать оригинал совсем без изменений
    const meta = await sharp(buffer, { failOn: 'none', limitInputPixels: 0 }).metadata();
    const { ext, ct } = mapFmt(meta.format);
    return { buffer, width: meta.width ?? null, height: meta.height ?? null, contentType: ct, ext };
  }
}
