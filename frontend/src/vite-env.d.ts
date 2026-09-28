/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_DEFAULT_LAT?: string;
  readonly VITE_MAP_DEFAULT_LNG?: string;
  readonly VITE_MAP_DEFAULT_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
