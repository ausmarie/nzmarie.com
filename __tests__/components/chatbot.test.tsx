import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Chatbot from "@/components/Chatbot";

const routeState = vi.hoisted(() => ({ pathname: "/cn" }));

vi.mock("next/navigation", () => ({
  usePathname: () => routeState.pathname,
}));

vi.mock("next/dynamic", () => ({
  default: () => function MockWebchat() {
    return <div data-testid="webchat" />;
  },
}));

vi.mock("@/app/ChatProvider", () => ({
  useChat: () => ({ open: false, toggleChat: vi.fn() }),
}));

describe("Chatbot visibility", () => {
  const previousClientId = process.env.NEXT_PUBLIC_CHATBOT_CLIENT_ID;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CHATBOT_CLIENT_ID = "test-client";
  });

  afterEach(() => {
    cleanup();
    if (previousClientId === undefined) {
      delete process.env.NEXT_PUBLIC_CHATBOT_CLIENT_ID;
    } else {
      process.env.NEXT_PUBLIC_CHATBOT_CLIENT_ID = previousClientId;
    }
  });

  it("is hidden on the Chinese homepage", () => {
    routeState.pathname = "/cn";

    render(<Chatbot />);

    expect(screen.queryByRole("button", { name: "Open chat" })).toBeNull();
    expect(screen.queryByTestId("webchat")).toBeNull();
  });

  it("remains available on other public pages", () => {
    routeState.pathname = "/property";

    render(<Chatbot />);

    expect(screen.getByRole("button", { name: "Open chat" })).toBeTruthy();
    expect(screen.getByTestId("webchat")).toBeTruthy();
  });
});
