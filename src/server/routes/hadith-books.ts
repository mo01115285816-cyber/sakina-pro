import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import type { HadithBookInfo, HadithChapter, HadithItem } from "../../types/hadith.types";

const router = express.Router();

// Cache directory for downloaded Hadith datasets
const CACHE_DIR = path.join(process.cwd(), "node_modules", ".cache", "hadith-books");
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {
    console.warn("Could not create cache directory:", e);
  }
}

// In-memory cache for parsed datasets
const memoryCache = new Map<string, { metadata: any; hadiths: HadithItem[] }>();

// Definition of Kutub al-Sittah + Muwatta + Musnad
export const HADITH_BOOKS: HadithBookInfo[] = [
  {
    id: "bukhari",
    titleArabic: "صحيح البخاري",
    authorArabic: "الإمام محمد بن إسماعيل البخاري",
    authorDeath: "256 هـ",
    hadithsCount: 7563,
    chaptersCount: 97,
    description: "أصح كتاب بعد كتاب الله تعالى، جمع فيه الإمام البخاري الأحاديث الصحيحة المسندة عن رسول الله ﷺ.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-bukhari",
    coverImage: "/images/hadith/author_bukhari.webp",
  },
  {
    id: "muslim",
    titleArabic: "صحيح مسلم",
    authorArabic: "الإمام مسلم بن الحجاج النيسابوري",
    authorDeath: "261 هـ",
    hadithsCount: 7563,
    chaptersCount: 57,
    description: "ثاني أصح كتب الحديث الشريف، امتاز بحسن الترتيب والصياغة والاستيعاب للطرق والأسانيد.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-muslim",
    coverImage: "/images/hadith/author_muslim.webp",
  },
  {
    id: "abudawud",
    titleArabic: "سنن أبي داود",
    authorArabic: "الإمام أبو داود سليمان بن الأشعث السجستاني",
    authorDeath: "275 هـ",
    hadithsCount: 5274,
    chaptersCount: 44,
    description: "أحد أهم السنن الأربعة، ركز فيه مصنفه على أحاديث الأحكام والسنن الفقهية المرفوعة.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-abudawud",
    coverImage: "/images/hadith/author_abudawud.png",
  },
  {
    id: "tirmidhi",
    titleArabic: "جامع الترمذي",
    authorArabic: "الإمام أبو عيسى محمد بن عيسى الترمذي",
    authorDeath: "279 هـ",
    hadithsCount: 3998,
    chaptersCount: 50,
    description: "معروف بالجامع والسنن، تميز بذكر مذاهب الفقهاء وبيان درجات الأحاديث من الصحة والحسن والضعف.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-tirmidhi",
    coverImage: "/images/hadith/author_tirmidhi.png",
  },
  {
    id: "nasai",
    titleArabic: "سنن النسائي (المجتبى)",
    authorArabic: "الإمام أحمد بن شعيب النسائي",
    authorDeath: "303 هـ",
    hadithsCount: 5765,
    chaptersCount: 52,
    description: "أشد السنن انتقاءً للرجال وأقلها حديثاً ضعيفاً بعد الصحيحين، اشتمل على الدقائق الفقهية والعلل.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-nasai",
    coverImage: "/images/hadith/author_nasai.png",
  },
  {
    id: "ibnmajah",
    titleArabic: "سنن ابن ماجه",
    authorArabic: "الإمام أبو عبد الله محمد بن يزيد ابن ماجه",
    authorDeath: "273 هـ",
    hadithsCount: 4343,
    chaptersCount: 38,
    description: "خاتم الكتب الستة، امتاز بحسن التبويب وكثرة زوائده على الأمهات الخمس من الأحاديث والسنن.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-ibnmajah",
    coverImage: "/images/hadith/author_ibnmajah.png",
  },
  {
    id: "malik",
    titleArabic: "موطأ الإمام مالك",
    authorArabic: "الإمام مالك بن أنس الأصبحي",
    authorDeath: "179 هـ",
    hadithsCount: 1858,
    chaptersCount: 62,
    description: "أقدم مدونة حديثية وفقهية جامعة وصلتنا بحالة ممتازة، من أصح الآثار والسنن عن دار الهجرة.",
    category: "الموطآت والمسانيد",
    badgeColor: "bg-[#2b1a10]/12 text-[#2b1a10] border-[#2b1a10]/25",
    bgGradient: "from-[#2b1a10]/10 via-[#2b1a10]/5 to-transparent",
    editionSlug: "ara-malik",
    coverImage: "/images/hadith/author_malik.png",
  },
  {
    id: "nawawi",
    titleArabic: "الأربعون النووية",
    authorArabic: "الإمام يحيى بن شرف النووي",
    authorDeath: "676 هـ",
    hadithsCount: 42,
    chaptersCount: 2,
    description: "مجموعة جوامع كلم النبي ﷺ ومباني الإسلام والأحكام التي عليها مدار الدين.",
    category: "الأربعينيات والقدسيات",
    badgeColor: "bg-amber-950/15 text-amber-900 border-amber-800/30",
    bgGradient: "from-amber-900/10 via-amber-800/5 to-transparent",
    editionSlug: "ara-nawawi",
    coverImage: "/images/hadith/author_nawawi.png",
  },
  {
    id: "qudsi",
    titleArabic: "الأحاديث القدسية",
    authorArabic: "مجموعة من الأئمة الحفاظ",
    authorDeath: "متنوع",
    hadithsCount: 40,
    chaptersCount: 2,
    description: "الأحاديث التي يرويها النبي ﷺ عن ربه عز وجل بألفاظ جامعة معظمة ترقق القلوب.",
    category: "الأربعينيات والقدسيات",
    badgeColor: "bg-amber-950/15 text-amber-900 border-amber-800/30",
    bgGradient: "from-amber-900/10 via-amber-800/5 to-transparent",
    editionSlug: "ara-qudsi",
    coverImage: "/images/hadith/author_qudsiyyah.png",
  },
];

