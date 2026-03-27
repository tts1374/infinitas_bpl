import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { User, CircleCheck as CheckCircle2, Circle, Play, LogOut, MessageSquare, Info, ShieldCheck, Database, Zap, Music, Copy, Check, Clock } from 'lucide-react';
import SongSearchModal from './SongSearchModal';
import { resolveSongVersionLabel } from './SongSearchModalView';

export interface Song {
    id?: string | number;
    title: string;
    artist: string;
    version?: string;
    playStyle?: string;
    difficulty?: string;
    level: string | number;
    genre?: string;
}

export interface HistoryItem {
    round: number;
    song: Song;
    scores: Record<string, number>;
    winnerId: string | 'DRAW';
}

export interface RoomArenaPlayer {
    id: string;
    name: string;
    isReady: boolean;
    isHost: boolean;
}

export interface RoomArenaLogEntry {
    id: string;
    text: string;
    tone?: 'default' | 'accent';
}

export interface RoomArenaMatchInfoItem {
    label: string;
    value: string;
}

export interface RoomArenaResultPhasePlayerSummary {
    rank: number | null;
    stagePoints: number;
    metricValue: number | null;
    isWinner: boolean;
}

export interface RoomArenaFinalResultPlayerSummary {
    rank: number | null;
    totalPoints: number;
    isWinner: boolean;
}

interface RoomProps {
    onNavigate?: (screen: string) => void;
    initialStatus?: 'WAITING' | 'SELECTING' | 'PLAYING' | 'RESULT' | 'CLOSED';
    controlled?: RoomArenaControlledState;
}

export interface RoomArenaControlledState {
    isReady: boolean;
    roomStatus: 'WAITING' | 'SELECTING' | 'PLAYING' | 'RESULT' | 'CLOSED';
    closeReason: string;
    resultTimer: number;
    roundCount: number;
    totalRounds?: number;
    history: HistoryItem[];
    playerPicks: Record<string, Song | null>;
    showSearch: boolean;
    showCutIn: boolean;
    lastPickedSong: Song | null;
    copiedId: boolean;
    copiedCode: boolean;
    lobbyTimer: number;
    currentPlayers: number;
    maxPlayers: number;
    roomName?: string;
    battleModeLabel?: string;
    regCount?: number;
    isPrivateRoom?: boolean;
    roomId: string;
    joinCode: string;
    pickingCountdownSeconds?: number | null;
    logs?: RoomArenaLogEntry[];
    matchInfoItems?: RoomArenaMatchInfoItem[];
    publicSharePanel?: ReactNode;
    playTime: number;
    playingPhase: 'MUSIC_SELECT' | 'PLAY_START' | 'IN_PLAY';
    playingCountdownSeconds?: number | null;
    playerStatus: Record<string, 'UNCONFIRMED' | 'PLAYED' | 'SKIPPED' | 'TIMEOUT'>;
    playerMetrics?: Record<string, number | null>;
    metricLabel?: string;
    resultSong?: Song | null;
    resultPlayers?: Record<string, RoomArenaResultPhasePlayerSummary>;
    durationLabel?: string;
    finalResultPlayers?: Record<string, RoomArenaFinalResultPlayerSummary>;
    isHost: boolean;
    allPlayers: RoomArenaPlayer[];
    selectedByName?: string | null;
    selfPlayerId?: string;
    searchModal?: ReactNode;
    disablePrimaryAction?: boolean;
    disableLeave?: boolean;
    onCopyRoomId?: () => void;
    onCopyJoinCode?: () => void;
    onOpenSearch?: () => void;
    onPrimaryAction?: () => void;
    onToggleReady?: () => void;
    onSkip?: (playerId: string) => void;
    onProceedToResult?: () => void;
    onLeaveRoom?: () => void;
    onRemakeStage?: () => void;
}

export function RoomArenaPresentational(props: RoomArenaControlledState) {
    return <RoomArena controlled={props} />;
}

function maskJoinCode(joinCode: string): string {
    return '*'.repeat(joinCode.length);
}

