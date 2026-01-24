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
    const showingCount = document.getElementById('showingCount');
    const emptyState = document.getElementById('emptyState');
    const filterValue = document.getElementById('filterValue');
    const emailFilter = document.getElementById('emailFilter');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const interestFilter = document.getElementById('interestFilter');
    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');
    const applyLocalFiltersBtn = document.getElementById('applyLocalFiltersBtn');
    const clearLocalFiltersBtn = document.getElementById('clearLocalFiltersBtn');
    const copyEmailsBtn = document.getElementById('copyEmailsBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');

    const TOKEN_KEY = 'fuse_admin_token';
    const PAGE_LIMIT = 50;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const state = {
        token: '',
        cursor: null,
        hasMore: false,
        loading: false,
        total: 0,
        rows: [],
        filteredRows: [],
        filterEmail: '',
        filterKeyword: '',
        filterFrom: '',
        filterTo: '',
    };

    const setStatus = (element, message, type) => {
        if (!element) return;
        element.textContent = message || '';
        element.classList.toggle('good', type === 'good');
    };

    const parseDateInput = (value, endOfDay = false) => {
        if (!value) return null;
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return null;
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        }
        return date;
    };

    const hasActiveFilters = () => {
        return Boolean(state.filterEmail || state.filterKeyword || state.filterFrom || state.filterTo);
    };

    const getFilterSummary = () => {
        const parts = [];
        if (state.filterEmail) {
            parts.push(`Email: ${state.filterEmail}`);
        }
        if (state.filterKeyword) {
            parts.push(`Interest: "${state.filterKeyword}"`);
        }
        if (state.filterFrom || state.filterTo) {
            const from = state.filterFrom || 'Any';
            const to = state.filterTo || 'Any';
            parts.push(`Date: ${from}→${to}`);
        }
        return parts.length ? parts.join(' • ') : 'All';
    };

    const setEmptyState = (visible) => {
        if (!emptyState) return;
        if (visible) {
            emptyState.textContent = hasActiveFilters()
                ? 'No signups match these filters.'
                : 'No signups yet.';
        }
        emptyState.classList.toggle('hidden', !visible);
    };

    const updateSummary = () => {
        if (signupCount) signupCount.textContent = String(state.total);
        if (showingCount) showingCount.textContent = String(state.filteredRows.length);
        if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString('en-GB');
        if (filterValue) filterValue.textContent = getFilterSummary();
    };

    const resetTable = () => {
        if (signupRows) signupRows.innerHTML = '';
        state.total = 0;
        state.rows = [];
        state.filteredRows = [];
        setEmptyState(false);
    };

    const formatDate = (value) => {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-GB');
    };

    const renderRows = (rows) => {
        if (!signupRows) return;
        signupRows.innerHTML = '';
        if (!rows.length) return;
        const fragment = document.createDocumentFragment();
        rows.forEach((row) => {
            const tr = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = row.fullName || 'N/A';
            tr.appendChild(nameCell);

            const emailCell = document.createElement('td');
            emailCell.textContent = row.email || 'N/A';
            tr.appendChild(emailCell);

            const interestCell = document.createElement('td');
            interestCell.textContent = row.mainInterest || 'N/A';
            tr.appendChild(interestCell);

            const consentCell = document.createElement('td');
            const consentLabel = row.consentToContact ? 'Yes' : 'No';
            const consentVersion = row.policyVersion ? ` (${row.policyVersion})` : '';
            consentCell.textContent = `${consentLabel}${consentVersion}`;
            tr.appendChild(consentCell);

            const consentDateCell = document.createElement('td');
            consentDateCell.textContent = formatDate(row.consentTimestamp);
            tr.appendChild(consentDateCell);

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
        if (emailFilter) emailFilter.disabled = !enabled;
        if (interestFilter) interestFilter.disabled = !enabled;
        if (fromDateInput) fromDateInput.disabled = !enabled;
        if (toDateInput) toDateInput.disabled = !enabled;
    };

    const updateUtilityButtons = () => {
        const hasRows = state.filteredRows.length > 0;
        if (copyEmailsBtn) copyEmailsBtn.disabled = !hasRows;
        if (exportCsvBtn) exportCsvBtn.disabled = !hasRows;
    };

    const updateFilterControls = () => {
        const hasInput = Boolean(emailFilter && emailFilter.value.trim());
        const isFiltered = Boolean(state.filterEmail);
        if (applyFilterBtn) applyFilterBtn.disabled = !hasInput || state.loading;
        if (clearFilterBtn) clearFilterBtn.disabled = !isFiltered || state.loading;
        const hasLocalInput = Boolean(
            (interestFilter && interestFilter.value.trim()) ||
            (fromDateInput && fromDateInput.value) ||
            (toDateInput && toDateInput.value)
        );
        const isLocalFiltered = Boolean(state.filterKeyword || state.filterFrom || state.filterTo);
        if (applyLocalFiltersBtn) applyLocalFiltersBtn.disabled = !hasLocalInput || state.loading;
        if (clearLocalFiltersBtn) clearLocalFiltersBtn.disabled = !isLocalFiltered || state.loading;
    };

    const showLogin = (message) => {
        if (loginCard) loginCard.classList.remove('hidden');
        if (dataCard) dataCard.classList.add('hidden');
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        toggleControls(false);
        updateUtilityButtons();
        setStatus(loginStatus, message || '', '');
    };

    const showData = () => {
        if (loginCard) loginCard.classList.add('hidden');
        if (dataCard) dataCard.classList.remove('hidden');
        toggleControls(true);
        updateFilterControls();
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

    const recomputeRows = () => {
        const keyword = state.filterKeyword;
        const fromDate = parseDateInput(state.filterFrom);
        const toDate = parseDateInput(state.filterTo, true);

        const filtered = state.rows.filter((row) => {
            if (keyword) {
                const haystack = String(row.mainInterest || '').toLowerCase();
                if (!haystack.includes(keyword)) return false;
            }

            if (fromDate || toDate) {
                const dateValue = row.signupDate || row.storedAt;
                const parsed = dateValue ? new Date(dateValue) : null;
                if (!parsed || Number.isNaN(parsed.getTime())) return false;
                if (fromDate && parsed < fromDate) return false;
                if (toDate && parsed > toDate) return false;
            }

            return true;
        });

        state.filteredRows = filtered;
        state.total = state.rows.length;
        renderRows(filtered);
        updateSummary();
        updateUtilityButtons();
        setEmptyState(filtered.length === 0);
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
            if (state.filterEmail) {
                url.searchParams.set('email', state.filterEmail);
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

            state.rows = state.rows.concat(signups);
            state.cursor = payload.cursor || null;
            state.hasMore = Boolean(payload.hasMore);
            updatePagination();
            setStatus(dataStatus, signups.length ? 'Loaded.' : 'No new signups.', 'good');
            recomputeRows();
        } catch (error) {
            setStatus(dataStatus, error && error.message ? error.message : 'Unable to load signups.');
        } finally {
            state.loading = false;
            if (refreshBtn) refreshBtn.disabled = false;
            updatePagination();
            updateUtilityButtons();
            updateFilterControls();
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
        if (emailFilter) emailFilter.value = '';
        if (interestFilter) interestFilter.value = '';
        if (fromDateInput) fromDateInput.value = '';
        if (toDateInput) toDateInput.value = '';
        state.filterEmail = '';
        state.filterKeyword = '';
        state.filterFrom = '';
        state.filterTo = '';
        resetTable();
        setStatus(dataStatus, '');
        showLogin('Signed out.');
    };

    const applyFilter = () => {
        if (!emailFilter) return;
        const value = emailFilter.value.trim().toLowerCase();
        if (value && !emailRegex.test(value)) {
            setStatus(dataStatus, 'Enter a valid email address to filter.');
            return;
        }
        state.filterEmail = value;
        updateSummary();
        fetchSignups({ reset: true });
        updateFilterControls();
    };

    const clearFilter = () => {
        if (emailFilter) emailFilter.value = '';
        state.filterEmail = '';
        updateSummary();
        fetchSignups({ reset: true });
        updateFilterControls();
    };

    const applyLocalFilters = () => {
        const keyword = interestFilter ? interestFilter.value.trim().toLowerCase() : '';
        const fromValue = fromDateInput ? fromDateInput.value : '';
        const toValue = toDateInput ? toDateInput.value : '';
        const fromDate = parseDateInput(fromValue);
        const toDate = parseDateInput(toValue, true);

        if (fromDate && toDate && fromDate > toDate) {
            setStatus(dataStatus, 'Date range is invalid.');
            return;
        }

        state.filterKeyword = keyword;
        state.filterFrom = fromValue;
        state.filterTo = toValue;

        updateSummary();
        recomputeRows();
        updateFilterControls();
    };

    const clearLocalFilters = () => {
        if (interestFilter) interestFilter.value = '';
        if (fromDateInput) fromDateInput.value = '';
        if (toDateInput) toDateInput.value = '';
        state.filterKeyword = '';
        state.filterFrom = '';
        state.filterTo = '';
        updateSummary();
        recomputeRows();
        updateFilterControls();
    };

    const copyEmails = async () => {
        const emails = Array.from(new Set(state.filteredRows.map((row) => row.email).filter(Boolean)));
        if (!emails.length) return;
        const text = emails.join('\n');

        try {
            await navigator.clipboard.writeText(text);
            setStatus(dataStatus, 'Emails copied to clipboard.', 'good');
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            setStatus(dataStatus, 'Emails copied to clipboard.', 'good');
        }
    };

    const escapeCsv = (value) => {
        const safe = String(value ?? '');
        if (/[",\n]/.test(safe)) {
            return `"${safe.replace(/"/g, '""')}"`;
        }
        return safe;
    };

    const exportCsv = () => {
        if (!state.filteredRows.length) return;
        const headers = [
            'Full Name',
            'Email',
            'Main Interest',
            'Consent',
            'Consent Timestamp',
            'Policy Version',
            'Signup Date',
            'Stored At',
        ];
        const rows = state.filteredRows.map((row) => [
            row.fullName,
            row.email,
            row.mainInterest,
            row.consentToContact ? 'Yes' : 'No',
            row.consentTimestamp,
            row.policyVersion,
            row.signupDate,
            row.storedAt,
        ]);
        const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `fuse-signups-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setStatus(dataStatus, 'CSV exported.', 'good');
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

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilter);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilter);
    }

    if (emailFilter) {
        emailFilter.addEventListener('input', updateFilterControls);
        emailFilter.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyFilter();
            }
        });
    }

    if (applyLocalFiltersBtn) {
        applyLocalFiltersBtn.addEventListener('click', applyLocalFilters);
    }

    if (clearLocalFiltersBtn) {
        clearLocalFiltersBtn.addEventListener('click', clearLocalFilters);
    }

    if (interestFilter) {
        interestFilter.addEventListener('input', updateFilterControls);
        interestFilter.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyLocalFilters();
            }
        });
    }

    if (fromDateInput) {
        fromDateInput.addEventListener('change', updateFilterControls);
    }

    if (toDateInput) {
        toDateInput.addEventListener('change', updateFilterControls);
    }

    if (copyEmailsBtn) {
        copyEmailsBtn.addEventListener('click', copyEmails);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportCsv);
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
