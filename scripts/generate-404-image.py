#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["openai>=2.48.0", "pillow>=11.0.0"]
# ///

import argparse
import base64
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

from openai import OpenAI
from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_IMAGES = ROOT / "public/images"
TEMP_DIR = ROOT / "tmp/imagegen"
BACKGROUND_REFERENCE = ROOT / "tmp/立绘_缪尔赛思_2.png"
CHARACTER_REFERENCE = ROOT / "tmp/立绘_缪尔赛思_1.png"
LOGO_REFERENCE = ROOT / "tmp/Logo_莱茵生命.png"
CHROMA_HELPER = (
    Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    / "skills/.system/imagegen/scripts/remove_chroma_key.py"
)

BACKGROUND_MASTER = PUBLIC_IMAGES / "404-background.png"
BACKGROUND_VARIANTS = {
    1280: PUBLIC_IMAGES / "404-background-1280.webp",
    1920: PUBLIC_IMAGES / "404-background-1920.webp",
    3840: PUBLIC_IMAGES / "404-background-3840.webp",
}
CHARACTER_MASTER = PUBLIC_IMAGES / "404-character.png"
CHARACTER_VARIANTS = (768, 1024)
LOGO_OUTPUT = PUBLIC_IMAGES / "404-rhine-mark.png"
LEGACY_OUTPUT = PUBLIC_IMAGES / "404-muelsyse.png"

BACKGROUND_PROMPT = """
Create a clean 16:9 grayscale environmental background plate for a responsive
website 404 page. Use the input image only as the composition and visual
language reference. Preserve its sweeping circular water-and-wing formation,
mist, and sparse star points, but remove the character and all foreground
equipment completely. Render only charcoal, graphite, silver, black, and fog
gray. Keep the strongest detail inside a broad central safe zone so portrait
object-fit cover cropping remains intentional, while leaving both center-left
and center-right calm enough for separately overlaid text and a character.

Background only: no person, face, body, hand, umbrella, clothing, text,
numerals, logo, emblem, button, panel, watermark, signature, border, UI, or
glowing circular eye. Full bleed with no transparent gaps. Strict grayscale.
""".strip()

CHARACTER_PROMPT = """
Create one complete full-body Muelsyse character layer for a responsive website
404 page, using the input image as the strict identity, face, costume,
equipment, hair, and color reference. She faces the viewer with a gentle warm
smile. One hand holds exactly one closed umbrella vertically at her outer side,
fully visible from handle to tip. Her other arm extends toward the left with an
open palm facing upward, presenting content outside the image. Preserve her
pointed ears, very long gray-green hair, white translucent technical coat,
black dress, lime-green accents, boots, ID badge, and scientific accessories.

Use a tall portrait canvas with generous padding on every side. Show both shoes,
all hair tips, all equipment, and the entire umbrella. The background must be a
perfectly uniform solid #ff00ff chroma key with no shadow, gradient, texture,
reflection, floor plane, or halo. Do not use #ff00ff on the subject. Exactly one
character and one umbrella; no extra limbs or fingers, cropped parts, ground or
contact shadow, environment, water, wings, fog, text, numerals, logo, emblem,
watermark, signature, border, or UI.
""".strip()


def load_env(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Environment file not found: {path}")

    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(name, value)


def normalize_base_url(value: str) -> str:
    base_url = value.strip().rstrip("/")
    return base_url if base_url.endswith("/v1") else f"{base_url}/v1"


def image_bytes(result) -> bytes:
    if not result.data:
        raise RuntimeError("The image API returned no image data.")

    image = result.data[0]
    if image.b64_json:
        return base64.b64decode(image.b64_json)
    if image.url:
        with urlopen(image.url, timeout=180) as response:
            return response.read()
    raise RuntimeError("The image API returned neither b64_json nor a URL.")


def render_edit(client: OpenAI, reference: Path, prompt: str, size: str, output: Path) -> None:
    with reference.open("rb") as input_image:
        result = client.images.edit(
            model="gpt-image-2",
            image=[input_image],
            prompt=prompt,
            size=size,
            quality="high",
            output_format="png",
        )
    output.write_bytes(image_bytes(result))


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_width) // 2
    top = (resized.height - target_height) // 2
    return resized.crop((left, top, left + target_width, top + target_height))


