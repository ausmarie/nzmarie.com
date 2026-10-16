import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const mapRowToProperty = (row: Record<string, unknown>) => ({
  id: row.id,
  property_url: row.property_url,
  price: row.price ?? row.last_sold_price ?? undefined,
  predicted_price: row.predicted_price ?? undefined,
  category: row.category ?? undefined,
  address: row.address,
  suburb: row.suburb,
  city: row.city,
  region: row.region,
  predicted_status: row.predicted_status ?? row.status ?? undefined,
  confidence_score: row.confidence_score ?? undefined,
  last_sold_price: row.last_sold_price ?? 0,
  last_sold_date: row.last_sold_date ?? "",
  property_history: row.property_history ?? undefined,
  year_built: row.year_built ?? undefined,
  bedrooms: Number(row.bedrooms ?? 0),
  bathrooms: Number(row.bathrooms ?? 0),
  car_spaces: Number(row.car_spaces ?? 0),
  floor_size: row.floor_size ?? undefined,
  land_area: Number(row.land_area ?? 0),
  capital_value: row.capital_value ?? undefined,
  land_value: row.land_value ?? undefined,
  improvement_value: row.improvement_value ?? undefined,
  has_rental_history: row.has_rental_history ?? undefined,
  is_currently_rented: row.is_currently_rented ?? undefined,
  cover_image_url: row.cover_image_url ?? undefined,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "";
  const page = Number.parseInt(searchParams.get("page") || "0", 10);
  const pageSize = Math.min(Number.parseInt(searchParams.get("pageSize") || "9", 10), 50);
  const suburbs = searchParams.get("suburbs")?.split(",").map((s) => s.trim()).filter(Boolean) || [];
  const search = searchParams.get("search");
  const exact = searchParams.get("exact") === "true";
  const propertyId = searchParams.get("id");

  try {
    if (propertyId) {
      const result = await query("SELECT * FROM properties WHERE id = $1 LIMIT 1", [propertyId]);
      return NextResponse.json(result.rows.map(mapRowToProperty));
    }

    if (!city) {
      return NextResponse.json([]);
    }

    const whereClauses: string[] = ["city = $1"];
    const params: unknown[] = [city];
    let nextParamIndex = 2;

    if (suburbs.length > 0) {
      const suburbPlaceholders = suburbs.map((_, idx) => `$${nextParamIndex + idx}`);
      whereClauses.push(`suburb IN (${suburbPlaceholders.join(", ")})`);
      params.push(...suburbs);
      nextParamIndex += suburbs.length;
    }

    if (search) {
      if (exact) {
        whereClauses.push(`address ILIKE $${nextParamIndex}`);
        params.push(search);
      } else {
        whereClauses.push(`(address ILIKE $${nextParamIndex} OR suburb ILIKE $${nextParamIndex} OR city ILIKE $${nextParamIndex})`);
        params.push(`%${search}%`);
      }
      nextParamIndex += 1;
    }

    const offset = page * pageSize;
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const sqlQuery = `
      SELECT *
      FROM properties
      ${whereClause}
      ORDER BY id
      LIMIT $${nextParamIndex}
      OFFSET $${nextParamIndex + 1}
    `;
    params.push(pageSize, offset);

    const result = await query(sqlQuery, params);
    return NextResponse.json(result.rows.map(mapRowToProperty));
  } catch (error) {
    console.error("Property route error:", error);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}
