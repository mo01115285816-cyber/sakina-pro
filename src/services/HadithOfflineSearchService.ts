import localforage from "localforage";
import { HadithItem, HadithBookInfo } from "../types/hadith.types";

// Setup storage instances
const hadithBooksStore = localforage.createInstance({
  name: "hadith_db",
  storeName: "books_data",
  description: "Offline Hadith Books Datasets",
});

const searchMetaStore = localforage.createInstance({
  name: "hadith_db",
  storeName: "meta",
  description: "Hadith DB metadata",
});

// Arabic Text Normalization Helpers
export function stripDiacritics(text: string): string {
  if (!text) return "";
  return text.replace(/[\u064B-\u065F\u0670]/g, "");
}

export function normalizeArabic(text: string): string {
  if (!text) return "";
  let normalized = stripDiacritics(text);
  normalized = normalized.replace(/ـ/g, ""); // Remove tatweel
  normalized = normalized.replace(/[أإآ]/g, "ا");
  normalized = normalized.replace(/ة/g, "ه");
  normalized = normalized.replace(/[ىي]/g, "ي"); // Treat Alif Maqsura and Yaa as same
  normalized = normalized.replace(/[ؤئ]/g, "ء"); // Treat Hamza chairs as simple Hamza
  return normalized;
}

// Custom Arabic stemmer/lemmatizer for search query expansion
export function extractArabicStems(word: string): string[] {
  const normalized = normalizeArabic(word);
  if (normalized.length <= 2) return [normalized];

  const stems = new Set<string>([normalized]);

  // Strip common prefixes
  const prefixes = ["ال", "وال", "فال", "بال", "لل", "و", "ف", "ب", "ك", "ل"];
  for (const pref of prefixes) {
    if (normalized.startsWith(pref) && normalized.length - pref.length > 2) {
      stems.add(normalized.substring(pref.length));
    }
  }

  // Strip common suffixes
  const suffixes = ["ون", "ين", "ات", "هما", "هما", "هم", "هن", "ها", "ه", "نا", "كم", "كما", "كن", "ت", "تم"];
  for (const suff of suffixes) {
    if (normalized.endsWith(suff) && normalized.length - suff.length > 2) {
      stems.add(normalized.substring(0, normalized.length - suff.length));
    }
  }

  return Array.from(stems);
}

// Built-in Arabic Islamic Synonym Map
// This maps normalized search keywords to related semantic concepts.
const SEMANTIC_MAP: Record<string, string[]> = {
  "غضب": ["غضب", "يغضب", "تغضب", "غضبان", "الغضب", "حلم", "كظم"],
  "صلاه": ["صلاه", "يصلي", "تصلوا", "الصلوات", "صليت", "ركوع", "سجود", "تشهد", "ركعه"],
  "صوم": ["صام", "يصوم", "صيام", "رمضان", "الصائمين", "الصوم", "سحور", "افطار"],
  "ظلم": ["ظلم", "يظلم", "مظلوم", "الظالمين", "تظالموا", "الظلم", "جور"],
  "نساء": ["نساء", "امراه", "زوجه", "بنت", "فتيات", "النساء", "زوجات", "ام", "اخوات", "بنات"],
  "صدق": ["يصدق", "صدق", "صادق", "الصادقين", "الصدق", "امانه"],
  "بر": ["بر", "الوالدين", "امي", "ابي", "الاب", "الام", "احسان", "صله"],
  "موت": ["موت", "قبر", "جنازه", "الاخره", "القيامه", "الموت", "بعث", "نشور"],
  "اخلاق": ["خلق", "حسن", "اخلاق", "الرفق", "الادب", "الامانه", "صدق", "وفاء"],
  "توبه": ["توبه", "يستغفر", "استغفار", "يتوب", "تائب", "التوبه", "استغفرت"],
  "سفر": ["مسافر", "سفر", "يقصر", "الجمع", "السفر", "راحل", "ترحال"],
  "طهاره": ["طهر", "وضوء", "طهاره", "غسل", "جنابه", "نجاسه", "استنجاء", "مضمضه", "استنشاق"],
  "جنه": ["جنه", "فردوس", "نعيم", "الجنه", "خلود"],
  "نار": ["نار", "جحيم", "عذاب", "جهنم", "النار", "سعير"],
  "قران": ["قران", "مصحف", "سوره", "ايه", "تلاوه", "يتلو", "القران"],
  "حسن": ["حسن", "جمال", "احسان", "حسنه", "طيب"],
  "خوف": ["خوف", "خشيه", "وجل", "رهبه", "فزع"],
  "حب": ["حب", "ود", "عشق", "يحب", "تودد"],
  "بخل": ["بخل", "شح", "امساك", "منع", "البخل"],
  "كذب": ["كذب", "افك", "زور", "دجل", "يكذب", "الخداع"],
  "جهاد": ["جهاد", "يجاهد", "القتال", "غزوه", "شهيد", "معركه"],
  "زكاه": ["زكاه", "صدقه", "صدقات", "انفاق", "اموال", "ذهب", "فضه"],
  "حج": ["حج", "عمرة", "احرام", "طواف", "سعي", "عرافات", "منى", "مزدلفه"]
};

