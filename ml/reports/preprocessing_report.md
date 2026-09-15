# OptoPupil ML — Phase 2A: Dataset Preprocessing Engineering Report

**Date**: September 15, 2026  
**Pipeline Stage**: Phase 2A — Dataset Preprocessing & Geometry Preservation  
**Cleaned Dataset**: `/Users/jyotish/.gemini/antigravity-ide/scratch/optopupil/ml/data/cleaned`  
**Status**: **`READY FOR MODEL ARCHITECTURE`**

---

## 1. Dataset Source
- **Root Directory**: `/Users/jyotish/.gemini/antigravity-ide/scratch/optopupil/ml/data/cleaned`
- **Source Modality**: Single-channel 8-bit Grayscale PNG paired with 8-bit Integer Mask PNG.
- **Dataset Splits**:
  - **Train**: 1000 image/mask pairs (100% paired, 100% synchronized)
  - **Validation**: 275 image/mask pairs (100% paired, 100% synchronized)
  - **Total**: 1275 image/mask pairs
- **Source Integrity**: Zero corrupted files, zero missing labels, zero out-of-range class indices.

---

## 2. Original Dimensions
- **Width**: `640 px`
- **Height**: `480 px`
- **Aspect Ratio**: `1.3333` (4:3 horizontal aspect ratio)
- **Channels**: Single-channel Grayscale (C=1)
- **Frame Type**: High-resolution cropped ocular captures centered around the pupil and iris stroma.

---

## 3. Training Dimensions & Resolution Evaluation Matrix
We evaluated three candidate input resolutions against the source 640x480 (4:3) format:

| Candidate Resolution | Aspect Ratio | Aspect Preserved? | Letterbox Padding? | Divisible by 32 (U-Net)? | Total Pixels | Scaling Factor (Sx, Sy) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **256x192 (Target)** | **1.3333 (4:3)** | **YES (Exact)** | **NONE (0 px)** | **YES (8x6 blocks)** | **49,152 px** | **0.4000 x 0.4000** | **SELECTED (Optimal)** |
| 320x240 (High-Res) | 1.3333 (4:3) | YES (Exact) | NONE (0 px) | NO (240/32=7.5) | 76,800 px | 0.5000 x 0.5000 | Requires reflection pad |
| 256x256 (Square) | 1.0000 (1:1) | NO (Distorts) | Required (64 px) | YES (8x8 blocks) | 65,536 px | 0.4000 x 0.5333 | Anamorphic stretch |

### Resolution Selection Rationale:
1. **256x192** strictly preserves the natural **4:3** ocular aspect ratio without introducing artificial letterbox padding or zero-value boundaries.
2. The scaling factor is perfectly isotropic (0.40x in both X and Y), ensuring circle/ellipse circularity and pupil eccentricity remain unwarped.
3. Both spatial dimensions (256 and 192) are multiples of 32 (256 = 32 x 8, 192 = 32 x 6), allowing seamless 5-stage downsampling/upsampling in standard U-Net architectures without fractional feature map rounding errors.

---

## 4. Resize and Padding Strategy
- **Image Resizing**: Scaled from 640x480 to 256x192 via **Bilinear Resampling** (`PIL.Image.Resampling.BILINEAR`), preserving smooth intensity gradients and sub-pixel edge transitions.
- **Mask Resizing**: Scaled from 640x480 to 256x192 strictly via **Nearest-Neighbor Resampling** (`PIL.Image.Resampling.NEAREST`).
- **Padding**: **Zero padding is used**. Because 256/192 == 640/480, no padding or letterboxing is necessary.
- **No Mask Label Blurring**: Nearest-neighbor interpolation guarantees that mask pixel values remain strictly integer values {0, 1, 2, 3}.

---

