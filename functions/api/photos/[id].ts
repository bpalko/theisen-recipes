import { getPhoto, requireBucket } from "../../lib/store.ts";

export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const bucket = requireBucket(env);
  if (bucket instanceof Response) return bucket;

  const object = await getPhoto(bucket, params.id);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=86400");
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
};
