interface Window {
  gtag: (command: string, idOrEvent: string, params?: Record<string, unknown>) => void;
  dataLayer: Array<{
    event: string;
    [key: string]: unknown;
  }>;
}