function formatRankLabel(rank: number | null): string {
    if (rank === null) {
        return '-';
    }

    if (rank % 100 >= 11 && rank % 100 <= 13) {
        return `${rank}th`;
    }

    switch (rank % 10) {
        case 1:
            return `${rank}st`;
        case 2:
            return `${rank}nd`;
        case 3:
            return `${rank}rd`;
        default:
            return `${rank}th`;
    }
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

export default function RoomArena({ onNavigate, initialStatus, controlled }: RoomProps) {
    const [isReadyState, setIsReady] = useState(initialStatus === 'SELECTING' || initialStatus === 'PLAYING' || initialStatus === 'RESULT' || initialStatus === 'CLOSED');
    const [roomStatusState, setRoomStatus] = useState<'WAITING' | 'SELECTING' | 'PLAYING' | 'RESULT' | 'CLOSED'>(initialStatus || 'WAITING');
    const [closeReasonState, setCloseReason] = useState<string>('ALL_ROUNDS_COMPLETED');
    const [resultTimerState, setResultTimer] = useState(10);
    const [roundCountState, setRoundCount] = useState(1);
    const [historyState, setHistory] = useState<HistoryItem[]>([]);
    const [playerPicksState, setPlayerPicks] = useState<Record<string, Song | null>>(initialStatus === 'PLAYING' || initialStatus === 'RESULT' ? {
        '1': { title: 'Technophobia', artist: 'BEMANI Sound Team "Sota Fujimori"', level: '12' },
        '2': { title: 'Illegal Function Call', artist: 'Umeboshi Chazuke', level: '12' },
        '3': { title: 'Level 4', artist: 'Yamajet', level: '12' },
        '4': { title: 'Beyond the Earth', artist: '猫叉Master', level: '12' }
    } : {});
    const [showSearchState, setShowSearch] = useState(false);
    const [showCutInState, setShowCutIn] = useState(false);
    const [lastPickedSongState, setLastPickedSong] = useState<Song | null>(null);
    const [copiedIdState, setCopiedId] = useState(false);
    const [copiedCodeState, setCopiedCode] = useState(false);
    const [lobbyTimerState, setLobbyTimer] = useState(1200); // 20 minutes in seconds
    const [currentPlayersState, _setCurrentPlayers] = useState(2); // Mock current players
    const [maxPlayersState, _setMaxPlayers] = useState(4); // Mock room capacity

    const roomId = controlled?.roomId ?? "3f8e6f5d-9ba0-4268-936d-a5a2ebfd7ccd";
    const joinCode = controlled?.joinCode ?? "ARENA123";
    const roomName = controlled?.roomName ?? 'ARENA ROOM';
    const battleModeLabel = controlled?.battleModeLabel ?? 'SP / NO LIMIT';
    const regCount = controlled?.regCount ?? maxPlayersState;
    const isPrivateRoom = controlled?.isPrivateRoom ?? false;

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
            '2': 'UNCONFIRMED',
            '3': 'PLAYED',
            '4': 'UNCONFIRMED'
        } : initialStatus === 'RESULT' ? {
            '1': 'PLAYED',
            '2': 'PLAYED',
            '3': 'PLAYED',
            '4': 'PLAYED'
        } : {
            '1': 'UNCONFIRMED',
            '2': 'UNCONFIRMED',
            '3': 'UNCONFIRMED',
            '4': 'UNCONFIRMED'
        }
    );

    const isHost = controlled?.isHost ?? true;

    const isReady = controlled?.isReady ?? isReadyState;
    const roomStatus = controlled?.roomStatus ?? roomStatusState;
    const closeReason = controlled?.closeReason ?? closeReasonState;
    const resultTimer = controlled?.resultTimer ?? resultTimerState;
    const roundCount = controlled?.roundCount ?? roundCountState;
    const history = controlled?.history ?? historyState;
    const playerPicks = controlled?.playerPicks ?? playerPicksState;
    const showSearch = controlled?.showSearch ?? showSearchState;
    const showCutIn = controlled?.showCutIn ?? showCutInState;
    const lastPickedSong = controlled?.lastPickedSong ?? lastPickedSongState;
    const copiedId = controlled?.copiedId ?? copiedIdState;
    const copiedCode = controlled?.copiedCode ?? copiedCodeState;
    const lobbyTimer = controlled?.lobbyTimer ?? lobbyTimerState;
    const currentPlayers = controlled?.currentPlayers ?? currentPlayersState;
    const maxPlayers = controlled?.maxPlayers ?? maxPlayersState;
    const playTime = controlled?.playTime ?? playTimeState;
    const playingPhase = controlled?.playingPhase ?? playingPhaseState;
    const playingCountdownSeconds = controlled?.playingCountdownSeconds ?? (
        playingPhase === 'MUSIC_SELECT' ? Math.max(0, 45 - playTime) :
            playingPhase === 'PLAY_START' ? Math.max(0, 55 - playTime) :
                Math.max(0, playTime - 55)
    );
    const playerStatus = controlled?.playerStatus ?? playerStatusState;
    const playerMetrics = controlled?.playerMetrics ?? {};
    const metricLabel = controlled?.metricLabel ?? 'EX SCORE';
    const resultSong = controlled?.resultSong ?? null;
    const resultPlayers = controlled?.resultPlayers ?? {};
    const durationLabel = controlled?.durationLabel ?? '0M 00S';
    const finalResultPlayers = controlled?.finalResultPlayers ?? {};
    const logs = controlled?.logs ?? [];
    const matchInfoItems = controlled?.matchInfoItems ?? [
        { label: 'Mode', value: 'ARENA' },
        { label: 'Scoring', value: 'EX SCORE' },
    ];
    const publicSharePanel = controlled?.publicSharePanel ?? null;

    const allMockPlayers = controlled?.allPlayers ?? [
        { id: '1', name: 'PLAYER_ONE (HOST)', isReady: true, isHost: true },
        { id: '2', name: 'RIVAL_KUN', isReady: true, isHost: false },
        { id: '3', name: 'IIDX_CHAMP', isReady: isReady, isHost: false },
        { id: '4', name: 'ARENA_PRO', isReady: true, isHost: false },
    ];

    const players = allMockPlayers.slice(0, currentPlayers);
    const selfPlayerId = controlled?.selfPlayerId ?? (isHost ? '1' : '2');
    const hasJoinCode = joinCode.trim().length > 0;
    const maskedJoinCode = hasJoinCode ? maskJoinCode(joinCode) : '';
    const shortRoomId = roomId.length > 18 ? `${roomId.slice(0, 18)}…` : roomId;
    const logsViewportRef = useRef<HTMLDivElement | null>(null);
    const pickingCountdownSeconds = controlled?.pickingCountdownSeconds ?? 0;
    const totalRounds = controlled?.totalRounds ?? currentPlayers;

    useEffect(() => {
        if (logsViewportRef.current) {
            logsViewportRef.current.scrollTop = logsViewportRef.current.scrollHeight;
        }
    }, [logs]);

    const handleSelectSong = (song: Song) => {
        setPlayerPicks({ ...playerPicks, '1': song }); // Mock: Always picking for Player 1
        setShowSearch(false);
        setLastPickedSong(song);
        setShowCutIn(true);

        // 演出後にカットインを閉じるが、PLAYING へは遷移させない
        // ユーザーが意図的に次の確認をするために、SELECTING 状態を維持する
        setTimeout(() => {
            setShowCutIn(false);
            // setRoomStatus('PLAYING'); // <-- ここをコメントアウト
        }, 3000);
    };

    // 初期化時・状態遷移時の処理
    React.useEffect(() => {
        if (roomStatus === 'SELECTING' && !playerPicks['1']) {
            setShowSearch(true);
        }
        if (roomStatus === 'PLAYING') {
            if (!playerPicks['1']) {
                setPlayerPicks({
                    '1': { id: '1', title: 'Everlasting Message', artist: '削除', level: '12' },
                    '2': { id: '2', title: 'Stasis', artist: 'dAice', level: '12' },
                    '3': { id: '3', title: '冥', artist: 'Amuro vs Killer', level: '12' },
                    '4': { id: '4', title: 'IIDX RED Ending', artist: 'dj TAKA', level: '12' }
                });
            }
            setPlayerStatus({
                '1': 'PLAYED',
                '2': 'PLAYED',
                '3': 'PLAYED',
                '4': 'PLAYED'
            });
        }
        if (roomStatus === 'WAITING') {
            setLobbyTimer(1200); // Reset timer when returning to lobby
        }
    }, [roomStatus]);

    // Lobby Timer management
    React.useEffect(() => {
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
    React.useEffect(() => {
        if (roomStatus !== 'PLAYING') return;

        const interval = setInterval(() => {
            setPlayTime(prev => {
                const next = prev + 1;
                if (next < 45) setPlayingPhase('MUSIC_SELECT');
                else if (next < 55) setPlayingPhase('PLAY_START');
                else setPlayingPhase('IN_PLAY');
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [roomStatus]);

    // RESULT タイム管理 (10秒で自動遷移)
    React.useEffect(() => {
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

    const handleSkip = (playerId: string) => {
        if (controlled?.onSkip) {
            controlled.onSkip(playerId);
            return;
        }

        setPlayerStatus(prev => ({ ...prev, [playerId]: 'SKIPPED' }));
    };

    const finalizeRound = () => {
        const currentSong = playerPicks['1'] || { title: 'Unknown', artist: 'Unknown', level: '?' };

        const mockScores: Record<string, number> = {
            '1': Math.floor(Math.random() * 2000) + 1500,
            '2': Math.floor(Math.random() * 2000) + 1500,
            '3': Math.floor(Math.random() * 2000) + 1500,
            '4': Math.floor(Math.random() * 2000) + 1500
        };

        // Find winner
        let maxScore = -1;
        let winner = 'DRAW';
        Object.entries(mockScores).forEach(([pid, score]) => {
            if (score > maxScore) {
                maxScore = score;
                winner = pid;
            }
        });

        const newItem: HistoryItem = {
            round: roundCount,
            song: currentSong,
            scores: mockScores,
            winnerId: winner
        };

        setHistory(prev => [newItem, ...prev]);

        if (roundCount < 4) {
            setRoundCount(prev => prev + 1);
            setRoomStatus('PLAYING');
            setPlayTime(0);
            setPlayerStatus({
                '1': 'UNCONFIRMED',
                '2': 'UNCONFIRMED',
                '3': 'UNCONFIRMED',
                '4': 'UNCONFIRMED'
            });
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
    const currentRoundPlayer = players[roundCount - 1] ?? players[0];
    const selectedByName = controlled?.selectedByName ?? currentRoundPlayer?.name ?? 'PLAYER_ONE';
    const currentRoundSong = currentRoundPlayer ? playerPicks[currentRoundPlayer.id] ?? null : null;
    const currentRoundTitle = currentRoundSong?.title ?? 'Unknown Track';
    const currentRoundVersion = resolveSongVersionLabel(currentRoundSong?.version);
    const currentRoundPlayStyle = currentRoundSong?.playStyle ?? '-';
    const currentRoundDifficulty = currentRoundSong?.difficulty ?? '-';
    const currentRoundLevel = currentRoundSong?.level ?? '?';
    const resultSongVersion = resolveSongVersionLabel(resultSong?.version);
    const resultSongPlayStyle = resultSong?.playStyle ?? '-';
    const resultSongDifficulty = resultSong?.difficulty ?? '-';
    const resultSongLevel = resultSong?.level ?? '?';

    return (
        <div className="flex h-screen w-screen bg-[#1a1a1b] text-white font-sans overflow-hidden">

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

            {/* メインエリア */}
            <main className="flex-1 flex flex-col p-6 gap-6 relative">

                {roomStatus === 'PLAYING' && (
                    <div className="absolute inset-0 z-50 bg-[#1a1a1b] flex flex-col p-8 animate-in fade-in duration-500">
                        {/* PHASE HEADER */}
                        <div className="flex justify-between items-center bg-[#252526] p-6 rounded-2xl border border-white/5 shadow-2xl mb-8">
                            <div className="flex items-center gap-6">
                                <div className={`px-6 py-2 rounded-xl border-2 font-black italic tracking-widest text-xl transition-all ${playingPhase === 'MUSIC_SELECT' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' :
                                    playingPhase === 'PLAY_START' ? 'bg-amber-500/10 border-amber-500 text-amber-500' :
                                        'bg-red-500/10 border-red-500 text-red-500 animate-pulse'
                                    }`}>
                                    {playingPhase === 'MUSIC_SELECT' ? 'MUSIC SELECT' :
                                        playingPhase === 'PLAY_START' ? 'PLAY START' : 'IN PLAY'}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-4xl font-black italic tracking-tighter font-mono">{playingCountdownSeconds}</span>
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Countdown</span>
                                </div>
                            </div>

                                <div className="flex-1 flex flex-col items-center">
                                    {currentRoundVersion && (
                                    <span className="text-[10px] font-black text-cyan-500 tracking-[0.2em] mb-1 italic block">
                                        {currentRoundVersion}
                                    </span>
                                )}
                                <h2 className={`max-w-[32rem] text-center text-3xl font-black italic tracking-tighter text-white leading-tight whitespace-normal ${currentRoundTitle.length > 45 ? 'line-clamp-2 break-all' : 'break-all'}`}>
                                    {currentRoundTitle}
                                </h2>
                                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-black italic tracking-[0.25em] text-gray-300">
                                    <span>{currentRoundPlayStyle}</span>
                                    <span className={`${getDifficultyBadgeClass(currentRoundDifficulty)} rounded-full px-3 py-1 text-[11px] tracking-[0.2em]`}>{getDifficultyBadgeLabel(currentRoundDifficulty)}</span>
                                    <span className="text-cyan-500">Lv{currentRoundLevel}</span>
                                </div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selected By {selectedByName}</p>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1 italic text-shadow-glow">Stage</p>
                                    <h2 className="text-2xl font-black italic tracking-tighter text-white">ROUND {roundCount} / {totalRounds}</h2>
                                </div>
                                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-cyan-500">
                                    <Zap size={24} />
                                </div>
                            </div>
                        </div>

                        {/* PLAYER STATUS GRID (PLAYING) */}
                        <div className="grid grid-cols-2 gap-6 flex-1">
                            {players.map(p => (
                                <div key={p.id} className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${playerStatus[p.id] === 'PLAYED' ? 'border-green-500 bg-green-500/5' :
                                    playerStatus[p.id] === 'SKIPPED' ? 'border-gray-500 bg-gray-500/5' :
                                        'border-white/5 bg-white/5'
                                    }`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                                                <User size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-black italic text-xl tracking-tight text-white">{p.name}</h4>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-1 rounded font-black italic tracking-widest text-xs ${playerStatus[p.id] === 'PLAYED' ? 'bg-green-500 text-black' :
                                            playerStatus[p.id] === 'SKIPPED' ? 'bg-gray-700 text-white' :
                                                playerStatus[p.id] === 'TIMEOUT' ? 'bg-red-900 text-white' :
                                                    'bg-white/10 text-gray-600'
                                            }`}>
                                            {playerStatus[p.id]}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {playerStatus[p.id] === 'UNCONFIRMED' && (
                                            <>
                                                {p.id === selfPlayerId ? (
                                                    <button onClick={() => handleSkip(p.id)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl font-black italic text-sm transition-all">SKIP ROUND</button>
                                                ) : (
                                                    <div className="flex-1 h-12 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase animate-pulse">Waiting for result...</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {playerStatus[p.id] === 'PLAYED' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-500 uppercase">{metricLabel}:</span>
                                                <span className="text-3xl font-black italic text-white tracking-widest">
                                                    {playerMetrics[p.id] ?? '-'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* HOST PROCEED BAR */}
                        {isHost && playingPhase === 'IN_PLAY' && playTime >= (240 + 55) && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={handleProceedToResult}
                                    className="px-12 py-3 bg-red-600/10 hover:bg-red-600 border border-red-500/30 text-red-500 hover:text-white rounded-full font-black italic tracking-widest text-xs transition-all uppercase"
                                >
                                    Force Finalize Match
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {roomStatus === 'RESULT' && (
                    <div className="fixed inset-0 top-0 left-0 w-full h-full z-[100] bg-[#0f0f10] flex flex-col p-12 animate-in fade-in duration-500">
                        <header className="flex justify-between items-end mb-16">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-4">
                                    <span className="bg-cyan-500 text-black px-4 py-1 font-black italic text-2xl tracking-tighter uppercase">Match Result</span>
                                    <span className="text-xl font-bold text-gray-500 tracking-widest uppercase">Round {roundCount} Summary</span>
                                </div>
                                <div className="mt-6">
                                    {resultSongVersion && (
                                        <span className="text-[10px] font-black text-cyan-500 tracking-[0.2em] mb-0.5 italic block">
                                            {resultSongVersion}
                                        </span>
                                    )}
                                    <h2 className={`max-w-[56rem] text-6xl font-black italic tracking-tighter text-white leading-tight whitespace-normal ${resultSong?.title && resultSong.title.length > 45 ? 'line-clamp-2 break-all' : 'break-all'}`}>
                                        {resultSong?.title || 'Unknown Track'}
                                    </h2>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-lg font-black italic tracking-[0.2em] text-gray-300">
                                    <span>{resultSongPlayStyle}</span>
                                    <span className={`${getDifficultyBadgeClass(resultSongDifficulty)} rounded-full px-4 py-1.5 text-xs tracking-[0.2em]`}>{getDifficultyBadgeLabel(resultSongDifficulty)}</span>
                                    <span className="text-cyan-500">Lv{resultSongLevel}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest italic font-mono">Auto-proceeding in</span>
                                    <span className="text-4xl font-black italic text-cyan-500 font-mono w-12 text-center">{resultTimer}s</span>
                                </div>
                                <div className="flex items-center gap-4 bg-white/5 px-8 py-4 rounded-2xl border border-white/10">
                                    <Zap className="text-amber-500" />
                                    <span className="text-2xl font-black italic tracking-tighter">SCOREBOARD</span>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 grid grid-cols-4 gap-8 mb-12">
                            {players.map((p) => {
                                const summary = resultPlayers[p.id];
                                const rank = summary?.rank ?? null;
                                const isWinner = summary?.isWinner ?? false;

                                return (
                                    <div key={p.id} className="relative group">
                                        <div className={`h-full rounded-3xl border-4 p-8 flex flex-col items-center justify-between transition-all transform hover:-translate-y-2 ${isWinner ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.3)]' : 'bg-white/5 border-white/10'
                                            }`}>
                                            <div className="absolute -top-6 bg-black px-6 py-1 border-2 border-inherit rounded-full font-black italic text-lg z-10">
                                                {rank === null ? 'RANK -' : `RANK ${rank}`}
                                            </div>

                                            <div className={`p-8 rounded-full ${isWinner ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-white'}`}>
                                                <User size={80} />
                                            </div>

                                            <div className="text-center mt-4">
                                                <h3 className="text-3xl font-black italic tracking-tighter mb-1">{p.name}</h3>
                                            </div>

                                            <div className="mt-8 flex flex-col items-center gap-6">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 font-mono">Arena Pts</span>
                                                    <div className={`text-5xl font-black italic tracking-tighter text-amber-500`}>
                                                        +{summary?.stagePoints ?? 0}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 font-mono">{metricLabel}</span>
                                                    <div className={`text-4xl font-black italic tracking-tighter ${isWinner ? 'text-cyan-400' : 'text-white'}`}>
                                                        {summary?.metricValue ?? '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                )}
                {roomStatus === 'CLOSED' && (
                    <div className="fixed inset-0 top-0 left-0 w-full h-full z-[120] bg-black flex flex-col p-16 animate-in zoom-in-95 duration-1000">
                        <header className="flex justify-between items-start mb-12 relative">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <span className="bg-red-600 text-white px-6 py-1 font-black italic text-2xl tracking-tighter uppercase shadow-[0_0_30px_rgba(220,38,38,0.5)]">Result Settled</span>
                                    <div className="h-10 w-1 bg-white/20" />
                                    <span className="text-xl font-bold text-gray-500 tracking-[0.3em] uppercase">{closeReason}</span>
                                </div>
                                <h2 className="text-6xl font-black italic tracking-tighter text-white uppercase mt-2">MATCH FINALIZED</h2>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-red-500 uppercase tracking-[0.5em] mb-4">Arena Session Terminated</span>
                                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 flex items-center gap-8 backdrop-blur-xl">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1 italic">Arena Mode</p>
                                        <h2 className="text-2xl font-black italic tracking-tighter">{battleModeLabel}</h2>
                                    </div>
                                    <div className="w-[1px] h-12 bg-white/10" />
                                    <div className="text-left font-sans">
                                        <p className="text-xs font-black text-gray-500 uppercase">Duration</p>
                                        <p className="text-2xl font-black italic tracking-tighter text-cyan-400">{durationLabel}</p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 flex flex-col justify-center gap-8 relative px-10">
                            <div className="grid grid-cols-4 gap-8">
                                {players.map((p) => {
                                    const summary = finalResultPlayers[p.id];
                                    const rank = summary?.rank ?? null;
                                    const isWinner = summary?.isWinner ?? false;
                                    return (
                                    <div key={p.id} className={`p-8 rounded-[2.5rem] border-4 flex flex-col items-center gap-4 relative transition-all hover:scale-105 ${isWinner ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_100px_rgba(6,182,212,0.3)]' : 'bg-white/5 border-white/10'
                                        }`}>
                                        <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center bg-gray-900 border-inherit">
                                            <User size={48} className={isWinner ? 'text-cyan-400' : 'text-gray-500'} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-5xl font-black italic tracking-tighter leading-none mb-1">{formatRankLabel(rank)}</p>
                                            <p className="max-w-[180px] text-xl font-black italic text-white uppercase leading-tight whitespace-normal break-words line-clamp-2">{p.name}</p>
                                        </div>
                                        <div className="w-full h-[1px] bg-white/10 mt-2" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">TOTAL Arena Pts</span>
                                            <span className={`text-4xl font-black italic ${isWinner ? 'text-cyan-400 font-mono shadow-cyan-500' : 'text-white'}`}>{summary?.totalPoints ?? 0}pt</span>
                                        </div>
                                    </div>
                                )})}
                            </div>
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
                                className="px-12 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black italic text-2xl rounded-2xl transition-all active:scale-95 shadow-[0_0_60px_rgba(6,182,212,0.4)] uppercase tracking-tighter"
                            >
                                Return to Lobby
                            </button>
                            {isHost ? (
                                <button
                                    onClick={() => {
                                        if (controlled?.onRemakeStage) {
                                            controlled.onRemakeStage();
                                            return;
                                        }

                                        setRoomStatus('WAITING');
                                    }}
                                    className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-black italic text-base rounded-2xl transition-all border-2 border-white/10 uppercase tracking-tighter"
                                >
                                    Remake Room
                                </button>
                            ) : null}
                        </footer>
                    </div>
                )}

                {/* ヘッダー: ルーム情報 */}
                {
                    roomStatus === 'SELECTING' ? (
                        <div className="bg-[#252526] p-4 rounded-2xl border-2 border-cyan-500/30 flex justify-between items-center shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                            <div className="flex items-center gap-6">
                                <div className="px-4 py-1.5 bg-cyan-500 text-black font-black italic tracking-widest rounded-lg text-sm">ARENA SELECTION</div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Time Remaining</span>
                                    <span className="text-2xl font-black italic tracking-tighter font-mono text-cyan-400">{formatTime(pickingCountdownSeconds)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex bg-black/40 rounded-lg border border-white/10 overflow-hidden max-w-[360px]">
                                    <div className="px-3 py-1.5 border-r border-white/10 flex flex-col items-center justify-center flex-1 min-w-0">
                                        <span className="text-[8px] font-black text-gray-500 uppercase">Room ID</span>
                                        <div className="flex items-center gap-1.5 w-full">
                                            <span className="font-mono font-bold text-cyan-400 text-[10px] truncate">{shortRoomId}</span>
                                            <button onClick={handleCopyRoomId} className="text-gray-600 hover:text-cyan-400 transition-colors flex-shrink-0">
                                                {copiedId ? <Check size={10} /> : <Copy size={10} />}
                                            </button>
                                        </div>
                                    </div>
                                    {hasJoinCode ? (
                                        <div className="px-3 py-1.5 flex flex-col items-center justify-center min-w-[80px]">
                                            <span className="text-[8px] font-black text-gray-500 uppercase">Join Code</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-amber-500/40 text-xs">{maskedJoinCode}</span>
                                                <button onClick={handleCopyJoinCode} className="text-gray-600 hover:text-amber-400 transition-colors">
                                                    {copiedCode ? <Check size={10} /> : <Copy size={10} />}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest leading-tight">Regulation</span>
                                    <span className="text-lg font-black italic text-white uppercase">{battleModeLabel}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <header className="flex justify-between items-start bg-[#252526] p-3 rounded-xl border border-white/5 shadow-xl">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black italic tracking-tighter text-cyan-400 uppercase leading-none">
                                        {roomName}
                                    </h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                            <Zap size={12} className="text-amber-500" /> {battleModeLabel}
                                        </span>
                                        <div className="w-1 h-1 rounded-full bg-gray-600" />
                                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-wider">
                                            {currentPlayers} / {maxPlayers} Players
                                        </span>
                                        <div className="w-1 h-1 rounded-full bg-gray-600" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                            REG: {regCount} ROUNDS
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex bg-[#1a1a1b] rounded-lg border border-white/10 overflow-hidden max-w-[480px]">
                                    <div className="px-3 py-2 border-r border-white/10 flex flex-col items-center justify-center min-w-[80px] bg-red-500/5">
                                        <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter flex items-center gap-1">
                                            <Clock size={8} /> Lobby TTL
                                        </span>
                                        <span className={`font-mono font-bold text-sm ${lobbyTimer < 60 ? 'text-red-500 animate-pulse' : 'text-gray-300'}`}>
                                            {formatTime(lobbyTimer)}
                                        </span>
                                    </div>
                                    <div className="px-3 py-2 border-r border-white/10 flex flex-col items-center justify-center flex-1 min-w-0">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Room ID</span>
                                        <div className="flex items-center gap-2 w-full">
                                            <span className="font-mono font-bold text-cyan-500 text-[10px] truncate">{shortRoomId}</span>
                                            <button
                                                onClick={handleCopyRoomId}
                                                className="text-gray-600 hover:text-cyan-400 transition-colors flex-shrink-0"
                                                title="Copy Room ID"
                                            >
                                                {copiedId ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                    {hasJoinCode ? (
                                        <div className="px-3 py-2 flex flex-col items-center justify-center min-w-[100px]">
                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Join Code</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-amber-500/50 text-sm tracking-widest">{maskedJoinCode}</span>
                                                <button
                                                    onClick={handleCopyJoinCode}
                                                    className="text-gray-600 hover:text-amber-400 transition-colors"
                                                    title="Copy Join Code"
                                                >
                                                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                {isPrivateRoom ? (
                                    <div className="bg-cyan-500/10 p-2 rounded-lg text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                        <ShieldCheck size={20} />
                                    </div>
                                ) : null}
                            </div>
                        </header>
                    )
                }
                <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1 overflow-hidden">
                    {[...Array(4)].map((_, idx) => {
                        const p = allMockPlayers[idx] ?? { id: String(idx + 1), name: `PLAYER_${idx + 1}`, isReady: false, isHost: false };
                        const isJoined = idx < currentPlayers;
                        const isSlotAvailable = idx < maxPlayers;
                        const pickedSong = playerPicks[p.id];
                        const hasPicked = !!pickedSong;
                        const colors = ['border-cyan-500 shadow-cyan-500/20', 'border-amber-500 shadow-amber-500/20', 'border-crimson-500 shadow-crimson-500/20', 'border-purple-500 shadow-purple-500/20'];
                        const personalColor = colors[idx] || 'border-cyan-500';

                        if (isJoined) {
                            return (
                                <div
                                    key={idx}
                                    className={`relative rounded-2xl border-2 flex flex-col justify-between p-6 transition-all ${hasPicked
                                        ? `bg-white/5 ${personalColor} shadow-[0_0_30px_rgba(6,182,212,0.1)]`
                                        : (p.isReady ? 'bg-cyan-500/5 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'bg-[#252526] border-white/10')
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl ${p.isReady ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                <User size={32} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl font-black italic tracking-tight">{p.name}</span>
                                                    {p.isHost && <ShieldCheck size={16} className="text-cyan-400" />}
                                                </div>
                                            </div>
                                        </div>
                                        {roomStatus === 'SELECTING' ? (
                                            hasPicked ? (
                                                <div className="flex items-center gap-2 text-green-400 font-black italic text-sm">
                                                    <CheckCircle2 size={20} /> DECIDED
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-yellow-500 font-black italic text-sm animate-pulse">
                                                    <Music size={20} /> SELECTING...
                                                </div>
                                            )
                                        ) : (
                                            p.isReady ? (
                                                <div className="flex items-center gap-2 text-cyan-400 font-black italic text-sm animate-pulse">
                                                    <CheckCircle2 size={20} /> READY
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-600 font-black italic text-sm">
                                                    <Circle size={20} /> WAITING
                                                </div>
                                            )
                                        )}
                                    </div>
                                    {hasPicked && (
                                        <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white/5 rounded border border-white/10 flex items-center justify-center">
                                                <Music size={24} className="text-gray-600" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <h4 className={`min-h-[2.75rem] text-lg font-black italic tracking-tighter leading-tight text-white whitespace-normal ${pickedSong.title.length > 45 ? 'line-clamp-2 break-all' : 'break-all'}`}>{pickedSong.title}</h4>
                                                <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5 max-w-[180px]">{pickedSong.artist}</p>
                                            </div>
                                            <div className="text-2xl font-black italic tracking-tighter text-cyan-500 pr-2">Lv{pickedSong.level}</div>
                                        </div>
                                    )}
                                    <div className="absolute right-4 bottom-2 text-6xl font-black italic text-white/[0.03] select-none pointer-events-none">0{idx + 1}</div>
                                    {idx === 0 && roomStatus === 'SELECTING' && !hasPicked && (
                                        <button
                                            onClick={() => {
                                                if (controlled?.onOpenSearch) {
                                                    controlled.onOpenSearch();
                                                    return;
                                                }

                                                setShowSearch(true);
                                            }}
                                            className="absolute inset-0 bg-cyan-500/10 hover:bg-cyan-500/20 flex items-center justify-center group transition-all rounded-2xl"
                                        >
                                            <div className="bg-cyan-500 text-black px-6 py-2 rounded-full font-black italic tracking-widest scale-90 group-hover:scale-100 transition-transform shadow-xl">SELECT MUSIC</div>
                                        </button>
                                    )}
                                </div>
                            );
                        } else if (isSlotAvailable) {
                            return (
                                <div
                                    key={idx}
                                    className="relative rounded-2xl border-2 border-dashed border-white/5 bg-transparent flex flex-col items-center justify-center p-6"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-700">
                                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-800 flex items-center justify-center">
                                            <span className="text-xl font-bold">+</span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Waiting for player...</span>
                                    </div>
                                    <div className="absolute right-4 bottom-2 text-6xl font-black italic text-white/[0.01] select-none pointer-events-none">
                                        0{idx + 1}
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={idx}
                                    className="relative rounded-2xl border-2 border-white/[0.02] bg-black/10 flex flex-col items-center justify-center p-6 grayscale opacity-30"
                                >
                                    <div className="absolute right-4 bottom-2 text-6xl font-black italic text-white/[0.01] select-none pointer-events-none">
                                        0{idx + 1}
                                    </div>
                                </div>
                            );
                        }
                    })}
                </div>

                {/* 下部アクションバー */}
                <footer className="flex gap-4 h-20">
                    <div className="flex-1 bg-[#252526] rounded-xl border border-white/5 p-3 flex flex-col gap-2 overflow-hidden">
                        <div className="flex items-center gap-4 text-gray-500 border-b border-white/5 pb-1">
                            <MessageSquare size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Chat / Logs</span>
                        </div>
                        <div ref={logsViewportRef} className="flex-1 text-sm overflow-y-auto custom-scrollbar pr-2 h-0 space-y-1">
                            {logs.length === 0 ? (
                                <p className="text-gray-500 italic">System: 全員の準備完了を待っています...</p>
                            ) : logs.map((entry) => (
                                <p
                                    key={entry.id}
                                    className={entry.tone === 'accent' ? 'text-cyan-400/90 font-bold' : 'text-gray-300'}
                                >
                                    {entry.text}
                                </p>
                            ))}
                        </div>
                    </div>

                    {isHost ? (
                        <button
                            onClick={() => {
                                if (controlled?.onPrimaryAction) {
                                    controlled.onPrimaryAction();
                                    return;
                                }

                                if (roomStatus === 'WAITING' && players.every(p => p.isReady)) {
                                    setRoomStatus('SELECTING');
                                }
                            }}
                            disabled={controlled?.disablePrimaryAction ?? (roomStatus !== 'WAITING' || !players.every(p => p.isReady))}
                            className={`w-72 font-black text-lg italic tracking-tighter rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.3)] ${(controlled?.disablePrimaryAction ?? (roomStatus !== 'WAITING' || !players.every(p => p.isReady)))
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50'
                                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/50'
                                }`}
                        >
                            <Play size={24} fill="currentColor" /> {roomStatus === 'SELECTING' ? 'SELECTING...' : roomStatus === 'PLAYING' ? 'PLAYING...' : 'START MATCH'}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (controlled?.onToggleReady) {
                                    controlled.onToggleReady();
                                    return;
                                }

                                setIsReady(!isReady);
                            }}
                            disabled={controlled?.disablePrimaryAction ?? (roomStatus === 'SELECTING')}
                            className={`w-72 font-black text-lg italic tracking-tighter rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${isReady
                                ? 'bg-transparent border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500/10'
                                : 'bg-white text-black hover:bg-gray-200 shadow-xl'
                                } ${(controlled?.disablePrimaryAction ?? (roomStatus === 'SELECTING')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isReady ? 'CANCEL READY' : 'READY UP'}
                        </button>
                    )}
                </footer>
            </main >

            {/* 右サイドバー: ルール詳細やヘルプ */}
            <aside className="w-[300px] bg-[#252526] border-l border-white/5 p-6 flex flex-col gap-6">
                <section className="flex-1 overflow-hidden flex flex-col">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Database size={14} /> Match History
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-gray-800 opacity-50 border-2 border-dashed border-white/5 rounded-2xl">
                                <Music size={32} strokeWidth={1} />
                                <p className="text-[9px] font-black uppercase tracking-widest mt-2 text-center px-4">Results pending...</p>
                            </div>
                        ) : (
                            history.map((item, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-cyan-500/50 transition-all group animate-in slide-in-from-right duration-500">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[9px] font-black text-cyan-500 uppercase tracking-tighter italic font-mono">ROUND {item.round}</span>
                                        <div className="flex items-center gap-1">
                                            <Zap size={10} className="text-amber-500" />
                                            <span className="text-[9px] font-black text-gray-500 uppercase italic">RESULT</span>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <h4 className="font-bold text-xs text-white truncate group-hover:text-cyan-400 transition-colors italic">{item.song.title}</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {['1', '2', '3', '4'].map(pid => (
                                            <div key={pid} className={`flex justify-between items-center px-1.5 py-1 rounded ${item.winnerId === pid ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-white/5 border border-transparent'}`}>
                                                <span className={`text-[8px] font-black ${item.winnerId === pid ? 'text-cyan-400' : 'text-gray-600'}`}>P{pid}</span>
                                                <span className={`font-mono font-bold text-[10px] ${item.winnerId === pid ? 'text-cyan-400' : 'text-gray-500'}`}>{item.scores[pid]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {publicSharePanel ? (
                    <section className="pt-6 border-t border-white/5">
                        {publicSharePanel}
                    </section>
                ) : null}

                <section className={publicSharePanel ? "pt-6" : "pt-6 border-t border-white/5"}>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Info size={14} /> Match Info
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {matchInfoItems.map((item) => (
                            <div key={item.label} className="bg-[#1e1e1e] p-2 rounded-lg border border-white/5">
                                <span className="block text-[8px] text-gray-600 font-bold uppercase">{item.label}</span>
                                <span className="text-[11px] font-bold text-cyan-400">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {roomStatus === 'WAITING' ? (
                    <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl">
                        <p className="text-[10px] text-cyan-400 font-black uppercase leading-tight">
                            The match will start once all players are ready.
                        </p>
                    </div>
                ) : roomStatus === 'SELECTING' ? (
                    <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl">
                        <p className="text-[10px] text-cyan-400 font-black uppercase leading-tight">
                            Waiting for all players to finish picking.
                        </p>
                    </div>
                ) : null}

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
        </div>
    );
}
