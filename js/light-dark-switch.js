let themeFunc = async function() {
    let btn = document.getElementById("theme-btn");
    let root = document.documentElement;
    btn.addEventListener('click', e => {
        if (root.getAttribute('theme') == 'dark') {
            root.setAttribute('theme', 'light');
            sessionStorage.setItem('theme', 'light');
            sessionStorage.setItem('themeManual', 'true');
        } else {
            root.setAttribute('theme', 'dark');
            sessionStorage.setItem('theme', 'dark');
            sessionStorage.setItem('themeManual', 'true');
        }
    });
};
themeFunc();

