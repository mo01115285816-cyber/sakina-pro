import { getPublishedScholars } from "@/data/sakinaLibraryCatalog";
import type { SakinaScholar } from "@/types/sakina-library";

export type PublishedSakinaLibraryResponse = {
  success: true;
  version: string;
  updatedAt?: string;
  scholars: SakinaScholar[];
};

/**
 * يقرأ المحتوى المنشور فقط من الخادم. المسودات ومواد المراجعة لا تصل إلى هذا المسار.
 * عند غياب إعداد الخادم أو فشله، نُبقي الكتالوج المحلي المنشور الحالي بدل كسر المكتبة.
 */
export async function loadPublishedSakinaScholars(signal?: AbortSignal): Promise<SakinaScholar[]> {
  const fallback = getPublishedScholars();
  try {
    const response = await fetch("/api/library/catalog", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`Library request failed: ${response.status}`);
    const payload = await response.json() as Partial<PublishedSakinaLibraryResponse>;
    if (payload.success !== true || !Array.isArray(payload.scholars)) throw new Error("Invalid library payload");
    return payload.scholars.length > 0 ? payload.scholars : fallback;
  } catch {
    return fallback;
  }
}
