function updateFavicon(theme) {
    const faviconTheme = theme === 'dark' ? 'dark' : 'light';

    const update = function() {
        document.querySelectorAll('link[rel="icon"][data-favicon-size]').forEach(icon => {
            const size = icon.getAttribute('data-favicon-size');
            icon.setAttribute('href', `/images/favicon-${faviconTheme}-${size}.png`);
        });
    };

    update();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', update, { once: true });
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('theme', theme);
    updateFavicon(theme);
}

function loadSettings() {
    let theme = sessionStorage.getItem('theme');
    let themeManual = sessionStorage.getItem('themeManual');

    if (themeManual === 'true' && theme) {
        setTheme(theme);
    } else {
        let hour = new Date().getHours();

        if (hour >= 6 && hour < 18) {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    }

    let showBanner = localStorage.getItem("showBanner");
    if (showBanner == null || showBanner == undefined || showBanner == "true") {
        document.documentElement.setAttribute('showBanner', true)
    } else {
        document.documentElement.setAttribute('showBanner', false)
    }
};
loadSettings();