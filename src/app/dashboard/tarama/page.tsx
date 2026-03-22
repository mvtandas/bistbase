import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScreenerClient } from "./client";

export default async function ScreenerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <ScreenerClient />;
}
