import React, { useState, useEffect, type ReactNode } from 'react';
import {
    User, CheckCircle2, Circle, LogOut,
    Database, Swords, Music, Copy, Check, Clock
} from 'lucide-react';
import SongSearchModal from './SongSearchModal';

export interface Song {
    id?: string | number;
    title: string;
    artist: string;
    playStyle?: string;
    level: string | number;
    difficulty?: string | undefined;
    genre?: string;
}

export interface HistoryItem {
    round: number;
    song: Song;
    scores: Record<string, number>;
    winnerId: string | 'DRAW';
}

export interface ResultPhasePlayerSummary {
    metricValue: number | null;
    stagePoints: number;
    totalPoints: number;
    outcome: 'WINNER' | 'LOSER' | 'DRAW';
}

export interface FinalResultPlayerSummary {
    totalPoints: number;
    isWinner: boolean;
}

interface RoomBPLProps {
    onNavigate?: (screen: string) => void;
    initialStatus?: 'WAITING' | 'SELECTING' | 'PLAYING' | 'RESULT' | 'CLOSED';
    controlled?: RoomBPLControlledState;
}

export interface RoomBPLPlayer {
    id: string;
    name: string;
    isReady: boolean;
    isHost: boolean;
    side: 'LEFT' | 'RIGHT';
}

export interface RoomBPLControlledState {
    roomStatus: 'WAITING' | 'SELECTING' | 'PLAYING' | 'RESULT' | 'CLOSED';
    isReady: boolean;
    closeReason: string;
    resultTimer: number;
    currentTurn: number;
    roundCount: number;
    picks: (Song | null)[];
    history: HistoryItem[];
    showSearch: boolean;
    lastPickedSong: Song | null;
    showCutIn: boolean;
    copiedId: boolean;
    copiedCode: boolean;
    lobbyTimer: number;
    roomId: string;
    joinCode: string;
    battleModeLabel?: string;
    playTime: number;
    playingPhase: 'MUSIC_SELECT' | 'PLAY_START' | 'IN_PLAY';
    playingCountdownSeconds?: number | null;
    playerStatus: Record<string, 'UNCONFIRMED' | 'PLAYED' | 'SKIPPED' | 'TIMEOUT'>;
    playerMetrics?: Record<string, number | null>;
    metricLabel?: string;
    resultPlayers?: Record<string, ResultPhasePlayerSummary>;
    resultRegulationLabel?: string;
    finalResultPlayers?: Record<string, FinalResultPlayerSummary>;
    finalWinningPlayerName?: string;
    isHost: boolean;
    players: RoomBPLPlayer[];
    selfPlayerId?: string;
    disablePrimaryAction?: boolean;
    disableLeave?: boolean;
    searchModal?: ReactNode;
    onCopyRoomId?: () => void;
    onCopyJoinCode?: () => void;
    onOpenSearch?: () => void;
    onPrimaryAction?: () => void;
    onSkip?: (playerId: string) => void;
    onProceedToResult?: () => void;
    onLeaveRoom?: () => void;
    onRemakeStage?: () => void;
}

export function RoomBPLPresentational(props: RoomBPLControlledState) {
    return <RoomBPL controlled={props} />;
}

const BPL_MUSIC_SELECT_SECONDS = 45;
const BPL_PLAY_START_SECONDS = 10;
const BPL_PLAY_BEGIN_SECONDS = BPL_MUSIC_SELECT_SECONDS + BPL_PLAY_START_SECONDS;

function maskJoinCode(joinCode: string): string {
    return '*'.repeat(joinCode.length);
}

function getDifficultyBadgeClass(difficulty: string | undefined): string {
    switch (difficulty) {
        case 'B':
            return 'bg-green-500 text-black shadow-[0_0_18px_rgba(34,197,94,0.35)]';
        case 'N':
            return 'bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]';
        case 'H':
            return 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.45)]';
        case 'A':
            return 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]';
        case 'L':
            return 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]';
        default:
            return 'bg-gray-600 text-white';
    }
}

function getDifficultyBadgeLabel(difficulty: string | undefined): string {
    switch (difficulty) {
        case 'B':
            return 'BEGINNER';
        case 'N':
            return 'NORMAL';
        case 'H':
            return 'HYPER';
        case 'A':
            return 'ANOTHER';
        case 'L':
            return 'LEGGENDARIA';
        default:
            return difficulty ?? '-';
    }
}

