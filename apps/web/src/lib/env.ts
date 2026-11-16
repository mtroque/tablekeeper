import { z } from 'zod';

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_NEON_AUTH_URL: z.url(),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_ENABLE_EXAMPLE_GAME: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_ENABLE_PHOTO_SCORING: z.enum(['true', 'false']).default('false'),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

let cached: PublicEnv | undefined;

/** Web env, validated on first use. Each variable is named in full so Next.js inlines it. */
export function publicEnv(): PublicEnv {
  cached ??= PublicEnvSchema.parse({
    NEXT_PUBLIC_NEON_AUTH_URL: process.env.NEXT_PUBLIC_NEON_AUTH_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_EXAMPLE_GAME: process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME || undefined,
    NEXT_PUBLIC_ENABLE_PHOTO_SCORING: process.env.NEXT_PUBLIC_ENABLE_PHOTO_SCORING || undefined,
  });
  return cached;
}

/** True outside production builds or when `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true` (D-040). */
export function isExampleGameEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME === 'true'
  );
}
