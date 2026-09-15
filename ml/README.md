# OptoPupil ML Workstream — Dataset Inspection & Analysis

## 1. Overview
This module contains isolated machine learning tooling, dataset inspection scripts, and verification reports for the **OptoPupil** neural pupil segmentation workstream.

---

## 2. Dataset Summary

- **Source Directory**: `/Users/jyotish/Downloads/IRIS + PUPIL + EYE`
- **Total Training Pairs**: 1,000 images + 1,000 segmentation masks
- **Total Validation Pairs**: 275 images + 275 segmentation masks
- **Total Dataset Pairs**: 1,275 pairs
- **Image Resolution**: 640 × 480 (Width × Height)
- **Mask Resolution**: 640 × 480 (Width × Height)
- **Image Mode**: 8-bit Grayscale (PIL mode `L`, numpy shape `(480, 640)`)
- **Mask Mode**: 8-bit Discrete Class Labels (PIL mode `L`, numpy shape `(480, 640)`)
- **Corrupted / Unreadable Files**: 0
- **Missing / Mismatched Files**: 0 (100% 1-to-1 matching across train and val splits)

---

## 3. Mask Class Encoding & Anatomical Mapping

Through spatial topology, bounding-box geometry, and image intensity correlation, the discrete pixel values in the single-channel masks are mapped as follows:

| Class Value | Anatomical Region | Image Intensity Characteristics | Train % | Val % |
| :--- | :--- | :--- | :--- | :--- |
| **`0`** | **Background / Periocular Skin / Eyelids** | Outer surrounding region, medium-high intensity | 67.97% | 66.67% |
| **`1`** | **Sclera / Exposed Eye Region** | High intensity ocular opening flanking iris | 17.61% | 19.36% |
| **`2`** | **Pupil (Aperture)** | Centermost dark region ($\mu \approx 24\text{--}45$), circular geometry | 4.86% | 4.76% |
| **`3`** | **Iris (Stroma / Ciliary zone)** | Concentric ring surrounding pupil ($\mu \approx 80\text{--}110$) | 9.56% | 9.20% |

---

## 4. Class Imbalance Analysis
- **Pupil Class Proportion**: ~4.8% of total frame pixels.
- **Background + Sclera Dominance**: Background accounts for ~67.3% and Sclera ~18.0%.
- **Imbalance Significance**: Significant class imbalance exists between background and the pupil target.
- **Loss Recommendation**: Training will require compound loss functions such as **Focal Tversky Loss** or combined **Dice Loss + Weighted Cross-Entropy** to prevent the background class from dominating gradients.

---

## 5. ML Readiness & Next Steps
- **Data Quality**: High. No corruptions, uniform 480×640 dimensions, pristine 1:1 filename matching.
- **Model Architecture Recommendation**: Lightweight U-Net or MobileNetV3-UNet / SegFormer operating on eye ROIs or resized frames (e.g., $256 \times 256$ or $384 \times 288$).
- **Target Formulation**:
  - Multiclass segmentation (Classes 0, 1, 2, 3) provides anatomical regularization (learning eye and iris boundaries improves pupil localization).
  - Alternatively, a binary pupil mask `(mask == 2).astype(float)` can be extracted for ultra-low latency inference.
- **Next Phase**: Model architecture definition and isolated training pipeline development (PyTorch / ONNX / TFLite export for web integration).
