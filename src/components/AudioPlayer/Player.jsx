import { useState, useRef, useEffect } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import './Player.css';

const MIN_FREQ = 20;
const MAX_FREQ = 20000;

export default function Player() {
    const {
        loadFile,
        play,
        pause,
        isPlaying,
        isReady,
        duration,
        currentTime,
        setFrequencyRange
    } = useAudioEngine();

    const [filename, setFilename] = useState('');
    // Frequencies stored in state for UI, pushed to engine on change
    const [lowCut, setLowCut] = useState(MIN_FREQ);
    const [highCut, setHighCut] = useState(MAX_FREQ);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFilename(file.name);
            loadFile(file);
        }
    };

    const handleRangeChange = (type, val) => {
        const value = Number(val);
        if (type === 'low') {
            // Prevent crossing
            const newLow = Math.min(value, highCut - 50);
            setLowCut(newLow);
            setFrequencyRange(newLow, highCut);
        } else {
            const newHigh = Math.max(value, lowCut + 50);
            setHighCut(newHigh);
            setFrequencyRange(lowCut, newHigh);
        }
    };

    // Format time helper
    const formatTime = (t) => {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="player-container">
            {/* File Loader */}
            <div className="control-group">
                <label className="file-upload-btn">
                    <span>{filename ? 'File Loaded' : 'Select Audio File'}</span>
                    <input type="file" accept="audio/*" onChange={handleFileChange} hidden />
                </label>
                {filename && <div className="track-info">{filename}</div>}
            </div>

            {/* Main Controls */}
            <div className="main-controls">
                <button
                    className={`play-btn ${isPlaying ? 'active' : ''}`}
                    onClick={isPlaying ? pause : play}
                    disabled={!isReady}
                >
                    {isPlaying ? 'PAUSE' : 'PLAY'}
                </button>
            </div>

            {/* Time Display */}
            <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                </div>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Frequency Isolator */}
            <div className="isolator-section">
                <h3>Frequency Isolator</h3>

                <div className="sliders-container">
                    {/* Low Cut Slider */}
                    <div className="slider-group">
                        <label>Low Cut ({lowCut} Hz)</label>
                        <input
                            type="range"
                            min={20}
                            max={20000}
                            step={10}
                            value={lowCut}
                            className="freq-slider low-slider"
                            onChange={(e) => handleRangeChange('low', e.target.value)}
                        />
                    </div>

                    {/* High Cut Slider */}
                    <div className="slider-group">
                        <label>High Cut ({highCut} Hz)</label>
                        <input
                            type="range"
                            min={20}
                            max={20000}
                            step={10}
                            value={highCut}
                            className="freq-slider high-slider"
                            onChange={(e) => handleRangeChange('high', e.target.value)}
                        />
                    </div>
                </div>

                <p className="hint-text">
                    Target Bandwidth: <strong>{highCut - lowCut} Hz</strong>
                </p>
            </div>
        </div>
    );
}
