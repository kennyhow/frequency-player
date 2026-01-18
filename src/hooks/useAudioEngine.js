import { useRef, useState, useEffect, useCallback } from 'react';

export function useAudioEngine() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);

    // Audio Context & Nodes Refs
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyserNodeRef = useRef(null);

    // High-Fidelity Filter Chain Refs (4x HighPass, 4x LowPass)
    const highPassFiltersRef = useRef([]);
    const lowPassFiltersRef = useRef([]);

    // Audio Buffer
    const audioBufferRef = useRef(null);
    const startTimeRef = useRef(0);
    const pauseTimeRef = useRef(0);
    const animationFrameRef = useRef(null);

    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    const createFilterChain = (ctx) => {
        const highPass = [];
        const lowPass = [];

        // Create 4 HighPass filters for 48dB/oct steepness
        for (let i = 0; i < 4; i++) {
            const node = ctx.createBiquadFilter();
            node.type = 'highpass';
            node.frequency.value = 20; // Default: allow all
            node.Q.value = 0.707; // Butterworth
            highPass.push(node);
        }

        // Create 4 LowPass filters for 48dB/oct steepness
        for (let i = 0; i < 4; i++) {
            const node = ctx.createBiquadFilter();
            node.type = 'lowpass';
            node.frequency.value = 20000; // Default: allow all
            node.Q.value = 0.707; // Butterworth
            lowPass.push(node);
        }

        // Connect them efficiently: HP1->HP2->HP3->HP4->LP1->LP2->LP3->LP4
        // Connect standard chain
        // Helper to connect an array series

        return { highPass, lowPass };
    };

    const loadFile = async (file) => {
        initAudioContext();
        setIsPlaying(false);
        setIsReady(false);

        // Stop previous
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch (e) { }
            sourceNodeRef.current.disconnect();
        }

        const arrayBuffer = await file.arrayBuffer();
        const ctx = audioContextRef.current;

        try {
            const decodedData = await ctx.decodeAudioData(arrayBuffer);
            audioBufferRef.current = decodedData;
            setDuration(decodedData.duration);
            setIsReady(true);
            pauseTimeRef.current = 0;
        } catch (err) {
            console.error("Error decoding audio:", err);
        }
    };

    const play = () => {
        if (!isReady || !audioBufferRef.current) return;
        const ctx = audioContextRef.current;
        initAudioContext();

        // Re-create source node on every play (required by Web Audio API)
        const source = ctx.createBufferSource();
        source.buffer = audioBufferRef.current;
        sourceNodeRef.current = source;

        // Create nodes if not exist
        if (!gainNodeRef.current) {
            gainNodeRef.current = ctx.createGain();
            analyserNodeRef.current = ctx.createAnalyser();
            analyserNodeRef.current.fftSize = 2048;

            const { highPass, lowPass } = createFilterChain(ctx);
            highPassFiltersRef.current = highPass;
            lowPassFiltersRef.current = lowPass;
        }

        // Connect Chain
        // Source -> HP Chain -> LP Chain -> Gain -> Analyser -> Dest

        const hps = highPassFiltersRef.current;
        const lps = lowPassFiltersRef.current;

        source.connect(hps[0]);
        for (let i = 0; i < hps.length - 1; i++) hps[i].connect(hps[i + 1]);

        hps[hps.length - 1].connect(lps[0]);

        for (let i = 0; i < lps.length - 1; i++) lps[i].connect(lps[i + 1]);

        lps[lps.length - 1].connect(gainNodeRef.current);
        gainNodeRef.current.connect(analyserNodeRef.current);
        analyserNodeRef.current.connect(ctx.destination);

        // Calculate start time
        const startOffset = pauseTimeRef.current;
        startTimeRef.current = ctx.currentTime - startOffset;

        source.start(0, startOffset);
        setIsPlaying(true);

        // Update Timer Loop
        const update = () => {
            if (!sourceNodeRef.current) return;
            const now = ctx.currentTime;
            // Simple loop for visualization or time update
            setCurrentTime(Math.min(now - startTimeRef.current, audioBufferRef.current.duration));

            if (ctx.state === 'running') {
                animationFrameRef.current = requestAnimationFrame(update);
            }
        };
        update();

        source.onended = () => {
            setIsPlaying(false);
            // Don't reset time immediately for UX
        };
    };

    const pause = () => {
        if (!sourceNodeRef.current) return;
        const ctx = audioContextRef.current;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;

        // Save time
        pauseTimeRef.current = ctx.currentTime - startTimeRef.current;
        setIsPlaying(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    const setFrequencyRange = (minHz, maxHz) => {
        const ctx = audioContextRef.current;
        if (!ctx) return;
        const now = ctx.currentTime;

        // Update all High Pass filters (Cut below minHz)
        highPassFiltersRef.current.forEach(node => {
            node.frequency.setTargetAtTime(Math.max(20, minHz), now, 0.05); // Smooth transition
        });

        // Update all Low Pass filters (Cut above maxHz)
        lowPassFiltersRef.current.forEach(node => {
            node.frequency.setTargetAtTime(Math.min(20000, maxHz), now, 0.05);
        });
    };

    return {
        loadFile,
        play,
        pause,
        isPlaying,
        isReady,
        duration,
        currentTime,
        setFrequencyRange,
        analyser: analyserNodeRef.current
    };
}