// Arabic Chapter Translation helpers and dictionaries to maintain 100% parity with online view
const COMMON_ARABIC_SECTIONS: Record<string, string> = {
  "0": "المقدمة والآثار العامة",
  "1": "كتاب بدء الوحي والإيمان",
  "2": "كتاب الإيمان والتوحيد",
  "3": "كتاب العلم والفقه",
  "4": "كتاب الوضوء والطهارت",
  "5": "كتاب الغسل والجمعة",
  "6": "كتاب الحيض والاستحاضة",
  "7": "كتاب التيمم والنوافل",
  "8": "كتاب الصلاة وأحكامها",
  "9": "كتاب مواقيت الصلاة",
  "10": "كتاب الأذان والإقامة",
  "11": "كتاب صلاة الجماعة والإمامة",
  "12": "كتاب صفة الصلاة",
  "13": "كتاب الجمعة وفضلها",
  "14": "كتاب صلاة الخوف",
  "15": "كتاب صلاة العيدين",
  "16": "كتاب صلاة الوتر والقيام",
  "17": "كتاب الاستسقاء",
  "18": "كتاب صلاة الكسوف",
  "19": "كتاب سجود القرآن",
  "20": "كتاب تقصير الصلاة والجمع",
  "21": "كتاب التهجد وقيام الليل",
  "22": "كتاب فضل الصلاة في مكة والمدينة",
  "23": "كتاب العمل في الصلاة",
  "24": "كتاب السهو في الصلاة",
  "25": "كتاب الجنائز وأحكام المقابر",
  "26": "كتاب الزكاة والصدقات",
  "27": "كتاب الحج والعمرة",
  "28": "كتاب الصوم وتطوعه",
  "29": "كتاب قيام رمضان والاعتكاف",
  "30": "كتاب البيوع والمعاملات",
  "31": "كتاب السَلَم والبيوع",
  "32": "كتاب الإجارة والشروط",
  "33": "كتاب الحوالة والكفالة",
  "34": "كتاب الوكالة والمزارعة",
  "35": "كتاب المساقاة والشركات",
  "36": "كتاب الرهن والعتق",
  "37": "كتاب الهبة والعطية",
  "38": "كتاب الشهادات والصلح",
  "39": "كتاب الشروط والوصايا",
  "40": "كتاب الجهاد والسير",
  "41": "كتاب فرض الخمس والغزوات",
  "42": "كتاب بدء الخلق والعجائب",
  "43": "كتاب أحاديث الأنبياء عليهم السلام",
  "44": "كتاب المناقب والفضائل",
  "45": "كتاب فضائل أصحاب النبي ﷺ",
  "46": "كتاب مناقب الأنصار",
  "47": "كتاب المغازي وسيرة النبي ﷺ",
  "48": "كتاب التفسير وتفسير القرآن",
  "49": "كتاب فضائل القرآن الشريف",
  "50": "كتاب النكاح والزواج",
  "51": "كتاب الطلاق والخلع",
  "52": "كتاب النفقات والرضاع",
  "53": "كتاب الأطعمة والضيافة",
  "54": "كتاب العقيقة والذبائح",
  "55": "كتاب الصيد والذبح",
  "56": "كتاب الأضاحي والأشربة",
  "57": "كتاب المرضى والطب",
  "58": "كتاب اللباس والزينة",
  "59": "كتاب الأدب والأخلاق",
  "60": "كتاب الاستئذان والسلام",
  "61": "كتاب الدعوات والأذكار",
  "62": "كتاب الرقاق والزهد",
  "63": "كتاب القدر والإيمان به",
  "64": "كتاب الأيمان والنذور",
  "65": "كتاب كفارات الأيمان",
  "66": "كتاب الفرائض والمواريث",
  "67": "كتاب الحدود والتعزيرات",
  "68": "كتاب الديات والدماء",
  "69": "كتاب استتابة المرتدين المعاندين",
  "70": "كتاب الإكراه والحيل",
  "71": "كتاب التعبير وتعبير الرؤيا",
  "72": "كتاب الفتن وأشراط الساعة",
  "73": "كتاب الأحكام والقضاء",
  "74": "كتاب الاعتصام بالكتاب والسنة",
  "75": "كتاب التوحيد والرد على الجهمية",
};

