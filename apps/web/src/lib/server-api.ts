import "server-only";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

/** Server-side public catalog fetch. Returns null instead of throwing so pages can fall back to client fetching. */
export async function serverGet<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
