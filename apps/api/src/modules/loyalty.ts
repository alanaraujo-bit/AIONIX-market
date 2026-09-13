import { redeemSchema } from "@aionix/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireUser } from "../lib/auth";
import { parse } from "../lib/http";
import { cancelRedemption, getWallet, listActiveRewards, markSeen, redeemReward } from "../lib/loyalty";
import { getLoyaltySettings } from "../lib/settings";

/** Loyalty program: public description + the signed-in shopper's wallet. */
export const loyaltyRoutes: FastifyPluginAsync = async (app) => {
  /** User-agnostic: rules and the reward catalog. */
  app.get("/loyalty/program", async (_req, reply) => {
    const s = await getLoyaltySettings();
    reply.header("cache-control", "no-store");
    return { ...s, rewards: s.enabled ? await listActiveRewards() : [] };
  });

  app.get("/me/loyalty", async (req) => {
    const { userId } = requireUser(req);
    return getWallet(userId);
  });

  app.post("/me/loyalty/seen", async (req) => {
    const { userId } = requireUser(req);
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(50).optional() }), req.body ?? {});
    await markSeen(userId, ids);
    return { ok: true };
  });

  app.post("/me/loyalty/redeem", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { rewardId } = parse(redeemSchema, req.body);
    const redemption = await redeemReward(userId, rewardId);
    return reply.status(201).send({ redemption });
  });

  app.post("/me/loyalty/redemptions/:id/cancel", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    return { redemption: await cancelRedemption(userId, id) };
  });
};
