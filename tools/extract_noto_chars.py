from pathlib import Path
from html.parser import HTMLParser

BLOG_ROOT = Path(r"X:\Blog\blog")
PUBLIC_DIR = BLOG_ROOT / "public"
OUT_FILE = BLOG_ROOT / "tools" / "noto-chars.txt"

# common chars used in blog posts, including English letters, digits, punctuation
SAFE_CHARS = """
abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZ
0123456789
 .,!?;:'"()[]{}<>/\\|-–—_+=*&%#$@~`^
，。！？；：“”‘’（）【】《》、·……￥
「」『』ー・
"""

class VisibleTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip_depth = 0
        self.text_parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "noscript", "svg"} and self.skip_depth > 0:
            self.skip_depth -= 1

    def handle_data(self, data):
        if self.skip_depth == 0:
            self.text_parts.append(data)

chars = set(SAFE_CHARS)

html_files = list(PUBLIC_DIR.rglob("*.html"))

if not html_files:
    raise SystemExit(f"No HTML files found in {PUBLIC_DIR}")

for html_file in html_files:
    parser = VisibleTextExtractor()
    text = html_file.read_text(encoding="utf-8", errors="ignore")
    parser.feed(text)

    for part in parser.text_parts:
        for char in part:
            # keep spaces and all non-space characters, but skip other whitespace like tabs and newlines
            if char == " " or not char.isspace():
                chars.add(char)

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
OUT_FILE.write_text("".join(sorted(chars)), encoding="utf-8")

print(f"Scanned HTML files: {len(html_files)}")
print(f"Unique characters: {len(chars)}")
print(f"Output: {OUT_FILE}")
