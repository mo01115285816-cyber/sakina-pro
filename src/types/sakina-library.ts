export type SakinaLibraryStatus =
  | "draft"
  | "review"
  | "published"
  | "unavailable"
  | "archived";

export type SakinaSourceProvider = "youtube";

export interface SakinaScholarSource {
  id: string;
  provider: SakinaSourceProvider;
  channelId: string;
  channelUrl: string;
  channelTitle: string;
  labelAr: string;
  descriptionAr: string;
  status: SakinaLibraryStatus;
  verifiedAt?: string;
}

export interface SakinaLessonSource {
  provider: SakinaSourceProvider;
  channelId: string;
  channelUrl: string;
  videoId: string;
  canonicalUrl: string;
  verifiedAt?: string;
}

export interface SakinaLessonItem {
  id: string;
  seriesId: string;
  scholarId: string;
  titleAr: string;
  descriptionShort?: string;
  episodeNumber?: number;
  sortOrder: number;
  durationSeconds?: number;
  thumbnailUrl?: string;
  source?: SakinaLessonSource;
  status: SakinaLibraryStatus;
}

export interface SakinaLessonSeries {
  id: string;
  scholarId: string;
  titleAr: string;
  description?: string;
  category?: string;
  coverUrl?: string;
  sortOrder: number;
  status: SakinaLibraryStatus;
  lessons: SakinaLessonItem[];
}

export interface SakinaScholar {
  id: string;
  slug: string;
  nameAr: string;
  displayName: string;
  photoUrl?: string;
  bioShort?: string;
  verificationStatus: "pending" | "verified" | "rejected" | "archived";
  verificationSourceUrl?: string;
  sources?: SakinaScholarSource[];
  series: SakinaLessonSeries[];
}

export interface SakinaLibraryCatalog {
  version: string;
  updatedAt?: string;
  scholars: SakinaScholar[];
}
