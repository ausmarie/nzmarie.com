import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClientLayout from "@/app/ClientLayout";

vi.mock("@radix-ui/themes", () => ({
  Theme: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/GoogleAnalytics", () => ({
  default: () => null,
}));

vi.mock("@/app/ChatProvider", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-toastify", () => ({
  ToastContainer: () => null,
}));

describe("ClientLayout chatbot visibility", () => {
  afterEach(cleanup);

  it.each([
    "/",
    "/property",
    "/admin/market",
    "/market-reports/preview/test-report",
    "/cn",
  ])("does not render a chatbot on %s", (pathname) => {
    render(
      <ClientLayout>
        <div>{pathname}</div>
      </ClientLayout>,
    );

    expect(screen.getByText(pathname)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /chatbot|open chat/i })).toBeNull();
    expect(screen.queryByTestId("webchat")).toBeNull();
  });
});
