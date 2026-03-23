import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { FC } from "react";

const notes = [
  "対応OSは Windows のみです。",
  "外部トラッカーツールとの連携設定が必要です。",
  "beatmania IIDX INFINITAS の非公式ツールです。",
  "既知の制約・注意点は Issues を参照してください。",
];

export const NotesSection: FC = () => (
  <section className="bg-[#15151A] px-6 py-20">
    <div className="mx-auto max-w-4xl">
      <div className="mb-10 text-center">
        <h2 className="mb-4 text-3xl font-black uppercase tracking-wider text-cyan-400 md:text-4xl">Important Notes</h2>
        <p className="text-gray-400">導入前に確認しておきたい事項</p>
      </div>

      <article className="rounded-3xl border border-white/5 bg-[#1C1C22] p-8">
        <h3 className="mb-5 flex items-center gap-2 text-xl font-bold">
          <ShieldAlert size={22} className="text-cyan-400" />
          注意事項
        </h3>
        <ul className="space-y-3 text-sm leading-relaxed text-gray-300">
          {notes.map((note) => (
            <li key={note} className="flex items-start gap-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  </section>
);
