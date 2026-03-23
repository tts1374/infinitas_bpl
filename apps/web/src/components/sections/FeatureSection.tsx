import { BarChart2, Globe, Trophy, Users, Zap } from "lucide-react";
import type { FC, ReactNode } from "react";
import { assetPath } from "../../lib/config";
import { applySvgFallback } from "../../lib/image-fallback";

interface FeatureCard {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  body: string;
  imageSrc?: string;
  imageAlt?: string;
  imageFallbackSvg?: string;
}

const lobbyFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><rect fill="#2d2d30" width="600" height="200"/><text fill="#666" font-size="16" font-family="sans-serif" x="50%" y="50%" text-anchor="middle">ここに LobbyBrowser 画像(3枚目)を配置</text></svg>`;
const statsFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><rect fill="#2d2d30" width="600" height="200"/><text fill="#666" font-size="16" font-family="sans-serif" x="50%" y="50%" text-anchor="middle">ここに Stats 画像(4枚目)を配置</text></svg>`;

const cards: FeatureCard[] = [
  {
    icon: <Trophy size={28} className="text-cyan-400" />,
    iconClassName: "bg-cyan-500/10",
    title: "ARENA / BPLモード対応",
    body: "最大4人での順位点制アリーナ、3ステージで雌雄を決するBPLルール。ゲームセンターと遜色のない白熱のルールを再現。",
    imageSrc: assetPath("assets/lp/feature-lobby.png"),
    imageAlt: "LobbyBrowser",
    imageFallbackSvg: lobbyFallback,
  },
  {
    icon: <BarChart2 size={28} className="text-amber-400" />,
    iconClassName: "bg-amber-500/10",
    title: "自身の「強さ」を可視化",
    body: "戦績から算出した内部レーティング、曲別勝率ランキングなどを詳細に分析（Stats）。得意・不得意が一目で判明。",
    imageSrc: assetPath("assets/lp/feature-stats.png"),
    imageAlt: "Stats",
    imageFallbackSvg: statsFallback,
  },
  {
    icon: <Users size={28} className="text-emerald-400" />,
    iconClassName: "bg-emerald-500/10",
    title: "部屋作成・募集・参加をワンストップで",
    body: "作成したルームをそのまま募集し、共有リンクから参加導線へ接続。PUBLIC / PRIVATE の切り替えで遊び方を選べます。",
  },
  {
    icon: <Zap size={28} className="text-fuchsia-400" />,
    iconClassName: "bg-fuchsia-500/10",
    title: "対戦進行を迷わないUIで",
    body: "Ready確認から選曲、プレイ、結果確認までの進行を一画面でガイド。進行の迷子を減らし、対戦体験に集中できます。",
  },
  {
    icon: <Globe size={28} className="text-sky-400" />,
    iconClassName: "bg-sky-500/10",
    title: "リザルト連携で手入力ゼロへ",
    body: "外部トラッカーと連携し、プレイ結果を自動反映。手入力の抜け漏れや記録負担を抑えた対戦運用を実現します。",
  },
];

export const FeatureSection: FC = () => (
  <section className="border-y border-white/5 bg-[#15151A] px-6 py-24">
    <div className="mx-auto max-w-6xl">
      <div className="mb-16 text-center">
        <h2 className="mb-4 text-3xl font-black uppercase tracking-wider text-cyan-400 md:text-4xl">Core Features</h2>
        <p className="text-gray-400">限界までこだわった対戦環境</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-[#1C1C22] p-8 transition-colors hover:border-cyan-500/30"
          >
            <div>
              <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${card.iconClassName}`}>{card.icon}</div>
              <h3 className="mb-3 text-xl font-bold">{card.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{card.body}</p>
            </div>

            {card.imageSrc ? (
              <img
                src={card.imageSrc}
                alt={card.imageAlt ?? card.title}
                className="mt-auto w-full rounded-xl border border-white/10 bg-[#252526] object-cover shadow-lg"
                onError={(event) =>
                  applySvgFallback(
                    event,
                    card.imageFallbackSvg ??
                      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><rect fill="#2d2d30" width="600" height="200"/></svg>`,
                  )
                }
              />
            ) : null}
          </article>
        ))}
      </div>
    </div>
  </section>
);
