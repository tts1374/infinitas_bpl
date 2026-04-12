import { Music } from "lucide-react";
import type { ReactNode } from "react";
import SongSearchModal from "../../components/SongSearchModal";
import type { SongSearchModalSong } from "../../components/SongSearchModalView";
import type { RoomSong } from "./presentation-shared";

type RoomPickDecisionCutInProps = {
  song: RoomSong | null;
};

type RoomSearchModalGateProps = {
  modal?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (song: SongSearchModalSong) => void;
};

export function RoomPickDecisionCutIn({
  song,
}: RoomPickDecisionCutInProps): ReactNode {
  if (song === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-cyan-500/10 animate-pulse opacity-50" />
      <div className="w-full bg-black/90 border-y-4 border-cyan-500 h-64 relative flex items-center justify-center overflow-hidden animate-[in-out_3s_ease-in-out]">
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <span className="text-[200px] font-black italic tracking-tighter text-cyan-500">
            DECISION
          </span>
        </div>
        <div className="relative flex items-center gap-8 px-12 w-full max-w-5xl">
          <div className="w-32 h-32 bg-[#252526] border-4 border-cyan-500 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.4)]">
            <Music size={48} className="text-cyan-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-cyan-500 font-black italic tracking-[0.5em] text-lg mb-1 animate-bounce">
              TRACK DECIDED
            </p>
            <h2 className="text-xl lg:text-2xl font-black italic tracking-tighter text-white drop-shadow-lg leading-tight line-clamp-2 break-words whitespace-normal">
              {song.title}
            </h2>
            <p className="text-xl font-bold text-gray-400 mt-1 truncate">
              {song.artist}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-6xl font-black italic tracking-tighter text-cyan-500">
              Lv{song.level}
            </span>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes in-out {
              0% { transform: scaleY(0); opacity: 0; }
              10% { transform: scaleY(1); opacity: 1; }
              90% { transform: scaleY(1); opacity: 1; }
              100% { transform: scaleY(0); opacity: 0; }
            }
          `,
        }}
      />
    </div>
  );
}

export function RoomSearchModalGate({
  modal,
  isOpen,
  onClose,
  onSelect,
}: RoomSearchModalGateProps): ReactNode {
  return (
    modal ?? (
      <SongSearchModal isOpen={isOpen} onClose={onClose} onSelect={onSelect} />
    )
  );
}
