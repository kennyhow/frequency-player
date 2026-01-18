import { useState, useRef, useEffect } from 'react';
import * as mm from 'music-metadata-browser';
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
    const saveLibrary = async (newTracks) => {
        // We must NOT store the 'file' (Blob) in IDB for the lightweight method
        // But we MUST store 'fileHandle' if it exists. 
        // If it's a fallback file (no handle), we can't persist it effectively without copying.
        // Our plan: Store the track object. If 'file' is there, remove it before saving.

        // Merge with existing
        const updated = [...playlist, ...newTracks];
        const serializable = updated.map(t => {
            const { file, ...rest } = t; // Exclude raw file blob
            return rest;
        });

        await set('music-library', serializable);
        setPlaylist(updated);
    };

    // Helper to parse file metadata
    const parseFile = async (file, handle = null) => {
        try {
            // Basic info
            const track = {
                id: uuidv4(),
                file: file, // Runtime usage only (Blob)
                fileHandle: handle, // Persistence usage
                filename: file.name,
                title: file.name,
                artist: 'Unknown Artist',
                album: 'Unknown Album'
            };

            // Attempt ID3 parse
            try {
                console.log("Starting mm.parseBlob for:", file.name);

                // Race against a 300ms timeout
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
                        // We get the file to parse metadata, but we also save the 'entry' as fileHandle
                        const file = await entry.getFile();
                        if (file.type.startsWith('audio/')) {
                            console.log("Found audio file:", file.name);
                            const track = await parseFile(file, entry);
                            if (track) {
                                console.log("Parsed track:", track.title);
                                newTracks.push(track);
                            } else {
                                console.warn("Skipping track (parse returned null):", file.name);
                            }
                        }
                    } else if (entry.kind === 'directory') {
                        await scanDir(entry);
                    }
                }
            }

            await scanDir(handle);
            await saveLibrary(newTracks);
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
                if (track) newTracks.push(track);
            }
        }
        // Note: We scan these, but since they have no handles, 
        // they won't work after reload. We still save them to IDB so the list shows up,
        // but clicking them will fail (handled in handleTrackClick).
        await saveLibrary(newTracks);
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