def grayscale_background(source: Path, output: Path) -> None:
    with Image.open(source) as opened:
        image = opened.convert("RGB")
    image = fit_cover(image, (3840, 2160))
    image = image.convert("L").convert("RGB")
    image.save(output, "PNG", optimize=True)


def remove_chroma_key(source: Path, output: Path) -> None:
    if not CHROMA_HELPER.is_file():
        raise FileNotFoundError(f"Chroma-key helper not found: {CHROMA_HELPER}")
    subprocess.run(
        [
            sys.executable,
            str(CHROMA_HELPER),
            "--input",
            str(source),
            "--out",
            str(output),
            "--key-color",
            "#ff00ff",
            "--soft-matte",
            "--transparent-threshold",
            "12",
            "--opaque-threshold",
            "220",
            "--edge-contract",
            "1",
            "--edge-feather",
            "0.25",
            "--despill",
            "--force",
        ],
        check=True,
    )


def trim_character(source: Path, output: Path) -> None:
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError("The keyed character is fully transparent.")

    visible_width = bounds[2] - bounds[0]
    visible_height = bounds[3] - bounds[1]
    padding = max(24, round(max(visible_width, visible_height) * 0.03))
    crop = (
        max(0, bounds[0] - padding),
        max(0, bounds[1] - padding),
        min(image.width, bounds[2] + padding),
        min(image.height, bounds[3] + padding),
    )
    image.crop(crop).save(output, "PNG", optimize=True)


def validate_background(path: Path) -> None:
    with Image.open(path) as image:
        if image.size != (3840, 2160):
            raise RuntimeError(f"Background must be 3840x2160, got {image.size}.")
        red, green, blue = image.convert("RGB").split()
        if ImageChops.difference(red, green).getbbox() or ImageChops.difference(red, blue).getbbox():
            raise RuntimeError("Background is not strictly grayscale.")


def validate_character(path: Path) -> None:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    alpha = image.getchannel("A")
    corners = [
        alpha.getpixel((0, 0)),
        alpha.getpixel((image.width - 1, 0)),
        alpha.getpixel((0, image.height - 1)),
        alpha.getpixel((image.width - 1, image.height - 1)),
    ]
    if any(corners):
        raise RuntimeError("Character corners must be transparent.")

    histogram = alpha.histogram()
    visible_ratio = sum(histogram[1:]) / (image.width * image.height)
    if not 0.22 <= visible_ratio <= 0.78:
        raise RuntimeError(f"Character alpha coverage is implausible: {visible_ratio:.3f}.")

    edge_alpha = alpha.filter(ImageFilter.FIND_EDGES)
    edge_mask = edge_alpha.point(lambda value: 255 if value >= 16 else 0)
    rgb = image.convert("RGB")
    edge_count = 0
    magenta_count = 0
    for (red, green, blue), mask in zip(rgb.getdata(), edge_mask.getdata()):
        if not mask:
            continue
        edge_count += 1
        if mask and red > 170 and blue > 170 and green + 55 < min(red, blue):
            magenta_count += 1
    if edge_count and magenta_count / edge_count > 0.025:
        raise RuntimeError("Character has too much visible magenta edge spill.")


