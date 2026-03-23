import type { FC } from "react";
import { FeatureSection } from "../components/sections/FeatureSection";
import { FaqSection } from "../components/sections/FaqSection";
import { HeroSection } from "../components/sections/HeroSection";
import { HowToSection } from "../components/sections/HowToSection";
import { IntegrationSection } from "../components/sections/IntegrationSection";
import { NotesSection } from "../components/sections/NotesSection";
import { WEB_LINKS } from "../lib/config";

export const LandingPage: FC = () => {
  const scrollToHowTo = (): void => {
    document.getElementById("how-to-use")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-[#111116] font-sans text-white selection:bg-cyan-500/30">
      <HeroSection onHowToClick={scrollToHowTo} />
      <FeatureSection />
      <IntegrationSection />
      <HowToSection />
      <NotesSection />
      <FaqSection />

      <footer className="border-t border-white/5 bg-[#09090C] px-6 py-12 text-center text-sm text-gray-500">
        <p className="mb-2">※当アプリはbeatmania IIDX INFINITASの非公式ツールです。各社とは一切関係ありません。</p>
        <p className="mb-4">Project INFINITAS Arena © 2026</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href={WEB_LINKS.releaseNotes} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
            更新情報
          </a>
          <a href={WEB_LINKS.support} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
            サポート
          </a>
          <a href={WEB_LINKS.knownIssues} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
            既知の制約
          </a>
        </div>
      </footer>
    </div>
  );
};
