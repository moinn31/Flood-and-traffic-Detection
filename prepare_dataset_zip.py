import os
import shutil
import zipfile
from pathlib import Path

SRC_DIR = Path(r"C:\Users\moinm\Downloads\archive (6)\traffic_analysis_yolov8_dataset")
OUT_DIR = Path(r"C:\Users\moinm\Downloads\traffic_dataset_clean")
ZIP_PATH = Path(r"C:\Users\moinm\Downloads\traffic_dataset_ready.zip")

print("Preparing clean dataset with standard 4-coordinate [class xc yc w h] format...")

if OUT_DIR.exists():
    shutil.rmtree(OUT_DIR)

for split in ["train", "valid", "test"]:
    img_src = SRC_DIR / split / "images"
    lbl_src = SRC_DIR / split / "labels"

    img_dst = OUT_DIR / split / "images"
    lbl_dst = OUT_DIR / split / "labels"
    img_dst.mkdir(parents=True, exist_ok=True)
    lbl_dst.mkdir(parents=True, exist_ok=True)

    # Copy images
    for img_file in img_src.glob("*.*"):
        shutil.copy2(img_file, img_dst / img_file.name)

    # Convert labels
    for lbl_file in lbl_src.glob("*.txt"):
        new_lines = []
        with open(lbl_file, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 5:
                    continue
                cls_id = parts[0]
                coords = [float(x) for x in parts[1:]]

                if len(coords) == 4:
                    xc, yc, w, h = coords
                elif len(coords) >= 8:
                    xs = coords[0::2]
                    ys = coords[1::2]
                    xmin, xmax = min(xs), max(xs)
                    ymin, ymax = min(ys), max(ys)
                    xc = (xmin + xmax) / 2.0
                    yc = (ymin + ymax) / 2.0
                    w = xmax - xmin
                    h = ymax - ymin
                else:
                    continue

                new_lines.append(f"{cls_id} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\n")

        with open(lbl_dst / lbl_file.name, "w") as f:
            f.writelines(new_lines)

# Write clean data.yaml
data_yaml_content = """path: ./traffic_dataset_clean
train: train/images
val: valid/images
test: test/images

names:
  0: Bike
  1: Bus
  2: Car
  3: Cart
  4: Person
  5: Rickshaw
  6: Suzuki
  7: Truck
  8: Van
"""
with open(OUT_DIR / "data.yaml", "w") as f:
    f.write(data_yaml_content)

print("Creating ZIP archive...")
with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(OUT_DIR):
        for file in files:
            full_path = Path(root) / file
            rel_path = full_path.relative_to(OUT_DIR)
            zipf.write(full_path, arcname=str(rel_path))

print(f"Dataset successfully packaged into: {ZIP_PATH} ({ZIP_PATH.stat().st_size / (1024*1024):.2f} MB)")
