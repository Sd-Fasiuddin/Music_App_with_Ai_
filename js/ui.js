/* ============================================================
   Pulse Music — ui.js
   UI Renderer & View Management
   ============================================================ */
(function () {
  'use strict';

  // ── Genre color map ─────────────────────────────────────────
  const GENRE_COLORS = {
    'Pop': '#EC4899', 'Rock': '#EF4444', 'Electronic': '#8B5CF6',
    'Jazz': '#F59E0B', 'Hip-Hop': '#10B981', 'Classical': '#6366F1',
    'Ambient': '#06B6D4', 'Lo-fi': '#84CC16', 'R&B': '#F97316',
    'Metal': '#1F2937', 'Folk': '#A3E635', 'Country': '#D97706',
    'Reggae': '#22C55E', 'Soul': '#DB2777', 'Punk': '#DC2626'
  };

  // ── Helpers ─────────────────────────────────────────────────
  const esc = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Content target
  const getContentBody = () => document.querySelector('.content-body');

  // ── Card Components ─────────────────────────────────────────
  const createCard = (item, type = 'album') => {
    item.type = type; // Ensure type is tracked
    const itemStr = esc(JSON.stringify(item));
    if (type === 'track') {
      const id = item.id || '';
      return `
      <div class="card" data-action="play-track" data-track-id="${esc(id)}" data-item='${itemStr}' title="${esc(item.title || item.name)}">
        <div class="card-img-wrap">
          <img class="card-img" src="${esc(item.coverUrl || item.imageUrl)}" alt="${esc(item.title || item.name)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/300/300'">
          <button class="card-play-btn" data-action="play-track" data-track-id="${esc(id)}" aria-label="Play">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        </div>
        <div class="card-info">
          <div class="card-title">${esc(item.title || item.name)}</div>
          <div class="card-subtitle">${esc(item.artist || item.description || (item.genres ? item.genres.join(', ') : ''))}</div>
        </div>
      </div>`;
    }
    
    const view = type === 'playlist' ? 'playlist' : (type === 'artist' ? 'artist' : 'album');
    const id = item.id || '';
    const imgClass = type === 'artist' ? 'card-img card-img-round' : 'card-img';
    return `
      <div class="card" data-action="navigate" data-view="${view}" data-id="${esc(id)}" data-item='${itemStr}' title="${esc(item.title || item.name)}">
        <div class="card-img-wrap">
          <img class="${imgClass}" src="${esc(item.coverUrl || item.imageUrl)}" alt="${esc(item.title || item.name)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/300/300'">
          <button class="card-play-btn" data-action="play-collection" data-type="${view}" data-id="${esc(id)}" aria-label="Play">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        </div>
        <div class="card-info">
          <div class="card-title">${esc(item.title || item.name)}</div>
          <div class="card-subtitle">${esc(item.artist || item.description || (item.genres ? item.genres.join(', ') : ''))}</div>
        </div>
      </div>`;
  };

  const createArtistCard = (artist) => createCard(artist, 'artist');

  const createTrackRow = (track, index, options = {}) => {
    const { showAlbum = true, showCover = true } = options;
    const isPlaying = window.Player && Player.currentTrack && Player.currentTrack.id === track.id;
    const duration = window.MusicData ? MusicData.formatDuration(track.duration) : '0:00';
    return `
      <div class="track-row ${isPlaying ? 'playing' : ''}" data-action="play-track" data-track-id="${esc(track.id)}" data-track='${esc(JSON.stringify(track))}' data-context-menu="track">
        <div class="track-number">
          <span class="track-number-text">${isPlaying ? '<span class="playing-icon">🎶</span>' : (index + 1)}</span>
          <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
        ${showCover ? `<img class="track-row-cover" src="${esc(track.coverUrl)}" alt="" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/40/40'">` : ''}
        <div class="track-info">
          <div class="track-title">${esc(track.title)}</div>
          <div class="track-artist" data-action="navigate" data-view="artist" data-id="${esc(track.artistId)}">${esc(track.artist)}</div>
        </div>
        ${showAlbum ? `<div class="track-album" data-action="navigate" data-view="album" data-id="${esc(track.albumId)}">${esc(track.album || '')}</div>` : ''}
        <div class="track-duration">${duration}</div>
        <button class="track-more" data-action="track-menu" data-track-id="${esc(track.id)}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>
    `;
  };

  // ── Skeleton loader ─────────────────────────────────────────
  const showSkeleton = (container) => {
    if (!container) return;
    const skeletons = Array(6).fill('').map(() =>
      `<div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text-sm"></div>
      </div>`
    ).join('');
    container.innerHTML = `<div class="cards-row">${skeletons}</div>`;
  };

  // ── Spotify-Style Skeleton Renderers ───────────────────────
  const renderAlbumSkeleton = () => {
    const trackRows = Array(6).fill('').map(() => `
      <div class="skeleton-track-row">
        <div class="skeleton-num"></div>
        <div class="skeleton-track-info">
          <div class="skeleton-track-line"></div>
          <div class="skeleton-track-line"></div>
        </div>
        <div class="skeleton-dur"></div>
      </div>
    `).join('');

    return `
      <div class="skeleton-hero">
        <div class="skeleton-cover"></div>
        <div class="skeleton-details">
          <div class="skeleton-type"></div>
          <div class="skeleton-title-block"></div>
          <div class="skeleton-meta"></div>
        </div>
      </div>
      <div class="skeleton-actions">
        <div class="skeleton-btn"></div>
        <div class="skeleton-btn-sm"></div>
      </div>
      <div style="margin-top: 8px">
        ${trackRows}
      </div>
    `;
  };

  const renderSearchDropdownLoading = () => {
    return Array(4).fill('').map(() => `
      <div class="search-dropdown-skeleton-row">
        <div class="skeleton-img"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    `).join('');
  };

  const renderCardsSkeleton = (count = 6) => {
    return `<div class="skeleton-card-grid">
      ${Array(count).fill('').map(() => `
        <div class="skeleton-card-item">
          <div class="skeleton-card-img"></div>
          <div class="skeleton-card-text"></div>
          <div class="skeleton-card-text"></div>
        </div>
      `).join('')}
    </div>`;
  };

  const renderTracksSkeleton = (count = 5) => {
    return Array(count).fill('').map(() => `
      <div class="skeleton-track-row">
        <div class="skeleton-num"></div>
        <div class="skeleton-track-info">
          <div class="skeleton-track-line"></div>
          <div class="skeleton-track-line"></div>
        </div>
        <div class="skeleton-dur"></div>
      </div>
    `).join('');
  };

  // ── View: Home ──────────────────────────────────────────────
  const renderHome = () => {
    const allTracks = MusicData.getAllTracks();
    const playlists = MusicData.getPlaylists();
    const albums = MusicData.getAlbums();
    const artists = MusicData.getArtists();

    // Recently played (simulated — first 6 tracks)
    const recentTracks = allTracks.slice(0, 6);
    // Quick picks — first 6 albums
    const quickAlbums = albums.slice(0, 6);

    return `
      <section class="section">
        <h1 class="section-greeting">${getGreeting()}</h1>
        <div class="quick-picks">
          ${recentTracks.map(t => `
            <div class="quick-pick" data-action="play-track" data-track-id="${esc(t.id)}">
              <img src="${esc(t.coverUrl)}" alt="" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/60/60'">
              <span>${esc(t.title)}</span>
            </div>
          `).join('')}
        </div>
      </section>

      ${window.MusicData && MusicData.getRecentlyPlayed && MusicData.getRecentlyPlayed().length > 0 ? `
      <section class="section">
        <div class="section-header">
          <h2>Recently Played</h2>
        </div>
        <div class="cards-row">
          <div class="cards-row-inner">
            ${MusicData.getRecentlyPlayed().slice(0, 6).map(t => createCard(t, 'track')).join('')}
          </div>
        </div>
      </section>` : ''}

      ${window.MusicData && MusicData.getRecentlySearched && MusicData.getRecentlySearched().length > 0 ? `
      <section class="section">
        <div class="section-header">
          <h2>Recently Searched</h2>
        </div>
        <div class="cards-row">
          <div class="cards-row-inner">
            ${MusicData.getRecentlySearched().slice(0, 6).map(item => createCard(item, item.type || 'track')).join('')}
          </div>
        </div>
      </section>` : ''}

      <section class="section">
        <div class="section-header">
          <h2>Trending on Trending</h2>
          <span class="section-see-all" data-action="navigate" data-view="search" data-id="">Show all</span>
        </div>
        <div class="cards-row" id="trending-row">
          <div class="cards-row-inner trending-grid">
            ${quickAlbums.length > 0 ? quickAlbums.map(a => createCard(a, 'album')).join('') : renderCardsSkeleton(6)}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2>Made For You</h2>
        </div>
        <div class="cards-row">
          <div class="cards-row-inner">
            ${playlists.map(p => createCard(p, 'playlist')).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2>Popular Artists</h2>
        </div>
        <div class="cards-row">
          <div class="cards-row-inner">
            ${artists.slice(0, 8).map(a => createArtistCard(a)).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2>Browse Genres</h2>
        </div>
        <div class="genre-grid">
          ${MusicData.genres.map(g => `
            <div class="genre-card" style="background:${GENRE_COLORS[g] || '#555'}" data-action="browse-genre" data-genre="${esc(g)}">
              <span>${esc(g)}</span>
            </div>
          `).join('')}
        </div>
      </section>`;
  };

  // ── View: Search ────────────────────────────────────────────
  const renderSearch = (query = '') => {
    if (!query) {
      return `
        <section class="section">
          <h2>Browse All</h2>
          <div class="genre-grid">
            ${MusicData.genres.map(g => `
              <div class="genre-card" style="background:${GENRE_COLORS[g] || '#555'}" data-action="browse-genre" data-genre="${esc(g)}">
                <span>${esc(g)}</span>
              </div>
            `).join('')}
          </div>
        </section>`;
    }

    const local = MusicData.searchLocal(query);
    const hasTracks = local.tracks.length > 0;
    const hasAlbums = local.albums.length > 0;
    const hasArtists = local.artists.length > 0;

    return `
      ${(hasTracks || hasAlbums || hasArtists) ? `
        <section class="section search-results" id="search-results">
          ${hasTracks ? `
            <h2>Songs</h2>
            <div class="track-list">
              ${local.tracks.slice(0, 10).map((t, i) => createTrackRow(t, i)).join('')}
            </div>` : ''}
          ${hasAlbums ? `
            <h2>Albums</h2>
            <div class="cards-row"><div class="cards-row-inner">
              ${local.albums.map(a => createCard(a, 'album')).join('')}
            </div></div>` : ''}
          ${hasArtists ? `
            <h2>Artists</h2>
            <div class="cards-row"><div class="cards-row-inner">
              ${local.artists.map(a => createArtistCard(a)).join('')}
            </div></div>` : ''}
        </section>
      ` : ''}
      <section class="section" id="Trending-search-results">
        <h2>Results from Trending</h2>
        <div id="saavn-results-container">
          <div class="saavn-loading-state">
            <div class="spotify-bar-loader">
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
            </div>
            <span class="loading-label">Searching Trending...</span>
          </div>
          ${renderTracksSkeleton(4)}
          <div style="margin-top: 16px">${renderCardsSkeleton(4)}</div>
        </div>
      </section>`;
  };

  // ── View: Library ───────────────────────────────────────────
  const renderLibrary = () => {
    const localTracks = MusicData.getLocalTracks();
    const playlists = MusicData.getPlaylists().filter(p => p.isUserCreated);
    const allPlaylists = MusicData.getPlaylists();

    return `
      <section style="margin-bottom: 24px;">
        <h1 style="margin-bottom: 16px; margin-left: -2px;">Your Library</h1>
        <div class="source-tabs">
          <button class="source-tab active" data-source="all">All</button>
          <button class="source-tab" data-source="local">Local</button>
        </div>
      </section>

      <section class="section" id="library-content">
        <div class="section" data-source-section="playlists">
          <div class="section-header">
            <h2>Playlists</h2>
          </div>
          <div class="cards-row"><div class="cards-row-inner">
            <div class="card" data-action="create-playlist" style="cursor: pointer; background: linear-gradient(135deg, #8B5CF6, #4b134f); display: flex; align-items: center; justify-content: center; height: 100%; min-height: 150px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; color: white;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span style="font-size: 18px; font-weight: 600;">Create Playlist</span>
              </div>
            </div>
            <div class="card" data-action="navigate" data-view="liked" data-id="liked" title="Liked Songs">
              <div class="card-img-wrap" style="background: linear-gradient(135deg, #4b134f 0%, #c94b4b 100%); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" fill="white" style="width: 48px; height: 48px;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <button class="card-play-btn" data-action="play-collection" data-type="liked" data-id="liked" aria-label="Play">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
              </div>
              <div class="card-info">
                <div class="card-title">Liked Songs</div>
                <div class="card-subtitle">${MusicData.getLikedSongs().length} songs</div>
              </div>
            </div>
            <div class="card" data-action="navigate" data-view="downloaded" data-id="downloaded" title="Downloaded Music">
              <div class="card-img-wrap" style="background: linear-gradient(135deg, #FF2A85 0%, #191414 100%); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" fill="white" style="width: 48px; height: 48px;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                <button class="card-play-btn" data-action="play-collection" data-type="downloaded" data-id="downloaded" aria-label="Play">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
              </div>
              <div class="card-info">
                <div class="card-title">Downloaded Music</div>
                <div class="card-subtitle">${MusicData.getDownloadedSongs().length} songs</div>
              </div>
            </div>
            ${allPlaylists.map(p => createCard(p, 'playlist')).join('')}
          </div></div>
        </div>

        <div class="section" data-source-section="local" style="margin-top:2rem">
          <div class="section-header">
            <h2>Local Files (${localTracks.length})</h2>
            <label class="import-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import Files
              <input type="file" accept="audio/*" multiple hidden data-action="import-files">
            </label>
          </div>
          ${localTracks.length > 0 ? `
            <div class="track-list">
              ${localTracks.map((t, i) => createTrackRow(t, i)).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <p>No local files yet</p>
              <p class="empty-hint">import songs from ur device to available songs here</p>
              <label class="btn btn-primary" style="margin-top: 1rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import Files
                <input type="file" accept="audio/*" multiple hidden data-action="import-files">
              </label>
            </div>
          `}
        </div>
      </section>`;
  };

  // ── View: Downloaded Songs ────────────────────────────────────
  const renderDownloadedSongs = () => {
    const downloadedTracks = MusicData.getDownloadedSongs();
    
    return `
      <div class="hero-banner" style="background: linear-gradient(135deg, #FF2A85 0%, #191414 100%)">
        <div style="width:230px; height:230px; background: rgba(0,0,0,0.3); border-radius:16px; display:flex; align-items:center; justify-content:center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <svg viewBox="0 0 24 24" fill="white" style="width: 100px; height: 100px;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </div>
        <div class="hero-info">
          <span class="hero-type">PLAYLIST</span>
          <h1 class="hero-title">Downloaded Music</h1>
          <p class="hero-meta">${downloadedTracks.length} songs</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-play-large" data-action="play-collection" data-type="downloaded" data-id="downloaded" ${downloadedTracks.length === 0 ? 'disabled' : ''}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              Play
            </button>
            <button class="btn btn-outline" data-action="shuffle-collection" data-type="downloaded" data-id="downloaded" ${downloadedTracks.length === 0 ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
              Shuffle
            </button>
          </div>
        </div>
      </div>
      <div class="section">
        ${downloadedTracks.length > 0 ? `
          <div class="track-list">
            <div class="track-list-header">
              <div class="col-idx">#</div>
              <div class="col-title">Title</div>
              <div class="col-album">Album</div>
              <div class="col-duration"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg></div>
            </div>
            ${downloadedTracks.map((t, i) => createTrackRow(t, i)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            <p>No downloaded songs yet</p>
            <p class="empty-hint">Find songs you like and click Download in the menu.</p>
          </div>
        `}
      </div>
    `;
  };

  // ── View: Liked Songs ─────────────────────────────────────────
  const renderLikedSongs = () => {
    const likedTracks = MusicData.getLikedSongs();
    
    return `
      <div class="hero-banner" style="background: linear-gradient(135deg, #4b134f 0%, #c94b4b 100%)">
        <div style="width:230px; height:230px; background: rgba(0,0,0,0.3); border-radius:16px; display:flex; align-items:center; justify-content:center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <svg viewBox="0 0 24 24" fill="white" style="width: 100px; height: 100px;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </div>
        <div class="hero-info">
          <span class="hero-type">PLAYLIST</span>
          <h1 class="hero-title">Liked Songs</h1>
          <p class="hero-description">The songs you've saved.</p>
          <div class="hero-meta">${likedTracks.length} songs</div>
        </div>
      </div>
      <div class="playlist-actions">
        ${likedTracks.length > 0 ? `
          <button class="btn-play-hero" data-action="play-collection" data-type="liked" data-id="liked">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        ` : ''}
      </div>
      <div class="track-list-header">
        <span class="tlh-num">#</span>
        <span class="tlh-title">Title</span>
        <span class="tlh-album">Album</span>
        <span class="tlh-duration">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
      </div>
      <div class="track-list">
        ${likedTracks.length > 0 ? likedTracks.map((t, i) => createTrackRow(t, i, { showCover: true })).join('') : `
          <div class="empty-state">
            <p>Songs you like will appear here</p>
            <p class="empty-hint">Save songs by tapping the heart icon.</p>
          </div>
        `}
      </div>`;
  };

  // ── View: Playlist Detail ───────────────────────────────────
  const renderPlaylist = (playlistId) => {
    const playlist = MusicData.getPlaylistById(playlistId);
    if (!playlist) return `<div class="empty-state"><p>Playlist not found</p></div>`;

    const totalDuration = playlist.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    return `
      <div class="hero-banner" style="background:${playlist.gradient || 'linear-gradient(135deg,#FF2A85,#191414)'}">
        <img class="hero-cover" src="${esc(playlist.coverUrl)}" alt="${esc(playlist.name)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/230/230'">
        <div class="hero-info">
          <span class="hero-type">PLAYLIST</span>
          <h1 class="hero-title">${esc(playlist.name)}</h1>
          <p class="hero-description">${esc(playlist.description)}</p>
          <div class="hero-meta">${playlist.tracks.length} songs · ${MusicData.formatDuration(totalDuration)}</div>
        </div>
      </div>
      <div class="playlist-actions" style="display: flex; align-items: center; gap: 8px;">
        <button class="btn-play-hero" data-action="play-collection" data-type="playlist" data-id="${esc(playlist.id)}">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
        <button class="btn-shuffle-hero" data-action="shuffle-collection" data-type="playlist" data-id="${esc(playlist.id)}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        </button>
        ${playlist.id.startsWith('user-playlist') ? `
        <div class="playlist-more-menu-container" style="position: relative;">
           <button class="btn-more-hero" id="playlist-more-btn" data-action="toggle-playlist-menu" title="More options" style="background: transparent; border: none; color: var(--color-text-secondary); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%;">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
           </button>
           <div class="playlist-more-dropdown" id="playlist-more-dropdown" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid var(--color-border); border-radius: 8px; padding: 4px 0; min-width: 160px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
             <button class="playlist-action-btn" data-action="rename-playlist" data-id="${esc(playlist.id)}" style="width: 100%; text-align: left; padding: 12px 16px; background: none; border: none; color: var(--color-text-primary); cursor: pointer; font-size: 14px;">Rename Playlist</button>
             <button class="playlist-action-btn" data-action="delete-playlist" data-id="${esc(playlist.id)}" style="width: 100%; text-align: left; padding: 12px 16px; background: none; border: none; color: #ff4d4d; cursor: pointer; font-size: 14px;">Delete Playlist</button>
           </div>
        </div>
        ` : ''}
      </div>
      <div class="track-list-header">
        <span class="tlh-num">#</span>
        <span class="tlh-title">Title</span>
        <span class="tlh-album">Album</span>
        <span class="tlh-duration">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
      </div>
      <div class="track-list">
        ${playlist.tracks.map((t, i) => createTrackRow(t, i, { showCover: true })).join('')}
      </div>`;
  };

  // ── View: Album Detail ──────────────────────────────────────
  const renderAlbum = (albumId) => {
    const album = MusicData.getAlbumById(albumId);
    if (!album) return renderAlbumSkeleton();

    const totalDuration = album.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    return `
      <div class="hero-banner" style="background:linear-gradient(135deg, rgba(29,185,84,0.3), #121212)">
        <img class="hero-cover" src="${esc(album.coverUrl)}" alt="${esc(album.title)}" loading="lazy">
        <div class="hero-info">
          <span class="hero-type">ALBUM</span>
          <h1 class="hero-title">${esc(album.title)}</h1>
          <div class="hero-meta">
            <span class="hero-artist" data-action="navigate" data-view="artist" data-id="${esc(album.artistId)}">${esc(album.artist)}</span>
            · ${album.year || ''} · ${album.tracks.length} songs · ${MusicData.formatDuration(totalDuration)}
          </div>
        </div>
      </div>
      <div class="playlist-actions">
        <button class="btn-play-hero" data-action="play-collection" data-type="album" data-id="${esc(album.id)}">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      <div class="track-list-header">
        <span class="tlh-num">#</span>
        <span class="tlh-title">Title</span>
        <span class="tlh-album">Album</span>
        <span class="tlh-duration">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
      </div>
      <div class="track-list">
        ${album.tracks.map((t, i) => createTrackRow(t, i, { showAlbum: false, showCover: false })).join('')}
      </div>`;
  };

  // ── View: Artist Detail ─────────────────────────────────────
  const renderArtist = (artistId) => {
    const artist = MusicData.getArtistById(artistId);
    if (!artist) return `<div class="empty-state"><p>Artist not found</p></div>`;

    const artistTracks = MusicData.getTracksByArtistId(artistId);
    const artistAlbums = MusicData.getAlbumsByArtistId(artistId);

    return `
      <div class="hero-banner hero-artist-banner" style="background:linear-gradient(135deg, rgba(124,58,237,0.4), #121212)">
        <img class="hero-artist-img" src="${esc(artist.imageUrl)}" alt="${esc(artist.name)}" loading="lazy">
        <div class="hero-info">
          <span class="hero-type">ARTIST</span>
          <h1 class="hero-title hero-artist-name">${esc(artist.name)}</h1>
          <p class="hero-description">${esc(artist.bio)}</p>
          <div class="hero-meta">${artist.genres.join(', ')}</div>
        </div>
      </div>
      <div class="playlist-actions">
        <button class="btn-play-hero" data-action="play-artist" data-id="${esc(artist.id)}">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      ${artistTracks.length > 0 ? `
        <section class="section">
          <h2>Popular</h2>
          <div class="track-list">
            ${artistTracks.map((t, i) => createTrackRow(t, i)).join('')}
          </div>
        </section>` : ''}
      ${artistAlbums.length > 0 ? `
        <section class="section">
          <h2>Albums</h2>
          <div class="cards-row"><div class="cards-row-inner">
            ${artistAlbums.map(a => createCard(a, 'album')).join('')}
          </div></div>
        </section>` : ''}`;
  };

  // ── View: Queue ─────────────────────────────────────────────
  const renderQueue = () => {
    const queue = window.Player ? Player.queue : [];
    const currentIdx = window.Player ? Player.queueIndex : -1;
    const current = window.Player ? Player.currentTrack : null;

    return `
      <section class="section">
        <h1>Queue</h1>
        ${current ? `
          <h3 class="queue-section-label">Now Playing</h3>
          <div class="track-list">
            ${createTrackRow(current, 0, { showCover: true })}
          </div>` : ''}
        ${queue.length > 1 ? `
          <h3 class="queue-section-label">Next Up</h3>
          <div class="track-list">
            ${queue.filter((_, i) => i > currentIdx).map((t, i) => createTrackRow(t, currentIdx + 1 + i, { showCover: true })).join('')}
          </div>` : ''}
        ${queue.length === 0 ? `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <p>Your queue is empty</p>
            <p class="empty-hint">Add songs to start your listening session</p>
          </div>` : ''}
      </section>`;
  };

  // ── Toast notifications ─────────────────────────────────────
  const showToast = (message) => {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
      toast.classList.remove('toast-visible');
      toast.addEventListener('transitionend', () => toast.remove());
      // Safety cleanup
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    }, 3000);
  };

  // ── Context menu ────────────────────────────────────────────
  const showContextMenu = (e, track) => {
    // Remove any existing context menu
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    if (!track) return;
    e.preventDefault();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="ctx-item" data-ctx-action="add-to-queue" data-track-id="${esc(track.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add to Queue
      </div>
      <div class="ctx-item" data-ctx-action="go-artist" data-artist-id="${esc(track.artistId)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Go to Artist
      </div>
      <div class="ctx-item" data-ctx-action="go-album" data-album-id="${esc(track.albumId)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
        Go to Album
      </div>
      <div class="ctx-item" data-ctx-action="download-track" data-track-id="${esc(track.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        ${MusicData.isDownloaded(track.id) ? 'Remove Download' : 'Download'}
      </div>`;

    // If there are user playlists, add "Add to Playlist" submenu or just direct items for simplicity.
    const userPlaylists = MusicData.getUserPlaylists();
    if (userPlaylists.length > 0) {
      menu.innerHTML += `
        <div class="ctx-item" style="pointer-events:none; opacity:0.5; font-size:0.8rem; margin-top:8px;">Add to Playlist</div>
        ${userPlaylists.map(p => `
          <div class="ctx-item" data-ctx-action="add-to-playlist" data-playlist-id="${esc(p.id)}" data-track-id="${esc(track.id)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            ${esc(p.name)}
          </div>
        `).join('')}
      `;
    }
    
    // Check if we are inside a custom playlist view to show "Remove"
    const isPlaylistView = window.location.hash.startsWith('#playlist/user-playlist-');
    if (isPlaylistView) {
      const pId = window.location.hash.split('/')[1];
      menu.innerHTML += `
        <div class="ctx-item" style="color: #EF4444" data-ctx-action="remove-from-playlist" data-playlist-id="${esc(pId)}" data-track-id="${esc(track.id)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Remove from Playlist
        </div>
      `;
    }
    
    // Position
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(e.clientY, window.innerHeight - 160)}px`;
    document.body.appendChild(menu);

    // Close on click outside
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu, true);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu, true), 10);

    // Handle ctx clicks
    menu.addEventListener('click', (ev) => {
      const item = ev.target.closest('.ctx-item');
      if (!item) return;
      const action = item.dataset.ctxAction;
      if (action === 'add-to-queue') {
        const t = MusicData.getTrackById(item.dataset.trackId);
        if (t) { Player.addToQueue(t); showToast('Added to queue'); }
      } else if (action === 'go-artist') {
        window.location.hash = `#artist/${item.dataset.artistId}`;
      } else if (action === 'go-album') {
        window.location.hash = `#album/${item.dataset.albumId}`;
      } else if (action === 'download-track') {
        let t = MusicData.getTrackById(item.dataset.trackId);
        if (!t) {
          const row = document.querySelector(`.track-row[data-track-id="${item.dataset.trackId}"]`);
          if (row && row.dataset.track) {
            try { t = JSON.parse(decodeURIComponent(row.dataset.track)); } catch(e) {}
          }
        }
        if (t) {
          const added = MusicData.toggleDownloaded(t);
          if (added && t.audioUrl) {
            // Force external download
            const safeTitle = (t.title || 'track').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeTitle}.mp3`;
            fetch(t.audioUrl)
              .then(res => res.blob())
              .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }).catch(e => {
                const a = document.createElement('a');
                a.href = t.audioUrl;
                a.target = '_blank';
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              });
          }
          showToast(added ? 'Added to Downloaded Music' : 'Removed from Downloaded Music');
          // Re-render if on downloaded view
          if (window.location.hash === '#downloaded') {
            const contentBody = document.querySelector('.content-body');
            if (contentBody) contentBody.innerHTML = renderDownloadedSongs();
          }
        }
      } else if (action === 'add-to-playlist') {
        const t = MusicData.getTrackById(item.dataset.trackId);
        const pId = item.dataset.playlistId;
        if (t && pId) {
          MusicData.addTrackToPlaylist(pId, t);
          showToast('Added to playlist');
        }
      } else if (action === 'remove-from-playlist') {
        const pId = item.dataset.playlistId;
        const tId = item.dataset.trackId;
        if (pId && tId) {
          MusicData.removeTrackFromPlaylist(pId, tId);
          showToast('Removed from playlist');
          // Re-render playlist
          if (window.location.hash === `#playlist/${pId}`) {
            const contentBody = document.querySelector('.content-body');
            if (contentBody) contentBody.innerHTML = renderPlaylist(pId);
          }
        }
      }
      menu.remove();
      document.removeEventListener('click', closeMenu, true);
    });
  };

  // ── Update player bar ───────────────────────────────────────
  const updatePlayerUI = (track) => {
    if (!track) return;
    const art = document.querySelector('.player-album-art');
    const title = document.querySelector('.player-track-title');
    const artist = document.querySelector('.player-track-artist');
    if (art) { art.src = track.coverUrl; art.alt = track.title; }
    if (title) title.textContent = track.title;
    if (artist) artist.textContent = track.artist;

    // Show player bar if hidden
    const bar = document.querySelector('.player-bar');
    if (bar) bar.classList.add('active');

    // Update liked state
    const likeBtns = document.querySelectorAll('.player-btn[data-action="like"]');
    const isLiked = MusicData.isLiked(track.id);
    likeBtns.forEach(btn => btn.classList.toggle('active', isLiked));

    // Update play/pause icon
    updatePlayPauseBtn();
    
    // Load lyrics for the new track
    loadLyrics(track);

    // Update fullscreen player if open
    const fsArt = document.querySelector('.fs-player-art');
    const fsTitle = document.querySelector('.fs-player-title');
    const fsArtist = document.querySelector('.fs-player-artist');
    const fsBg = document.querySelector('.fs-player-bg');
    if (fsArt) fsArt.src = track.coverUrl;
    if (fsTitle) fsTitle.textContent = track.title;
    if (fsArtist) fsArtist.textContent = track.artist;
    if (fsBg) fsBg.style.backgroundImage = `url("${track.coverUrl}")`;
  };

  const updatePlayPauseBtn = () => {
    const btns = document.querySelectorAll('.player-btn-main');
    if (!btns.length) return;
    const isPlaying = window.Player && Player.isPlaying;
    const innerHTML = isPlaying
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    
    btns.forEach(btn => {
      btn.innerHTML = innerHTML;
      btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    });

    const fs = document.querySelector('.fullscreen-player');
    if (fs) {
      if (isPlaying) fs.classList.add('is-playing');
      else fs.classList.remove('is-playing');
    }
  };

  // --- Live Lyrics Logic ---
  let currentLyrics = {
    lines: [], // array of {time, text}
    isSynced: false,
    lastActiveLine: -1
  };

  const parseLyrics = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    const lrcRegex = /^\[(\d{2,}):(\d{2}(?:\.\d{1,4})?)\](.*)/;
    let isSynced = false;
    
    for (let line of lines) {
      const match = line.match(lrcRegex);
      if (match) {
        isSynced = true;
        const m = parseInt(match[1], 10);
        const s = parseFloat(match[2]);
        parsed.push({ time: (m * 60) + s, text: match[3].trim() });
      } else {
        const clean = line.replace(/^\[.*?\]/, '').trim();
        parsed.push({ time: null, text: clean });
      }
    }
    return { isSynced, lines: parsed };
  };

  const loadLyrics = async (track) => {
    currentLyrics.lines = [];
    currentLyrics.isSynced = false;
    currentLyrics.lastActiveLine = -1;
    renderLyrics();
    if (!track || !track.id) return;

    const lyricsText = await MusicData.getSongLyrics(track.id, track);
    if (!lyricsText) {
      currentLyrics.lines = [{ time: null, text: 'Lyrics not available' }];
      renderLyrics();
      return;
    }

    const parsedData = parseLyrics(lyricsText);
    currentLyrics.isSynced = parsedData.isSynced;
    
    const pureText = parsedData.lines.map(l => l.text).join('\n');
    const hasHindi = /[\u0900-\u097F]/.test(pureText);
    
    if (hasHindi) {
      currentLyrics.lines = [{ time: null, text: 'Romanizing to English... Please wait' }];
      renderLyrics();
      
      try {
        const engText = await MusicData.romanizeToEnglish(pureText);
        const engLinesText = engText.split('\n');
        currentLyrics.lines = parsedData.lines.map((l, i) => ({ time: l.time, text: engLinesText[i] || l.text }));
        renderLyrics();
      } catch (err) {
        // Fallback to original (which might be Native Hindi) if Romanization fails
        currentLyrics.lines = parsedData.lines; 
        renderLyrics();
      }
    } else {
      currentLyrics.lines = parsedData.lines;
      renderLyrics();
    }
  };

  window.UI = { setLyricsLanguage: () => {} }; // Dummy object to prevent app.js error since we removed it
  
  const renderLyrics = () => {
    const container = document.getElementById('lyrics-content');
    if (!container) return;
    
    container.innerHTML = currentLyrics.lines.map((lineObj, i) => {
      const txt = lineObj.text.trim() || '&nbsp;';
      return `<div class="lyric-line" data-index="${i}">${txt}</div>`;
    }).join('');
  };

  const updateLyricsScroll = (current, total) => {
    if (!currentLyrics.lines.length || !total) return;
    
    const totalLines = currentLyrics.lines.length;
    let currentLineIdx = 0;

    if (currentLyrics.isSynced) {
      // Find the last lyric line whose time is <= current
      for (let i = 0; i < totalLines; i++) {
        if (currentLyrics.lines[i].time !== null && currentLyrics.lines[i].time <= current) {
          currentLineIdx = i;
        } else if (currentLyrics.lines[i].time > current) {
          break; // Stop once we exceed current time
        }
      }
    } else {
      // Fallback proportional sync
      const introTime = total * 0.10;
      const outroTime = total * 0.05;
      const lyricsTime = total - introTime - outroTime;
      
      if (current > introTime) {
        let pct = (current - introTime) / lyricsTime;
        if (pct > 1) pct = 1;
        currentLineIdx = Math.floor(pct * totalLines);
        if (currentLineIdx >= totalLines) currentLineIdx = totalLines - 1;
      }
    }
    
    if (currentLyrics.lastActiveLine === currentLineIdx) return;
    currentLyrics.lastActiveLine = currentLineIdx;
    
    const linesElements = document.querySelectorAll('.lyric-line');
    if (!linesElements.length) return;
    
    linesElements.forEach(l => l.classList.remove('active'));
    
    const activeEl = linesElements[currentLineIdx];
    if (activeEl) {
      activeEl.classList.add('active');
      
      const scrollBox = document.getElementById('lyrics-scroll-box');
      if (scrollBox) {
        // Calculate precise offset to prevent parent scrolling
        const offset = activeEl.offsetTop - (scrollBox.clientHeight / 2) + (activeEl.clientHeight / 2);
        scrollBox.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  };
  // -------------------------

  const updateProgress = (current, total) => {
    // --- AUTO-SYNC GENERATION LOGIC ---
    if (total > 0 && currentLyrics && !currentLyrics.isSynced && currentLyrics.lines.length > 1) {
      const isActuallyUnsynced = currentLyrics.lines.some(l => l.time === null);
      if (isActuallyUnsynced) {
        const totalChars = currentLyrics.lines.reduce((sum, l) => sum + (l.text ? l.text.length : 0), 0);
        const introTime = total * 0.10;
        const usableTime = total * 0.85;
        let currentTimeAcc = introTime;
        
        currentLyrics.lines = currentLyrics.lines.map(line => {
          const lineTime = currentTimeAcc;
          const charCount = line.text ? line.text.length : 0;
          const lineDur = totalChars > 0 ? (charCount / totalChars) * usableTime : 1;
          currentTimeAcc += lineDur;
          return { time: lineTime, text: line.text };
        });
        currentLyrics.isSynced = true;
      }
    }
    // ----------------------------------
    const fill = document.querySelector('.progress-bar-fill');
    const fills = document.querySelectorAll('.progress-bar-fill, .player-mini-progress-fill');
    const curEl = document.querySelector('.player-time-current');
    const totEl = document.querySelector('.player-time-total');
    const fsCurEl = document.getElementById('fs-time-current');
    const fsTotEl = document.getElementById('fs-time-total');
    const pct = total ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    if (fills.length) {
      fills.forEach(el => { el.style.width = `${pct}%`; });
    }
    if (curEl) curEl.textContent = MusicData.formatDuration(current);
    if (totEl) totEl.textContent = MusicData.formatDuration(total);
    if (fsCurEl) fsCurEl.textContent = MusicData.formatDuration(current);
    if (fsTotEl) fsTotEl.textContent = MusicData.formatDuration(total);
      
    // Update lyrics auto-scroll
    updateLyricsScroll(current, total);
  };

  const updateVolumeUI = (vol) => {
    const fill = document.querySelector('.volume-bar-fill');
    if (fill) fill.style.width = `${vol * 100}%`;
    
    // Toggle volume icons
    const iconHigh = document.querySelector('.icon-volume-high');
    const iconMute = document.querySelector('.icon-volume-mute');
    if (iconHigh && iconMute) {
      if (vol === 0) {
        iconHigh.style.display = 'none';
        iconMute.style.display = 'block';
      } else {
        iconHigh.style.display = 'block';
        iconMute.style.display = 'none';
      }
    }
  };

  const setActiveNav = (viewName) => {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewName);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewName);
    });
  };

  // ── Load Saavn search results (async, injected into DOM) ──
  const loadSaavnSearch = async (query) => {
    const container = document.getElementById('saavn-results-container');
    if (!container) return;

    // Show Spotify-style loading skeleton
    container.innerHTML = `
      <div class="saavn-loading-state">
        <div class="spotify-bar-loader">
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
        </div>
        <span class="loading-label">Searching Trending...</span>
      </div>
      ${renderTracksSkeleton(4)}
      <div style="margin-top: 16px">${renderCardsSkeleton(4)}</div>
    `;

    try {
      const results = await MusicData.searchSaavn(query);
      let html = '';

      if (results.tracks.length) {
        html += `<h3>Songs</h3><div class="track-list content-loaded">${results.tracks.map((t, i) => createTrackRow(t, i)).join('')}</div>`;
      }
      if (results.albums.length) {
        html += `<h3>Albums</h3><div class="cards-row content-loaded"><div class="cards-row-inner">${results.albums.map(a => createCard(a, 'album')).join('')}</div></div>`;
      }
      if (results.artists.length) {
        html += `<h3>Artists</h3><div class="cards-row content-loaded"><div class="cards-row-inner">${results.artists.map(a => createArtistCard(a)).join('')}</div></div>`;
      }

      if (!html) html = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <p>No results found for "<strong>${esc(query)}</strong>"</p>
          <p class="empty-hint">Check your spelling or try different keywords</p>
        </div>
      `;
      container.innerHTML = `<div class="content-loaded">${html}</div>`;
    } catch (err) {
      container.innerHTML = '<p class="empty-hint">Could not reach Trending</p>';
    }
  };

  // ── Render Search Dropdown (Live Search) ──────────────────
  const renderSearchDropdown = (results) => {
    if (!results) return '';
    const hasTracks = results.tracks && results.tracks.length > 0;
    const hasAlbums = results.albums && results.albums.length > 0;
    const hasArtists = results.artists && results.artists.length > 0;

    let html = '';

    if (hasTracks) {
      html += '<div class="search-dropdown-section-title">Songs</div>';
      html += results.tracks.slice(0, 5).map(t => `
        <div class="search-dropdown-item" data-action="play-track" data-track-id="${esc(t.id)}" data-track='${esc(JSON.stringify(t))}'>
          <img class="search-dropdown-img" src="${esc(t.coverUrl)}" alt="" onerror="this.src='https://picsum.photos/seed/fallback/40/40'">
          <div class="search-dropdown-info">
            <span class="search-dropdown-title">${esc(t.title)}</span>
            <span class="search-dropdown-subtitle">${esc(t.artist)}</span>
          </div>
        </div>
      `).join('');
    }

    if (hasAlbums) {
      html += '<div class="search-dropdown-section-title">Albums</div>';
      html += results.albums.slice(0, 3).map(a => `
        <div class="search-dropdown-item" data-action="navigate" data-view="album" data-id="${esc(a.id)}">
          <img class="search-dropdown-img" src="${esc(a.coverUrl)}" alt="" onerror="this.src='https://picsum.photos/seed/fallback/40/40'">
          <div class="search-dropdown-info">
            <span class="search-dropdown-title">${esc(a.title)}</span>
            <span class="search-dropdown-subtitle">Album · ${esc(a.artist)}</span>
          </div>
        </div>
      `).join('');
    }

    if (hasArtists) {
      html += '<div class="search-dropdown-section-title">Artists</div>';
      html += results.artists.slice(0, 3).map(a => `
        <div class="search-dropdown-item" data-action="navigate" data-view="artist" data-id="${esc(a.id)}">
          <img class="search-dropdown-img round" src="${esc(a.imageUrl)}" alt="" onerror="this.src='https://picsum.photos/seed/fallback/40/40'">
          <div class="search-dropdown-info">
            <span class="search-dropdown-title">${esc(a.name)}</span>
            <span class="search-dropdown-subtitle">Artist</span>
          </div>
        </div>
      `).join('');
    }

    if (!html) {
      html = '<div class="search-dropdown-section-title" style="text-transform:none">No results found</div>';
    }

    return html;
  };


  // ── Public API ──────────────────────────────────────────────
  window.UI = {
    renderHome,
    renderSearch,
    renderLibrary,
    renderLikedSongs,
    renderDownloadedSongs,
    renderPlaylist,
    renderAlbum,
    renderArtist,
    renderQueue,
    createCard,
    createArtistCard,
    createTrackRow,
    showToast,
    showContextMenu,
    updatePlayerUI,
    updatePlayPauseBtn,
    updateProgress,
    updateVolumeUI,
    setActiveNav,
    showSkeleton,
    getGreeting,
    loadSaavnSearch,
    renderSearchDropdown,
    renderAlbumSkeleton,
    renderSearchDropdownLoading,
    renderCardsSkeleton,
    renderTracksSkeleton,
    GENRE_COLORS
  };
})();



