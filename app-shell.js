window.AppShell = (() => {
    let currentUser = null;

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || 'Request failed.');
        }
        return data;
    }

    async function logout() {
        try {
            await fetchJson('/logout', { method: 'POST' });
        } finally {
            window.location.href = '/';
        }
    }

    function createNav(active) {
        const links = [
            { href: '/user-profile', label: 'Home', key: 'home' },
            { href: '/statistics', label: 'Statistics', key: 'statistics' },
            { href: '/scheduling', label: 'Scheduling', key: 'scheduling' },
            { href: '/arsenal', label: 'Arsenal', key: 'arsenal' },
            { href: '/contacts', label: 'Contacts', key: 'contacts' },
            { href: '/logging', label: 'Game Logging', key: 'logging' }
        ];

        return `
            <header class="app-nav">
                <div class="app-nav__brand">
                    <span class="eyebrow">Mount St. Mary's Bowling</span>
                    <strong>Bowling Hub</strong>
                </div>
                <nav class="app-nav__links">
                    ${links.map((link) => `<a class="app-nav__link ${active === link.key ? 'is-active' : ''}" href="${link.href}">${link.label}</a>`).join('')}
                </nav>
                <div class="app-nav__meta">
                    <span>${currentUser ? `${currentUser.name} (${currentUser.role})` : ''}</span>
                    <button class="secondary-button" type="button" onclick="AppShell.logout()">Sign Out</button>
                </div>
            </header>
        `;
    }

    async function init({ active, role } = {}) {
        let data;
        try {
            data = await fetchJson('/api/me');
        } catch (error) {
            window.location.href = '/';
            throw error;
        }

        currentUser = data.user;
        if (role && currentUser.role !== role && !(Array.isArray(role) && role.includes(currentUser.role))) {
            window.location.href = '/user-profile';
            return currentUser;
        }

        document.body.insertAdjacentHTML('afterbegin', createNav(active));

        return currentUser;
    }

    function getUser() {
        return currentUser;
    }

    return {
        init,
        getUser,
        fetchJson,
        logout
    };
})();
