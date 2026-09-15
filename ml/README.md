# OptoPupil ML Workstream

## 1. Overview
This directory houses the end-to-end machine learning data pipeline, dataset cleaning audit, preprocessing transformations, PyTorch-compatible dataset loaders, neural model architecture, and modular loss functions for the **OptoPupil** neural pupil segmentation workstream.

---

## 2. ML Directory Structure

```
ml/
├── model_config.py              # Architecture hyperparameters, tensor shapes, and loss weight configs
├── model.py                     # OptoPupilUNet lightweight segmentation model architecture
├── losses.py                    # Multiclass Dice, Weighted Cross-Entropy, and CombinedPupilLoss
├── test_model.py                # Forward-pass, parameter inspection, and loss validation runner
├── dataset.py                   # PyTorch Dataset loader with strict integer mask & aspect-ratio guarantees
├── preprocessing_config.py      # Preprocessing configuration (256x192, bilinear/nearest-neighbor)
├── preprocess_dataset.py        # Preprocessing pipeline runner, geometry verification & report generator
├── clean_dataset.py             # Phase 1 dataset cleaning & quality audit pipeline
├── validate_dataset.py          # Independent dataset integrity validator
├── inspect_dataset.py           # Dataset visual inspection utility
├── data/
│   └── cleaned/                 # Verified cleaned dataset (1,000 train + 275 val pairs)
│       ├── train/
│       │   ├── image/           # 1,000 Grayscale PNGs (640×480)
│       │   └── segmentation/    # 1,000 Single-channel integer masks (Classes 0, 1, 2, 3)
│       └── val/
│           ├── image/           # 275 Grayscale PNGs (640×480)
│           └── segmentation/    # 275 Single-channel integer masks (Classes 0, 1, 2, 3)
└── reports/
    ├── preprocessing_report.md  # 15-section preprocessing & geometry preservation report
    ├── preprocessing_samples/   # Multi-panel before/after visualizations
    ├── dataset_cleaning_report.md
    └── dataset_cleaning_report.json
```

---

## 3. Model Architecture (`OptoPupilUNet`)

`OptoPupilUNet` is a lightweight, encoder-decoder convolutional network tailored for real-time ocular image segmentation and pupil aperture localization on mobile devices, developer machines, and browser WASM/WebGPU runtimes.

### Architectural Layout:
- **Input Tensor**: `[B, 1, 192, 256]` (Single-channel grayscale, normalized $[0.0, 1.0]$ Float32).
- **Encoder (Contracting Path)**:
  - `inc`: DoubleConv ($1 \rightarrow 32$), output `[B, 32, 192, 256]` $\rightarrow$ Skip Connection 1
  - `down1`: MaxPool2d ($2\times 2$) + DoubleConv ($32 \rightarrow 64$), output `[B, 64, 96, 128]` $\rightarrow$ Skip Connection 2
  - `down2`: MaxPool2d ($2\times 2$) + DoubleConv ($64 \rightarrow 128$), output `[B, 128, 48, 64]` $\rightarrow$ Skip Connection 3
  - `down3`: MaxPool2d ($2\times 2$) + DoubleConv ($128 \rightarrow 256$), output `[B, 256, 24, 32]` $\rightarrow$ Skip Connection 4
- **Bottleneck**:
  - `down4`: MaxPool2d ($2\times 2$) + DoubleConv ($256 \rightarrow 256$), output `[B, 256, 12, 16]`
- **Decoder (Expanding Path with Skip Connections)**:
  - `up1`: Bilinear Upsample ($2\times$) + Concat Skip 4 + DoubleConv ($512 \rightarrow 128$), output `[B, 128, 24, 32]`
  - `up2`: Bilinear Upsample ($2\times$) + Concat Skip 3 + DoubleConv ($256 \rightarrow 64$), output `[B, 64, 48, 64]`
  - `up3`: Bilinear Upsample ($2\times$) + Concat Skip 2 + DoubleConv ($128 \rightarrow 32$), output `[B, 32, 96, 128]`
  - `up4`: Bilinear Upsample ($2\times$) + Concat Skip 1 + DoubleConv ($64 \rightarrow 32$), output `[B, 32, 192, 256]`
