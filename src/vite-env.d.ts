/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_CLARITY_WEB_PROJECT_ID?: string;
  readonly VITE_CLARITY_ANDROID_PROJECT_ID?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_CHANNEL?: "production" | "beta" | "internal";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}
