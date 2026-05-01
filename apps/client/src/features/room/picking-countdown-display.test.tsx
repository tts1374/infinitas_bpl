import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import RoomArena from "../../components/RoomArena";
import { SongSearchModalView } from "../../components/SongSearchModalView";

test("SongSearchModalView renders a null authoritative countdown as unavailable", () => {
  const markup = renderToStaticMarkup(
    <SongSearchModalView
      isOpen={true}
      search=""
      selectedDiff={null}
      selectedLevel={null}
      selectedVersion={null}
      timeLeft={null}
      displayedSongs={[]}
      totalSongs={0}
      onSearchChange={() => undefined}
      onToggleDiff={() => undefined}
      onToggleLevel={() => undefined}
      onToggleVersion={() => undefined}
      onSelect={() => undefined}
    />,
  );

  assert.match(markup, /Time Left/);
  assert.match(markup, /--:--/);
});

test("RoomArena selection display renders a null picking countdown as unavailable", () => {
  const markup = renderToStaticMarkup(
    <RoomArena
      isReady={false}
      roomStatus="SELECTING"
      closeReason=""
      resultTimer={0}
      roundCount={1}
      history={[]}
      playerPicks={{}}
      showSearch={false}
      showCutIn={false}
      lastPickedSong={null}
      copiedId={false}
      copiedCode={false}
      lobbyTimer={0}
      currentPlayers={2}
      maxPlayers={4}
      roomId="room-1"
      joinCode=""
      pickingCountdownSeconds={null}
      playTime={0}
      playingPhase="MUSIC_SELECT"
      playingCountdownSeconds={45}
      playerStatus={{ "1": "UNCONFIRMED", "2": "UNCONFIRMED" }}
      isHost={true}
      allPlayers={[
        { id: "1", name: "HOST", isReady: true, isHost: true },
        { id: "2", name: "GUEST", isReady: true, isHost: false },
      ]}
      searchModal="search modal"
    />,
  );

  assert.match(markup, /Time Remaining/);
  assert.match(markup, /--:--/);
});
