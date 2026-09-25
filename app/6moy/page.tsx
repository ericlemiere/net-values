import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Sixth Man of the Year",
  description:
    "Every NBA Sixth Man of the Year winner, with the Net Value each earned that season.",
  path: "/6moy",
});

export default function Page() {
  return <AwardHistory award="smoy" />;
}
