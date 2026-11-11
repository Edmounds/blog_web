"""Recheck the user-confirmed dedicated set against actual paired data and classifier crops."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import tarfile
import cv2
from verify_data import verify, ZONES

EXP = Path(__file__).resolve().parents[1]


def pixel_hash(path):
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(path)
    return hashlib.sha256(str(image.shape).encode() + image.tobytes()).hexdigest()


def image_names(directory):
    return {p.name for p in directory.iterdir() if p.is_file() and p.suffix.lower() in
            (".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff", ".dng", ".mpo", ".heic", ".pfm")}


def main():
    result = verify(write_result=False)
    manifest = json.loads((EXP / "manifest.json").read_text())
    external = [r for r in manifest if r["split"] == "external"]
    internal = [r for r in manifest if r["split"] != "external"]
    assert len(external) == 60 and sum(r["objects"] for r in external) == 91
    for mode in ("composite", "type"):
        for zone in ZONES:
            for split in ("train", "valid", "test"):
                expected = {Path(r["source_image"]).name for r in internal if r["zone"] == zone and r["split"] == split}
                assert image_names(EXP / "data" / mode / zone / split / "images") == expected
    crops = {}
    for r in internal:
        for index, (label, _) in enumerate(r["fine_boxes"]):
            crop = ZONES[r["zone"]][int(label) // 2]
            state = "ripe" if int(label) % 2 == 0 else "unripe"
            split = "val" if r["split"] == "valid" else r["split"]
            crops.setdefault((crop, split, state), set()).add(f"{Path(r['source_image']).stem}_crop{index}.png")
    for (crop, split, state), names in crops.items():
        assert image_names(EXP / "data/ripeness" / crop / split / state) == names
    internal_pixels = {pixel_hash(EXP / "data/composite" / r["zone"] / r["split"] / "images" / Path(r["source_image"]).name) for r in internal}
    external_pixels = {pixel_hash(EXP / "data/external" / r["zone"] / "images" / Path(r["source_image"]).name) for r in external}
    assert not internal_pixels & external_pixels
    package = json.loads((EXP / "package-audit.json").read_text())
    archive = EXP / package["file"]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == package["sha256"]
    with tarfile.open(archive) as tar:
        files = [m.name for m in tar.getmembers() if m.isfile()]
    assert not any("data/external/" in name for name in files)
    assert not {Path(r["source_image"]).name for r in external} & {Path(name).name for name in files}
    report = {"status": "passed", "user_confirmed_dedicated_set": True, "date": "2026-11-11",
              "directory": str(EXP / "data/external"), "images": 60, "targets": 91,
              "internal_split_counts": dict(Counter(r["split"] for r in internal)),
              "source_group_overlap": 0, "image_sha256_overlap": 0, "decoded_pixel_overlap": 0,
              "all_detector_directory_members_match_manifest": True,
              "all_classifier_crops_match_internal_source_targets": True,
              "training_package_sha256": package["sha256"], "dedicated_images_in_training_package": 0,
              "actual_file_verification": result,
              "scope": "This round's ten newly trained models; same-capture variants excluded by source group. Exact checks do not prove absence of every visually similar scene."}
    path = EXP / "evaluation_no_threshold_20261111/dedicated-set-isolation.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
