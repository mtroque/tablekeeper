import { z } from 'zod';

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_ENABLE_EXAMPLE_GAME: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_ENABLE_PHOTO_SCORING: z.enum(['true', 'false']).default('false'),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

let cached: PublicEnv | undefined;

/** Web env, validated on first use. Each variable is named in full so Next.js inlines it. */
export function publicEnv(): PublicEnv {
  cached ??= PublicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_EXAMPLE_GAME: process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME || undefined,
    NEXT_PUBLIC_ENABLE_PHOTO_SCORING: process.env.NEXT_PUBLIC_ENABLE_PHOTO_SCORING || undefined,
  });
  return cached;
}
