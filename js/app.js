// State Management menggunakan LocalStorage agar perubahan persist antar halaman
const Storage = {
  getAssets() {
    const custom = JSON.parse(localStorage.getItem('vexa_custom_assets') || '[]');
    const savedReviews = JSON.parse(localStorage.getItem('vexa_asset_reviews') || '{}');
    const all = [...custom, ...INITIAL_ASSETS];
    return all.map(asset => ({
      ...asset,
      reviews: [...(savedReviews[asset.id] || []), ...(asset.reviews || [])]
    }));
  },
  addCustomAsset(asset) {
    const custom = JSON.parse(localStorage.getItem('vexa_custom_assets') || '[]');
    custom.unshift(asset);
    localStorage.setItem('vexa_custom_assets', JSON.stringify(custom));
  },
  addReview(assetId, review) {
    const savedReviews = JSON.parse(localStorage.getItem('vexa_asset_reviews') || '{}');
    if (!savedReviews[assetId]) savedReviews[assetId] = [];
    savedReviews[assetId].unshift(review);
    localStorage.setItem('vexa_asset_reviews', JSON.stringify(savedReviews));
  },
  getSavedIds() {
    return JSON.parse(localStorage.getItem('vexa_saved_ids') || '[]');
  },
  toggleSave(id) {
    let saved = this.getSavedIds();
    if (saved.includes(id)) {
      saved = saved.filter(item => item !== id);
      UI.toast('Dihapus dari Saved Vault');
    } else {
      saved.push(id);
      UI.toast('Tersimpan ke Vault kamu');
    }
    localStorage.setItem('vexa_saved_ids', JSON.stringify(saved));
    UI.updateCounters();
    return saved.includes(id);
  },
  getPurchasedIds() {
    return JSON.parse(localStorage.getItem('vexa_purchased_ids') || '[]');
  },
  addPurchase(id) {
    const purchased = this.getPurchasedIds();
    if (!purchased.includes(id)) {
      purchased.push(id);
      localStorage.setItem('vexa_purchased_ids', JSON.stringify(purchased));
    }
  },
  getUser() {
    return JSON.parse(localStorage.getItem('vexa_user') || 'null');
  },
  setUser(user) {
    if (user) localStorage.setItem('vexa_user', JSON.stringify(user));
    else localStorage.removeItem('vexa_user');
  }
};

// Format Rupiah
const formatIDR = (num) => {
  if (num === 0) return 'FREE';
  return 'Rp ' + num.toLocaleString('id-ID');
};

// Web Audio API Synthesizer (untuk preview suara nyata tanpa file mp3 eksternal!)
const SoundPreview = {
  ctx: null,
  activeId: null,
  timer: null,
  play(id, btnEl) {
    if (this.activeId === id) {
      this.stop();
      return;
    }
    this.stop();
    this.activeId = id;
    if (btnEl) btnEl.classList.add('playing');

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = id.includes('02') ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(id.includes('02') ? 110 : 520, now);
      osc.frequency.exponentialRampToValueAtTime(id.includes('02') ? 65 : 880, now + 0.35);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.4);
    } catch (e) {}

    this.timer = setTimeout(() => this.stop(), 1600);
  },
  stop() {
    document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
    if (this.timer) clearTimeout(this.timer);
    this.activeId = null;
  }
};

