"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Box,
  Container,
  Grid,
  Card,
  Heading,
  Text,
  Button,
  Flex,
  Badge,
} from "@radix-ui/themes";
import { Bed, Bath, Car, Square, Ruler, ChevronLeft, ChevronRight, Play } from "lucide-react";
import PropertyDetails from "./PropertyDetails";

interface PropertyZh {
  price?: string;
  propertyType?: string;
  description: string;
  details: string;
  openHomes?: string[];
  deadline?: string;
}

interface Property {
  id: number;
  title: string;
  price: string;
  location: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  area?: string;
  landArea: string;
  propertyType?: string;
  videoUrl?: string;
  listingUrl?: string;
  imageUrl: string;
  images?: string[];
  status: "For Sale" | "Under Offer" | "Sold" | "Deadline Sale" | "Coming Soon" | "Withdrawn";
  description: string;
  details: string;
  openHomes: string[];
  deadline?: string;
  zh?: PropertyZh;
}

function localizeProperty(property: Property, lang: Language): Property {
  if (lang !== "zh" || !property.zh) return property;
  return {
    ...property,
    price: property.zh.price ?? property.price,
    propertyType: property.zh.propertyType ?? property.propertyType,
    description: property.zh.description,
    details: property.zh.details,
    openHomes: property.zh.openHomes ?? property.openHomes,
    deadline: property.zh.deadline ?? property.deadline,
  };
}

function getYouTubeVideoId(videoUrl?: string) {
  return videoUrl?.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1];
}

