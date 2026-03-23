import { Activity, Download, FileText, MonitorPlay } from "lucide-react";
import type { FC } from "react";
import { assetPath, WEB_LINKS } from "../../lib/config";
import { applySvgFallback } from "../../lib/image-fallback";

interface HeroSectionProps {
  onHowToClick: () => void;
}

const heroArenaFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect fill="#2d2d30" width="800" height="500"/><text fill="#666" font-size="24" font-family="sans-serif" x="50%" y="50%" text-anchor="middle">ここに ARENA_PLAYING の画像(1枚目)を置いてください</text></svg>`;
const heroBplFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#1a1a1c" width="600" height="400" stroke="#333" stroke-width="2"/><text fill="#888" font-size="20" font-family="sans-serif" x="50%" y="50%" text-anchor="middle">ここに BPL_RESULT 画像(2枚目)を置いてください</text></svg>`;

export const HeroSection: FC<HeroSectionProps> = ({ onHowToClick }) => (
  <section className="relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 overflow-hidden px-6 pb-32 pt-24 lg:flex-row">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#111116] to-[#111116]"></div>
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[120px]"></div>

    <div className="relative z-10 flex w-full flex-1 flex-col items-start text-left lg:w-1/2">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold uppercase tracking-widest text-cyan-400 backdrop-blur">
        <Activity size={16} className="text-cyan-400" />
        <span className="text-xs">INFINITAS専用非公式オンライン対戦プラットフォーム</span>
      </div>

      <h1 className="mb-6 text-5xl font-black leading-tight tracking-tighter drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] md:text-7xl">
        INFINITASに、
        <br />
        <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-sm">
          熱狂のオンライン対戦
        </span>
        を。
      </h1>

      <p className="mb-12 max-w-2xl text-lg font-medium text-gray-300 drop-shadow-md md:text-xl">
        君の部屋が、ARENAになる。BPLになる。
        <br />
        スコア自動連携で手入力ゼロ。洗練された専用デスクトップUIと演出で、世界中のプレイヤーと繋がる新次元のIIDX体験。
      </p>

      <div className="relative z-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
        <a
          href={WEB_LINKS.download}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 text-lg font-black text-black shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all hover:-translate-y-1 hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)]"
        >
          <Download size={24} />
          Windows版をダウンロード
        </a>
        <button
          type="button"
          onClick={onHowToClick}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/10 px-8 py-4 text-lg font-bold text-white transition-all hover:bg-white/20"
        >
          <MonitorPlay size={24} />
          使い方を見る
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-300">
        <a href={WEB_LINKS.releaseNotes} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-cyan-300">
          <FileText size={16} />
          リリース情報
        </a>
        <a href={WEB_LINKS.support} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-cyan-300">
          サポート / Issue
        </a>
      </div>
    </div>

    <div className="hero-perspective relative z-10 hidden w-full flex-1 md:block lg:w-1/2">
      <div className="hero-visual-stack relative">
        <img
          src={assetPath("assets/lp/hero-arena.png")}
          alt="INFINITAS ARENA プレイ画面"
          className="h-auto w-full rounded-xl border border-white/10 bg-[#252526] shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
          onError={(event) => applySvgFallback(event, heroArenaFallback)}
        />
        <img
          src={assetPath("assets/lp/hero-bpl-result.png")}
          alt="BPL RESULT画面"
          className="hero-floating-shot absolute -bottom-16 -right-16 h-auto w-3/4 rounded-xl border border-white/10 bg-[#252526] shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
          onError={(event) => applySvgFallback(event, heroBplFallback)}
        />
      </div>
    </div>
  </section>
);
