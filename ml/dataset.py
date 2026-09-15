"""
OptoPupil ML — PyTorch Dataset Loader
Handles loading, aspect-ratio-preserving resizing, intensity normalization,
strict integer mask preservation, and dynamic augmentations for neural pupil segmentation.
"""

import os
import random
from pathlib import Path
from typing import Tuple, List, Optional, Union, Dict, Any

import numpy as np
from PIL import Image

try:
    import torch
    from torch.utils.data import Dataset as TorchDataset
    TORCH_AVAILABLE = True
except ImportError:
    # Fallback base class when torch is not yet installed
    class TorchDataset:
        pass
    TORCH_AVAILABLE = False

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.preprocessing_config import PreprocessingConfig, DEFAULT_CONFIG


def get_interpolation_enum(name: str):
    """Maps interpolation string name to PIL Resampling filter."""
    name = name.lower()
    if name == "nearest":
        return Image.Resampling.NEAREST if hasattr(Image, "Resampling") else Image.NEAREST
    elif name == "bicubic":
        return Image.Resampling.BICUBIC if hasattr(Image, "Resampling") else Image.BICUBIC
    elif name == "bilinear":
        return Image.Resampling.BILINEAR if hasattr(Image, "Resampling") else Image.BILINEAR
    else:
        return Image.Resampling.BILINEAR if hasattr(Image, "Resampling") else Image.BILINEAR


