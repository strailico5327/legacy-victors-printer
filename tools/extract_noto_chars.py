from pathlib import Path

BLOG_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = BLOG_ROOT / "source"
OUT_FILE = BLOG_ROOT / "tools" / "noto-chars.txt"

TEXT_EXTENSIONS = {
    ".md",
    ".markdown",
    ".html",
    ".htm",
    ".txt",
    ".yml",
    ".yaml",
    ".json",
}

CJK_RANGES = (
    (0x2E80, 0x2EFF),
    (0x2F00, 0x2FDF),
    (0x3000, 0x303F),
    (0x3040, 0x309F),
    (0x30A0, 0x30FF),
    (0x31F0, 0x31FF),
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xAC00, 0xD7AF),
    (0xF900, 0xFAFF),
    (0xFF00, 0xFFEF),
    (0x20000, 0x2A6DF),
    (0x2A700, 0x2B73F),
    (0x2B740, 0x2B81F),
    (0x2B820, 0x2CEAF),
    (0x2CEB0, 0x2EBEF),
    (0x30000, 0x3134F),
)

def is_cjk(char):
    codepoint = ord(char)
    return any(start <= codepoint <= end for start, end in CJK_RANGES)

if not SOURCE_DIR.exists():
    raise SystemExit(f"source/ not found: {SOURCE_DIR}")

chars = set()
source_files = []

for source_file in SOURCE_DIR.rglob("*"):
    if not source_file.is_file():
        continue

    if source_file.suffix.lower() not in TEXT_EXTENSIONS:
        continue

    source_files.append(source_file)
    text = source_file.read_text(encoding="utf-8", errors="ignore")

    for char in text:
        if is_cjk(char):
            chars.add(char)

if not source_files:
    raise SystemExit(f"No source text files found in {SOURCE_DIR}")

if not chars:
    raise SystemExit(f"No CJK characters found in {SOURCE_DIR}")

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
OUT_FILE.write_text("".join(sorted(chars)), encoding="utf-8")

print(f"Scanned source text files: {len(source_files)}")
print(f"Unique CJK characters: {len(chars)}")
print(f"Output: {OUT_FILE}")