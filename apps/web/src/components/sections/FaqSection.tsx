import { HelpCircle, Sparkles } from "lucide-react";
import type { FC } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const faqItems: FaqItem[] = [
  {
    question: "利用に料金はかかりますか？",
    answer: "いいえ、非公式コミュニティツールとして提供されており、全機能を無料でご利用いただけます。",
  },
  {
    question: "ゲームのアカウントがBANされる危険性はありませんか？",
    answer:
      "本アプリはトラッカーから出力されるファイルデータを監視・中継する設計です。ただし外部ツールの利用を含むため、導入は自己責任でお願いします。",
  },
  {
    question: "スマホやタブレットからでも遊べますか？",
    answer: "申し訳ありませんが、本アプリは Windows 環境専用のデスクトップアプリです。",
  },
  {
    question: "OBSでこのアプリをキャプチャするとうまく動かない",
    answer:
      "OBS の「ウィンドウキャプチャ」で本アプリを取り込む際、キャプチャ方法を「Windows 10（1903以降）」に設定しないと正常に映らない場合があります。",
  },
];

export const FaqSection: FC = () => (
  <section id="faq" className="border-t border-white/5 bg-[#15151A] px-6 py-24">
    <div className="mx-auto max-w-4xl">
      <div className="mb-16 text-center">
        <h2 className="mb-4 text-3xl font-black uppercase tracking-wider text-cyan-400 md:text-4xl">FAQ</h2>
        <p className="text-gray-400">よくあるご質問</p>
      </div>

      <div className="space-y-4">
        {faqItems.map((item) => (
          <article key={item.question} className="rounded-2xl border border-white/5 bg-[#1C1C22] p-6">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
              <HelpCircle size={20} className="shrink-0 text-cyan-500" />
              {item.question}
            </h3>
            <p className="ml-7 text-sm leading-relaxed text-gray-400">{item.answer}</p>
          </article>
        ))}
      </div>

      <article className="mt-10 rounded-2xl border border-cyan-400/10 bg-[#1C1C22] p-6 text-center">
        <h3 className="mb-3 flex items-center justify-center gap-2 text-lg font-bold text-white">
          <Sparkles size={20} className="shrink-0 text-cyan-400" />
          Special Thanks
        </h3>
        <p className="text-sm leading-relaxed text-gray-400">
          アイコン/画像作成者:{" "}
          <a href="https://x.com/LotusRoad_" target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Lotus*
          </a>
        </p>
      </article>
    </div>
  </section>
);
