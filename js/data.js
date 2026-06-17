/* ============================================================
   Pulse Music — data.js
   Music Catalog & Jamendo API Client
   ============================================================ */
(function () {
  'use strict';

  // ── Jamendo API config ──────────────────────────────────────
  const JAMENDO_BASE = 'https://api.jamendo.com/v3.0/';
  const CLIENT_ID = 'a93add10';

  // ── Helper: format seconds → mm:ss ──────────────────────────
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Recently Played & Searched ────────────────────────────
  const getRecentlyPlayed = () => recentlyPlayed;
  const addRecentlyPlayed = (track) => {
    if (!track || !track.id) return;
    recentlyPlayed = recentlyPlayed.filter(t => t.id !== track.id);
    recentlyPlayed.unshift(track);
    if (recentlyPlayed.length > 20) recentlyPlayed.pop();
    try { localStorage.setItem('pulse_recently_played', JSON.stringify(recentlyPlayed)); } catch(e){}
  };

  const getRecentlySearched = () => recentlySearched;
  const addRecentlySearched = (item) => {
    if (!item || !item.id) return;
    recentlySearched = recentlySearched.filter(i => i.id !== item.id);
    recentlySearched.unshift(item);
    if (recentlySearched.length > 20) recentlySearched.pop();
    try { localStorage.setItem('pulse_recently_searched', JSON.stringify(recentlySearched)); } catch(e){}
  };

  // ── Demo Artists ────────────────────────────────────────────
  const artists = [
    { id: 'artist-1', name: 'Luna Echo', imageUrl: 'https://picsum.photos/seed/lunaecho/300/300', bio: 'Ambient electronic artist crafting dreamy soundscapes.', genres: ['Ambient', 'Electronic'], source: 'local' },
    { id: 'artist-2', name: 'The Velvet Riots', imageUrl: 'https://picsum.photos/seed/velvetriots/300/300', bio: 'Indie rock band with a raw and energetic sound.', genres: ['Rock', 'Indie'], source: 'local' },
    { id: 'artist-3', name: 'DJ Prism', imageUrl: 'https://picsum.photos/seed/djprism/300/300', bio: 'Electronic DJ and producer known for euphoric drops.', genres: ['Electronic', 'House'], source: 'local' },
    { id: 'artist-4', name: 'Miles Monroe', imageUrl: 'https://picsum.photos/seed/milesmonroe/300/300', bio: 'Smooth jazz pianist with a modern flair.', genres: ['Jazz', 'Soul'], source: 'local' },
    { id: 'artist-5', name: 'Sable Grey', imageUrl: 'https://picsum.photos/seed/sablegrey/300/300', bio: 'Pop vocalist blending R&B with electronic textures.', genres: ['Pop', 'R&B'], source: 'local' },
    { id: 'artist-6', name: 'Kodiak Waves', imageUrl: 'https://picsum.photos/seed/kodiakwaves/300/300', bio: 'Lo-fi hip-hop producer creating chill study vibes.', genres: ['Lo-fi', 'Hip-Hop'], source: 'local' },
    { id: 'artist-7', name: 'Aria Strings', imageUrl: 'https://picsum.photos/seed/ariastrings/300/300', bio: 'Classical crossover ensemble bringing orchestral beauty to modern ears.', genres: ['Classical', 'Cinematic'], source: 'local' },
    { id: 'artist-8', name: 'Neon Dusk', imageUrl: 'https://picsum.photos/seed/neondusk/300/300', bio: 'Synthwave artist inspired by 80s retro futurism.', genres: ['Synthwave', 'Electronic'], source: 'local' },
    { id: 'artist-9', name: 'Ember Skye', imageUrl: 'https://picsum.photos/seed/emberskye/300/300', bio: 'Alternative singer-songwriter with hauntingly beautiful vocals.', genres: ['Alternative', 'Folk'], source: 'local' },
    { id: 'artist-10', name: 'Circuit Breaker', imageUrl: 'https://picsum.photos/seed/circuitbreaker/300/300', bio: 'Hard-hitting EDM producer pushing boundaries.', genres: ['EDM', 'Dubstep'], source: 'local' }
  ];

  // ── Demo Tracks (real Jamendo IDs) ──────────────────────────
  const tracks = [
    { id: 't-1884527', title: 'Midnight Drive', artist: 'Luna Echo', artistId: 'artist-1', album: 'Dreamscapes', albumId: 'album-1', duration: 234, coverUrl: 'https://picsum.photos/seed/dreamscapes/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884527/mp32/', source: 'jamendo', genre: 'Ambient' },
    { id: 't-1884528', title: 'Floating Gardens', artist: 'Luna Echo', artistId: 'artist-1', album: 'Dreamscapes', albumId: 'album-1', duration: 198, coverUrl: 'https://picsum.photos/seed/dreamscapes/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884528/mp32/', source: 'jamendo', genre: 'Ambient' },
    { id: 't-1884529', title: 'Neon Rain', artist: 'Luna Echo', artistId: 'artist-1', album: 'Dreamscapes', albumId: 'album-1', duration: 267, coverUrl: 'https://picsum.photos/seed/dreamscapes/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884529/mp32/', source: 'jamendo', genre: 'Electronic' },
    { id: 't-1884530', title: 'Starlight Corridor', artist: 'Luna Echo', artistId: 'artist-1', album: 'Dreamscapes', albumId: 'album-1', duration: 312, coverUrl: 'https://picsum.photos/seed/dreamscapes/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884530/mp32/', source: 'jamendo', genre: 'Ambient' },
    { id: 't-1884531', title: 'Riot Season', artist: 'The Velvet Riots', artistId: 'artist-2', album: 'Breaking Static', albumId: 'album-2', duration: 245, coverUrl: 'https://picsum.photos/seed/breakingstatic/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884531/mp32/', source: 'jamendo', genre: 'Rock' },
    { id: 't-1884532', title: 'Glass Ceiling', artist: 'The Velvet Riots', artistId: 'artist-2', album: 'Breaking Static', albumId: 'album-2', duration: 210, coverUrl: 'https://picsum.photos/seed/breakingstatic/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884532/mp32/', source: 'jamendo', genre: 'Rock' },
    { id: 't-1884533', title: 'Electric Sermon', artist: 'The Velvet Riots', artistId: 'artist-2', album: 'Breaking Static', albumId: 'album-2', duration: 278, coverUrl: 'https://picsum.photos/seed/breakingstatic/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884533/mp32/', source: 'jamendo', genre: 'Rock' },
    { id: 't-1884534', title: 'Euphoria State', artist: 'DJ Prism', artistId: 'artist-3', album: 'Prism Drops', albumId: 'album-3', duration: 340, coverUrl: 'https://picsum.photos/seed/prismdrops/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884534/mp32/', source: 'jamendo', genre: 'Electronic' },
    { id: 't-1884535', title: 'Pulse Wave', artist: 'DJ Prism', artistId: 'artist-3', album: 'Prism Drops', albumId: 'album-3', duration: 295, coverUrl: 'https://picsum.photos/seed/prismdrops/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884535/mp32/', source: 'jamendo', genre: 'House' },
    { id: 't-1884536', title: 'Crystal Rain', artist: 'DJ Prism', artistId: 'artist-3', album: 'Prism Drops', albumId: 'album-3', duration: 318, coverUrl: 'https://picsum.photos/seed/prismdrops/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884536/mp32/', source: 'jamendo', genre: 'Electronic' },
    { id: 't-1884537', title: 'Blue in Green', artist: 'Miles Monroe', artistId: 'artist-4', album: 'Late Night Sessions', albumId: 'album-4', duration: 286, coverUrl: 'https://picsum.photos/seed/latenightsessions/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884537/mp32/', source: 'jamendo', genre: 'Jazz' },
    { id: 't-1884538', title: 'Velvet Keys', artist: 'Miles Monroe', artistId: 'artist-4', album: 'Late Night Sessions', albumId: 'album-4', duration: 253, coverUrl: 'https://picsum.photos/seed/latenightsessions/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884538/mp32/', source: 'jamendo', genre: 'Jazz' },
    { id: 't-1884539', title: 'Afterglow', artist: 'Sable Grey', artistId: 'artist-5', album: 'Luminous', albumId: 'album-5', duration: 225, coverUrl: 'https://picsum.photos/seed/luminous/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884539/mp32/', source: 'jamendo', genre: 'Pop' },
    { id: 't-1884540', title: 'Silk & Honey', artist: 'Sable Grey', artistId: 'artist-5', album: 'Luminous', albumId: 'album-5', duration: 199, coverUrl: 'https://picsum.photos/seed/luminous/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884540/mp32/', source: 'jamendo', genre: 'R&B' },
    { id: 't-1884541', title: 'Golden Hour', artist: 'Sable Grey', artistId: 'artist-5', album: 'Luminous', albumId: 'album-5', duration: 242, coverUrl: 'https://picsum.photos/seed/luminous/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884541/mp32/', source: 'jamendo', genre: 'Pop' },
    { id: 't-1884542', title: 'Rainy Afternoon', artist: 'Kodiak Waves', artistId: 'artist-6', album: 'Study Beats Vol. 1', albumId: 'album-6', duration: 178, coverUrl: 'https://picsum.photos/seed/studybeats/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884542/mp32/', source: 'jamendo', genre: 'Lo-fi' },
    { id: 't-1884543', title: 'Paper Planes', artist: 'Kodiak Waves', artistId: 'artist-6', album: 'Study Beats Vol. 1', albumId: 'album-6', duration: 163, coverUrl: 'https://picsum.photos/seed/studybeats/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884543/mp32/', source: 'jamendo', genre: 'Lo-fi' },
    { id: 't-1884544', title: 'Adagio in Twilight', artist: 'Aria Strings', artistId: 'artist-7', album: 'Orchestral Dreams', albumId: 'album-7', duration: 356, coverUrl: 'https://picsum.photos/seed/orchestraldreams/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884544/mp32/', source: 'jamendo', genre: 'Classical' },
    { id: 't-1884545', title: 'Cyber Sunset', artist: 'Neon Dusk', artistId: 'artist-8', album: 'Retro Future', albumId: 'album-8', duration: 289, coverUrl: 'https://picsum.photos/seed/retrofuture/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884545/mp32/', source: 'jamendo', genre: 'Synthwave' },
    { id: 't-1884546', title: 'Chrome Horizon', artist: 'Neon Dusk', artistId: 'artist-8', album: 'Retro Future', albumId: 'album-8', duration: 304, coverUrl: 'https://picsum.photos/seed/retrofuture/300/300', audioUrl: 'https://mp3d.jamendo.com/download/track/1884546/mp32/', source: 'jamendo', genre: 'Synthwave' }
  ];

  // ── Demo Albums ─────────────────────────────────────────────
  const albums = [
    { id: 'album-1', title: 'Dreamscapes', artist: 'Luna Echo', artistId: 'artist-1', coverUrl: 'https://picsum.photos/seed/dreamscapes/300/300', tracks: tracks.filter(t => t.albumId === 'album-1'), year: 2025, source: 'jamendo' },
    { id: 'album-2', title: 'Breaking Static', artist: 'The Velvet Riots', artistId: 'artist-2', coverUrl: 'https://picsum.photos/seed/breakingstatic/300/300', tracks: tracks.filter(t => t.albumId === 'album-2'), year: 2024, source: 'jamendo' },
    { id: 'album-3', title: 'Prism Drops', artist: 'DJ Prism', artistId: 'artist-3', coverUrl: 'https://picsum.photos/seed/prismdrops/300/300', tracks: tracks.filter(t => t.albumId === 'album-3'), year: 2025, source: 'jamendo' },
    { id: 'album-4', title: 'Late Night Sessions', artist: 'Miles Monroe', artistId: 'artist-4', coverUrl: 'https://picsum.photos/seed/latenightsessions/300/300', tracks: tracks.filter(t => t.albumId === 'album-4'), year: 2024, source: 'jamendo' },
    { id: 'album-5', title: 'Luminous', artist: 'Sable Grey', artistId: 'artist-5', coverUrl: 'https://picsum.photos/seed/luminous/300/300', tracks: tracks.filter(t => t.albumId === 'album-5'), year: 2025, source: 'jamendo' },
    { id: 'album-6', title: 'Study Beats Vol. 1', artist: 'Kodiak Waves', artistId: 'artist-6', coverUrl: 'https://picsum.photos/seed/studybeats/300/300', tracks: tracks.filter(t => t.albumId === 'album-6'), year: 2024, source: 'jamendo' },
    { id: 'album-7', title: 'Orchestral Dreams', artist: 'Aria Strings', artistId: 'artist-7', coverUrl: 'https://picsum.photos/seed/orchestraldreams/300/300', tracks: tracks.filter(t => t.albumId === 'album-7'), year: 2023, source: 'jamendo' },
    { id: 'album-8', title: 'Retro Future', artist: 'Neon Dusk', artistId: 'artist-8', coverUrl: 'https://picsum.photos/seed/retrofuture/300/300', tracks: tracks.filter(t => t.albumId === 'album-8'), year: 2025, source: 'jamendo' }
  ];

  // ── Curated Playlists ───────────────────────────────────────
  const playlists = [
    {
      id: 'playlist-chill', name: 'Chill Vibes', coverUrl: 'https://picsum.photos/seed/chillvibes/300/300',
      description: 'Relax and unwind with these mellow tracks.',
      tracks: [tracks[0], tracks[1], tracks[15], tracks[16], tracks[11]],
      isUserCreated: false, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      id: 'playlist-energy', name: 'High Energy', coverUrl: 'https://picsum.photos/seed/highenergy/300/300',
      description: 'Pump up your workout with these bangers.',
      tracks: [tracks[4], tracks[5], tracks[6], tracks[7], tracks[8]],
      isUserCreated: false, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      id: 'playlist-focus', name: 'Deep Focus', coverUrl: 'https://picsum.photos/seed/deepfocus/300/300',
      description: 'Instrumental music for deep concentration.',
      tracks: [tracks[10], tracks[11], tracks[17], tracks[15], tracks[16]],
      isUserCreated: false, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
      id: 'playlist-night', name: 'Late Night Drive', coverUrl: 'https://picsum.photos/seed/latenightdrive/300/300',
      description: 'Synthwave and chill beats for the midnight road.',
      tracks: [tracks[0], tracks[18], tracks[19], tracks[3], tracks[9]],
      isUserCreated: false, gradient: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)'
    },
    {
      id: 'playlist-discover', name: 'Discover Weekly', coverUrl: 'https://picsum.photos/seed/discoverweekly/300/300',
      description: 'A fresh mix of tracks curated just for you.',
      tracks: [tracks[12], tracks[13], tracks[14], tracks[2], tracks[7], tracks[18]],
      isUserCreated: false, gradient: 'linear-gradient(135deg, #FF2A85 0%, #191414 100%)'
    }
  ];

  // ── Local-tracks storage (augmented at runtime) ─────────────
  let localTracks = [];

  // ── Persistent state for Liked Songs & User Playlists ───────
  let likedSongs = [];
  let downloadedSongs = [];
  let userPlaylists = [];
  let recentlyPlayed = [];
  let recentlySearched = [];

  const init = () => {
    try {
      const lsLiked = localStorage.getItem('pulse_liked_songs');
      if (lsLiked) likedSongs = JSON.parse(lsLiked);

      const lsDownloaded = localStorage.getItem('pulse_downloaded_songs');
      if (lsDownloaded) downloadedSongs = JSON.parse(lsDownloaded);

      const lsPlaylists = localStorage.getItem('pulse_user_playlists');
      if (lsPlaylists) userPlaylists = JSON.parse(lsPlaylists);

      const lsPlayed = localStorage.getItem('pulse_recently_played');
      if (lsPlayed) recentlyPlayed = JSON.parse(lsPlayed);

      const lsSearched = localStorage.getItem('pulse_recently_searched');
      if (lsSearched) recentlySearched = JSON.parse(lsSearched);
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
  };
  init();

  const saveLikedSongs = () => {
    try {
      localStorage.setItem('pulse_liked_songs', JSON.stringify(likedSongs));
    } catch(e) {}
  };

  const saveDownloadedSongs = () => {
    try {
      localStorage.setItem('pulse_downloaded_songs', JSON.stringify(downloadedSongs));
    } catch(e) {}
  };

  const saveUserPlaylists = () => {
    try {
      localStorage.setItem('pulse_user_playlists', JSON.stringify(userPlaylists));
    } catch(e) {}
  };

  // --- Saavn API Integration ---
  const SAAVN_BASE = '/api';

  const mapSaavnTrack = (st) => ({
    id: `saavn-${st.id}`,
    title: st.title ? st.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : 'Unknown Title',
    artist: st.subtitle || st.artists || st.album_artist || 'Unknown Artist',
    artistId: st.artist_id ? `saavn-artist-${st.artist_id}` : '',
    album: st.album || '',
    albumId: st.album_id ? `saavn-album-${st.album_id}` : '',
    duration: Number(st.duration) || 0,
    coverUrl: st.image || 'https://picsum.photos/seed/default/300/300',
    audioUrl: st.url || st.media_url || '',
    source: 'saavn',
    genre: st.language || 'Pop'
  });

  const mapSaavnAlbum = (sa) => {
    const songsArray = sa.songs || sa.list || [];
    const albumId = sa.id || sa.albumid;
    const albumTracks = songsArray.map(mapSaavnTrack);
    return {
      id: `saavn-album-${albumId}`,
      title: sa.title ? sa.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : 'Unknown Album',
      artist: sa.primary_artists || sa.subtitle || 'Unknown Artist',
      artistId: '',
      coverUrl: sa.image || 'https://picsum.photos/seed/default/300/300',
      tracks: albumTracks,
      year: sa.year ? Number(sa.year) : 0,
      source: 'saavn'
    };
  };

  const saavnFetch = async (endpoint) => {
    try {
      const res = await fetch(`${SAAVN_BASE}${endpoint}`);
      if (!res.ok) throw new Error(`Saavn API error: ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[MusicData] Saavn fetch failed:', err);
      return null;
    }
  };

  // ── Public API ──────────────────────────────────────────────
  window.MusicData = {

    /* ---- Local getters ---- */
    getAllTracks: () => [...tracks, ...localTracks],
    getPlaylists: () => [...playlists, ...userPlaylists],
    getUserPlaylists: () => [...userPlaylists],
    getAlbums: () => [...albums],
    getArtists: () => [...artists],

    getTrackById: (id) => [...tracks, ...localTracks].find(t => t.id === id) || null,
    getAlbumById: (id) => albums.find(a => a.id === id) || null,
    getArtistById: (id) => artists.find(a => a.id === id) || null,
    getPlaylistById: (id) => [...playlists, ...userPlaylists].find(p => p.id === id) || null,

    getTracksByArtistId: (artistId) => tracks.filter(t => t.artistId === artistId),
    getAlbumsByArtistId: (artistId) => albums.filter(a => a.artistId === artistId),

    searchLocal: (query) => {
      if (!query) return { tracks: [], albums: [], artists: [] };
      const q = query.toLowerCase();
      return {
        tracks: [...tracks, ...localTracks].filter(t =>
          t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
        ),
        albums: albums.filter(a => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)),
        artists: artists.filter(a => a.name.toLowerCase().includes(q))
      };
    },

    addLocalTrack: (track) => {
      localTracks.push(track);
    },
    getLocalTracks: () => [...localTracks],
    setLocalTracks: (t) => { localTracks = t; },

    /* ---- Liked Songs API ---- */
    getLikedSongs: () => [...likedSongs],
    isLiked: (trackId) => likedSongs.some(t => t.id === trackId),
    toggleLiked: (track) => {
      const idx = likedSongs.findIndex(t => t.id === track.id);
      if (idx >= 0) {
        likedSongs.splice(idx, 1);
      } else {
        likedSongs.unshift(track);
      }
      saveLikedSongs();
      return idx < 0; // returns true if added, false if removed
    },

    /* ---- Downloaded Songs API ---- */
    getDownloadedSongs: () => [...downloadedSongs],
    isDownloaded: (trackId) => downloadedSongs.some(t => t.id === trackId),
    toggleDownloaded: (track) => {
      const idx = downloadedSongs.findIndex(t => t.id === track.id);
      if (idx >= 0) {
        downloadedSongs.splice(idx, 1);
      } else {
        downloadedSongs.unshift(track);
      }
      saveDownloadedSongs();
      return idx < 0;
    },

    /* ---- User Playlists API ---- */
    createPlaylist: (name) => {
      const newPlaylist = {
        id: 'user-playlist-' + Date.now(),
        name: name,
        coverUrl: 'https://picsum.photos/seed/' + Math.random() + '/300/300',
        description: 'Created by you.',
        tracks: [],
        isUserCreated: true,
        gradient: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)'
      };
      userPlaylists.unshift(newPlaylist);
      saveUserPlaylists();
      return newPlaylist;
    },
    addTrackToPlaylist: (playlistId, track) => {
      const p = userPlaylists.find(p => p.id === playlistId);
      if (p) {
        if (!p.tracks.some(t => t.id === track.id)) {
          p.tracks.push(track);
          saveUserPlaylists();
        }
      }
    },
    removeTrackFromPlaylist: (playlistId, trackId) => {
      const p = userPlaylists.find(p => p.id === playlistId);
      if (p) {
        p.tracks = p.tracks.filter(t => t.id !== trackId);
        saveUserPlaylists();
      }
    },
    renamePlaylist: (playlistId, newName) => {
      const p = userPlaylists.find(p => p.id === playlistId);
      if (p) {
        p.name = newName;
        saveUserPlaylists();
      }
    },
    deletePlaylist: (playlistId) => {
      const idx = userPlaylists.findIndex(p => p.id === playlistId);
      if (idx !== -1) {
        userPlaylists.splice(idx, 1);
        saveUserPlaylists();
        return true;
      }
      return false;
    },

    /* ---- Recently Played/Searched API ---- */
    getRecentlyPlayed,
    addRecentlyPlayed,
    getRecentlySearched,
    addRecentlySearched,

    /* ---- Saavn API ---- */
    searchSaavn: async (query) => {
      const resData = await saavnFetch(`/search/${encodeURIComponent(query)}`);
      const results = (resData && resData.results) ? resData.results : (Array.isArray(resData) ? resData : []);
      if (!Array.isArray(results)) return { tracks: [], albums: [], artists: [] };
      
      const tracks = results.map(mapSaavnTrack);
      
      // Extract unique albums from tracks
      const albumsMap = new Map();
      results.forEach(st => {
        if (st.album_id && !albumsMap.has(st.album_id)) {
          albumsMap.set(st.album_id, {
            id: `saavn-album-${st.album_id}`,
            title: st.album || 'Unknown Album',
            artist: st.album_artist || st.artists || 'Unknown Artist',
            coverUrl: st.image || 'https://picsum.photos/seed/default/300/300',
            source: 'saavn'
          });
        }
      });
      const albums = Array.from(albumsMap.values());
      
      return {
        tracks,
        albums,
        artists: [] // Artist extraction omitted for brevity
      };
    },

    getSaavnAlbum: async (albumId) => {
      const rawId = String(albumId).replace('saavn-album-', '');
      const albumData = await saavnFetch(`/album/${rawId}`);
      if (!albumData) return null;
      const mapped = mapSaavnAlbum(albumData);
      if (!albums.find(a => a.id === mapped.id)) {
        albums.push(mapped);
      }
      return mapped;
    },

    getSongLyrics: async (id, track) => {
      // If we have track details, try lrclib for perfectly synced lyrics
      if (track && track.title) {
        try {
          const lrcUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist || '')}`;
          const lrcRes = await fetch(lrcUrl);
          if (lrcRes.ok) {
            const lrcData = await lrcRes.json();
            const synced = lrcData.find(x => x.syncedLyrics);
            if (synced && synced.syncedLyrics) {
              return synced.syncedLyrics; // Return LRC format
            }
          }
        } catch (err) {
          console.warn('LRCLIB fetch failed, falling back to Saavn', err);
        }
      }

      // Fallback to Saavn raw lyrics
      const rawId = id.replace('saavn-', '');
      try {
        const data = await saavnFetch(`/lyrics/${rawId}`);
        if (data && data.lyrics) {
          return data.lyrics.replace(/<br>/g, '\n');
        }
        return null;
      } catch (err) {
        return null;
      }
    },

    romanizeToEnglish: async (text) => {
      if (!text) return '';
      try {
        const chunks = text.match(/[\s\S]{1,1000}(?=\n|$)/g) || [text];
        const results = [];
        for (let chunk of chunks) {
          if (!chunk.trim()) {
            results.push(chunk);
            continue;
          }
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=hi&tl=en&dt=rm&q=${encodeURIComponent(chunk)}`;
          const res = await fetch(url);
          const data = await res.json();
          let chunkText = '';
          if (data && data[0]) {
             for (let item of data[0]) {
                if (item[3]) chunkText += item[3];
                else if (item[0]) chunkText += item[0];
             }
          }
          results.push(chunkText || chunk);
        }
        return results.join('');
      } catch (err) {
        console.warn('Romanization failed:', err);
        throw err;
      }
    },

    getTrendingTracks: async () => {
      // Fetch some default popular hits for home screen
      const resData = await saavnFetch('/search/top hindi songs');
      const results = (resData && resData.results) ? resData.results : (Array.isArray(resData) ? resData : []);
      if (!Array.isArray(results)) return [];
      return results.map(mapSaavnTrack);
    },

    /* ---- Utility ---- */
    formatDuration,

    genres: ['Pop', 'Rock', 'Electronic', 'Jazz', 'Hip-Hop', 'Classical', 'Ambient', 'Lo-fi', 'R&B', 'Metal', 'Folk', 'Country', 'Reggae', 'Soul', 'Punk']
  };

})();
