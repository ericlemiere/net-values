import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "NBA Most Improved Player Winners",
  description:
    "Every NBA Most Improved Player since 1990-91, with the Net Value and league rank each winner earned that season.",
  path: "/mip",
});

export default function Page() {
  return <AwardHistory award="mip" />;
}
