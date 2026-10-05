export class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    const detail = data.detail;
    const fields = Object.entries(data).filter(([key]) => key !== "code");
    super(
      typeof detail === "string"
        ? detail
        : fields
            .map(
              ([key, value]) =>
                `${key}: ${Array.isArray(value) ? value.join(" ") : String(value)}`,
            )
            .join(" ") || "Request failed.",
    );
  }
}

let csrfToken = "";
function cookieToken(): string {
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("csrftoken="));
  return value
    ? decodeURIComponent(value.split("=").slice(1).join("="))
    : csrfToken;
}

export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  if (method !== "GET" && !cookieToken()) {
    const bootstrap = await fetch("/api/auth/csrf/", {
      credentials: "same-origin",
    });
    if (!bootstrap.ok) throw new ApiError(bootstrap.status, {});
    csrfToken = (await bootstrap.json()).csrf_token;
  }
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "X-CSRFToken": cookieToken() } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (body.csrf_token) csrfToken = body.csrf_token;
  if (!response.ok) {
    if (
      path !== "/auth/me/" &&
      (response.status === 401 || response.status === 403) &&
      body.detail === "Authentication credentials were not provided."
    ) {
      window.dispatchEvent(new Event("trainfuel-session-expired"));
    }
    throw new ApiError(response.status, body);
  }
  return body as T;
}
