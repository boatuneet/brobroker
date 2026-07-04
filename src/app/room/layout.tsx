/* Standalone layout for the public buyer-facing room page. No AppShell,
   no sidebar — just the app-wide fonts inherited from the root layout and
   a paper-cream background. Everything else (top bar, footer) lives in
   `/room/[id]/page.tsx` so a "not found" state can render the same chrome. */
export default function RoomLayout({ children }: LayoutProps<"/room">) {
  return <div className="min-h-screen bg-[#FBFBFB] text-[#171719]">{children}</div>;
}
