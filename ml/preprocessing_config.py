"""
OptoPupil ML — Preprocessing Configuration
Defines resolution strategies, normalization modes, augmentation parameters,
and dataset paths for neural pupil segmentation.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple, List, Dict, Any


@dataclass
class PreprocessingConfig:
    # --- Paths ---
    cleaned_data_root: Path = Path(__file__).parent / "data" / "cleaned"
    reports_dir: Path = Path(__file__).parent / "reports"
    sample_vis_dir: Path = Path(__file__).parent / "reports" / "preprocessing_samples"

    # --- Source Image Specification ---
    source_width: int = 640
    source_height: int = 480
    source_channels: int = 1
    source_aspect_ratio: float = 640 / 480  # 4:3 = 1.3333

    # --- Target Resolution Strategy ---
    # Recommended: 256x192 preserves exact 4:3 aspect ratio with zero distortion/padding
    # and both dimensions are divisible by 32 (256/32=8, 192/32=6) for standard U-Net depth.
    target_width: int = 256
    target_height: int = 192
    target_channels: int = 1

    # Alternative candidate resolutions for evaluation
    evaluated_resolutions: List[Dict[str, Any]] = field(default_factory=lambda: [
        {
            "name": "256x192 (Recommended)",
            "width": 256,
            "height": 192,
            "aspect_ratio": 256 / 192,
            "aspect_ratio_match": True,
            "padding_required": False,
            "divisible_by_32": True,
            "total_pixels": 256 * 192,
            "scaling_factor_x": 256 / 640,  # 0.40
            "scaling_factor_y": 192 / 480,  # 0.40
        },
        {
            "name": "320x240 (High-Resolution)",
            "width": 320,
            "height": 240,
            "aspect_ratio": 320 / 240,
            "aspect_ratio_match": True,
            "padding_required": False,
            "divisible_by_32": False,  # 240/32 = 7.5 (requires reflection pad to 256 for U-Net)
            "total_pixels": 320 * 240,
            "scaling_factor_x": 320 / 640,  # 0.50
            "scaling_factor_y": 240 / 480,  # 0.50
        },
        {
            "name": "256x256 (Square Padded/Distorted)",
            "width": 256,
            "height": 256,
            "aspect_ratio": 1.0,
            "aspect_ratio_match": False,  # Distorts 4:3 unless 64px letterbox padding is added
            "padding_required": True,
            "divisible_by_32": True,
            "total_pixels": 256 * 256,
            "scaling_factor_x": 256 / 640,  # 0.40
            "scaling_factor_y": 256 / 480,  # 0.5333 (anamorphic stretch)
        }
    ])

    # --- Interpolation Policies ---
    # Masks MUST strictly use nearest-neighbor interpolation to prevent label corruption
    image_interpolation: str = "bilinear"  # Options: "bilinear", "bicubic"
    mask_interpolation: str = "nearest"    # Strictly "nearest"

    # --- Normalization Strategy ---
    # Normalizes pixel intensity to [0.0, 1.0]
    normalization_mode: str = "minmax"     # Options: "minmax" [0,1], "standard" (z-score), "bipolar" [-1,1]

    # --- Segmentation Target Classes ---
    num_classes: int = 4
    class_labels: Dict[int, str] = field(default_factory=lambda: {
        0: "Background / Periocular",
        1: "Sclera / Exposed Eye",
        2: "Pupil Aperture",
        3: "Iris Stroma"
    })
    target_pupil_class: int = 2

    # --- Dynamic Training Augmentation Policy ---
    # Augmentation is applied dynamically at batch load time; original dataset remains unmodified.
    enable_augmentation: bool = False
    rotation_deg: float = 5.0              # ±5 degrees small anatomical rotation
    translation_pct: float = 0.04          # ±4% horizontal/vertical shift
    brightness_range: Tuple[float, float] = (0.92, 1.08)  # ±8% brightness variation
    contrast_range: Tuple[float, float] = (0.92, 1.08)    # ±8% contrast variation
    gaussian_noise_std: float = 0.015      # Mild sensor noise simulation
    horizontal_flip: bool = False          # Set False to preserve ocular laterality (left/right asymmetry)


# Singleton default configuration
DEFAULT_CONFIG = PreprocessingConfig()