// ----------------------------------------------------------------------------
// ARABIC CHAPTER TRANSLATION HELPERS
// ----------------------------------------------------------------------------
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
  // 1. Highly specific sub-prayer books (must be checked BEFORE generic prayer)
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

  // 2. Family and social laws
  [/suckling|rada/i, "كتاب الرضاع"],
  [/divorce/i, "كتاب الطلاق"],
  [/marriage|nikah/i, "كتاب النكاح"],
  [/curse|li'an|lian/i, "كتاب اللعان"],
  [/emancipat|slave|itq/i, "كتاب العتق"],
  [/gift|hiba/i, "كتاب الهبة والعطية"],
  [/will|wasaya|wasiyya/i, "كتاب الوصايا"],
  [/vow|nadhr|nadr/i, "كتاب النذر"],
  [/inheritance|farai'd|faraid/i, "كتاب الفرائض والمواريث"],

  // 3. Transactions and commercial laws
  [/musaqah|musaqat/i, "كتاب المساقاة والمزارعة"],
  [/lost property|luqata/i, "كتاب اللقطة"],
  [/sale|trade|business|transaction/i, "كتاب البيوع والمعاملات"],

  // 4. State, justice, and community laws
  [/government|imara|emirate/i, "كتاب الإمارة"],
  [/jihad|expedition|campaign/i, "كتاب الجهاد والسير"],
  [/judicial|judgment|decision|aqdiya/i, "كتاب الأحكام والقضاء"],
  [/punishment|hudood|hudud/i, "كتاب الحدود والتعزيرات"],
  [/oath/i, "كتاب الأيمان والنذور"],
  [/blood money|retaliation|qasama|qasas|diyat/i, "كتاب القسامة والقصاص والديات"],

  // 5. Rituals and food
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

  // 6. Belief, heart, and ethics
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

  // 7. Generic / Fallbacks (lowest priority)
  [/prayer|salat/i, "كتاب الصلاة"],
  [/sunnah/i, "كتاب السنة"],
];

function formatArabicChapterTitle(sectionNum: string, rawTitle?: string, bookId?: string): string {
  // If book is Sahih Muslim, use the 100% correct dedicated map
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

  // If title is purely a number (e.g. "1", "2")
  if (/^\d+$/.test(trimmed)) {
    if (bookId === "bukhari") {
      return COMMON_ARABIC_SECTIONS[trimmed] || COMMON_ARABIC_SECTIONS[sectionNum] || `كتاب رقم ${trimmed}`;
    }
    return `كتاب رقم ${trimmed}`;
  }

  // Check if title contains Arabic characters
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed;
  }

  // Check English keywords map
  for (const [pattern, arTitle] of ENGLISH_WORD_MAP) {
    if (pattern.test(trimmed)) {
      return arTitle;
    }
  }

  // Check numeric map only for Bukhari as a fallback
  if (bookId === "bukhari" && COMMON_ARABIC_SECTIONS[sectionNum]) {
    return COMMON_ARABIC_SECTIONS[sectionNum];
  }

  return `كتاب رقم ${sectionNum}`;
}

