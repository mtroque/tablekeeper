import { z } from 'zod';

export const MeResponseSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  email: z.string().nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
