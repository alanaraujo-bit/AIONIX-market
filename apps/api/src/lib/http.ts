import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "ERROR",
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = "BAD_REQUEST") => new HttpError(400, msg, code);
export const unauthorized = (msg = "Faça login para continuar") => new HttpError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Acesso restrito") => new HttpError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Não encontrado") => new HttpError(404, msg, "NOT_FOUND");
export const conflict = (msg: string, code = "CONFLICT") => new HttpError(409, msg, code);

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(400, issues[0]?.message ?? "Dados inválidos", "VALIDATION", issues);
  }
  return result.data;
}

export function pageParams(query: Record<string, unknown>, maxSize = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(query.pageSize) || 24));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** Normalizes accents so searches like "feijao" match "Feijão". */
export function foldAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export const ACCENT_FROM = "áàâãäéèêëíìîïóòôõöúùûüç";
export const ACCENT_TO = "aaaaaeeeeiiiiooooouuuuc";
