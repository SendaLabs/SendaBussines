import { redirect } from "next/navigation";

import { BUSINESS_PATH } from "@/lib/site";

export default function Home() {
  redirect(BUSINESS_PATH);
}
