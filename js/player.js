/* ============================================================
   Pulse Music — player.js
   Audio Engine & Playback Controller
   ============================================================ */
(function () {
  'use strict';

  // ── Helper: dispatch custom event on document ───────────────
  const emit = (name, detail = {}) => {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  };

  // ── Player state ────────────────────────────────────────────
  const state = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off', // 'off' | 'one' | 'all'
    volume: 0.7,
    previousVolume: 0.7,
    isMuted: false,
    audio: null,
    audioContext: null,
    analyser: null,
    sourceNode: null,
    rafId: null
  };

  // ── Animation loop for time updates ─────────────────────────
  const tick = () => {
    if (state.audio && !state.audio.paused) {
      emit('player:timeupdate', {
        current: state.audio.currentTime,
        total: state.audio.duration || 0,
        percentage: state.audio.duration ? (state.audio.currentTime / state.audio.duration) * 100 : 0
      });
    }
    state.rafId = requestAnimationFrame(tick);
  };

  // ── Shuffle helper: Fisher-Yates ────────────────────────────
  const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ── Update MediaSession metadata ────────────────────────────
  const updateMediaSession = (track) => {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: [
        { src: track.coverUrl, sizes: '300x300', type: 'image/jpeg' }
      ]
    });
  };

  // ── Setup MediaSession handlers ─────────────────────────────
  const setMediaSessionState = (stateStr) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = stateStr;
    }
  };

  const setupMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => Player.resume());
    navigator.mediaSession.setActionHandler('pause', () => Player.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => Player.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => Player.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (state.audio && details.seekTime != null) {
        state.audio.currentTime = details.seekTime;
      }
    });
  };

  // ── Ensure AudioContext + AnalyserNode ──────────────────────
  const ensureAudioContext = () => {
    if (state.audioContext) return;
    
    // Web Audio API suspends when app goes to background on mobile (iOS/Android).
    // Bypass audio routing on mobile so background playback works flawlessly.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = window.innerWidth <= 768 || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isIOS;
    if (isMobile) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioContext = new AudioCtx();
      
      // Audio Enhancement: Bass Filter for clear and cut bass
      state.bassFilter = state.audioContext.createBiquadFilter();
      state.bassFilter.type = 'lowshelf';
      state.bassFilter.frequency.value = 100; // Target deep bass frequencies
      state.bassFilter.gain.value = 6; // Reasonable boost to avoid heavy distortion

      // Audio Enhancement: Dynamics Compressor for audible stability and noise reduction
      state.compressor = state.audioContext.createDynamicsCompressor();
      state.compressor.threshold.value = -12; // Start compressing at -12dB
      state.compressor.knee.value = 10;
      state.compressor.ratio.value = 4; // Moderate compression ratio
      state.compressor.attack.value = 0.005; // Fast attack to catch peaks
      state.compressor.release.value = 0.1; // Quick release

      // Optional Gain Node to restore volume gracefully without clipping
      state.gainNode = state.audioContext.createGain();
      state.gainNode.gain.value = 1.1; 

      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 256;
      state.analyser.smoothingTimeConstant = 0.8;
      
      state.sourceNode = state.audioContext.createMediaElementSource(state.audio);
      
      // Connect graph: source -> bassFilter -> compressor -> gainNode -> analyser -> destination
      state.sourceNode.connect(state.bassFilter);
      state.bassFilter.connect(state.compressor);
      state.compressor.connect(state.gainNode);
      state.gainNode.connect(state.analyser);
      state.analyser.connect(state.audioContext.destination);
    } catch (err) {
      console.warn('[Player] Web Audio API unavailable:', err);
    }
  };

  // ── Public Player API ───────────────────────────────────────
  const Player = {

    /* ---- Getters ---- */
    get currentTrack() { return state.currentTrack; },
    get queue() { return state.queue; },
    get queueIndex() { return state.queueIndex; },
    get isPlaying() { return state.isPlaying; },
    get isShuffle() { return state.isShuffle; },
    get repeatMode() { return state.repeatMode; },
    get volume() { return state.volume; },
    get isMuted() { return state.isMuted; },
    get analyser() { return state.analyser; },
    get audio() { return state.audio; },

    /* ---- Initialise ---- */
    init() {
      state.audio = new Audio();
      state.audio.crossOrigin = 'anonymous';
      state.audio.preload = 'auto';
      state.audio.playsInline = true;
      state.audio.setAttribute('webkit-playsinline', 'true');
      state.audio.style.display = 'none';
      // Critical for iOS background playback: append to DOM
      document.body.appendChild(state.audio);

      // Restore saved volume
      const savedVol = localStorage.getItem('pulse_volume');
      if (savedVol !== null) {
        state.volume = parseFloat(savedVol);
      }
      state.audio.volume = state.volume;

      // Audio ended handler
      state.audio.addEventListener('ended', () => {
        emit('player:ended');
        if (state.repeatMode === 'one') {
          state.audio.currentTime = 0;
          state.audio.play().catch(() => {});
        } else {
          Player.next();
        }
      });

      // Keep OS lock screen progress bar synced in the background
      state.audio.addEventListener('timeupdate', () => {
        if ('setPositionState' in navigator.mediaSession && state.audio.duration && !isNaN(state.audio.duration)) {
          try {
            navigator.mediaSession.setPositionState({
              duration: state.audio.duration,
              playbackRate: state.audio.playbackRate || 1,
              position: state.audio.currentTime
            });
          } catch (e) {}
        }
      });

      // Crucial for iOS: Sync state when OS natively pauses/plays background audio
      state.audio.addEventListener('play', () => {
        state.isPlaying = true;
        setMediaSessionState('playing');
        emit('player:play', { track: state.currentTrack });
      });

      state.audio.addEventListener('pause', () => {
        state.isPlaying = false;
        setMediaSessionState('paused');
        emit('player:pause');
      });

      state.audio.addEventListener('playing', () => {
        state.isPlaying = true;
        setMediaSessionState('playing');
        emit('player:play', { track: state.currentTrack });
      });

      // Error handler
      state.audio.addEventListener('error', (e) => {
        console.error('[Player] Audio error:', e);
        emit('player:error', { error: e });
      });

      setupMediaSession();
      tick(); // start animation frame loop
      console.log('[Player] Initialised');
    },

    /* ---- Play a specific track ---- */
    play(track, queueIndex = -1) {
      if (!track) return;
      state.currentTrack = track;
      if (queueIndex >= 0) state.queueIndex = queueIndex;
      
      // Ensure AudioContext is initialized/unlocked synchronously within the user gesture
      ensureAudioContext();
      if (state.audioContext && state.audioContext.state === 'suspended') {
        state.audioContext.resume().catch(err => console.warn(err));
      }
      
      state.audio.src = track.audioUrl;
      state.audio.load();
      emit('player:trackchange', { track });

      const playPromise = state.audio.play();
      if (playPromise) {
        playPromise.then(() => {
          state.isPlaying = true;
          emit('player:play', { track });
          updateMediaSession(track);
          setMediaSessionState('playing');
        }).catch((err) => {
          console.warn('[Player] Autoplay blocked:', err);
          state.isPlaying = false;
          emit('player:pause');
          updateMediaSession(track);
          setMediaSessionState('paused');
        });
      }
    },

    /* ---- Pause / Resume / Toggle ---- */
    pause() {
      state.audio.pause();
      state.isPlaying = false;
      emit('player:pause');
      setMediaSessionState('paused');
    },

    resume() {
      if (!state.currentTrack) return;
      ensureAudioContext();
      if (state.audioContext && state.audioContext.state === 'suspended') {
        state.audioContext.resume().catch(() => {});
      }
      state.audio.play().then(() => {
        state.isPlaying = true;
        emit('player:play', { track: state.currentTrack });
        setMediaSessionState('playing');
      }).catch((err) => {
        console.warn('[Player] Resume failed:', err);
        state.isPlaying = false;
        emit('player:pause');
        setMediaSessionState('paused');
      });
    },

    togglePlay() {
      if (state.isPlaying) {
        Player.pause();
      } else if (state.currentTrack) {
        Player.resume();
      } else if (state.queue.length) {
        Player.play(state.queue[0]);
        state.queueIndex = 0;
      }
    },

    /* ---- Queue management ---- */
    setQueue(tracks, startIndex = 0) {
      if (!tracks || !tracks.length) return;
      state.queue = [...tracks];
      state.queueIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
      emit('player:queuechange', { queue: state.queue });
      Player.play(state.queue[state.queueIndex]);
    },

    addToQueue(track) {
      if (!track) return;
      state.queue.push(track);
      emit('player:queuechange', { queue: state.queue });
    },

    removeFromQueue(index) {
      if (index < 0 || index >= state.queue.length) return;
      state.queue.splice(index, 1);
      if (index < state.queueIndex) state.queueIndex--;
      if (state.queueIndex >= state.queue.length) state.queueIndex = state.queue.length - 1;
      emit('player:queuechange', { queue: state.queue });
    },

    clearQueue() {
      state.queue = [];
      state.queueIndex = -1;
      emit('player:queuechange', { queue: [] });
    },

    /* ---- Navigation ---- */
    next() {
      if (!state.queue.length) return;
      if (state.queue.length === 1) {
        state.audio.currentTime = 0;
        if (state.isPlaying) state.audio.play().catch(() => {});
        return;
      }

      if (state.isShuffle) {
        let nextIdx = Math.floor(Math.random() * state.queue.length);
        if (nextIdx === state.queueIndex) nextIdx = (nextIdx + 1) % state.queue.length;
        state.queueIndex = nextIdx;
      } else {
        state.queueIndex++;
        if (state.queueIndex >= state.queue.length) {
          if (state.repeatMode === 'all') {
            state.queueIndex = 0;
          } else {
            state.queueIndex = state.queue.length - 1;
            Player.pause();
            return;
          }
        }
      }
      Player.play(state.queue[state.queueIndex]);
    },

    previous() {
      if (!state.queue.length) return;

      // If more than 3s in, restart current track
      if (state.audio.currentTime > 3) {
        state.audio.currentTime = 0;
        return;
      }
      if (state.queue.length === 1) {
        state.audio.currentTime = 0;
        if (state.isPlaying) state.audio.play().catch(() => {});
        return;
      }

      state.queueIndex--;
      if (state.queueIndex < 0) {
        if (state.repeatMode === 'all') {
          state.queueIndex = state.queue.length - 1;
        } else {
          state.queueIndex = 0;
        }
      }
      Player.play(state.queue[state.queueIndex]);
    },

    /* ---- Shuffle & Repeat ---- */
    toggleShuffle() {
      state.isShuffle = !state.isShuffle;
      emit('player:shufflechange', { isShuffle: state.isShuffle });
    },

    cycleRepeat() {
      const modes = ['off', 'one', 'all'];
      const idx = modes.indexOf(state.repeatMode);
      state.repeatMode = modes[(idx + 1) % modes.length];
      emit('player:repeatchange', { repeatMode: state.repeatMode });
    },

    /* ---- Volume ---- */
    setVolume(val) {
      state.volume = Math.max(0, Math.min(1, val));
      state.audio.volume = state.volume;
      state.isMuted = state.volume === 0;
      localStorage.setItem('pulse_volume', state.volume);
      emit('player:volumechange', { volume: state.volume });
    },

    toggleMute() {
      if (state.isMuted) {
        Player.setVolume(state.previousVolume || 0.7);
        state.isMuted = false;
      } else {
        state.previousVolume = state.volume;
        Player.setVolume(0);
        state.isMuted = true;
      }
    },

    /* ---- Seek ---- */
    seek(percentage) {
      if (!state.audio.duration) return;
      state.audio.currentTime = (percentage / 100) * state.audio.duration;
    },

    seekBy(seconds) {
      if (!state.audio.duration) return;
      state.audio.currentTime = Math.max(0, Math.min(state.audio.duration, state.audio.currentTime + seconds));
    },

    /* ---- Progress info ---- */
    getProgress() {
      return {
        current: state.audio ? state.audio.currentTime : 0,
        total: state.audio ? (state.audio.duration || 0) : 0,
        percentage: state.audio && state.audio.duration
          ? (state.audio.currentTime / state.audio.duration) * 100
          : 0
      };
    },

    /* ---- Analyser data for visualizer ---- */
    getAnalyserData() {
      if (!state.analyser) return new Uint8Array(128);
      const data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(data);
      return data;
    }
  };

  window.Player = Player;
})();
