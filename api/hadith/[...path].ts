import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { runtime: "nodejs" };

type Book = {
  id: string;
  titleArabic: string;
  authorArabic: string;
  authorDeath: string;
  hadithsCount: number;
  chaptersCount: number;
  description: string;
  category: string;
  badgeColor: string;
  bgGradient: string;
  editionSlug: string;
  coverImage: string;
};

type Hadith = {
  bookId: string;
  bookTitle: string;
  hadithnumber: number;
  arabicnumber: number | string;
  textAvailable?: boolean;
  chapterId: string;
  chapterTitle: string;
  text: string;
  grade?: string;
  reference?: unknown;
};

type Dataset = {
  metadata: Record<string, unknown>;
  hadiths: Hadith[];
};

const books: Book[] = [
  ["bukhari", "صحيح البخاري", "الإمام محمد بن إسماعيل البخاري", "256 هـ", 7589, 98, "أصح كتاب بعد كتاب الله تعالى، جمع فيه الإمام البخاري الأحاديث الصحيحة المسندة عن رسول الله ﷺ.", "الكتب الستة", "ara-bukhari", "author_bukhari.webp"],
  ["muslim", "صحيح مسلم", "الإمام مسلم بن الحجاج النيسابوري", "261 هـ", 7563, 57, "ثاني أصح كتب الحديث الشريف، امتاز بحسن الترتيب والصياغة والاستيعاب للطرق والأسانيد.", "الكتب الستة", "ara-muslim", "author_muslim.webp"],
  ["abudawud", "سنن أبي داود", "الإمام أبو داود سليمان بن الأشعث السجستاني", "275 هـ", 5274, 44, "أحد أهم السنن الأربعة، ركز فيه مصنفه على أحاديث الأحكام والسنن الفقهية المرفوعة.", "الكتب الستة", "ara-abudawud", "author_abudawud.png"],
  ["tirmidhi", "جامع الترمذي", "الإمام أبو عيسى محمد بن عيسى الترمذي", "279 هـ", 3998, 50, "معروف بالجامع والسنن، تميز بذكر مذاهب الفقهاء وبيان درجات الأحاديث من الصحة والحسن والضعف.", "الكتب الستة", "ara-tirmidhi", "author_tirmidhi.png"],
  ["nasai", "سنن النسائي (المجتبى)", "الإمام أحمد بن شعيب النسائي", "303 هـ", 5765, 52, "أشد السنن انتقاءً للرجال وأقلها حديثاً ضعيفاً بعد الصحيحين، اشتمل على الدقائق الفقهية والعلل.", "الكتب الستة", "ara-nasai", "author_nasai.png"],
  ["ibnmajah", "سنن ابن ماجه", "الإمام أبو عبد الله محمد بن يزيد ابن ماجه", "273 هـ", 4343, 38, "خاتم الكتب الستة، امتاز بحسن التبويب وكثرة زوائده على الأمهات الخمس من الأحاديث والسنن.", "الكتب الستة", "ara-ibnmajah", "author_ibnmajah.png"],
  ["malik", "موطأ الإمام مالك", "الإمام مالك بن أنس الأصبحي", "179 هـ", 1858, 62, "أقدم مدونة حديثية وفقهية جامعة وصلتنا بحالة ممتازة، من أصح الآثار والسنن عن دار الهجرة.", "الموطآت والمسانيد", "ara-malik", "author_malik.png"],
  ["nawawi", "الأربعون النووية", "الإمام يحيى بن شرف النووي", "676 هـ", 42, 2, "مجموعة جوامع كلم النبي ﷺ ومباني الإسلام والأحكام التي عليها مدار الدين.", "الأربعينيات والقدسيات", "ara-nawawi", "author_nawawi.png"],
  ["qudsi", "الأحاديث القدسية", "مجموعة من الأئمة الحفاظ", "متنوع", 40, 2, "الأحاديث التي يرويها النبي ﷺ عن ربه عز وجل بألفاظ جامعة ترقق القلوب.", "الأربعينيات والقدسيات", "ara-qudsi", "author_qudsiyyah.png"],
].map(([id, titleArabic, authorArabic, authorDeath, hadithsCount, chaptersCount, description, category, editionSlug, cover] ): Book => ({
  id: id as string,
  titleArabic: titleArabic as string,
  authorArabic: authorArabic as string,
  authorDeath: authorDeath as string,
  hadithsCount: hadithsCount as number,
  chaptersCount: chaptersCount as number,
  description: description as string,
  category: category as string,
  badgeColor: "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40",
  bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
  editionSlug: editionSlug as string,
  coverImage: `/images/hadith/${cover as string}`,
}));

