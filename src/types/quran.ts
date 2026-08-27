export interface Moshaf {
  id: number;
  name: string;
  server: string;
  surah_total: number;
  surah_list: string;
}

export interface Reciter {
  id: number;
  name: string;
  letter: string;
  photoUrl?: string;
  photo?: string;
  bioShort?: string;
  country?: string;
  countryFlag?: string;
  moshaf: Moshaf[];
}

export interface RecitersResponse {
  reciters: Reciter[];
}

export interface QuranWord {
  id: number;
  position: number;
  line_number: number;
  code_v2: string;
  char_type_name: 'word' | 'end';
  verse_key: string;
  page_number?: number;
}

export interface QuranVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  page_number: number;
  juz_number: number;
  hizb_number: number;
  chapter_id: number;
  text_uthmani: string;
  words: QuranWord[];
}
