import React, { useEffect, useRef } from 'react';
import { Search, Music, ChevronRight } from 'lucide-react';

export const DIFFICULTIES = [
    { id: 'B', name: 'BEGINNER', color: 'bg-green-500' },
    { id: 'N', name: 'NORMAL', color: 'bg-blue-500' },
    { id: 'H', name: 'HYPER', color: 'bg-yellow-500' },
    { id: 'A', name: 'ANOTHER', color: 'bg-red-500' },
    { id: 'L', name: 'LEGGENDARIA', color: 'bg-purple-600' },
] as const;

export const LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface SongSearchModalSong {
    id?: string | number;
    title: string;
    artist: string;
    difficulty: string;
    level: number;
    genre?: string;
}

export interface SongSearchModalViewProps {
    isOpen: boolean;
    search: string;
    selectedDiff: string | null;
    selectedLevel: number | null;
    timeLeft: number;
    displayedSongs: SongSearchModalSong[];
    totalSongs: number;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onSearchChange: (value: string) => void;
    onToggleDiff: (difficultyId: string) => void;
    onToggleLevel: (level: number) => void;
    onSelect: (song: SongSearchModalSong) => void;
    onLoadMore?: () => void;
    searchPlaceholder?: string;
    subtitle?: string;
    footerLabel?: string;
}

export function SongSearchModalView({
    isOpen,
    search,
    selectedDiff,
    selectedLevel,
    timeLeft,
    displayedSongs,
    totalSongs,
    hasMore = false,
    isLoadingMore = false,
    onSearchChange,
    onToggleDiff,
    onToggleLevel,
    onSelect,
    onLoadMore,
    searchPlaceholder = 'Search by Title or Artist...',
    subtitle = 'Infinitas Arena Battle System',
    footerLabel = 'Project INFINITAS Arena',
}: SongSearchModalViewProps) {
    const listViewportRef = useRef<HTMLDivElement | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen || !hasMore || isLoadingMore || onLoadMore === undefined || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const sentinel = loadMoreRef.current;
        const root = listViewportRef.current;
        if (sentinel === null || root === null) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    onLoadMore();
                }
            },
            {
                root,
                rootMargin: '160px 0px',
            },
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [displayedSongs.length, hasMore, isLoadingMore, isOpen, onLoadMore]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative w-full max-w-2xl bg-[#1e1e1f] border border-white/10 rounded-3xl overflow-hidden flex flex-col h-[85vh] shadow-2xl">
                <header className="p-6 border-b border-white/5 bg-gradient-to-r from-cyan-500/20 to-transparent">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500 text-black rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                <Music size={20} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] leading-none">Pick Music</h2>
                                <span className="text-[9px] font-black text-cyan-500/80 tracking-widest uppercase mt-1">{subtitle}</span>
                            </div>
                        </div>

                        <div className={`flex flex-col items-end px-6 py-2 rounded-xl border-2 transition-all ${timeLeft <= 10 ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse' :
                            timeLeft <= 30 ? 'border-amber-500 bg-amber-500/10' :
                                'border-cyan-500/30 bg-cyan-500/5'
                            }`}>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Time Left</span>
                            <span className={`text-3xl font-mono font-black italic tracking-tighter leading-none ${timeLeft <= 10 ? 'text-red-500' :
                                timeLeft <= 30 ? 'text-amber-500' :
                                    'text-cyan-400'
                                }`}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500 group-focus-within:text-cyan-400 group-focus-within:drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] transition-all" size={20} />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            className="w-full bg-black/60 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 focus:bg-black/80 focus:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            autoFocus
                        />
                    </div>
                </header>

                <div className="p-6 bg-[#151516] border-b border-white/5 space-y-6">
                    <div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Difficulty</span>
                        <div className="flex gap-2">
                            {DIFFICULTIES.map(diff => (
                                <button
                                    key={diff.id}
                                    onClick={() => onToggleDiff(diff.id)}
                                    className={`flex-1 py-2 rounded-lg font-black italic text-xs transition-all border-2 ${selectedDiff === diff.id
                                        ? `${diff.color} border-white text-white scale-105 shadow-lg`
                                        : `bg-white/5 border-transparent text-gray-500 hover:bg-white/10`
                                        }`}
                                >
                                    {diff.id}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Level</span>
                        <div className="grid grid-cols-6 gap-2">
                            {LEVELS.map(level => (
                                <button
                                    key={level}
                                    onClick={() => onToggleLevel(level)}
                                    className={`py-2 rounded-lg font-black italic text-xs transition-all border-2 ${selectedLevel === level
                                        ? 'bg-cyan-500 border-white text-black scale-105 shadow-lg'
                                        : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                                        }`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div ref={listViewportRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {displayedSongs.length > 0 ? (
                        <>
                            {displayedSongs.map(song => (
                                <button
                                    key={song.id ?? `${song.title}:${song.difficulty}:${song.level}`}
                                    onClick={() => onSelect(song)}
                                    className="w-full group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/50 rounded-xl p-4 flex items-center gap-4 transition-all text-left"
                                >
                                    <div className="w-16 h-16 bg-[#252526] rounded-lg flex-shrink-0 relative overflow-hidden flex items-center justify-center border border-white/5">
                                        <Music size={24} className="text-gray-700" />
                                        <div className={`absolute bottom-0 right-0 left-0 h-1 ${DIFFICULTIES.find(d => d.id === song.difficulty)?.color ?? 'bg-slate-500'
                                            }`} />
                                    </div>

                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${DIFFICULTIES.find(d => d.id === song.difficulty)?.color ?? 'bg-slate-500'
                                                }`}>
                                                {song.difficulty}
                                            </span>
                                            <span className="text-[10px] font-black text-cyan-500 tracking-widest uppercase">{song.genre ?? '-'}</span>
                                        </div>
                                        <h3 className="text-lg font-black italic tracking-tighter truncate leading-tight text-white group-hover:text-cyan-400 transition-colors">
                                            {song.title}
                                        </h3>
                                        <p className="text-xs font-bold text-gray-400 truncate group-hover:text-gray-300 transition-colors">{song.artist}</p>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-2xl font-black italic tracking-tighter text-gray-500 group-hover:text-white transition-colors">
                                            Lv{song.level}
                                        </div>
                                        <ChevronRight size={16} className="text-gray-700 group-hover:text-cyan-500 ml-auto transition-colors" />
                                    </div>
                                </button>
                            ))}
                            {hasMore || isLoadingMore ? (
                                <div ref={loadMoreRef} className="flex items-center justify-center py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    {isLoadingMore ? 'Loading More...' : 'Scroll To Load More'}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-4 py-12">
                            <Search size={48} />
                            <p className="font-black italic tracking-widest uppercase">No Music Found</p>
                        </div>
                    )}
                </div>

                <footer className="p-4 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                        <span className="text-cyan-500">{totalSongs}</span> RESULTS LOADED
                        {hasMore ? <span className="text-amber-400">SCROLL FOR MORE</span> : null}
                    </div>
                    <span>{footerLabel}</span>
                </footer>
            </div>
        </div>
    );
}
