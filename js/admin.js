(() => {
    'use strict';

    // DOM Elements - Login
    const loginCard = document.getElementById('loginCard');
    const loginForm = document.getElementById('adminLogin');
    const tokenInput = document.getElementById('adminToken');
    const loginStatus = document.getElementById('loginStatus');

    // DOM Elements - Navigation
    const tabNav = document.getElementById('tabNav');
    const tabs = document.querySelectorAll('.tab');
    const analyticsCard = document.getElementById('analyticsCard');
    const dataCard = document.getElementById('dataCard');

    // DOM Elements - Data Table
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

    // DOM Elements - Analytics
    const metricTotal = document.getElementById('metricTotal');
    const metricTotalTrend = document.getElementById('metricTotalTrend');
    const metricToday = document.getElementById('metricToday');
    const metricTodayTrend = document.getElementById('metricTodayTrend');
    const metricWeek = document.getElementById('metricWeek');
    const metricWeekTrend = document.getElementById('metricWeekTrend');
    const metricConsent = document.getElementById('metricConsent');
    const metricConsentTrend = document.getElementById('metricConsentTrend');
    const statDailyAvg = document.getElementById('statDailyAvg');
    const statPeakDay = document.getElementById('statPeakDay');
    const statPeakCount = document.getElementById('statPeakCount');
    const statMonth = document.getElementById('statMonth');
    const statMonthGrowth = document.getElementById('statMonthGrowth');
    const statFirstDate = document.getElementById('statFirstDate');
    const statDaysActive = document.getElementById('statDaysActive');
    const interestLegend = document.getElementById('interestLegend');
    const hourlyHeatmap = document.getElementById('hourlyHeatmap');
    const chartRangeBtns = document.querySelectorAll('.chart-range-btn');

    const TOKEN_KEY = 'fuse_admin_token';
    const PAGE_LIMIT = 50;
    const MAX_LIMIT = 200;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Chart instances
    let trendChart = null;
    let interestChart = null;
    let currentChartRange = 7;

    // Chart colors
    const chartColors = {
        primary: '#ff3b30',
        primaryLight: 'rgba(255, 59, 48, 0.2)',
        blue: '#60a5fa',
        purple: '#a78bfa',
        green: '#4ade80',
        yellow: '#fbbf24',
        pink: '#f472b6',
        cyan: '#22d3d8',
        orange: '#fb923c',
        gray: '#6b7280',
    };

    const state = {
        token: '',
        cursor: null,
        hasMore: false,
        loading: false,
        total: 0,
        rows: [],
        allRows: [],
        filteredRows: [],
        filterEmail: '',
        filterKeyword: '',
        filterFrom: '',
        filterTo: '',
        activeTab: 'analytics',
    };

    // Utility Functions
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

    const formatDate = (value) => {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-GB');
    };

    const formatShortDate = (date) => {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const getDateKey = (date) => {
        return date.toISOString().split('T')[0];
    };

    const getDaysDiff = (date1, date2) => {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((date1 - date2) / oneDay));
    };

    const animateValue = (element, start, end, duration = 500) => {
        if (!element) return;
        const startTime = performance.now();
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (end - start) * easeOut);
            element.textContent = current.toLocaleString();
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        requestAnimationFrame(update);
    };

    // Tab Navigation
    const switchTab = (tabName) => {
        state.activeTab = tabName;
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        if (analyticsCard) analyticsCard.classList.toggle('hidden', tabName !== 'analytics');
        if (dataCard) dataCard.classList.toggle('hidden', tabName !== 'signups');
    };

    // Analytics Functions
    const computeAnalytics = () => {
        const rows = state.allRows;
        if (!rows.length) return null;

        const now = new Date();
        const today = getDateKey(now);
        const todayStart = new Date(today);

        // Get start of week (Monday)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        weekStart.setHours(0, 0, 0, 0);

        // Get start of month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get last week and last month for comparisons
        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(weekStart);

        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        // Yesterday for comparison
        const yesterday = new Date(todayStart);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = getDateKey(yesterday);

        // Process signups
        const dailyCounts = {};
        const hourlyCounts = Array(24).fill(0);
        const interestCounts = {};
        let todayCount = 0;
        let yesterdayCount = 0;
        let weekCount = 0;
        let lastWeekCount = 0;
        let monthCount = 0;
        let lastMonthCount = 0;
        let consentCount = 0;
        let firstSignup = null;
        let peakDay = null;
        let peakCount = 0;

        rows.forEach(row => {
            const dateValue = row.signupDate || row.storedAt;
            if (!dateValue) return;

            const date = new Date(dateValue);
            if (Number.isNaN(date.getTime())) return;

            const dateKey = getDateKey(date);
            const hour = date.getHours();

            // Daily counts
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;

            // Hourly counts
            hourlyCounts[hour]++;

            // Today
            if (dateKey === today) {
                todayCount++;
            }

            // Yesterday
            if (dateKey === yesterdayKey) {
                yesterdayCount++;
            }

            // This week
            if (date >= weekStart) {
                weekCount++;
            }

            // Last week
            if (date >= lastWeekStart && date < lastWeekEnd) {
                lastWeekCount++;
            }

            // This month
            if (date >= monthStart) {
                monthCount++;
            }

            // Last month
            if (date >= lastMonthStart && date <= lastMonthEnd) {
                lastMonthCount++;
            }

            // Consent
            if (row.consentToContact) {
                consentCount++;
            }

            // First signup
            if (!firstSignup || date < firstSignup) {
                firstSignup = date;
            }

            // Interest categories
            const interest = String(row.mainInterest || 'Other').toLowerCase().trim();
            const category = categorizeInterest(interest);
            interestCounts[category] = (interestCounts[category] || 0) + 1;
        });

        // Find peak day
        Object.entries(dailyCounts).forEach(([day, count]) => {
            if (count > peakCount) {
                peakCount = count;
                peakDay = day;
            }
        });

        // Calculate daily average
        const dayKeys = Object.keys(dailyCounts);
        const daysActive = dayKeys.length || 1;
        const dailyAvg = (rows.length / daysActive).toFixed(1);

        return {
            total: rows.length,
            todayCount,
            yesterdayCount,
            weekCount,
            lastWeekCount,
            monthCount,
            lastMonthCount,
            consentRate: rows.length ? Math.round((consentCount / rows.length) * 100) : 0,
            dailyAvg,
            peakDay,
            peakCount,
            firstSignup,
            daysActive,
            dailyCounts,
            hourlyCounts,
            interestCounts,
        };
    };

    const categorizeInterest = (interest) => {
        const categories = {
            'Strength Training': ['strength', 'powerlifting', 'weightlifting', 'lifting', 'squat', 'deadlift', 'bench', 'barbell'],
            'Bodybuilding': ['bodybuilding', 'muscle', 'hypertrophy', 'physique', 'aesthetic'],
            'CrossFit': ['crossfit', 'wod', 'functional'],
            'Cardio': ['cardio', 'running', 'cycling', 'hiit', 'endurance', 'marathon'],
            'Nutrition': ['nutrition', 'diet', 'meal', 'calories', 'macro', 'protein', 'supplement'],
            'Weight Loss': ['weight loss', 'fat loss', 'cutting', 'lean'],
            'General Fitness': ['fitness', 'health', 'wellness', 'exercise', 'workout', 'training'],
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(kw => interest.includes(kw))) {
                return category;
            }
        }
        return 'Other';
    };

    const updateAnalyticsDashboard = () => {
        const analytics = computeAnalytics();
        if (!analytics) {
            // No data - show empty state
            if (metricTotal) metricTotal.textContent = '0';
            if (metricToday) metricToday.textContent = '0';
            if (metricWeek) metricWeek.textContent = '0';
            if (metricConsent) metricConsent.textContent = '0%';
            return;
        }

        // Update main metrics with animation
        const oldTotal = parseInt(metricTotal?.textContent.replace(/,/g, '') || '0', 10);
        animateValue(metricTotal, oldTotal, analytics.total);

        if (metricToday) metricToday.textContent = analytics.todayCount.toLocaleString();
        if (metricWeek) metricWeek.textContent = analytics.weekCount.toLocaleString();
        if (metricConsent) metricConsent.textContent = `${analytics.consentRate}%`;

        // Update trends
        updateTrend(metricTotalTrend, analytics.weekCount, analytics.lastWeekCount, 'this week');
        updateTrend(metricTodayTrend, analytics.todayCount, analytics.yesterdayCount, 'vs yesterday');
        updateTrend(metricWeekTrend, analytics.weekCount, analytics.lastWeekCount, 'vs last week');

        if (metricConsentTrend) {
            metricConsentTrend.textContent = analytics.consentRate >= 80 ? 'Excellent' :
                                             analytics.consentRate >= 60 ? 'Good' : 'Needs attention';
            metricConsentTrend.classList.toggle('positive', analytics.consentRate >= 60);
        }

        // Update secondary stats
        if (statDailyAvg) statDailyAvg.textContent = analytics.dailyAvg;
        if (statPeakDay && analytics.peakDay) {
            const peakDate = new Date(analytics.peakDay);
            statPeakDay.textContent = formatShortDate(peakDate);
        }
        if (statPeakCount) statPeakCount.textContent = `${analytics.peakCount} signups`;

        if (statMonth) statMonth.textContent = analytics.monthCount.toLocaleString();
        if (statMonthGrowth) {
            const growth = analytics.lastMonthCount > 0
                ? Math.round(((analytics.monthCount - analytics.lastMonthCount) / analytics.lastMonthCount) * 100)
                : (analytics.monthCount > 0 ? 100 : 0);
            statMonthGrowth.textContent = `${growth >= 0 ? '+' : ''}${growth}% vs last month`;
            statMonthGrowth.classList.toggle('positive', growth >= 0);
            statMonthGrowth.classList.toggle('negative', growth < 0);
        }

        if (statFirstDate && analytics.firstSignup) {
            statFirstDate.textContent = formatShortDate(analytics.firstSignup);
        }
        if (statDaysActive) {
            statDaysActive.textContent = `${analytics.daysActive} days active`;
        }

        // Update charts
        updateTrendChart(analytics);
        updateInterestChart(analytics);
        updateHeatmap(analytics.hourlyCounts);
    };

    const updateTrend = (element, current, previous, label) => {
        if (!element) return;
        if (previous === 0 && current === 0) {
            element.textContent = '--';
            element.classList.remove('positive', 'negative');
            return;
        }

        const diff = current - previous;
        const percent = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0);
        const arrow = diff >= 0 ? '↑' : '↓';

        element.textContent = `${arrow} ${Math.abs(percent)}% ${label}`;
        element.classList.toggle('positive', diff >= 0);
        element.classList.toggle('negative', diff < 0);
    };

    // Chart Functions
    const initCharts = () => {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        // Configure Chart.js defaults
        Chart.defaults.color = '#a0a0a0';
        Chart.defaults.borderColor = '#242424';
        Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

        initTrendChart();
        initInterestChart();
    };

    const initTrendChart = () => {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Signups',
                    data: [],
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primaryLight,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: chartColors.primary,
                    pointBorderColor: chartColors.primary,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        titleColor: '#f5f5f5',
                        bodyColor: '#a0a0a0',
                        borderColor: '#242424',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: (items) => items[0]?.label || '',
                            label: (item) => `${item.raw} signup${item.raw !== 1 ? 's' : ''}`,
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                        },
                        ticks: {
                            maxRotation: 0,
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#1f1f1f',
                        },
                        ticks: {
                            stepSize: 1,
                            precision: 0,
                        }
                    }
                }
            }
        });
    };

    const initInterestChart = () => {
        const canvas = document.getElementById('interestChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        interestChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        chartColors.primary,
                        chartColors.blue,
                        chartColors.purple,
                        chartColors.green,
                        chartColors.yellow,
                        chartColors.pink,
                        chartColors.cyan,
                        chartColors.orange,
                    ],
                    borderWidth: 0,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        titleColor: '#f5f5f5',
                        bodyColor: '#a0a0a0',
                        borderColor: '#242424',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (item) => {
                                const total = item.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = Math.round((item.raw / total) * 100);
                                return `${item.label}: ${item.raw} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
    };

    const updateTrendChart = (analytics) => {
        if (!trendChart || !analytics) return;

        const { dailyCounts } = analytics;
        const days = currentChartRange === 'all' ? Object.keys(dailyCounts).length : currentChartRange;

        // Generate date labels for the range
        const labels = [];
        const data = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = getDateKey(date);
            labels.push(formatShortDate(date));
            data.push(dailyCounts[dateKey] || 0);
        }

        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = data;
        trendChart.update('none');
    };

    const updateInterestChart = (analytics) => {
        if (!interestChart || !analytics) return;

        const { interestCounts } = analytics;

        // Sort by count and take top 8
        const sorted = Object.entries(interestCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const labels = sorted.map(([cat]) => cat);
        const data = sorted.map(([, count]) => count);

        interestChart.data.labels = labels;
        interestChart.data.datasets[0].data = data;
        interestChart.update('none');

        // Update legend
        if (interestLegend) {
            const colors = interestChart.data.datasets[0].backgroundColor;
            interestLegend.innerHTML = sorted.map(([cat, count], i) => `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${colors[i]}"></span>
                    <span>${cat}</span>
                    <span class="legend-value">${count}</span>
                </div>
            `).join('');
        }
    };

    const updateHeatmap = (hourlyCounts) => {
        if (!hourlyHeatmap) return;

        const maxCount = Math.max(...hourlyCounts, 1);

        hourlyHeatmap.innerHTML = hourlyCounts.map((count, hour) => {
            const level = count === 0 ? 0 : Math.min(5, Math.ceil((count / maxCount) * 5));
            const hourLabel = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
            return `<div class="heatmap-cell" data-level="${level}" data-tooltip="${hourLabel}: ${count} signup${count !== 1 ? 's' : ''}"></div>`;
        }).join('');
    };

    // Data Table Functions
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
        if (tabNav) tabNav.classList.add('hidden');
        if (analyticsCard) analyticsCard.classList.add('hidden');
        if (dataCard) dataCard.classList.add('hidden');
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        toggleControls(false);
        updateUtilityButtons();
        setStatus(loginStatus, message || '', '');
    };

    const showData = () => {
        if (loginCard) loginCard.classList.add('hidden');
        if (tabNav) tabNav.classList.remove('hidden');

        // Show the active tab
        if (state.activeTab === 'analytics') {
            if (analyticsCard) analyticsCard.classList.remove('hidden');
            if (dataCard) dataCard.classList.add('hidden');
        } else {
            if (analyticsCard) analyticsCard.classList.add('hidden');
            if (dataCard) dataCard.classList.remove('hidden');
        }

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

    const fetchAllSignups = async () => {
        // Fetch all signups for analytics
        let allSignups = [];
        let cursor = null;
        let hasMore = true;

        while (hasMore) {
            try {
                const url = new URL('/api/admin-signups', window.location.origin);
                url.searchParams.set('limit', String(MAX_LIMIT));
                if (cursor) {
                    url.searchParams.set('cursor', cursor);
                }

                const response = await fetch(url.toString(), {
                    headers: {
                        Authorization: `Bearer ${state.token}`,
                    },
                    cache: 'no-store',
                });

                if (!response.ok) break;

                const payload = await response.json();
                const signups = Array.isArray(payload.signups) ? payload.signups : [];
                allSignups = allSignups.concat(signups);
                cursor = payload.cursor || null;
                hasMore = Boolean(payload.hasMore);
            } catch {
                break;
            }
        }

        state.allRows = allSignups;
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

            // If this is initial load, fetch all signups for analytics
            if (reset) {
                await fetchAllSignups();
                initCharts();
                updateAnalyticsDashboard();
            }
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
        state.allRows = [];
        resetTable();
        setStatus(dataStatus, '');

        // Destroy charts
        if (trendChart) {
            trendChart.destroy();
            trendChart = null;
        }
        if (interestChart) {
            interestChart.destroy();
            interestChart = null;
        }

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
        } catch {
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

    // Event Listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => fetchSignups());
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await fetchSignups({ reset: true });
        });
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

    // Tab navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // Chart range controls
    chartRangeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chartRangeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartRange = btn.dataset.range === 'all' ? 'all' : parseInt(btn.dataset.range, 10);
            const analytics = computeAnalytics();
            if (analytics) {
                updateTrendChart(analytics);
            }
        });
    });

    // Initialize
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    if (storedToken) {
        setToken(storedToken);
        showData();
        fetchSignups({ reset: true });
    } else {
        showLogin();
    }
})();