/**
 * Fetch dataset for a book (with memory and disk caching)
 */
async function getBookDataset(bookId: string): Promise<{ metadata: any; hadiths: HadithItem[] }> {
  const book = HADITH_BOOKS.find((b) => b.id === bookId);
  if (!book) {
    throw new Error(`كتاب غير موجود: ${bookId}`);
  }

  // 1. Check memory cache
  if (memoryCache.has(bookId)) {
    return memoryCache.get(bookId)!;
  }

  // 2. Check disk cache
  const cacheFilePath = path.join(CACHE_DIR, `${book.editionSlug}.json`);
  let rawDataStr = "";

  if (fs.existsSync(cacheFilePath)) {
    try {
      rawDataStr = fs.readFileSync(cacheFilePath, "utf-8");
      const cachedJson = JSON.parse(rawDataStr);
      if (!Array.isArray(cachedJson.hadiths) || cachedJson.hadiths.length !== book.hadithsCount) {
        rawDataStr = "";
      }
    } catch (e) {
      rawDataStr = "";
      console.warn(`Error reading cache file for ${bookId}:`, e);
    }
  }

  // 3. Download from authentic CDN API if not in disk cache
  if (!rawDataStr) {
    const urls = [
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book.editionSlug}.min.json`,
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book.editionSlug}.json`,
      `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${book.editionSlug}.min.json`,
      `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${book.editionSlug}.json`,
    ];

    let lastErr: any = null;
    for (const url of urls) {
      try {
        console.log(`Downloading dataset for ${book.titleArabic} from ${url}...`);
        const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (resp.ok) {
          rawDataStr = await resp.text();
          // Write to disk cache
          try {
            fs.writeFileSync(cacheFilePath, rawDataStr, "utf-8");
          } catch (e) {
            console.warn(`Failed writing cache for ${bookId}:`, e);
          }
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!rawDataStr) {
      throw new Error(`تعذر تحميل بيانات ${book.titleArabic}. يرجى التحقق من الاتصال بالإنترنت.`);
    }
  }

  // Parse JSON
  const jsonParsed = JSON.parse(rawDataStr);
  const metadata = jsonParsed.metadata || {};
  const sectionMap: Record<string, string> = metadata.sections || metadata.section || {};

  const rawHadithsList = Array.isArray(jsonParsed.hadiths) ? jsonParsed.hadiths : [];
  if (rawHadithsList.length === 0) {
    throw new Error(`ملف مصدر ${book.editionSlug} لا يحتوي على سجلات أحاديث صالحة.`);
  }

  // Transform into standardized HadithItem array without dropping source records.
  const hadiths: HadithItem[] = rawHadithsList.map((h: any, index: number) => {
    const sectionNum = h.reference?.book?.toString() || "0";
    const rawSectionTitle = sectionMap[sectionNum] || "";
    const sectionTitle = formatArabicChapterTitle(sectionNum, rawSectionTitle, bookId);
    const rawHadithNumber = h.hadithnumber ?? h.arabicnumber;
    const parsedHadithNumber = Number(rawHadithNumber);
    const hadithnumber = Number.isFinite(parsedHadithNumber) ? parsedHadithNumber : index + 1;
    const rawArabicNumber = h.arabicnumber ?? h.hadithnumber ?? hadithnumber;
    const arabicnumber = typeof rawArabicNumber === "string" && rawArabicNumber.trim()
      ? rawArabicNumber.trim()
      : Number(rawArabicNumber);

    let gradeStr: string | undefined = undefined;
    if (Array.isArray(h.grades) && h.grades.length > 0) {
      const topGrade = h.grades.find((g: any) => g.grade?.includes("Sahih") || g.grade?.includes("Hasan") || g.grade?.includes("صحيح") || g.grade?.includes("حسن"));
      if (topGrade) {
        gradeStr = topGrade.grade;
      } else if (h.grades[0]?.grade) {
        gradeStr = h.grades[0].grade;
      }
    } else if (bookId === "bukhari" || bookId === "muslim") {
      gradeStr = "صحيح";
    }

    const text = typeof h.text === "string" ? h.text : "";
    return {
      bookId: book.id,
      bookTitle: book.titleArabic,
      hadithnumber,
      arabicnumber,
      chapterId: sectionNum,
      chapterTitle: sectionTitle,
      text,
      textAvailable: text.trim().length > 0,
      grade: gradeStr,
      reference: h.reference,
    };
  });

  const dataset = { metadata, hadiths };
  memoryCache.set(bookId, dataset);
  return dataset;
}

// ----------------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------------

/**
 * GET /api/hadith/books
 * Get list of all available Hadith books metadata
 */
router.get("/books", (_req: Request, res: Response) => {
  res.json({
    success: true,
    books: HADITH_BOOKS,
  });
});

/**
 * GET /api/hadith/book/:bookId
 * Get book info and list of chapters
 */
router.get("/book/:bookId", async (req: Request, res: Response) => {
  try {
    const bookId = String(req.params.bookId);
    const book = HADITH_BOOKS.find((b) => b.id === bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: "الكتاب غير موجود" });
    }

    const dataset = await getBookDataset(bookId);
    const sections: Record<string, string> = dataset.metadata.sections || dataset.metadata.section || {};

    let chapters: HadithChapter[] = Object.entries(sections).map(([numStr, title]) => {
      const num = parseInt(numStr, 10) || 0;
      // Count how many hadiths belong to this chapter
      const count = dataset.hadiths.filter((h) => h.chapterId === numStr).length;
      return {
        id: numStr,
        number: num,
        title: formatArabicChapterTitle(numStr, title, bookId),
        hadithCount: count,
      };
    }).filter((c) => c.hadithCount > 0 || c.id === "0");

    // Fallback if metadata sections were not available
    if (chapters.length === 0 && dataset.hadiths.length > 0) {
      const chapterMap = new Map<string, { title: string; count: number }>();
      for (const h of dataset.hadiths) {
        const cid = h.chapterId || "0";
        const existing = chapterMap.get(cid);
        if (existing) {
          existing.count++;
        } else {
          chapterMap.set(cid, {
            title: h.chapterTitle || `باب رقم ${cid}`,
            count: 1,
          });
        }
      }
      chapters = Array.from(chapterMap.entries()).map(([cid, info]) => ({
        id: cid,
        number: parseInt(cid, 10) || 0,
        title: info.title,
        hadithCount: info.count,
      }));
    }

    chapters.sort((a, b) => a.number - b.number);

    res.json({
      success: true,
      book,
      chapters,
      totalHadiths: dataset.hadiths.length,
    });
  } catch (error: any) {
    console.error("Error fetching book info:", error);
    res.status(500).json({ success: false, error: error.message || "حدث خطأ أثناء جلب بيانات الكتاب" });
  }
});