- **Segmentation Head**:
  - `outc`: $1\times 1$ Conv ($32 \rightarrow 4$), output `[B, 4, 192, 256]` (Raw unnormalized logits).

### Parameter Footprint:
- **Total Parameters**: `1,930,212` (~1.93M parameters)
- **Trainable Parameters**: `1,930,212` (100%)
- **Model Size in Memory**: `7.36 MB` (Float32)
- **Complexity Assessment**: Lightweight, fully within the $<5\text{M}$ constraint for embedded and browser inference.

---

## 4. Class Mapping & Anatomical Roles

| Class Index | Anatomical Structure | Cleaned Dataset Share | Normalized Class Weight ($w_c$) | Role in Pupillometry |
| :--- | :--- | :--- | :--- | :--- |
| **`0`** | **Background / Periocular Skin** | 67.69% | `0.427` | Non-ocular periocular context |
| **`1`** | **Sclera / Exposed Eye** | 17.99% | `0.840` | Ocular boundary landmark |
| **`2`** | **Pupil Aperture (Target)** | **4.84%** | **`1.597` (Boosted $\times 2.0$)** | **Primary target for diameter & PLR metrics** |
| **`3`** | **Iris Stroma** | 9.48% | `1.139` | Concentric pupil boundary limiter |

---

## 5. Loss Design: Why Pupil Imbalance Matters

In raw full-frame ocular images, the pupil aperture occupies only **$\sim 4.8\%$** of total pixels. If an unweighted Cross-Entropy loss is used, a naive model predicting only background (`class 0`) achieves $>67\%$ pixel accuracy despite completely failing to detect the pupil aperture.

To prevent this degeneracy, we implement a **Modular Compound Loss** in `ml/losses.py`:

$$\mathcal{L}_{\text{total}} = \alpha \cdot \mathcal{L}_{\text{WeightedCE}} + \beta \cdot \mathcal{L}_{\text{MulticlassDice}}$$

1. **Weighted Cross-Entropy ($\mathcal{L}_{\text{WeightedCE}}$)**:
   Penalizes pixel-level misclassifications according to inverse square-root frequencies:
   $$w_c = \frac{1}{\sqrt{f_c}} \cdot \frac{C}{\sum_i 1/\sqrt{f_i}}$$
2. **Multiclass Dice Loss ($\mathcal{L}_{\text{MulticlassDice}}$)**:
   Measures spatial overlap (IoU/F1-score) directly on one-hot probability maps, making the gradient independent of class area size:
   $$\text{Dice}_c = \frac{2 \sum p_{c} y_{c} + \epsilon}{\sum p_{c} + \sum y_{c} + \epsilon}$$
3. **Pupil Class Boost ($\times 2.0$)**:
   Applies an extra multiplier to class 2 (Pupil) inside the Dice loss component.

---

## 6. How to Run Model Validation

Run the forward-pass, parameter inspection, and loss computation test:

```bash
python3 ml/test_model.py
```

### Expected Output:
```text
============================================================
MODEL ARCHITECTURE TEST
============================================================

Input:
[1, 1, 192, 256]

Output:
[1, 4, 192, 256]

Ground truth:
[1, 192, 256]

Predicted classes:
0–3

Parameters:
1,930,212 (7.36 MB)

Device:
CPU (NumPy Engine) (99.63 ms)

Loss:
2.4602 (CE: 1.5911, Dice: 0.8691)

NaN:
0

Inf:
0

Forward pass:
PASS

Loss computation:
PASS

Prediction shape:
PASS

Status:
READY FOR TRAINING
============================================================
```

---

## 7. Next Stage: Model Training Pipeline (Phase 3)
The model architecture and compound loss functions are **READY FOR TRAINING**.
Phase 3 will configure the training loop, learning rate scheduling (Cosine Annealing / OneCycleLR), validation metric logging (Pupil Dice & IoU), and early stopping.
