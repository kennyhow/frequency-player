# Frequency Player 🎛️

A high-fidelity web-based music player designed for precise frequency isolation. Built with **React**, **Vite**, and the **Web Audio API**.

## 🌟 Features

*   **High-Fidelity Isolation**: Uses a cascading filter engine (48dB/octave slope) to cleanly separate frequency bands.
*   **Dual-Band Control**: Independent **Low Cut** and **High Cut** sliders to isolate specific ranges (Bass, Mids, Highs).
*   **Zero Latency**: Real-time audio processing using native browser audio primitives.
*   **Rich Aesthetics**: Premium dark mode interface with neon accents and glassmorphism.

## 🛠️ Tech Stack

*   **Frontend**: React 18, Vite 5
*   **Audio**: Web Audio API (`AudioContext`, `BiquadFilterNode`)
*   **Styling**: Vanilla CSS (Variables, Flexbox, Glassmorphism)

## 🚀 Getting Started

1.  **Installation**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```

3.  **Usage**:
    *   Click to upload an audio file (mp3, wav).
    *   Press Play.
    *   Adjust the **Low Cut** and **High Cut** sliders to isolate the frequency range you want to hear.

## 🎧 Isolation Tips

*   **Isolate Bass**: Drag *High Cut* down to ~250Hz.
*   **Isolate Vocals**: Set *Low Cut* to ~300Hz and *High Cut* to ~3000Hz.
*   **Isolate Highs**: Drag *Low Cut* up to ~5000Hz.
