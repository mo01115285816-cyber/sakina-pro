import { getPublishedScholars } from "@/data/sakinaLibraryCatalog";
import { getSupabaseClient } from "@/services/supabase-client";
import type { SakinaLessonItem, SakinaLessonSeries, SakinaScholar, SakinaScholarSource } from "@/types/sakina-library";

type ScholarRow = {
  id: string;
  slug: string;
  name_ar: string;
  display_name: string;
  photo_url: string | null;
  bio_short: string | null;
  verification_status: string;
  verification_source_url: string | null;
  sort_order: number;
};

type SourceRow = {
  id: string;
  scholar_id: string;
  source_kind: string;
  title_ar: string;
  channel_id: string | null;
  handle: string | null;
  url: string;
  verification_notes: string | null;
  verification_status: string;
  checked_at: string | null;
  sort_order: number;
};

type SeriesRow = {
  id: string;
  scholar_id: string;
  source_id: string | null;
  slug: string;
  title_ar: string;
  description_ar: string | null;
  category: string | null;
  cover_url: string | null;
  sort_order: number;
};

const LIBRARY_CACHE_KEY = "sakeenah_lesson_library_cache_v6";
const LIBRARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type LibraryCache = { savedAt: number; scholars: SakinaScholar[] };

type LessonRow = {
  id: string;
  series_id: string | null;
  source_id: string;
  youtube_video_id: string | null;
  canonical_url: string;
  title_ar: string;
  description_ar: string | null;
  lesson_number: number;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  sort_order: number;
};

type SeriesMembershipRow = {
  series_id: string;
  lesson_id: string;
  series_lesson_number: number;
  sort_order: number;
};

function mapCatalog(
  scholars: ScholarRow[],
  sources: SourceRow[],
  series: SeriesRow[],
  lessons: LessonRow[],
  memberships: SeriesMembershipRow[],
): SakinaScholar[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const membershipsBySeries = new Map<string, SeriesMembershipRow[]>();
  for (const membership of memberships) {
    const current = membershipsBySeries.get(membership.series_id) ?? [];
    current.push(membership);
    membershipsBySeries.set(membership.series_id, current);
  }
  const mapLesson = (lesson: LessonRow, scholar: ScholarRow): SakinaLessonItem => {
    const source = sourceById.get(lesson.source_id);
    return {
      id: lesson.id,
      seriesId: lesson.series_id ?? undefined,
      scholarId: scholar.id,
      titleAr: lesson.title_ar,
      descriptionShort: lesson.description_ar ?? undefined,
      episodeNumber: lesson.lesson_number,
      sortOrder: lesson.sort_order,
      durationSeconds: lesson.duration_seconds ?? undefined,
      thumbnailUrl: lesson.thumbnail_url ?? undefined,
      source: lesson.youtube_video_id
        ? {
          provider: "youtube",
          channelId: source?.channel_id ?? "",
          channelUrl: source?.url ?? "",
          videoId: lesson.youtube_video_id,
          canonicalUrl: lesson.canonical_url,
        }
        : undefined,
      status: "published",
    };
  };
  return scholars.map((scholar) => ({
    id: scholar.id,
    slug: scholar.slug,
    nameAr: scholar.name_ar,
    displayName: scholar.display_name,
    photoUrl: scholar.photo_url ?? undefined,
    bioShort: scholar.bio_short ?? undefined,
    verificationStatus: "verified",
    verificationSourceUrl: scholar.verification_source_url ?? undefined,
    sources: sources
      .filter((source) => source.scholar_id === scholar.id)
      .map((source): SakinaScholarSource => ({
        id: source.id,
        provider: "youtube",
        channelId: source.channel_id ?? "",
        channelUrl: source.url,
        channelTitle: source.title_ar,
        labelAr: source.title_ar,
        descriptionAr: source.verification_notes ?? "مصدر رسمي موثق للشيخ.",
        status: "published",
        verifiedAt: source.checked_at ?? undefined,
      })),
    series: series
      .filter((item) => item.scholar_id === scholar.id)
      .map((item): SakinaLessonSeries => ({
        id: item.id,
        scholarId: item.scholar_id,
        sourceId: item.source_id ?? undefined,
        titleAr: item.title_ar,
        description: item.description_ar ?? undefined,
        category: item.category ?? undefined,
        coverUrl: item.cover_url ?? undefined,
        sortOrder: item.sort_order,
        status: "published",
        lessons: (() => {
          const seriesMemberships = membershipsBySeries.get(item.id);
          if (!seriesMemberships || seriesMemberships.length === 0) {
            return lessons
              .filter((lesson) => lesson.series_id === item.id)
              .map((lesson) => mapLesson(lesson, scholar));
          }
          return seriesMemberships
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order || a.series_lesson_number - b.series_lesson_number)
            .map((membership) => {
              const lesson = lessonsById.get(membership.lesson_id);
              if (!lesson) return null;
              return mapLesson({
                ...lesson,
                series_id: item.id,
                lesson_number: membership.series_lesson_number,
                sort_order: membership.sort_order,
              }, scholar);
            })
            .filter((lesson): lesson is SakinaLessonItem => lesson !== null);
        })(),
      })),
    standaloneLessons: lessons
      .filter((lesson) => lesson.series_id === null && sourceById.get(lesson.source_id)?.scholar_id === scholar.id)
      .map((lesson) => mapLesson(lesson, scholar)),
  }));
}

