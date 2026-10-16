import React from "react";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import PropertyListings from "../../components/PropertyListings";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) => (
     
    <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />
  ),
}));

afterEach(cleanup);

function getCards(): HTMLElement[] {
  return screen
    .getAllByRole("button", { name: /View Details/i })
    .map((btn) => btn.closest(".rt-Card") as HTMLElement);
}

function getCardTitles(): string[] {
  return getCards().map(
    (card) => within(card).getAllByRole("heading", { level: 3 })[0].textContent?.trim() ?? ""
  );
}

describe("PropertyListings", () => {
  it("renders 4 property cards with 1 Wake Road first (top-left)", () => {
    render(<PropertyListings />);
    const titles = getCardTitles();
    expect(titles).toHaveLength(4);
    expect(titles[0]).toBe("1 Wake Road, Coatesville, Rodney");
  });

  it("keeps the existing properties in order after the new card", () => {
    render(<PropertyListings />);
    const titles = getCardTitles();
    expect(titles[1]).toBe("62 Lord Street, STOKES VALLEY, Lower Hutt City");
    expect(titles[2]).toBe("1b Arawa Road, Hataitai, Wellington");
    expect(titles[3]).toBe("198 Sievers Grove, Cannons Creek, Porirua");
  });

  it("shows Sold badge on 1b Arawa Road card", () => {
    render(<PropertyListings />);
    const card = getCards()[2];
    expect(within(card).getAllByText("Sold").length).toBeGreaterThan(0);
  });

  it("shows Negotiation price, For Sale badge, Lifestyle Section and land area on 1 Wake Road card", () => {
    render(<PropertyListings />);
    const card = getCards()[0];
    expect(within(card).getByText("Negotiation")).toBeTruthy();
    expect(within(card).getAllByText("For Sale").length).toBeGreaterThan(0);
    expect(within(card).getByText("Lifestyle Section")).toBeTruthy();
    expect(within(card).getByText(/10,000m²/)).toBeTruthy();
  });

  it("does not render bed/bath/parking/floor counts for the bare section", () => {
    render(<PropertyListings />);
    const card = getCards()[0];
    expect(within(card).queryByText(/Bedrooms/)).toBeNull();
    expect(within(card).queryByText(/Bathrooms/)).toBeNull();
    expect(within(card).queryByText(/Parking/)).toBeNull();
    expect(within(card).queryByText(/Floor Area/)).toBeNull();
  });

  it("shows bed counts on house cards", () => {
    render(<PropertyListings />);
    const card = getCards()[1];
    expect(within(card).getByText(/3 Bedrooms/)).toBeTruthy();
  });

  it("opens details modal for 1 Wake Road with YouTube embed and realestate.co.nz link", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const iframe = screen.getByTitle(/1 Wake Road.*video/i) as HTMLIFrameElement;
    expect(iframe.src).toBe("https://www.youtube-nocookie.com/embed/TcFgLRdiLPM");
    const link = screen.getByRole("link", { name: /realestate\.co\.nz/i }) as HTMLAnchorElement;
    expect(link.href).toBe(
      "https://www.realestate.co.nz/43134985/rural/sale/1-wake-road-coatesville"
    );
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("modal for 1 Wake Road omits bed/bath but shows land and Lifestyle Section", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = within(
      screen.getByRole("heading", { level: 2, name: /1 Wake Road, Coatesville, Rodney/i })
        .closest(".rt-Box") as HTMLElement
    );
    expect(modal.getByText(/Land Area/)).toBeTruthy();
    expect(modal.getByText("Lifestyle Section")).toBeTruthy();
    expect(modal.queryByText(/Bedrooms/)).toBeNull();
  });

  it("does not show video/listing sections on properties without them", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[1]);
    expect(screen.queryByTitle(/video/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /realestate\.co\.nz/i })).toBeNull();
  });
});

