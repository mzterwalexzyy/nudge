// Ambient module shim so the build type-checks without @types/better-sqlite3.
// better-sqlite3 is used server-side only (see next.config serverComponentsExternalPackages).
declare module 'better-sqlite3';

declare module '@second-brain/pipeline' {
  export const processItem: any;
  export const processItemTree: any;
  export const initSchema: any;
  export const migrateSchema: any;
  export const migrateColumns: any;
  export const getItemByCaptureKey: any;
  export const getItemsWithEmbeddings: any;
  export const insertItem: any;
  export const classifyAgreement: any;
  export const safeIngest: any;
  export const selectOutboundLink: any;
}
