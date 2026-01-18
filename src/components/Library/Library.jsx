import { useState, useRef, useEffect } from 'react';
// import * as mm from 'music-metadata-browser'; // Removed to speed up load
import { v4 as uuidv4 } from 'uuid';
import { get, set } from 'idb-keyval';
import './Library.css';

export default function Library({ onTrackSelect, currentTrackId }) {
    const [playlist, setPlaylist] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const fileInputRef = useRef(null);

    // Load from IDB on mount
    useEffect(() => {
        async function loadLibrary() {
            const stored = await get('music-library');
            if (stored) {
                setPlaylist(stored);
            }
        }
        loadLibrary();
    }, []);

    // Save to IDB helper
    // Save to IDB helper with batching support
    const saveLibrary = async (newTracks, replace = false) => {
        setPlaylist(prev => {
            const updated = replace ? newTracks : [...prev, ...newTracks];

            // Async persistence to avoid blocking the UI
            const serializable = updated.map(t => {
                const { file, ...rest } = t;
                return rest;
            });
            set('music-library', serializable).catch(err =>
                console.error("Failed to persist library:", err)
            );

            return updated;
        });
    };

    // Helper to create track object from file (Faster, filename-based)
    const parseFile = async (file, handle = null) => {
        try {
            return {
                id: uuidv4(),
                file: file, // Runtime usage only (Blob)
                fileHandle: handle, // Persistence usage
                filename: file.name,
                title: file.name.replace(/\.[^/.]+$/, ""), // Strip extension for title
                artist: 'Unknown Artist',
                album: 'Unknown Album'
            };
        } catch (e) {
            console.error("Error creating track object:", e);
            return null;
        }
    };

    // Play Handler (Wrapper to ensure file access)
    const handleTrackClick = async (track) => {
        // If we already have the file blob (freshly imported), just play
        if (track.file) {
            onTrackSelect(track, playlist);
            return;
        }

        // If we have a handle (persisted), verify permission -> getFile -> play
        if (track.fileHandle) {
            try {
                // Check access
                const opts = { mode: 'read' };
                // queryPermission is often enough, but requestPermission covers the standard flow
                if ((await track.fileHandle.queryPermission(opts)) !== 'granted') {
                    if ((await track.fileHandle.requestPermission(opts)) !== 'granted') {
                        alert("Permission denied. Cannot play file.");
                        return;
                    }
                }

                const file = await track.fileHandle.getFile();
                // Create a temp track object with the file blob to send to player
                const playableTrack = { ...track, file };
                onTrackSelect(playableTrack, playlist);
            } catch (err) {
                console.error("Error retrieving file handle:", err);
                alert("Could not load file. It may have been moved or deleted.");
            }
            return;
        }

        // Fallback for non-persisted files that were lost on reload
        alert("This file cannot be reloaded (Legacy Mode). Please re-import your folder.");
    };


    // Modern Directory Picker (Desktop/Android Chrome 109+)
    const handleDirectoryPick = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setIsScanning(true);

            const newTracks = [];

            // Recursive walker
            async function scanDir(dirHandle) {
                console.log("Scanning directory:", dirHandle.name);
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file.type.startsWith('audio/')) {
                            const track = await parseFile(file, entry);
                            if (track) {
                                // Update UI immediately
                                setPlaylist(prev => [...prev, track]);
                                // Store for final persistence
                                newTracks.push(track);
                            }
                        }
                    } else if (entry.kind === 'directory') {
                        await scanDir(entry);
                    }
                }
            }

            await scanDir(handle);

            // Final persistence of all new tracks added
            const stored = await get('music-library') || [];
            const serializableNew = newTracks.map(t => {
                const { file, ...rest } = t;
                return rest;
            });
            await set('music-library', [...stored, ...serializableNew]);

            setIsScanning(false);

        } catch (err) {
            // User cancelled or not supported -> Try fallback
            if (err.name === 'AbortError') return;
            console.log("Native picker failed/unsupported, using fallback", err);
            fileInputRef.current.click();
        }
    };

    // Fallback Input Handler
    const handleFallbackChange = async (e) => {
        setIsScanning(true);
        const files = Array.from(e.target.files);
        const newTracks = [];

        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                const track = await parseFile(file);
                if (track) {
                    setPlaylist(prev => [...prev, track]);
                    newTracks.push(track);
                }
            }
        }

        // Final persistence
        const stored = await get('music-library') || [];
        const serializableNew = newTracks.map(t => {
            const { file, ...rest } = t;
            return rest;
        });
        await set('music-library', [...stored, ...serializableNew]);

        setIsScanning(false);
    };

    return (
        <div className="library-container">
            <div className="library-header">
                <h2>Your Library ({playlist.length})</h2>
                <div className="library-actions">
                    <button className="import-btn" onClick={handleDirectoryPick}>
                        + Add Folder
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
                        onClick={() => handleTrackClick(track)}
                    >
                        <div className="track-icon">🎵</div>
                        <div className="track-details">
                            <div className="track-title">{track.title}</div>
                            <div className="track-artist">{track.artist}</div>
                            {!track.file && !track.fileHandle && <span className="warning-badge">Legacy (Lost on Reload)</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
