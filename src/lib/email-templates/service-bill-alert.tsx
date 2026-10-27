import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  /** Alert headline, already localised by the caller. */
  title?: string;
  /** Supporting sentence with due / grace dates. */
  detail?: string;
  period?: string;
  amount?: string;
  stageLabel?: string;
  /** Optional courtesy Bengali status — system mail itself stays English. */
  stageLabelBn?: string;
  reviewUrl?: string;
}

// React Email registry modules intentionally export the component through `template` below.
// eslint-disable-next-line react-refresh/only-export-components
const Email = ({ title, detail, period, amount, stageLabel, stageLabelBn, reviewUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title || "Service bill update — action may be required"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Winstone Pulse</Text>
        <Heading style={heading}>{title || "Service Bill Update"}</Heading>
        <Text style={text}>{detail || "See the IT console for details."}</Text>
        <Section style={box}>
          {period ? <Text style={row}>Period: {period}</Text> : null}
          {amount ? <Text style={row}>Amount: {amount}</Text> : null}
          {stageLabel ? <Text style={row}>Status: {stageLabel}</Text> : null}
        </Section>
        <Button
          href={reviewUrl || "https://crm.winstonebd.com/service-bill-unlock"}
          style={button}
        >
          Secure human review
        </Button>
        <Text style={muted}>
          This alert does not complete any payment, transfer or automatic approval.
        </Text>
        {stageLabelBn ? <Text style={muted}>বাংলা — অবস্থা: {stageLabelBn}</Text> : null}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    typeof data["title"] === "string" && data["title"]
      ? data["title"]
      : "Winstone Pulse — Service Bill Update",
  displayName: "Service bill alert",
  previewData: {
    title: "2026-10 service bill due — $35.29 USD",
    detail: "Due today; grace period runs until 18 October.",
    period: "2026-10",
    amount: "$35.29 USD",
    stageLabel: "Due Today",
    stageLabelBn: "মেয়াদ শেষ",
    reviewUrl: "https://crm.winstonebd.com/service-bill-unlock",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const brand = { fontSize: "12px", letterSpacing: "2px", color: "#8a6a1f", margin: "0 0 8px" };
const heading = { fontSize: "20px", color: "#1a1a1a", margin: "0 0 12px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333" };
const box = {
  backgroundColor: "#faf6ec",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "16px 0",
};
const row = { fontSize: "14px", color: "#4a4a4a", margin: "4px 0" };
const muted = { fontSize: "13px", color: "#6b6b6b", lineHeight: "20px" };
const button = {
  backgroundColor: "#8a6a1f",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 18px",
  textDecoration: "none",
};
