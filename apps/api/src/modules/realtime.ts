import type { FastifyPluginAsync } from "fastify";
import { isAllowedOrigin } from "../lib/origins";
import { env } from "../env";
import { requireUser, signTicket, verifyToken } from "../lib/auth";
import { subscribe } from "../lib/events";
import { unauthorized } from "../lib/http";

export const realtimeRoutes: FastifyPluginAsync = async (app) => {
  /** Issued through the same-origin proxy (cookie auth); used to open SSE directly. */
  app.get("/ticket", async (req) => {
    const ctx = requireUser(req);
    return {
      ticket: await signTicket(ctx),
      url: `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/realtime/stream`,
    };
  });

  app.get("/stream", async (req, reply) => {
    const { ticket } = req.query as { ticket?: string };
    const ctx = ticket ? await verifyToken(ticket, "sse") : req.auth;
    if (!ctx) throw unauthorized();

    const origin = req.headers.origin;
    const headers: Record<string, string> = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    };
    if (origin && isAllowedOrigin(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers.vary = "Origin";
    }
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, headers);
    res.write(`retry: 3000\nevent: ready\ndata: {"role":"${ctx.role}"}\n\n`);

    const unsubscribe = subscribe((event) => {
      if (ctx.role !== "admin" && event.userId !== ctx.userId) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 20_000);
    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};