const properties: Property[] = [
  {
    id: 6,
    title: "2/21 Birdwood Crescent, Parnell, Auckland",
    price: "POA",
    location: "2/21 Birdwood Crescent, Parnell, Auckland",
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    area: "248m²",
    landArea: "285m²",
    propertyType: "Townhouse",
    imageUrl: "/img/2-21 Birdwood Crescent/3572532814289677914.jpg",
    images: [
      "/img/2-21 Birdwood Crescent/3572532814289677914.jpg",
      "/img/2-21 Birdwood Crescent/15551503651520434293.jpg",
      "/img/2-21 Birdwood Crescent/16826307826035928740.jpg",
      "/img/2-21 Birdwood Crescent/17788050255602213793.jpg",
      "/img/2-21 Birdwood Crescent/6699321839574534448.jpg",
      "/img/2-21 Birdwood Crescent/676639201456968117.jpg",
      "/img/2-21 Birdwood Crescent/7295482908688743948.jpg",
      "/img/2-21 Birdwood Crescent/800049948936793181.jpg",
      "/img/2-21 Birdwood Crescent/8044476125041428350.jpg",
      "/img/2-21 Birdwood Crescent/9204007423387956900.jpg",
    ],
    status: "Sold",
    description: "Securing Premium Parnell Living",
    details: `A stunning 248m² executive home featuring 4 bedrooms and 3 bathrooms, perfectly positioned in the heart of Parnell.

The Brief
Our clients were looking for a spacious, low-maintenance premium family home within the highly sought-after Double Grammar Zone, offering both lifestyle and long-term capital resilience.

The Challenge
Premium standalone homes in Parnell are tightly held. Finding a property that matches exact luxury specifications while navigating a highly competitive market requires fast action, deep local connections, and strategic negotiation.

Marie's Edge & Outcome
By leveraging comprehensive market insights and sharp negotiation skills, Marie successfully secured this highly coveted property for the buyers on their terms. We took the stress out of the purchasing process, ensuring our clients confidently acquired their dream Parnell home.

Call to Action: Looking to buy in Auckland's premium suburbs? Let Marie find and secure your next dream home. Book a consultation today.`,
    openHomes: [],
    zh: {
      price: "已售",
      description: "锁定优质帕内尔生活",
      details: `一栋令人惊艳的 248m² 高端住宅，拥有 4 间卧室和 3 间浴室，完美坐落于帕内尔核心地带。

简介
我们的客户正在寻找一处宽敞、低维护的高端家庭住宅，位于备受追捧的双语法学校学区内，兼具生活品质与长期资本抗跌性。

挑战
帕内尔的高端独栋住宅供应极其稀缺。寻找一处完全符合奢华规格的房产，同时在竞争激烈的市场中脱颖而出，需要快速行动、深厚的本地人脉和精准的谈判策略。

Marie 的优势与成果
凭借全面的市场洞察和敏锐的谈判技巧，Marie 成功按买方条件拿下这处备受瞩目的房产。我们为客户消除了购房过程中的压力，确保他们自信地拥有了梦想中的帕内尔住宅。

行动号召：想在奥克兰核心区买房？让 Marie 为您寻觅并锁定下一套梦想住宅。立即预约咨询。`,
      openHomes: [],
    },
  },
  {
    id: 5,
    title: "1 Wake Road, Coatesville, Rodney",
    price: "Negotiation",
    location: "1 Wake Road, Coatesville, Rodney 0627",
    landArea: "10,000m²",
    propertyType: "Lifestyle Section",
    videoUrl: "https://youtu.be/TcFgLRdiLPM",
    listingUrl: "https://www.realestate.co.nz/43134985/rural/sale/1-wake-road-coatesville",
    imageUrl: "/img/1-wake-road-coatesville/photo-01.jpg",
    images: [
      "/img/1-wake-road-coatesville/photo-01.jpg",
      "/img/1-wake-road-coatesville/concept.jpg",
      "/img/1-wake-road-coatesville/photo-11.jpg",
      "/img/1-wake-road-coatesville/photo-02.jpg",
      "/img/1-wake-road-coatesville/photo-05.jpg",
      "/img/1-wake-road-coatesville/photo-03.jpg",
      "/img/1-wake-road-coatesville/photo-08.jpg",
      "/img/1-wake-road-coatesville/photo-16.jpg",
    ],
    status: "For Sale",
    description: "Your Coatesville Lifestyle Starts Here — a rare 1-hectare (10,000sqm) lifestyle section in sought-after Coatesville.",
    details: `A rare opportunity to secure a 1-hectare (10,000sqm) Lifestyle Title in sought-after Coatesville.

Elevated and peaceful, this generous bare section offers a blank canvas to build your dream country home, with plenty of space for family, gardens and outdoor living.

Best of all, you can enjoy the peace and space of rural living without giving up convenience. Albany Mega Centre and the wider Albany amenities are approximately 15 minutes drive away, with schools, Massey University, shopping, dining and everyday services all within easy reach.

The property is zoned for Albany Junior High School, Albany Senior High School, and Coatesville School, making it an attractive option for families planning their future home.
Enjoy nearby reserves, golf and outdoor recreation, while having easy road access for commuting.

With 10,000sqm of land and the freedom to build from the ground up, opportunities like this are becoming increasingly hard to find.

The vendor's plans have changed — now it's your chance to make this special piece of Coatesville your own!
Contact us now for the full information pack or to arrange a private viewing!

Listing # 941361 | Listed on 25 September`,
    openHomes: [],
    zh: {
      price: "价格面议",
      propertyType: "生活区分契土地",
      description: "开启您的 Coatesville 生活方式——备受追捧的 Coatesville 地区一块罕见的 1 公顷（10,000 平方米）生活区分契土地。",
      details: `一个难得的机会，在备受追捧的 Coatesville 拥有一块 1 公顷（10,000 平方米）的生活区分契土地。

地势高且宁静，这块宽敞的空地为您提供建造梦想乡村住宅的空白画布，拥有充足的空间供家庭生活、花园和户外活动使用。

最棒的是，您可以享受乡村生活的宁静与宽敞，同时不必牺牲便利性。Albany Mega Centre（Albany 大型购物中心）及 Albany 周边生活设施距离约 15 分钟车程，学校、梅西大学、购物、餐饮和日常服务均近在咫尺。

该房产属于 Albany 初中、Albany 高中及 Coatesville 小学校区，是规划未来家园的家庭理想选择。
享受附近的自然保护区、高尔夫球场和户外休闲活动，同时拥有便捷的道路通勤条件。

拥有 10,000 平方米的土地和从零开始建造的自由，这样的机会正变得越来越难得。

卖家的计划已改变——现在是您将这片 Coatesville 特别之地变为己有的机会！
立即联系我们获取完整信息资料或安排私人看房！

房源编号 # 941361 | 挂牌日期 9 月 25 日`,
    },
  },
  {
    id: 1,
    title: "62 Lord Street, STOKES VALLEY, Lower Hutt City",
    price: "CV: $630,000",
    location: "62 Lord Street, Stokes Valley, Lower Hutt City",
    bedrooms: 3,
    bathrooms: 1,
    parking: 2,
    area: "190m²",
    landArea: "2271m²",
    imageUrl: "/img/62-lord-street-stokes-valley/sold.jpg",
    images: [
      "/img/62-lord-street-stokes-valley/sold.jpg",
      "/img/62-lord-street-stokes-valley/index.webp",
      "/img/62-lord-street-stokes-valley/1850698a8f90e194d5c84dfd3166c47a.crop.1660x.webp",
      "/img/62-lord-street-stokes-valley/2812a1e1eeede15c64098207df989ecc.crop.1660x.webp",
      "/img/62-lord-street-stokes-valley/5bd705d356b0896be57f4b4c5a75548e.crop.1660x.webp",
      "/img/62-lord-street-stokes-valley/9944dd4a03221ea132698bd5175fa645.crop.1660x.webp",
    ],
    status: "Sold",
    description: "Your Own Slice Of Nature",
    details: `Discover the ideal balance of comfort, space, and tranquility in this beautifully maintained 1970s family home, set on an expansive approx. 2,271sqm section. Offering around 190sqm of living space, this home has been thoughtfully designed for relaxed family living.

Step inside to find brand-new carpet underfoot and freshly painted interior walls, giving the home a bright and welcoming feel from the moment you walk in. There are three generous double bedrooms, each with built-in wardrobes, and a well-appointed bathroom with a separate toilet. Downstairs, a tandem double garage offers versatility – use it as a workshop, hobby space, or extra storage, plus there’s also an extra toilet for convenience – perfect for when you're busy in the garden and don’t want to take your gumboots off!

The modernised kitchen makes cooking a pleasure, while the dining area connects seamlessly to the inviting living room. Two heat pumps and a gas burner keep the home warm and cosy over the winter months and large windows and sliding doors fill the space with natural light, opening out to a sunny balcony where you can enjoy your morning coffee or entertain friends while taking in the distant views.

The outdoor areas are a true highlight! A spacious yard provides plenty of off-street parking for cars, a boat, or a trailer, giving you flexibility for your lifestyle needs along with a lovely open deck which is ideal for family barbecues or simply soaking up the sun and enjoying the peace and quiet. The back garden invites you to grow flowers and vegetables, and even keep a few hens or small pets – perfect for those who love a touch of country life.

With convenient transport options, it’s just a 2-minute walk to the bus stop - don’t miss this opportunity to make this peaceful retreat your new family home. Come to an open home or book a private viewing today!`,
    openHomes: ["Sat, 1 Nov 2025, 1:00-1:30pm", "Sun, 2 Nov 2025, 1:00-1:30pm"],
    deadline: "Wednesday 12 November 2025 @ 1pm (unless sold prior)",
    zh: {
      price: "估值: $630,000",
      description: "属于您的一片自然天地",
      details: `在这个精心维护的 1970 年代家庭住宅中，尽享舒适、空间与宁静的完美平衡。住宅坐落在约 2,271 平方米的宽敞土地上，提供约 190 平方米的生活空间，专为轻松的家庭生活而精心设计。

踏入室内，全新地毯和全新粉刷的墙面映入眼帘——让家从进门那一刻起就充满明亮温馨的感觉。三间宽敞的双人卧室均配有嵌入式衣柜，一间设施齐全的卫浴配独立厕所。楼下，串联式双车库用途多样——可用作工作坊、兴趣空间或额外储藏，此外还有一间额外的厕所——非常适合在花园里忙碌而不想脱掉胶靴的时候！

现代化的厨房让烹饪成为一种享受，用餐区与温馨的客厅无缝衔接。两台热泵和燃气壁炉让家在冬季保持温暖舒适，大面积窗户和滑动门让空间充满自然光，通向一个阳光明媚的露台——您可以在那里享受清晨咖啡或招待朋友，同时欣赏远处的景色。

户外区域才是真正的一大亮点！宽敞的院子提供充足的路边停车位，可停放汽车、船只或拖车，为您的生活方式提供灵活性，还有一个可爱的开放式露台，非常适合家庭烧烤或尽情享受阳光与宁静。后花园邀请您种植花卉和蔬菜，甚至养几只母鸡或小宠物——非常适合那些喜爱一点乡村生活的人。

交通便利，步行 2 分钟即可到达公交车站——不要错过这个机会，让这个宁静的避风港成为您的新家庭住宅。今天就来参加开放日或预约私人看房吧！`,
      openHomes: ["2025年11月1日 星期六 下午1:00-1:30", "2025年11月2日 星期日 下午1:00-1:30"],
      deadline: "2025年11月12日 星期三 下午1点（除非提前售出）",
    },
  },
  {
    id: 3,
    title: "1b Arawa Road, Hataitai, Wellington",
    price: "",
    location: "1b Arawa Road, Hataitai, Wellington 6021",
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    area: "75m²",
    landArea: "-",
    imageUrl: "/img/1B-Arawa-Road-Hataitai/6dgaz4ppoqi6tftmy6nrtdtc5a.jpg",
    status: "Sold",
    description: "Modern apartment in the heart of Hataitai — now sold.",
    details: `Welcome to 1b Arawa Road — a beautifully presented apartment in the heart of Hataitai. This property has now been sold.

Key Details:
- Year Built: 1994
- Property Type: Residential Apartment
- Floor Area: 75m²

This well-maintained apartment offered a fantastic opportunity for first home buyers or investors looking to secure a property in one of Wellington's most desirable inner-city suburbs. Enjoy proximity to public transport, local cafes, and the stunning Wellington harbour.

If you have a similar property to sell, contact Marie Nian today.`,
    openHomes: [],
    zh: {
      description: "Hataitai 核心地段的现代公寓——现已售出。",
      details: `欢迎来到 1b Arawa Road——位于 Hataitai 核心地段的精美公寓。该房产现已售出。

主要信息：
- 建成年份：1994 年
- 房产类型：住宅公寓
- 室内面积：75 平方米

这栋维护良好的公寓为首次购房者或投资者提供了一个绝佳的机会，可以在惠灵顿最受欢迎的内城区之一置业。邻近公共交通、当地咖啡馆和迷人的惠灵顿海港。

如果您有类似的房产需要出售，请立即联系 Marie Nian。`,
    },
  },
  {
    id: 4,
    title: "198 Sievers Grove, Cannons Creek, Porirua",
    price: "Withdrawn",
    location: "198 Sievers Grove, Cannons Creek, Porirua 5024",
    bedrooms: 3,
    bathrooms: 1,
    parking: 1,
    area: "101m²",
    landArea: "862m²",
    imageUrl: "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/q44d2miqwui7bkyg2g3gkdoly4.jpg",
    images: [
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/q44d2miqwui7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/lapcywaqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/as7kfiiqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/bhch6caqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/frgxvwyqw4i7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/k64qebiqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/kpu7reaqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/kzaltjyqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/l42l6maqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/n4xuqlqqwui7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/phe7ucqqwui7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/phzdaeaqw4i7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/po3ynyiqw4i7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/q44d2miqwui7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/qbcjv2aqwui7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/qovolsqqw4i7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/ssoqugyqwui7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/w77d3iqqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/xuatg4aqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/ywydnaaqwui7bkyg2g3gkdoly4.jpg",
    ],
    status: "Withdrawn",
    description: "Spacious residential property with high potential. Built in 1967.",
    details: `About 198 Sievers Grove, Cannons Creek, Porirua, 5024:
198 Sievers Grove is a residential property built in 1967 with 3 bedrooms, 1 bathroom and 1 parking space. The property is estimated to be valued in the range of $550,000 to $600,000.

Property History & Valuation:
- Last Sold: 3 June 2019 for $390,000 (Sold by Double Winkel Real Estate Ltd Professionals, Porirua)
- Market Time: Sold in 22 days in 2019.
- Rating Valuation (1 Oct 2022):
  * Capital Value: $590,000
  * Land Value: $365,000
  * Improvement Value: $225,000

Status: This property was previously listed by Marie. After several open homes, the seller has decided to withdraw the property from the market for the time being.`,
    openHomes: [],
    zh: {
      price: "已撤回",
      description: "宽敞的住宅物业，潜力巨大。建于 1967 年。",
      details: `关于 198 Sievers Grove, Cannons Creek, Porirua, 5024：
198 Sievers Grove 是一座建于 1967 年的住宅物业，拥有 3 间卧室、1 间浴室和 1 个停车位。该物业估价在 $550,000 至 $600,000 之间。

房产历史与估价：
- 上次售出：2019 年 6 月 3 日，售价 $390,000（由 Double Winkel Real Estate Ltd Professionals, Porirua 出售）
- 市场时间：2019 年以 22 天售出。
- 评级估价（2022 年 10 月 1 日）：
  * 总资本价值：$590,000
  * 土地价值：$365,000
  * 改良物价值：$225,000

状态：此房产此前由 Marie 代理销售。经过数次开放日后，卖家决定暂时将该房产撤出市场。`,
    },
  },
];

