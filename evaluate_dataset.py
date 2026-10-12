"""
Evaluate RT-DETR on the local Traffic Analysis Dataset
Calculates Precision, Recall, F1-Score, and Detection Accuracy
"""

import os
import glob
from pathlib import Path
import cv2
import numpy as np
import torch
from PIL import Image
from transformers import RTDetrForObjectDetection, RTDetrImageProcessor

DATASET_DIR = Path(r"C:\Users\moinm\Downloads\archive (6)\traffic_analysis_yolov8_dataset")
MODEL_DIR = Path("./rtdetr_model")

# Dataset class names
DATASET_CLASSES = {
    0: "bike",
    1: "bus",
    2: "car",
    3: "cart",
    4: "person",
    5: "rickshaw",
    6: "suzuki",
    7: "truck",
    8: "van"
}

# Map RT-DETR COCO classes to dataset general vehicle categories
COCO_TO_DATASET = {
    "car": ["car", "suzuki", "van"],
    "bus": ["bus"],
    "truck": ["truck"],
    "motorbike": ["bike", "rickshaw"],
    "bicycle": ["bike", "cart"],
    "person": ["person"]
}

def load_ground_truth(label_path, img_w, img_h):
    """Load OBB/polygon or standard boxes and convert to [xmin, ymin, xmax, ymax]."""
    boxes = []
    classes = []
    if not os.path.exists(label_path):
        return boxes, classes

    with open(label_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            cls_id = int(parts[0])
            coords = [float(x) for x in parts[1:]]

            if len(coords) == 4:
                # [xc, yc, w, h] normalized
                xc, yc, w, h = coords
                xmin = (xc - w / 2) * img_w
                ymin = (yc - h / 2) * img_h
                xmax = (xc + w / 2) * img_w
                ymax = (yc + h / 2) * img_h
            elif len(coords) >= 8:
                # [x1, y1, x2, y2, x3, y3, x4, y4] normalized
                xs = coords[0::2]
                ys = coords[1::2]
                xmin = min(xs) * img_w
                xmax = max(xs) * img_w
                ymin = min(ys) * img_h
                ymax = max(ys) * img_h
            else:
                continue

            boxes.append([xmin, ymin, xmax, ymax])
            classes.append(DATASET_CLASSES.get(cls_id, "unknown"))

    return boxes, classes

def calculate_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxBArea = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])

    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou

def evaluate(split="valid", conf_threshold=0.35, iou_threshold=0.45):
    images_dir = DATASET_DIR / split / "images"
    labels_dir = DATASET_DIR / split / "labels"

    image_paths = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))
    print(f"Found {len(image_paths)} images in '{split}' set.")

    print(f"Loading RT-DETR from {MODEL_DIR}...")
    processor = RTDetrImageProcessor.from_pretrained(str(MODEL_DIR))
    model = RTDetrForObjectDetection.from_pretrained(str(MODEL_DIR))
    model.eval()

    total_tp = 0
    total_fp = 0
    total_fn = 0
    class_stats = {cls_name: {"tp": 0, "fp": 0, "fn": 0} for cls_name in DATASET_CLASSES.values()}

    for img_path in image_paths:
        label_path = labels_dir / f"{img_path.stem}.txt"
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]

        gt_boxes, gt_classes = load_ground_truth(label_path, w, h)

        # Inference
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)
        inputs = processor(images=pil_img, return_tensors="pt")

        with torch.no_grad():
            outputs = model(**inputs)

        results = processor.post_process_object_detection(
            outputs,
            target_sizes=torch.tensor([[h, w]]),
            threshold=conf_threshold
        )[0]

        pred_boxes = results["boxes"].numpy()
        pred_labels = results["labels"].numpy()

        matched_gt = set()

        for p_box, p_lbl in zip(pred_boxes, pred_labels):
            coco_name = model.config.id2label.get(int(p_lbl), "").lower()
            allowed_dataset_classes = COCO_TO_DATASET.get(coco_name, [])

            best_iou = 0
            best_gt_idx = -1

            for gt_idx, (g_box, g_cls) in enumerate(zip(gt_boxes, gt_classes)):
                if gt_idx in matched_gt:
                    continue
                if g_cls in allowed_dataset_classes:
                    iou = calculate_iou(p_box, g_box)
                    if iou > best_iou:
                        best_iou = iou
                        best_gt_idx = gt_idx

            if best_iou >= iou_threshold and best_gt_idx != -1:
                matched_gt.add(best_gt_idx)
                matched_cls = gt_classes[best_gt_idx]
                total_tp += 1
                class_stats[matched_cls]["tp"] += 1
            else:
                total_fp += 1

        for gt_idx, g_cls in enumerate(gt_classes):
            if gt_idx not in matched_gt:
                total_fn += 1
                if g_cls in class_stats:
                    class_stats[g_cls]["fn"] += 1

    precision = total_tp / (total_tp + total_fp + 1e-6)
    recall = total_tp / (total_tp + total_fn + 1e-6)
    f1 = 2 * (precision * recall) / (precision + recall + 1e-6)
    accuracy = total_tp / (total_tp + total_fp + total_fn + 1e-6)

    print("\n" + "="*50)
    print(f" EVALUATION SUMMARY ({split.upper()} SET)")
    print("="*50)
    print(f"Total Ground Truth Objects : {total_tp + total_fn}")
    print(f"True Positives (TP)        : {total_tp}")
    print(f"False Positives (FP)       : {total_fp}")
    print(f"False Negatives (FN)       : {total_fn}")
    print("-"*50)
    print(f"Detection Precision        : {precision * 100:.2f}%")
    print(f"Detection Recall           : {recall * 100:.2f}%")
    print(f"F1-Score                   : {f1 * 100:.2f}%")
    print(f"Overall Accuracy (IoU>0.45): {accuracy * 100:.2f}%")
    print("="*50)

    print("\nPer-Class Breakdown:")
    for cname, stats in class_stats.items():
        c_tp = stats["tp"]
        c_fn = stats["fn"]
        c_rec = (c_tp / (c_tp + c_fn + 1e-6)) * 100
        print(f"  - {cname:10s} : Detected {c_tp} / {c_tp + c_fn} (Recall: {c_rec:.1f}%)")

if __name__ == "__main__":
    evaluate(split="valid")
