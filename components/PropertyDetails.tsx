"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Box, Heading, Text, Flex, Badge, IconButton } from "@radix-ui/themes";
import { X, MapPin, Bed, Bath, Car, Square, Ruler, DollarSign, ExternalLink, Video, ChevronLeft, ChevronRight } from "lucide-react";

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
  openHomes?: string[];
  deadline?: string;
}

import { translations, Language } from "../lib/translations";

interface PropertyDetailsProps {
  property: Property;
  onClose: () => void;
  lang?: Language;
}

export default function PropertyDetails({ property, onClose, lang = "en" }: PropertyDetailsProps) {
  const t = translations[lang].properties;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = property.images && property.images.length > 0 ? property.images : [property.imageUrl];
  const hasImages = images.length > 0;

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [property.id]);

  const handleMainImageClick = () => {
    if (images.length <= 1) {
      return;
    }
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const youTubeId = property.videoUrl
    ? (property.videoUrl.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/) || [])[1]
    : undefined;

  return (
    <Box
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "2rem",
          width: "90%",
          maxWidth: "800px",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <IconButton
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            cursor: "pointer",
          }}
          variant="ghost"
          color="gray"
        >
          <X size={24} />
        </IconButton>

        <Heading as="h2" size="7" weight="bold" mb="4">
          {property.title}
        </Heading>

        <Flex direction="column" gap="3" mb="4">
          <Flex align="center" gap="2">
            <DollarSign size={20} />
            <Text size="3">{property.price}</Text>
          </Flex>
          <Flex align="center" gap="2">
            <MapPin size={20} />
            <Text size="3">{property.location}</Text>
          </Flex>
        </Flex>

        <Flex gap="4" wrap="wrap" mb="4">
          {property.bedrooms !== undefined && (
            <Flex align="center" gap="2">
              <Bed size={20} />
              <Text size="3">{property.bedrooms} {t.bed}</Text>
            </Flex>
          )}
          {property.bathrooms !== undefined && (
            <Flex align="center" gap="2">
              <Bath size={20} />
              <Text size="3">{property.bathrooms} {t.bath}</Text>
            </Flex>
          )}
          {property.parking !== undefined && (
            <Flex align="center" gap="2">
              <Car size={20} />
              <Text size="3">{property.parking} {t.parking}</Text>
            </Flex>
          )}
          {property.area && (
            <Flex align="center" gap="2">
              <Square size={20} />
              <Text size="3">{t.floor} {property.area}</Text>
            </Flex>
          )}
          <Flex align="center" gap="2">
            <Ruler size={20} />
            <Text size="3">{t.land} {property.landArea}</Text>
          </Flex>
          {property.propertyType && (
            <Flex align="center" gap="2">
              <Square size={20} />
              <Text size="3">{property.propertyType}</Text>
            </Flex>
          )}
        </Flex>

        {hasImages && (
          <Box mb="4">
            <Box
              style={{
                position: "relative",
                marginBottom: "1rem",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <Image
                src={images[currentImageIndex]}
                alt={property.title}
                onClick={handleMainImageClick}
                width={800}
                height={600}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  cursor: images.length > 1 ? "pointer" : "default",
                }}
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={lang === "zh" ? "上一张图片" : "Previous image"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(
                        (prevIndex) => (prevIndex - 1 + images.length) % images.length
                      );
                    }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "12px",
                      transform: "translateY(-50%)",
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      backdropFilter: "blur(4px)",
                      WebkitBackdropFilter: "blur(4px)",
                      color: "var(--gray-12)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      zIndex: 2,
                    }}
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    type="button"
                    aria-label={lang === "zh" ? "下一张图片" : "Next image"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
                    }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: "12px",
                      transform: "translateY(-50%)",
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      backdropFilter: "blur(4px)",
                      WebkitBackdropFilter: "blur(4px)",
                      color: "var(--gray-12)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      zIndex: 2,
                    }}
                  >
                    <ChevronRight size={28} />
                  </button>
                </>
              )}
            </Box>
            {images.length > 1 && (
              <Flex gap="2" wrap="wrap">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setCurrentImageIndex(index)}
                    style={{
                      padding: 0,
                      border:
                        index === currentImageIndex
                          ? "2px solid var(--accent-9)"
                          : "1px solid var(--gray-5)",
                      borderRadius: "4px",
                      overflow: "hidden",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Image
                      src={image}
                      alt={`${property.title} ${index + 1}`}
                      width={100}
                      height={75}
                      style={{
                        width: "100px",
                        height: "75px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </button>
                ))}
              </Flex>
            )}
          </Box>
        )}

        {youTubeId && (
          <Box mb="4">
            <Heading as="h3" size="4" weight="bold" mb="2">
              <Flex align="center" gap="2">
                <Video size={20} />
                {lang === "zh" ? "视频" : "Video"}
              </Flex>
            </Heading>
            <Box
              style={{
                position: "relative",
                width: "100%",
                paddingTop: "56.25%",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youTubeId}`}
                title={`${property.title} video`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Box>
          </Box>
        )}

        {property.listingUrl && (
          <Box mb="4">
            <Heading as="h3" size="4" weight="bold" mb="2">
              {lang === "zh" ? "外部房源" : "Listing"}
            </Heading>
            <a
              href={property.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--accent-11)",
                fontWeight: 500,
              }}
            >
              <ExternalLink size={18} />
              {lang === "zh" ? "在 realestate.co.nz 上查看" : "View on realestate.co.nz"}
            </a>
          </Box>
        )}

        {property.deadline && (
          <Flex align="center" gap="3" mb="4">
            <Badge color="red" size="2">
              Deadline Sale
            </Badge>
            <Text size="3">{property.deadline}</Text>
          </Flex>
        )}

        {property.openHomes && property.openHomes.length > 0 && (
          <Box mb="4">
            <Heading as="h3" size="4" weight="bold" mb="2">
              {lang === "zh" ? "开放参观时间" : "Open Homes"}
            </Heading>
            {property.openHomes.map((time, index) => (
              <Text key={index} as="p" size="3">
                {time}
              </Text>
            ))}
          </Box>
        )}

        <Box>
          <Heading as="h3" size="4" weight="bold" mb="2">
            {lang === "zh" ? "房产详情" : "Property Details"}
          </Heading>
          <Text as="p" size="3" style={{ whiteSpace: "pre-wrap" }}>
            {property.details}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
