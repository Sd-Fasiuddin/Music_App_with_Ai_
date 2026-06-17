/* ============================================================
   Pulse Music — localFiles.js
   Local File Import, ID3 Parsing & IndexedDB Persistence
   ============================================================ */
(function () {
  'use strict';

  const DB_NAME = 'PulseMusicDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'localTracks';

  let db = null;

  // ── IndexedDB helpers ───────────────────────────────────────
  const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    request.onerror = (e) => { console.error('[LocalFiles] IndexedDB error:', e); reject(e); };
  });

  const dbPut = (track) => new Promise((resolve, reject) => {
    if (!db) { resolve(); return; }
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Store metadata only (no blob)
    const meta = { ...track, audioUrl: '' };
    store.put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });

  const dbGetAll = () => new Promise((resolve, reject) => {
    if (!db) { resolve([]); return; }
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e);
  });

  // ── ID3v2 Tag Parser (basic implementation) ─────────────────
  const parseID3 = (arrayBuffer) => {
    const dv = new DataView(arrayBuffer);
    const decoder = new TextDecoder('utf-8');
    const result = { title: '', artist: '', album: '', coverData: null, coverMime: '' };

    // Check for ID3v2 header: "ID3"
    if (dv.byteLength < 10) return result;
    const header = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2));
    if (header !== 'ID3') return result;

    const version = dv.getUint8(3); // major version (3 = ID3v2.3, 4 = ID3v2.4)
    // const revision = dv.getUint8(4);
    // const flags = dv.getUint8(5);

    // Synchsafe integer for tag size
    const tagSize = (dv.getUint8(6) << 21) | (dv.getUint8(7) << 14) |
                    (dv.getUint8(8) << 7)  | dv.getUint8(9);

    let offset = 10;
    const end = Math.min(10 + tagSize, dv.byteLength);

    const readFrameSize = (off) => {
      if (version === 4) {
        // ID3v2.4 uses synchsafe
        return (dv.getUint8(off) << 21) | (dv.getUint8(off + 1) << 14) |
               (dv.getUint8(off + 2) << 7) | dv.getUint8(off + 3);
      }
      // ID3v2.3 uses regular integer
      return (dv.getUint8(off) << 24) | (dv.getUint8(off + 1) << 16) |
             (dv.getUint8(off + 2) << 8) | dv.getUint8(off + 3);
    };

    const readTextFrame = (off, size) => {
      if (size < 2) return '';
      const encoding = dv.getUint8(off);
      let text = '';
      if (encoding === 0 || encoding === 3) {
        // ISO-8859-1 or UTF-8
        const bytes = new Uint8Array(arrayBuffer, off + 1, size - 1);
        text = decoder.decode(bytes);
      } else if (encoding === 1 || encoding === 2) {
        // UTF-16
        let start = off + 1;
        let len = size - 1;
        // Skip BOM
        if (len >= 2) {
          const bom = dv.getUint16(start);
          if (bom === 0xFEFF || bom === 0xFFFE) {
            start += 2;
            len -= 2;
          }
        }
        const u16 = new Uint16Array(arrayBuffer.slice(start, start + len));
        text = String.fromCharCode(...u16);
      }
      // Remove null terminators
      return text.replace(/\0/g, '').trim();
    };

    while (offset < end - 10) {
      const frameId = String.fromCharCode(
        dv.getUint8(offset), dv.getUint8(offset + 1),
        dv.getUint8(offset + 2), dv.getUint8(offset + 3)
      );

      if (frameId === '\0\0\0\0' || frameId.charCodeAt(0) === 0) break;

      const frameSize = readFrameSize(offset + 4);
      // const frameFlags = dv.getUint16(offset + 8);
      const frameDataOffset = offset + 10;

      if (frameSize <= 0 || frameDataOffset + frameSize > end) break;

      switch (frameId) {
        case 'TIT2': result.title = readTextFrame(frameDataOffset, frameSize); break;
        case 'TPE1': result.artist = readTextFrame(frameDataOffset, frameSize); break;
        case 'TALB': result.album = readTextFrame(frameDataOffset, frameSize); break;
        case 'APIC': {
          // Extract embedded album art
          try {
            const encoding = dv.getUint8(frameDataOffset);
            let pos = frameDataOffset + 1;
            // Read MIME type (null-terminated)
            let mime = '';
            while (pos < frameDataOffset + frameSize && dv.getUint8(pos) !== 0) {
              mime += String.fromCharCode(dv.getUint8(pos));
              pos++;
            }
            pos++; // skip null
            pos++; // skip picture type byte
            // Skip description (null-terminated, encoding-dependent)
            if (encoding === 0 || encoding === 3) {
              while (pos < frameDataOffset + frameSize && dv.getUint8(pos) !== 0) pos++;
              pos++;
            } else {
              while (pos < frameDataOffset + frameSize - 1) {
                if (dv.getUint8(pos) === 0 && dv.getUint8(pos + 1) === 0) { pos += 2; break; }
                pos += 2;
              }
            }
            const imgData = new Uint8Array(arrayBuffer, pos, frameDataOffset + frameSize - pos);
            result.coverData = imgData;
            result.coverMime = mime || 'image/jpeg';
          } catch (_) { /* ignore cover parse failure */ }
          break;
        }
      }

      offset += 10 + frameSize;
    }

    return result;
  };

  // ── Public API ──────────────────────────────────────────────
  const LocalFiles = {

    async init() {
      try {
        await openDB();
        await LocalFiles.loadFromStorage();
      } catch (err) {
        console.warn('[LocalFiles] Init error:', err);
      }

      // Set up drag & drop
      const dropZone = document.querySelector('.drop-zone');
      if (!dropZone) return;

      document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
          LocalFiles.showDropZone();
        }
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (e.target === dropZone) LocalFiles.hideDropZone();
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        LocalFiles.hideDropZone();
        if (e.dataTransfer.files.length) {
          LocalFiles.handleFiles(e.dataTransfer.files);
        }
      });

      console.log('[LocalFiles] Initialised');
    },

    async handleFiles(fileList) {
      const audioFiles = Array.from(fileList).filter(f =>
        f.type.startsWith('audio/') || /\.(mp3|m4a|ogg|wav|flac|aac|wma)$/i.test(f.name)
      );

      if (!audioFiles.length) {
        if (window.UI) UI.showToast('No audio files detected.');
        return;
      }

      let importedCount = 0;

      for (const file of audioFiles) {
        try {
          const metadata = await LocalFiles.parseMetadata(file);
          const track = LocalFiles.createTrackFromFile(file, metadata);
          window.MusicData.addLocalTrack(track);
          await dbPut(track);
          importedCount++;
        } catch (err) {
          console.error('[LocalFiles] Error importing file:', file.name, err);
        }
      }

      if (importedCount > 0) {
        if (window.UI) UI.showToast(`Imported ${importedCount} track${importedCount > 1 ? 's' : ''}`);
        document.dispatchEvent(new CustomEvent('localfiles:updated'));
      }
    },

    async parseMetadata(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target.result;
          const tags = parseID3(buffer);
          resolve({
            title: tags.title || file.name.replace(/\.[^/.]+$/, ''),
            artist: tags.artist || 'Unknown Artist',
            album: tags.album || 'Unknown Album',
            coverData: tags.coverData,
            coverMime: tags.coverMime
          });
        };
        reader.onerror = () => {
          resolve({
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            coverData: null,
            coverMime: ''
          });
        };
        reader.readAsArrayBuffer(file);
      });
    },

    createTrackFromFile(file, metadata) {
      const audioUrl = URL.createObjectURL(file);
      let coverUrl = 'https://picsum.photos/seed/localfile/300/300';

      if (metadata.coverData && metadata.coverMime) {
        const blob = new Blob([metadata.coverData], { type: metadata.coverMime });
        coverUrl = URL.createObjectURL(blob);
      }

      return {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: metadata.title,
        artist: metadata.artist,
        artistId: '',
        album: metadata.album,
        albumId: '',
        duration: 0, // will be updated when audio loads
        coverUrl,
        audioUrl,
        source: 'local',
        genre: ''
      };
    },

    getLocalTracks() {
      return window.MusicData ? MusicData.getLocalTracks() : [];
    },

    async saveToStorage() {
      const locals = LocalFiles.getLocalTracks();
      for (const track of locals) {
        await dbPut(track);
      }
    },

    async loadFromStorage() {
      try {
        const stored = await dbGetAll();
        if (stored.length && window.MusicData) {
          stored.forEach(t => {
            // Can't restore blob URLs across sessions, mark them for re-import
            t.audioUrl = t.audioUrl || '';
            MusicData.addLocalTrack(t);
          });
          console.log(`[LocalFiles] Restored ${stored.length} tracks from IndexedDB`);
        }
      } catch (err) {
        console.warn('[LocalFiles] Failed to load from storage:', err);
      }
    },

    showDropZone() {
      const dz = document.querySelector('.drop-zone');
      if (dz) dz.classList.add('active');
    },

    hideDropZone() {
      const dz = document.querySelector('.drop-zone');
      if (dz) dz.classList.remove('active');
    }
  };

  window.LocalFiles = LocalFiles;
})();
