/* ============================================================
   Pulse Music — spotify.js
   Spotify Integration Placeholder
   ============================================================ */
(function () {
  'use strict';

  window.SpotifyClient = {

    isConnected() {
      return false;
    },

    connect() {
      if (window.UI) {
        UI.showToast('Spotify integration coming soon!');
      }
    },

    disconnect() {
      // no-op
    },

    getPlaylists() {
      return [];
    },

    search(query) {
      return { tracks: [], albums: [], artists: [] };
    },

    getRecommendations() {
      return [];
    }
  };
})();
