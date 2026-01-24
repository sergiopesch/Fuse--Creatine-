(() => {
    'use strict';

    const loginCard = document.getElementById('loginCard');
    const dataCard = document.getElementById('dataCard');
    const loginForm = document.getElementById('adminLogin');
    const tokenInput = document.getElementById('adminToken');
    const loginStatus = document.getElementById('loginStatus');
    const dataStatus = document.getElementById('dataStatus');
    const signupRows = document.getElementById('signupRows');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const signupCount = document.getElementById('signupCount');
    const lastUpdated = document.getElementById('lastUpdated');
    const emptyState = document.getElementById('emptyState');

    const TOKEN_KEY = 'fuse_admin_token';
    const PAGE_LIMIT = 50;

    const state = {
        token: '',
        cursor: null,
        hasMore: false,
        loading: false,
        total: 0,
    };

    const setStatus = (element, message, type) => {
        if (!element) return;
        element.textContent = message || '';
        element.classList.toggle('good', type === 'good');
    };

    const setEmptyState = (visible) => {
        if (!emptyState) return;
        emptyState.classList.toggle('hidden', !visible);
    };

    const updateSummary = () => {
        if (signupCount) signupCount.textContent = String(state.total);
        if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString('en-GB');
    };

    const resetTable = () => {
        if (signupRows) signupRows.innerHTML = '';
        state.total = 0;
        setEmptyState(false);
    };

    const formatDate = (value) => {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-GB');
    };

    const renderRows = (rows) => {
        if (!signupRows || !rows.length) return;
        const fragment = document.createDocumentFragment();
        rows.forEach((row) => {
            const tr = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = row.fullName || 'N/A';
            tr.appendChild(nameCell);

            const emailCell = document.createElement('td');
            emailCell.textContent = row.email || 'N/A';
            tr.appendChild(emailCell);

            const dateCell = document.createElement('td');
            dateCell.textContent = formatDate(row.signupDate || row.storedAt);
            tr.appendChild(dateCell);

            fragment.appendChild(tr);
        });
        signupRows.appendChild(fragment);
    };

    const toggleControls = (enabled) => {
        if (refreshBtn) refreshBtn.disabled = !enabled;
        if (signOutBtn) signOutBtn.disabled = !enabled;
    };

    const showLogin = (message) => {
        if (loginCard) loginCard.classList.remove('hidden');
        if (dataCard) dataCard.classList.add('hidden');
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        toggleControls(false);
        setStatus(loginStatus, message || '', '');
    };

    const showData = () => {
        if (loginCard) loginCard.classList.add('hidden');
        if (dataCard) dataCard.classList.remove('hidden');
        toggleControls(true);
    };

    const setToken = (token) => {
        state.token = token;
        sessionStorage.setItem(TOKEN_KEY, token);
    };

    const clearToken = () => {
        state.token = '';
        sessionStorage.removeItem(TOKEN_KEY);
    };

    const updatePagination = () => {
        if (!loadMoreBtn) return;
        loadMoreBtn.classList.toggle('hidden', !state.hasMore);
        loadMoreBtn.disabled = state.loading || !state.hasMore;
    };

    const fetchSignups = async ({ reset } = {}) => {
        if (state.loading) return;
        state.loading = true;
        setStatus(dataStatus, 'Loading signups...', '');
        if (refreshBtn) refreshBtn.disabled = true;

        if (reset) {
            state.cursor = null;
            state.hasMore = false;
            resetTable();
        }

        try {
            const url = new URL('/api/admin-signups', window.location.origin);
            url.searchParams.set('limit', String(PAGE_LIMIT));
            if (state.cursor) {
                url.searchParams.set('cursor', state.cursor);
            }

            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: `Bearer ${state.token}`,
                },
                cache: 'no-store',
            });

            if (response.status === 401) {
                clearToken();
                showLogin('Access denied. Please check your admin token.');
                return;
            }

            if (!response.ok) {
                throw new Error('Unable to load signups.');
            }

            const payload = await response.json();
            const signups = Array.isArray(payload.signups) ? payload.signups : [];

            renderRows(signups);
            state.total += signups.length;
            state.cursor = payload.cursor || null;
            state.hasMore = Boolean(payload.hasMore);
            updateSummary();
            updatePagination();
            setEmptyState(state.total === 0);
            setStatus(dataStatus, signups.length ? 'Loaded.' : 'No new signups.', 'good');
        } catch (error) {
            setStatus(dataStatus, error && error.message ? error.message : 'Unable to load signups.');
        } finally {
            state.loading = false;
            if (refreshBtn) refreshBtn.disabled = false;
            updatePagination();
        }
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        const token = tokenInput ? tokenInput.value.trim() : '';
        if (!token) {
            setStatus(loginStatus, 'Enter the admin token to continue.');
            return;
        }

        setToken(token);
        showData();
        setStatus(loginStatus, '');
        await fetchSignups({ reset: true });
    };

    const handleSignOut = () => {
        clearToken();
        if (tokenInput) tokenInput.value = '';
        resetTable();
        setStatus(dataStatus, '');
        showLogin('Signed out.');
    };

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => fetchSignups());
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchSignups({ reset: true }));
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }

    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    if (storedToken) {
        setToken(storedToken);
        showData();
        fetchSignups({ reset: true });
    } else {
        showLogin();
    }
})();