## 5. Image Normalization
- **Input Grayscale Intensity Range**: [0, 255] -> [0.0, 1.0] Float32 via isotropic min-max normalization (`pixel / 255.0`).
- **Tensor Shape**: `[1, 192, 256]` (Channel-first PyTorch standard `[C, H, W]`).
- **Anatomical Integrity**: No aggressive histogram equalization or adaptive thresholding is applied during baseline preprocessing to avoid amplifying sensor noise or altering natural pupil boundary gradients.
- **Deterministic**: Transformation is 100% deterministic during evaluation and validation.

---

## 6. Mask Handling & Label Integrity
- **Ground Truth Storage**: Single-channel 2D matrix of shape `[192, 256]`, dtype `int64` / `long`.
- **Target Class Mapping**:
  - `0`: Background / Periocular Region & Eyelids
  - `1`: Sclera / Exposed Ocular Surface
  - `2`: **Pupil Aperture (Target Class for downstream pupillometry)**
  - `3`: Iris Stroma
- **Strict Invariants**:
  - Masks are NEVER normalized to continuous floating-point values.
  - Masks are NEVER converted to RGB tensors.
  - Mask labels are verified with `assert set(unique(mask)).issubset({0, 1, 2, 3})`.

---

## 7. ROI Strategy Decision
- **Inspection Finding**: Dataset analysis reveals that the cleaned 640x480 images already represent tight, centered ocular captures containing the iris, pupil, and sclera.
- **Decision**: **Full-frame retention** (640x480 -> 256x192).
- **Reasoning**: Introducing arbitrary fixed bounding box crops risks truncating peripheral or gaze-deviated pupils that lie near the image perimeter. Full-frame scaling maintains complete context and ensures the neural network learns robust pupil localization across the entire sensor field.
- **Configurability**: Cropping parameters remain configurable in `PreprocessingConfig` if sub-region zoom is requested in future phases.

---

## 8. Dynamic Augmentation Policy
Augmentations are applied **on-the-fly** during training batch loading and are **never baked permanently into the dataset files**:

| Transform Type | Parameter Range | Application Synchronicity | Anatomical Justification |
| :--- | :--- | :--- | :--- |
| **Small Rotation** | +/- 5.0 deg | Synchronized (Image + Mask) | Models natural head tilt without distorting eye geometry |
| **Small Translation** | +/- 4.0% (dx <= 10px, dy <= 7px) | Synchronized (Image + Mask) | Simulates minor subject positional jitter |
| **Horizontal Flip** | `False` (Configurable) | Synchronized (Image + Mask) | Disabled by default to preserve left/right ocular laterality |
| **Brightness Jitter** | Factor [0.92, 1.08] | Image Only | Simulates ambient lighting drift during PLR testing |
| **Contrast Jitter** | Factor [0.92, 1.08] | Image Only | Simulates varying iris pigment contrast |
| **Gaussian Noise** | std = 0.015 (~3.8 intensity levels) | Image Only | Simulates low-light CMOS sensor noise |

---

## 9. Class Distribution Statistics

### Cleaned Dataset Split Breakdown:
| Class ID | Anatomical Structure | Train Pixel Count | Train % | Val Pixel Count | Val % | Combined Pixel Count | Combined % |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | Background / Periocular | 208,793,844 | 67.9667% | 56,326,898 | 66.6748% | 265,120,742 | 67.6881% |
| **1** | Sclera / Exposed Eye | 54,105,374 | 17.6124% | 16,358,384 | 19.3636% | 70,463,758 | 17.9901% |
| **2** | **Pupil Aperture (Target)** | 14,928,937 | **4.8597%** | 4,022,880 | **4.7619%** | 18,951,817 | **4.8386%** |
| **3** | Iris Stroma | 29,371,845 | 9.5611% | 7,771,838 | 9.1996% | 37,143,683 | 9.4832% |
| **Total** | All Classes | 307,200,000 | 100.0% | 84,480,000 | 100.0% | 391,680,000 | 100.0% |

---

## 10. Pupil-Area Statistics & Percentile Distribution
Target Class `2` (Pupil) pixel area analysis across raw 640x480 ground-truth masks:

