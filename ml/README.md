# OptoPupil ML Workstream — Phase 2A: Dataset Preprocessing & Geometry Preservation

## 1. Overview
This directory houses the machine learning data pipeline, dataset cleaning audit, preprocessing transformations, PyTorch-compatible dataset loaders, and geometry verification tooling for the **OptoPupil** neural pupil segmentation workstream.

---

## 2. ML Directory Structure

```
ml/
├── preprocessing_config.py      # Dataclass defining resolution matrices, interpolation, normalization, and augmentations
├── dataset.py                   # PyTorch-compatible Dataset loader with strict integer mask & aspect-ratio guarantees
├── preprocess_dataset.py        # Preprocessing pipeline runner, geometry verification & report generator
├── clean_dataset.py             # Phase 1 dataset cleaning & quality audit pipeline
├── validate_dataset.py          # Independent dataset integrity validator
├── inspect_dataset.py           # Dataset visual inspection utility
├── data/
│   └── cleaned/                 # Verified cleaned dataset (Original source preserved untouched)
│       ├── train/
│       │   ├── image/           # 1,000 Grayscale PNGs (640×480)
│       │   └── segmentation/    # 1,000 Single-channel integer masks (Classes 0, 1, 2, 3)
│       └── val/
│           ├── image/           # 275 Grayscale PNGs (640×480)
│           └── segmentation/    # 275 Single-channel integer masks (Classes 0, 1, 2, 3)
└── reports/
    ├── preprocessing_report.md  # 15-section comprehensive preprocessing & geometry report
    ├── preprocessing_samples/   # High-resolution multi-panel before/after visualizations
    │   ├── preprocessing_montage_summary.png
    │   ├── sample_small_pupil_(constricted).png
    │   ├── sample_medium_pupil_(baseline).png
    │   ├── sample_large_pupil_(dilated).png
    │   ├── sample_boundary-near_pupil.png
    │   └── sample_unusual_pupil_iris_ratio.png
    ├── dataset_cleaning_report.md
    └── dataset_cleaning_report.json
```

---

## 3. Preprocessing Specifications

| Component | Specification | Rationale |
| :--- | :--- | :--- |
| **Target Resolution** | **$256 \times 192$** ($W \times H$) | Preserves exact $4:3$ aspect ratio ($640 \times 480 \rightarrow 256 \times 192$ with $0.40\times$ uniform scaling, 0 padding, divisible by 32 for U-Net) |
| **Image Interpolation** | `Bilinear` (`PIL.Image.Resampling.BILINEAR`) | Smooth gradient transitions and sub-pixel edge preservation |
| **Mask Interpolation** | Strictly `Nearest-Neighbor` (`PIL.Image.Resampling.NEAREST`) | Strictly preserves discrete integer class labels $\{0, 1, 2, 3\}$ without fractional blurring |
| **Image Normalization** | Min-Max $[0.0, 1.0]$ `float32` (`pixel / 255.0`) | Standardized bounded neural input dynamic range |
| **Mask Format** | Single-channel 2D `int64` matrix `[192, 256]` | Direct compatibility with PyTorch `CrossEntropyLoss` and `DiceLoss` |
| **ROI Strategy** | Full-frame retention ($256 \times 192$) | Source captures are already tightly cropped ocular regions; full frame avoids truncating off-center pupils |
| **Augmentation** | Dynamic on-the-fly (Rotation $\pm 5^\circ$, Shift $\pm 4\%$, Noise $\sigma=0.015$, Brightness/Contrast $\pm 8\%$) | Applied during training `__getitem__`; raw files remain unmodified |

---

## 4. Class Encoding & Statistics

| Class | Anatomical Structure | Cleaned Combined Pixels | Percentage | Role in Training |
| :--- | :--- | :--- | :--- | :--- |
| **`0`** | **Background / Periocular Skin** | 265,120,742 px | 67.69% | Background non-eye region |
| **`1`** | **Sclera / Exposed Eye** | 70,463,758 px | 17.99% | Ocular landmark |
| **`2`** | **Pupil Aperture** | **18,951,817 px** | **4.84%** | **Primary Segmentation Target** |
| **`3`** | **Iris Stroma** | 37,143,683 px | 9.48% | Concentric pupil boundary context |

### Pupil Area Percentiles (Ground Truth $640 \times 480$):
- **Min**: $0\text{ px}$ (4 fully occluded/blinking samples in train)
- **P1**: $2,979\text{ px}$ (~$477\text{ px}$ in $256 \times 192$)
- **P25 (Q1)**: $10,814\text{ px}$ (~$1,730\text{ px}$ in $256 \times 192$)
- **P50 (Median)**: $14,272\text{ px}$ (~$2,284\text{ px}$ in $256 \times 192$)
- **P75 (Q3)**: $17,954\text{ px}$ (~$2,873\text{ px}$ in $256 \times 192$)
- **P99**: $33,073\text{ px}$ (~$5,292\text{ px}$ in $256 \times 192$)
- **Max**: $50,473\text{ px}$ (~$8,076\text{ px}$ in $256 \times 192$)

---

## 5. Geometric Preservation Sanity Test

All 5 representative sample categories passed strict geometric consistency tests ($Area_{prep} \approx 0.1600 \times Area_{orig}$, $AR_{err} < 0.05$, $Centroid_{err} < 1.0\text{px}$):
1. **Small Pupil (Constricted)** (`0236_2_1_2_22_003.png`): Area $2389 \rightarrow 388\text{ px}$ ($0.1624$), Aspect ratio error $0.0116$ — **PASS**
2. **Medium Pupil (Baseline)** (`0230_2_1_2_23_005.png`): Area $14553 \rightarrow 2333\text{ px}$ ($0.1603$), Aspect ratio error $0.0065$ — **PASS**
3. **Large Pupil (Dilated)** (`0246_1_1_2_21_003.png`): Area $36898 \rightarrow 5900\text{ px}$ ($0.1599$), Aspect ratio error $0.0022$ — **PASS**
4. **Boundary-Near Pupil** (`0227_1_1_2_32_000.png`): Area $17601 \rightarrow 2817\text{ px}$ ($0.1600$), Aspect ratio error $0.0029$ — **PASS**
5. **Unusual Pupil/Iris Ratio** (`0270_1_1_2_42_004.png`): Area $10969 \rightarrow 1765\text{ px}$ ($0.1609$), Aspect ratio error $0.0441$ — **PASS**

---

## 6. How to Run

### Run Preprocessing Pipeline & Regenerate Reports:
```bash
python3 ml/preprocess_dataset.py
```

### Dataset Loader Usage (PyTorch):
```python
from ml.dataset import OptoPupilDataset
from ml.preprocessing_config import DEFAULT_CONFIG

# Instantiate dataset
train_dataset = OptoPupilDataset(split="train", config=DEFAULT_CONFIG, augment=True)
val_dataset   = OptoPupilDataset(split="val",   config=DEFAULT_CONFIG, augment=False)

# Access sample: image shape [1, 192, 256] float32, mask shape [192, 256] int64
image, mask = train_dataset[0]
print(f"Image tensor shape: {image.shape}, dtype: {image.dtype}")  # [1, 192, 256], torch.float32
print(f"Mask tensor shape:  {mask.shape},  dtype: {mask.dtype}")   # [192, 256],    torch.int64
```

---

## 7. Next Stage: Model Architecture (Phase 2B)
The preprocessing pipeline is **READY FOR MODEL ARCHITECTURE**.
The next stage will design a lightweight U-Net / MobileNetV3 segmentation network optimized for high-fps inference and class-2 pupil extraction.
