#!/usr/bin/env python3
"""
OptoPupil ML — Cleaned Dataset Validation Script
Independently verifies the integrity, file formats, dimensions, and mask class labels
of the cleaned dataset in ml/data/cleaned/.
"""

import sys
from pathlib import Path
import numpy as np
from PIL import Image

CLEANED_ROOT = Path(__file__).parent / "data" / "cleaned"
EXPECTED_WIDTH = 640
EXPECTED_HEIGHT = 480
VALID_CLASSES = {0, 1, 2, 3}


def validate_split(split_name: str, split_dir: Path) -> bool:
    img_dir = split_dir / "image"
    seg_dir = split_dir / "segmentation"
    
    if not img_dir.exists():
        print(f"FAIL: Missing image directory at {img_dir}")
        return False
    if not seg_dir.exists():
        print(f"FAIL: Missing segmentation directory at {seg_dir}")
        return False
        
    img_files = {f.name: f for f in img_dir.iterdir() if not f.name.startswith(".")}
    seg_files = {f.name: f for f in seg_dir.iterdir() if not f.name.startswith(".")}
    
    img_names = set(img_files.keys())
    seg_names = set(seg_files.keys())
    
    missing_masks = list(img_names - seg_names)
    orphan_masks = list(seg_names - img_names)
    common_names = sorted(list(img_names & seg_names))
    
    print(f"\n--- Validating Split: {split_name.upper()} ---")
    print(f"Total Images: {len(img_names)}")
    print(f"Total Masks:  {len(seg_names)}")
    print(f"Matched Pairs:{len(common_names)}")
    
    if missing_masks:
        print(f"FAIL: {len(missing_masks)} images missing masks: {missing_masks[:5]}")
        return False
    if orphan_masks:
        print(f"FAIL: {len(orphan_masks)} orphan masks found: {orphan_masks[:5]}")
        return False
    if len(common_names) == 0:
        print("FAIL: No matched image/mask pairs found.")
        return False
        
    all_passed = True
    corrupted_count = 0
    dim_mismatch_count = 0
    invalid_val_count = 0
    
    for name in common_names:
        img_path = img_files[name]
        seg_path = seg_files[name]
        
        # 1. Validate Image
        try:
            with Image.open(img_path) as img:
                w, h = img.size
                if w != EXPECTED_WIDTH or h != EXPECTED_HEIGHT:
                    print(f"FAIL: Image {name} has abnormal dimensions ({w}x{h})")
                    dim_mismatch_count += 1
                    all_passed = False
        except Exception as e:
            print(f"FAIL: Cannot open image {name}: {e}")
            corrupted_count += 1
            all_passed = False
            
        # 2. Validate Mask
        try:
            with Image.open(seg_path) as seg:
                w, h = seg.size
                if w != EXPECTED_WIDTH or h != EXPECTED_HEIGHT:
                    print(f"FAIL: Mask {name} has abnormal dimensions ({w}x{h})")
                    dim_mismatch_count += 1
                    all_passed = False
                seg_arr = np.array(seg)
                if seg_arr.ndim != 2:
                    print(f"FAIL: Mask {name} is not 2D single-channel (ndim={seg_arr.ndim})")
                    all_passed = False
                unique_vals = set(np.unique(seg_arr).tolist())
                invalid_vals = unique_vals - VALID_CLASSES
                if invalid_vals:
                    print(f"FAIL: Mask {name} contains invalid classes: {invalid_vals}")
                    invalid_val_count += 1
                    all_passed = False
        except Exception as e:
            print(f"FAIL: Cannot open mask {name}: {e}")
            corrupted_count += 1
            all_passed = False

    if all_passed:
        print(f"PASS: All {len(common_names)} pairs in {split_name} are 100% valid.")
    else:
        print(f"FAIL: Issues encountered in {split_name} (Corrupted: {corrupted_count}, Dims: {dim_mismatch_count}, Invalid Values: {invalid_val_count})")
        
    return all_passed


def main():
    print("=== OPTOPUPIL ML — CLEANED DATASET VALIDATION ===")
    print(f"Target Directory: {CLEANED_ROOT}\n")
    
    if not CLEANED_ROOT.exists():
        print(f"FAIL: Cleaned dataset directory does not exist at {CLEANED_ROOT}")
        print("Please run python3 ml/clean_dataset.py first.")
        sys.exit(1)
        
    train_ok = validate_split("train", CLEANED_ROOT / "train")
    val_ok = validate_split("val", CLEANED_ROOT / "val")
    
    print("\n==========================================")
    if train_ok and val_ok:
        print("RESULT: ALL CLEANED DATASET CHECKS PASSED (100% COMPLIANT)")
        print("==========================================")
        sys.exit(0)
    else:
        print("RESULT: VALIDATION FAILED — ISSUES DETECTED")
        print("==========================================")
        sys.exit(1)


if __name__ == "__main__":
    main()
