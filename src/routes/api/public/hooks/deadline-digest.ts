import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Cron-triggered deadline digest.
 *
 * Called by the scheduler with the CRON_SECRET in the x-cron-secret header.
 * Runs with no user session, so the digest builder scopes every read by user id.
 */
export const Route = createFileRoute("/api/public/hooks/deadline-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Server-only shared secret. The publishable key is public in the browser
        // bundle and must never gate a privileged endpoint.
        const expected = process.env.CRON_SECRET;
        const key = request.headers.get("x-cron-secret");
        if (!expected || !key || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let frequency: "daily" | "weekly" = "weekly";
        try {
          const body = await request.json();
          frequency = z.object({ frequency: z.enum(["daily", "weekly"]).default("weekly") }).parse(body).frequency;
        } catch {
          // empty body is fine, default to weekly
        }

        const { usersDueForDigest, buildDigestForUser, markDigestSent } = await import("@/lib/digest.server");
        const userIds = await usersDueForDigest(frequency);

        const sent: string[] = [];
        for (const userId of userIds.slice(0, 200)) {
          const digest = await buildDigestForUser(userId);
          if (!digest) continue;
          // Delivery runs through the project's email domain once it is verified.
          // Until then the digest is compiled and logged so the pipeline is testable.
          console.log("[digest]", digest.userId, digest.subject, `${digest.matchCount} matches`, `${digest.deadlineCount} deadlines`);
          sent.push(userId);
        }
        await markDigestSent(sent);

        return Response.json({ ok: true, frequency, considered: userIds.length, compiled: sent.length });
      },
    },
  },
});
