import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      appName: "Ward Flow",
      synthetic: true,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
