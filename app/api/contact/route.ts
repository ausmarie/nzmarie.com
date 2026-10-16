import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Contact form submissions are no longer supported." },
    { status: 410 }
  );
}
