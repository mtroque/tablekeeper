'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toasts (shadcn's Toast is Sonner), restyled with the tokens. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            '!rounded-card !border !border-line !bg-surface !text-ink !shadow-float !font-sans',
          description: '!text-muted',
          error: '!text-danger',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
