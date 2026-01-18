import { useState } from 'react';
import Player from './components/AudioPlayer/Player';
import Library from './components/Library/Library';
import './App.css';

function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentPlaylist, setCurrentPlaylist] = useState([]);

  const handleTrackSelect = (track, playlist) => {
    setCurrentTrack(track);
    setCurrentPlaylist(playlist);
  };

  const handleNext = () => {
    if (!currentTrack || currentPlaylist.length === 0) return;
    const idx = currentPlaylist.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1 && idx < currentPlaylist.length - 1) {
      setCurrentTrack(currentPlaylist[idx + 1]);
    }
  };

  const handlePrev = () => {
    if (!currentTrack || currentPlaylist.length === 0) return;
    const idx = currentPlaylist.findIndex(t => t.id === currentTrack.id);
    if (idx > 0) {
      setCurrentTrack(currentPlaylist[idx - 1]);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Frequency<span className="text-gradient">Isolator</span></h1>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <Library
            onTrackSelect={handleTrackSelect}
            currentTrackId={currentTrack?.id}
          />
        </aside>

        <section className="main-stage">
          <Player
            currentTrack={currentTrack}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
