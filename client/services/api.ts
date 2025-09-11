// FIX: Safely access Vite environment variables with optional chaining to prevent runtime errors
// when `import.meta.env` is not defined. Fallback to localhost for development.
export const API_HTTP_BASE =
  (import.meta as any).env?.VITE_API_HTTP_BASE || "http://localhost:8000";
export const API_WS_BASE =
  (import.meta as any).env?.VITE_API_WS_BASE || "ws://localhost:8000";

export async function postJSON<T>(
  url: string,
  token: string,
  body: unknown
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json() as Promise<T>;
}
