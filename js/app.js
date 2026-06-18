/* ============================================================
   Pulse Music — app.js
   Application Controller, Router & Event Delegation
   ============================================================ */
(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  let currentView = 'home';
  let searchDebounceTimer = null;
  const DEBOUNCE_MS = 350;

  const setFullscreenOpen = (isOpen) => {
    const fs = document.querySelector('.fullscreen-player');
    if (!fs) return;
    fs.classList.toggle('active', isOpen);
    fs.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen && window.Player && window.Player.currentTrack && window.UI) {
      window.UI.updatePlayerUI(window.Player.currentTrack);
    }
  };

  // ── Device Detection & View Transfer ─────────────────────────
  const updateViewMode = () => {
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.body.classList.add('mobile-view-active');
        document.body.classList.remove('desktop-view-active');
    } else {
        document.body.classList.add('desktop-view-active');
        document.body.classList.remove('mobile-view-active');
    }
  };

  // Initialize view mode
  window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(updateViewMode, 100);
  });
  updateViewMode();
  document.addEventListener('DOMContentLoaded', updateViewMode);

  // ── Router ──────────────────────────────────────────────────
  const parseHash = () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    const parts = hash.split('/');
    const view = parts[0].split('?')[0];
    const id = parts[1] || '';

    // Extract query param for search
    const qMatch = hash.match(/[?&]q=([^&]*)/);
    const query = qMatch ? decodeURIComponent(qMatch[1]) : '';

    return { view, id, query };
  };

  const navigate = (view, id = '', extra = {}) => {
    let hash = `#${view}`;
    if (id) hash += `/${id}`;
    if (extra.query) hash += `?q=${encodeURIComponent(extra.query)}`;
    window.location.hash = hash;
  };

  const renderView = () => {
    const { view, id, query } = parseHash();
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;

    const navBackBtn = document.getElementById('nav-back-btn');
    if (navBackBtn) {
      navBackBtn.style.display = view === 'home' ? 'none' : 'flex';
    }

    currentView = view;
    UI.setActiveNav(view);

    // Scroll to top
    contentBody.scrollTop = 0;
    
    // Add page transition class
    contentBody.classList.remove('content-loaded');
    void contentBody.offsetWidth; // trigger reflow
    contentBody.classList.add('content-loaded');

    switch (view) {
      case 'home':
        contentBody.innerHTML = UI.renderHome();
        loadTrendingAsync();
        break;
      case 'search':
        contentBody.innerHTML = UI.renderSearch(query);
        // Set search input value
        const searchInput = document.querySelector('.search-input');
        if (searchInput && query) searchInput.value = query;
        if (query) UI.loadSaavnSearch(query);
        break;
      case 'library':
        contentBody.innerHTML = UI.renderLibrary();
        if (window.activeSourceTab && window.applySourceFilter) {
          setTimeout(() => window.applySourceFilter(window.activeSourceTab), 0);
        }
        break;
      case 'liked':
        contentBody.innerHTML = UI.renderLikedSongs ? UI.renderLikedSongs() : '';
        break;
      case 'downloaded':
        contentBody.innerHTML = UI.renderDownloadedSongs ? UI.renderDownloadedSongs() : '';
        break;
      case 'playlist':
        contentBody.innerHTML = UI.renderPlaylist(id);
        break;
      case 'album':
        contentBody.innerHTML = UI.renderAlbum(id);
        if (id.startsWith('saavn-album-')) loadSaavnAlbumAsync(id, contentBody);
        break;
      case 'artist':
        contentBody.innerHTML = UI.renderArtist(id);
        // Artist proxy not available, gracefully ignore
        break;
      case 'queue':
        contentBody.innerHTML = UI.renderQueue();
        break;
      case 'ai-playlist':
        // Do not re-render the view, just open the modal.
        currentView = 'home';
        contentBody.innerHTML = UI.renderHome();
        const aiModal = document.getElementById('ai-playlist-modal');
        if (aiModal) aiModal.classList.remove('hidden');
        break;
      default:
        contentBody.innerHTML = UI.renderHome();
    }
  };

  // ── Async loaders for Saavn content ────────────────────────
  const loadTrendingAsync = async () => {
    try {
      const trendingTracks = await MusicData.getTrendingTracks();
      if (trendingTracks.length > 0) {
        const trContainer = document.querySelector('.trending-grid');
        if (trContainer) {
          trContainer.innerHTML = `<div class="content-loaded" style="display:contents">${trendingTracks.slice(0, 6).map(t => UI.createCard(t, 'track')).join('')}</div>`;
        }
      }
    } catch (err) {
      console.warn('Failed to load trending:', err);
    }
  };

  const loadSaavnAlbumAsync = async (albumId, container) => {
    try {
      // Show album skeleton loading while fetching
      container.innerHTML = UI.renderAlbumSkeleton();
      
      const album = await MusicData.getSaavnAlbum(albumId);
      if (album) {
        // Wrap content in content-loaded class for fade-in animation
        const albumHtml = UI.renderAlbum(album.id);
        container.innerHTML = `<div class="content-loaded">${albumHtml}</div>`;
        const trackList = container.querySelector('.track-list');
        if (trackList) {
           trackList.innerHTML = album.tracks.map((t, i) => UI.createTrackRow(t, i, { showAlbum: false })).join('');
        }
      }
    } catch (err) {
      console.warn('[App] Failed to load Saavn album:', err);
      container.innerHTML = `<div class="empty-state"><p>Failed to load album</p><p class="empty-hint">Please try again later</p></div>`;
    }
  };

  // ── Get tracks for a collection (for play-collection) ───────
  const getCollectionTracks = async (type, id) => {
    if (type === 'liked') return MusicData.getLikedSongs();
    if (type === 'downloaded') return MusicData.getDownloadedSongs();
    if (type === 'playlist') {
      const pl = MusicData.getPlaylistById(id);
      return pl ? pl.tracks : [];
    }
    if (type === 'album') {
      let al = MusicData.getAlbumById(id);
      if (!al && id.startsWith('saavn-album-')) {
        al = await MusicData.getSaavnAlbum(id);
      }
      return al ? al.tracks : [];
    }
    return [];
  };

  const resolveTrack = (id, el = null) => {
    let t = MusicData.getTrackById(id) || MusicData.getAllTracks().find(t => t.id === id);
    if (!t && el) {
      const dataEl = el.closest('[data-track], [data-item]');
      if (dataEl) {
        const trackData = dataEl.dataset.track || dataEl.dataset.item;
        if (trackData) {
          try {
            t = JSON.parse(trackData);
          } catch(e) {
            console.error('Failed to parse track data', e);
          }
        }
      }
    }
    return t;
  };

  // ── Collect tracks visible in current track-list ────────────
  const collectVisibleTracks = (clickedRow) => {
    const trackList = clickedRow.closest('.track-list');
    if (!trackList) return [];
    const rows = trackList.querySelectorAll('.track-row[data-track-id]');
    const tracksList = [];
    rows.forEach(r => {
      const t = resolveTrack(r.dataset.trackId, r);
      if (t) tracksList.push(t);
    });
    return tracksList;
  };

  // ── Event delegation: content body clicks ───────────────────
  const handleContentClick = async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    // Track recently searched item if clicked from search results
    if (currentView === 'search' && window.MusicData && MusicData.addRecentlySearched) {
      const itemStr = target.dataset.item || target.dataset.track;
      if (itemStr) {
        try { 
          const parsed = JSON.parse(itemStr);
          parsed.type = parsed.type || (target.dataset.trackId ? 'track' : 'album');
          MusicData.addRecentlySearched(parsed); 
        } catch(e) {}
      }
    }

    switch (action) {
      case 'navigate': {
        const view = target.dataset.view;
        const id = target.dataset.id || '';
        e.preventDefault();
        e.stopPropagation();
        navigate(view, id);
        break;
      }

      case 'create-playlist': {
        const modal = document.getElementById('create-playlist-modal');
        const input = document.getElementById('create-playlist-input');
        if (modal && input) {
          input.value = '';
          modal.classList.remove('hidden');
          input.focus();
        }
        break;
      }

      case 'download-track': {
        const trackId = target.dataset.trackId;
        const track = resolveTrack(trackId, target);
        if (track) {
          const added = MusicData.toggleDownloaded(track);
          if (window.UI) {
            UI.showToast(added ? "Added to Downloaded Music" : "Removed from Downloaded Music");
          }
        }
        break;
      }

      case 'play-track': {
        const trackId = target.dataset.trackId;
        const track = resolveTrack(trackId, target);
        if (!track) break;

        const visibleTracks = collectVisibleTracks(target);
        if (visibleTracks.length > 0) {
          const idx = visibleTracks.findIndex(t => t.id === trackId);
          Player.setQueue(visibleTracks, idx >= 0 ? idx : 0);
        } else {
          const allTracks = MusicData.getAllTracks();
          const idx = allTracks.findIndex(t => t.id === trackId);
          if (idx >= 0) {
            Player.setQueue(allTracks, idx);
          } else {
            Player.setQueue([track], 0);
          }
        }
        break;
      }

      case 'toggle-playlist-menu': {
        const dropdown = target.nextElementSibling;
        if (dropdown && dropdown.classList.contains('playlist-more-dropdown')) {
          const isVisible = dropdown.style.display === 'block';
          dropdown.style.display = isVisible ? 'none' : 'block';
        }
        break;
      }

      case 'rename-playlist': {
        const id = target.dataset.id;
        const playlist = window.MusicData && MusicData.getPlaylistById(id);
        if (playlist) {
          const modal = document.getElementById('rename-playlist-modal');
          const input = document.getElementById('rename-playlist-input');
          const submitBtn = document.getElementById('rename-playlist-submit');
          if (modal && input && submitBtn) {
            input.value = playlist.name;
            submitBtn.dataset.playlistId = id;
            modal.classList.remove('hidden');
            input.focus();
          }
        }
        const dropdown = document.getElementById('playlist-more-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        break;
      }

      case 'delete-playlist': {
        const id = target.dataset.id;
        const modal = document.getElementById('delete-playlist-modal');
        const submitBtn = document.getElementById('delete-playlist-submit');
        if (modal && submitBtn) {
          submitBtn.dataset.playlistId = id;
          modal.classList.remove('hidden');
        }
        const dropdown = document.getElementById('playlist-more-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        break;
      }

      case 'play-collection': {
        const type = target.dataset.type;
        const id = target.dataset.id;
        const btnIcon = target.querySelector('svg');
        const oldIcon = btnIcon ? btnIcon.innerHTML : '';
        if (btnIcon) btnIcon.innerHTML = '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31 31" stroke-dashoffset="0"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle>';
        const tracks = await getCollectionTracks(type, id);
        if (tracks.length) Player.setQueue(tracks, 0);
        if (btnIcon) btnIcon.innerHTML = oldIcon;
        break;
      }

      case 'shuffle-collection': {
        const type = target.dataset.type;
        const id = target.dataset.id;
        const btnIcon = target.querySelector('svg');
        const oldIcon = btnIcon ? btnIcon.innerHTML : '';
        if (btnIcon) btnIcon.innerHTML = '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31 31" stroke-dashoffset="0"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle>';
        const tracks = await getCollectionTracks(type, id);
        if (tracks.length) {
          Player.setQueue(tracks, 0);
          if (!Player.isShuffle) Player.toggleShuffle();
        }
        if (btnIcon) btnIcon.innerHTML = oldIcon;
        break;
      }

      case 'play-artist': {
        const artistId = target.dataset.id;
        const artistTracks = MusicData.getTracksByArtistId(artistId);
        if (artistTracks.length) Player.setQueue(artistTracks, 0);
        break;
      }

      case 'play-album': {
        const albumId = target.dataset.id;
        let album = MusicData.getAlbumById(albumId);
        if (!album && albumId.startsWith('saavn-album-')) {
          album = await MusicData.getSaavnAlbum(albumId);
        }
        if (album && album.tracks && album.tracks.length > 0) {
          Player.setQueue(album.tracks, 0);
        } else if (window.UI) {
          UI.showToast("No playable tracks found in this album.");
        }
        break;
      }

      case 'play-playlist': {
        const playlistId = target.dataset.id;
        const playlist = MusicData.getPlaylistById(playlistId);
        if (playlist && playlist.tracks && playlist.tracks.length > 0) {
          Player.setQueue(playlist.tracks, 0);
        } else if (window.UI) {
          UI.showToast("No playable tracks found in this playlist.");
        }
        break;
      }

      case 'browse-genre': {
        const genre = target.dataset.genre;
        navigate('search', '', { query: genre });
        break;
      }

      case 'track-menu': {
        const trackId = target.dataset.trackId;
        const row = target.closest('.track-row');
        const track = resolveTrack(trackId, row);
        if (track) UI.showContextMenu(e, track);
        break;
      }

      case 'import-files': {
        const input = target.tagName === 'INPUT' ? target : target.querySelector('input[type="file"]');
        if (input && input.files && input.files.length) {
          LocalFiles.handleFiles(input.files);
        }
        break;
      }
    }
  };

  // ── Source tab switching globally ────────────────────────────
  window.activeSourceTab = 'all';

  window.applySourceFilter = (source) => {
    // Update all tabs visually
    document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll(`.source-tab[data-source="${source}"]`).forEach(t => t.classList.add('active'));

    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;
    
    // Only apply in library view sections
    const sections = contentBody.querySelectorAll('.section[data-source-section]');
    sections.forEach(sec => {
      if (source === 'all') {
        sec.style.display = 'block';
      } else {
        sec.style.display = sec.dataset.sourceSection === source ? 'block' : 'none';
      }
    });

    // Special case for local files empty state:
    const emptyState = contentBody.querySelector('.empty-state-local');
    if (emptyState) {
      const hasLocalFiles = LocalFiles.getTracks().length > 0;
      if (source === 'local' && !hasLocalFiles) {
        emptyState.style.display = 'flex';
        contentBody.querySelectorAll('.section[data-source-section="local"]').forEach(s => s.style.display = 'none');
      } else {
        emptyState.style.display = 'none';
      }
    }
  };

  const handleSourceTab = (e) => {
    const tab = e.target.closest('.source-tab');
    if (!tab) return;
    
    const source = tab.dataset.source;
    window.activeSourceTab = source;
    
    // Check if we are outside the library view, navigate to library
    const isLibrary = window.location.hash === '#library' || window.location.hash === '';
    if (!isLibrary) {
      window.location.hash = '#library';
      return; // hashchange will re-render and apply the filter
    }

    window.applySourceFilter(source);
  };

  // ── Player bar controls ─────────────────────────────────────
  const setupPlayerControls = () => {
    // Main play/pause
    document.addEventListener('click', (e) => {
      const mainBtn = e.target.closest('.player-btn-main');
      if (mainBtn) { Player.togglePlay(); return; }

      const playerBtn = e.target.closest('.player-btn[data-action]');
      if (playerBtn) {
        const action = playerBtn.dataset.action;
        if (action === 'next') Player.next();
        else if (action === 'prev') Player.previous();
        else if (action === 'shuffle') {
          Player.toggleShuffle();
          playerBtn.classList.toggle('active', Player.isShuffle);
        }
        else if (action === 'repeat') {
          Player.cycleRepeat();
          playerBtn.classList.remove('repeat-one', 'repeat-all');
          if (Player.repeatMode === 'one') playerBtn.classList.add('active', 'repeat-one');
          else if (Player.repeatMode === 'all') playerBtn.classList.add('active', 'repeat-all');
          else playerBtn.classList.remove('active');
        }
        else if (action === 'fullscreen') {
          setFullscreenOpen(true);
        }
        else if (action === 'mute') {
          Player.toggleMute();
        }
        else if (action === 'queue') {
          setFullscreenOpen(false);
          navigate('queue');
        }
        else if (action === 'like') {
          if (!Player.currentTrack) return;
          const isNowLiked = MusicData.toggleLiked(Player.currentTrack);
          playerBtn.classList.toggle('active', isNowLiked);
          if (window.UI) window.UI.showToast(isNowLiked ? 'Added to Liked Songs' : 'Removed from Liked Songs');
        }
        return;
      }

      // Language toggle
      const langBtn = e.target.closest('.lang-btn');
      if (langBtn) {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        langBtn.classList.add('active');
        const lang = langBtn.id === 'lang-hin' ? 'hin' : 'eng';
        if (window.UI && window.UI.setLyricsLanguage) {
          UI.setLyricsLanguage(lang);
        }
      }

      // Player bar click on mobile → open fullscreen player
      if (window.innerWidth <= 768) {
        const isClickableBtn = e.target.closest('.player-btn') || e.target.closest('.player-btn-main') || e.target.closest('.player-mini-progress') || e.target.closest('.progress-bar');
        if (!isClickableBtn && e.target.closest('.player-bar')) {
          setFullscreenOpen(true);
          return;
        }
      }

      // Close fullscreen player
      const fsClose = e.target.closest('.fs-close-btn');
      if (fsClose) {
        setFullscreenOpen(false);
        return;
      }
    });

    // Progress bar click/drag
    const progressBars = document.querySelectorAll('.progress-bar');
    progressBars.forEach(progressBar => {
      const seekFromEvent = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const clientX = e.clientX;
        const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        Player.seek(pct);
      };

      progressBar.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        progressBar.setPointerCapture(e.pointerId);
        progressBar.dataset.dragging = 'true';
        seekFromEvent(e);
      });
      progressBar.addEventListener('pointermove', (e) => {
        if (progressBar.dataset.dragging === 'true') seekFromEvent(e);
      });
      progressBar.addEventListener('pointerup', (e) => {
        progressBar.dataset.dragging = 'false';
        if (progressBar.hasPointerCapture(e.pointerId)) progressBar.releasePointerCapture(e.pointerId);
      });
      progressBar.addEventListener('pointercancel', () => {
        progressBar.dataset.dragging = 'false';
      });
    });

    // Volume bar click/drag
    const volumeBars = document.querySelectorAll('.volume-bar');
    volumeBars.forEach(volumeBar => {
      const setVolFromEvent = (e) => {
        const rect = volumeBar.getBoundingClientRect();
        const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        Player.setVolume(vol);
        UI.updateVolumeUI(vol);
      };

      volumeBar.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        volumeBar.setPointerCapture(e.pointerId);
        volumeBar.dataset.dragging = 'true';
        setVolFromEvent(e);
      });
      volumeBar.addEventListener('pointermove', (e) => {
        if (volumeBar.dataset.dragging === 'true') setVolFromEvent(e);
      });
      volumeBar.addEventListener('pointerup', (e) => {
        volumeBar.dataset.dragging = 'false';
        if (volumeBar.hasPointerCapture(e.pointerId)) volumeBar.releasePointerCapture(e.pointerId);
      });
      volumeBar.addEventListener('pointercancel', () => {
        volumeBar.dataset.dragging = 'false';
      });
    });

    // Removed wheel event hijacker to allow native vertical scrolling down the page
  };

  // ── Player event listeners ──────────────────────────────────
  const setupPlayerEvents = () => {
    document.addEventListener('player:trackchange', (e) => {
      UI.updatePlayerUI(e.detail.track);
    });

    document.addEventListener('player:timeupdate', (e) => {
      UI.updateProgress(e.detail.current, e.detail.total);
    });

    document.addEventListener('player:play', (e) => {
      UI.updatePlayPauseBtn();
      
      // Track recently played
      if (e.detail && e.detail.track && window.MusicData && MusicData.addRecentlyPlayed) {
        try { MusicData.addRecentlyPlayed(e.detail.track); } catch(err) {}
      }
    });

    document.addEventListener('player:pause', () => {
      UI.updatePlayPauseBtn();
    });

    document.addEventListener('player:volumechange', (e) => {
      UI.updateVolumeUI(e.detail.volume);
    });

    document.addEventListener('player:queuechange', () => {
      // Re-render queue view if currently on it
      if (currentView === 'queue') {
        const contentBody = document.querySelector('.content-body');
        if (contentBody) contentBody.innerHTML = UI.renderQueue();
      }
    });
  };

  // ── Search ──────────────────────────────────────────────────
  const setupSearch = () => {
    const searchInput = document.querySelector('.search-input');
    const searchDropdown = document.getElementById('search-dropdown');
    const voiceBtn = document.getElementById('voice-search-btn');
    const searchClear = document.querySelector('.search-clear-btn');
    if (!searchInput) return;

    // Set initial state of search clear button
    if (searchClear) {
      searchClear.style.display = searchInput.value.trim() ? 'flex' : 'none';
    }

    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      const q = searchInput.value.trim();
      
      if (searchClear) {
        searchClear.style.display = q ? 'flex' : 'none';
      }
      
      // Immediately show loading skeleton in dropdown
      if (q && searchDropdown) {
        searchDropdown.innerHTML = `<div class="search-dropdown-loading">${UI.renderSearchDropdownLoading()}</div>`;
        searchDropdown.classList.add('active');
      }
      
      searchDebounceTimer = setTimeout(async () => {
        if (q && searchDropdown) {
          const results = await MusicData.searchSaavn(q);
          searchDropdown.innerHTML = UI.renderSearchDropdown(results);
          searchDropdown.classList.add('active');
        } else if (searchDropdown) {
          searchDropdown.classList.remove('active');
          searchDropdown.innerHTML = '';
        }
      }, DEBOUNCE_MS);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (searchDropdown) searchDropdown.classList.remove('active');
        if (q) navigate('search', '', { query: q });
        else navigate('search');
        searchInput.blur();
      }
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim() && searchDropdown) {
        searchDropdown.classList.add('active');
      }
    });

    let currentZoom = 100;
    const updateZoom = (delta) => {
      currentZoom += delta;
      if (currentZoom < 25) currentZoom = 25;
      if (currentZoom > 500) currentZoom = 500;
      document.body.style.zoom = `${currentZoom}%`;
      const text = document.getElementById('zoom-level-text');
      if (text) text.textContent = `${currentZoom}%`;
    };

    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.more-menu-action');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'zoom-in') updateZoom(10);
        if (action === 'zoom-out') updateZoom(-10);
        if (action === 'native-fullscreen') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.warn(err.message));
          } else {
            document.exitFullscreen();
          }
        }
        // don't close menu if just zooming
        if (action.startsWith('zoom')) return;
      }

      if (!e.target.closest('.search-container') && searchDropdown) {
        searchDropdown.classList.remove('active');
      }
      
      // Header More Menu
      const moreBtn = e.target.closest('#header-more-btn');
      const moreMenu = document.getElementById('header-dropdown');
      if (moreMenu) {
        if (moreBtn) {
          moreMenu.style.display = (moreMenu.style.display === 'none' || moreMenu.style.display === '') ? 'block' : 'none';
        } else if (!e.target.closest('#header-more-menu') && !actionBtn) {
          moreMenu.style.display = 'none';
        }
      }
    });

    if (searchDropdown) {
      searchDropdown.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        
        // Track recently searched item
        const itemStr = target.dataset.item;
        if (itemStr && window.MusicData && MusicData.addRecentlySearched) {
          try { MusicData.addRecentlySearched(JSON.parse(itemStr)); } catch(e) {}
        }
        
        if (action === 'navigate') {
          const view = target.dataset.view;
          const id = target.dataset.id || '';
          searchDropdown.classList.remove('active');
          searchInput.value = '';
          navigate(view, id);
        } else if (action === 'play-track') {
          const trackId = target.dataset.trackId;
          const track = resolveTrack(trackId, target);
          if (track) {
            Player.setQueue([track], 0);
          }
          searchDropdown.classList.remove('active');
        } else if (action === 'play-track-data') {
          const trackDataStr = target.dataset.track;
          if (trackDataStr) {
             const trackData = JSON.parse(trackDataStr);
             Player.setQueue([trackData], 0);
          }
          searchDropdown.classList.remove('active');
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none'; // Hide when cleared
        if (searchDropdown) {
          searchDropdown.classList.remove('active');
          searchDropdown.innerHTML = '';
        }
        if (currentView === 'search') navigate('search');
        searchInput.focus();
      });
    }

    if (voiceBtn) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        voiceBtn.style.display = 'none';
      } else {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          voiceBtn.classList.add('listening');
          searchInput.placeholder = "Listening...";
        };

        recognition.onresult = async (event) => {
          const transcript = event.results[0][0].transcript;
          const apiKey = (localStorage.getItem('groq_api_key') || '').trim();

          if (!window.AIService) {
            window.UI.showToast('AI service is not available.');
            return;
          } else {
            searchInput.placeholder = "AI is thinking...";
            try {
              const intent = await window.AIService.parseVoiceIntent(transcript, apiKey);
              if (intent.type === 'search') {
                searchInput.value = intent.query;
                searchInput.dispatchEvent(new Event('input'));
              } else if (intent.type === 'playlist') {
                const aiTrigger = document.querySelector('.js-ai-playlist-trigger');
                if (aiTrigger) aiTrigger.click();
                const aiInput = document.getElementById('ai-playlist-input');
                if (aiInput) aiInput.value = intent.query;
              }
            } catch (err) {
              console.error("AI Error:", err);
              searchInput.value = transcript;
              searchInput.dispatchEvent(new Event('input'));
            }
            voiceBtn.classList.remove('listening');
            searchInput.placeholder = "What do you want to listen to?";
          }
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          searchInput.placeholder = "What do you want to listen to?";
          voiceBtn.classList.remove('listening');
        };

        recognition.onend = () => {
          voiceBtn.classList.remove('listening');
          searchInput.placeholder = "What do you want to listen to?";
        };

        voiceBtn.addEventListener('click', () => {
          try {
            recognition.start();
          } catch (e) {
             // already started
          }
        });
      }
    }
  };

  // ── Sidebar nav ─────────────────────────────────────────────
  const setupNav = () => {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.view);
      });
    });

    // Mobile bottom nav
    document.querySelectorAll('.mobile-nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.view);
      });
    });

    // Create playlist action
    // Create playlist action via sidebar is now handled directly by clicking the link which triggers the global listener since we can just assign data-action="create-playlist" to it.
    const createPlBtn = document.getElementById('nav-create-playlist');
    if (createPlBtn) {
      createPlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('create-playlist-modal');
        const input = document.getElementById('create-playlist-input');
        if (modal && input) {
          input.value = '';
          modal.classList.remove('hidden');
          input.focus();
        }
      });
    }

    // Header navigation (removed nav arrows)
    
    // Sidebar toggle and Auto Adjust Mechanism
    const autoAdjustLayout = () => {
      // Force window resize event to let any dynamic scrollbars or elements auto-adjust
      window.dispatchEvent(new Event('resize'));
      
      // Auto adjust the main content scrolling bar to prevent clipping or glitches
      const mainContent = document.querySelector('.main-content');
      const contentBody = document.querySelector('.content-body');
      if (mainContent && contentBody) {
        // Force reflow
        void mainContent.offsetHeight;
        void contentBody.offsetHeight;
      }
    };

    const toggleSidebar = () => {
      document.getElementById('app').classList.toggle('sidebar-hidden');
      
      // Trigger auto adjust immediately for instant responsiveness
      autoAdjustLayout();
      
      // Trigger again continuously during the CSS transition to ensure scrolling bar stays glued
      let start = performance.now();
      const step = (timestamp) => {
        if (timestamp - start < 400) { // 400ms covers the duration-slow transition
          autoAdjustLayout();
          requestAnimationFrame(step);
        } else {
          autoAdjustLayout(); // Final precise adjustment
        }
      };
      requestAnimationFrame(step);
    };

    const sidebarToggleBtn = document.getElementById('sidebar-menu-toggle-btn');
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
    
    const headerToggleBtn = document.getElementById('header-menu-toggle-btn');
    if (headerToggleBtn) headerToggleBtn.addEventListener('click', toggleSidebar);

    const navBackBtn = document.getElementById('nav-back-btn');
    if (navBackBtn) {
      navBackBtn.addEventListener('click', () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.hash = '#home';
        }
      });
    }
  };

  // ── Keyboard shortcuts ──────────────────────────────────────
  const setupKeyboard = () => {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          Player.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) Player.seekBy(15);
          else if (e.ctrlKey || e.metaKey) Player.next();
          else Player.seekBy(10);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) Player.seekBy(-15);
          else if (e.ctrlKey || e.metaKey) Player.previous();
          else Player.seekBy(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          Player.setVolume(Player.volume + 0.05);
          UI.updateVolumeUI(Player.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          Player.setVolume(Player.volume - 0.05);
          UI.updateVolumeUI(Player.volume);
          break;
        case 'm':
        case 'M':
          Player.toggleMute();
          break;
        case 's':
        case 'S':
          Player.toggleShuffle();
          break;
        case 'r':
        case 'R':
          Player.cycleRepeat();
          break;
        case 'q':
        case 'Q':
          navigate('queue');
          break;
        case 'Escape':
          setFullscreenOpen(false);
          break;
      }
    });
  };

  // ── File input change handler ───────────────────────────────
  const setupFileInput = () => {
    document.addEventListener('click', (e) => {
      // Close playlist dropdown if click outside
      const dropdowns = document.querySelectorAll('.playlist-more-dropdown');
      dropdowns.forEach(d => {
        if (d.style.display === 'block' && !e.target.closest('.playlist-more-menu-container')) {
          d.style.display = 'none';
        }
      });
    });
    
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-action="import-files"]')) {
        if (e.target.files.length) {
          LocalFiles.handleFiles(e.target.files);
        }
      }
    });
  };

  // ── Context menu on right-click ─────────────────────────────
  const setupContextMenu = () => {
    document.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.track-row[data-track-id]');
      if (row) {
        const track = resolveTrack(row.dataset.trackId);
        if (track) UI.showContextMenu(e, track);
      }
    });
  };

  // ── Local files updated ─────────────────────────────────────
  const setupLocalFilesListener = () => {
    document.addEventListener('localfiles:updated', () => {
      if (currentView === 'library') {
        const contentBody = document.querySelector('.content-body');
        if (contentBody) {
          contentBody.innerHTML = UI.renderLibrary();
          const localTab = contentBody.querySelector('.source-tab[data-source="local"]');
          if (localTab) {
            localTab.click();
          }
        }
      }
    });
  };

  // ── Modals ──────────────────────────────────────────────────
  const setupModals = () => {
    const modal = document.getElementById('create-playlist-modal');
    const closeBtn = document.getElementById('create-playlist-close');
    const cancelBtn = document.getElementById('create-playlist-cancel');
    const submitBtn = document.getElementById('create-playlist-submit');
    const input = document.getElementById('create-playlist-input');

    if (modal && submitBtn && input) {
      const closeModal = () => {
        modal.classList.add('hidden');
        input.value = '';
      };

      const submitPlaylist = () => {
        const name = input.value.trim();
        if (name) {
          const p = MusicData.createPlaylist(name);
          if (window.UI) window.UI.showToast("Playlist created!");
          closeModal();
          navigate('playlist', p.id);
        }
      };

      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      submitBtn.addEventListener('click', submitPlaylist);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitPlaylist();
        if (e.key === 'Escape') closeModal();
      });
    }

    // --- Settings Modal ---
    const settingsBtn = document.getElementById('header-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsSave = document.getElementById('settings-save');
    const apiKeyInput = document.getElementById('groq-api-key-input');
    
    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        apiKeyInput.value = localStorage.getItem('groq_api_key') || '';
        if (window.hasServerGroqKey) {
          apiKeyInput.placeholder = "Configured via Server Environment Variable";
        } else {
          apiKeyInput.placeholder = "Paste your API key here...";
        }
        settingsModal.classList.remove('hidden');
        document.getElementById('header-dropdown').style.display = 'none';
      });
      
      const closeSettings = () => settingsModal.classList.add('hidden');
      if (settingsClose) settingsClose.addEventListener('click', closeSettings);
      settingsModal.addEventListener('click', (e) => { if(e.target===settingsModal) closeSettings(); });
      
      settingsSave.addEventListener('click', () => {
        localStorage.setItem('groq_api_key', apiKeyInput.value.trim());
        if (window.UI) window.UI.showToast("Settings saved!");
        closeSettings();
      });
    }

    // --- AI Playlist Modal ---
    const aiTriggers = document.querySelectorAll('.js-ai-playlist-trigger');
    const aiModal = document.getElementById('ai-playlist-modal');
    const aiClose = document.getElementById('ai-playlist-close');
    const aiCancel = document.getElementById('ai-playlist-cancel');
    const aiSubmit = document.getElementById('ai-playlist-submit');
    const aiInput = document.getElementById('ai-playlist-input');
    const aiStatus = document.getElementById('ai-playlist-status');

    if (aiTriggers.length && aiModal && aiInput && aiSubmit) {
      const getGroqApiKey = () => (localStorage.getItem('groq_api_key') || '').trim();
      const setAiStatus = (message = '', tone = 'neutral') => {
        if (!aiStatus) return;
        aiStatus.textContent = message;
        aiStatus.style.color = tone === 'error' ? 'var(--color-danger)' : 'var(--color-text-secondary)';
      };
      const setAiBusy = (isBusy) => {
        aiSubmit.disabled = isBusy;
        if (aiCancel) aiCancel.disabled = isBusy;
        aiSubmit.textContent = isBusy ? 'Generating...' : 'Generate';
        if (isBusy) setAiStatus('Finding songs that match your prompt...');
      };
      const openAiModal = (prefill = '') => {
        aiInput.value = prefill;
        setAiBusy(false);
        setAiStatus('');
        aiModal.classList.remove('hidden');
        setTimeout(() => aiInput.focus(), 0);
      };
      const closeAiModal = () => {
        aiModal.classList.add('hidden');
        setAiBusy(false);
        setAiStatus('');
      };

      aiTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          openAiModal();
        });
      });

      if (aiClose) aiClose.addEventListener('click', closeAiModal);
      if (aiCancel) aiCancel.addEventListener('click', closeAiModal);
      aiModal.addEventListener('click', (e) => { if(e.target===aiModal) closeAiModal(); });

      const submitAiPlaylist = async () => {
        const prompt = aiInput.value.trim();
        const apiKey = getGroqApiKey();

        if (!prompt) {
          setAiStatus('Describe a vibe, genre, mood, or theme first.', 'error');
          aiInput.focus();
          return;
        }

        if (!window.AIService || typeof window.AIService.generatePlaylistFromPrompt !== 'function') {
          setAiStatus('AI service is not available. Reload the app and try again.', 'error');
          return;
        }

        setAiBusy(true);

        try {
          const aiResult = await window.AIService.generatePlaylistFromPrompt(prompt, apiKey);
          const songs = Array.isArray(aiResult.songs) ? aiResult.songs.filter(Boolean).slice(0, 10) : [];
          if (!songs.length) {
            throw new Error('The AI response did not include any songs.');
          }

          const newPlaylist = MusicData.createPlaylist(aiResult.title || prompt);
          newPlaylist.description = aiResult.description || '';
          let addedCount = 0;
          
          for (const songQuery of songs) {
            setAiStatus(`Searching: ${songQuery}`);
            const searchRes = await MusicData.searchSaavn(songQuery);
            if (searchRes.tracks && searchRes.tracks.length > 0) {
              MusicData.addTrackToPlaylist(newPlaylist.id, searchRes.tracks[0]);
              addedCount += 1;
            }
          }

          if (!addedCount) {
            MusicData.deletePlaylist(newPlaylist.id);
            throw new Error('No matching tracks were found for that prompt.');
          }

          if (window.UI) window.UI.showToast(`AI playlist generated with ${addedCount} songs!`);
          closeAiModal();
          navigate('playlist', newPlaylist.id);
        } catch (err) {
          console.error(err);
          setAiStatus(err.message || 'Failed to generate playlist. Check your API key and try again.', 'error');
          if (window.UI) window.UI.showToast('Failed to generate playlist.');
        } finally {
          setAiBusy(false);
        }
      };

      aiSubmit.addEventListener('click', submitAiPlaylist);
      aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitAiPlaylist();
      });
    }

    // Rename Modal
    const renameModal = document.getElementById('rename-playlist-modal');
    const renameCloseBtn = document.getElementById('rename-playlist-close');
    const renameCancelBtn = document.getElementById('rename-playlist-cancel');
    const renameSubmitBtn = document.getElementById('rename-playlist-submit');
    const renameInput = document.getElementById('rename-playlist-input');

    if (renameModal && renameSubmitBtn && renameInput) {
      const closeRenameModal = () => {
        renameModal.classList.add('hidden');
        renameInput.value = '';
      };

      const submitRename = () => {
        const id = renameSubmitBtn.dataset.playlistId;
        const newName = renameInput.value.trim();
        if (id && newName) {
          MusicData.renamePlaylist(id, newName);
          if (window.UI) {
             UI.showToast("Playlist renamed successfully!");
             UI.renderSidebarPlaylists();
          }
          navigate('playlist', id);
          if (typeof renderView === 'function') renderView(); // Force UI update
        }
        closeRenameModal();
      };

      if (renameCloseBtn) renameCloseBtn.addEventListener('click', closeRenameModal);
      if (renameCancelBtn) renameCancelBtn.addEventListener('click', closeRenameModal);
      renameModal.addEventListener('click', (e) => {
        if (e.target === renameModal) closeRenameModal();
      });
      renameSubmitBtn.addEventListener('click', submitRename);
      renameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitRename();
        if (e.key === 'Escape') closeRenameModal();
      });
    }

    // Delete Modal
    const deleteModal = document.getElementById('delete-playlist-modal');
    const deleteCloseBtn = document.getElementById('delete-playlist-close');
    const deleteCancelBtn = document.getElementById('delete-playlist-cancel');
    const deleteSubmitBtn = document.getElementById('delete-playlist-submit');

    if (deleteModal && deleteSubmitBtn) {
      const closeDeleteModal = () => {
        deleteModal.classList.add('hidden');
      };

      const submitDelete = () => {
        const id = deleteSubmitBtn.dataset.playlistId;
        if (id) {
          MusicData.deletePlaylist(id);
          if (window.UI) {
             UI.showToast("Playlist deleted successfully!");
             UI.renderSidebarPlaylists();
          }
          navigate('home');
        }
        closeDeleteModal();
      };

      if (deleteCloseBtn) deleteCloseBtn.addEventListener('click', closeDeleteModal);
      if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
      });
      deleteSubmitBtn.addEventListener('click', submitDelete);
    }
  };

  // ── Init ────────────────────────────────────────────────────
  const App = {
    init() {
      console.log('[App] Initialising BeatFlow...');

      // Fetch server configuration
      fetch('/api/config')
        .then(res => res.json())
        .then(config => {
          window.hasServerGroqKey = !!config.hasGroqKey;
        })
        .catch(err => console.warn('Could not fetch server configuration:', err));

      // 1. Init modules
      Player.init();
      LocalFiles.init();
      if (window.Visualizer) Visualizer.init();

      // 2. Set up router
      window.addEventListener('hashchange', renderView);

      // 3. Event delegation on content body
      const contentBody = document.querySelector('.content-body');
      if (contentBody) {
        contentBody.addEventListener('click', handleContentClick);
      }
      
      // Global event delegation for source tabs
      document.addEventListener('click', handleSourceTab);

      // 4. Player bar controls
      setupPlayerControls();

      // 5. Player events
      setupPlayerEvents();

      // 6. Search
      setupSearch();

      // 7. Sidebar & mobile nav
      setupNav();

      // 8. Keyboard shortcuts
      setupKeyboard();

      // 9. File input
      setupFileInput();

      // 10. Context menu
      setupContextMenu();

      // 11. Local files listener
      setupLocalFilesListener();

      // 12. Initial volume UI
      UI.updateVolumeUI(Player.volume);

      // 13. Setup modals
      setupModals();

      // 13. Navigate to initial route
      if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#home';
      }
      renderView();

      // PWA: Service Worker registration
      registerServiceWorker();

      console.log('[App] BeatFlow ready!');
    },

    navigate
  };

  // ── PWA Service Worker Helper ──
  const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
          .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
      });
    }
  };

  // ── Bootstrap ───────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

  window.App = App;
})();


