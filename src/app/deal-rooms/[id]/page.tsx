import { PrivateDealRoom } from "@/components/private-deal-room";

// Render dynamically — deal-room IDs aren't known at build time and the
// previous setup triggered the same Turbopack server/client classification
// quirk seen on the buyers and sellers pages.
export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";

export default async function PrivateDealRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PrivateDealRoom roomId={id} />;
}
