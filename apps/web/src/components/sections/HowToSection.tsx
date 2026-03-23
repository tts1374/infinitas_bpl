import { Download } from "lucide-react";
import type { FC } from "react";
import { assetPath } from "../../lib/config";
import { applySvgFallback } from "../../lib/image-fallback";

const settingsFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="250" viewBox="0 0 500 250"><rect fill="#2d2d30" width="500" height="250"/><text fill="#666" font-size="16" font-family="sans-serif" x="50%" y="50%" text-anchor="middle">ここに Settings 画像(5枚目)を配置</text></svg>`;
const lobbyFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="250" viewBox="0 0 500 250"><rect fill="#2d2d30" width="500" height="250"/><text fill="#666" font-size="16" font-family="sans-serif" x="50%" y="50%" text-anchor="middle">ここに Lobby 画像を配置</text></svg>`;

export const HowToSection: FC = () => (
  <section id="how-to-use" className="bg-[#111116] px-6 py-24">
    <div className="mx-auto max-w-6xl">
      <div className="mb-16 text-center">
        <h2 className="mb-4 text-3xl font-black uppercase tracking-wider text-cyan-400 md:text-4xl">How To Use</h2>
        <p className="text-gray-400">3ステップで準備完了</p>
      </div>

      <div className="space-y-12">
        <article className="flex flex-col items-center gap-8 rounded-3xl border border-white/5 bg-[#1C1C22] p-8 md:flex-row">
          <div className="flex-1 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/20 text-xl font-black text-cyan-400">
              1
            </div>
            <h3 className="text-2xl font-bold">アプリのダウンロードとインストール</h3>
            <p className="text-gray-400">
              当サイトから INFINITAS ARENA (Windows版) をダウンロードし、PCにインストール・起動します。
            </p>
          </div>
          <div className="flex w-full flex-1 items-center justify-center">
            <Download size={64} className="text-gray-700" />
          </div>
        </article>

        <article className="flex flex-col items-center gap-8 rounded-3xl border border-white/5 bg-[#1C1C22] p-8 md:flex-row-reverse">
          <div className="flex-1 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/20 text-xl font-black text-cyan-400">
              2
            </div>
            <h3 className="text-2xl font-bold">トラッカーとの連携（Settings）</h3>
            <p className="text-gray-400">
              別途用意したスコア読み取りツール（daken_counter_v3 など）を起動し、アプリ内の設定画面で監視先のポートや連携設定を行います。
            </p>
          </div>
          <div className="flex-1 w-full">
            <img
              src={assetPath("assets/lp/howto-settings.png")}
              alt="Settings"
              className="w-full rounded-xl border border-white/10 shadow-lg"
              onError={(event) => applySvgFallback(event, settingsFallback)}
            />
          </div>
        </article>

        <article className="flex flex-col items-center gap-8 rounded-3xl border border-cyan-500/20 bg-[#1C1C22] p-8 shadow-[0_0_50px_rgba(6,182,212,0.1)] md:flex-row">
          <div className="flex-1 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-xl font-black text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              3
            </div>
            <h3 className="text-2xl font-bold">ルームに入室・作成して対戦開始！</h3>
            <p className="text-gray-400">
              「Lobby Browser」から公開ロビーを探すか、自分で設定を決めてルームを作成。あとは選曲・プレイするだけです。
            </p>
          </div>
          <div className="flex-1 w-full">
            <img
              src={assetPath("assets/lp/feature-lobby.png")}
              alt="Lobby"
              className="w-full rounded-xl border border-cyan-500/20 shadow-lg"
              onError={(event) => applySvgFallback(event, lobbyFallback)}
            />
          </div>
        </article>
      </div>
    </div>
  </section>
);
