export async function GET() {
  const res = await fetch("http://localhost:3001/agent/tools");
  return Response.json(await res.json());
}
