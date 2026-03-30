import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth/session";

export default async function Home() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/dashboard");
  }

  redirect("/login");
}
