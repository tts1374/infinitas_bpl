import { useEffect, useRef, type ReactNode } from 'react';
import { User, CircleCheck as CheckCircle2, Circle, Play, LogOut, MessageSquare, Info, ShieldCheck, Database, Zap, Music, Copy, Check, Clock } from 'lucide-react';
import { RoomPickDecisionCutIn, RoomSearchModalGate } from '../features/room/presentation-components';
import {
    formatCountdown,
    formatRankLabel,
    getDifficultyBadgeClass,
    getDifficultyBadgeLabel,
    maskJoinCode,
    type RoomHistoryItem,
    type RoomPlayerStatusLabel,
    type RoomSong
} from '../features/room/presentation-shared';
import { resolveSongVersionLabel } from './SongSearchModalView';

export type Song = RoomSong;
export type HistoryItem = RoomHistoryItem;

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
    playerStatus: Record<string, RoomPlayerStatusLabel>;
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
    return <RoomArena {...props} />;
}

export default function RoomArena({
    isReady,
    roomStatus,
    closeReason,
    resultTimer,
    roundCount,
    totalRounds,
    history,
    playerPicks,
    showSearch,
    showCutIn,
    lastPickedSong,
    copiedId,
    copiedCode,
    lobbyTimer,
    currentPlayers,
    maxPlayers,
    roomName = '',
    battleModeLabel = '',
    regCount,
    isPrivateRoom = false,
    roomId,
    joinCode,
    pickingCountdownSeconds = 0,
    logs,
    matchInfoItems,
    publicSharePanel,
    playTime,
    playingPhase,
    playingCountdownSeconds,
    playerStatus,
    playerMetrics,
    metricLabel,
    resultSong,
    resultPlayers,
    durationLabel,
    finalResultPlayers,
    isHost,
    allPlayers,
    selectedByName,
    selfPlayerId,
    searchModal,
    disablePrimaryAction,
    disableLeave,
    onCopyRoomId,
    onCopyJoinCode,
    onOpenSearch,
    onPrimaryAction,
    onToggleReady,
    onSkip,
    onProceedToResult,
    onLeaveRoom,
    onRemakeStage,
}: RoomArenaControlledState) {
    const players = allPlayers.slice(0, currentPlayers);
    const resolvedSelfPlayerId = selfPlayerId ?? (isHost ? '1' : '2');
    const hasJoinCode = joinCode.trim().length > 0;
    const maskedJoinCode = hasJoinCode ? maskJoinCode(joinCode) : '';
    const handleCopyRoomId = () => {
        onCopyRoomId?.();
    };
    const handleCopyJoinCode = () => {
        onCopyJoinCode?.();
    };
    const shortRoomId = roomId.length > 18 ? `${roomId.slice(0, 18)}…` : roomId;
    const logsViewportRef = useRef<HTMLDivElement | null>(null);
    const resolvedTotalRounds = totalRounds ?? currentPlayers;
    const resolvedPlayingCountdownSeconds = playingCountdownSeconds ?? (
        playingPhase === 'MUSIC_SELECT' ? Math.max(0, 45 - playTime) :
            playingPhase === 'PLAY_START' ? Math.max(0, 55 - playTime) :
                Math.max(0, playTime - 55)
    );
    const resolvedPlayerMetrics = playerMetrics ?? {};
    const resolvedMetricLabel = metricLabel ?? 'EX SCORE';
    const resolvedResultSong = resultSong ?? null;
    const resolvedResultPlayers = resultPlayers ?? {};
    const resolvedDurationLabel = durationLabel ?? '0M 00S';
    const resolvedFinalResultPlayers = finalResultPlayers ?? {};
    const resolvedLogs = logs ?? [];
    const resolvedMatchInfoItems = matchInfoItems ?? [
        { label: 'Mode', value: 'ARENA' },
        { label: 'Scoring', value: resolvedMetricLabel },
    ];
    const resolvedPublicSharePanel = publicSharePanel ?? null;
    const currentRoundPlayer = players[roundCount - 1] ?? players[0] ?? null;
    const resolvedSelectedByName = selectedByName ?? currentRoundPlayer?.name ?? '';
    const currentRoundSong = currentRoundPlayer ? playerPicks[currentRoundPlayer.id] ?? null : null;
    const currentRoundTitle = currentRoundSong?.title ?? 'Unknown Track';
    const currentRoundVersion = resolveSongVersionLabel(currentRoundSong?.version);
    const currentRoundPlayStyle = currentRoundSong?.playStyle ?? '-';
    const currentRoundDifficulty = currentRoundSong?.difficulty ?? '-';
    const currentRoundLevel = currentRoundSong?.level ?? '?';
    const resultSongVersion = resolveSongVersionLabel(resolvedResultSong?.version);
    const resultSongPlayStyle = resolvedResultSong?.playStyle ?? '-';
    const resultSongDifficulty = resolvedResultSong?.difficulty ?? '-';
    const resultSongLevel = resolvedResultSong?.level ?? '?';
    const primaryDisabled = disablePrimaryAction ?? (
        isHost
            ? roomStatus !== 'WAITING' || !players.every((player) => player.isReady)
            : roomStatus === 'SELECTING'
    );
    const leaveDisabled = disableLeave ?? (roomStatus === 'SELECTING' || roomStatus === 'PLAYING');
    const resolvedRegCount = regCount ?? maxPlayers;

    useEffect(() => {
        if (logsViewportRef.current) {
            logsViewportRef.current.scrollTop = logsViewportRef.current.scrollHeight;
        }
    }, [resolvedLogs]);

    return (
        <div className="flex h-screen w-screen bg-[#1a1a1b] text-white font-sans overflow-hidden">

            {showCutIn ? <RoomPickDecisionCutIn song={lastPickedSong} /> : null}

            <RoomSearchModalGate
                modal={searchModal}
                isOpen={showSearch}
                onClose={() => undefined}
                onSelect={() => undefined}
            />

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
                                    <span className="text-4xl font-black italic tracking-tighter font-mono">{resolvedPlayingCountdownSeconds}</span>
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Countdown</span>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center">
                                <div className="mb-1 min-h-4">
                                    {currentRoundVersion && (
                                        <span className="text-[10px] font-black text-cyan-500 tracking-[0.2em] italic block">
                                            {currentRoundVersion}
                                        </span>
                                    )}
                                </div>
                                <h2 className={`max-w-[32rem] text-center text-3xl font-black italic tracking-tighter text-white leading-tight whitespace-normal ${currentRoundTitle.length > 45 ? 'line-clamp-2 break-all' : 'break-all'}`}>
                                    {currentRoundTitle}
                                </h2>
                                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-black italic tracking-[0.25em] text-gray-300">
                                    <span>{currentRoundPlayStyle}</span>
                                    <span className={`${getDifficultyBadgeClass(currentRoundDifficulty)} rounded-full px-3 py-1 text-[11px] tracking-[0.2em]`}>{getDifficultyBadgeLabel(currentRoundDifficulty)}</span>
                                    <span className="text-cyan-500">Lv{currentRoundLevel}</span>
                                </div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selected By {resolvedSelectedByName}</p>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1 italic text-shadow-glow">Stage</p>
                                    <h2 className="text-2xl font-black italic tracking-tighter text-white">ROUND {roundCount} / {resolvedTotalRounds}</h2>
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
                                                {p.id === resolvedSelfPlayerId ? (
                                                    <button onClick={() => onSkip?.(p.id)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl font-black italic text-sm transition-all">SKIP ROUND</button>
                                                ) : (
                                                    <div className="flex-1 h-12 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase animate-pulse">Waiting for result...</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {playerStatus[p.id] === 'PLAYED' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-500 uppercase">{resolvedMetricLabel}:</span>
                                                <span className="text-3xl font-black italic text-white tracking-widest">
                                                    {resolvedPlayerMetrics[p.id] ?? '-'}
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
                                    onClick={() => onProceedToResult?.()}
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
                                    <div className="mb-0.5 min-h-4">
                                        {resultSongVersion && (
                                            <span className="text-[10px] font-black text-cyan-500 tracking-[0.2em] italic block">
                                                {resultSongVersion}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className={`max-w-[56rem] text-6xl font-black italic tracking-tighter text-white leading-tight whitespace-normal ${resolvedResultSong?.title && resolvedResultSong.title.length > 45 ? 'line-clamp-2 break-all' : 'break-all'}`}>
                                        {resolvedResultSong?.title || 'Unknown Track'}
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
                                const summary = resolvedResultPlayers[p.id];
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
                                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 font-mono">{resolvedMetricLabel}</span>
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
                                        <p className="text-2xl font-black italic tracking-tighter text-cyan-400">{resolvedDurationLabel}</p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 flex flex-col justify-center gap-8 relative px-10">
                            <div className="grid grid-cols-4 gap-8">
                                {players.map((p) => {
                                    const summary = resolvedFinalResultPlayers[p.id];
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
                                    onLeaveRoom?.();
                                }}
                                className="px-12 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black italic text-2xl rounded-2xl transition-all active:scale-95 shadow-[0_0_60px_rgba(6,182,212,0.4)] uppercase tracking-tighter"
                            >
                                Return to Lobby
                            </button>
                            {isHost && onRemakeStage !== undefined ? (
                                <button
                                    onClick={() => onRemakeStage?.()}
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
                                    <span className="text-2xl font-black italic tracking-tighter font-mono text-cyan-400">{formatCountdown(pickingCountdownSeconds)}</span>
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
                                            REG: {resolvedRegCount} ROUNDS
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
                                            {formatCountdown(lobbyTimer)}
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
                        const p = players[idx] ?? null;
                        const isSlotAvailable = idx < maxPlayers;
                        const pickedSong = p ? playerPicks[p.id] : null;
                        const hasPicked = !!pickedSong;
                        const colors = ['border-cyan-500 shadow-cyan-500/20', 'border-amber-500 shadow-amber-500/20', 'border-crimson-500 shadow-crimson-500/20', 'border-purple-500 shadow-purple-500/20'];
                        const personalColor = colors[idx] || 'border-cyan-500';

                        if (p) {
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
                                            onClick={() => onOpenSearch?.()}
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
                            {resolvedLogs.length === 0 ? (
                                <p className="text-gray-500 italic">System: 全員の準備完了を待っています...</p>
                            ) : resolvedLogs.map((entry) => (
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
                            onClick={() => onPrimaryAction?.()}
                            disabled={primaryDisabled}
                            className={`w-72 font-black text-lg italic tracking-tighter rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.3)] ${primaryDisabled
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50'
                                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/50'
                                }`}
                        >
                            <Play size={24} fill="currentColor" /> {roomStatus === 'SELECTING' ? 'SELECTING...' : roomStatus === 'PLAYING' ? 'PLAYING...' : 'START MATCH'}
                        </button>
                    ) : (
                        <button
                            onClick={() => onToggleReady?.()}
                            disabled={primaryDisabled}
                            className={`w-72 font-black text-lg italic tracking-tighter rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${isReady
                                ? 'bg-transparent border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500/10'
                                : 'bg-white text-black hover:bg-gray-200 shadow-xl'
                                } ${primaryDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                {resolvedPublicSharePanel ? (
                    <section className="pt-6 border-t border-white/5">
                        {resolvedPublicSharePanel}
                    </section>
                ) : null}

                <section className={resolvedPublicSharePanel ? "pt-6" : "pt-6 border-t border-white/5"}>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Info size={14} /> Match Info
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {resolvedMatchInfoItems.map((item) => (
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
                    onClick={() => onLeaveRoom?.()}
                    disabled={leaveDisabled}
                    className={`flex items-center justify-center gap-2 transition-colors text-xs font-bold py-2 mt-auto ${leaveDisabled
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
