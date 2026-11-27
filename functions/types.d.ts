interface R2Object {
  key: string;
  httpEtag?: string;
  writeHttpMetadata: (headers: Headers) => void;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
}

interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface R2Objects {
  objects: Array<{ key: string }>;
  truncated: boolean;
  cursor?: string;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: R2PutOptions,
  ): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

interface Env {
  BOOKSHELF_PASSWORD?: string;
  SESSION_SECRET?: string;
  RECIPES?: R2Bucket;
  ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
}

declare type PagesFunction<
  E = Env,
  P extends string = string,
  D extends Record<string, unknown> = Record<string, unknown>,
> = (context: EventContext<E, P, D>) => Response | Promise<Response>;

interface EventContext<E, P extends string, D> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: E;
  params: Record<P, string>;
  data: D;
}
