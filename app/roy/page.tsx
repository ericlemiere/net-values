import { AwardHistory } from "@/components/AwardHistory";

export const metadata = {
  title: "Rookie of the Year - The Net Values",
  description: "Every NBA Rookie of the Year winner, with the Net Value each earned that season.",
};

export default function Page() {
  return <AwardHistory award="roy" />;
}
