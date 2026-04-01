// Fetch remote image URLs (including Google Drive share links) into Blobs for IndexedDB storage.

const MAX_IMAGES_PER_ITEM = 10;
const FETCH_TIMEOUT_MS = 45000;

function extractGoogleDriveFileId(urlString) {
  try {
    const u = new URL(urlString.trim());
    const idParam = u.searchParams.get('id');
    if (idParam) return idParam;
    const fileD = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileD) return fileD[1];
    const slashD = u.pathname.match(/\/d\/([^/]+)/);
    if (slashD) return slashD[1];
  } catch (_) {
    return null;
  }
  return null;
}

function isGoogleUsercontentHost(hostname) {
  const h = String(hostname).toLowerCase();
  return h === 'googleusercontent.com' || h.endsWith('.googleusercontent.com');
}

function upgradeHttpToHttpsForGoogleHosts(urlString) {
  try {
    const u = new URL(urlString.trim());
    if (u.protocol !== 'http:') return urlString.trim();
    const h = u.hostname.toLowerCase();
    if (h === 'drive.google.com' || h === 'docs.google.com' || isGoogleUsercontentHost(h)) {
      u.protocol = 'https:';
      return u.href;
    }
    return urlString.trim();
  } catch (_) {
    return urlString.trim();
  }
}

/** Matches manifest host_permissions: Drive, Docs, and image delivery on googleusercontent. */
function isAllowedRemoteImageUrl(urlString) {
  let u;
  try {
    u = new URL(urlString.trim());
  } catch (_) {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return h === 'drive.google.com' || h === 'docs.google.com' || isGoogleUsercontentHost(h);
}

function isGoogleDriveUrl(urlString) {
  try {
    const h = new URL(urlString.trim()).hostname;
    return h === 'drive.google.com' || h === 'docs.google.com';
  } catch (_) {
    return false;
  }
}

function normalizeFetchUrl(urlString) {
  const trimmed = urlString.trim();
  if (!trimmed) return trimmed;
  if (isGoogleDriveUrl(trimmed)) {
    const id = extractGoogleDriveFileId(trimmed);
    if (id) {
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
    }
  }
  return trimmed;
}

function driveViewUrl(urlString) {
  const id = extractGoogleDriveFileId(urlString);
  if (!id) return null;
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
}

function parseUrlsFromCell(cellValue) {
  if (cellValue === undefined || cellValue === null) return [];
  const s = cellValue.toString().trim();
  if (!s) return [];
  const parts = s.split(/[,;\n]+/);
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    const u = p.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    if (/^https?:\/\//i.test(u)) {
      out.push(u);
    }
  }
  return out;
}

function looksLikeHtmlErrorBody(bytes) {
  if (bytes.byteLength < 5) return false;
  const t = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 200)).toLowerCase();
  return (
    t.includes('<!doctype') ||
    t.includes('<html') ||
    t.includes('virus scan') ||
    t.includes('google drive') && t.includes('sign in')
  );
}

function isLikelyImageMagic(bytes) {
  if (bytes.byteLength < 3) return false;
  const a = new Uint8Array(bytes);
  if (a[0] === 0xff && a[1] === 0xd8 && a[2] === 0xff) return true;
  if (bytes.byteLength >= 8 && a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4e && a[3] === 0x47) return true;
  if (bytes.byteLength >= 6 && a[0] === 0x47 && a[1] === 0x49 && a[2] === 0x46) return true;
  if (bytes.byteLength >= 12) {
    const riff = String.fromCharCode(a[0], a[1], a[2], a[3]);
    const webp = String.fromCharCode(a[8], a[9], a[10], a[11]);
    if (riff === 'RIFF' && webp === 'WEBP') return true;
  }
  return false;
}

async function blobLooksLikeImage(blob) {
  if (blob.type && blob.type.startsWith('image/')) return true;
  const slice = await blob.slice(0, 512).arrayBuffer();
  if (looksLikeHtmlErrorBody(slice)) return false;
  return isLikelyImageMagic(slice);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'follow'
    });
    return res;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchImageBlobFromUrl(originalUrl) {
  const canonical = upgradeHttpToHttpsForGoogleHosts(originalUrl);
  if (!isAllowedRemoteImageUrl(canonical)) {
    throw new Error(
      'Only Google Drive, Google Docs, and *.googleusercontent.com image links (HTTPS) are supported.'
    );
  }

  const tryUrls = [];
  const normalized = normalizeFetchUrl(canonical);
  tryUrls.push(normalized);
  if (isGoogleDriveUrl(canonical)) {
    const view = driveViewUrl(canonical);
    if (view && view !== normalized) tryUrls.push(view);
  }

  let lastErr = null;
  for (const u of tryUrls) {
    try {
      const res = await fetchWithTimeout(u, FETCH_TIMEOUT_MS);
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const blob = await res.blob();
      if (await blobLooksLikeImage(blob)) {
        return blob;
      }
      lastErr = new Error('Response was not an image (check Drive sharing: anyone with the link)');
    } catch (e) {
      lastErr = e.name === 'AbortError' ? new Error('Download timed out') : e;
    }
  }
  throw lastErr || new Error('Failed to download image');
}

function extensionFromMime(mime) {
  const m = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  return m[mime && mime.toLowerCase()] || 'jpg';
}

async function fetchUrlToFile(originalUrl, filenameBase, index) {
  const blob = await fetchImageBlobFromUrl(originalUrl);
  let type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  if (!blob.type || blob.type === 'application/octet-stream') {
    const head = await blob.slice(0, 16).arrayBuffer();
    if (isLikelyImageMagic(head)) {
      const u8 = new Uint8Array(head);
      if (u8[0] === 0xff && u8[1] === 0xd8) type = 'image/jpeg';
      else if (u8[0] === 0x89 && u8[1] === 0x50) type = 'image/png';
      else if (u8[0] === 0x47 && u8[1] === 0x49) type = 'image/gif';
    }
  }
  const ext = extensionFromMime(type);
  const safeBase = (filenameBase || 'image').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80);
  const name = `${safeBase}_${index + 1}.${ext}`;
  const typedBlob = blob.type === type ? blob : new Blob([blob], { type });
  return new File([typedBlob], name, { type, lastModified: Date.now() });
}

if (typeof window !== 'undefined') {
  window.ImageUrlImporter = {
    MAX_IMAGES_PER_ITEM,
    FETCH_TIMEOUT_MS,
    parseUrlsFromCell,
    normalizeFetchUrl,
    extractGoogleDriveFileId,
    isAllowedRemoteImageUrl,
    fetchImageBlobFromUrl,
    fetchUrlToFile
  };
}
