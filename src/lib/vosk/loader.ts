import { modelUrl, type VoskLanguage } from "./models";

const CACHE_NAME = "vosk-models-v1";

export interface LoadProgress {
  loaded: number;
  total: number;
}

/**
 * Fetches a Vosk model, reusing the Cache Storage copy on later visits.
 *
 * The models are roughly 40MB each. The previous version downloaded one on
 * every page load whether or not the user ever used the wake word, and gave no
 * indication that it was happening.
 */
export async function fetchModelBlob(
  language: VoskLanguage,
  onProgress?: (progress: LoadProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = modelUrl(language);
  const cache = await openCache();

  const cached = await cache?.match(url);
  if (cached) return cached.blob();

  const response = await fetch(url, signal ? { signal } : {});
  if (!response.ok)
    throw new Error(`failed to download speech model (${response.status})`);

  await cache?.put(url, response.clone());

  const total = Number(response.headers.get("content-length") ?? 0);
  if (!onProgress || !response.body || total === 0) return response.blob();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total });
  }

  return new Blob(chunks as BlobPart[]);
}

async function openCache(): Promise<Cache | undefined> {
  // Absent in private browsing on some engines, and on insecure origins.
  if (typeof caches === "undefined") return undefined;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return undefined;
  }
}
