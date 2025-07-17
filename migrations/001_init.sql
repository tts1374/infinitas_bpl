-- room テーブル
CREATE TABLE IF NOT EXISTS room (
    room_id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_pass TEXT NOT NULL,
    mode INTEGER NOT NULL,
    user_num INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

-- user テーブル
CREATE TABLE IF NOT EXISTS user (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_token TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES room(room_id)
);

-- song テーブル
CREATE TABLE IF NOT EXISTS song (
    song_id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    stage_no INTEGER NOT NULL,
    level INTEGER NOT NULL,
    song_name TEXT NOT NULL,
    play_style TEXT NOT NULL,  -- SP, DP, DB
    difficulty TEXT NOT NULL,  -- BEGINNER, NORMAL, HYPER, ANOTHER, LEGGENDARIA
    notes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES room(room_id)
);

-- song_result テーブル
CREATE TABLE IF NOT EXISTS song_result (
    song_result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    miss_count INTEGER NOT NULL,
    lamp TEXT NOT NULL,
    rank TEXT NOT NULL, -- AAA(MAX-116)形式
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES room(room_id),
    FOREIGN KEY (song_id) REFERENCES song(song_id),
    FOREIGN KEY (user_id) REFERENCES user(user_id)
);

-- バージョン 1 を登録
INSERT INTO db_version (version) VALUES (1);