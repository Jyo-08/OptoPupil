# OptoPupil ML Workstream — Phase 1: Data Cleaning & Validation

## 1. Overview
This module contains the machine learning data pipeline, dataset cleaning scripts, quality validation tooling, and statistical audit reports for the **OptoPupil** neural pupil segmentation workstream.

---

## 2. Pipeline Scripts & Tooling

```
ml/
├── clean_dataset.py        # Master cleaning & audit pipeline (hashes, anomaly detection, leakage, clean dataset export)
├── validate_dataset.py     # Independent validation script verifying clean dataset compliance
├── inspect_dataset.py      # Dataset inspection and multi-panel overlay visualization generator
├── data/
│   └── cleaned/            # Verified clean dataset copy (Original preserved untouched)
│       ├── train/
│       │   ├── image/             # 1,000 Grayscale PNGs (640×480)
│       │   └── segmentation/      # 1,000 Single-channel integer masks (Classes 0, 1, 2, 3)
│       └── val/
│           ├── image/             # 275 Grayscale PNGs (640×480)
│           └── segmentation/      # 275 Single-channel integer masks (Classes 0, 1, 2, 3)
└── reports/
    ├── dataset_cleaning_report.md   # 16-section comprehensive audit report
    ├── dataset_cleaning_report.json # Structured machine-readable metrics & anomaly logs
    ├── dataset_inspection_report.json
    └── dataset_inspection_samples.png
```

---

## 3. Dataset Summary

- **Source Directory (Untouched)**: `/Users/jyotish/Downloads/IRIS + PUPIL + EYE`
- **Cleaned Dataset Directory**: `ml/data/cleaned/`
- **Total Training Pairs**: 1,000 images + 1,000 segmentation masks
- **Total Validation Pairs**: 275 images + 275 segmentation masks
- **Total Dataset Pairs**: 1,275 pairs (100% paired, 0 missing, 0 orphans)
- **Resolution**: 640 × 480 (Width × Height)
- **Image Mode**: 8-bit Grayscale (PIL mode `L`, numpy shape `(480, 640)`)
- **Mask Mode**: 8-bit Discrete Class Labels (PIL mode `L`, numpy shape `(480, 640)`)
- **Corrupted / Unreadable Files**: 0
- **Integrity Compliance**: 100.0%

---

## 4. Mask Class Encoding & Anatomical Mapping

| Class Value | Anatomical Region | Image Intensity Characteristics | Train % | Val % |
| :--- | :--- | :--- | :--- | :--- |
| **`0`** | **Background / Periocular Skin / Eyelids** | Outer surrounding region, medium-high intensity | 67.97% | 66.67% |
| **`1`** | **Sclera / Exposed Eye Region** | High intensity ocular opening flanking iris | 17.61% | 19.36% |
| **`2`** | **Pupil (Aperture)** | Centermost dark region ($\mu \approx 24\text{--}45$), circular geometry | 4.86% | 4.76% |
| **`3`** | **Iris (Stroma / Ciliary zone)** | Concentric ring surrounding pupil ($\mu \approx 80\text{--}110$) | 9.56% | 9.20% |

---

## 5. Quality Audit & Leakage Findings

1. **Non-Image Artifact Filtering**: Filtered 1 non-image Windows artifact (`desktop.ini`) in train folder.
2. **File & Mask Integrity**: 100% of images and masks are valid PNGs with matching $640 \times 480$ dimensions.
3. **Class Label Conformance**: All mask pixels belong strictly to $\{0, 1, 2, 3\}$. Zero invalid or continuous values.
4. **Duplicate Analysis**: 0 exact duplicate pairs found within train or val splits.
5. **Cross-Split Leakage Analysis**: 0 exact cross-split matches; 5 perceptual near-duplicate pairs (dHash Hamming $\le 2$) flagged and logged for tracking.
6. **Flagged for Manual Review**: 212 samples flagged for extreme boundary proximity or extreme pupil/iris area ratios (preserved in clean copy without deletion).

---

## 6. How to Run

### Execute Dataset Cleaning Pipeline:
```bash
python3 ml/clean_dataset.py
```

### Validate Cleaned Dataset Compliance:
```bash
python3 ml/validate_dataset.py
```

---

## 7. Next Phase: Model Architecture & Preprocessing (Phase 2)
The dataset is **READY FOR PREPROCESSING**. Phase 2 will implement PyTorch Dataset loaders, dynamic ROI cropping, contrast normalization, and model training (U-Net / SegFormer).
