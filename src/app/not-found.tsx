"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Keycap } from "@/components/keycap";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10 md:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />

      <main className="relative z-10 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-white/70">
          OH MY REFCARDZ
        </p>
        <h1 className="mt-4 text-6xl font-bold tracking-tight text-white/90 md:text-8xl">
          404
        </h1>
        <p className="mt-4 text-lg text-white/75 md:text-xl">
          This cheat sheet does not exist.
        </p>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-white/60">
          <span>Press</span>
          <Keycap>
            <span className="small-caps">esc</span>
          </Keycap>
          <span>or</span>
          <Keycap>⌫</Keycap>
          <span>to go back.</span>
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-mono text-sm text-white/90 backdrop-blur transition hover:border-white/35 hover:bg-white/15"
        >
          {"<- Back to grid"}
        </Link>
      </main>
    </div>
  );
}
