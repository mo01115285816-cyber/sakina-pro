import type { SakinaLibraryCatalog } from "@/types/sakina-library";

/**
 * المرحلة الأولى تبدأ بكتالوج فارغ عمدًا.
 * لا يُضاف شيخ أو قناة أو درس قبل اعتماد المصدر والرابط من مدير المحتوى.
 */
export const SAKINA_LIBRARY_CATALOG: SakinaLibraryCatalog = {
  version: "0.1.0",
  updatedAt: "2026-08-26T00:00:00.000Z",
  scholars: [],
};

export function getPublishedScholars() {
  return SAKINA_LIBRARY_CATALOG.scholars.filter(
    (scholar) => scholar.verificationStatus === "verified",
  );
}

export function getPublishedSeries(scholarId: string) {
  const scholar = getPublishedScholars().find((item) => item.id === scholarId);
  return scholar?.series.filter((series) => series.status === "published") ?? [];
}

export function getPublishedLessons(seriesId: string) {
  for (const scholar of getPublishedScholars()) {
    const series = scholar.series.find((item) => item.id === seriesId);
    if (series?.status === "published") {
      return series.lessons
        .filter((lesson) => lesson.status === "published")
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }
  return [];
}
