declare module '*.svg' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
