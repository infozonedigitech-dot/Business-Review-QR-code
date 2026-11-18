/* =========================================================
   SMARTREVIEW — ADMIN PANEL LOGIC
   admin.js | v5.0 | Production-ready, secure, localStorage-based
   ========================================================= */
'use strict';

const A = (() => {

  /* ── STORAGE KEYS ─────────────────────────────────────── */
  const KEYS = {
    businesses: 'sr_businesses_v4',
    active:     'sr_active_v4',
    pin:        'sr_pin_v4',
    prefs:      'sr_prefs_v4',
    session:    'sr_session_v4',     // Session token
    lastActive: 'sr_last_active_v4', // Last activity timestamp
    stat:       (bizId, k) => `sr_stat_${bizId}_${k}`,
  };

  const DEFAULT_PIN      = 'admin1234';
  const REVIEW_PAGE      = 'customer-review.html';
  const SESSION_TIMEOUT  = 30 * 60 * 1000; // 30 minutes in milliseconds
  const ACTIVITY_CHECK   = 60 * 1000;      // Check every 1 minute

  /* ── STATE ────────────────────────────────────────────── */
  let businesses  = [];
  let activeId    = null;
  let editingId   = null;   // null = adding new
  let qrInstance  = null;
  let sidebarOpen = false;
  let sessionToken = null;
  let activityTimer = null;

  /* ── BOOTSTRAP ────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Check for existing valid session on page load
    if (checkExistingSession()) {
      // Valid session exists, unlock automatically
      unlockApp();
    } else {
      // No valid session, show lock screen
      bindLockScreen();
    }
  });

  function bootApp() {
    load();
    bindNav();
    bindBizForm();
    bindSettings();
    refreshAll();
    nav('overview');
    startActivityMonitor();
    bindBeforeUnload();
  }
  
  function bindBeforeUnload() {
    // Warn before closing if there's an active session
    // This prevents accidental data loss
    window.addEventListener('beforeunload', (e) => {
      // Only show warning if session is active and user made changes
      if (sessionToken && businesses.length > 0) {
        // Note: Most modern browsers ignore custom messages and show their own
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    });
  }

  /* ── SESSION MANAGEMENT ───────────────────────────────── */
  
  function checkExistingSession() {
    try {
      const session = localStorage.getItem(KEYS.session);
      const lastActive = localStorage.getItem(KEYS.lastActive);
      
      if (!session || !lastActive) return false;
      
      const lastActiveTime = parseInt(lastActive, 10);
      const now = Date.now();
      const timeSinceActive = now - lastActiveTime;
      
      // Session expired if more than SESSION_TIMEOUT has passed
      if (timeSinceActive > SESSION_TIMEOUT) {
        clearSession();
        return false;
      }
      
      // Valid session exists
      sessionToken = session;
      return true;
    } catch (e) {
      return false;
    }
  }
  
  function createSession() {
    sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(KEYS.session, sessionToken);
    updateLastActivity();
  }
  
  function updateLastActivity() {
    localStorage.setItem(KEYS.lastActive, Date.now().toString());
  }
  
  function clearSession() {
    sessionToken = null;
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.lastActive);
    if (activityTimer) {
      clearInterval(activityTimer);
      activityTimer = null;
    }
  }
  
  function startActivityMonitor() {
    // Update activity on user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateLastActivity, { passive: true });
    });
    
    // Check session validity every minute
    activityTimer = setInterval(() => {
      const lastActive = localStorage.getItem(KEYS.lastActive);
      if (!lastActive) {
        autoLock('Session data lost');
        return;
      }
      
      const lastActiveTime = parseInt(lastActive, 10);
      const now = Date.now();
      const timeSinceActive = now - lastActiveTime;
      
      if (timeSinceActive > SESSION_TIMEOUT) {
        autoLock('Session expired after 30 minutes of inactivity');
      }
    }, ACTIVITY_CHECK);
  }
  
  function autoLock(reason) {
    console.log('Auto-locking:', reason);
    clearSession();
    
    // Show lock screen
    document.getElementById('lock-screen').classList.remove('hidden');
    document.getElementById('admin-app').classList.add('hidden');
    document.getElementById('pin-input').value = '';
    
    // Show toast notification
    toast(`${reason}. Please login again.`, 'info');
  }

  /* ── LOCK / UNLOCK ────────────────────────────────────── */
  function bindLockScreen() {
    const input  = document.getElementById('pin-input');
    const btn    = document.getElementById('btn-unlock');
    const toggle = document.getElementById('toggle-pin');

    toggle?.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    btn?.addEventListener('click', tryUnlock);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    
    // Auto-focus PIN input
    setTimeout(() => input?.focus(), 100);
  }

  function tryUnlock() {
    const input = document.getElementById('pin-input');
    const err   = document.getElementById('pin-error');
    const val   = input.value.trim();
    const stored = localStorage.getItem(KEYS.pin) || DEFAULT_PIN;

    if (val === stored) {
      // Correct PIN - unlock
      createSession();
      unlockApp();
    } else {
      // Wrong PIN
      err.classList.remove('hidden');
      input.value = '';
      input.focus();
      
      // Add shake animation
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
      
      setTimeout(() => err.classList.add('hidden'), 3000);
    }
  }
  
  function unlockApp() {
    const lockScreen = document.getElementById('lock-screen');
    const adminApp = document.getElementById('admin-app');
    
    // Add fade out animation
    lockScreen.style.transition = 'opacity 0.3s ease';
    lockScreen.style.opacity = '0';
    
    setTimeout(() => {
      lockScreen.classList.add('hidden');
      lockScreen.style.opacity = '1'; // Reset for next time
      adminApp.classList.remove('hidden');
      
      // Add fade in animation for app
      adminApp.style.opacity = '0';
      adminApp.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        adminApp.style.opacity = '1';
      }, 50);
      
      bootApp();
      toast('✅ Welcome back! Dashboard unlocked successfully.', 'success');
    }, 300);
  }

  function lock() {
    if (!window.confirm('Lock the admin panel? You will need to re-enter your PIN.')) return;
    
    clearSession();
    
    const lockScreen = document.getElementById('lock-screen');
    const adminApp = document.getElementById('admin-app');
    
    // Add fade animation
    adminApp.style.transition = 'opacity 0.2s ease';
    adminApp.style.opacity = '0';
    
    setTimeout(() => {
      lockScreen.classList.remove('hidden');
      adminApp.classList.add('hidden');
      adminApp.style.opacity = '1'; // Reset
      document.getElementById('pin-input').value = '';
      
      // Focus PIN input
      setTimeout(() => document.getElementById('pin-input')?.focus(), 100);
    }, 200);
    
    toast('🔒 Dashboard locked. See you next time!', 'info');
  }

  /* ── DATA LOAD / SAVE ─────────────────────────────────── */
  async function load() {
    try {
      // Try to load from API first
      const response = await API.businesses.getAll();
      if (response.success && response.data) {
        businesses = response.data;
        
        // Cache in localStorage for offline access
        localStorage.setItem(KEYS.businesses, JSON.stringify(businesses));
      }
    } catch (error) {
      console.warn('Failed to load from API, using localStorage:', error);
      // Fallback to localStorage if API fails
      try {
        businesses = JSON.parse(localStorage.getItem(KEYS.businesses) || '[]');
      } catch(e) { 
        businesses = []; 
      }
    }
    
    activeId = localStorage.getItem(KEYS.active) || (businesses[0]?.id ?? null);
    if (businesses.length && !businesses.find(b => b.id === activeId)) {
      activeId = businesses[0].id;
    }
  }

  async function save() {
    // Save to localStorage immediately for responsiveness
    localStorage.setItem(KEYS.businesses, JSON.stringify(businesses));
    if (activeId) localStorage.setItem(KEYS.active, activeId);
  }

  function getActive() {
    return businesses.find(b => b.id === activeId) || businesses[0] || null;
  }

  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(KEYS.prefs) || '{}'); } catch(e) { return {}; }
  }

  /* ── NAVIGATION ───────────────────────────────────────── */
  function nav(view) {
    // update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    // update views
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });
    // update topbar title
    const titles = { overview:'Overview', businesses:'Businesses', qrcode:'QR Code', settings:'Settings', guide:'Setup Guide' };
    document.getElementById('topbar-title').textContent = titles[view] || 'Dashboard';

    // per-view refresh
    if (view === 'overview')    renderOverview();
    if (view === 'businesses')  renderBizList();
    if (view === 'qrcode')      renderQR();
    if (view === 'settings')    renderSettings();

    // close sidebar on mobile
    if (window.innerWidth <= 700) closeSidebar();
  }

  function bindNav() {
    // Remove the old inline onclick from sidebar-biz-switcher to avoid double-binding
  }

  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebarOpen = !sidebarOpen;
    sb.classList.toggle('open', sidebarOpen);
    overlay?.classList.toggle('active', sidebarOpen);
  }

  function closeSidebar() {
    sidebarOpen = false;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  }

  /* ── OVERVIEW ─────────────────────────────────────────── */
  function renderOverview() {
    const biz = getActive();
    document.getElementById('ov-biz-name').textContent = biz?.name || 'your business';
    updateStats();
    updateReviewUrlDisplay();
  }

  function updateStats() {
    const biz = getActive();
    if (!biz) {
      document.getElementById('stat-scans').textContent = '0';
      document.getElementById('stat-reviews').textContent = '0';
      document.getElementById('stat-shielded').textContent = '0';
      return;
    }

    // Try to load stats from API
    (async () => {
      try {
        const response = await API.stats.get(biz.id);
        if (response.success && response.data) {
          const stats = response.data;
          document.getElementById('stat-scans').textContent = stats.scans || 0;
          document.getElementById('stat-reviews').textContent = stats.reviews || 0;
          document.getElementById('stat-shielded').textContent = stats.shielded || 0;
        }
      } catch (error) {
        console.warn('Failed to load stats from API, using localStorage:', error);
        // Fallback to localStorage
        const getStat = (k) => parseInt(localStorage.getItem(KEYS.stat(biz.id, k)) || '0', 10);
        document.getElementById('stat-scans').textContent = getStat('scans');
        document.getElementById('stat-reviews').textContent = getStat('reviews');
        document.getElementById('stat-shielded').textContent = getStat('shielded');
      }
    })();
  }

  function updateReviewUrlDisplay() {
    const biz = getActive();
    const url = biz ? getReviewUrl(biz.id) : '';
    const el = document.getElementById('review-url-display');
    if (el) el.value = url;
  }

  function getReviewUrl(bizId) {
    // NEW: Use business ID only - customer page will fetch from API
    const base = location.origin + location.pathname.replace(/[^/]*$/, REVIEW_PAGE);
    return `${base}?businessId=${bizId}`;
  }

  /* ── BUSINESS LIST ────────────────────────────────────── */
  function renderBizList() {
    const list = document.getElementById('biz-list');
    if (!list) return;

    document.getElementById('nav-biz-count').textContent = businesses.length;
    document.getElementById('sidebar-biz-name').textContent = getActive()?.name || 'No business';

    if (businesses.length === 0) {
      list.innerHTML = '<p class="muted text-sm" style="padding:8px">No businesses yet. Add one using the form →</p>';
      return;
    }

    list.innerHTML = '';
    businesses.forEach(biz => {
      const item = document.createElement('div');
      item.className = `biz-list-item${biz.id === activeId ? ' current' : ''}`;
      item.innerHTML = `
        <div class="biz-list-avatar">${getAvatar(biz.type)}</div>
        <div class="biz-list-info">
          <div class="biz-list-name">${esc(biz.name)}</div>
          <div class="biz-list-type">${getCatLabel(biz.type)}</div>
        </div>
        ${biz.id === activeId ? '<span class="biz-list-badge active">Active</span>' : '<span class="biz-list-badge">Switch</span>'}
      `;
      item.addEventListener('click', () => {
        activeId = biz.id;
        save();
        loadBizToForm(biz);
        renderBizList();
        updateStats();
        updateReviewUrlDisplay();
        toast(`Switched to ${biz.name}`, 'info');
      });
      list.appendChild(item);
    });
  }

  /* ── BUSINESS FORM ────────────────────────────────────── */
  function showAddForm() {
    editingId = null;
    document.getElementById('form-card-title').textContent = 'Add New Business';
    document.getElementById('btn-delete-biz').style.display = 'none';
    document.getElementById('biz-form').reset();
    document.getElementById('form-error').classList.add('hidden');
    nav('businesses');
    setTimeout(() => document.getElementById('f-name')?.focus(), 100);
  }

  function loadBizToForm(biz) {
    editingId = biz.id;
    document.getElementById('form-card-title').textContent = 'Edit Business';
    document.getElementById('btn-delete-biz').style.display = '';
    document.getElementById('f-name').value      = biz.name    || '';
    document.getElementById('f-type').value      = biz.type    || 'general';
    document.getElementById('f-google-url').value = biz.googleUrl || '';
    document.getElementById('f-phone').value     = biz.phone   || '';
    document.getElementById('f-email').value     = biz.email   || '';
    document.getElementById('f-apikey').value    = biz.apiKey  || '';
    document.getElementById('form-error').classList.add('hidden');
  }

  function bindBizForm() {
    document.getElementById('biz-form')?.addEventListener('submit', e => {
      e.preventDefault();
      saveBusiness();
    });
  }

  function saveBusiness() {
    const name      = document.getElementById('f-name')?.value.trim();
    const type      = document.getElementById('f-type')?.value;
    const googleUrl = document.getElementById('f-google-url')?.value.trim();
    const phone     = document.getElementById('f-phone')?.value.trim();
    const email     = document.getElementById('f-email')?.value.trim();
    const apiKey    = document.getElementById('f-apikey')?.value.trim();

    // Validate
    const errEl = document.getElementById('form-error');
    const errMsg= document.getElementById('form-error-msg');
    if (!name) {
      errMsg.textContent = 'Business name is required.';
      errEl.classList.remove('hidden');
      document.getElementById('f-name')?.focus();
      return;
    }
    if (!googleUrl || !googleUrl.startsWith('http')) {
      errMsg.textContent = 'Please enter a valid Google Review URL (must start with https://).';
      errEl.classList.remove('hidden');
      document.getElementById('f-google-url')?.focus();
      return;
    }
    // Validate WhatsApp number format if provided
    if (phone && phone.length > 0) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errMsg.textContent = 'WhatsApp number must be 10-15 digits. Include country code (e.g., +919876543210).';
        errEl.classList.remove('hidden');
        document.getElementById('f-phone')?.focus();
        return;
      }
      // Check if it starts with + or digit
      if (!phone.match(/^[\+\d]/)) {
        errMsg.textContent = 'WhatsApp number must start with + or a digit (e.g., +919876543210).';
        errEl.classList.remove('hidden');
        document.getElementById('f-phone')?.focus();
        return;
      }
    }
    errEl.classList.add('hidden');

    const btn = document.getElementById('btn-save-biz');
    btn.classList.add('loading');

    // Prepare business data
    const data = { 
      name, 
      type, 
      googleUrl, 
      phone, 
      email, 
      apiKey: apiKey || '', // Gemini API key
      avatar: getAvatar(type)
    };

    // Save to API
    (async () => {
      try {
        let result;
        
        if (editingId) {
          // Update existing business
          result = await API.businesses.update(editingId, data);
          const idx = businesses.findIndex(b => b.id === editingId);
          if (idx !== -1) {
            businesses[idx] = result.data;
          }
          toast(`Business "${name}" updated successfully!`, 'success');
        } else {
          // Create new business
          result = await API.businesses.create({ id: 'biz_' + Date.now(), ...data });
          businesses.push(result.data);
          activeId = result.data.id;
          editingId = result.data.id;
          
          // Update form to edit mode
          document.getElementById('form-card-title').textContent = 'Edit Business';
          document.getElementById('btn-delete-biz').style.display = '';
          
          toast(`Business "${name}" created successfully!`, 'success');
        }

        // Update localStorage cache
        save();
        
        // Refresh UI
        renderBizList();
        updateStats();
        updateReviewUrlDisplay();
        renderQR();
        
      } catch (error) {
        console.error('Save business error:', error);
        errMsg.textContent = `Failed to save: ${error.message}`;
        errEl.classList.remove('hidden');
        toast('Failed to save business. Please try again.', 'error');
      } finally {
        btn.classList.remove('loading');
      }
    })();
  }

  function deleteBusiness() {
    const biz = businesses.find(b => b.id === editingId);
    if (!biz) return;
    
    const confirmMsg = businesses.length === 1 
      ? `Delete "${biz.name}"? This is your only business. You can add a new one later.`
      : `Delete "${biz.name}"? This cannot be undone.`;
    
    if (!window.confirm(confirmMsg)) return;

    const btn = document.getElementById('btn-delete-biz');
    if (btn) btn.disabled = true;

    // Delete from API
    (async () => {
      try {
        await API.businesses.delete(editingId);
        
        // Delete local stats
        ['scans', 'reviews', 'shielded'].forEach(key => {
          localStorage.removeItem(KEYS.stat(editingId, key));
        });

        // Remove from local array
        businesses = businesses.filter(b => b.id !== editingId);
        
        // Set new active business or null
        if (activeId === editingId) {
          activeId = businesses[0]?.id || null;
        }
        
        editingId = null;
        save();

        // Reset form
        document.getElementById('form-card-title').textContent = 'Add New Business';
        document.getElementById('btn-delete-biz').style.display = 'none';
        document.getElementById('biz-form').reset();
        
        // Refresh UI
        renderBizList();
        renderQR();
        updateStats();
        updateReviewUrlDisplay();
        
        toast('Business deleted successfully.', 'success');
        
        // If no businesses left, show empty state
        if (businesses.length === 0) {
          nav('businesses');
        }
      } catch (error) {
        console.error('Delete business error:', error);
        toast(`Failed to delete: ${error.message}`, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    })();
  }

  /* ── QR CODE ──────────────────────────────────────────── */
  function renderQR() {
    const biz = getActive();
    const container = document.getElementById('qr-container');
    if (!container) return;

    // Clear previous QR
    container.innerHTML = '';
    qrInstance = null;

    if (!biz) {
      container.innerHTML = '<p style="color:#999;font-size:.82rem;padding:20px;text-align:center">Add a business to generate QR code</p>';
      document.getElementById('qr-biz-label').textContent = 'No business';
      document.getElementById('qr-url-label').textContent = '';
      return;
    }

    const url = getReviewUrl(biz.id);
    
    // Validate URL before generating QR
    if (!url || url.length < 10) {
      container.innerHTML = '<p style="color:#f44336;font-size:.82rem;padding:20px;text-align:center">⚠️ Invalid URL. Please check business configuration.</p>';
      return;
    }

    document.getElementById('qr-biz-label').textContent = biz.name;
    document.getElementById('qr-url-label').textContent  = url;

    try {
      if (typeof QRCode !== 'undefined') {
        qrInstance = new QRCode(container, {
          text: url, 
          width: 220, 
          height: 220,
          colorDark: '#000', 
          colorLight: '#fff',
          correctLevel: QRCode.CorrectLevel.H  // High error correction for better scanning
        });
        
        console.log('QR Code generated successfully:', { 
          businessId: biz.id, 
          businessName: biz.name,
          urlLength: url.length 
        });
      } else {
        container.innerHTML = '<p style="color:#f44336;font-size:.82rem;padding:20px;text-align:center">⚠️ QR library not loaded. Please refresh the page.</p>';
      }
    } catch (error) {
      console.error('QR generation error:', error);
      container.innerHTML = '<p style="color:#f44336;font-size:.82rem;padding:20px;text-align:center">⚠️ Failed to generate QR code. Please try again.</p>';
    }
  }

  function downloadQR() {
    const biz = getActive();
    if (!biz) { 
      toast('No active business to download QR for.', 'error'); 
      return; 
    }

    try {
      // Try canvas first (higher quality), fall back to img
      const canvas = document.querySelector('#qr-container canvas');
      const img    = document.querySelector('#qr-container img');

      let dataUrl;
      if (canvas) {
        dataUrl = canvas.toDataURL('image/png');
      } else if (img && img.src) {
        dataUrl = img.src;
      } else {
        toast('QR code not ready yet. Please wait and try again.', 'error');
        return;
      }

      // Validate data URL
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        toast('Invalid QR code data. Please regenerate.', 'error');
        return;
      }

      const name = biz.name.replace(/[^a-zA-Z0-9]/g, '_') || 'QR';
      const timestamp = new Date().toISOString().split('T')[0];
      const a = Object.assign(document.createElement('a'), {
        href: dataUrl,
        download: `${name}_QR_${timestamp}.png`
      });
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast('QR code downloaded successfully!', 'success');
      console.log('QR downloaded:', { business: biz.name, filename: a.download });
    } catch (error) {
      console.error('QR download error:', error);
      toast('Failed to download QR code. Please try again.', 'error');
    }
  }

  function copyReviewLink() {
    const biz = getActive();
    if (!biz) { 
      toast('No active business.', 'error'); 
      return; 
    }
    
    try {
      const url = getReviewUrl(biz.id);
      
      if (!url || url.length < 10) {
        toast('Invalid review URL. Please check business configuration.', 'error');
        return;
      }
      
      copyText(url);
      toast('Review link copied to clipboard!', 'success');
      console.log('Review link copied:', { businessId: biz.id, url });
    } catch (error) {
      console.error('Copy link error:', error);
      toast('Failed to copy link. Please try again.', 'error');
    }
  }

  function testReviewLink() {
    const biz = getActive();
    if (!biz) { 
      toast('No active business.', 'error'); 
      return; 
    }
    
    try {
      const url = getReviewUrl(biz.id);
      
      if (!url || url.length < 10) {
        toast('Invalid review URL. Please check business configuration.', 'error');
        return;
      }
      
      window.open(url, '_blank', 'noopener,noreferrer');
      console.log('Testing review link:', { businessId: biz.id, url });
    } catch (error) {
      console.error('Test link error:', error);
      toast('Failed to open test link. Please try again.', 'error');
    }
  }

  /* ── SETTINGS ─────────────────────────────────────────── */
  function renderSettings() {
    const prefs = getPrefs();
    const vCode = document.getElementById('s-voucher-code');
    const vText = document.getElementById('s-voucher-text');
    if (vCode) vCode.value = prefs.voucherCode || 'CARE15';
    if (vText) vText.value = prefs.voucherText || '15% off your next visit';
  }

  function bindSettings() {
    // Settings loaded on nav
  }

  function changePIN() {
    const curr       = document.getElementById('s-current-pin')?.value.trim();
    const newPin     = document.getElementById('s-new-pin')?.value.trim();
    const confirmPin = document.getElementById('s-confirm-pin')?.value.trim();
    const stored     = localStorage.getItem(KEYS.pin) || DEFAULT_PIN;
    const statusEl   = document.getElementById('pin-change-status');

    const show = (msg, type) => {
      statusEl.className = `alert alert-${type}`;
      statusEl.textContent = msg;
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 4000);
    };

    if (!curr)                   { show('Please enter your current PIN.', 'danger'); return; }
    if (!newPin)                 { show('Please enter a new PIN.', 'danger'); return; }
    if (!confirmPin)             { show('Please confirm your new PIN.', 'danger'); return; }
    if (curr !== stored)         { show('Current PIN is incorrect.', 'danger'); return; }
    if (newPin.length < 6)       { show('New PIN must be at least 6 characters.', 'danger'); return; }
    if (newPin === stored)       { show('New PIN must be different from current PIN.', 'danger'); return; }
    if (newPin !== confirmPin)   { show('New PIN and confirmation do not match.', 'danger'); return; }

    localStorage.setItem(KEYS.pin, newPin);
    document.getElementById('s-current-pin').value = '';
    document.getElementById('s-new-pin').value     = '';
    document.getElementById('s-confirm-pin').value = '';
    
    show('✅ PIN updated successfully! Use it on your next login.', 'success');
    
    // Create new session with updated credentials
    createSession();
  }

  function savePrefs() {
    const prefs = {
      voucherCode: document.getElementById('s-voucher-code')?.value.trim() || 'CARE15',
      voucherText: document.getElementById('s-voucher-text')?.value.trim() || '15% off your next visit',
    };
    localStorage.setItem(KEYS.prefs, JSON.stringify(prefs));
    toast('Preferences saved!', 'success');
  }

  function resetStats() {
    if (!window.confirm('Reset all analytics stats? This cannot be undone.')) return;
    businesses.forEach(biz => {
      ['scans','reviews','shielded'].forEach(k => {
        localStorage.removeItem(KEYS.stat(biz.id, k));
      });
    });
    updateStats();
    toast('Stats reset.', 'info');
  }

  function clearAllData() {
    if (!window.confirm('This will delete ALL businesses, settings, and data. Are you absolutely sure?')) return;
    if (!window.confirm('Last warning: all data will be permanently deleted.')) return;
    [KEYS.businesses, KEYS.active, KEYS.pin, KEYS.prefs].forEach(k => localStorage.removeItem(k));
    businesses.forEach(biz => {
      ['scans','reviews','shielded'].forEach(k => localStorage.removeItem(KEYS.stat(biz.id, k)));
    });
    toast('All data cleared. Refreshing…', 'info');
    setTimeout(() => location.reload(), 1500);
  }

  /* ── REFRESH ALL ──────────────────────────────────────── */
  function refreshAll() {
    document.getElementById('nav-biz-count').textContent  = businesses.length;
    document.getElementById('sidebar-biz-name').textContent = getActive()?.name || 'No business';
  }

  /* ── TOAST NOTIFICATIONS ──────────────────────────────── */
  function toast(msg, type = 'info') {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const icons = { success:'✅', error:'❌', info:'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = `${icons[type] || ''} ${msg}`;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(12px)';
      setTimeout(() => t.remove(), 250);
    }, 3200);
  }

  /* ── HELPERS ──────────────────────────────────────────── */
  async function copyText(text) {
    try {
      // Try modern clipboard API first (works on HTTPS and localhost)
      if (navigator.clipboard && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch(e) { /* fallback below */ }

    // Fallback for HTTP
    try {
      const ta = Object.assign(document.createElement('textarea'),
        { value: text, style: 'position:fixed;left:-9999px;opacity:0' });
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch(e) { /* silent */ }
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getAvatar(type) {
    return { restaurant:'🍽️', cafe:'☕', salon:'✂️', clinic:'🩺', gym:'🏋️', retail:'🛍️', hotel:'🏨', auto:'🚗' }[type] || '⭐';
  }

  function getCatLabel(type) {
    return { restaurant:'Restaurant & Dining', cafe:'Café & Bakery', salon:'Salon & Spa', clinic:'Healthcare Clinic', gym:'Gym & Fitness', retail:'Retail Store', hotel:'Hotel & Resort', auto:'Auto Service', general:'Local Business' }[type] || 'Local Business';
  }

  /* ── PUBLIC ───────────────────────────────────────────── */
  return {
    nav, lock, toggleSidebar,
    showAddForm, saveBusiness, deleteBusiness,
    renderQR, downloadQR, copyReviewLink, testReviewLink,
    changePIN, savePrefs, resetStats, clearAllData,
  };

})();
