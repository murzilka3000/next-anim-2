import { HeroSection } from "@/components/sections/HeroSection";
import styles from "./page.module.css";
import { SportSection } from "@/components/sections/SportSection";
import { MythsDragSection } from "@/components/sections/MythsDragSection";
import { MotivationQuizSection } from "@/components/sections/MotivationQuizSection";
import { PeopleFrisbeeSection } from "@/components/sections/PeopleFrisbeeSection";
import Finish from "@/components/sections/Finish";
import { SlideGate } from "@/components/SlideGate";
import { MythsIntroSection } from "@/components/sections/MythsIntroSection";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <HeroSection />
      <SlideGate>
        <SportSection />
        <MythsIntroSection />
        <MythsDragSection />
        <MotivationQuizSection />
      </SlideGate>
      <div className="bg__123">
        <PeopleFrisbeeSection />
        <Finish />
      </div>
    </main>
  );
}
