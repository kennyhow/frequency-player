import { useState, useRef } from 'react';
import * as mm from 'music-metadata-browser';
import { v4 as uuidv4 } from 'uuid';
import './Library.css';

export default function Library({ onTrackSelect, currentTrackId }) {
    const [playlist, setPlaylist] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const fileInputRef = useRef(null);

    // Helper to parse file metadata
    const parseFile = async (file) => {
        try {
            // Basic info
            const track = {
                id: uuidv4(),
                file: file, // File object to play
                filename: file.name,
                title: file.name,
                artist: 'Unknown Artist',
                album: 'Unknown Album'
            };

            try {
                console.log("Starting mm.parseBlob for:", file.name);

                // Race against a 2-second timeout
                const metadata = await Promise.race([
                    mm.parseBlob(file),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 300))
                ]);

                console.log("mm.parseBlob success for:", file.name);
                if (metadata.common.title) track.title = metadata.common.title;
                if (metadata.common.artist) track.artist = metadata.common.artist;
                if (metadata.common.album) track.album = metadata.common.album;
            } catch (err) {
                console.warn(`Metadata parse failed/timed-out for ${file.name}:`, err);
            }
            return track;
        } catch (e) {
            return null;
        }
    };

    // Modern Directory Picker (Desktop/Android Chrome 109+)
    const handleDirectoryPick = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setIsScanning(true);

            const tracks = [];

            // Recursive walker
            async function scanDir(dirHandle) {
                console.log("Scanning directory:", dirHandle.name);
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file.type.startsWith('audio/')) {
                            console.log("Found audio file:", file.name);
                            const track = await parseFile(file);
                            if (track) {
                                console.log("Parsed track:", track.title);
                                tracks.push(track);
                            } else {
                                console.warn("Track parse failed/skipped:", file.name);
                            }
                        }
                    } else if (entry.kind === 'directory') {
                        await scanDir(entry);
                    }
                }
            }

            await scanDir(handle);
            setPlaylist(prev => [...prev, ...tracks]);
            setIsScanning(false);

        } catch (err) {
            // User cancelled or not supported -> Try fallback
            if (err.name === 'AbortError') return;
            console.log("Native picker failed/unsupported, using fallback");
            fileInputRef.current.click();
        }
    };

    // Fallback Input Handler
    const handleFallbackChange = async (e) => {
        setIsScanning(true);
        const files = Array.from(e.target.files);
        const tracks = [];

        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                const track = await parseFile(file);
                if (track) tracks.push(track);
            }
        }
        setPlaylist(prev => [...prev, ...tracks]);
        setIsScanning(false);
    };

    return (
        <div className="library-container">
            <div className="library-header">
                <h2>Your Library</h2>
                <div className="library-actions">
                    <button className="import-btn" onClick={handleDirectoryPick}>
                        + Add Folder / Files
                    </button>
                    {/* Hidden fallback input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFallbackChange}
                        webkitdirectory="true"
                        multiple
                        hidden
                    />
                </div>
            </div>

            <div className="track-list">
                {isScanning && <div className="scanning-indicator">Scanning Metadata...</div>}

                {playlist.length === 0 && !isScanning && (
                    <div className="empty-state">
                        <p>No tracks loaded.</p>
                        <p className="sub-text">Tap "Add Folder" to import your music.</p>
                    </div>
                )}

                {playlist.map(track => (
                    <div
                        key={track.id}
                        className={`track-item ${currentTrackId === track.id ? 'active-track' : ''}`}
                        onClick={() => onTrackSelect(track, playlist)}
                    >
                        <div className="track-icon">🎵</div>
                        <div className="track-details">
                            <div className="track-title">{track.title}</div>
                            <div className="track-artist">{track.artist}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
