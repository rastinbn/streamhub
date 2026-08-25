export interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
}

/**
 * Placeholder Toast primitive. A real toast system (e.g. via a provider +
 * hook) will be wired up once notifications are implemented.
 */
export function Toast({ title, description, variant = 'default' }: ToastProps) {
  return (
    <div className={`streamhub-toast streamhub-toast--${variant}`}>
      <p className="streamhub-toast-title">{title}</p>
      {description && <p className="streamhub-toast-description">{description}</p>}
    </div>
  );
}