/**
 * GET /api/hadith/book/:bookId/hadiths
 * Paginated hadiths from a book with optional chapter & search filters
 */
router.get("/book/:bookId/hadiths", async (req: Request, res: Response) => {
  try {
    const bookId = String(req.params.bookId);
    const book = HADITH_BOOKS.find((b) => b.id === bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: "الكتاب غير موجود" });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const chapterId = String(req.query.chapter || "all");
    const searchQuery = String(req.query.search || "").trim();

    const dataset = await getBookDataset(bookId);
    let filtered = dataset.hadiths;

    // Filter by chapter
    if (chapterId && chapterId !== "all") {
      filtered = filtered.filter((h) => h.chapterId === chapterId);
    }

    // Filter by search text
    if (searchQuery) {
      const qLower = searchQuery.toLowerCase();
      filtered = filtered.filter((h) =>
        h.text.toLowerCase().includes(qLower) ||
        h.hadithnumber.toString() === searchQuery ||
        h.chapterTitle.toLowerCase().includes(qLower)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedHadiths = filtered.slice(startIndex, startIndex + limit);

    // Chapter title
    let chapterTitle = "جميع الأبواب";
    const sectionMap: Record<string, string> = dataset.metadata?.sections || dataset.metadata?.section || {};
    if (chapterId && sectionMap[chapterId]) {
      chapterTitle = formatArabicChapterTitle(chapterId, sectionMap[chapterId], bookId);
    }

    res.json({
      success: true,
      bookId,
      bookTitle: book.titleArabic,
      chapterId: chapterId || "all",
      chapterTitle,
      total,
      page,
      limit,
      totalPages,
      hadiths: paginatedHadiths,
    });
  } catch (error: any) {
    console.error("Error fetching hadiths:", error);
    res.status(500).json({ success: false, error: error.message || "حدث خطأ أثناء تحميل الأحاديث" });
  }
});

/**
 * GET /api/hadith/book/:bookId/hadith/:hadithNum
 * Get single hadith details
 */
router.get("/book/:bookId/hadith/:hadithNum", async (req: Request, res: Response) => {
  try {
    const bookId = String(req.params.bookId);
    const hadithNumStr = String(req.params.hadithNum);
    const num = parseInt(hadithNumStr, 10);

    const dataset = await getBookDataset(bookId);
    const hadith = dataset.hadiths.find((h) => h.hadithnumber === num);

    if (!hadith) {
      return res.status(404).json({ success: false, error: "الحديث غير موجود" });
    }

    res.json({
      success: true,
      hadith,
      nextHadithNumber: num < dataset.hadiths.length ? num + 1 : null,
      prevHadithNumber: num > 1 ? num - 1 : null,
    });
  } catch (error: any) {
    console.error("Error fetching single hadith:", error);
    res.status(500).json({ success: false, error: error.message || "حدث خطأ أثناء جلب الحديث" });
  }
});

/**
 * Arabic NLP Search Helpers (Server-side)
 */
function srvStripDiacritics(text: string): string {
  if (!text) return "";
  return text.replace(/[\u064B-\u065F\u0670]/g, "");
}

function srvNormalizeArabic(text: string): string {
  if (!text) return "";
  let normalized = srvStripDiacritics(text);
  normalized = normalized.replace(/ـ/g, ""); // strip tatweel
  normalized = normalized.replace(/[أإآ]/g, "ا");
  normalized = normalized.replace(/ة/g, "ه");
  normalized = normalized.replace(/[ىي]/g, "ي");
  normalized = normalized.replace(/[ؤئ]/g, "ء");
  return normalized;
}

function srvExtractArabicStems(word: string): string[] {
  const normalized = srvNormalizeArabic(word);
  if (normalized.length <= 2) return [normalized];

  const stems = new Set<string>([normalized]);
  const prefixes = ["ال", "وال", "فال", "بال", "لل", "و", "ف", "ب", "ك", "ل"];
  for (const pref of prefixes) {
    if (normalized.startsWith(pref) && normalized.length - pref.length > 2) {
      stems.add(normalized.substring(pref.length));
    }
  }

  const suffixes = ["ون", "ين", "ات", "هما", "هما", "هم", "هن", "ها", "ه", "نا", "كم", "كما", "كن", "ت", "تم"];
  for (const suff of suffixes) {
    if (normalized.endsWith(suff) && normalized.length - suff.length > 2) {
      stems.add(normalized.substring(0, normalized.length - suff.length));
    }
  }

  return Array.from(stems);
}

const srvSEMANTIC_MAP: Record<string, string[]> = {
  "غضب": ["غضب", "يغضب", "تغضب", "غضبان", "الغضب", "حلم", "كظم"],
  "صلاه": ["صلاه", "يصلي", "تصلوا", "الصلوات", "صليت", "ركوع", "سجود", "تشهد", "ركعه"],
  "صوم": ["صام", "يصوم", "صيام", "رمضان", "الصائمين", "الصوم", "سحور", "افطار"],
  "ظلم": ["ظلم", "يظلم", "مظلوم", "الظالمين", "تظالموا", "الظلم", "جور"],
  "نساء": ["نساء", "امراه", "زوجه", "بنت", "فتيات", "النساء", "زوجات", "ام", "اخوات", "بنات"],
  "صدق": ["يصدق", "صدق", "صادق", "الصادقين", "الصدق", "امانه"],
  "بر": ["بر", "الوالدين", "امي", "ابي", "الاب", "الام", "احسان", "صلة"],
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
  "حج": ["حج", "عمره", "احرام", "طواف", "سعي", "عرافات", "منى", "مزدلفه"]
};

function srvExpandQuery(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(w => w.length > 1);
  const expanded = new Set<string>();

  for (const word of words) {
    const normalized = srvNormalizeArabic(word);
    if (!normalized) continue;

    expanded.add(normalized);

    const stems = srvExtractArabicStems(word);
    stems.forEach(s => expanded.add(s));

    for (const [key, list] of Object.entries(srvSEMANTIC_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        list.forEach(item => expanded.add(srvNormalizeArabic(item)));
      }
    }
  }

  return Array.from(expanded);
}

/**
 * GET /api/hadith/search
 * Search across all books or a specific book
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.json({ success: true, total: 0, results: [] });
    }

    const bookId = String(req.query.book || "all");
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "40"), 10) || 40));

    const targetBooks = bookId && bookId !== "all"
      ? HADITH_BOOKS.filter((b) => b.id === bookId)
      : HADITH_BOOKS.slice(0, 9); // Search across all available books in library

    const normQuery = srvNormalizeArabic(query);
    const queryKeywords = srvExpandQuery(query);
    const queryNum = parseInt(query, 10);

    interface SrvScoredHadith {
      hadith: HadithItem;
      score: number;
    }

    const scoredResults: SrvScoredHadith[] = [];

    for (const b of targetBooks) {
      try {
        const dataset = await getBookDataset(b.id);
        const hadithsList = dataset.hadiths || [];

        for (const h of hadithsList) {
          let score = 0;

          // 1. Direct Number Match
          const hNumStr = h.hadithnumber?.toString().trim() || "";
          if (!isNaN(queryNum) && (hNumStr === queryNum.toString() || hNumStr === query.trim() || hNumStr.startsWith(queryNum.toString() + "."))) {
            score += 1500;
          }

          const rawText = h.text || "";
          const normText = srvNormalizeArabic(rawText);
          const rawChapter = h.chapterTitle || "";
          const normChapter = srvNormalizeArabic(rawChapter);

          // 2. Exact Phrase Match in text
          if (normText.includes(normQuery)) {
            score += 1000;
            if (normText.startsWith(normQuery)) {
              score += 200;
            }
          }

          // 3. Exact Phrase Match in chapter title
          if (normChapter.includes(normQuery)) {
            score += 300;
          }

          // 4. Keyword and Synonym Matching
          let matchesCount = 0;
          let chapterMatchesCount = 0;

          for (const kw of queryKeywords) {
            if (normText.includes(kw)) {
              matchesCount++;
              score += 40;
            }
            if (normChapter.includes(kw)) {
              chapterMatchesCount++;
              score += 15;
            }
          }

          // 5. Keyword proximity/coverage boost
          if (matchesCount > 1) {
            const coveragePercent = matchesCount / queryKeywords.length;
            score += Math.floor(coveragePercent * 250);
          }

          // 6. Reliability / Book Type / Grade Boost
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
                bookId: b.id,
                bookTitle: b.titleArabic,
                hadithnumber: h.hadithnumber,
                arabicnumber: h.arabicnumber,
                chapterId: h.chapterId,
                chapterTitle: h.chapterTitle,
                text: rawText,
                grade: h.grade,
                reference: h.reference
              },
              score
            });
          }
        }
      } catch (err) {
        console.warn(`Search error in book ${b.id}:`, err);
      }
    }

    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);

    const total = scoredResults.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedResults = scoredResults
      .slice(startIndex, startIndex + limit)
      .map(r => r.hadith);

    res.json({
      success: true,
      query,
      bookId: bookId || "all",
      total,
      page,
      limit,
      totalPages,
      results: paginatedResults,
    });
  } catch (error: any) {
    console.error("Error performing Hadith search:", error);
    res.status(500).json({ success: false, error: error.message || "حدث خطأ أثناء البحث" });
  }
});


export default router;
