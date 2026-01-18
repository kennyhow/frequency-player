import { useState, useEffect } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { toLog, toLinear } from '../../utils/audioMath';
import './Player.css';

const MIN_FREQ = 20;
const MAX_FREQ = 20000;

export default function Player({ currentTrack, onNext, onPrev }) {
    const {
        loadFile,
        play,
        pause,
        isPlaying,
        isReady,
        duration,
        currentTime,
        setFrequencyRange
    } = useAudioEngine(onNext);

    // Internal state for Sliders (0-100 linear position)
    // We initialize them to represent the full range (20Hz - 20kHz)
    // 0 -> 20Hz, 100 -> 20kHz
    const [lowSlider, setLowSlider] = useState(0);
    const [highSlider, setHighSlider] = useState(100);

    // If a track is passed from props (Library), load it
    // We use a simple effect or just react to changes
    // Ideally, useAudioEngine should handle the "load" when source changes
    // For now, let's keep the manual upload button as fallback if no track provided

    const [localFilename, setLocalFilename] = useState('');

    // Handle direct file upload (Legacy/Fallback)
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLocalFilename(file.name);
            loadFile(file);
        }
    };

    // Listen for track changes from Library
    useEffect(() => {
        async function loadTrack() {
            if (!currentTrack) return;

            // If we have a file blob, use it
            if (currentTrack.file) {
                loadFile(currentTrack.file);
                return;
            }

            // If we have a fileHandle, retrieve the file blob
            if (currentTrack.fileHandle) {
                try {
                    const opts = { mode: 'read' };
                    if ((await currentTrack.fileHandle.queryPermission(opts)) !== 'granted') {
                        if ((await currentTrack.fileHandle.requestPermission(opts)) !== 'granted') {
                            console.error("Permission denied to play file handle");
                            return;
                        }
                    }
                    const file = await currentTrack.fileHandle.getFile();
                    loadFile(file);
                } catch (err) {
                    console.error("Error loading file from handle:", err);
                }
            }
        }

        loadTrack();
    }, [currentTrack]);

    // Auto-play when ready if it was already playing or if it's a new track from next/prev
    useEffect(() => {
        if (isReady && !isPlaying && currentTrack) {
            // Check if we should auto-play. For auto-proceed, we usually want it to play.
            // We can add a more sophisticated check here if needed.
            play();
        }
    }, [isReady, currentTrack]);


    const handleRangeChange = (type, sliderVal) => {
        const val = Number(sliderVal);

        if (type === 'low') {
            // Ensure we don't cross the high slider visually
            // But more importantly, convert to Hz and check
            const potentialLowHz = toLog(val, MIN_FREQ, MAX_FREQ);
            const currentHighHz = toLog(highSlider, MIN_FREQ, MAX_FREQ);

            if (potentialLowHz < currentHighHz) {
                setLowSlider(val);
                setFrequencyRange(potentialLowHz, currentHighHz);
            }
        } else {
            const potentialHighHz = toLog(val, MIN_FREQ, MAX_FREQ);
            const currentLowHz = toLog(lowSlider, MIN_FREQ, MAX_FREQ);

            if (potentialHighHz > currentLowHz) {
                setHighSlider(val);
                setFrequencyRange(currentLowHz, potentialHighHz);
            }
        }
    };

    // Helpers for display
    const getHz = (sliderVal) => Math.round(toLog(sliderVal, MIN_FREQ, MAX_FREQ));
    const formatTime = (t) => {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="player-container">
            {/* File Loader (Show only if no track selected from Library) */}
            {!currentTrack && (
                <div className="control-group">
                    <label className="file-upload-btn">
                        <span>{localFilename ? 'File Loaded' : 'Select Audio File'}</span>
                        <input type="file" accept="audio/*" onChange={handleFileChange} hidden />
                    </label>
                    {localFilename && <div className="track-info">{localFilename}</div>}
                </div>
            )}

            {/* Track Info (from Library) */}
            {currentTrack && (
                <div className="track-info-display">
                    <h2>{currentTrack.title || currentTrack.filename}</h2>
                    <p>{currentTrack.artist || 'Unknown Artist'}</p>
                </div>
            )}

            {/* Main Controls */}
            <div className="main-controls">
                <button className="nav-btn" onClick={onPrev} disabled={!onPrev}>|&lt;</button>
                <button
                    className={`play-btn ${isPlaying ? 'active' : ''}`}
                    onClick={isPlaying ? pause : play}
                    disabled={!isReady}
                >
                    {isPlaying ? 'PAUSE' : 'PLAY'}
                </button>
                <button className="nav-btn" onClick={onNext} disabled={!onNext}>&gt;|</button>
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

            {/* Frequency Isolator (Logarithmic) */}
            <div className="isolator-section">
                <h3>Frequency Isolator</h3>

                <div className="sliders-container">
                    {/* Low Cut Slider */}
                    <div className="slider-group">
                        <label>Low Cut ({getHz(lowSlider)} Hz)</label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.1}
                            value={lowSlider}
                            className="freq-slider low-slider"
                            onChange={(e) => handleRangeChange('low', e.target.value)}
                        />
                    </div>

                    {/* High Cut Slider */}
                    <div className="slider-group">
                        <label>High Cut ({getHz(highSlider)} Hz)</label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.1}
                            value={highSlider}
                            className="freq-slider high-slider"
                            onChange={(e) => handleRangeChange('high', e.target.value)}
                        />
                    </div>
                </div>

                <p className="hint-text">
                    Bandwidth: <strong>{getHz(highSlider) - getHz(lowSlider)} Hz</strong>
                </p>
            </div>
        </div>
    );
}