| Statistic | Train Split (N=1000) | Validation Split (N=275) | Combined Dataset (N=1275) | Preprocessed Equivalent (256x192, x0.16) |
| :--- | :--- | :--- | :--- | :--- |
| **Minimum** | 0 px (0.000%) | 1,946 px (0.633%) | **0 px** | **~0.0 px** |
| **P1 (1st Percentile)** | 2,767 px | 4,066 px | **2,979 px** | **~476.6 px** |
| **P5 (5th Percentile)** | 6,344 px | 6,833 px | **6,374 px** | **~1019.8 px** |
| **P25 (Q1)** | 10,752 px | 10,954 px | **10,814 px** | **~1730.3 px** |
| **P50 (Median)** | 14,338 px | 14,104 px | **14,272 px** | **~2283.5 px** |
| **P75 (Q3)** | 18,170 px | 17,548 px | **17,954 px** | **~2872.6 px** |
| **P95 (95th Percentile)** | 25,477 px | 24,383 px | **25,367 px** | **~4058.7 px** |
| **P99 (99th Percentile)** | 33,734 px | 30,381 px | **33,073 px** | **~5291.8 px** |
| **Maximum** | 50,473 px (16.43%) | 31,184 px (10.15%) | **50,473 px** | **~8075.7 px** |
| **Mean +/- Std** | 14,928.94 +/- 6,446.00 px | 14,628.65 +/- 5,421.36 px | **14,864.17 +/- 6,240.47 px** | **~2378.3 +/- 998.5 px** |

---

## 11. Pupil Geometry Preservation Test Results
Sanity test evaluating geometric consistency before (640x480) and after (256x192) isotropic scaling:

| Test Category | Sample Filename | Original BBox (640x480) | Preprocessed BBox (256x192) | Orig Area -> Prep Area | Area Scale Ratio (Expected 0.1600) | Aspect Ratio Error | Centroid Error | Geometry Preserved |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Small Pupil (Constricted)** | `0236_2_1_2_22_003.png` | `[268,245,357,306]` | `[107,98,142,122]` | 2389 -> 388 px | 0.1624 | 0.0116 | 0.41 px | **PASS** |
| **Medium Pupil (Baseline)** | `0230_2_1_2_23_005.png` | `[236,118,372,265]` | `[94,47,148,105]` | 14553 -> 2333 px | 0.1603 | 0.0065 | 0.41 px | **PASS** |
| **Large Pupil (Dilated)** | `0246_1_1_2_21_003.png` | `[224,147,445,365]` | `[90,59,177,145]` | 36898 -> 5900 px | 0.1599 | 0.0022 | 0.47 px | **PASS** |
| **Boundary-Near Pupil** | `0227_1_1_2_32_000.png` | `[0,81,472,250]` | `[0,32,188,99]` | 17601 -> 2817 px | 0.1600 | 0.0029 | 0.66 px | **PASS** |
| **Unusual Pupil/Iris Ratio** | `0270_1_1_2_42_004.png` | `[3,185,462,256]` | `[1,74,184,102]` | 10969 -> 1765 px | 0.1609 | 0.0441 | 0.44 px | **PASS** |

### Geometry Verification Conclusion:
- **Scaling Factor Uniformity**: The pupil area scales consistently at A_prep approx A_orig * (0.40)^2 = 0.1600.
- **Aspect Ratio Integrity**: Aspect ratio changes are strictly < 0.05, confirming zero anamorphic warping or squishing.
- **Centroid Stability**: Sub-pixel centroid scaling error is < 1.0 px across all categories.

---

## 12. Potential Train / Validation Leakage Tracking
Carried forward from Phase 1 quality audit:

> [!WARNING]
> **POTENTIAL DATA LEAKAGE — REQUIRES REVIEW**  
> 5 sample pairs across the Train and Validation sets exhibit perceptual near-identity (dHash Hamming Distance <= 2). They have been preserved in the dataset to maintain original splits but are explicitly flagged below for review before training:

