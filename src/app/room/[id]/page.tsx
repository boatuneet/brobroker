import Link from "next/link";
import { PrivateDealRoom } from "@/components/private-deal-room";
import { getDealRoomById } from "@/lib/services";
import {
  getPublicDealRoomBundle,
  getPublicRoomDocumentUrls,
  getPublicRoomQuestions,
} from "@/lib/supabase/service";

/* Public, no-auth buyer room. Two data paths:
   1. Demo rooms (ids seeded in demo-data) resolve without Supabase via
      getDealRoomById({ includeDemo: true }) — works in demo/preview envs
      with zero backend.
   2. Real Supabase rooms are fetched via the service-role client, which
      bypasses RLS. Only buyer-safe fields are projected into the
      PrivateDealRoom component (no owner notes, no broker-only data). */

// Same Turbopack static-classification dance as /deal-rooms/[id].
export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";

export default async function PublicRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Try the service-role fetch first so real Supabase rooms work for anon
  // visitors. Falls through to demo resolution when the service key isn't
  // set (current demo env) or the row doesn't exist.
  const bundle = await getPublicDealRoomBundle(id);

  // Confirm the room actually resolves before we render — either as a
  // service-role Supabase row, or via the demo-data path.
  const resolved = bundle
    ? getDealRoomById(id, [bundle.room], undefined, {
        buyers: [],
        listings: bundle.listings,
        includeDemo: false,
      })
    : getDealRoomById(id, [], undefined, {
        buyers: [],
        listings: [],
        includeDemo: true,
      });

  if (!resolved) {
    return (
      <RoomChrome>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-medium text-[#171719]">
            This shortlist link is no longer available
          </h1>
          <p className="mt-4 text-[14px] leading-7 text-[#5F625E]">
            Ask your broker to send you an updated private link.
          </p>
        </div>
      </RoomChrome>
    );
  }

  /* Signed doc links + the Q&A thread (broker replies) — both service-role,
     both buyer-safe projections. Empty in demo mode. */
  const [documentUrls, publicQuestions] = bundle
    ? await Promise.all([
        getPublicRoomDocumentUrls(bundle.room, bundle.listings),
        getPublicRoomQuestions(id),
      ])
    : [{}, []];

  return (
    <RoomChrome>
      <div className="mx-auto w-full max-w-[1100px]">
        <PrivateDealRoom
          documentUrls={documentUrls}
          includeDemo={!bundle}
          initialViewings={bundle?.viewings ?? []}
          publicQuestions={publicQuestions}
          roomId={id}
          storedBuyers={[]}
          storedListings={bundle?.listings ?? []}
          storedRooms={bundle ? [bundle.room] : []}
          viewer="buyer"
        />
      </div>
    </RoomChrome>
  );
}

function RoomChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[#E7E7E7] bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] items-center px-6 py-5 sm:px-8">
          <Link
            aria-label="Brobroker"
            className="font-display text-[1.5rem] font-bold tracking-tight text-[#171719]"
            href="/"
          >
            Brobroker<span className="text-[#A86642]">.</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[#E7E7E7] bg-white">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-6 text-center text-[12px] leading-6 text-[#8E918B] sm:px-8">
          Private shortlist prepared by your broker.
        </div>
      </footer>
    </div>
  );
}
