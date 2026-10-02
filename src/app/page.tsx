import GrowingTree from "@/components/GrowingTree";

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <GrowingTree />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Atnoia"
        className="pointer-events-none fixed left-8 top-8 z-10 h-auto w-30 sm:left-14 sm:top-12"
      />
      <p className="pointer-events-none fixed bottom-4 left-0 z-10 w-full text-center text-xs tracking-wide opacity-35">
        Atnoia Attention Lab
      </p>
    </main>
  );
}
