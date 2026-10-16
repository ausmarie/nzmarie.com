"use client";

import React from "react";
import Link from "next/link";
import { Box, Flex, Heading, Text, Button, Container } from "@radix-ui/themes";

import { translations, Language } from "../lib/translations";

export default function Hero({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].hero;

  const formatBadge = (badgeText: string) => {
    const target = "(Under REAA 2008)";
    if (badgeText.includes(target)) {
      const parts = badgeText.split(target);
      return (
        <>
          {parts[0]}
          <span style={{ fontSize: "0.8rem", fontWeight: "normal", opacity: 0.8 }}>{target}</span>
          {parts[1]}
        </>
      );
    }
    return badgeText;
  };

  return (
    <Box id="home" position="relative">
      <Container
        size="4"
        position="relative"
        px="6"
        py={{ initial: "9", md: "12" }}
      >
        <Flex
          direction="column"
          align="center"
          gap="6"
          style={{
            textAlign: "center",
            minHeight: "80vh",
            justifyContent: "center",
          }}
        >
          <Box width="100%" maxWidth="900px">
            {/* Professional badge */}
            <Flex
              align="center"
              justify="center"
              gap="2"
              px="4"
              py="2"
              mb="6"
              style={{
                borderRadius: "9999px",
                backgroundColor: "var(--blue-3)",
                color: "var(--blue-11)",
                fontSize: "0.9rem",
                fontWeight: 500,
                border: "1px solid var(--blue-6)",
              }}
            >
              {formatBadge(t.badge)}
            </Flex>

            {/* Main heading */}
            <Heading
              as="h1"
              size={{ initial: "8", md: "9" }}
              weight="bold"
              mb="6"
              className="tracking-tight text-pretty"
              style={{ lineHeight: 1.2 }}
            >
              {t.titlePrefix}
              <Text
                style={{
                  background:
                    "linear-gradient(135deg, var(--blue-9), var(--blue-11))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t.titleName}
              </Text>
              <br />
              {t.titleSuffix}
            </Heading>

            {/* Subtitle */}
            <Text
              as="p"
              size="4"
              mb="8"
              style={{
                lineHeight: 1.6,
                color: "var(--gray-11)",
                maxWidth: "700px",
                margin: "0 auto 2rem auto",
              }}
            >
              {t.subtitle}
            </Text>

            {/* Call to action buttons */}
            <Flex justify="center" wrap="wrap" gap="4" mb="8">
              <Button
                asChild
                size="4"
                style={{
                  background: "linear-gradient(135deg, var(--blue-9), var(--blue-10))",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 600,
                  padding: "0 2rem",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                  cursor: "pointer",
                }}
              >
                <Link href="#appraisal">{t.btnAppraisal}</Link>
              </Button>

              <Button
                asChild
                size="4"
                style={{
                  backgroundColor: "var(--blue-3)",
                  color: "var(--blue-11)",
                  border: "1px solid var(--blue-6)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  padding: "0 2rem",
                  cursor: "pointer",
                }}
              >
                <Link href="#download-report">{t.btnReport}</Link>
              </Button>

              <Button
                asChild
                size="4"
                variant="outline"
                style={{
                  borderColor: "var(--gray-6)",
                  color: "var(--gray-11)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  padding: "0 2rem",
                  cursor: "pointer",
                }}
              >
                <Link href="#about">{t.btnAbout}</Link>
              </Button>
            </Flex>

            {/* Key features */}
            <Flex
              justify="center"
              wrap="wrap"
              gap="6"
              style={{ marginTop: "3rem" }}
            >
              <Flex
                direction="column"
                align="center"
                gap="2"
                style={{ maxWidth: "200px" }}
              >
                <Text
                  size="2"
                  weight="bold"
                  style={{ color: "var(--blue-11)" }}
                >
                  {t.expYears}
                </Text>
                <Text
                  size="1"
                  style={{ color: "var(--gray-10)", textAlign: "center" }}
                >
                  {t.expDetail}
                </Text>
              </Flex>

              <Flex
                direction="column"
                align="center"
                gap="2"
                style={{ maxWidth: "200px" }}
              >
                <Text
                  size="2"
                  weight="bold"
                  style={{ color: "var(--blue-11)" }}
                >
                  {t.license}
                </Text>
                <Text
                  size="1"
                  style={{ color: "var(--gray-10)", textAlign: "center" }}
                >
                  {t.prevAgency}
                </Text>
              </Flex>

              <Flex
                direction="column"
                align="center"
                gap="2"
                style={{ maxWidth: "200px" }}
              >
                <Text
                  size="2"
                  weight="bold"
                  style={{ color: "var(--blue-11)" }}
                >
                  {t.location}
                </Text>
                <Text
                  size="1"
                  style={{ color: "var(--gray-10)", textAlign: "center" }}
                >
                  {t.localExpert}
                </Text>
              </Flex>
            </Flex>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
