"""
OptoPupil ML — Modular Compound Loss Functions
Implements Weighted Cross-Entropy, Multiclass Dice Loss, and Combined Pupil Loss
for highly imbalanced 4-class neural ocular segmentation.
"""

from typing import Optional, List, Dict, Tuple, Union, Any
import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    class nn:
        class Module:
            def __init__(self):
                pass
            def forward(self, *args, **kwargs):
                raise NotImplementedError
            def __call__(self, *args, **kwargs):
                return self.forward(*args, **kwargs)

from ml.model_config import ModelConfig, DEFAULT_MODEL_CONFIG


def compute_dataset_class_weights(
    class_frequencies: Optional[Dict[int, float]] = None,
    strategy: str = "inverse_sqrt",
    num_classes: int = 4
) -> List[float]:
    """
    Computes class weights from empirical dataset class distributions.
    
    Strategies:
    - 'inverse_sqrt': w_c = 1 / sqrt(f_c), normalized to sum(w) = num_classes (Recommended)
    - 'inverse_freq': w_c = 1 / f_c, normalized
    - 'uniform':      w_c = 1.0 for all classes
    """
    if class_frequencies is None:
        class_frequencies = DEFAULT_MODEL_CONFIG.class_frequencies

    freqs = [class_frequencies.get(c, 1.0 / num_classes) for c in range(num_classes)]
    
    if strategy == "inverse_sqrt":
        raw_weights = [1.0 / np.sqrt(max(1e-6, f)) for f in freqs]
    elif strategy == "inverse_freq":
        raw_weights = [1.0 / max(1e-6, f) for f in freqs]
    elif strategy == "uniform":
        raw_weights = [1.0] * num_classes
    else:
        raise ValueError(f"Unknown class weighting strategy: {strategy}")

    # Normalize weights so that mean weight is 1.0 (sum = num_classes)
    scale = float(num_classes) / sum(raw_weights)
    norm_weights = [float(w * scale) for w in raw_weights]
    return norm_weights


# ====================================================================
# PyTorch Loss Implementations
# ====================================================================

if TORCH_AVAILABLE:

    class MulticlassDiceLoss(nn.Module):
        """
        Multiclass Soft Dice Loss with per-class weighting.
        
        Args:
            num_classes: Number of segmentation categories (default: 4)
            class_weights: Optional list/tensor of per-class weights
            smooth: Laplace smoothing constant to prevent division by zero
            ignore_index: Class index to ignore (optional)
        """

        def __init__(
            self,
            num_classes: int = 4,
            class_weights: Optional[Union[List[float], torch.Tensor]] = None,
            smooth: float = 1e-5
        ):
            super().__init__()
            self.num_classes = num_classes
            self.smooth = smooth
            
            if class_weights is not None:
                if isinstance(class_weights, list):
                    self.register_buffer("class_weights", torch.tensor(class_weights, dtype=torch.float32))
                else:
                    self.register_buffer("class_weights", class_weights.float())
            else:
                self.register_buffer("class_weights", torch.ones(num_classes, dtype=torch.float32))

        def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
            """
            Args:
                logits: [B, num_classes, H, W] raw unnormalized logits
                targets: [B, H, W] ground-truth class labels in {0, ..., num_classes-1}
            """
            # 1. Softmax probabilities [B, C, H, W]
            probs = F.softmax(logits, dim=1)

            # 2. One-hot encode targets [B, C, H, W]
            targets_one_hot = F.one_hot(targets.long(), num_classes=self.num_classes)  # [B, H, W, C]
            targets_one_hot = targets_one_hot.permute(0, 3, 1, 2).float()              # [B, C, H, W]

            # 3. Compute Dice coefficient per class across spatial dimensions
            dims = (0, 2, 3)
            intersection = torch.sum(probs * targets_one_hot, dim=dims)
            cardinality = torch.sum(probs + targets_one_hot, dim=dims)

            dice_coeff = (2.0 * intersection + self.smooth) / (cardinality + self.smooth)

            # 4. Weighted Dice Loss
            dice_loss_per_class = 1.0 - dice_coeff
            weights = self.class_weights.to(logits.device)
            weighted_dice_loss = torch.sum(dice_loss_per_class * weights) / torch.sum(weights)

            return weighted_dice_loss


    class WeightedCrossEntropyLoss(nn.Module):
        """Standard Weighted Categorical Cross-Entropy Loss."""

        def __init__(self, class_weights: Optional[Union[List[float], torch.Tensor]] = None):
            super().__init__()
            if class_weights is not None:
                if isinstance(class_weights, list):
                    self.register_buffer("class_weights", torch.tensor(class_weights, dtype=torch.float32))
                else:
                    self.register_buffer("class_weights", class_weights.float())
            else:
                self.class_weights = None

        def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
            weights = self.class_weights.to(logits.device) if self.class_weights is not None else None
            return F.cross_entropy(logits, targets.long(), weight=weights)


    class CombinedPupilLoss(nn.Module):
        """
        Compound Loss = alpha * Weighted_CE + beta * Multiclass_Dice + gamma * Pupil_Focal
        Specifically balances background dominance (68%) against pupil aperture (4.8%).
        """

        def __init__(
            self,
            config: Optional[ModelConfig] = None,
            ce_weight: float = 1.0,
            dice_weight: float = 1.0,
            pupil_boost: float = 2.0
        ):
            super().__init__()
            self.config = config or DEFAULT_MODEL_CONFIG
            self.ce_weight = ce_weight
            self.dice_weight = dice_weight
            
            # Incorporate pupil class boost into Dice weights
            weights = list(self.config.class_weights)
            weights[self.config.target_pupil_class] *= pupil_boost
            
            self.ce_loss = WeightedCrossEntropyLoss(class_weights=self.config.class_weights)
            self.dice_loss = MulticlassDiceLoss(
                num_classes=self.config.num_classes,
                class_weights=weights,
                smooth=self.config.dice_smooth
            )

        def forward(
            self,
            logits: torch.Tensor,
            targets: torch.Tensor
        ) -> Tuple[torch.Tensor, Dict[str, float]]:
            loss_ce = self.ce_loss(logits, targets)
            loss_dice = self.dice_loss(logits, targets)
            total_loss = self.ce_weight * loss_ce + self.dice_weight * loss_dice

            breakdown = {
                "loss_total": float(total_loss.item()),
                "loss_ce": float(loss_ce.item()),
                "loss_dice": float(loss_dice.item()),
            }
            return total_loss, breakdown