import { translations, Language } from "../lib/translations";

export default function PropertyListings({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].properties;
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [cardImageIndex, setCardImageIndex] = useState<Record<number, number>>({});
  const [playingVideoPropertyId, setPlayingVideoPropertyId] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "For Sale":
        return "green";
      case "Under Offer":
        return "orange";
      case "Sold":
        return "gray";
      case "Coming Soon":
        return "blue";
      case "Withdrawn":
        return "red";
      default:
        return "blue";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "Sold": return t.status.sold;
      case "For Sale": return t.status.sale;
      case "Under Offer": return t.status.offer;
      case "Deadline Sale": return t.status.deadline;
      case "Coming Soon": return t.status.soon;
      case "Withdrawn": return t.status.withdrawn;
      default: return status;
    }
  };

  return (
    <Box id="properties" py="9" style={{ backgroundColor: "var(--gray-1)" }}>
      <Container size="4" px="6">
        {/* Section Header */}
        <Flex direction="column" align="center" mb="8">
          <Heading
            as="h2"
            size="8"
            weight="bold"
            mb="4"
            style={{ textAlign: "center", color: "var(--gray-12)" }}
          >
            {t.title}
          </Heading>
          <Text
            size="4"
            style={{
              textAlign: "center",
              color: "var(--gray-11)",
              maxWidth: "600px",
              lineHeight: 1.6,
            }}
          >
            {t.subtitle}
          </Text>
        </Flex>

        {/* Properties Grid */}
        <Grid columns={{ initial: "1", md: "2" }} gap="6" justify="center">
          {properties.map((rawProperty) => {
            const property = localizeProperty(rawProperty, lang);
            return (
            <Card
              key={property.id}
              className="property-card"
              style={{
                overflow: "hidden",
                backgroundColor: "white",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              {/* Property Image */}
              <Box
                className="property-image"
                style={{
                  position: "relative",
                  backgroundColor: "var(--gray-3)", // fallback color
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setPlayingVideoPropertyId(null);
                  setSelectedProperty(property);
                }}
              >
                {(() => {
                  const images = property.images && property.images.length > 0 ? property.images : [property.imageUrl];
                  const currentIndex = cardImageIndex[property.id] || 0;
                  const currentImage = images[currentIndex];
                  const hasMultipleImages = images.length > 1;
                  const youTubeId = getYouTubeVideoId(property.videoUrl);
                  const isPlayingVideo = playingVideoPropertyId === property.id && currentIndex === 0;

                  return (
                    <>
                      {isPlayingVideo && youTubeId ? (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&playsinline=1`}
                          title={`${property.title} video player`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            border: "none",
                            zIndex: 2,
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <Image
                          src={currentImage}
                          alt={property.title}
                          fill
                          style={{
                            objectFit: "cover",
                            objectPosition: "top center",
                            transition: "opacity 0.3s ease",
                          }}
                          priority={false}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 50vw, 50vw"
                        />
                      )}
                      {/* Play button overlay for video */}
                      {youTubeId && currentIndex === 0 && !isPlayingVideo && (
                        <button
                          type="button"
                          aria-label={lang === "zh" ? "播放视频" : "Play video"}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setPlayingVideoPropertyId(property.id);
                          }}
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            border: "none",
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            color: "var(--blue-9)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            zIndex: 4,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                            transition: "transform 0.2s ease, background-color 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)";
                            e.currentTarget.style.backgroundColor = "white";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
                          }}
                        >
                          <Play size={28} style={{ marginLeft: "4px" }} />
                        </button>
                      )}
                      {isPlayingVideo && (
                        <button
                          type="button"
                          aria-label={lang === "zh" ? "关闭视频" : "Close video"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingVideoPropertyId(null);
                          }}
                          style={{
                            position: "absolute",
                            top: "12px",
                            right: "12px",
                            zIndex: 4,
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            backgroundColor: "rgba(0, 0, 0, 0.7)",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          {lang === "zh" ? "关闭视频" : "Close video"}
                        </button>
                      )}
                      {hasMultipleImages && (
                        <>
                          <button
                            type="button"
                            aria-label={lang === "zh" ? "卡片上一张图片" : "Card previous image"}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setPlayingVideoPropertyId(null);
                              setCardImageIndex((prev) => ({
                                ...prev,
                                [property.id]: (prev[property.id] || 0) > 0 ? (prev[property.id] || 0) - 1 : images.length - 1,
                              }));
                            }}
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "8px",
                              transform: "translateY(-50%)",
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              border: "none",
                              backgroundColor: "rgba(255, 255, 255, 0.8)",
                              backdropFilter: "blur(4px)",
                              WebkitBackdropFilter: "blur(4px)",
                              color: "var(--gray-12)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              zIndex: 3,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }}
                          >
                            <ChevronLeft size={22} />
                          </button>
                          <button
                            type="button"
                            aria-label={lang === "zh" ? "卡片下一张图片" : "Card next image"}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setPlayingVideoPropertyId(null);
                              setCardImageIndex((prev) => ({
                                ...prev,
                                [property.id]: ((prev[property.id] || 0) + 1) % images.length,
                              }));
                            }}
                            style={{
                              position: "absolute",
                              top: "50%",
                              right: "8px",
                              transform: "translateY(-50%)",
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              border: "none",
                              backgroundColor: "rgba(255, 255, 255, 0.8)",
                              backdropFilter: "blur(4px)",
                              WebkitBackdropFilter: "blur(4px)",
                              color: "var(--gray-12)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              zIndex: 3,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }}
                          >
                            <ChevronRight size={22} />
                          </button>
                          {/* Image indicator dots */}
                          <div style={{
                            position: "absolute",
                            bottom: "12px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            display: "flex",
                            gap: "6px",
                            zIndex: 3,
                          }}>
                            {images.map((_, index) => (
                              <span
                                key={index}
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  backgroundColor: index === currentIndex ? "var(--accent-9)" : "rgba(255,255,255,0.6)",
                                  transition: "all 0.2s ease",
                                  boxShadow: index === currentIndex ? "0 0 4px var(--accent-9)" : "none",
                                }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                {/* Status Badge */}
                <Box
                  style={{ position: "absolute", top: "12px", right: "12px" }}
                >
                  <Badge
                    color={getStatusColor(property.status)}
                    size="2"
                    style={{ fontWeight: 600 }}
                  >
                    {getStatusText(property.status)}
                  </Badge>
                </Box>

                {/* Price Tag */}
                {property.price && (
                  <Box
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "12px",
                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    <Text size="3" weight="bold">
                      {property.price}
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Property Details */}
              <Box p="4">
                <Heading
                  as="h3"
                  size="4"
                  weight="bold"
                  mb="2"
                  className="line-clamp-2"
                >
                  {property.title}
                </Heading>

                <Flex align="center" gap="2" mb="3">
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "red", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: "bold" }}>
                    $
                  </div>
                  <Text size="2" style={{ color: "var(--gray-11)", fontWeight: 500 }}>
                    {property.deadline ? `${getStatusText(property.status)} ${property.deadline}` : getStatusText(property.status)}
                  </Text>
                </Flex>

                <Text
                  size="2"
                  mb="4"
                  style={{
                    color: "var(--gray-10)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {property.description}
                </Text>

                {/* Property Features */}
                <Flex wrap="wrap" gap="4" mb="4">
                  {property.bedrooms !== undefined && (
                    <Flex align="center" gap="1">
                      <Bed size={16} style={{ color: "var(--gray-9)" }} />
                      <Text size="2" style={{ color: "var(--gray-11)" }}>
                        {property.bedrooms} {t.bed}
                      </Text>
                    </Flex>
                  )}

                  {property.bathrooms !== undefined && (
                    <Flex align="center" gap="1">
                      <Bath size={16} style={{ color: "var(--gray-9)" }} />
                      <Text size="2" style={{ color: "var(--gray-11)" }}>
                        {property.bathrooms} {t.bath}
                      </Text>
                    </Flex>
                  )}

                  {property.parking !== undefined && (
                    <Flex align="center" gap="1">
                      <Car size={16} style={{ color: "var(--gray-9)" }} />
                      <Text size="2" style={{ color: "var(--gray-11)" }}>
                        {property.parking} {t.parking}
                      </Text>
                    </Flex>
                  )}

                  {property.area && (
                    <Flex align="center" gap="1">
                      <Square size={16} style={{ color: "var(--gray-9)" }} />
                      <Text size="2" style={{ color: "var(--gray-11)" }}>
                        {t.floor} {property.area}
                      </Text>
                    </Flex>
                  )}

                  <Flex align="center" gap="1">
                    <Ruler size={16} style={{ color: "var(--gray-9)" }} />
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {t.land} {property.landArea}
                    </Text>
                  </Flex>

                  {property.propertyType && (
                    <Flex align="center" gap="1">
                      <Square size={16} style={{ color: "var(--gray-9)" }} />
                      <Text size="2" style={{ color: "var(--gray-11)" }}>
                        {property.propertyType}
                      </Text>
                    </Flex>
                  )}
                </Flex>

                {/* Action Buttons */}
                <Flex gap="2">
                  <Button
                    variant="solid"
                    size="2"
                    style={{
                      backgroundColor: "var(--blue-9)",
                      color: "white",
                      flex: 1,
                      fontSize: "0.875rem",
                    }}
                    onClick={() => setSelectedProperty(property)}
                  >
                    {t.viewDetails}
                  </Button>
                </Flex>
              </Box>
            </Card>
            );
          })}
        </Grid>


      </Container>

      {selectedProperty && (
        <PropertyDetails
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          lang={lang}
        />
      )}
    </Box>
  );
}
