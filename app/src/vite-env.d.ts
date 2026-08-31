/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "*.json" {
  const value: unknown;
  export default value;
}
