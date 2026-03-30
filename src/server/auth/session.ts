import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/options";
import { getDevBypassSession } from "@/server/auth/dev-bypass";
import { prisma } from "@/server/db/client";

export async function getServerAuthSession() {
  const devBypassSession = await getDevBypassSession();
  if (devBypassSession) {
    return devBypassSession;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true },
  });

  if (!dbUser?.active) {
    return null;
  }

  return session;
}