| # | Validation Sample | Matching Train Sample(s) | Match Type | Perceptual Similarity | Action Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `0195_2_1_2_20_003.png` | `0217_2_1_2_22_006.png` | `PERCEPTUAL_NEAR_MATCH` | 96.9% (Hamming=2) | Review prior to final benchmarking |
| 2 | `0195_2_1_2_34_000.png` | `0221_2_1_2_34_001.png` | `PERCEPTUAL_NEAR_MATCH` | 96.9% (Hamming=2) | Review prior to final benchmarking |
| 3 | `0201_2_1_2_51_002.png` | `0248_2_1_2_20_003.png` | `PERCEPTUAL_NEAR_MATCH` | 96.9% (Hamming=2) | Review prior to final benchmarking |
| 4 | `0206_2_1_2_23_003.png` | `0248_2_1_2_42_000.png` | `PERCEPTUAL_NEAR_MATCH` | 96.9% (Hamming=2) | Review prior to final benchmarking |
| 5 | `0206_2_1_2_24_002.png` | `0248_2_1_2_42_000.png` | `PERCEPTUAL_NEAR_MATCH` | 96.9% (Hamming=2) | Review prior to final benchmarking |

---

## 13. Dataset Loader Specification (`ml/dataset.py`)
- **Class**: `OptoPupilDataset(split='train' | 'val', config=DEFAULT_CONFIG, augment=False)`
- **Output Tensors / Arrays**:
  - `image`: Shape `[1, 192, 256]`, dtype `float32`, dynamic range [0.0, 1.0].
  - `mask`: Shape `[192, 256]`, dtype `int64`, values strictly in {0, 1, 2, 3}.
- **PyTorch Compatibility**: Automatic seamless conversion to `torch.Tensor` if PyTorch is installed; pure NumPy `float32`/`int64` format fallback if standalone.
- **Integrity Assertions**:
  ```python
  assert image.ndim == 3  # [C, H, W]
  assert image.shape[0] == 1  # 1 channel
  assert mask.ndim == 2  # [H, W]
  assert set(np.unique(mask)).issubset({0, 1, 2, 3})
  assert image.shape[1:] == mask.shape  # [192, 256] == [192, 256]
  ```

---

## 14. Final Preprocessing Configuration
Defined in [`ml/preprocessing_config.py`](file:///Users/jyotish/.gemini/antigravity-ide/scratch/optopupil/ml/preprocessing_config.py):
```python
PreprocessingConfig(
    target_width=256,
    target_height=192,
    target_channels=1,
    image_interpolation="bilinear",
    mask_interpolation="nearest",
    normalization_mode="minmax",  # [0.0, 1.0]
    num_classes=4,
    target_pupil_class=2,
    enable_augmentation=False,    # Toggleable during training
    rotation_deg=5.0,
    translation_pct=0.04,
    brightness_range=(0.92, 1.08),
    contrast_range=(0.92, 1.08),
    gaussian_noise_std=0.015,
    horizontal_flip=False
)
```

---

## 15. Recommendation for Model-Training Phase (Phase 2B)
1. **Model Architecture**: Lightweight U-Net with Depth=4 or Depth=5 (e.g. MobileNetV3 or lightweight ConvNeXt backbone), input shape `[B, 1, 192, 256]`, output logits `[B, 4, 192, 256]` or binary pupil logits `[B, 1, 192, 256]`.
2. **Loss Function**: Since pupil class occupies ~4.8% of total pixels, use a compound loss:
   $$\mathcal{L} = \mathcal{L}_{\text{Dice}} + \alpha \cdot \mathcal{L}_{\text{FocalCE}}$$
3. **Validation Metric**: Class-2 Pupil Dice Score (F1-score) and IoU (Jaccard Index) evaluated at 256x192.
4. **Environment**: Ensure PyTorch (`torch`, `torchvision`) is installed prior to model construction and training.