const cache = new Map<string, Dataset>();

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const allowed = new Set([
    "https://sakina-design-transplant.vercel.app",
    "https://sakeenah-console.vercel.app",
    "capacitor://localhost",
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const origin = req.headers.origin;
  if (origin && !allowed.has(origin)) {
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

function chapterTitle(bookId: string, sectionId: string, raw?: string) {
  if (raw && /[\u0600-\u06FF]/.test(raw)) return raw.trim();
  if (bookId === "bukhari" && sectionId === "1") return "كتاب بدء الوحي";
  if (bookId === "bukhari" && sectionId === "2") return "كتاب الإيمان";
  if (bookId === "bukhari" && sectionId === "8") return "كتاب الصلاة";
  if (bookId === "muslim" && sectionId === "1") return "كتاب الإيمان";
  if (bookId === "muslim" && sectionId === "4") return "كتاب الصلاة";
  return `كتاب رقم ${sectionId}`;
}

async function getDataset(bookId: string): Promise<Dataset> {
  const cached = cache.get(bookId);
  if (cached) return cached;

  const book = books.find((item) => item.id === bookId);
  if (!book) throw new Error("الكتاب غير موجود");

  const urls = [
    `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book.editionSlug}.min.json`,
    `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book.editionSlug}.json`,
    `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${book.editionSlug}.min.json`,
    `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${book.editionSlug}.json`,
  ];
  let source: {
    metadata?: Record<string, unknown>;
    hadiths?: Array<Record<string, unknown>>;
  } | null = null;
  for (const url of urls) {
    try {
      const candidate = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!candidate.ok) continue;
      const body = await candidate.text();
      const parsed = JSON.parse(body) as {
        metadata?: Record<string, unknown>;
        hadiths?: Array<Record<string, unknown>>;
      };
      if (!Array.isArray(parsed.hadiths) || parsed.hadiths.length === 0) continue;
      source = parsed;
      break;
    } catch {
      // Try the next URL from the same trusted source repository.
    }
  }
  if (!source) throw new Error("تعذر تحميل بيانات الكتاب بصيغة JSON صحيحة");
  const metadata = source.metadata ?? {};
  const sections = (metadata.sections ?? metadata.section ?? {}) as Record<string, string>;
  const hadiths = (source.hadiths ?? []).map((item, index) => {
    const reference = item.reference as { book?: number; hadith?: number } | undefined;
    const sectionId = String(reference?.book ?? "0");
    const rawHadithNumber = item.hadithnumber ?? item.arabicnumber;
    const parsedHadithNumber = Number(rawHadithNumber);
    const hadithnumber = Number.isFinite(parsedHadithNumber) ? parsedHadithNumber : index + 1;
    const rawArabicNumber = item.arabicnumber ?? item.hadithnumber ?? hadithnumber;
    const arabicnumber = typeof rawArabicNumber === "string" && rawArabicNumber.trim()
      ? rawArabicNumber.trim()
      : Number(rawArabicNumber);
    const text = typeof item.text === "string" ? item.text : "";
    return {
      bookId: book.id,
      bookTitle: book.titleArabic,
      hadithnumber,
      arabicnumber,
      chapterId: sectionId,
      chapterTitle: chapterTitle(book.id, sectionId, sections[sectionId]),
      text,
      textAvailable: text.trim().length > 0,
      grade: Array.isArray(item.grades) && item.grades[0] && typeof item.grades[0] === "object"
        ? String((item.grades[0] as { grade?: string }).grade ?? "")
        : book.id === "bukhari" || book.id === "muslim" ? "صحيح" : undefined,
      reference,
    } satisfies Hadith;
  });

  const dataset = { metadata, hadiths };
  cache.set(bookId, dataset);
  return dataset;
}

function requestPath(req: IncomingMessage): { path: string[]; query: URLSearchParams } {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `https://${host}`);
  const prefix = "/api/hadith";
  const pathname = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
  return { path: pathname.split("/").filter(Boolean).map(decodeURIComponent), query: url.searchParams };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cors(req, res)) return;
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  try {
    const { path, query } = requestPath(req);
    if (path.length === 1 && path[0] === "books") {
      json(res, 200, { success: true, books });
      return;
    }

    if (path[0] === "book" && path[1]) {
      const book = books.find((item) => item.id === path[1]);
      if (!book) {
        json(res, 404, { success: false, error: "الكتاب غير موجود" });
        return;
      }
      const dataset = await getDataset(book.id);

      if (path.length === 2) {
        const sections = (dataset.metadata.sections ?? dataset.metadata.section ?? {}) as Record<string, string>;
        const chapters = Object.entries(sections).map(([id, title]) => ({
          id,
          number: Number(id) || 0,
          title: chapterTitle(book.id, id, title),
          hadithCount: dataset.hadiths.filter((item) => item.chapterId === id).length,
        })).filter((item) => item.hadithCount > 0 || item.id === "0");
        json(res, 200, { success: true, book, chapters, totalHadiths: dataset.hadiths.length });
        return;
      }

      if (path[2] === "hadiths") {
        const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? 20) || 20));
        const chapter = query.get("chapter") ?? "all";
        const search = (query.get("search") ?? "").trim().toLowerCase();
        let filtered = dataset.hadiths;
        if (chapter !== "all") filtered = filtered.filter((item) => item.chapterId === chapter);
        if (search) filtered = filtered.filter((item) => item.text.toLowerCase().includes(search) || String(item.hadithnumber) === search || String(item.arabicnumber) === search || item.chapterTitle.toLowerCase().includes(search));
        const total = filtered.length;
        json(res, 200, {
          success: true,
          bookId: book.id,
          bookTitle: book.titleArabic,
          chapterId: chapter,
          chapterTitle: chapter === "all" ? "جميع الأبواب" : filtered[0]?.chapterTitle ?? chapterTitle(book.id, chapter),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hadiths: filtered.slice((page - 1) * limit, page * limit),
        });
        return;
      }
    }

    if (path[0] === "search") {
      const search = (query.get("q") ?? "").trim().toLowerCase();
      const requestedBook = query.get("book");
      const targetBooks = requestedBook && requestedBook !== "all" ? books.filter((item) => item.id === requestedBook) : books;
      const results: Hadith[] = [];
      for (const book of targetBooks) {
        const dataset = await getDataset(book.id);
        for (const item of dataset.hadiths) {
          if (search && (item.text.toLowerCase().includes(search) || item.chapterTitle.toLowerCase().includes(search) || String(item.hadithnumber) === search || String(item.arabicnumber) === search)) results.push(item);
        }
      }
      const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? 40) || 40));
      json(res, 200, { success: true, query: search, bookId: requestedBook ?? "all", total: results.length, page: 1, limit, totalPages: Math.ceil(results.length / limit) || 1, results: results.slice(0, limit) });
      return;
    }

    json(res, 404, { success: false, error: "مسار الحديث غير موجود" });
  } catch (error) {
    console.error("Hadith API error:", error instanceof Error ? error.message : "unknown");
    json(res, 500, { success: false, error: "تعذر تحميل بيانات الحديث" });
  }
}
