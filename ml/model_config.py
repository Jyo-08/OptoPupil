"""
OptoPupil ML — Model Configuration
Defines architecture specifications, channel dimensions, resolution parameters,
and loss weight configurations for the OptoPupil neural pupil segmentation model.
"""

from dataclasses import dataclass, field
from typing import Tuple, List, Dict, Any, Optional


@dataclass
class ModelConfig:
    # --- Input / Output Dimensions ---
    input_channels: int = 1         # Single-channel grayscale ocular capture
    num_classes: int = 4            # 0: Background, 1: Sclera, 2: Pupil, 3: Iris
    input_height: int = 192         # Aspect-ratio preserving target height (4:3)
    input_width: int = 256          # Aspect-ratio preserving target width (4:3)

    # --- Architecture Specifications ---
    architecture_name: str = "OptoPupilUNet"
    base_channels: int = 32         # Initial feature channel count
    channel_multipliers: Tuple[int, ...] = (1, 2, 4, 8)  # Encoder stages: [32, 64, 128, 256]
    bottleneck_multiplier: int = 16  # Bottleneck stage: 512 channels
    num_encoder_stages: int = 4
    bilinear_upsampling: bool = True # Bilinear upsampling avoids checkerboard artifacts
    dropout_rate: float = 0.05       # Mild spatial dropout for regularization
    use_batchnorm: bool = True
    activation: str = "relu"        # Options: "relu", "leaky_relu", "silu"

    # --- Class Mapping & Anatomical Identifiers ---
    class_names: Dict[int, str] = field(default_factory=lambda: {
        0: "Background / Periocular",
        1: "Sclera / Exposed Eye",
        2: "Pupil Aperture (Target)",
        3: "Iris Stroma"
    })
    target_pupil_class: int = 2

    # --- Dataset-Derived Class Frequencies (From Phase 2A Cleaned Data) ---
    # Class 0: 67.9667%, Class 1: 17.6124%, Class 2 (Pupil): 4.8597%, Class 3: 9.5611%
    class_frequencies: Dict[int, float] = field(default_factory=lambda: {
        0: 0.679667,
        1: 0.176124,
        2: 0.048597,
        3: 0.095611
    })

    # --- Loss Balancing Configurations ---
    # Inverse square-root frequency weighting: w_c = (1 / sqrt(f_c)) normalized to sum(w) = num_classes
    # Yields: Class 0: ~0.43, Class 1: ~0.84, Class 2 (Pupil): ~1.60, Class 3: ~1.14
    class_weights: List[float] = field(default_factory=lambda: [0.427, 0.840, 1.597, 1.139])
    
    # Loss compound multipliers
    ce_loss_weight: float = 1.0     # Weight for Cross-Entropy loss
    dice_loss_weight: float = 1.0   # Weight for Multiclass Dice loss
    pupil_dice_boost: float = 2.0   # Extra weight boost for class 2 (Pupil) in Dice loss
    dice_smooth: float = 1e-5       # Laplace smoothing epsilon


# Singleton default configuration
DEFAULT_MODEL_CONFIG = ModelConfig()
