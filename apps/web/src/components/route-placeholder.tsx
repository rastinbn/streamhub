interface RoutePlaceholderProps {
  route: string;
  description?: string;
}

/**
 * Minimal placeholder shown for routes that haven't been implemented yet.
 * Every route page in Phase 1 renders this so the routing structure is in
 * place without any business logic.
 */
export function RoutePlaceholder({ route, description }: RoutePlaceholderProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">StreamHub</p>
      <h1 className="text-2xl font-semibold">{route}</h1>
      {description && <p className="max-w-md text-muted-foreground">{description}</p>}
    </main>
  );
}
