// referral_portal/app.js

// State Management
let referrals = [];
let viewMode = 'grid'; // 'grid' or 'list'
let token = localStorage.getItem('referral_auth_token') || null;
let userEmail = localStorage.getItem('referral_auth_email') || null;
let isSignUpMode = false;

const API_BASE = '';

// DOM Elements
const referralsGridContainer = document.getElementById('referralsGridContainer');
const emptyStateEl = document.getElementById('emptyStateEl');
const referralModal = document.getElementById('referralModal');
const referralForm = document.getElementById('referralForm');
const modalTitleText = document.getElementById('modalTitleText');
const toastContainer = document.getElementById('toastContainer');
const btnGridView = document.getElementById('btnGridView');
const btnListView = document.getElementById('btnListView');

// Auth View Elements
const authView = document.getElementById('authView');
const mainDashboardView = document.getElementById('mainDashboardView');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const txtAuthEmail = document.getElementById('txtAuthEmail');
const txtAuthPassword = document.getElementById('txtAuthPassword');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const btnAuthToggle = document.getElementById('btnAuthToggle');
const authToggleText = document.getElementById('authToggleText');
const btnLogout = document.getElementById('btnLogout');

// Form Inputs
const txtReferralId = document.getElementById('txtReferralId');
const txtCompany = document.getElementById('txtCompany');
const txtEmployeeName = document.getElementById('txtEmployeeName');
const txtLinkedIn = document.getElementById('txtLinkedIn');
const txtJobLink = document.getElementById('txtJobLink');
const selStatus = document.getElementById('selStatus');
const selAppliedEmail = document.getElementById('selAppliedEmail');
const txtMessage = document.getElementById('txtMessage');

// Control Elements
const txtSearch = document.getElementById('txtSearch');
const selStatusFilter = document.getElementById('selStatusFilter');
const selCompanyFilter = document.getElementById('selCompanyFilter');
const btnNewReferral = document.getElementById('btnNewReferral');
const btnEmptyStateAdd = document.getElementById('btnEmptyStateAdd');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnFormCancel = document.getElementById('btnFormCancel');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const importFileInput = document.getElementById('importFileInput');

// Stats Elements
const statTotalCount = document.getElementById('statTotalCount');
const statCompaniesCount = document.getElementById('statCompaniesCount');
const statSecuredCount = document.getElementById('statSecuredCount');
const statReferredAppliedCount = document.getElementById('statReferredAppliedCount');
const statAppliedCount = document.getElementById('statAppliedCount');
const statInterviewingCount = document.getElementById('statInterviewingCount');
const statOffersCount = document.getElementById('statOffersCount');

// Status Details Mapping
const statusConfig = {
  contacted: { text: 'Contacted', class: 'contacted' },
  secured: { text: 'Secured', class: 'secured' },
  referred_applied: { text: 'Referred & Applied', class: 'referred-applied' },
  applied: { text: 'Applied', class: 'applied' },
  interviewing: { text: 'Interviewing', class: 'interviewing' },
  offer: { text: 'Offer Received', class: 'offer' },
  rejected: { text: 'Rejected', class: 'rejected' }
};

// ----------------------------------------------------
// Initialization
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Load view mode setting
  const storedMode = localStorage.getItem('referral_view_mode');
  if (storedMode) {
    viewMode = storedMode;
    if (viewMode === 'grid') {
      btnGridView.classList.add('active');
      btnListView.classList.remove('active');
      referralsGridContainer.classList.remove('list-view-mode');
    } else {
      btnGridView.classList.remove('active');
      btnListView.classList.add('active');
      referralsGridContainer.classList.add('list-view-mode');
    }
  }
  
  checkAuth();
});

