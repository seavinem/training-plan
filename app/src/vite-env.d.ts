/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL?: string;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}
