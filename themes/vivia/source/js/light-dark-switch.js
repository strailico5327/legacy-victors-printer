function updateFavicon(theme) {
    const faviconTheme = theme === 'dark' ? 'dark' : 'light';

    document.querySelectorAll('link[rel="icon"][data-favicon-size]').forEach(icon => {
        const size = icon.getAttribute('data-favicon-size');
        icon.href = `/images/favicon-${faviconTheme}-${size}.png`;
    });
}

let themeFunc = async function() {
    let btn = document.getElementById("theme-btn");
    let root = document.documentElement;

    btn.addEventListener('click', e => {
        let theme = root.getAttribute('theme') == 'dark' ? 'light' : 'dark';

        root.setAttribute('theme', theme);
        updateFavicon(theme);

        sessionStorage.setItem('theme', theme);
        sessionStorage.setItem('themeManual', 'true');
    });
};
themeFunc();