// ----------------------------------------------------
// Authentication Flow
// ----------------------------------------------------
function checkAuth() {
  if (token) {
    authView.style.display = 'none';
    mainDashboardView.style.display = 'block';
    
    // Show authorized buttons in header
    btnLogout.style.display = 'inline-flex';
    btnExport.style.display = 'inline-flex';
    btnImport.style.display = 'inline-flex';
    btnNewReferral.style.display = 'inline-flex';
    
    // Fetch user referrals
    fetchReferrals();
  } else {
    authView.style.display = 'flex';
    mainDashboardView.style.display = 'none';
    
    // Hide authorized buttons in header
    btnLogout.style.display = 'none';
    btnExport.style.display = 'none';
    btnImport.style.display = 'none';
    btnNewReferral.style.display = 'none';
    
    referrals = [];
    updateUI();
  }
}

function handleAuthToggle() {
  isSignUpMode = !isSignUpMode;
  if (isSignUpMode) {
    authTitle.textContent = 'Create an Account';
    authSubtitle.textContent = 'Sign up to track and access your referrals on any device';
    btnAuthSubmit.textContent = 'Sign Up';
    authToggleText.textContent = 'Already have an account?';
    btnAuthToggle.textContent = 'Sign In';
  } else {
    authTitle.textContent = 'Sign In to Referral Tracker';
    authSubtitle.textContent = 'Enter your credentials to access your dashboard';
    btnAuthSubmit.textContent = 'Sign In';
    authToggleText.textContent = "Don't have an account?";
    btnAuthToggle.textContent = 'Sign Up';
  }
  txtAuthPassword.value = '';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = txtAuthEmail.value.trim();
  const password = txtAuthPassword.value;
  
  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  const endpoint = isSignUpMode ? '/api/auth/signup' : '/api/auth/login';
  btnAuthSubmit.disabled = true;
  btnAuthSubmit.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';
  
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    
    // Save Token & Email
    token = data.token;
    userEmail = data.email;
    localStorage.setItem('referral_auth_token', token);
    localStorage.setItem('referral_auth_email', userEmail);
    
    showToast(isSignUpMode ? 'Account created successfully!' : 'Signed in successfully!', 'success');
    
    // Reset forms
    authForm.reset();
    
    // Check for offline LocalStorage migration
    await migrateLocalData();
    
    checkAuth();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnAuthSubmit.disabled = false;
    btnAuthSubmit.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  }
}

function handleLogout() {
  token = null;
  userEmail = null;
  localStorage.removeItem('referral_auth_token');
  localStorage.removeItem('referral_auth_email');
  showToast('Logged out successfully', 'success');
  checkAuth();
}

// Migrate old client-only localStorage data to the new server database on first login
async function migrateLocalData() {
  const localData = localStorage.getItem('referral_tracker_data');
  if (!localData) return;
  
  try {
    const parsed = JSON.parse(localData);
    // Ignore seed data IDs and filter out empty arrays
    const toMigrate = parsed.filter(r => r.id && !r.id.startsWith('seed-'));
    
    if (toMigrate.length > 0) {
      const confirmSync = confirm(`We found ${toMigrate.length} offline referral records stored in this browser. Do you want to sync them to your cloud account?`);
      if (confirmSync) {
        const res = await fetch(API_BASE + '/api/referrals/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(toMigrate)
        });
        
        if (res.ok) {
          showToast('Offline referrals successfully synced!', 'success');
        } else {
          console.warn('Failed to migrate local data to server');
        }
      }
    }
    // Clean local client storage so it doesn't trigger prompt again
    localStorage.removeItem('referral_tracker_data');
  } catch (err) {
    console.error('Data migration error:', err);
  }
}

