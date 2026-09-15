#!/usr/bin/env python3
"""
OptoPupil - Dataset Inspection & Verification Script
Inspects the IRIS + PUPIL + EYE segmentation dataset for the ML workstream.
"""

import os
import sys
import json
from pathlib import Path
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt

DATASET_ROOT = Path("/Users/jyotish/Downloads/IRIS + PUPIL + EYE")
OUTPUT_DIR = Path(__file__).parent / "reports"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

VALID_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}

def inspect_split(split_name: str, split_dir: Path):
    img_dir = split_dir / "image"
    seg_dir = split_dir / "segmentation"
    
    if not img_dir.exists() or not seg_dir.exists():
        raise FileNotFoundError(f"Missing image or segmentation folder in {split_dir}")
        
    img_files = {f.name: f for f in img_dir.iterdir() if f.suffix.lower() in VALID_EXTENSIONS and not f.name.startswith(".")}
    seg_files = {f.name: f for f in seg_dir.iterdir() if f.suffix.lower() in VALID_EXTENSIONS and not f.name.startswith(".")}
    
    # Check 1-to-1 matching
    img_names = set(img_files.keys())
    seg_names = set(seg_files.keys())
    
    missing_in_seg = list(img_names - seg_names)
    missing_in_img = list(seg_names - img_names)
    common_names = sorted(list(img_names & seg_names))
    
    print(f"\n--- Split: {split_name.upper()} ---")
    print(f"Total images found: {len(img_names)}")
    print(f"Total masks found: {len(seg_names)}")
    print(f"Matched pairs: {len(common_names)}")
    if missing_in_seg:
        print(f"WARNING: Images missing masks ({len(missing_in_seg)}): {missing_in_seg[:5]}")
    if missing_in_img:
        print(f"WARNING: Masks missing images ({len(missing_in_img)}): {missing_in_img[:5]}")
        
    # Programmatic file analysis
    image_shapes = set()
    mask_shapes = set()
    mask_modes = set()
    image_modes = set()
    unique_mask_values = set()
    unique_rgb_colors = set()
    corrupted_files = []
    
    pixel_counts = {}
    
    for name in common_names:
        img_path = img_files[name]
        seg_path = seg_files[name]
        
        try:
            with Image.open(img_path) as img:
                img_arr = np.array(img)
                image_shapes.add(img_arr.shape)
                image_modes.add(img.mode)
        except Exception as e:
            corrupted_files.append({"file": str(img_path), "error": str(e)})
            continue
            
        try:
            with Image.open(seg_path) as seg:
                seg_arr = np.array(seg)
                mask_shapes.add(seg_arr.shape)
                mask_modes.add(seg.mode)
                
                if seg_arr.ndim == 2:
                    vals, counts = np.unique(seg_arr, return_counts=True)
                    for v, c in zip(vals, counts):
                        v_item = int(v)
                        unique_mask_values.add(v_item)
                        pixel_counts[v_item] = pixel_counts.get(v_item, 0) + int(c)
                elif seg_arr.ndim == 3:
                    # RGB mask
                    flat_rgb = seg_arr.reshape(-1, seg_arr.shape[-1])
                    unique_colors, counts = np.unique(flat_rgb, axis=0, return_counts=True)
                    for col, c in zip(unique_colors, counts):
                        col_tuple = tuple(int(x) for x in col)
                        unique_rgb_colors.add(col_tuple)
                        pixel_counts[col_tuple] = pixel_counts.get(col_tuple, 0) + int(c)
        except Exception as e:
            corrupted_files.append({"file": str(seg_path), "error": str(e)})
            continue
            
    total_pixels = sum(pixel_counts.values())
    pixel_distribution = {
        str(k): {
            "count": v,
            "percentage": round((v / total_pixels) * 100, 4) if total_pixels > 0 else 0
        }
        for k, v in pixel_counts.items()
    }
    
    return {
        "split": split_name,
        "total_images": len(img_names),
        "total_masks": len(seg_names),
        "matched_pairs": len(common_names),
        "missing_in_seg": missing_in_seg,
        "missing_in_img": missing_in_img,
        "image_shapes": [list(s) for s in image_shapes],
        "mask_shapes": [list(s) for s in mask_shapes],
        "image_modes": list(image_modes),
        "mask_modes": list(mask_modes),
        "unique_mask_values": sorted(list(unique_mask_values)),
        "unique_rgb_colors": [list(c) for c in unique_rgb_colors],
        "corrupted_files": corrupted_files,
        "pixel_distribution": pixel_distribution,
        "sample_files": [str(img_files[n]) for n in common_names[:10]]
    }


