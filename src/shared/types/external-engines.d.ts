declare module 'libheif-js/wasm-bundle.js' {
  const libheif: any;
  export default libheif;
}

declare module 'wawoff2' {
  export function compress(buffer: Uint8Array): Promise<Uint8Array>;
  export function decompress(buffer: Uint8Array): Promise<Uint8Array>;
  const woff2: {
    compress: typeof compress;
    decompress: typeof decompress;
  };
  export default woff2;
}

declare module 'assimpjs' {
  const assimpjs: (options?: Record<string, unknown>) => Promise<any>;
  export default assimpjs;
}

declare module 'occt-import-js' {
  const occtImportJs: (options?: Record<string, unknown>) => Promise<any>;
  export default occtImportJs;
}

declare module 'libarchive.js' {
  export const Archive: {
    init: (options?: { workerUrl?: string }) => void;
    open: (file: File | Blob) => Promise<any>;
  };
}
