/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_REPORT_TOKEN?: string;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}