def generate_visualizations(train_dir: Path, output_path: Path, num_samples: int = 6):
    img_dir = train_dir / "image"
    seg_dir = train_dir / "segmentation"
    
    img_files = sorted([f for f in img_dir.iterdir() if f.suffix.lower() in VALID_EXTENSIONS and not f.name.startswith(".")])
    
    selected_indices = np.linspace(0, len(img_files) - 1, num_samples, dtype=int)
    
    fig, axes = plt.subplots(num_samples, 3, figsize=(12, num_samples * 3.5))
    plt.suptitle("OptoPupil Dataset Inspection: Image | Segmentation Mask | Overlay", fontsize=14, y=0.99)
    
    # Custom high-contrast clinical color palette for mask visualization
    # 0: Background (Dark), 1: Sclera/Eye (Sky Blue), 2: Iris (Cyan), 3: Pupil (Purple/Yellow)
    color_map = {
        0: [15, 23, 42],     # Slate-900 Background
        1: [56, 189, 248],   # Sky Blue Sclera
        2: [6, 182, 212],    # Cyan Iris
        3: [168, 85, 247],   # Purple Pupil
    }
    
    for row, idx in enumerate(selected_indices):
        img_file = img_files[idx]
        seg_file = seg_dir / img_file.name
        
        if not seg_file.exists():
            continue
            
        img = Image.open(img_file).convert("RGB")
        seg = Image.open(seg_file)
        
        img_arr = np.array(img)
        seg_arr = np.array(seg)
        
        # Build colored mask
        h, w = seg_arr.shape[:2]
        colored_mask = np.zeros((h, w, 3), dtype=np.uint8)
        
        if seg_arr.ndim == 2:
            for val, color in color_map.items():
                colored_mask[seg_arr == val] = color
            # If values are 0-255 grayscale (e.g. 0, 85, 170, 255)
            if seg_arr.max() > 10:
                unique_vals = np.unique(seg_arr)
                for i, uv in enumerate(unique_vals):
                    c = list(color_map.values())[i % len(color_map)]
                    colored_mask[seg_arr == uv] = c
        else:
            colored_mask = seg_arr[:, :, :3]
            
        # Create alpha blended overlay
        overlay = (img_arr * 0.55 + colored_mask * 0.45).astype(np.uint8)
        
        # Plot Image
        axes[row, 0].imshow(img_arr)
        axes[row, 0].set_title(f"Original ({img_file.name})", fontsize=10)
        axes[row, 0].axis("off")
        
        # Plot Mask
        axes[row, 1].imshow(colored_mask)
        axes[row, 1].set_title(f"Segmentation Mask (Shape: {seg_arr.shape})", fontsize=10)
        axes[row, 1].axis("off")
        
        # Plot Overlay
        axes[row, 2].imshow(overlay)
        axes[row, 2].set_title("Anatomical Overlay", fontsize=10)
        axes[row, 2].axis("off")
        
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\nVisualization saved successfully to: {output_path}")


def main():
    print(f"Inspecting dataset at: {DATASET_ROOT}")
    if not DATASET_ROOT.exists():
        print(f"ERROR: Dataset directory not found at {DATASET_ROOT}")
        sys.exit(1)
        
    train_report = inspect_split("train", DATASET_ROOT / "train")
    val_report = inspect_split("val", DATASET_ROOT / "val")
    
    # Save visualization
    vis_path = OUTPUT_DIR / "dataset_inspection_samples.png"
    generate_visualizations(DATASET_ROOT / "train", vis_path, num_samples=6)
    
    full_report = {
        "dataset_root": str(DATASET_ROOT),
        "train": train_report,
        "val": val_report,
        "summary": {
            "total_train_pairs": train_report["matched_pairs"],
            "total_val_pairs": val_report["matched_pairs"],
            "total_dataset_pairs": train_report["matched_pairs"] + val_report["matched_pairs"],
            "consistent_dimensions": len(train_report["image_shapes"]) == 1 and len(val_report["image_shapes"]) == 1,
            "corrupted_count": len(train_report["corrupted_files"]) + len(val_report["corrupted_files"]),
        }
    }
    
    json_path = OUTPUT_DIR / "dataset_inspection_report.json"
    with open(json_path, "w") as f:
        json.dump(full_report, f, indent=2)
        
    print(f"\nJSON report written to: {json_path}")
    print("\n=== DATASET SUMMARY ===")
    print(f"Total Training Pairs:   {train_report['matched_pairs']}")
    print(f"Total Validation Pairs: {val_report['matched_pairs']}")
    print(f"Total Dataset Pairs:    {train_report['matched_pairs'] + val_report['matched_pairs']}")
    print(f"Image Shapes:           {train_report['image_shapes']}")
    print(f"Mask Shapes:            {train_report['mask_shapes']}")
    print(f"Unique Mask Values:     {train_report['unique_mask_values']}")
    print(f"Unique RGB Colors:      {train_report['unique_rgb_colors']}")
    print(f"Pixel Distribution:     {json.dumps(train_report['pixel_distribution'], indent=2)}")

if __name__ == "__main__":
    main()