def preprocess_image_and_mask(
    image_path: Union[str, Path],
    mask_path: Union[str, Path],
    config: Optional[PreprocessingConfig] = None,
    augment: bool = False,
    rng: Optional[random.Random] = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Loads and preprocesses a single image and mask pair.
    
    Returns:
        image: np.ndarray of shape [1, H, W], dtype np.float32, normalized to [0.0, 1.0]
        mask:  np.ndarray of shape [H, W],    dtype np.int64, containing discrete values {0, 1, 2, 3}
    """
    if config is None:
        config = DEFAULT_CONFIG

    # 1. Load image and mask
    img_pil = Image.open(image_path).convert("L")
    mask_pil = Image.open(mask_path).convert("L")  # Single-channel 8-bit integer mask

    target_w = config.target_width
    target_h = config.target_height

    # 2. Resize with strict interpolation constraints:
    #    Image: bilinear/bicubic
    #    Mask: strictly NEAREST to preserve discrete labels {0, 1, 2, 3}
    img_resample = get_interpolation_enum(config.image_interpolation)
    mask_resample = get_interpolation_enum("nearest")

    img_resized = img_pil.resize((target_w, target_h), resample=img_resample)
    mask_resized = mask_pil.resize((target_w, target_h), resample=mask_resample)

    # 3. Dynamic augmentations (if enabled for training)
    if augment and config.enable_augmentation:
        if rng is None:
            rng = random.Random()

        # A. Synchronized Horizontal Flip (if anatomically allowed)
        if config.horizontal_flip and rng.random() > 0.5:
            img_resized = img_resized.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            mask_resized = mask_resized.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

        # B. Synchronized Small Rotation
        if config.rotation_deg > 0:
            rot_angle = rng.uniform(-config.rotation_deg, config.rotation_deg)
            img_resized = img_resized.rotate(
                rot_angle,
                resample=img_resample,
                fillcolor=0
            )
            mask_resized = mask_resized.rotate(
                rot_angle,
                resample=mask_resample,
                fillcolor=0
            )

        # C. Synchronized Small Translation
        if config.translation_pct > 0:
            max_dx = int(target_w * config.translation_pct)
            max_dy = int(target_h * config.translation_pct)
            dx = rng.randint(-max_dx, max_dx)
            dy = rng.randint(-max_dy, max_dy)
            
            # Affine translation matrix: (1, 0, dx, 0, 1, dy)
            img_resized = img_resized.transform(
                (target_w, target_h),
                Image.Transform.AFFINE,
                (1, 0, -dx, 0, 1, -dy),
                resample=img_resample,
                fillcolor=0
            )
            mask_resized = mask_resized.transform(
                (target_w, target_h),
                Image.Transform.AFFINE,
                (1, 0, -dx, 0, 1, -dy),
                resample=mask_resample,
                fillcolor=0
            )

    # 4. Convert Image to Float32 Array & Normalize
    img_arr = np.array(img_resized, dtype=np.float32)
    
    # Photometric augmentations (image only)
    if augment and config.enable_augmentation:
        if rng is None:
            rng = random.Random()
        # Brightness variation
        b_low, b_high = config.brightness_range
        b_factor = rng.uniform(b_low, b_high)
        img_arr = img_arr * b_factor

        # Contrast variation
        c_low, c_high = config.contrast_range
        c_factor = rng.uniform(c_low, c_high)
        mean_val = np.mean(img_arr)
        img_arr = (img_arr - mean_val) * c_factor + mean_val

        # Gaussian Noise
        if config.gaussian_noise_std > 0:
            noise = np.random.normal(0, config.gaussian_noise_std * 255.0, img_arr.shape).astype(np.float32)
            img_arr = img_arr + noise

        # Clip back to [0, 255]
        img_arr = np.clip(img_arr, 0.0, 255.0)

    # Normalization
    if config.normalization_mode == "minmax":
        img_normalized = img_arr / 255.0
    elif config.normalization_mode == "bipolar":
        img_normalized = (img_arr / 127.5) - 1.0
    elif config.normalization_mode == "standard":
        mean = np.mean(img_arr)
        std = np.std(img_arr) + 1e-7
        img_normalized = (img_arr - mean) / std
    else:
        img_normalized = img_arr / 255.0

    # Ensure shape is [1, H, W]
    image_tensor = np.expand_dims(img_normalized.astype(np.float32), axis=0)

    # 5. Convert Mask to Int64 Array (Discrete Class Labels {0, 1, 2, 3})
    mask_arr = np.array(mask_resized, dtype=np.int64)

    # --- Strict Assertions & Integrity Checks ---
    assert image_tensor.ndim == 3, f"Expected image ndim 3 [C, H, W], got {image_tensor.ndim}"
    assert image_tensor.shape[0] == 1, f"Expected 1 channel, got {image_tensor.shape[0]}"
    assert image_tensor.shape[1] == target_h, f"Expected H={target_h}, got {image_tensor.shape[1]}"
    assert image_tensor.shape[2] == target_w, f"Expected W={target_w}, got {image_tensor.shape[2]}"

    assert mask_arr.ndim == 2, f"Expected mask ndim 2 [H, W], got {mask_arr.ndim}"
    assert mask_arr.shape[0] == target_h, f"Expected mask H={target_h}, got {mask_arr.shape[0]}"
    assert mask_arr.shape[1] == target_w, f"Expected mask W={target_w}, got {mask_arr.shape[1]}"

    unique_classes = set(np.unique(mask_arr))
    allowed_classes = {0, 1, 2, 3}
    assert unique_classes.issubset(allowed_classes), f"Invalid mask class labels detected: {unique_classes - allowed_classes}"

    return image_tensor, mask_arr


class OptoPupilDataset(TorchDataset):
    """
    PyTorch-compatible Dataset loader for OptoPupil Neural Pupil Segmentation.
    
    Attributes:
        split: 'train' or 'val'
        config: PreprocessingConfig dataclass
        image_paths: List of sorted image filepaths
        mask_paths: List of matching sorted mask filepaths
        augment: Whether to apply dynamic data augmentation
    """

    def __init__(
        self,
        split: str = "train",
        config: Optional[PreprocessingConfig] = None,
        augment: Optional[bool] = None,
        data_root: Optional[Union[str, Path]] = None,
        seed: Optional[int] = None
    ):
        self.split = split.lower()
        if self.split not in ("train", "val", "validation"):
            raise ValueError(f"Invalid split '{split}'. Expected 'train' or 'val'.")

        self.config = config or DEFAULT_CONFIG
        
        # Enable augmentation by default only on train split if config allows
        if augment is None:
            self.augment = (self.split == "train") and self.config.enable_augmentation
        else:
            self.augment = augment

        root = Path(data_root) if data_root else self.config.cleaned_data_root
        split_dir_name = "train" if self.split == "train" else "val"
        
        self.image_dir = root / split_dir_name / "image"
        self.mask_dir = root / split_dir_name / "segmentation"

        if not self.image_dir.exists():
            raise FileNotFoundError(f"Image directory not found: {self.image_dir}")
        if not self.mask_dir.exists():
            raise FileNotFoundError(f"Mask directory not found: {self.mask_dir}")

        # Gather and sort matched pairs
        img_files = sorted([f for f in self.image_dir.iterdir() if f.is_file() and f.suffix.lower() == ".png"])
        mask_files = sorted([f for f in self.mask_dir.iterdir() if f.is_file() and f.suffix.lower() == ".png"])

        if len(img_files) != len(mask_files):
            raise ValueError(
                f"Mismatch in {self.split} split: {len(img_files)} images vs {len(mask_files)} masks."
            )

        # Validate 1-to-1 filename correspondence
        self.pairs: List[Tuple[Path, Path]] = []
        for img_p in img_files:
            mask_p = self.mask_dir / img_p.name
            if not mask_p.exists():
                raise FileNotFoundError(f"Missing corresponding mask for {img_p.name}")
            self.pairs.append((img_p, mask_p))

        self.rng = random.Random(seed) if seed is not None else None

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> Tuple[Any, Any]:
        """
        Returns:
            image: Float32 Tensor/Array of shape [1, target_height, target_width]
            mask:  Int64 Tensor/Array of shape [target_height, target_width] with labels in {0, 1, 2, 3}
        """
        img_path, mask_path = self.pairs[idx]
        
        image_np, mask_np = preprocess_image_and_mask(
            img_path,
            mask_path,
            config=self.config,
            augment=self.augment,
            rng=self.rng
        )

        if TORCH_AVAILABLE:
            image_tensor = torch.from_numpy(image_np)
            mask_tensor = torch.from_numpy(mask_np)
            return image_tensor, mask_tensor
        else:
            return image_np, mask_np

    def get_raw_paths(self, idx: int) -> Tuple[Path, Path]:
        """Returns the source file paths for a given index."""
        return self.pairs[idx]
