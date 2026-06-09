from pathlib import Path
import struct

assets = Path("assets")

inputs = [
    assets / "necomini-cyan_16x.ico",
    assets / "necomini-cyan_24x.ico",
    assets / "necomini-cyan_32x.ico",
    assets / "necomini-cyan_48x.ico",
    assets / "neco-cyan_64x.ico",
    assets / "neco-cyan_128x.ico",
    assets / "neco-cyan_256x.ico",
]

output = assets / "victors-archive.ico"

def read_first_icon(path: Path):
    data = path.read_bytes()

    if len(data) < 22:
        raise ValueError(f"{path} is too small to be a valid ICO file.")

    reserved, icon_type, count = struct.unpack_from("<HHH", data, 0)

    if reserved != 0 or icon_type != 1 or count < 1:
        raise ValueError(f"{path} is not a valid Windows ICO file.")

    width, height, colour_count, entry_reserved, planes, bit_count, size, offset = struct.unpack_from(
        "<BBBBHHII",
        data,
        6
    )

    image_data = data[offset:offset + size]

    if len(image_data) != size:
        raise ValueError(f"{path} has broken image data.")

    return {
        "width": width,
        "height": height,
        "colour_count": colour_count,
        "reserved": entry_reserved,
        "planes": planes or 1,
        "bit_count": bit_count or 32,
        "size": size,
        "data": image_data,
        "source": path,
    }

icons = []

for icon_path in inputs:
    if not icon_path.exists():
        raise FileNotFoundError(f"Missing file: {icon_path}")

    icons.append(read_first_icon(icon_path))

header = struct.pack("<HHH", 0, 1, len(icons))

entries = []
image_blobs = []
offset = 6 + 16 * len(icons)

for icon in icons:
    blob = icon["data"]

    entries.append(
        struct.pack(
            "<BBBBHHII",
            icon["width"],
            icon["height"],
            icon["colour_count"],
            0,
            icon["planes"],
            icon["bit_count"],
            len(blob),
            offset,
        )
    )

    image_blobs.append(blob)
    offset += len(blob)

output.write_bytes(header + b"".join(entries) + b"".join(image_blobs))

print(f"Created: {output}")
print("Included sizes:")
for icon in icons:
    width = 256 if icon["width"] == 0 else icon["width"]
    height = 256 if icon["height"] == 0 else icon["height"]
    print(f"- {width}x{height} from {icon['source'].name}")
