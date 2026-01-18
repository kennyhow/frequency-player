import { useState } from 'react';
import Player from './components/AudioPlayer/Player';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Frequency<span className="text-gradient">Isolator</span></h1>
        <p>High-Fidelity Audio Filtering Engine</p>
      </header>

      <main className="player-wrapper">
        <Player />
      </main>
    </div>
  );
}

export default App;