const MUSLIM_ARABIC_SECTIONS: Record<string, string> = {
  "0": "المقدمة والآثار العامة",
  "1": "كتاب الإيمان",
  "2": "كتاب الطهارة",
  "3": "كتاب الحيض",
  "4": "كتاب الصلاة",
  "5": "كتاب المساجد ومواضع الصلاة",
  "6": "كتاب صلاة المسافرين وقصرها",
  "7": "كتاب الجمعة",
  "8": "كتاب صلاة العيدين",
  "9": "كتاب الاستسقاء",
  "10": "كتاب الكسوف",
  "11": "كتاب الجنائز",
  "12": "كتاب الزكاة",
  "13": "كتاب الصيام",
  "14": "كتاب الاعتكاف",
  "15": "كتاب الحج",
  "16": "كتاب النكاح",
  "17": "كتاب الرضاع",
  "18": "كتاب الطلاق",
  "19": "كتاب اللعان",
  "20": "كتاب العتق",
  "21": "كتاب البيوع",
  "22": "كتاب المساقاة والمزارعة",
  "23": "كتاب الفرائض",
  "24": "كتاب الهبات",
  "25": "كتاب الوصية",
  "26": "كتاب النذر",
  "27": "كتاب الأيمان",
  "28": "كتاب القسامة والمحاربين والقصاص والديات",
  "29": "كتاب الحدود",
  "30": "كتاب الأقضية",
  "31": "كتاب اللقطة",
  "32": "كتاب الجهاد والسير",
  "33": "كتاب الإمارة",
  "34": "كتاب الصيد والذبائح وما يؤكل من الحيوان",
  "35": "كتاب الأضاحي",
  "36": "كتاب الأشربة",
  "37": "كتاب اللباس والزينة",
  "38": "كتاب الأدب",
  "39": "كتاب السلام",
  "40": "كتاب الألفاظ من الأدب وغيرها",
  "41": "كتاب الشعر",
  "42": "كتاب الرؤيا",
  "43": "كتاب الفضائل",
  "44": "كتاب فضائل الصحابة رضي الله عنهم",
  "45": "كتاب البر والصلة والآداب",
  "46": "كتاب القدر",
  "47": "كتاب العلم",
  "48": "كتاب الذكر والدعاء والتوبة والاستغفار",
  "49": "كتاب الرقاق",
  "50": "كتاب التوبة",
  "51": "كتاب صفات المنافقين وأحكامهم",
  "52": "كتاب صفة القيامة والجنة والنار",
  "53": "كتاب الجنة وصفة نعيمها وأهلها",
  "54": "كتاب الفتن وأشراط الساعة",
  "55": "كتاب الزهد والرقائق",
  "56": "كتاب التفسير"
};

