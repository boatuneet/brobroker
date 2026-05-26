import { PrivateDealRoom } from "@/components/private-deal-room";
import { getDealRoomIds } from "@/lib/services";

export function generateStaticParams() {
  return getDealRoomIds().map((id) => ({ id }));
}

export default async function PrivateDealRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PrivateDealRoom roomId={id} />;
}