// ----------------------------------------------------
// API Client CRUD Actions
// ----------------------------------------------------
async function fetchReferrals() {
  try {
    const res = await fetch(API_BASE + '/api/referrals', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      return;
    }
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load referrals');
    }
    
    referrals = data;
    updateUI();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// Event Listeners Setup
// ----------------------------------------------------
function setupEventListeners() {
  // Auth Form Events
  authForm.addEventListener('submit', handleAuthSubmit);
  btnAuthToggle.addEventListener('click', handleAuthToggle);
  btnLogout.addEventListener('click', handleLogout);

  // Modal toggling
  btnNewReferral.addEventListener('click', () => openModal());
  btnEmptyStateAdd.addEventListener('click', () => openModal());
  btnCancelModal.addEventListener('click', closeModal);
  btnFormCancel.addEventListener('click', closeModal);
  
  // Form Submit
  referralForm.addEventListener('submit', handleFormSubmit);
  
  // Filters and Search
  txtSearch.addEventListener('input', debounce(updateUI, 200));
  selStatusFilter.addEventListener('change', updateUI);
  selCompanyFilter.addEventListener('change', updateUI);

  // View Mode Toggles
  btnGridView.addEventListener('click', () => setViewMode('grid'));
  btnListView.addEventListener('click', () => setViewMode('list'));
  
  // Import / Export
  btnExport.addEventListener('click', exportData);
  btnImport.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importData);
}

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('referral_view_mode', mode);
  
  if (mode === 'grid') {
    btnGridView.classList.add('active');
    btnListView.classList.remove('active');
    referralsGridContainer.classList.remove('list-view-mode');
  } else {
    btnGridView.classList.remove('active');
    btnListView.classList.add('active');
    referralsGridContainer.classList.add('list-view-mode');
  }
  
  updateUI();
}

// ----------------------------------------------------
// UI Renderers
// ----------------------------------------------------
function updateUI() {
  updateStats();
  populateCompanyFilter();
  renderReferralCards();
}

function updateStats() {
  statTotalCount.textContent = referrals.length;
  
  // Calculate unique companies
  const uniqueCompanies = new Set(referrals.map(r => r.company.trim().toLowerCase()));
  statCompaniesCount.textContent = uniqueCompanies.size;
  
  // Count by status
  const counts = {
    secured: 0,
    referred_applied: 0,
    applied: 0,
    interviewing: 0,
    offer: 0
  };
  
  referrals.forEach(r => {
    if (counts[r.status] !== undefined) {
      counts[r.status]++;
    }
  });
  
  statSecuredCount.textContent = counts.secured;
  statReferredAppliedCount.textContent = counts.referred_applied;
  statAppliedCount.textContent = counts.applied;
  statInterviewingCount.textContent = counts.interviewing;
  statOffersCount.textContent = counts.offer;
}

function populateCompanyFilter() {
  const currentSelection = selCompanyFilter.value;
  
  // Extract unique sorted companies
  const companies = Array.from(new Set(referrals.map(r => r.company.trim())))
    .sort((a, b) => a.localeCompare(b));
  
  // Reset and rebuild options
  selCompanyFilter.innerHTML = '<option value="">All Companies</option>';
  
  companies.forEach(company => {
    const option = document.createElement('option');
    option.value = company.toLowerCase();
    option.textContent = company;
    if (company.toLowerCase() === currentSelection.toLowerCase()) {
      option.selected = true;
    }
    selCompanyFilter.appendChild(option);
  });
}

