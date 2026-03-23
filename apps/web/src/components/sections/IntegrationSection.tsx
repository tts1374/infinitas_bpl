import { Cable, ExternalLink, FileJson, Link2 } from "lucide-react";
import type { FC } from "react";

const sourceLinks = [
  {
    name: "打鍵カウンタ",
    key: "inf_daken_counter_obsw",
    description: "INFINITAS専用の打鍵カウンタで、SP/DP対応かつ判定内訳をスキャンしてノーツ数や日次判定合計を可視化します。",
    href: "https://github.com/dj-kata/inf_daken_counter_obsw/wiki/%E6%89%93%E9%8D%B5%E3%82%AB%E3%82%A6%E3%83%B3%E3%82%BFv3-%E3%83%97%E3%83%AC%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9",
    icon: <Cable size={22} className="text-cyan-400" />,
  },
  {
    name: "リザルト手帳",
    key: "inf-notebook",
    description: "INFINITASのリザルト画像を取り込み、スコアなどのプレイ記録を蓄積できるツールです。",
    href: "https://github.com/kaktuswald/inf-notebook/wiki",
    icon: <FileJson size={22} className="text-cyan-400" />,
  },
  {
    name: "Reflux",
    key: "reflux",
    description: "INFINITASのメモリ情報から自己ベストやセッション詳細を出力し、配信向けの曲名・状態連携にも対応する補助ツールです。",
    href: "https://github.com/olji/Reflux/releases/latest",
    icon: <Link2 size={22} className="text-cyan-400" />,
  },
];

export const IntegrationSection: FC = () => (
  <section className="border-y border-white/5 bg-[#111116] px-6 py-20">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 text-center">
        <h2 className="mb-4 text-3xl font-black uppercase tracking-wider text-cyan-400 md:text-4xl">
          Data Source & Integration
        </h2>
        <p className="text-gray-400">どのデータと連携するアプリなのかを明確に</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {sourceLinks.map((source) => (
          <article key={source.key} className="rounded-2xl border border-white/5 bg-[#1C1C22] p-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">{source.icon}</div>
            <h3 className="mb-2 text-lg font-bold">{source.name}</h3>
            <p className="mb-4 text-sm leading-relaxed text-gray-400">{source.description}</p>
            <a
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              公式ページへ
              <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </div>
    </div>
  </section>
);
