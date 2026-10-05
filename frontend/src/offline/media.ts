import { api } from "../api/client";
import { changed, db } from "./database";
function csrf() {
  return decodeURIComponent(
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="))
      ?.slice(10) ?? "",
  );
}
export async function uploadStagedMedia(owner: string, id: string) {
  const database = await db;
  let staged = await database.get("media", id);
  if (
    !staged ||
    staged.owner !== owner ||
    (await database.get("meta", "active")) !== owner
  )
    throw new Error("Media unavailable");
  if (staged.ready && staged.assetId) return staged.assetId;
  try {
    if (!staged.uploadId) {
      const result = await api<{ upload_id: string; asset_id: string }>(
        "/media/uploads/",
        "POST",
        {
          purpose: staged.purpose,
          visibility: staged.visibility ?? "private",
          ...(staged.visibility === "public"
            ? {
                source_url: staged.source_url,
                license: staged.license,
                rights_confirmed: staged.rights_confirmed,
              }
            : {}),
        },
      );
      staged = {
        ...staged,
        uploadId: result.upload_id,
        assetId: result.asset_id,
      };
      await database.put("media", staged);
    }
    const body = new FormData();
    body.append("file", staged.blob, "upload");
    const response = await fetch(
      `/api/media/uploads/${staged.uploadId}/content/`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRFToken": csrf() },
        body,
      },
    );
    if (!response.ok) throw new Error("Media upload failed");
    const result = await api<{ id: string }>(
      `/media/uploads/${staged.uploadId}/finalize/`,
      "POST",
      {},
    );
    // Preserve the durable source until the domain attachment is accepted.
    await database.put("media", {
      ...staged,
      assetId: result.id,
      ready: true,
      error: undefined,
    });
    changed();
    return result.id;
  } catch (error) {
    await database.put("media", {
      ...staged,
      uploadId: undefined,
      error: error instanceof Error ? error.message : "Upload failed",
    });
    changed();
    throw error;
  }
}
export async function privateMediaBlob(
  owner: string,
  assetId: string,
  variant = "thumbnail",
) {
  const database = await db;
  if ((await database.get("meta", "active")) !== owner)
    throw new Error("Account changed");
  const grant = await api<{ token: string; content_path: string }>(
    `/media/assets/${assetId}/access/`,
    "POST",
    { variant },
  );
  const response = await fetch(grant.content_path, {
    credentials: "same-origin",
    headers: { "X-Media-Access": grant.token },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Private media unavailable");
  if ((await database.get("meta", "active")) !== owner)
    throw new Error("Account changed");
  return response.blob(); // Caller creates/revokes an object URL. No permanent private URL is exposed.
}
