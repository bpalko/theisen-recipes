import { describe, expect, it } from "vitest";
import { onRequestPost } from "../functions/api/recipes.ts";
import {
  DEFAULT_MAX_BUCKET_BYTES,
  maxBucketBytes,
  rejectIfOverStorageCap,
  storageCapError,
  sumBucketBytes,
} from "../functions/lib/store.ts";

type Stored = { body: string | ArrayBuffer; size: number };

class MemoryBucket {
  readonly store = new Map<string, Stored>();
  puts = 0;
  pageSize: number | undefined;

  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    const limit = this.pageSize ?? options?.limit ?? 1000;
    let keys = [...this.store.keys()].sort();
    if (options?.prefix) keys = keys.filter((key) => key.startsWith(options.prefix));
    let start = 0;
    if (options?.cursor) {
      const index = keys.indexOf(options.cursor);
      start = index < 0 ? keys.length : index + 1;
    }
    const slice = keys.slice(start, start + limit);
    const truncated = start + slice.length < keys.length;
    return {
      objects: slice.map((key) => ({ key, size: this.store.get(key)!.size })),
      truncated,
      cursor: truncated ? slice[slice.length - 1] : undefined,
    };
  }

  async get(key: string) {
    const stored = this.store.get(key);
    if (!stored) return null;
    const text =
      typeof stored.body === "string"
        ? stored.body
        : new TextDecoder().decode(stored.body);
    return {
      key,
      body: new ReadableStream(),
      writeHttpMetadata() {},
      json: async () => JSON.parse(text),
      text: async () => text,
      arrayBuffer: async () =>
        typeof stored.body === "string"
          ? new TextEncoder().encode(stored.body).buffer
          : stored.body,
    };
  }

  async put(key: string, value: ArrayBuffer | string) {
    this.puts += 1;
    if (typeof value === "string") {
      this.store.set(key, {
        body: value,
        size: new TextEncoder().encode(value).byteLength,
      });
    } else {
      this.store.set(key, { body: value, size: value.byteLength });
    }
    return { key, writeHttpMetadata() {} };
  }

  async delete() {}

  seed(key: string, size: number, body = "") {
    this.store.set(key, { body, size });
  }
}

function recipeForm(photos: File[] = []) {
  const form = new FormData();
  form.set("title", "Test Pie");
  form.set("category", "desserts");
  form.set("contributor", "Aunt Carol");
  form.set("prepTime", "10 min");
  form.set("cookTime", "20 min");
  form.set("servings", "8");
  form.set("ingredients", "1 crust\n1 filling");
  form.set("steps", "Bake it.");
  for (const photo of photos) form.append("photos", photo);
  return form;
}

function postContext(bucket: MemoryBucket, maxBytes?: string) {
  return {
    request: new Request("https://recipes.example/api/recipes", {
      method: "POST",
      body: recipeForm(),
    }),
    env: {
      RECIPES: bucket,
      ...(maxBytes ? { MAX_BUCKET_BYTES: maxBytes } : {}),
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("maxBucketBytes", () => {
  it("defaults to 5 GiB", () => {
    expect(maxBucketBytes({})).toBe(5 * 1024 * 1024 * 1024);
    expect(maxBucketBytes({})).toBe(DEFAULT_MAX_BUCKET_BYTES);
  });

  it("uses a positive integer env override", () => {
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: "1024" })).toBe(1024);
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: " 5368709120 " })).toBe(
      DEFAULT_MAX_BUCKET_BYTES,
    );
  });

  it("ignores missing, zero, negative, and non-integer values", () => {
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: "" })).toBe(DEFAULT_MAX_BUCKET_BYTES);
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: "0" })).toBe(DEFAULT_MAX_BUCKET_BYTES);
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: "-1" })).toBe(DEFAULT_MAX_BUCKET_BYTES);
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: "abc" })).toBe(DEFAULT_MAX_BUCKET_BYTES);
    expect(maxBucketBytes({ MAX_BUCKET_BYTES: "1.5" })).toBe(DEFAULT_MAX_BUCKET_BYTES);
  });
});

describe("sumBucketBytes", () => {
  it("pages through bucket.list with cursor", async () => {
    const bucket = new MemoryBucket();
    bucket.pageSize = 1;
    bucket.seed("a", 10);
    bucket.seed("b", 25);
    bucket.seed("c", 7);
    expect(await sumBucketBytes(bucket as unknown as R2Bucket)).toBe(42);
  });
});

describe("recipe POST storage cap", () => {
  it("saves a recipe when the bucket is under the cap", async () => {
    const bucket = new MemoryBucket();
    const response = await onRequestPost(postContext(bucket, "1000000"));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { recipe?: { slug: string } };
    expect(body.recipe?.slug).toBe("test-pie");
    expect(bucket.puts).toBe(1);
    expect(bucket.store.has("recipes/test-pie.json")).toBe(true);
  });

  it("returns 507 and does not write when the recipe would exceed the cap", async () => {
    const bucket = new MemoryBucket();
    bucket.seed("filler.bin", 1000);
    const response = await onRequestPost(postContext(bucket, "1000"));
    expect(response.status).toBe(507);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe(storageCapError(1000));
    expect(bucket.puts).toBe(0);
    expect(bucket.store.has("recipes/test-pie.json")).toBe(false);
  });

  it("does not write photos when the combined payload would exceed the cap", async () => {
    const bucket = new MemoryBucket();
    bucket.seed("filler.bin", 900);
    const photo = new File([new Uint8Array(200)], "pie.jpg", { type: "image/jpeg" });
    const response = await onRequestPost({
      request: new Request("https://recipes.example/api/recipes", {
        method: "POST",
        body: recipeForm([photo]),
      }),
      env: { RECIPES: bucket, MAX_BUCKET_BYTES: "1000" },
    } as unknown as Parameters<typeof onRequestPost>[0]);
    expect(response.status).toBe(507);
    expect(bucket.puts).toBe(0);
    expect([...bucket.store.keys()].some((key) => key.startsWith("photos/"))).toBe(
      false,
    );
  });

  it("lets a tiny write succeed against the default 5 GB cap", async () => {
    const bucket = new MemoryBucket();
    const blocked = await rejectIfOverStorageCap(
      bucket as unknown as R2Bucket,
      1024,
      maxBucketBytes({}),
    );
    expect(blocked).toBeNull();
  });
});
