import { publicAssetUrl } from "@/utils/publicAssetUrl";
import type { SakinaLibraryCatalog } from "@/types/sakina-library";

/**
 * الخطوة الأولى من بورتفوليو أمجد سمير: هوية الشيخ ومصادره فقط.
 * لا توجد دروس منشورة حتى تمر كل سلسلة وفيديو بالمراجعة اليدوية.
 */
export const SAKINA_LIBRARY_CATALOG: SakinaLibraryCatalog = {
  version: "0.2.0",
  updatedAt: "2026-08-27T00:00:00.000Z",
  scholars: [
    {
      id: "amgad-samir",
      slug: "amgad-samir",
      nameAr: "أمجد سمير",
      displayName: "الشيخ أمجد سمير",
      photoUrl: publicAssetUrl("images/sakina-library/amgad-samir.jpg"),
      bioShort: "دروس ومحتوى دعوي وتربوي، مع مسارات علمية طويلة مرتبة للدراسة الهادئة.",
      verificationStatus: "verified",
      verificationSourceUrl: "https://www.youtube.com/@amgad_samir",
      sources: [
        {
          id: "amgad-samir-general-youtube",
          provider: "youtube",
          channelId: "UC_FFy2YxiElNMba-t-6VwTA",
          channelUrl: "https://www.youtube.com/@amgad_samir",
          channelTitle: "أمجد سمير",
          labelAr: "القناة العامة",
          descriptionAr: "محتوى عام وتربوي ومواعظ ودروس مناسبة للمشاهدة اليومية.",
          status: "published",
          verifiedAt: "2026-08-27",
        },
        {
          id: "amgad-samir-scientific-youtube",
          provider: "youtube",
          channelId: "UCoFflcHXUS78RlNMQJDbNGw",
          channelUrl: "https://www.youtube.com/channel/UCoFflcHXUS78RlNMQJDbNGw",
          channelTitle: "أمجد سمير | القناة العلمية",
          labelAr: "القناة العلمية",
          descriptionAr: "سلاسل علمية طويلة وشرح كتب، تُرتب داخل سكينة كمسارات دراسة متتابعة.",
          status: "published",
          verifiedAt: "2026-08-27",
        },
      ],
      series: [],
    },
  ],
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
