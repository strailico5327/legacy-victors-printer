function loadSettings() {
    let theme = sessionStorage.getItem('theme');
    let themeManual = sessionStorage.getItem('themeManual');

    if (themeManual === 'true' && theme) {
        document.documentElement.setAttribute('theme', theme);
    } else {
        let hour = new Date().getHours();

        if (hour >= 6 && hour < 18) {
            document.documentElement.setAttribute('theme', 'light');
        } else {
            document.documentElement.setAttribute('theme', 'dark');
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