async function loadFromSupabase(signal?: AbortSignal) {
  const client = getSupabaseClient();
  const scholarsResult = await client
    .from("lesson_scholars")
    .select("id,slug,name_ar,display_name,photo_url,bio_short,verification_status,verification_source_url,sort_order")
    .eq("verification_status", "verified")
    .not("published_at", "is", null)
    .order("sort_order", { ascending: true })
    .limit(100)
    .abortSignal(signal ?? new AbortController().signal);
  if (scholarsResult.error) throw scholarsResult.error;
  const scholars = (scholarsResult.data ?? []) as ScholarRow[];
  if (scholars.length === 0) return [];

  const scholarIds = scholars.map((row) => row.id);
  const sourcesResult = await client
    .from("lesson_scholar_sources")
    .select("id,scholar_id,source_kind,title_ar,channel_id,handle,url,verification_notes,verification_status,checked_at,sort_order")
    .in("scholar_id", scholarIds)
    .eq("verification_status", "verified")
    .not("checked_at", "is", null)
    .order("sort_order", { ascending: true })
    .limit(500)
    .abortSignal(signal ?? new AbortController().signal);
  if (sourcesResult.error) throw sourcesResult.error;

  const seriesResult = await client
    .from("lesson_series")
    .select("id,scholar_id,source_id,slug,title_ar,description_ar,category,cover_url,sort_order")
    .in("scholar_id", scholarIds)
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("sort_order", { ascending: true })
    .limit(500)
    .abortSignal(signal ?? new AbortController().signal);
  if (seriesResult.error) throw seriesResult.error;

  const series = (seriesResult.data ?? []) as SeriesRow[];
  const seriesIds = series.map((row) => row.id);
  const membershipsResult = seriesIds.length > 0
    ? await client
      .from("lesson_series_items")
      .select("series_id,lesson_id,series_lesson_number,sort_order")
      .in("series_id", seriesIds)
      .order("sort_order", { ascending: true })
      .limit(5000)
      .abortSignal(signal ?? new AbortController().signal)
    : { data: [], error: null };
  if (membershipsResult.error) throw membershipsResult.error;

  const sourceIds = (sourcesResult.data ?? []).map((row) => (row as SourceRow).id);
  const lessonsResult = sourceIds.length > 0
    ? await client
      .from("lesson_items")
      .select("id,series_id,source_id,youtube_video_id,canonical_url,title_ar,description_ar,lesson_number,duration_seconds,thumbnail_url,sort_order")
      .in("source_id", sourceIds)
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("sort_order", { ascending: true })
      .limit(2000)
      .abortSignal(signal ?? new AbortController().signal)
    : { data: [], error: null };
  if (lessonsResult.error) throw lessonsResult.error;

  return mapCatalog(
    scholars,
    (sourcesResult.data ?? []) as SourceRow[],
    series,
    (lessonsResult.data ?? []) as LessonRow[],
    (membershipsResult.data ?? []) as SeriesMembershipRow[],
  );
}

/**
 * يقرأ المحتوى المنشور فقط من Supabase؛ RLS يمنع المسودات ومواد المراجعة.
 * عند غياب إعداد Supabase أو فشل القراءة، نُبقي الكتالوج المحلي المنشور الحالي.
 */
function readLibraryCache(): LibraryCache | null {
  try {
    const raw = localStorage.getItem(LIBRARY_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LibraryCache>;
    if (!Array.isArray(value.scholars) || typeof value.savedAt !== "number") return null;
    return { savedAt: value.savedAt, scholars: value.scholars };
  } catch {
    return null;
  }
}

function writeLibraryCache(scholars: SakinaScholar[]) {
  try {
    localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), scholars } satisfies LibraryCache));
  } catch {
    // The network result remains usable when storage is unavailable or full.
  }
}

export async function loadPublishedSakinaScholars(signal?: AbortSignal): Promise<SakinaScholar[]> {
  const fallback = getPublishedScholars();
  const cached = readLibraryCache();
  if (cached && Date.now() - cached.savedAt < LIBRARY_CACHE_TTL_MS) return cached.scholars;
  try {
    const remote = await loadFromSupabase(signal);
    if (remote.length > 0) {
      writeLibraryCache(remote);
      return remote;
    }
  } catch {
    // The local catalog remains available while the public data service is unavailable.
  }

  try {
    const response = await fetch("/api/library/catalog", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`Library request failed: ${response.status}`);
    const payload = await response.json() as { success?: boolean; scholars?: SakinaScholar[] };
    if (payload.success === true && Array.isArray(payload.scholars) && payload.scholars.length > 0) {
      writeLibraryCache(payload.scholars);
      return payload.scholars;
    }
  } catch {
    // Keep the local catalog as the last safe fallback.
  }

  return fallback;
}
