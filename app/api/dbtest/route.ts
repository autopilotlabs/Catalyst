import { prisma } from "@/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });
  return Response.json(users);
}