export default function RoomBPL({ onNavigate, initialStatus, controlled }: RoomBPLProps) {
    const [roomStatusState, setRoomStatus] = useState<'WAITING' | 'SELECTING' | 'PLAYING' | 'RESULT' | 'CLOSED'>(initialStatus || 'WAITING');
    const [isReadyState, setIsReady] = useState(initialStatus === 'SELECTING' || initialStatus === 'PLAYING' || initialStatus === 'RESULT' || initialStatus === 'CLOSED');
    const [closeReasonState, setCloseReason] = useState<string>('ALL_ROUNDS_COMPLETED');
    const [resultTimerState, setResultTimer] = useState(10);
    const [currentTurnState, setCurrentTurn] = useState(0); // 0: 1P, 1: 2P
    const [roundCountState, setRoundCount] = useState(1);
    const [picksState, setPicks] = useState<(Song | null)[]>([null, null, { title: '?????', artist: '', level: '??' }]);
    const [historyState, setHistory] = useState<HistoryItem[]>([]);
    const [showSearchState, setShowSearch] = useState(false);
    const [lastPickedSongState, setLastPickedSong] = useState<Song | null>(null);
    const [showCutInState, setShowCutIn] = useState(false);
    const [copiedIdState, setCopiedId] = useState(false);
    const [copiedCodeState, setCopiedCode] = useState(false);
    const [lobbyTimerState, setLobbyTimer] = useState(1200); // 20 minutes in seconds

    const roomId = controlled?.roomId ?? "";
    const joinCode = controlled?.joinCode ?? "";
    const battleModeLabel = controlled?.battleModeLabel ?? "";
    const hasJoinCode = joinCode.trim().length > 0;
    const maskedJoinCode = hasJoinCode ? maskJoinCode(joinCode) : '';

    const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const handleCopyRoomId = () => {
        if (controlled?.onCopyRoomId) {
            controlled.onCopyRoomId();
            return;
        }

        handleCopy(roomId, setCopiedId);
    };
    const handleCopyJoinCode = () => {
        if (controlled?.onCopyJoinCode) {
            controlled.onCopyJoinCode();
            return;
        }

        handleCopy(joinCode, setCopiedCode);
    };

    // PLAYING state logic
    const [playTimeState, setPlayTime] = useState(0);
    const [playingPhaseState, setPlayingPhase] = useState<'MUSIC_SELECT' | 'PLAY_START' | 'IN_PLAY'>('MUSIC_SELECT');
    const [playerStatusState, setPlayerStatus] = useState<Record<string, 'UNCONFIRMED' | 'PLAYED' | 'SKIPPED' | 'TIMEOUT'>>(
        initialStatus === 'PLAYING' ? {
            '1': 'PLAYED',
            '2': 'UNCONFIRMED'
        } : initialStatus === 'RESULT' ? {
            '1': 'PLAYED',
            '2': 'PLAYED'
        } : {
            '1': 'UNCONFIRMED',
            '2': 'UNCONFIRMED'
        }
    );

    // 初期化時にSELECTINGならモーダルを開く
    useEffect(() => {
        if (initialStatus === 'SELECTING') {
            setShowSearch(true);
        }
    }, [initialStatus]);

    const isHost = controlled?.isHost ?? true;

    const roomStatus = controlled?.roomStatus ?? roomStatusState;
    const isReady = controlled?.isReady ?? isReadyState;
    const closeReason = controlled?.closeReason ?? closeReasonState;
    const resultTimer = controlled?.resultTimer ?? resultTimerState;
    const currentTurn = controlled?.currentTurn ?? currentTurnState;
    const roundCount = controlled?.roundCount ?? roundCountState;
    const picks = controlled?.picks ?? picksState;
    const history = controlled?.history ?? historyState;
    const showSearch = controlled?.showSearch ?? showSearchState;
    const lastPickedSong = controlled?.lastPickedSong ?? lastPickedSongState;
    const showCutIn = controlled?.showCutIn ?? showCutInState;
    const copiedId = controlled?.copiedId ?? copiedIdState;
    const copiedCode = controlled?.copiedCode ?? copiedCodeState;
    const lobbyTimer = controlled?.lobbyTimer ?? lobbyTimerState;
    const playTime = controlled?.playTime ?? playTimeState;
    const playingPhase = controlled?.playingPhase ?? playingPhaseState;
    const playingCountdownSeconds = controlled?.playingCountdownSeconds ?? (
        playingPhase === 'MUSIC_SELECT' ? Math.max(0, BPL_MUSIC_SELECT_SECONDS - playTime) :
            playingPhase === 'PLAY_START' ? Math.max(0, BPL_PLAY_BEGIN_SECONDS - playTime) :
                Math.max(0, playTime - BPL_PLAY_BEGIN_SECONDS)
    );
    const playerStatus = controlled?.playerStatus ?? playerStatusState;
    const playerMetrics = controlled?.playerMetrics ?? {};
    const metricLabel = controlled?.metricLabel ?? 'EX SCORE';
    const resultPlayers = controlled?.resultPlayers ?? {};
    const resultRegulationLabel = controlled?.resultRegulationLabel ?? '3 STAGES';
    const finalResultPlayers = controlled?.finalResultPlayers ?? {};
    const currentPlayingSong = picks[roundCount - 1] || picks[2];
    const currentResultSong = picks[roundCount - 1] || picks[2];
    const currentPlayingSongPlayStyle = currentPlayingSong?.playStyle ?? '-';
    const currentPlayingSongDifficulty = currentPlayingSong?.difficulty ?? 'A';
    const currentPlayingSongLevel = currentPlayingSong?.level ?? '12';
    const currentResultSongPlayStyle = currentResultSong?.playStyle ?? '-';
    const currentResultSongDifficulty = currentResultSong?.difficulty ?? 'A';
    const currentResultSongLevel = currentResultSong?.level ?? '12';

    const players = controlled?.players ?? [
        { id: '1', name: 'HOST', isReady: true, isHost: true, side: 'LEFT' },
        { id: '2', name: 'GUEST', isReady: isReady, isHost: false, side: 'RIGHT' },
    ];
    const selfPlayerId = controlled?.selfPlayerId ?? (isHost ? '1' : '2');
    const finalWinningPlayerName = controlled?.finalWinningPlayerName ?? players[0]?.name ?? '';

    const handleStartMatch = () => {
        if (controlled?.onPrimaryAction) {
            controlled.onPrimaryAction();
            return;
        }

        if (players.every(p => p.isReady)) {
            setRoomStatus('SELECTING');
            setCurrentTurn(0);
        }
    };

    const handleSelectSong = (song: Song) => {
        const newPicks = [...picks];
        newPicks[currentTurn] = song;
        setPicks(newPicks);
        setShowSearch(false);
        setLastPickedSong(song);
        setShowCutIn(true);

        // 3秒後にカットインを消し、次のターンへ（あるいは終了）
        setTimeout(() => {
            setShowCutIn(false);
            if (currentTurn === 0) {
                setCurrentTurn(1);
            } else {
                // 両者の選曲が完了したら PLAYING へ
                setRoomStatus('PLAYING');
                setPlayTime(0);
                setPlayingPhase('MUSIC_SELECT');
            }
        }, 3000);
    };

    // RESULT タイム管理 (10秒で自動遷移)
    useEffect(() => {
        if (roomStatus !== 'RESULT') {
            setResultTimer(10);
            return;
        }

        const interval = setInterval(() => {
            setResultTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    finalizeRound();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [roomStatus]);

    // Lobby Timer management
    useEffect(() => {
        if (roomStatus !== 'WAITING') return;

        const interval = setInterval(() => {
            setLobbyTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setRoomStatus('CLOSED');
                    setCloseReason('LOBBY_TIMEOUT');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [roomStatus]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // PLAYING タイム管理
    useEffect(() => {
        if (roomStatus !== 'PLAYING') return;

        const interval = setInterval(() => {
            setPlayTime(prev => {
                const next = prev + 1;

                // フェーズ遷移
                if (next < BPL_MUSIC_SELECT_SECONDS) setPlayingPhase('MUSIC_SELECT');
                else if (next < BPL_PLAY_BEGIN_SECONDS) setPlayingPhase('PLAY_START');
                else setPlayingPhase('IN_PLAY');

                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [roomStatus]);

    const handleSkip = (playerId: string) => {
        if (controlled?.onSkip) {
            controlled.onSkip(playerId);
            return;
        }

        setPlayerStatus(prev => ({ ...prev, [playerId]: 'SKIPPED' }));
    };

    const finalizeRound = () => {
        const currentSong = picks[roundCount - 1] || picks[2];
        if (!currentSong) return;

        const mockScores: Record<string, number> = {
            '1': Math.floor(Math.random() * 2000) + 1000,
            '2': Math.floor(Math.random() * 2000) + 1000
        };

        const leftScore = mockScores['1'] ?? 0;
        const rightScore = mockScores['2'] ?? 0;
        const winnerId = leftScore > rightScore ? '1' : leftScore < rightScore ? '2' : 'DRAW';

        const newItem: HistoryItem = {
            round: roundCount,
            song: currentSong,
            scores: mockScores,
            winnerId
        };

        setHistory(prev => [newItem, ...prev]);

        if (roundCount < 3) {
            setRoundCount(prev => prev + 1);
            setRoomStatus('PLAYING');
            setPlayTime(0);
            setPlayerStatus({ '1': 'UNCONFIRMED', '2': 'UNCONFIRMED' });
            setCurrentTurn(prev => (prev + 1) % 2); // ターン交代
        } else {
            setRoundCount(1);
            setRoomStatus('CLOSED');
            setCloseReason('ALL_ROUNDS_COMPLETED');
        }
    };

    const handleProceedToResult = () => {
        if (controlled?.onProceedToResult) {
            controlled.onProceedToResult();
            return;
        }

        setRoomStatus('RESULT');
    };

    const _currentSong = picks[0]; // TODO: 本来はラウンドに応じた曲を表示
    const leftPlayer = players[0] ?? { id: '1', name: 'HOST', isReady: false, isHost: true, side: 'LEFT' as const };
    const rightPlayer = players[1] ?? { id: '2', name: 'GUEST', isReady: false, isHost: false, side: 'RIGHT' as const };
    const leftPickLabel = leftPlayer.name ? `${leftPlayer.name}'S PICK` : '1ST PICK';
    const rightPickLabel = rightPlayer.name ? `${rightPlayer.name}'S PICK` : '2ND PICK';

    return (
        <div className="flex h-screen w-screen bg-[#0f0f10] text-white font-sans overflow-hidden">

            {/* 決定カットイン演出 */}
            {showCutIn && lastPickedSong && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-cyan-500/10 animate-pulse opacity-50" />
                    <div className="w-full bg-black/90 border-y-4 border-cyan-500 h-64 relative flex items-center justify-center overflow-hidden animate-[in-out_3s_ease-in-out]">
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <span className="text-[200px] font-black italic tracking-tighter text-cyan-500">DECISION</span>
                        </div>
                        <div className="relative flex items-center gap-8 px-12 w-full max-w-5xl">
                            <div className="w-32 h-32 bg-[#252526] border-4 border-cyan-500 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.4)]">
                                <Music size={48} className="text-cyan-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-cyan-500 font-black italic tracking-[0.5em] text-lg mb-1 animate-bounce">TRACK DECIDED</p>
                                <h2 className="text-xl lg:text-2xl font-black italic tracking-tighter text-white drop-shadow-lg leading-tight line-clamp-2 break-words whitespace-normal">{lastPickedSong.title}</h2>
                                <p className="text-xl font-bold text-gray-400 mt-1 truncate">{lastPickedSong.artist}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-6xl font-black italic tracking-tighter text-cyan-500">Lv{lastPickedSong.level}</span>
                            </div>
                        </div>
                    </div>

                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes in-out {
                            0% { transform: scaleY(0); opacity: 0; }
                            10% { transform: scaleY(1); opacity: 1; }
                            90% { transform: scaleY(1); opacity: 1; }
                            100% { transform: scaleY(0); opacity: 0; }
                        }
                    `}} />
                </div>
            )}

            {controlled?.searchModal ?? (
                <SongSearchModal
                    isOpen={showSearch}
                    onClose={() => setShowSearch(false)}
                    onSelect={handleSelectSong}
                />
            )}

            {/* メイン対峙エリア */}
            <main className="flex-1 flex flex-col p-8 relative overflow-hidden">
                {/* HUD: Room Details (Top Left Stack) */}
                <div className="absolute top-4 left-6 flex flex-col gap-2 z-10 pointer-events-auto">
                        <div className="bg-black/60 border border-white/10 backdrop-blur-md rounded-lg px-3 py-2 flex flex-col min-w-[200px]">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-0.5">Room ID</span>
                            <div className="flex items-center justify-between gap-3">
                            <span className="font-mono font-bold text-cyan-500 text-xs truncate max-w-[120px]">{roomId || '-'}</span>
                            <button
                                onClick={handleCopyRoomId}
                                className="text-gray-500 hover:text-cyan-400 transition-colors flex-shrink-0"
                            >
                                {copiedId ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                        </div>
                    </div>
                    {hasJoinCode && (
                        <div className="bg-black/60 border border-white/10 backdrop-blur-md rounded-lg px-3 py-2 flex flex-col min-w-[200px]">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-0.5">Join Code</span>
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-mono font-bold text-amber-500/50 text-sm tracking-[0.2em] truncate">{maskedJoinCode}</span>
                                <button
                                    onClick={handleCopyJoinCode}
                                    className="text-gray-500 hover:text-amber-400 transition-colors flex-shrink-0"
                                >
                                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* HUD: Timer (Top Right) - Only show in WAITING state */}
                {roomStatus === 'WAITING' && (
                    <div className="absolute top-4 right-6 z-10 pointer-events-auto">
                        <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-lg px-3 py-1.5 flex flex-col min-w-[80px] items-center">
                            <span className="text-[8px] font-black text-red-400 uppercase tracking-tighter flex items-center gap-1">
                                <Clock size={8} /> Lobby TTL
                            </span>
                            <span className={`font-mono font-bold text-xs ${lobbyTimer < 60 ? 'text-red-500 animate-pulse' : 'text-gray-300'}`}>
                                {formatTime(lobbyTimer)}
                            </span>
                        </div>
                    </div>
                )}

                {/* 上部：BPLシリーズ ロゴ風ヘッダー */}
                <header className="flex justify-center mb-6">
                    <div className="flex items-center gap-6 bg-gradient-to-b from-[#252526] to-transparent px-12 py-4 rounded-b-3xl border-x border-b border-white/5">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em]">Battle Mode</p>
                            <h2 className="text-2xl font-black italic tracking-tighter whitespace-nowrap">{battleModeLabel || '-'}</h2>
                        </div>
                        <div className="h-10 w-[1px] bg-white/10"></div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Regulation</p>
                            <h2 className="text-2xl font-black italic tracking-tighter text-gray-300 whitespace-nowrap">3 STAGES</h2>
                        </div>
                    </div>
                </header>

                {/* 中央：VS 対峙セクション */}
                <div className="flex-1 flex items-center justify-between gap-8 relative px-10">

                    {/* 背景の巨大な "VS" タイポグラフィ */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[250px] font-black italic text-white/[0.02] select-none tracking-tighter">VS</span>
                    </div>

                    {/* 左プレイヤー (1P) */}
                    <div className={`flex-1 max-w-[400px] flex flex-col gap-4 transition-all ${leftPlayer.isReady ? 'scale-105' : ''}`}>
                        <div className={`h-[320px] rounded-3xl border-4 relative overflow-hidden flex flex-col items-center justify-center transition-all ${leftPlayer.isReady
                            ? (roomStatus === 'SELECTING' && currentTurn === 0 ? 'bg-cyan-500/20 border-white shadow-[0_0_80px_rgba(6,182,212,0.4)] ring-4 ring-cyan-500 ring-opacity-50' : 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.2)]')
                            : 'bg-[#252526] border-white/10'
                            }`}>
                            {roomStatus === 'SELECTING' && currentTurn === 0 && (
                                <div className="absolute top-0 left-0 right-0 bg-cyan-500 text-black text-center py-1 font-black italic text-xs tracking-[0.3em] animate-pulse">
                                    YOUR TURN
                                </div>
                            )}
                            <div className={`p-8 rounded-full mb-4 ${leftPlayer.isReady ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                <User size={80} />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tight">{leftPlayer.name}</h3>
                            <p className="text-xs font-bold text-cyan-500 mt-2 uppercase tracking-widest">Host / 1st Player</p>

                            {/* ステータスバッジ */}
                            <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase">READY</span>
                            </div>
                        </div>
                        {leftPlayer.isReady && roomStatus === 'WAITING' && (
                            <div className="flex items-center justify-center gap-2 text-cyan-400 font-black italic animate-pulse">
                                <CheckCircle2 size={24} /> READY
                            </div>
                        )}
                        {roomStatus === 'SELECTING' && currentTurn === 0 && (
                            <button
                                onClick={() => {
                                    if (controlled?.onOpenSearch) {
                                        controlled.onOpenSearch();
                                        return;
                                    }

                                    setShowSearch(true);
                                }}
                                className="bg-cyan-500 text-black py-4 rounded-2xl font-black italic text-xl shadow-lg shadow-cyan-500/20 hover:scale-105 transition-transform active:scale-95"
                            >
                                SELECT MUSIC
                            </button>
                        )}
                    </div>

                    {/* 中央：VSエンブレム */}
                    <div className="z-10 bg-white text-black w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] border-8 border-[#0f0f10]">
                        <Swords size={32} />
                    </div>

                    {/* 右プレイヤー (2P) */}
                    <div className={`flex-1 max-w-[400px] flex flex-col gap-4 transition-all ${rightPlayer.isReady ? 'scale-105' : ''}`}>
                        <div className={`h-[320px] rounded-3xl border-4 relative overflow-hidden flex flex-col items-center justify-center transition-all ${rightPlayer.isReady
                            ? (roomStatus === 'SELECTING' && currentTurn === 1 ? 'bg-amber-500/20 border-white shadow-[0_0_80px_rgba(245,158,11,0.4)] ring-4 ring-amber-500 ring-opacity-50' : 'bg-amber-500/10 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.2)]')
                            : 'bg-[#252526] border-white/10'
                            }`}>
                            {roomStatus === 'SELECTING' && currentTurn === 1 && (
                                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-black text-center py-1 font-black italic text-xs tracking-[0.3em] animate-pulse">
                                    RIVAL'S TURN
                                </div>
                            )}
                            <div className={`p-8 rounded-full mb-4 ${rightPlayer.isReady ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                <User size={80} />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tight">{rightPlayer.name}</h3>
                            <p className="text-xs font-bold text-amber-500 mt-2 uppercase tracking-widest">Guest / 2nd Player</p>

                            <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase">READY</span>
                            </div>
                        </div>
                        {rightPlayer.isReady && roomStatus === 'WAITING' ? (
                            <div className="flex items-center justify-center gap-2 text-amber-500 font-black italic animate-pulse">
                                <CheckCircle2 size={24} /> READY
                            </div>
                        ) : roomStatus === 'WAITING' && (
                            <div className="flex items-center justify-center gap-2 text-gray-600 font-black italic">
                                <Circle size={24} /> WAITING...
                            </div>
                        )}
                        {roomStatus === 'SELECTING' && currentTurn === 1 && (
                            <div className="bg-amber-500/10 text-amber-500 py-4 rounded-2xl font-black italic text-xl border-2 border-amber-500/50 text-center animate-pulse">
                                SELECTING...
                            </div>
                        )}
                    </div>
                </div>

                {/* 下部：ストラテジーエリア（BO3用） */}
                {roomStatus !== 'PLAYING' ? (
                    <footer className="mt-4 grid grid-cols-4 gap-4 h-28">
                        <div className={`rounded-2xl border p-3 flex flex-col justify-center transition-all ${picks[0] ? 'bg-cyan-500/10 border-cyan-500' : 'bg-[#1a1a1b] border-white/5'}`}>
                            <span className="text-[9px] font-black text-gray-500 uppercase mb-0.5">1st Match</span>
                            <div className="flex flex-col font-bold">
                                <span className={picks[0] ? 'text-white text-lg font-black italic truncate' : 'text-cyan-400/50'}>
                                    {picks[0] ? picks[0].title : leftPickLabel}
                                </span>
                                {picks[0]?.artist ? <span className="text-[10px] text-cyan-500 font-black italic tracking-widest truncate">{picks[0].artist}</span> : null}
                            </div>
                        </div>
                        <div className={`rounded-2xl border p-3 flex flex-col justify-center transition-all ${picks[1] ? 'bg-amber-500/10 border-amber-500' : 'bg-[#1a1a1b] border-white/5 border-dashed'}`}>
                            <span className="text-[9px] font-black text-gray-500 uppercase mb-0.5">2nd Match</span>
                            <div className="flex flex-col font-bold">
                                <span className={picks[1] ? 'text-white text-lg font-black italic truncate' : 'text-amber-500/50'}>
                                    {picks[1] ? picks[1].title : rightPickLabel}
                                </span>
                                {picks[1]?.artist ? <span className="text-[10px] text-amber-500 font-black italic tracking-widest leading-none truncate">{picks[1].artist}</span> : null}
                            </div>
                        </div>
                        {/* 3rd STAGE: RANDOM PICK (????? 表示) */}
                        <div className="bg-gradient-to-br from-[#1a1a1b] to-[#2a1010] border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] rounded-2xl p-3 flex flex-col justify-center items-center relative group overflow-hidden font-sans animate-pulse">
                            <div className="absolute text-red-500/10 font-black text-6xl italic -right-2 -bottom-4 select-none">?</div>

                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-0.5">Final STAGE</span>
                            <div className="flex flex-col items-center gap-0">
                                <span className="text-xl font-black italic tracking-[0.2em] text-red-600">?????</span>
                                <span className="text-[8px] font-bold text-red-900 uppercase">System Random</span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-center">
                            <button
                                onClick={() => {
                                    if (controlled?.onPrimaryAction) {
                                        controlled.onPrimaryAction();
                                        return;
                                    }

                                    if (roomStatus === 'WAITING') {
                                        if (isHost) handleStartMatch();
                                        else setIsReady(!isReady);
                                    }
                                }}
                                disabled={controlled?.disablePrimaryAction ?? false}
                                className={`w-full h-full rounded-xl font-black italic text-xl transition-all active:scale-95 ${roomStatus === 'SELECTING'
                                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                    : ((controlled?.disablePrimaryAction ?? false)
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                        : (isHost
                                        ? (players.every(p => p.isReady) ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 shadow-cyan-500/50' : 'bg-gray-800 text-gray-500 cursor-not-allowed')
                                        : (isReady ? 'border-2 border-amber-500 text-amber-500' : 'bg-white text-black shadow-xl'))
                                        )
                                    }`}
                            >
                                {roomStatus === 'SELECTING' ? 'SELECTING...' : (isHost ? 'START MATCH' : (isReady ? 'READY OK' : 'READY UP'))}
                            </button>
                        </div>
                    </footer>
                ) : (
                    <div className="absolute inset-0 z-40 bg-[#0f0f10] flex flex-col p-12">
                        {/* PLAYING HEADER */}
                        <div className="flex justify-between items-start mb-12">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-4">
                                    <span className="bg-white text-black px-4 py-1 font-black italic text-2xl tracking-tighter">{roundCount}{roundCount === 1 ? 'st' : roundCount === 2 ? 'nd' : 'rd'} STAGE</span>
                                    <div className="h-8 w-[2px] bg-white/20" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-500 tracking-widest">ROUND PROGRESS</span>
                                        <div className="flex items-center gap-2">
                                            {[...Array(10)].map((_, i) => (
                                                <div key={i} className={`h-1.5 w-6 rounded-full ${i < (playTime / 120 * 10) ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-white/5'}`} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8">
                                    <h2 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] line-clamp-2 leading-tight break-all">
                                        {currentPlayingSong?.title || (roundCount === 3 ? "SYSTEM RANDOM (MAX 300)" : "Unknown Track")}
                                    </h2>
                                    <div className="flex flex-wrap items-center gap-4 mt-1">
                                        <span className="text-xl font-bold text-gray-500 tracking-widest truncate max-w-xl">{currentPlayingSong?.artist || '-'}</span>
                                        <div className="h-4 w-[1px] bg-white/20" />
                                        <span className="text-sm font-black italic tracking-[0.25em] text-gray-300">{currentPlayingSongPlayStyle}</span>
                                        <span className={`${getDifficultyBadgeClass(currentPlayingSongDifficulty)} px-3 py-1 rounded-full text-xs font-black italic tracking-[0.2em]`}>{getDifficultyBadgeLabel(currentPlayingSongDifficulty)}</span>
                                        <span className="text-3xl font-black italic tracking-tighter text-cyan-500">Lv{currentPlayingSongLevel}</span>
                                    </div>
                                </div>
                            </div>

                            {/* MAIN TIMER */}
                            <div className="flex flex-col items-end">
                                <div className={`p-6 rounded-3xl border-4 flex flex-col items-center justify-center min-w-[320px] transition-all ${playingPhase === 'MUSIC_SELECT' ? 'border-cyan-500 bg-cyan-500/5 shadow-[0_0_50px_rgba(6,182,212,0.2)]' :
                                    playingPhase === 'PLAY_START' ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_50px_rgba(245,158,11,0.2)]' :
                                        'border-red-500 bg-red-500/5 shadow-[0_0_50px_rgba(239,68,68,0.2)]'
                                    }`}>
                                    <span className={`text-sm font-black italic tracking-[0.3em] mb-2 ${playingPhase === 'MUSIC_SELECT' ? 'text-cyan-500' :
                                        playingPhase === 'PLAY_START' ? 'text-amber-500' :
                                            'text-red-500'
                                        }`}>
                                        {playingPhase === 'MUSIC_SELECT' ? 'MUSIC SELECT' :
                                            playingPhase === 'PLAY_START' ? 'PLAY START' : 'IN PLAY'}
                                    </span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-8xl font-black italic tracking-tighter font-mono">
                                            {playingCountdownSeconds}
                                        </span>
                                        <span className="text-2xl font-black text-gray-600 uppercase">sec</span>
                                    </div>

                                    {/* Notifications Mock */}
                                    <div className="mt-4 flex flex-col items-center min-h-[2.5rem] justify-center">
                                        {playTime >= BPL_MUSIC_SELECT_SECONDS - 10 && playTime < BPL_MUSIC_SELECT_SECONDS && (
                                            <div className="flex gap-1 animate-pulse">
                                                {[...Array(5)].map((_, i) => (
                                                    <div key={i} className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                                                ))}
                                                <span className="text-[10px] font-black text-cyan-400 ml-2">TIME SYNC BEEP</span>
                                            </div>
                                        )}
                                        {playTime >= BPL_PLAY_BEGIN_SECONDS - 3 && playTime < BPL_PLAY_BEGIN_SECONDS && (
                                            <div className="flex gap-1 animate-pulse">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
                                                ))}
                                                <span className="text-[10px] font-black text-red-500 ml-2 uppercase">Ready... GO!</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PLAYER STATUS GRID */}
                        <div className="grid grid-cols-2 gap-8 flex-1">
                            {players.map(p => (
                                <div key={p.id} className={`rounded-3xl border-4 p-6 flex flex-col justify-between transition-all ${playerStatus[p.id] === 'PLAYED' ? 'border-green-500 bg-green-500/5' :
                                    playerStatus[p.id] === 'SKIPPED' ? 'border-gray-500 bg-gray-500/5' :
                                        playerStatus[p.id] === 'TIMEOUT' ? 'border-red-900 bg-red-900/10' :
                                            'border-white/10 bg-white/5'
                                    }`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-4 rounded-full ${p.id === '1' ? 'bg-cyan-500 text-black' : 'bg-amber-500 text-black'}`}>
                                                <User size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black italic tracking-tighter">{p.name}</h3>
                                            </div>
                                        </div>

                                        <div className={`px-4 py-1.5 rounded-full font-black italic tracking-widest text-sm ${playerStatus[p.id] === 'PLAYED' ? 'bg-green-500 text-black' :
                                            playerStatus[p.id] === 'SKIPPED' ? 'bg-gray-700 text-white' :
                                                playerStatus[p.id] === 'TIMEOUT' ? 'bg-red-900 text-white' :
                                                    'bg-white/10 text-gray-500'
                                            } whitespace-nowrap`}>
                                            {playerStatus[p.id]}
                                        </div>
                                    </div>

                                    {/* Action Area */}
                                    <div className="flex gap-4">
                                        {playerStatus[p.id] === 'UNCONFIRMED' && (
                                            <>
                                                {p.id === selfPlayerId ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSkip(p.id)}
                                                            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-2xl font-black italic tracking-widest transition-all text-sm"
                                                        >
                                                            SKIP
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex-1 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase animate-pulse">Waiting for result...</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {playerStatus[p.id] === 'PLAYED' && (
                                            <div className="flex-1 flex flex-col items-center">
                                                <span className="text-[8px] font-black text-green-500 uppercase tracking-[0.3em] mb-1">Match Statistics</span>
                                                <div className="text-4xl font-black italic tracking-tighter text-white">
                                                    {playerMetrics[p.id] ?? '-'} <span className="text-lg text-gray-500 font-sans">{metricLabel}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* HOST CONTROL BAR */}
                        {isHost && playingPhase === 'IN_PLAY' && playTime >= (240 + BPL_PLAY_BEGIN_SECONDS) && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-10 py-3 rounded-full border-2 border-red-500/30 text-xs font-black italic tracking-[0.3em] transition-all uppercase shadow-lg shadow-red-600/20"
                                    onClick={handleProceedToResult}
                                >
                                    FORCE FINALIZE MATCH
                                </button>
                            </div>
                        )}
                    </div>
                )
                }

                {
                    roomStatus === 'RESULT' && (
                        <div className="fixed inset-0 z-[100] bg-[#0f0f10] flex flex-col p-6 overflow-hidden animate-in zoom-in-95 duration-500">
                            {/* 背景装飾 */}
                            <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
                                <span className="text-[150px] font-black italic tracking-tighter leading-none">RESULT</span>
                            </div>

                            <header className="flex justify-between items-start mb-4 relative">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500 text-black px-4 py-0.5 font-black italic text-xl tracking-tighter uppercase">Stage Result</div>
                                        <span className="text-lg font-bold text-gray-500 tracking-[0.2em] uppercase">STAGE {roundCount}</span>
                                    </div>
                                    <div className="mt-2 text-left">
                                        <h2 className="text-3xl font-black italic tracking-tighter text-white leading-tight drop-shadow-2xl line-clamp-1">
                                            {currentResultSong?.title || 'System Random'}
                                        </h2>
                                        <div className="mt-1 flex flex-wrap items-center gap-3 max-w-xl">
                                            <p className="text-base font-bold text-gray-400 truncate">{currentResultSong?.artist || '-'}</p>
                                            <div className="h-4 w-[1px] bg-white/20" />
                                            <span className="text-xs font-black italic tracking-[0.25em] text-gray-300">{currentResultSongPlayStyle}</span>
                                            <span className={`${getDifficultyBadgeClass(currentResultSongDifficulty)} px-3 py-1 rounded-full text-xs font-black italic tracking-[0.2em]`}>{getDifficultyBadgeLabel(currentResultSongDifficulty)}</span>
                                            <span className="text-2xl font-black italic tracking-tighter text-cyan-500">Lv{currentResultSongLevel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-4 mb-4">
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] italic">Auto-next in</span>
                                        <span className="text-5xl font-black italic text-white font-mono">{resultTimer}s</span>
                                    </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-center gap-6 backdrop-blur-xl">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-500 uppercase">Battle Mode</p>
                                            <p className="text-xl font-black italic tracking-tighter">{battleModeLabel}</p>
                                        </div>
                                        <div className="w-[1px] h-10 bg-white/10" />
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-gray-500 uppercase">Regulation</p>
                                            <p className="text-xl font-black italic tracking-tighter text-amber-400">{resultRegulationLabel}</p>
                                        </div>
                                    </div>
                                </div>
                            </header>
                            <div className="flex-1 flex gap-6 items-center px-4 relative">
                                {players.map((p) => {
                                    const resultPlayer = resultPlayers[p.id];
                                    const isWinner = resultPlayer?.outcome === 'WINNER';
                                    const isDraw = resultPlayer?.outcome === 'DRAW';
                                    return (
                                        <div key={p.id} className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border-4 transition-all ${isWinner
                                            ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_80px_rgba(245,158,11,0.2)]'
                                            : isDraw
                                                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_80px_rgba(6,182,212,0.18)]'
                                                : 'bg-white/5 border-white/10 opacity-60'
                                            }`}>
                                            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center bg-gray-900 ${isWinner
                                                ? 'border-amber-500'
                                                : isDraw
                                                    ? 'border-cyan-500'
                                                    : 'border-gray-800'
                                                }`}>
                                                <User size={48} className={isWinner ? 'text-amber-500' : isDraw ? 'text-cyan-400' : 'text-gray-700'} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl font-black italic tracking-tighter mb-0.5">{isWinner ? 'STAGE WINNER' : isDraw ? 'DRAW GAME' : 'CONTENDER'}</p>
                                                <p className="text-base font-bold text-gray-400 uppercase tracking-widest">{p.name}</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{metricLabel}</span>
                                                <span className={`text-5xl font-black italic leading-none ${isWinner || isDraw ? 'text-white' : 'text-gray-700'}`}>
                                                    {resultPlayer?.metricValue ?? '-'}
                                                </span>
                                            </div>
                                            <div className="flex gap-3 w-full">
                                                <div className="flex-1 bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center">
                                                    <span className="text-[8px] font-black text-gray-500 uppercase mb-0.5">Win Pts</span>
                                                    <span className={`text-xl font-black italic ${isWinner ? 'text-amber-500' : isDraw ? 'text-cyan-400' : 'text-white'}`}>+{resultPlayer?.stagePoints ?? 0}</span>
                                                </div>
                                                <div className="flex-1 bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center">
                                                    <span className="text-[8px] font-black text-gray-500 uppercase mb-0.5">Total</span>
                                                    <span className="text-xl font-black italic text-white">{resultPlayer?.totalPoints ?? 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <div className="bg-white/10 backdrop-blur-3xl p-6 rounded-full border border-white/20 shadow-2xl">
                                        <Swords size={60} className="text-white animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    roomStatus === 'CLOSED' && (
                        <div className="fixed inset-0 z-[120] bg-[#050505] flex flex-col p-10 animate-in fade-in duration-1000 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/20 to-transparent pointer-events-none" />

                            <header className="flex justify-between items-start mb-12 relative">
                                <div className="flex flex-col gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="bg-white text-black px-6 py-2 font-black italic text-2xl tracking-tighter uppercase shadow-[0_0_30px_rgba(255,255,255,0.2)]">Match Closed</div>
                                        <div className="h-10 w-[2px] bg-white/20" />
                                        <span className="text-xl font-bold text-gray-500 tracking-[0.4em] uppercase">{closeReason}</span>
                                    </div>
                                    <h2 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 leading-tight uppercase">FINAL RESULT</h2>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.5em] mb-2">Official League Record</p>
                                    <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 backdrop-blur-3xl shadow-2xl">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Winning Player</p>
                                        <p className="text-3xl font-black italic tracking-tighter text-cyan-400">{finalWinningPlayerName || '-'}</p>
                                    </div>
                                </div>
                            </header>

                            <div className="flex-1 flex gap-12 items-center px-10 relative">
                                {players.map((p) => {
                                    const finalResultPlayer = finalResultPlayers[p.id];
                                    const totalPts = finalResultPlayer?.totalPoints ?? 0;
                                    const isWinner = finalResultPlayer?.isWinner ?? false;
                                    return (
                                        <div key={p.id} className={`flex-1 flex flex-col items-center gap-4 p-6 rounded-3xl border-4 transition-all hover:scale-105 ${isWinner ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_100px_rgba(6,182,212,0.2)]' : 'bg-white/5 border-white/10 opacity-60'
                                            }`}>
                                            <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center bg-gray-900 ${isWinner ? 'border-cyan-500' : 'border-gray-800'}`}>
                                                <User size={60} className={isWinner ? 'text-cyan-400' : 'text-gray-700'} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black italic tracking-tighter mb-0.5">{isWinner ? 'CONGRATULATIONS' : 'TOTAL STATS'}</p>
                                                <p className="text-lg font-bold text-gray-400 uppercase tracking-widest">{p.name}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.6em]">Cumulative Points</span>
                                                <span className={`text-6xl font-black italic leading-none ${isWinner ? 'text-white' : 'text-gray-600'}`}>{totalPts}<span className="text-xl">pts</span></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <footer className="mt-12 flex justify-center gap-8 relative z-10">
                                <button
                                    onClick={() => {
                                        if (controlled?.onLeaveRoom) {
                                            controlled.onLeaveRoom();
                                            return;
                                        }

                                        onNavigate?.('BROWSER');
                                    }}
                                    className="px-12 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black italic text-xl rounded-2xl transition-all active:scale-95 shadow-[0_0_40px_rgba(6,182,212,0.3)] uppercase tracking-tighter"
                                >
                                    Leave Arena
                                </button>
                                {isHost && (
                                    <button
                                        onClick={() => {
                                            if (controlled?.onRemakeStage) {
                                                controlled.onRemakeStage();
                                                return;
                                            }

                                            setRoomStatus('WAITING');
                                        }}
                                        className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-black italic text-base rounded-2xl transition-all border-2 border-white/10 uppercase tracking-tighter backdrop-blur-xl"
                                    >
                                        Remake Stage
                                    </button>
                                )}
                            </footer>
                        </div>
                    )
                }
            </main >

            {/* 右サイドバー：対戦履歴など */}
            {
                roomStatus !== 'CLOSED' && (
                    <aside className="w-[320px] bg-[#151516] border-l border-white/5 p-6 flex flex-col gap-6">

                        <div className="flex-1 bg-[#1a1a1b] rounded-2xl border border-white/5 p-4 overflow-hidden flex flex-col">
                            <p className="text-[10px] font-black text-gray-600 uppercase mb-4 flex items-center gap-2">
                                <Database size={14} /> Match History
                            </p>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                                {history.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50 space-y-4">
                                        <Music size={48} strokeWidth={1} />
                                        <div className="text-center px-4">
                                            <p className="font-bold uppercase tracking-widest text-[10px]">No records found</p>
                                            <p className="text-[9px] italic">Results will appear here after each round</p>
                                        </div>
                                    </div>
                                ) : (
                                    history.map((item, idx) => (
                                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-cyan-500/50 transition-all group animate-in slide-in-from-right duration-500">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-black text-cyan-500 uppercase tracking-tighter italic">RD {item.round}</span>
                                                <span className="text-[9px] font-black text-gray-500 uppercase">{metricLabel}</span>
                                            </div>
                                            <div className="mb-2">
                                                <h4 className="font-bold text-xs text-white truncate group-hover:text-cyan-400 transition-colors italic">{item.song.title}</h4>
                                            </div>
                                            <div className="space-y-1">
                                                {['1', '2'].map(pid => (
                                                    <div key={pid} className={`flex justify-between items-center px-2 py-1 rounded ${item.winnerId === pid ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-white/5 border border-transparent'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-black ${item.winnerId === pid ? 'text-cyan-400' : 'text-gray-500'}`}>P{pid}</span>
                                                            {item.winnerId === pid && <span className="bg-cyan-500 text-black px-1 rounded text-[7px] font-black italic">WIN</span>}
                                                        </div>
                                                        <span className={`font-mono font-bold text-[11px] ${item.winnerId === pid ? 'text-cyan-400' : 'text-gray-400'}`}>{item.scores[pid]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (controlled?.onLeaveRoom) {
                                    controlled.onLeaveRoom();
                                    return;
                                }

                                onNavigate?.('BROWSER');
                            }}
                            disabled={controlled?.disableLeave ?? (roomStatus === 'SELECTING' || roomStatus === 'PLAYING')}
                            className={`flex items-center justify-center gap-2 transition-colors text-xs font-bold py-2 mt-auto ${(controlled?.disableLeave ?? (roomStatus === 'SELECTING' || roomStatus === 'PLAYING'))
                                ? 'text-gray-800 cursor-not-allowed'
                                : 'text-gray-600 hover:text-red-400'
                                }`}
                        >
                            <LogOut size={14} /> LEAVE ROOM
                        </button>
                    </aside>
                )
            }
        </div >
    );
}
