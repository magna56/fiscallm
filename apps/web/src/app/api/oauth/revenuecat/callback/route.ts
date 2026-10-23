import { NextResponse, type NextRequest } from "next/server";

// Local development only: on Vercel, /api/* goes to the API service, which
// does the same forward (apps/api/src/app.ts).
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL(`/dashboard/connect/revenuecat${req.nextUrl.search}`, req.nextUrl.origin));
}
