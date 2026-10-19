import { AuroraBackground } from "@/components/aurora-background";
import { HeroInstall } from "@/components/hero-install";
import BlurText from "@/components/reactbits/BlurText/BlurText";
import { TerminalDemo } from "@/components/terminal-demo";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-14 pt-10 md:pb-16 md:pt-16">
      <AuroraBackground />
      <div className="wrap relative grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <div>
          <h1 className="sr-only">Randomness you can ship.</h1>
          <div aria-hidden="true">
            <BlurText
              text="Randomness you can ship."
              animateBy="words"
              direction="top"
              delay={70}
              stepDuration={0.55}
              blur={12}
              distance={28}
              trigger="load"
              className="max-w-[12ch] text-[clamp(3rem,7.2vw,5.4rem)] font-semibold leading-[0.96] tracking-[-0.065em] text-foreground"
            />
          </div>

          <p className="mt-5 max-w-[42rem] text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Cryptographically secure secrets, passwords and IDs in one zero-dependency command. Protect what you ship
            with mint guard.
          </p>

          <HeroInstall />
        </div>

        <TerminalDemo />
      </div>
    </section>
  );
}
