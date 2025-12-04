import { authedApiFetch } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  const res = await authedApiFetch(`${BACKEND_URL}/models`);
  return Response.json(await res.json());
}
