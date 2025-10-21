// lib/validate.ts
import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export function badRequest(details: unknown) {
  return Response.json({ ok: false, error: details }, { status: 400 });
}