// Komponen UI Global (Header, Mobile Nav, Modals, Drawer, Toast)
const UI = {
  init(activePage) {
    this.injectShell(activePage);
    this.updateAuthUI();
    this.updateCounters();
  },

  injectShell(activePage) {
    const headerHTML = `
      <header class="sticky top-0 z-40 border-b border-white/[0.08] bg-[#09090B]/85 backdrop-blur-xl">
        <div class="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <a href="./index.html" aria-label="Vexa Insights Studio — Home" class="group flex shrink-0 items-center rounded-lg">
            <img 
              src="./assets/full-logo.png" 
              alt="Vexa Insights Studio" 
              class="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03] sm:h-9" 
            />
          </a>

          <nav class="hidden flex-1 items-center gap-1.5 md:flex">
            <a href="./index.html" class="rounded-full px-4 py-2 text-sm font-medium transition-colors ${activePage === 'explore' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}">Explore</a>
            <a href="./marketplace.html" class="rounded-full px-4 py-2 text-sm font-medium transition-colors ${activePage === 'marketplace' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}">Marketplace</a>
            <a href="./studio.html" class="rounded-full px-4 py-2 text-sm font-medium transition-colors ${activePage === 'studio' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}">Creator Studio</a>
          </nav>

          <div class="ml-auto flex items-center gap-2.5">
            <a href="./vault.html" aria-label="Saved Vault" class="relative hidden h-10 w-10 place-items-center rounded-full border border-white/10 text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-white md:grid">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span id="nav-vault-badge" class="hidden absolute -right-1 -top-1 h-4 min-w-[16px] rounded-full bg-violet-600 px-1 text-center font-mono text-[10px] font-bold leading-4 text-white">0</span>
            </a>
            <div id="auth-slot"></div>
          </div>
        </div>
      </header>
    `;

    const footerHTML = `
      <footer class="mt-24 border-t border-white/[0.08] bg-[#09090B]">
        <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <a href="./index.html" class="inline-flex items-center">
              <img 
                src="./assets/full-logo.png" 
                alt="Vexa Insights Studio" 
                class="h-8 w-auto object-contain" 
              />
            </a>
            <p class="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
              Pusat inspirasi & marketplace aset digital di bawah Vexaro Group—menyuplai kreator WebStudio, FilmStudio, dan EchoStudio.
            </p>
            <span class="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-zinc-400">
              <span class="h-1.5 w-1.5 rounded-full bg-violet-500"></span> Interactive Frontend Edition
            </span>
          </div>

          <div>
            <p class="font-mono text-xs uppercase tracking-widest text-zinc-500">Navigation</p>
            <ul class="mt-4 space-y-2.5 text-sm">
              <li><a href="./index.html" class="text-zinc-400 hover:text-white">Explore Hub</a></li>
              <li><a href="./marketplace.html" class="text-zinc-400 hover:text-white">Asset Marketplace</a></li>
              <li><a href="./studio.html" class="text-zinc-400 hover:text-white">Creator Studio (Upload)</a></li>
              <li><a href="./vault.html" class="text-zinc-400 hover:text-white">Saved Vault</a></li>
            </ul>
          </div>

          <div>
            <p class="font-mono text-xs uppercase tracking-widest text-zinc-500">Vexaro Ecosystem</p>
            <ul class="mt-4 space-y-2.5 text-sm text-zinc-400">
              <li>
                <a href="https://vexa-webstudio.github.io" target="_blank" rel="noopener noreferrer" class="group inline-flex items-center gap-2.5 transition-colors hover:text-white">
                  <img src="./assets/logo-webstudio.png" alt="WebStudio" class="h-5 w-5 rounded object-contain transition-transform group-hover:scale-110" />
                  <span>WebStudio</span>
                </a>
              </li>
              <li>
                <a href="https://vexa-filmstudio.github.io" target="_blank" rel="noopener noreferrer" class="group inline-flex items-center gap-2.5 transition-colors hover:text-white">
                  <img src="./assets/logo-filmstudio.png" alt="FilmStudio" class="h-5 w-5 rounded object-contain transition-transform group-hover:scale-110" />
                  <span>FilmStudio</span>
                </a>
              </li>
              <li>
                <a href="https://vexa-echostudio.github.io" target="_blank" rel="noopener noreferrer" class="group inline-flex items-center gap-2.5 transition-colors hover:text-white">
                  <img src="./assets/logo-echostudio.png" alt="EchoStudio" class="h-5 w-5 rounded object-contain transition-transform group-hover:scale-110" />
                  <span>EchoStudio</span>
                </a>
              </li>
              <li>
                <a href="./index.html" class="group inline-flex items-center gap-2.5 font-medium text-white transition-colors hover:text-violet-400">
                  <img src="./assets/logo-insightsstudio.png" alt="InsightsStudio" class="h-5 w-5 rounded object-contain transition-transform group-hover:scale-110" />
                  <span>InsightsStudio</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class="border-t border-white/[0.06] py-6">
          <div class="mx-auto flex max-w-7xl flex-col gap-2 px-4 font-mono text-xs text-zinc-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <span>
              © 2026 <a href="https://vexarogroup.github.io" target="_blank" rel="noopener noreferrer" class="no-underline text-zinc-400 transition-colors hover:text-white">Vexaro</a> · Vexa-InsightsStudio
            </span>
            <span>All prices in IDR · PPN 11% calculated at checkout</span>
          </div>
        </div>

      <!-- Mobile Bottom Navigation -->
      <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#09090B]/95 backdrop-blur-xl md:hidden">
        <ul class="grid grid-cols-4">
          <li>
            <a href="./index.html" class="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${activePage === 'explore' ? 'text-violet-400' : 'text-zinc-400'}">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              Explore
            </a>
          </li>
          <li>
            <a href="./marketplace.html" class="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${activePage === 'marketplace' ? 'text-violet-400' : 'text-zinc-400'}">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
              Market
            </a>
          </li>
          <li>
            <a href="./studio.html" class="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${activePage === 'studio' ? 'text-violet-400' : 'text-zinc-400'}">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Studio
            </a>
          </li>
          <li>
            <a href="./vault.html" class="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${activePage === 'vault' ? 'text-violet-400' : 'text-zinc-400'}">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              Vault
            </a>
          </li>
        </ul>
      </nav>

      <!-- Global Asset Detail Modal -->
      <div id="asset-modal" class="modal-backdrop invisible fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 opacity-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div id="asset-modal-content" class="modal-panel max-h-[92vh] w-full max-w-3xl translate-y-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-[#121216] p-5 opacity-0 shadow-2xl sm:rounded-3xl sm:p-7"></div>
      </div>

      <!-- Checkout / Download Slide-Over Drawer -->
      <div id="checkout-drawer" class="modal-backdrop invisible fixed inset-0 z-50 flex justify-end bg-black/75 opacity-0 backdrop-blur-sm">
        <div id="checkout-drawer-content" class="modal-panel flex h-full w-full max-w-md translate-x-full flex-col justify-between border-l border-white/10 bg-[#121216] p-6 opacity-0 shadow-2xl"></div>
      </div>

      <!-- Auth Modal -->
      <div id="auth-modal" class="modal-backdrop invisible fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 opacity-0 backdrop-blur-sm">
        <div class="modal-panel w-full max-w-md rounded-3xl border border-white/10 bg-[#121216] p-6 shadow-2xl sm:p-8">
          <div class="flex items-center justify-between">
            <span class="rounded-full bg-violet-500/15 px-3 py-1 font-mono text-xs text-violet-400">VEXARO ID</span>
            <button onclick="UI.closeModals()" class="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">✕</button>
          </div>
          <h3 class="mt-4 text-xl font-bold text-white">Masuk ke Vexa-InsightsStudio</h3>
          <p class="mt-1 text-sm text-zinc-400">Simpan inspirasi, publikasikan aset, dan kelola lisensi kreator.</p>
          <form onsubmit="UI.handleLogin(event)" class="mt-5 space-y-4">
            <!-- Username / Nama Tampilan (Terpisah jarak standar) -->
            <div>
              <label class="block text-xs font-medium text-zinc-300">Username</label>
              <input id="login-name" type="text" required placeholder="Masukan Nama" class="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
            </div>

            <!-- Grup Email & Password (Berdekatan rapat) -->
            <div class="space-y-2">
              <div>
                <label class="block text-xs font-medium text-zinc-300">Email & Password</label>
                <input id="login-email" type="email" required placeholder="Masukan Email" class="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
              </div>
              <div class="relative">
                <input id="login-password" type="password" required placeholder="Masukan Password" class="w-full rounded-xl border border-white/10 bg-zinc-900 py-2.5 pl-3.5 pr-12 text-sm text-white outline-none focus:border-violet-500" />
                <button type="button" onclick="const p = document.getElementById('login-password'); p.type = p.type === 'password' ? 'text' : 'password'; this.textContent = p.type === 'password' ? 'Show' : 'Hide';" class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-400 hover:text-white">
                  Show
                </button>
              </div>
            </div>

            <button type="submit" class="w-full rounded-full bg-violet-600 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-violet-500">
              Lanjutkan Masuk
            </button>
          </form>
        </div>
      </div>

      <!-- Toast Notification -->
      <div id="toast-box" class="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-6"></div>
    `;

    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  },

  updateAuthUI() {
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    const user = Storage.getUser();
    if (user) {
      const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      slot.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1.5 pr-3">
            <span class="grid h-7 w-7 place-items-center rounded-full bg-violet-600 font-mono text-xs font-bold text-white">${initials}</span>
            <span class="hidden text-xs font-medium text-white sm:inline">${user.name}</span>
          </div>
          <button onclick="UI.logout()" title="Sign out" class="rounded-full border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white">Out</button>
        </div>
      `;
    } else {
      slot.innerHTML = `
        <button onclick="UI.openAuth()" class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:bg-violet-500">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Sign in
        </button>
      `;
    }
  },

  updateCounters() {
    const count = Storage.getSavedIds().length;
    const badge = document.getElementById('nav-vault-badge');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
  },

  openAuth() {
    const m = document.getElementById('auth-modal');
    m.classList.remove('invisible', 'opacity-0');
  },

  handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    const email = document.getElementById('login-email').value.trim();
    Storage.setUser({ name, email });
    this.updateAuthUI();
    this.closeModals();
    this.toast(`Selamat datang kembali, ${name}!`);
  },

  logout() {
    Storage.setUser(null);
    this.updateAuthUI();
    this.toast('Berhasil keluar dari akun');
  },

  closeModals() {
    SoundPreview.stop();
    ['asset-modal', 'checkout-drawer', 'auth-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('invisible', 'opacity-0');
    });
    const drawerPanel = document.getElementById('checkout-drawer-content');
    if (drawerPanel) drawerPanel.classList.add('translate-x-full', 'opacity-0');
  },

  toast(msg) {
    const box = document.getElementById('toast-box');
    const item = document.createElement('div');
    item.className = 'rounded-full border border-violet-500/40 bg-[#18181F] px-4 py-2.5 text-xs font-medium text-white shadow-xl';
    item.textContent = msg;
    box.appendChild(item);
    setTimeout(() => item.remove(), 2600);
  },

  // Render Kartu Aset Seragam
  renderCard(asset) {
    const isSaved = Storage.getSavedIds().includes(asset.id);
    const isPro = asset.type === 'pro';
    const badgeColor = isPro
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';

    const previewVisual = asset.category === 'sound'
      ? `<div class="flex h-full w-full items-center justify-center gap-1.5 px-8" id="wave-${asset.id}">
          ${Array.from({ length: 16 }).map((_, i) => `<span class="wave-bar w-1.5 rounded-full bg-emerald-400/80" style="height:${22 + ((i * 19) % 44)}px"></span>`).join('')}
         </div>`
      : `<div class="flex h-full w-full flex-col items-center justify-center p-6 text-center">
          <span class="rounded-2xl border border-white/15 bg-black/40 px-3.5 py-1.5 font-mono text-[11px] tracking-wider text-white/90 backdrop-blur-md">${asset.format}</span>
         </div>`;

    return `
      <article class="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121216] transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-glow">
        <!-- Thumbnail Area -->
        <div onclick="UI.openDetail('${asset.id}')" class="relative h-44 cursor-pointer overflow-hidden bg-gradient-to-br ${asset.gradient}">
          ${previewVisual}
          <div class="absolute left-3 top-3 flex items-center gap-1.5">
            <span class="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 font-mono text-[10px] font-medium text-zinc-200 backdrop-blur-md">${asset.studioTag}</span>
          </div>
          <span class="absolute right-3 top-3 rounded-full border ${badgeColor} px-2.5 py-1 font-mono text-[11px] font-bold backdrop-blur-md">
            ${formatIDR(asset.price)}
          </span>
          ${asset.category === 'sound' ? `
            <button onclick="event.stopPropagation(); SoundPreview.play('${asset.id}', document.getElementById('wave-${asset.id}'))" class="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md hover:bg-emerald-600">
              ▶ Preview Audio
            </button>
          ` : ''}
        </div>

        <!-- Card Body -->
        <div class="flex flex-1 flex-col justify-between p-4">
          <div>
            <div class="flex items-start justify-between gap-2">
              <h3 onclick="UI.openDetail('${asset.id}')" class="cursor-pointer text-base font-bold leading-snug text-white transition-colors group-hover:text-violet-400">
                ${asset.title}
              </h3>
              <button onclick="UI.handleCardSave('${asset.id}', this)" aria-label="Bookmark" class="shrink-0 rounded-full border border-white/10 p-2 text-xs transition ${isSaved ? 'border-violet-500 bg-violet-500/20 text-violet-300' : 'text-zinc-400 hover:text-white'}">
                ${isSaved ? '★' : '☆'}
              </button>
            </div>
            <p class="mt-1 text-xs text-zinc-400">by <span class="text-zinc-300">${asset.creator}</span></p>
          </div>

          <div class="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <div class="flex items-center gap-3 font-mono text-xs text-zinc-400">
              <span class="text-amber-400">★ ${asset.rating}</span>
              <span>↓ ${asset.downloads}</span>
            </div>
            <button onclick="UI.openDetail('${asset.id}')" class="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600">
              Detail & Preview
            </button>
          </div>
        </div>
      </article>
    `;
  },

  handleCardSave(id, btn) {
    const nowSaved = Storage.toggleSave(id);
    btn.textContent = nowSaved ? '★' : '☆';
    btn.className = `shrink-0 rounded-full border p-2 text-xs transition ${nowSaved ? 'border-violet-500 bg-violet-500/20 text-violet-300' : 'border-white/10 text-zinc-400 hover:text-white'}`;
  },

  // Modal Detail Aset + Interactive Preview (Web Desktop/Mobile, LUT Slider, Audio) + Ulasan
  openDetail(id) {
    const asset = Storage.getAssets().find(a => a.id === id);
    if (!asset) return;

    const modal = document.getElementById('asset-modal');
    const panel = document.getElementById('asset-modal-content');

    let interactivePreview = '';
    if (asset.category === 'film') {
      interactivePreview = `
        <div class="rounded-2xl border border-white/10 bg-zinc-950 p-4">
          <div class="mb-2 flex items-center justify-between font-mono text-xs text-zinc-400">
            <span>RAW LOG (BEFORE)</span>
            <span class="text-amber-400">VEXA GRADE (AFTER)</span>
          </div>
          <div class="relative h-44 overflow-hidden rounded-xl bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700">
            <div id="lut-after-layer" class="absolute inset-0 bg-gradient-to-br from-rose-600/70 via-amber-500/50 to-indigo-950/90" style="width: 55%;"></div>
            <div class="relative z-10 flex h-full items-center justify-center font-mono text-xs font-bold tracking-widest text-white drop-shadow">
              GESER SLIDER UNTUK BANDINGKAN GRADE
            </div>
          </div>
          <input type="range" min="0" max="100" value="55" oninput="document.getElementById('lut-after-layer').style.width = this.value + '%'" class="mt-3 w-full accent-violet-500 cursor-pointer" />
        </div>
      `;
    } else if (asset.category === 'sound') {
      interactivePreview = `
        <div class="flex items-center justify-between rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-4">
          <div>
            <p class="text-sm font-bold text-white">Studio Audio Tester</p>
            <p class="font-mono text-xs text-emerald-400">${asset.format} · ${asset.size}</p>
          </div>
          <button onclick="SoundPreview.play('${asset.id}', this)" class="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500">
            ▶ Putar Sampel Suara
          </button>
        </div>
      `;
    } else {
      interactivePreview = `
        <div class="rounded-2xl border border-white/10 bg-zinc-950 p-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="font-mono text-xs text-zinc-400">RESPONSIVE VIEWPORT PREVIEW</span>
            <div class="flex gap-1.5">
              <button onclick="document.getElementById('web-mockup-box').style.maxWidth='100%'" class="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-[11px] text-white">Desktop</button>
              <button onclick="document.getElementById('web-mockup-box').style.maxWidth='260px'" class="rounded-lg bg-violet-600/30 px-2.5 py-1 font-mono text-[11px] text-violet-300">Mobile HP</button>
            </div>
          </div>
          <div id="web-mockup-box" class="mx-auto transition-all duration-300 rounded-xl border border-violet-500/30 bg-gradient-to-br ${asset.gradient} p-5 text-center">
            <p class="text-xs font-bold text-white">${asset.title}</p>
            <p class="mt-1 font-mono text-[11px] text-zinc-300">Zero-Clipping Mobile Layout Ready</p>
          </div>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <span class="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 font-mono text-xs text-violet-300">${asset.studioTag}</span>
          <h2 class="mt-2.5 text-xl font-extrabold text-white sm:text-2xl">${asset.title}</h2>
          <p class="mt-1 text-xs text-zinc-400">Dirilis oleh <strong class="text-white">${asset.creator}</strong> · Format <span class="font-mono text-zinc-300">${asset.format}</span></p>
        </div>
        <button onclick="UI.closeModals()" class="rounded-full border border-white/10 p-2 text-zinc-400 hover:bg-white/10 hover:text-white">✕</button>
      </div>

      <div class="mt-5">${interactivePreview}</div>

      <p class="mt-5 text-sm leading-relaxed text-zinc-300">${asset.description}</p>

      <div class="mt-4 flex flex-wrap gap-2">
        ${asset.specs.map(s => `<span class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-zinc-300">✓ ${s}</span>`).join('')}
      </div>

      <!-- Action Bar -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 p-4">
        <div>
          <span class="block font-mono text-[11px] text-zinc-400">LISENSI KOMERSIAL & PERSONAL</span>
          <span class="text-xl font-extrabold ${asset.type === 'pro' ? 'text-amber-400' : 'text-emerald-400'}">${formatIDR(asset.price)}</span>
        </div>
        <div class="flex items-center gap-2.5">
          <button onclick="Storage.toggleSave('${asset.id}')" class="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10">
            + Save Vault
          </button>
          <button onclick="UI.openCheckout('${asset.id}')" class="rounded-full bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-violet-500">
            ${asset.price === 0 ? 'Unduh Gratis Sekarang' : 'Beli Aset Sekarang'}
          </button>
        </div>
      </div>

      <!-- Ulasan Pembeli (Frontend State + LocalStorage) -->
      <div class="mt-7 border-t border-white/10 pt-6">
        <h4 class="text-sm font-bold text-white">Ulasan Kreator (${asset.reviews.length})</h4>
        <form onsubmit="UI.submitReview(event, '${asset.id}')" class="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <select id="rev-rating" class="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none">
            <option value="5">★★★★★ (5)</option>
            <option value="4">★★★★☆ (4)</option>
          </select>
          <input id="rev-text" type="text" required placeholder="Tulis pengalamanmu memakai aset ini..." class="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-xs text-white outline-none focus:border-violet-500" />
          <button type="submit" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-600">Kirim</button>
        </form>

        <div class="mt-4 space-y-2.5">
          ${asset.reviews.length === 0 ? '<p class="text-xs text-zinc-500">Belum ada ulasan. Jadilah yang pertama mengulas!</p>' : asset.reviews.map(r => `
            <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div class="flex items-center justify-between text-xs">
                <strong class="text-white">${r.user}</strong>
                <span class="font-mono text-amber-400">${'★'.repeat(r.rating)} · <span class="text-zinc-500">${r.date}</span></span>
              </div>
              <p class="mt-1 text-xs text-zinc-300">${r.comment}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.remove('invisible', 'opacity-0');
    panel.classList.remove('translate-y-4', 'opacity-0');
  },

  submitReview(e, assetId) {
    e.preventDefault();
    const user = Storage.getUser();
    const rating = Number(document.getElementById('rev-rating').value);
    const comment = document.getElementById('rev-text').value.trim();
    Storage.addReview(assetId, {
      user: user ? user.name : 'Vexaro Guest Creator',
      rating,
      comment,
      date: 'Baru saja'
    });
    this.toast('Ulasan berhasil ditambahkan!');
    this.openDetail(assetId);
  },

  // Slide-Over Checkout Drawer
  openCheckout(id) {
    const asset = Storage.getAssets().find(a => a.id === id);
    if (!asset) return;
    this.closeModals();

    const drawer = document.getElementById('checkout-drawer');
    const panel = document.getElementById('checkout-drawer-content');
    const ppn = Math.round(asset.price * 0.11);
    const total = asset.price + ppn;

    panel.innerHTML = `
      <div>
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <span class="font-mono text-xs uppercase tracking-widest text-violet-400">Vexa Instant Checkout</span>
          <button onclick="UI.closeModals()" class="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div class="mt-5 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <span class="font-mono text-[11px] text-zinc-400">${asset.studioTag}</span>
          <h4 class="mt-1 text-base font-bold text-white">${asset.title}</h4>
          <p class="mt-1 font-mono text-xs text-zinc-400">${asset.format} · ${asset.size}</p>
        </div>

        <div class="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-sm">
          <div class="flex justify-between text-zinc-400">
            <span>Harga Aset</span>
            <span class="font-mono text-white">${formatIDR(asset.price)}</span>
          </div>
          <div class="flex justify-between text-zinc-400">
            <span>PPN (11%)</span>
            <span class="font-mono text-white">${formatIDR(ppn)}</span>
          </div>
          <div class="flex justify-between border-t border-white/10 pt-3 text-base font-bold text-white">
            <span>Total Bayar</span>
            <span class="font-mono text-violet-400">${formatIDR(total)}</span>
          </div>
        </div>

        ${asset.price > 0 ? `
          <div class="mt-6">
            <label class="block font-mono text-xs text-zinc-400">METODE PEMBAYARAN (SIMULASI)</label>
            <div class="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
              <button type="button" class="rounded-xl border border-violet-500 bg-violet-500/15 py-2.5 font-bold text-white">QRIS</button>
              <button type="button" class="rounded-xl border border-white/10 bg-zinc-900 py-2.5 text-zinc-400">Virtual Acc</button>
              <button type="button" class="rounded-xl border border-white/10 bg-zinc-900 py-2.5 text-zinc-400">Card</button>
            </div>
          </div>
        ` : ''}
      </div>

      <button onclick="UI.completeOrder('${asset.id}')" class="w-full rounded-full bg-violet-600 py-3.5 text-sm font-bold text-white shadow-glow transition hover:bg-violet-500">
        ${asset.price === 0 ? 'Konfirmasi & Unduh File' : 'Bayar & Buka Akses File'}
      </button>
    `;

    drawer.classList.remove('invisible', 'opacity-0');
    setTimeout(() => panel.classList.remove('translate-x-full', 'opacity-0'), 10);
  },

  completeOrder(id) {
    Storage.addPurchase(id);
    this.closeModals();
    this.toast('Aset berhasil ditambahkan ke Vault & siap diunduh!');
  }
};