# ====================================================================
# Standalone NumPy Loss Implementations (Fallback when torch is absent)
# ====================================================================

else:

    def softmax_np(x: np.ndarray, axis: int = 1) -> np.ndarray:
        """Numerically stable softmax."""
        e_x = np.exp(x - np.max(x, axis=axis, keepdims=True))
        return e_x / np.sum(e_x, axis=axis, keepdims=True)


    class MulticlassDiceLoss(nn.Module):
        def __init__(
            self,
            num_classes: int = 4,
            class_weights: Optional[List[float]] = None,
            smooth: float = 1e-5
        ):
            super().__init__()
            self.num_classes = num_classes
            self.smooth = smooth
            self.class_weights = class_weights or [1.0] * num_classes

        def forward(self, logits: np.ndarray, targets: np.ndarray) -> float:
            probs = softmax_np(logits, axis=1)  # [B, C, H, W]
            b, c, h, w = probs.shape

            # One-hot encode targets
            targets_one_hot = np.zeros((b, self.num_classes, h, w), dtype=np.float32)
            for cls_idx in range(self.num_classes):
                targets_one_hot[:, cls_idx, :, :] = (targets == cls_idx).astype(np.float32)

            dice_losses = []
            for cls_idx in range(self.num_classes):
                p_c = probs[:, cls_idx, :, :]
                t_c = targets_one_hot[:, cls_idx, :, :]
                intersection = 2.0 * np.sum(p_c * t_c) + self.smooth
                cardinality = np.sum(p_c) + np.sum(t_c) + self.smooth
                dice_c = intersection / cardinality
                dice_losses.append(1.0 - dice_c)

            weights = np.array(self.class_weights, dtype=np.float32)
            weighted_dice = float(np.sum(np.array(dice_losses) * weights) / np.sum(weights))
            return weighted_dice


    class WeightedCrossEntropyLoss(nn.Module):
        def __init__(self, class_weights: Optional[List[float]] = None):
            super().__init__()
            self.class_weights = class_weights or [1.0, 1.0, 1.0, 1.0]

        def forward(self, logits: np.ndarray, targets: np.ndarray) -> float:
            probs = softmax_np(logits, axis=1)  # [B, C, H, W]
            b, c, h, w = probs.shape
            eps = 1e-7

            total_loss = 0.0
            total_weight = 0.0
            for cls_idx in range(c):
                mask_c = (targets == cls_idx)
                if np.any(mask_c):
                    p_c = probs[:, cls_idx, :, :][mask_c]
                    w_c = self.class_weights[cls_idx]
                    nll = -np.sum(w_c * np.log(p_c + eps))
                    total_loss += nll
                    total_weight += w_c * len(p_c)

            return float(total_loss / max(1.0, total_weight))


    class CombinedPupilLoss(nn.Module):
        def __init__(
            self,
            config: Optional[ModelConfig] = None,
            ce_weight: float = 1.0,
            dice_weight: float = 1.0,
            pupil_boost: float = 2.0
        ):
            super().__init__()
            self.config = config or DEFAULT_MODEL_CONFIG
            self.ce_weight = ce_weight
            self.dice_weight = dice_weight

            weights = list(self.config.class_weights)
            weights[self.config.target_pupil_class] *= pupil_boost

            self.ce_loss = WeightedCrossEntropyLoss(class_weights=self.config.class_weights)
            self.dice_loss = MulticlassDiceLoss(
                num_classes=self.config.num_classes,
                class_weights=weights,
                smooth=self.config.dice_smooth
            )

        def forward(
            self,
            logits: np.ndarray,
            targets: np.ndarray
        ) -> Tuple[float, Dict[str, float]]:
            loss_ce = self.ce_loss(logits, targets)
            loss_dice = self.dice_loss(logits, targets)
            total = self.ce_weight * loss_ce + self.dice_weight * loss_dice
            breakdown = {
                "loss_total": round(total, 6),
                "loss_ce": round(loss_ce, 6),
                "loss_dice": round(loss_dice, 6)
            }
            return total, breakdown
