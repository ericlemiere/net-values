import { AwardHistory } from "@/components/AwardHistory";

export const metadata = {
  title: "Defensive Player of the Year - The Net Values",
  description: "Every NBA Defensive Player of the Year winner, with the Net Value each earned that season.",
};

export default function Page() {
  return <AwardHistory award="dpoy" />;
}
