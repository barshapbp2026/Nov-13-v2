export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  const res = await fetch(url, init);
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error(
      `सर्भरबाट खाली जवाफ आयो (HTTP ${res.status})। कृपया केही क्षणपछि पुनः प्रयास गर्नुहोस्।`
    );
  }

  if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
    if (res.status === 504 || res.status === 502 || res.status === 503) {
      throw new Error(
        `सर्भर अनुरोध समय सीमा (Timeout HTTP ${res.status}) नाघेर HTML पृष्ठ फर्कियो। सानो दायरा वा पृष्ठ छानी पुनः प्रयास गर्नुहोस्।`
      );
    }
    throw new Error(
      `सर्भरले JSON को सट्टा HTML पृष्ठ पठायो (HTTP ${res.status})। बैकएन्ड सर्भर रिस्टार्ट वा प्रोक्सी त्रुटि भएको हुनसक्छ — कृपया पुनः प्रयास गर्नुहोस्।`
    );
  }

  try {
    const data = JSON.parse(trimmed) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    throw new Error(
      `सर्भरबाट अमान्य JSON प्राप्त भयो (HTTP ${res.status}): ${trimmed.slice(0, 140)}`
    );
  }
}
