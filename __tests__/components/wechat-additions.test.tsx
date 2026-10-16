import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) => (
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

import About from "../../components/About";
import Contact from "../../components/Contact";
import Footer from "../../components/Footer";

describe("WeChat in About section", () => {
  afterEach(() => cleanup());

  it("renders WeChat number in English", () => {
    render(<About lang="en" />);
    expect(screen.getByText(/WeChat: \+64 21 069 3089/)).toBeDefined();
  });

  it("renders WeChat number in Chinese", () => {
    render(<About lang="zh" />);
    expect(screen.getByText(/微信: \+64 21 069 3089/)).toBeDefined();
  });

  it("places WeChat line after email and before Barfoot Profile", () => {
    render(<About lang="en" />);
    const emailText = screen.getByText("m.nian@barfoot.co.nz");
    const wechatLine = screen.getByText(/WeChat: \+64 21 069 3089/);
    const profileLink = screen.getByText("Marie's Barfoot Profile");

    const emailP = emailText.closest("p")!;
    const wechatP = wechatLine.closest("p")!;
    const profileP = profileLink.closest("p")!;

    expect(emailP.compareDocumentPosition(wechatP) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wechatP.compareDocumentPosition(profileP) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("WeChat in Contact section (Get in Touch)", () => {
  afterEach(() => cleanup());

  it("renders WeChat QR card in English", () => {
    render(<Contact lang="en" />);
    expect(screen.getByText("WeChat")).toBeDefined();
    expect(screen.getByAltText("Marie WeChat QR Code")).toBeDefined();
    expect(screen.getByText("Scan to connect on WeChat")).toBeDefined();
  });

  it("renders WeChat QR card in Chinese", () => {
    render(<Contact lang="zh" />);
    expect(screen.getByText("微信")).toBeDefined();
    expect(screen.getByAltText("Marie 微信二维码")).toBeDefined();
    expect(screen.getByText("扫码添加微信")).toBeDefined();
  });

  it("shows WeChat QR image with correct src", () => {
    render(<Contact lang="en" />);
    const img = screen.getByAltText("Marie WeChat QR Code") as HTMLImageElement;
    expect(img.src).toContain("/Marie-Wechat.jpg");
  });

  it("renders 4 contact cards including WeChat", () => {
    render(<Contact lang="en" />);
    expect(screen.getByText("Email Marie")).toBeDefined();
    expect(screen.getByText("Facebook")).toBeDefined();
    expect(screen.getByText("LinkedIn")).toBeDefined();
    expect(screen.getByText("WeChat")).toBeDefined();
  });
});

describe("WeChat in Footer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows WeChat number under Contact column in English", () => {
    render(<Footer lang="en" />);
    expect(screen.getByText(/WeChat: \+64 21 069 3089/)).toBeDefined();
  });

  it("shows WeChat number under Contact column in Chinese", () => {
    render(<Footer lang="zh" />);
    expect(screen.getByText(/微信: \+64 21 069 3089/)).toBeDefined();
  });

  it("shows WeChat icon in Follow Me section", () => {
    render(<Footer lang="en" />);
    const wechatBtn = screen.getByRole("button", { name: "WeChat" });
    expect(wechatBtn).toBeDefined();
  });

  it("toggles WeChat QR popup on icon click", () => {
    render(<Footer lang="en" />);
    const wechatBtn = screen.getByRole("button", { name: "WeChat" });

    expect(screen.queryByAltText("Marie WeChat QR Code")).toBeNull();

    fireEvent.click(wechatBtn);
    expect(screen.getByAltText("Marie WeChat QR Code")).toBeDefined();
    expect(screen.getByText("Scan to connect on WeChat")).toBeDefined();

    fireEvent.click(wechatBtn);
    expect(screen.queryByAltText("Marie WeChat QR Code")).toBeNull();
  });

  it("toggles WeChat QR popup in Chinese", () => {
    render(<Footer lang="zh" />);
    const wechatBtn = screen.getByRole("button", { name: "WeChat" });

    fireEvent.click(wechatBtn);
    expect(screen.getByAltText("Marie 微信二维码")).toBeDefined();
    expect(screen.getByText("扫码添加微信")).toBeDefined();

    fireEvent.click(wechatBtn);
    expect(screen.queryByAltText("Marie 微信二维码")).toBeNull();
  });
});