def write_background_variants(master: Path, directory: Path) -> None:
    with Image.open(master) as opened:
        image = opened.convert("RGB")
    for width, destination in BACKGROUND_VARIANTS.items():
        resized = image.resize((width, width * 9 // 16), Image.Resampling.LANCZOS)
        resized.save(directory / destination.name, "WEBP", quality=88, method=6)


def write_character_variants(master: Path, directory: Path) -> list[Path]:
    with Image.open(master) as opened:
        image = opened.convert("RGBA")
    widths = [*CHARACTER_VARIANTS]
    if image.width not in widths:
        widths.append(image.width)
    outputs = []
    for width in widths:
        scale = width / image.width
        resized = image.resize(
            (width, round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )
        output = directory / f"404-character-{width}.webp"
        resized.save(output, "WEBP", quality=92, method=6, lossless=False)
        outputs.append(output)
    return outputs


def make_logo(output: Path) -> None:
    with Image.open(LOGO_REFERENCE) as opened:
        image = opened.convert("RGBA")
    alpha = image.getchannel("A")
    upper = alpha.crop((0, 0, image.width, round(image.height * 0.69)))
    bounds = upper.getbbox()
    if bounds is None:
        raise RuntimeError("The Rhine mark source contains no visible pixels.")
    left, top, right, bottom = bounds
    padding = 12
    crop = (
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(round(image.height * 0.69), bottom + padding),
    )
    image.crop(crop).save(output, "PNG", optimize=True)


def publish(staged: dict[Path, Path], force: bool) -> None:
    conflicts = [destination for destination in staged if destination.exists()]
    if conflicts and not force:
        names = ", ".join(str(path) for path in conflicts)
        raise FileExistsError(f"Output already exists: {names} (use --force)")
    PUBLIC_IMAGES.mkdir(parents=True, exist_ok=True)
    for destination, source in staged.items():
        os.replace(source, destination)


def require_inputs(asset: str) -> None:
    required = [LOGO_REFERENCE]
    if asset in {"background", "all"}:
        required.append(BACKGROUND_REFERENCE)
    if asset in {"character", "all"}:
        required.append(CHARACTER_REFERENCE)
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing reference image(s): " + ", ".join(missing))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate layered Muelsyse 404 assets.")
    parser.add_argument("--asset", choices=["background", "character", "all"], default="all")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    require_inputs(args.asset)
    load_env(args.env_file)
    base_url = os.environ.get("OPENAI_IMAGE_BASE_URL", "")
    api_key = os.environ.get("OPENAI_IMAGE_API_KEY", "")
    if not base_url or not api_key:
        raise RuntimeError("OPENAI_IMAGE_BASE_URL and OPENAI_IMAGE_API_KEY are required in .env.")

    client = OpenAI(api_key=api_key, base_url=normalize_base_url(base_url))
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="404-assets-", dir=TEMP_DIR) as temp_name:
        temp = Path(temp_name)
        staged: dict[Path, Path] = {}

        if args.asset in {"background", "all"}:
            generated = temp / "background-generated.png"
            master = temp / BACKGROUND_MASTER.name
            print("Generating the gpt-image-2 background plate.")
            render_edit(client, BACKGROUND_REFERENCE, BACKGROUND_PROMPT, "3840x2160", generated)
            grayscale_background(generated, master)
            validate_background(master)
            write_background_variants(master, temp)
            staged[BACKGROUND_MASTER] = master
            for destination in BACKGROUND_VARIANTS.values():
                staged[destination] = temp / destination.name

        if args.asset in {"character", "all"}:
            chroma = temp / "character-magenta.png"
            keyed = temp / "character-keyed.png"
            master = temp / CHARACTER_MASTER.name
            print("Generating the gpt-image-2 chroma-key character plate.")
            render_edit(client, CHARACTER_REFERENCE, CHARACTER_PROMPT, "1536x2048", chroma)
            shutil.copy2(chroma, TEMP_DIR / "404-character-magenta.png")
            remove_chroma_key(chroma, keyed)
            trim_character(keyed, master)
            validate_character(master)
            variants = write_character_variants(master, temp)
            staged[CHARACTER_MASTER] = master
            for variant in variants:
                staged[PUBLIC_IMAGES / variant.name] = variant

        logo = temp / LOGO_OUTPUT.name
        make_logo(logo)
        staged[LOGO_OUTPUT] = logo
        publish(staged, args.force)

    if LEGACY_OUTPUT.exists():
        LEGACY_OUTPUT.unlink()
    print("Published layered 404 assets under public/images/.")


def publish_local_sources(background_source: Path, character_source: Path, force: bool) -> None:
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="404-assets-", dir=TEMP_DIR) as temp_name:
        temp = Path(temp_name)
        background = temp / BACKGROUND_MASTER.name
        character = temp / CHARACTER_MASTER.name
        logo = temp / LOGO_OUTPUT.name

        grayscale_background(background_source, background)
        validate_background(background)
        write_background_variants(background, temp)

        remove_chroma_key(character_source, temp / "character-keyed.png")
        trim_character(temp / "character-keyed.png", character)
        validate_character(character)
        character_variants = write_character_variants(character, temp)
        make_logo(logo)

        staged = {
            BACKGROUND_MASTER: background,
            CHARACTER_MASTER: character,
            LOGO_OUTPUT: logo,
        }
        staged.update({path: temp / path.name for path in BACKGROUND_VARIANTS.values()})
        staged.update({PUBLIC_IMAGES / path.name: path for path in character_variants})
        publish(staged, force)

    if LEGACY_OUTPUT.exists():
        LEGACY_OUTPUT.unlink()


if __name__ == "__main__":
    main()
