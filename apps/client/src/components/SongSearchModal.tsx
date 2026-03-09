import React, { useState, useMemo, useEffect } from 'react';
import { SongSearchModalView, type SongSearchModalSong } from './SongSearchModalView';

const MOCK_SONGS = [
    { id: 1, title: '冥', artist: 'Amuro vs Killer', difficulty: 'A', level: 12, genre: 'TRANCE' },
    { id: 2, title: '卑弥呼', artist: '朱雀 VS 玄武', difficulty: 'A', level: 12, genre: 'ESOTERIC SCHRANZ' },
    { id: 3, title: 'V', artist: 'TAKA', difficulty: 'A', level: 12, genre: 'PROGRESSIVE' },
    { id: 4, title: 'Session 9 -With You-', artist: 'Praemium', difficulty: 'A', level: 12, genre: 'HARD RENAISSANCE' },
    { id: 5, title: 'Abyss', artist: 'dj TAKA', difficulty: 'H', level: 10, genre: 'RENAISSANCE' },
    { id: 6, title: 'Beyond Evolution', artist: 'nora2r', difficulty: 'A', level: 12, genre: 'HARDCORE' },
    { id: 7, title: 'Bad Candy', artist: 'USAO', difficulty: 'A', level: 12, genre: 'HARDSTYLE' },
    { id: 8, title: 'CUE CUE CUE', artist: 't+pazolite', difficulty: 'A', level: 12, genre: 'SPEEDCORE' },
];

interface SongSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (song: SongSearchModalSong) => void;
}

export default function SongSearchModal({ isOpen, onClose, onSelect }: SongSearchModalProps) {
    const [search, setSearch] = useState('');
    const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(120);

    // タイマーの処理
    useEffect(() => {
        if (!isOpen) return;

        // モーダルが開くたびに120秒にリセット
        setTimeLeft(120);

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onClose(); // タイムアウトで閉じる
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, onClose]);

    const allFilteredSongs = useMemo(() => {
        return MOCK_SONGS.filter(song => {
            const matchSearch = song.title.toLowerCase().includes(search.toLowerCase()) ||
                song.artist.toLowerCase().includes(search.toLowerCase());
            const matchDiff = selectedDiff ? song.difficulty === selectedDiff : true;
            const matchLevel = selectedLevel ? song.level === selectedLevel : true;
            return matchSearch && matchDiff && matchLevel;
        });
    }, [search, selectedDiff, selectedLevel]);

    const displayedSongs = useMemo(() => allFilteredSongs.slice(0, 100), [allFilteredSongs]);

    if (!isOpen) return null;

    return (
        <SongSearchModalView
            isOpen={isOpen}
            search={search}
            selectedDiff={selectedDiff}
            selectedLevel={selectedLevel}
            timeLeft={timeLeft}
            displayedSongs={displayedSongs}
            totalSongs={allFilteredSongs.length}
            onSearchChange={setSearch}
            onToggleDiff={(difficultyId) => setSelectedDiff(selectedDiff === difficultyId ? null : difficultyId)}
            onToggleLevel={(level) => setSelectedLevel(selectedLevel === level ? null : level)}
            onSelect={onSelect}
        />
    );
}