const ENGLISH_WORD_MAP: [RegExp, string][] = [
  [/rain|istisqa/i, "كتاب الاستسقاء"],
  [/eclipse/i, "كتاب الكسوف"],
  [/funeral|jana'iz|janaiz/i, "كتاب الجنائز"],
  [/friday|jumu/i, "كتاب الجمعة"],
  [/eids|festival/i, "كتاب صلاة العيدين"],
  [/travel|journey|musafir/i, "كتاب صلاة المسافرين وقصرها"],
  [/mosque|masjid/i, "كتاب المساجد ومواضع الصلاة"],
  [/witr/i, "كتاب الوتر والتطوع"],
  [/prostration/i, "كتاب سجود القرآن"],
  [/shorten|shortening/i, "كتاب تقصير الصلاة"],
  [/forgetfulness|sahw/i, "كتاب السهو في الصلاة"],
  [/times of prayer|prayer times/i, "كتاب مواقيت الصلاة"],
  [/suckling|rada/i, "كتاب الرضاع"],
  [/divorce/i, "كتاب الطلاق"],
  [/marriage|nikah/i, "كتاب النكاح"],
  [/curse|li'an|lian/i, "كتاب اللعان"],
  [/emancipat|slave|itq/i, "كتاب العتق"],
  [/gift|hiba/i, "كتاب الهبة والعطية"],
  [/will|wasaya|wasiyya/i, "كتاب الوصايا"],
  [/vow|nadhr|nadr/i, "كتاب النذر"],
  [/inheritance|farai'd|faraid/i, "كتاب الفرائض والمواريث"],
  [/musaqah|musaqat/i, "كتاب المساقاة والمزارعة"],
  [/lost property|luqata/i, "كتاب اللقطة"],
  [/sale|trade|business|transaction/i, "كتاب البيوع والمعاملات"],
  [/government|imara|emirate/i, "كتاب الإمارة"],
  [/jihad|expedition|campaign/i, "كتاب الجهاد والسير"],
  [/judicial|judgment|decision|aqdiya/i, "كتاب الأحكام والقضاء"],
  [/punishment|hudood|hudud/i, "كتاب الحدود والتعزيرات"],
  [/oath/i, "كتاب الأيمان والنذور"],
  [/blood money|retaliation|qasama|qasas|diyat/i, "كتاب القسامة والقصاص والديات"],
  [/pilgrimage|hajj/i, "كتاب الحج والعمرة"],
  [/fasting|sawm|ramadan/i, "كتاب الصيام"],
  [/zakat|alms/i, "كتاب الزكاة"],
  [/purification|purity|taharah/i, "كتاب الطهارة والوضوء"],
  [/ablution/i, "كتاب الوضوء"],
  [/bathing|ghusl/i, "كتاب الغسل"],
  [/menses|menstrual|menstruation/i, "كتاب الحيض والنفاس"],
  [/tayammum/i, "كتاب التيمم"],
  [/hunting|slaughter/i, "كتاب الصيد والذبائح"],
  [/sacrifice|dahiyya|udhiya/i, "كتاب الأضاحي"],
  [/drink/i, "كتاب الأشربة"],
  [/food|meal/i, "كتاب الأطعمة"],
  [/belief|faith|iman/i, "كتاب الإيمان"],
  [/revelation/i, "كتاب بدء الوحي"],
  [/knowledge|ilm/i, "كتاب العلم"],
  [/virtue|merit|fada'il|fadail/i, "كتاب الفضائل والمناقب"],
  [/companion|sahaba/i, "كتاب فضائل الصحابة"],
  [/tafsir|commentary/i, "كتاب التفسير"],
  [/quran/i, "كتاب فضائل القرآن"],
  [/poetry|sh'ir/i, "كتاب الشعر"],
  [/dream|ru'ya|ruya/i, "كتاب الرؤيا"],
  [/correct words|al-alfadh/i, "كتاب الألفاظ من الأدب وغيرها"],
  [/manner|etiquette|adab/i, "كتاب الأدب والأخلاق"],
  [/greeting|peace|salam/i, "كتاب السلام والاستئذان"],
  [/destiny|fate|qadr/i, "كتاب القدر"],
  [/remembrance|supplication|repentance|dhikr/i, "كتاب الذكر والدعاء والتوبة والاستغفار"],
  [/heart-melting|riqaq/i, "كتاب الرقاق والزهد"],
  [/hypocrite/i, "كتاب صفات المنافقين وأحكامهم"],
  [/tribulation|affliction|fitna|fitan/i, "كتاب الفتن وأشراط الساعة"],
  [/zuhd/i, "كتاب الزهد والرقائق"],
  [/creation/i, "كتاب بدء الخلق"],
  [/prophet/i, "كتاب أحاديث الأنبياء"],
  [/prayer|salat/i, "كتاب الصلاة"],
  [/sunnah/i, "كتاب السنة"],
];

function formatArabicChapterTitle(sectionNum: string, rawTitle?: string, bookId?: string): string {
  if (bookId === "muslim" && MUSLIM_ARABIC_SECTIONS[sectionNum]) {
    return MUSLIM_ARABIC_SECTIONS[sectionNum];
  }

  if (!rawTitle || !rawTitle.trim()) {
    if (bookId === "bukhari") {
      return COMMON_ARABIC_SECTIONS[sectionNum] || `كتاب رقم ${sectionNum}`;
    }
    return `كتاب رقم ${sectionNum}`;
  }

  const trimmed = rawTitle.trim();

  if (/^\d+$/.test(trimmed)) {
    if (bookId === "bukhari") {
      return COMMON_ARABIC_SECTIONS[trimmed] || COMMON_ARABIC_SECTIONS[sectionNum] || `كتاب رقم ${trimmed}`;
    }
    return `كتاب رقم ${trimmed}`;
  }

  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed;
  }

  for (const [pattern, arTitle] of ENGLISH_WORD_MAP) {
    if (pattern.test(trimmed)) {
      return arTitle;
    }
  }

  if (bookId === "bukhari" && COMMON_ARABIC_SECTIONS[sectionNum]) {
    return COMMON_ARABIC_SECTIONS[sectionNum];
  }

  return `كتاب رقم ${sectionNum}`;
}

// Expand a query string to a comprehensive set of search keywords (including stems and synonyms)
export function expandQuery(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(w => w.length > 1);
  const expanded = new Set<string>();

  for (const word of words) {
    const normalized = normalizeArabic(word);
    if (!normalized) continue;

    expanded.add(normalized);

    // Add stems
    const stems = extractArabicStems(word);
    stems.forEach(s => expanded.add(s));

    // Add synonyms/semantic terms
    for (const [key, list] of Object.entries(SEMANTIC_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        list.forEach(item => expanded.add(normalizeArabic(item)));
      }
    }
  }

  return Array.from(expanded);
}

export const HadithOfflineSearchService = {
  hadithBooksStore,
  searchMetaStore,
  normalizeArabic,

  // Checks if a book is downloaded locally
  async isBookDownloaded(bookId: string): Promise<boolean> {
    const data = await hadithBooksStore.getItem(bookId);
    return data !== null;
  },

  // Returns download stats
  async getDownloadStats(books: HadithBookInfo[]): Promise<Record<string, boolean>> {
    const stats: Record<string, boolean> = {};
    for (const b of books) {
      stats[b.id] = await this.isBookDownloaded(b.id);
    }
    return stats;
  },

  // Download and index a book dataset completely offline
  async downloadAndIndexBook(
    book: HadithBookInfo,
    onProgress: (percent: number, status: string) => void
  ): Promise<void> {
    onProgress(10, `جاري الاتصال لتحميل ${book.titleArabic}...`);

    const urls = [
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book.editionSlug}.json`,
      `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${book.editionSlug}.json`,
      `/api/hadith/book/${book.id}` // Fallback server route
    ];

    let rawDataStr = "";
    let error: any = null;

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resp.ok) {
          rawDataStr = await resp.text();
          break;
        }
      } catch (err) {
        error = err;
      }
    }

    if (!rawDataStr) {
      throw new Error(`تعذر تحميل بيانات ${book.titleArabic}. الرجاء التحقق من جودة الاتصال بالإنترنت.`);
    }

    onProgress(50, `جاري معالجة وتكشيف الأحاديث في ${book.titleArabic}...`);

    const jsonParsed = JSON.parse(rawDataStr);
    const metadata = jsonParsed.metadata || {};
    const sectionMap: Record<string, string> = metadata.sections || metadata.section || {};
    const rawHadithsList = jsonParsed.hadiths || [];

    // Map into standard HadithItems with normalization cache fields for superfast offline search
    const hadiths: (HadithItem & { normalizedText: string; normalizedChapter: string })[] = rawHadithsList.map((h: any) => {
      const sectionNum = h.reference?.book?.toString() || "0";
      const rawSectionTitle = sectionMap[sectionNum] || "";

      // Map chapter title using the classical Arabic translation engine
      const chapterTitle = formatArabicChapterTitle(sectionNum, rawSectionTitle, book.id);

      // Determine grade
      let gradeStr: string | undefined = undefined;
      if (Array.isArray(h.grades) && h.grades.length > 0) {
        const topGrade = h.grades.find((g: any) =>
          g.grade?.includes("Sahih") || g.grade?.includes("Hasan") || g.grade?.includes("صحيح") || g.grade?.includes("حسن")
        );
        if (topGrade) {
          gradeStr = topGrade.grade;
        } else if (h.grades[0]?.grade) {
          gradeStr = h.grades[0].grade;
        }
      } else if (book.id === "bukhari" || book.id === "muslim") {
        gradeStr = "صحيح";
      }

      const rawText = h.text || "";

      return {
        bookId: book.id,
        bookTitle: book.titleArabic,
        hadithnumber: h.hadithnumber || h.arabicnumber,
        arabicnumber: h.arabicnumber || h.hadithnumber,
        chapterId: sectionNum,
        chapterTitle: chapterTitle,
        text: rawText,
        grade: gradeStr,
        reference: h.reference,
        normalizedText: normalizeArabic(rawText),
        normalizedChapter: normalizeArabic(chapterTitle)
      };
    });

    onProgress(85, `جاري حفظ ${hadiths.length} حديثًا أوفلاين في الذاكرة المحلية...`);

    // Save to IndexedDB
    await hadithBooksStore.setItem(book.id, {
      bookId: book.id,
      title: book.titleArabic,
      hadithsCount: hadiths.length,
      hadiths
    });

    await searchMetaStore.setItem(`updated_${book.id}`, Date.now());

    onProgress(100, `تمت فهرسة وحفظ ${book.titleArabic} أوفلاين بنجاح!`);
  },

  // Performs advanced full-text offline search across downloaded books
  async searchOffline(
    query: string,
    bookId: string = "all"
  ): Promise<HadithItem[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const normQuery = normalizeArabic(trimmedQuery);
    const queryKeywords = expandQuery(trimmedQuery);
    const queryNum = parseInt(trimmedQuery, 10);

    // Get list of books to search in
    const cachedKeys = await hadithBooksStore.keys();
    const targetKeys = bookId === "all"
      ? cachedKeys
      : cachedKeys.filter(k => k === bookId);

    if (targetKeys.length === 0) {
      return [];
    }

    interface ScoredHadith {
      hadith: HadithItem;
      score: number;
    }

    const scoredResults: ScoredHadith[] = [];

    for (const key of targetKeys) {
      const bookData = await hadithBooksStore.getItem<{
        bookId: string;
        title: string;
        hadiths: (HadithItem & { normalizedText: string; normalizedChapter: string })[];
      }>(key);

      if (!bookData || !bookData.hadiths) continue;

      for (const h of bookData.hadiths) {
        let score = 0;

        // 1. Direct Number Match (Max relevance if searching by Hadith number)
        const hNumStr = h.hadithnumber?.toString().trim() || "";
        if (!isNaN(queryNum) && (hNumStr === queryNum.toString() || hNumStr === trimmedQuery || hNumStr.startsWith(queryNum.toString() + "."))) {
          score += 1500;
        }

        const normText = h.normalizedText;
        const normChapter = h.normalizedChapter;

        // 2. Exact Phrase Match in normalized text
        if (normText.includes(normQuery)) {
          score += 1000;

          // Boost if exact phrase is at the beginning (e.g. standard start of a known Hadith)
          if (normText.startsWith(normQuery)) {
            score += 200;
          }
        }

        // 3. Exact Phrase Match in normalized chapter title
        if (normChapter.includes(normQuery)) {
          score += 300;
        }

        // 4. Keyword and Synonym Matching (with weights)
        let matchesCount = 0;
        let chapterMatchesCount = 0;

        for (const kw of queryKeywords) {
          if (normText.includes(kw)) {
            matchesCount++;
            score += 40; // Add points per matching keyword
          }
          if (normChapter.includes(kw)) {
            chapterMatchesCount++;
            score += 15;
          }
        }

        // 5. Keyword proximity and coverage boost
        if (matchesCount > 1) {
          const coveragePercent = matchesCount / queryKeywords.length;
          score += Math.floor(coveragePercent * 250); // Massive boost for matching more words
        }

        // 6. Reliability / Grade Boost
        if (h.grade) {
          const normGrade = h.grade.toLowerCase();
          if (normGrade.includes("صحيح") || normGrade.includes("sahih")) {
            score += 15;
          } else if (normGrade.includes("حسن") || normGrade.includes("hasan")) {
            score += 5;
          }
        }

        if (score > 0) {
          scoredResults.push({
            hadith: {
              bookId: h.bookId,
              bookTitle: h.bookTitle,
              hadithnumber: h.hadithnumber,
              arabicnumber: h.arabicnumber,
              chapterId: h.chapterId,
              chapterTitle: h.chapterTitle,
              text: h.text,
              grade: h.grade,
              reference: h.reference
            },
            score
          });
        }
      }
    }

    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);

    // Return the top 100 scored hadiths for optimal client performance
    return scoredResults.slice(0, 100).map(r => r.hadith);
  },

  // Clear all cached database datasets
  async clearCache(): Promise<void> {
    await Promise.all([
      hadithBooksStore.clear(),
      searchMetaStore.clear()
    ]);
  }
};
