// Standalone test for the Avocado scraper route
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AVO_GRAPHQL = "https://api.avo.africa/auto/graphql";

const DEALER_LIST_QUERY = `query DealerListQuery($count: Int!, $cursor: String, $sort: DealerSort) {
  viewer {
    dealers(first: $count, after: $cursor, sort: $sort, statusIds: [APPROVED]) {
      total
      edges {
        node {
          id
          name
          contactNumber
          address {
            building
            street
            city
            postcode
            province { description }
            country { description }
            location { latitude longitude }
          }
        }
        cursor
      }
      pageInfo { endCursor hasNextPage }
    }
  }
}`;

interface AvoDealerNode {
  id: string;
  name: string;
  contactNumber?: string;
  address?: {
    building?: string;
    street?: string;
    city?: string;
    postcode?: string;
    province?: { description?: string };
    country?: { description?: string };
    location?: { latitude?: number; longitude?: number };
  };
}

function formatPhoneE164(phone: string, country: string): string {
  let digits = String(phone || "").replace(/[^0-9+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  const c = (country || "").toLowerCase();
  if (c === "za") {
    if (digits.startsWith("0") && digits.length >= 10) return "+27" + digits.slice(1);
    if (digits.startsWith("27") && digits.length >= 11) return "+" + digits;
  }
  return digits.length >= 8 ? "+" + digits : digits;
}

function nodeToLead(node: AvoDealerNode) {
  const addr = node.address || {};
  const addressParts = [addr.building, addr.street, addr.city, addr.postcode]
    .filter(Boolean)
    .join(", ");
  const city = addr.city || "";
  const province = addr.province?.description || "";
  const location = [city, province].filter(Boolean).join(", ") || "";

  let phone = String(node.contactNumber || "").trim();
  if (phone) phone = formatPhoneE164(phone, "za");

  return {
    name: String(node.name || "").trim(),
    location,
    phone,
    address: addressParts || location,
  };
}

async function scrapeAvocado(limit: number = 5) {
  const collected: ReturnType<typeof nodeToLead>[] = [];
  let cursor: string | null = null;
  let totalAvailable = 0;
  const perPage = 50;

  while (collected.length < limit) {
    const count = Math.min(perPage, limit - collected.length);
    const resp = await fetch(AVO_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        id: "DealerListQuery",
        query: DEALER_LIST_QUERY,
        variables: { count, cursor, sort: { field: "NAME", direction: "ASCENDING" } },
      }),
    });

    if (!resp.ok) {
      throw new Error(`Avocado API returned HTTP ${resp.status}`);
    }

    const data: any = await resp.json();
    const dealers = data?.data?.viewer?.dealers;
    if (!dealers) {
      throw new Error("Unexpected Avocado API response shape");
    }

    if (dealers.total > 0) totalAvailable = dealers.total;
    const edges = Array.isArray(dealers.edges) ? dealers.edges : [];
    for (const e of edges) {
      if (e.node?.name) collected.push(nodeToLead(e.node));
    }
    cursor = dealers.pageInfo?.hasNextPage ? dealers.pageInfo.endCursor : null;
    if (!cursor) break;
  }

  return { totalAvailable, count: collected.length, leads: collected };
}

// Run the test
scrapeAvocado(10)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error("ERROR:", err.message);
    process.exit(1);
  });