function renderReferralCards() {
  // Clear the cards container and any list table that might exist
  const cards = document.querySelectorAll('.referral-card');
  cards.forEach(card => card.remove());
  
  const existingTable = document.querySelector('.table-responsive');
  if (existingTable) {
    existingTable.remove();
  }
  
  // Apply Search & Filters
  const searchQuery = txtSearch.value.trim().toLowerCase();
  const statusFilter = selStatusFilter.value;
  const companyFilter = selCompanyFilter.value;
  
  const filtered = referrals.filter(r => {
    const matchesSearch = !searchQuery || 
      r.company.toLowerCase().includes(searchQuery) ||
      r.name.toLowerCase().includes(searchQuery) ||
      r.message.toLowerCase().includes(searchQuery);
      
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesCompany = !companyFilter || r.company.toLowerCase() === companyFilter;
    
    return matchesSearch && matchesStatus && matchesCompany;
  });
  
  // Sort referrals by update time descending
  filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  if (filtered.length === 0) {
    emptyStateEl.style.display = 'flex';
    if (referrals.length > 0) {
      // Modify text for search/filter no results
      emptyStateEl.querySelector('h3').textContent = 'No matching referrals';
      emptyStateEl.querySelector('p').textContent = 'Adjust your search query or filter tags to find what you are looking for.';
      btnEmptyStateAdd.style.display = 'none';
    } else {
      emptyStateEl.querySelector('h3').textContent = 'No referrals tracked yet';
      emptyStateEl.querySelector('p').textContent = 'Start organizing your network. Click the button above to add your first employee referral.';
      btnEmptyStateAdd.style.display = 'inline-flex';
    }
  } else {
    emptyStateEl.style.display = 'none';
    
    if (viewMode === 'grid') {
      filtered.forEach(referral => {
        const card = createCardElement(referral);
        referralsGridContainer.appendChild(card);
      });
    } else {
      // Create and mount List Table layout
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'table-responsive';
      
      const table = document.createElement('table');
      table.className = 'referral-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Company</th>
            <th>Referrer</th>
            <th>Status</th>
            <th>Applied Email</th>
            <th>Referral Message</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="referralTableBody"></tbody>
      `;
      
      tableWrapper.appendChild(table);
      referralsGridContainer.appendChild(tableWrapper);
      
      const tbody = document.getElementById('referralTableBody');
      filtered.forEach(referral => {
        const row = createTableRowElement(referral);
        tbody.appendChild(row);
      });
    }
  }
}

function createCardElement(r) {
  const card = document.createElement('article');
  card.className = 'referral-card';
  card.dataset.id = r.id;
  
  const statusInfo = statusConfig[r.status] || { text: r.status, class: 'contacted' };
  const formattedDate = new Date(r.updatedAt).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  // Prepare LinkedIn link element
  const hasLinkedIn = r.linkedin && r.linkedin.trim() !== '';
  const linkedinButton = hasLinkedIn 
    ? `<a href="${escapeHTML(r.linkedin)}" target="_blank" rel="noopener noreferrer" class="card-btn" title="Visit LinkedIn Profile">
         <svg viewBox="0 0 24 24" fill="currentColor">
           <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
         </svg>
       </a>`
    : '';

  // Prepare Job Link element
  const hasJobLink = r.jobLink && r.jobLink.trim() !== '';
  const jobLinkButton = hasJobLink 
    ? `<a href="${escapeHTML(r.jobLink)}" target="_blank" rel="noopener noreferrer" class="card-btn" title="Open Job Posting">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
           <polyline points="15 3 21 3 21 9"></polyline>
           <line x1="10" y1="14" x2="21" y2="3"></line>
         </svg>
       </a>`
    : '';

  // Prepare Applied Email element
  const hasAppliedEmail = r.appliedEmail && r.appliedEmail.trim() !== '';
  const appliedEmailMarkup = hasAppliedEmail
    ? `<span class="applied-email-info" title="Applied via ${escapeHTML(r.appliedEmail)}">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-top:-2.5px; vertical-align:middle; margin-right:4px;">
           <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
           <polyline points="22,6 12,13 2,6"></polyline>
         </svg>${escapeHTML(r.appliedEmail)}
       </span>`
    : '';

  // Check if message requires clamping and a "Read More" button
  const needsReadMore = r.message.split('\n').length > 3 || r.message.length > 150;
  const readMoreBtnMarkup = needsReadMore 
    ? `<button class="btn-read-more" onclick="toggleMessageExpand('${r.id}', this)">Read More</button>`
    : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-company-info">
        <h3 class="company-name">${escapeHTML(r.company)}</h3>
        <span class="referrer-name">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-top:-2px;">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          ${escapeHTML(r.name)}
        </span>
        ${appliedEmailMarkup}
      </div>
      <span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>
    </div>
    
    <div class="card-message-box">
      <div class="message-label">
        <span>Referral Message</span>
        <button class="card-btn" style="width:24px; height:24px; border:none; background:transparent;" onclick="copyMessage('${r.id}', this)" title="Copy referral message">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
      <div class="message-content" id="msg-${r.id}">${escapeHTML(r.message)}</div>
      ${readMoreBtnMarkup}
    </div>
    
    <div class="card-actions">
      <span class="card-meta">Updated: ${formattedDate}</span>
      <div class="external-links">
        ${jobLinkButton}
        ${linkedinButton}
        <button class="card-btn btn-edit" title="Edit Referral details">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
        <button class="card-btn btn-delete" style="color: var(--status-rejected-text);" title="Delete Referral">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Attach specific action triggers
  card.querySelector('.btn-edit').addEventListener('click', () => openModal(r.id));
  card.querySelector('.btn-delete').addEventListener('click', () => handleDelete(r.id));
  
  return card;
}

function createTableRowElement(r) {
  const tr = document.createElement('tr');
  tr.dataset.id = r.id;
  
  const statusInfo = statusConfig[r.status] || { text: r.status, class: 'contacted' };
  const formattedDate = new Date(r.updatedAt).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric'
  });
  
  const hasLinkedIn = r.linkedin && r.linkedin.trim() !== '';
  const linkedinIcon = hasLinkedIn 
    ? `<a href="${escapeHTML(r.linkedin)}" target="_blank" rel="noopener noreferrer" style="color: var(--text-muted); margin-left: 6px;" title="LinkedIn Profile">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;">
           <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
         </svg>
       </a>`
    : '';

  const hasJobLink = r.jobLink && r.jobLink.trim() !== '';
  const jobLinkIcon = hasJobLink 
    ? `<a href="${escapeHTML(r.jobLink)}" target="_blank" rel="noopener noreferrer" style="color: var(--text-muted); margin-left: 6px;" title="Job Posting">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
           <polyline points="15 3 21 3 21 9"></polyline>
           <line x1="10" y1="14" x2="21" y2="3"></line>
         </svg>
       </a>`
    : '';

  tr.innerHTML = `
    <td class="col-company">${escapeHTML(r.company)} ${jobLinkIcon}</td>
    <td>
      <div class="col-referrer">
        <span class="ref-name">${escapeHTML(r.name)} ${linkedinIcon}</span>
      </div>
    </td>
    <td><span class="status-badge ${statusInfo.class}">${statusInfo.text}</span></td>
    <td class="col-email-text">${r.appliedEmail ? escapeHTML(r.appliedEmail) : '<span style="color: var(--text-muted); font-style: italic;">—</span>'}</td>
    <td>
      <div class="col-message-preview" onclick="copyMessage('${r.id}', this)" title="Click to copy message">
        ${escapeHTML(r.message)}
      </div>
    </td>
    <td style="color: var(--text-muted); font-size: 0.8rem;">${formattedDate}</td>
    <td>
      <div class="col-actions-wrapper">
        <button class="card-btn btn-edit-row" style="width: 26px; height: 26px;" title="Edit details">
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
        <button class="card-btn btn-delete-row" style="width: 26px; height: 26px; color: var(--status-rejected-text);" title="Delete">
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    </td>
  `;
  
  tr.querySelector('.btn-edit-row').addEventListener('click', () => openModal(r.id));
  tr.querySelector('.btn-delete-row').addEventListener('click', () => handleDelete(r.id));
  
  return tr;
}

window.toggleMessageExpand = function(id, btn) {
  const msgEl = document.getElementById(`msg-${id}`);
  if (!msgEl) return;
  
  const isExpanded = msgEl.classList.toggle('expanded');
  btn.textContent = isExpanded ? 'Show Less' : 'Read More';
};

// ----------------------------------------------------
// Form and Modal Actions
// ----------------------------------------------------
function openModal(id = null) {
  referralForm.reset();
  
  if (id) {
    const ref = referrals.find(r => r.id === id);
    if (ref) {
      txtReferralId.value = ref.id;
      txtCompany.value = ref.company;
      txtEmployeeName.value = ref.name;
      txtLinkedIn.value = ref.linkedin || '';
      txtJobLink.value = ref.jobLink || '';
      selStatus.value = ref.status;
      selAppliedEmail.value = ref.appliedEmail || '';
      txtMessage.value = ref.message;
      modalTitleText.textContent = 'Edit Referral Details';
    }
  } else {
    txtReferralId.value = '';
    modalTitleText.textContent = 'Add New Referral';
  }
  
  referralModal.classList.add('active');
  txtCompany.focus();
}

function closeModal() {
  referralModal.classList.remove('active');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = txtReferralId.value;
  const companyVal = txtCompany.value.trim();
  const nameVal = txtEmployeeName.value.trim();
  const linkedinVal = txtLinkedIn.value.trim();
  const jobLinkVal = txtJobLink.value.trim();
  const statusVal = selStatus.value;
  const appliedEmailVal = selAppliedEmail.value;
  const messageVal = txtMessage.value.trim();
  
  if (!companyVal || !nameVal || !messageVal) {
    showToast('Please fill out all required fields', 'error');
    return;
  }
  
  const payload = {
    company: companyVal,
    name: nameVal,
    linkedin: linkedinVal,
    jobLink: jobLinkVal,
    status: statusVal,
    appliedEmail: appliedEmailVal,
    message: messageVal
  };
  
  try {
    let res;
    if (id) {
      // Edit existing referral
      res = await fetch(`${API_BASE}/api/referrals/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } else {
      // Add new referral
      res = await fetch(`${API_BASE}/api/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    }
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save referral');
    }
    
    showToast(id ? 'Referral updated successfully!' : 'Referral added successfully!', 'success');
    closeModal();
    fetchReferrals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDelete(id) {
  const ref = referrals.find(r => r.id === id);
  if (!ref) return;
  
  if (confirm(`Are you sure you want to delete the referral from ${ref.name} at ${ref.company}?`)) {
    try {
      const res = await fetch(`${API_BASE}/api/referrals/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete referral');
      }
      
      showToast('Referral deleted successfully', 'success');
      fetchReferrals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------
window.copyMessage = function(id, btnElement) {
  const ref = referrals.find(r => r.id === id);
  if (!ref) return;
  
  navigator.clipboard.writeText(ref.message).then(() => {
    showToast('Message copied to clipboard!', 'success');
    
    // Simple micro-animation on copy button
    const svg = btnElement.querySelector('svg');
    if (svg) {
      svg.style.transform = 'scale(1.2)';
      svg.style.color = 'var(--status-offer-text)';
      
      setTimeout(() => {
        svg.style.transform = 'scale(1)';
        svg.style.color = '';
      }, 500);
    }
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showToast('Could not copy message automatically', 'error');
  });
};

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
  
  const iconMarkup = type === 'success' 
    ? `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`
    : `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;
    
  toast.innerHTML = `
    <span class="toast-icon">${iconMarkup}</span>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Slide in
  setTimeout(() => {
    toast.classList.add('active');
  }, 50);
  
  // Slide out and remove
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function exportData() {
  if (referrals.length === 0) {
    showToast('No referrals to export', 'error');
    return;
  }
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(referrals, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `referrals_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('JSON exported successfully!', 'success');
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      
      // Simple validation of structure
      if (Array.isArray(imported) && imported.every(item => item.company && item.name && item.message)) {
        if (confirm(`Do you want to upload ${imported.length} referrals from this backup?`)) {
          btnExport.disabled = true; // Temporary loading visual indicator
          
          const res = await fetch(API_BASE + '/api/referrals/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(imported)
          });
          
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to sync imported referrals');
          }
          
          showToast('Data imported successfully to cloud database!', 'success');
          fetchReferrals();
        }
      } else {
        showToast('Invalid file structure. Must contain company, name, and message details.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error parsing file. Ensure it is a valid JSON backup.', 'error');
      console.error(err);
    } finally {
      btnExport.disabled = false;
    }
  };
  reader.readAsText(file);
  // Reset file input value so same file can be uploaded again
  importFileInput.value = '';
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