describe("PropertyListings zh (/cn)", () => {
  function getZhCards(): HTMLElement[] {
    return screen
      .getAllByRole("button", { name: /查看详情/ })
      .map((btn) => btn.closest(".rt-Card") as HTMLElement);
  }

  it("keeps property titles in English but translates internal content", () => {
    render(<PropertyListings lang="zh" />);
    const titles = getZhCards().map(
      (card) => within(card).getAllByRole("heading", { level: 3 })[0].textContent?.trim() ?? ""
    );
    expect(titles[0]).toBe("1 Wake Road, Coatesville, Rodney");
    expect(titles[1]).toBe("62 Lord Street, STOKES VALLEY, Lower Hutt City");
    expect(titles[2]).toBe("1b Arawa Road, Hataitai, Wellington");
    expect(titles[3]).toBe("198 Sievers Grove, Cannons Creek, Porirua");
  });

  it("translates 1 Wake Road card: Negotiation→价格面议, Lifestyle Section→生活区分契土地, Chinese description", () => {
    render(<PropertyListings lang="zh" />);
    const card = getZhCards()[0];
    expect(within(card).getByText("价格面议")).toBeTruthy();
    expect(within(card).getByText("生活区分契土地")).toBeTruthy();
    expect(within(card).getByText(/Coatesville 生活方式/)).toBeTruthy();
    expect(within(card).queryByText("Negotiation")).toBeNull();
    expect(within(card).queryByText("Lifestyle Section")).toBeNull();
  });

  it("shows Chinese status labels via translations", () => {
    render(<PropertyListings lang="zh" />);
    const cards = getZhCards();
    expect(within(cards[0]).getAllByText("待售").length).toBeGreaterThan(0);
    expect(within(cards[2]).getAllByText("已售").length).toBeGreaterThan(0);
  });

  it("translates 62 Lord Street card with Chinese description and CV price", () => {
    render(<PropertyListings lang="zh" />);
    const card = getZhCards()[1];
    expect(within(card).getByText(/属于您的一片自然天地/)).toBeTruthy();
    expect(within(card).getByText(/估值/)).toBeTruthy();
  });

  it("translates 198 Sievers Grove card as 已撤回", () => {
    render(<PropertyListings lang="zh" />);
    const card = getZhCards()[3];
    expect(within(card).getByText("已撤回")).toBeTruthy();
  });

  it("opens modal with Chinese details for 1 Wake Road, title stays English, video/link preserved", () => {
    render(<PropertyListings lang="zh" />);
    fireEvent.click(screen.getAllByRole("button", { name: /查看详情/ })[0]);
    const heading = screen.getByRole("heading", {
      level: 2,
      name: /1 Wake Road, Coatesville, Rodney/,
    });
    expect(heading).toBeTruthy();
    const modal = within(heading.closest(".rt-Box") as HTMLElement);
    expect(modal.getAllByText(/生活区分契土地/).length).toBeGreaterThan(0);
    expect(modal.getByText(/土地面积/)).toBeTruthy();
    expect(modal.queryByText(/Bedrooms/)).toBeNull();
    const iframe = screen.getByTitle(/1 Wake Road.*video/i) as HTMLIFrameElement;
    expect(iframe.src).toBe("https://www.youtube-nocookie.com/embed/TcFgLRdiLPM");
    expect(screen.getByRole("link", { name: /realestate\.co\.nz/i })).toBeTruthy();
    expect(modal.getByText(/房源编号 # 941361/)).toBeTruthy();
  });

  it("translates modal open homes and deadline for 62 Lord Street", () => {
    render(<PropertyListings lang="zh" />);
    fireEvent.click(screen.getAllByRole("button", { name: /查看详情/ })[1]);
    expect(screen.getAllByText(/2025年11月1日 星期六/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2025年11月12日 星期三/).length).toBeGreaterThan(0);
  });

  it("keeps zh-specific labels for video and listing headings in modal", () => {
    render(<PropertyListings lang="zh" />);
    fireEvent.click(screen.getAllByRole("button", { name: /查看详情/ })[0]);
    expect(screen.getByText("视频")).toBeTruthy();
    expect(screen.getByText("外部房源")).toBeTruthy();
    expect(screen.getByRole("link", { name: /realestate\.co\.nz/ })).toBeTruthy();
  });
});

describe("PropertyDetails image gallery arrows", () => {
  function getModalBox(): HTMLElement {
    return screen
      .getByRole("heading", { level: 2, name: /1 Wake Road, Coatesville, Rodney/ })
      .closest(".rt-Box") as HTMLElement;
  }

  it("shows prev/next arrows inside the image on multi-image properties", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = getModalBox();
    expect(within(modal).getByRole("button", { name: "Next image" })).toBeTruthy();
    expect(within(modal).getByRole("button", { name: "Previous image" })).toBeTruthy();
  });

  it("next arrow advances the main image", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = getModalBox();
    const mainImage = within(modal).getByAltText("1 Wake Road, Coatesville, Rodney") as HTMLImageElement;
    expect(mainImage.src).toContain("photo-01.jpg");
    fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
    expect(mainImage.src).toContain("concept.jpg");
  });

  it("concept image is second in the gallery, followed by photo-11", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = getModalBox();
    const mainImage = within(modal).getByAltText("1 Wake Road, Coatesville, Rodney") as HTMLImageElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
    expect(mainImage.src).toContain("concept.jpg");
    fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
    expect(mainImage.src).toContain("photo-11.jpg");
  });

  it("previous arrow wraps to the last image from the first", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = getModalBox();
    const mainImage = within(modal).getByAltText("1 Wake Road, Coatesville, Rodney") as HTMLImageElement;
    expect(mainImage.src).toContain("photo-01.jpg");
    fireEvent.click(within(modal).getByRole("button", { name: "Previous image" }));
    expect(mainImage.src).toContain("photo-16.jpg");
  });

  it("next arrow wraps from the last image to the first", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = getModalBox();
    const mainImage = within(modal).getByAltText("1 Wake Road, Coatesville, Rodney") as HTMLImageElement;
    for (let i = 0; i < 7; i++) {
      fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
    }
    expect(mainImage.src).toContain("photo-16.jpg");
    fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
    expect(mainImage.src).toContain("photo-01.jpg");
  });

  it("arrow clicks do not trigger the image click-to-advance twice", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    const modal = getModalBox();
    const mainImage = within(modal).getByAltText("1 Wake Road, Coatesville, Rodney") as HTMLImageElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
    expect(mainImage.src).toContain("concept.jpg");
  });

  it("does not show arrows on single-image properties", () => {
    render(<PropertyListings />);
    fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[2]);
    expect(screen.queryByRole("button", { name: "Next image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous image" })).toBeNull();
  });

  it("shows Chinese arrow labels when lang is zh", () => {
    render(<PropertyListings lang="zh" />);
    fireEvent.click(screen.getAllByRole("button", { name: /查看详情/ })[0]);
    const modal = within(
      screen
        .getByRole("heading", { level: 2, name: /1 Wake Road, Coatesville, Rodney/ })
        .closest(".rt-Box") as HTMLElement
    );
    expect(modal.getByRole("button", { name: "下一张图片" })).toBeTruthy();
    expect(modal.getByRole("button", { name: "上一张图片" })).toBeTruthy();
  });
});
