import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { runtime: "nodejs" };

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

type LessonRow = {
  id: string;
  series_id: string;
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

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

function allowCors(req: IncomingMessage, res: ServerResponse) {
  const allowedOrigins = new Set([
    "https://sakina-design-transplant.vercel.app",
    "capacitor://localhost",
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    json(res, 403, { success: false, error: "Origin is not allowed" });
    return false;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "https://vmidpocwksqdvsyrvcog.supabase.co";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function sourceUrl(row: SourceRow) {
  return row.url;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!allowCors(req, res)) return;
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    json(res, 503, { success: false, error: "Library service is not configured" });
    return;
  }

  try {
    const scholarsResult = await supabase
      .from("lesson_scholars")
      .select("id,slug,name_ar,display_name,photo_url,bio_short,verification_status,verification_source_url,sort_order")
      .eq("verification_status", "verified")
      .not("published_at", "is", null)
      .order("sort_order", { ascending: true })
      .limit(100);
    if (scholarsResult.error) throw scholarsResult.error;

    const scholars = (scholarsResult.data ?? []) as ScholarRow[];
    if (scholars.length === 0) {
      json(res, 200, { success: true, version: "supabase-1", updatedAt: new Date().toISOString(), scholars: [] });
      return;
    }

    const scholarIds = scholars.map((row) => row.id);
    const sourcesResult = await supabase
      .from("lesson_scholar_sources")
      .select("id,scholar_id,source_kind,title_ar,channel_id,handle,url,verification_notes,verification_status,checked_at,sort_order")
      .in("scholar_id", scholarIds)
      .eq("verification_status", "verified")
      .not("checked_at", "is", null)
      .order("sort_order", { ascending: true })
      .limit(500);
    if (sourcesResult.error) throw sourcesResult.error;

    const seriesResult = await supabase
      .from("lesson_series")
      .select("id,scholar_id,source_id,slug,title_ar,description_ar,category,cover_url,sort_order")
      .in("scholar_id", scholarIds)
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("sort_order", { ascending: true })
      .limit(500);
    if (seriesResult.error) throw seriesResult.error;

    const series = (seriesResult.data ?? []) as SeriesRow[];
    const seriesIds = series.map((row) => row.id);
    const lessonsResult = seriesIds.length > 0
      ? await supabase
        .from("lesson_items")
        .select("id,series_id,source_id,youtube_video_id,canonical_url,title_ar,description_ar,lesson_number,duration_seconds,thumbnail_url,sort_order")
        .in("series_id", seriesIds)
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("sort_order", { ascending: true })
        .limit(2000)
      : { data: [], error: null };
    if (lessonsResult.error) throw lessonsResult.error;

    const sources = (sourcesResult.data ?? []) as SourceRow[];
    const lessons = (lessonsResult.data ?? []) as LessonRow[];
    const catalog = scholars.map((scholar) => ({
      id: scholar.id,
      slug: scholar.slug,
      nameAr: scholar.name_ar,
      displayName: scholar.display_name,
      photoUrl: scholar.photo_url ?? undefined,
      bioShort: scholar.bio_short ?? undefined,
      verificationStatus: "verified" as const,
      verificationSourceUrl: scholar.verification_source_url ?? undefined,
      sources: sources
        .filter((source) => source.scholar_id === scholar.id)
        .map((source) => ({
          id: source.id,
          provider: "youtube" as const,
          channelId: source.channel_id ?? "",
          channelUrl: sourceUrl(source),
          channelTitle: source.title_ar,
          labelAr: source.title_ar,
          descriptionAr: source.verification_notes ?? "مصدر رسمي موثق للشيخ.",
          status: "published" as const,
          verifiedAt: source.checked_at ?? undefined,
        })),
      series: series
        .filter((item) => item.scholar_id === scholar.id)
        .map((item) => ({
          id: item.id,
          scholarId: item.scholar_id,
          sourceId: item.source_id ?? undefined,
          titleAr: item.title_ar,
          description: item.description_ar ?? undefined,
          category: item.category ?? undefined,
          coverUrl: item.cover_url ?? undefined,
          sortOrder: item.sort_order,
          status: "published" as const,
          lessons: lessons
            .filter((lesson) => lesson.series_id === item.id)
            .map((lesson) => ({
              id: lesson.id,
              seriesId: lesson.series_id,
              scholarId: scholar.id,
              titleAr: lesson.title_ar,
              descriptionShort: lesson.description_ar ?? undefined,
              episodeNumber: lesson.lesson_number,
              sortOrder: lesson.sort_order,
              durationSeconds: lesson.duration_seconds ?? undefined,
              thumbnailUrl: lesson.thumbnail_url ?? undefined,
              source: lesson.youtube_video_id
                ? {
                  provider: "youtube" as const,
                  channelId: sources.find((source) => source.id === lesson.source_id)?.channel_id ?? "",
                  channelUrl: sources.find((source) => source.id === lesson.source_id)?.url ?? "",
                  videoId: lesson.youtube_video_id,
                  canonicalUrl: lesson.canonical_url,
                }
                : undefined,
              status: "published" as const,
            })),
        })),
    }));

    json(res, 200, {
      success: true,
      version: "supabase-1",
      updatedAt: new Date().toISOString(),
      scholars: catalog,
    });
  } catch (error) {
    console.error("Sakina library API error:", error instanceof Error ? error.message : "unknown");
    json(res, 500, { success: false, error: "تعذر تحميل مكتبة الدروس المنشورة" });
  }
}
