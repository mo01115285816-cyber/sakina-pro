export interface HadithBookInfo {
  id: string; // e.g. 'bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'musnadahmad'
  titleArabic: string;
  authorArabic: string;
  authorDeath: string;
  hadithsCount: number;
  chaptersCount: number;
  description: string;
  category: "الكتب الستة" | "الموطآت والمسانيد" | "الأربعينيات والقدسيات";
  badgeColor: string; // Tailwind color class
  bgGradient: string;
  editionSlug: string; // fawazahmed edition key e.g. 'ara-bukhari'
  coverImage?: string; // Optional author/book background art
}

export interface HadithChapter {
  id: string; // section number string e.g. "1"
  number: number;
  title: string;
  hadithCount?: number;
}

export interface HadithItem {
  bookId: string;
  bookTitle: string;
  hadithnumber: number;
  arabicnumber?: number | string;
  chapterId: string;
  chapterTitle: string;
  text: string;
  textAvailable?: boolean;
  grade?: string; // e.g. "صحيح", "حسن", "ضعيف"
  reference?: {
    book?: number;
    hadith?: number;
  };
}

export interface HadithBookmark {
  id: string; // `${bookId}_${hadithnumber}`
  bookId: string;
  bookTitle: string;
  hadithnumber: number;
  chapterTitle: string;
  textSnippet: string;
  savedAt: number;
}

export interface HadithSearchResponse {
  query: string;
  bookId?: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  results: HadithItem[];
}

export interface HadithListResponse {
  bookId: string;
  bookTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hadiths: HadithItem[];
}
