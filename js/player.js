/* ============================================================
   Pulse Music — player.js
   Audio Engine & Playback Controller
   iOS-Stable Version: audio.paused is the single source of truth
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
    // NOTE: NO isPlaying in state. We use audio.paused as the single source of truth.
    // This is the #1 cause of iOS desync: a stale boolean that diverges from reality.
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

  // ── Set MediaSession playback state ────────────────────────
  const setMediaSessionState = (playbackState) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playbackState;
    }
  };

  // ── Setup MediaSession handlers ─────────────────────────────
  const setupMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    // These are the handlers iOS/Android lock screen and control center calls.
    // They MUST call the actual play/pause on the audio element directly.
    navigator.mediaSession.setActionHandler('play', () => Player.resume());
    navigator.mediaSession.setActionHandler('pause', () => Player.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => Player.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => Player.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (state.audio && details.seekTime != null) {
        state.audio.currentTime = details.seekTime;
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skip = details.seekOffset || 10;
      state.audio.currentTime = Math.max(0, state.audio.currentTime - skip);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skip = details.seekOffset || 10;
      state.audio.currentTime = Math.min(state.audio.duration || 0, state.audio.currentTime + skip);
    });
  };

  // ── Ensure AudioContext + AnalyserNode (desktop only) ───────
  const ensureAudioContext = () => {
    if (state.audioContext) return;

    // CRITICAL iOS FIX: NEVER create a Web Audio API context on iOS/iPadOS.
    // The AudioContext is suspended by the OS when the app goes to background,
    // which cuts off audio completely. We use the plain HTMLAudioElement instead,
    // which iOS handles natively and allows background playback.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isIOS || isAndroid) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioContext = new AudioCtx();

      state.bassFilter = state.audioContext.createBiquadFilter();
      state.bassFilter.type = 'lowshelf';
      state.bassFilter.frequency.value = 100;
      state.bassFilter.gain.value = 6;

      state.compressor = state.audioContext.createDynamicsCompressor();
      state.compressor.threshold.value = -12;
      state.compressor.knee.value = 10;
      state.compressor.ratio.value = 4;
      state.compressor.attack.value = 0.005;
      state.compressor.release.value = 0.1;

      state.gainNode = state.audioContext.createGain();
      state.gainNode.gain.value = 1.1;

      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 256;
      state.analyser.smoothingTimeConstant = 0.8;

      state.sourceNode = state.audioContext.createMediaElementSource(state.audio);
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
    // isPlaying reads directly from the audio element — NEVER from a cached boolean.
    // This is the permanent fix for iOS lock screen desync.
    get isPlaying() { return state.audio ? !state.audio.paused : false; },
    get isShuffle() { return state.isShuffle; },
    get repeatMode() { return state.repeatMode; },
    get volume() { return state.volume; },
    get isMuted() { return state.isMuted; },
    get analyser() { return state.analyser; },
    get audio() { return state.audio; },

    /* ---- Initialise ---- */
    init() {
      state.audio = new Audio();
      // Do NOT set crossOrigin on iOS — it prevents iOS from caching/resuming audio
      const isIOS_init = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        ('ontouchend' in document && /Mac/.test(navigator.userAgent));
      if (!isIOS_init) state.audio.crossOrigin = 'anonymous';
      state.audio.preload = 'auto';
      // Required for iOS to not force fullscreen video player
      state.audio.playsInline = true;
      state.audio.setAttribute('webkit-playsinline', 'true');
      state.audio.style.display = 'none';
      // Required for iOS: audio element MUST be in the DOM to allow background playback
      document.body.appendChild(state.audio);

      // Restore saved volume
      const savedVol = localStorage.getItem('pulse_volume');
      if (savedVol !== null) state.volume = parseFloat(savedVol);
      state.audio.volume = state.volume;

      // --- Native audio element events are the ONLY source of truth ---
      // This ensures iOS lock screen, control center, and app switching
      // ALL stay perfectly in sync with the real audio state.

      state.audio.addEventListener('playing', () => {
        // 'playing' fires when audio actually starts making sound (after buffering)
        setMediaSessionState('playing');
        emit('player:play', { track: state.currentTrack });
        console.log('[Player] playing');
      });

      state.audio.addEventListener('pause', () => {
        // 'pause' fires whether WE pause it or iOS pauses it in background
        setMediaSessionState('paused');
        emit('player:pause');
        console.log('[Player] pause');
      });

      state.audio.addEventListener('ended', () => {
        emit('player:ended');
        if (state.repeatMode === 'one') {
          state.audio.currentTime = 0;
          state.audio.play().catch(() => {});
        } else {
          Player.next();
        }
      });

      // Sync position to OS lock screen progress bar every tick
      state.audio.addEventListener('timeupdate', () => {
        if ('setPositionState' in navigator.mediaSession &&
            state.audio.duration && !isNaN(state.audio.duration)) {
          try {
            navigator.mediaSession.setPositionState({
              duration: state.audio.duration,
              playbackRate: state.audio.playbackRate || 1,
              position: Math.min(state.audio.currentTime, state.audio.duration)
            });
          } catch (e) {}
        }
      });

      state.audio.addEventListener('error', (e) => {
        console.error('[Player] Audio error:', e);
        emit('player:error', { error: e });
      });

      // iOS FIX: When app returns to foreground, force re-sync the audio state.
      // iOS can silently drop or corrupt the audio buffer while in background.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.currentTrack) {
          // If iOS thinks audio is playing but it's actually silent, fix it.
          setTimeout(() => {
            if (!state.audio.paused && state.audio.readyState < 3) {
              // Audio is "playing" but has no data — iOS dropped the buffer
              console.warn('[Player] iOS buffer dropped detected, reloading...');
              Player._reloadAndResume();
            }
          }, 500);
        }
      });

      setupMediaSession();
      tick(); // start animation frame loop
      console.log('[Player] Initialised (iOS-stable mode)');
    },

    /* ---- Play a specific track ---- */
    play(track, queueIndex = -1) {
      if (!track) return;
      state.currentTrack = track;
      if (queueIndex >= 0) state.queueIndex = queueIndex;

      ensureAudioContext();
      if (state.audioContext && state.audioContext.state === 'suspended') {
        state.audioContext.resume().catch(err => console.warn(err));
      }

      state.audio.src = track.audioUrl;
      state.audio.load();
      emit('player:trackchange', { track });
      updateMediaSession(track);
      setMediaSessionState('playing');

      state.audio.play().catch((err) => {
        console.warn('[Player] Autoplay blocked:', err);
        setMediaSessionState('paused');
        emit('player:pause');
      });
    },

    /* ---- Pause ---- */
    pause() {
      state.audio.pause();
      // State update happens via the 'pause' event listener above
    },

    /* ---- Resume (iOS-bulletproof) ---- */
    resume() {
      if (!state.currentTrack) return;
      ensureAudioContext();
      if (state.audioContext && state.audioContext.state === 'suspended') {
        state.audioContext.resume().catch(() => {});
      }

      // iOS drops the audio buffer when backgrounded. Detect this and reload.
      // readyState 0 = HAVE_NOTHING (buffer was cleared by iOS)
      // readyState 1 = HAVE_METADATA only (not enough to play)
      const bufferDropped = state.audio.readyState < 2 ||
        state.audio.networkState === HTMLMediaElement.NETWORK_EMPTY ||
        !state.audio.src || state.audio.src === window.location.href;

      if (bufferDropped) {
        console.warn('[Player] iOS audio buffer dropped — reloading from', state.audio.currentTime);
        Player._reloadAndResume();
        return;
      }

      // Normal resume — audio buffer is still intact
      state.audio.play().then(() => {
        setMediaSessionState('playing');
      }).catch((err) => {
        console.warn('[Player] Resume failed, trying reload:', err.name, err.message);
        // If normal play fails (e.g. iOS NotAllowedError or NotSupportedError), force reload
        Player._reloadAndResume();
      });
    },

    /* ---- Internal: Reload src and resume from saved position (iOS fix) ---- */
    _reloadAndResume() {
      if (!state.currentTrack) return;
      const savedTime = state.audio.currentTime || 0;
      state.audio.src = state.currentTrack.audioUrl;
      state.audio.load();
      const onCanPlay = () => {
        state.audio.removeEventListener('canplay', onCanPlay);
        state.audio.currentTime = savedTime;
        state.audio.play().catch((err) => {
          console.error('[Player] Reload+play failed:', err);
          setMediaSessionState('paused');
          emit('player:pause');
        });
      };
      state.audio.addEventListener('canplay', onCanPlay);
    },

    /* ---- Toggle ---- */
    togglePlay() {
      // Read directly from audio.paused, never from a cached boolean
      if (state.audio && !state.audio.paused) {
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
        if (!state.audio.paused) state.audio.play().catch(() => {});
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

      if (state.audio.currentTime > 3) {
        state.audio.currentTime = 0;
        return;
      }
      if (state.queue.length === 1) {
        state.audio.currentTime = 0;
        if (!state.audio.paused) state.audio.play().catch(() => {});
        return;
      }

      state.queueIndex--;
      if (state.queueIndex < 0) {
        state.queueIndex = state.repeatMode === 'all' ? state.queue.length - 1 : 0;
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
