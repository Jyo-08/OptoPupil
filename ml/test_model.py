"""
OptoPupil ML — Model Architecture & Forward Pass Validation Test
Validates OptoPupilUNet architecture, parameter count, forward-pass execution,
finite logits, compound loss computation, and argmax prediction shapes.
"""

import sys
import math
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

from ml.model_config import ModelConfig, DEFAULT_MODEL_CONFIG
from ml.model import OptoPupilUNet, get_model_summary
from ml.losses import CombinedPupilLoss, compute_dataset_class_weights
from ml.dataset import OptoPupilDataset


def run_model_sanity_test(verbose: bool = True) -> Dict[str, Any]:
    """
    Executes full forward pass and loss validation on a real preprocessed sample.
    """
    config = DEFAULT_MODEL_CONFIG
    
    # 1. Load real sample from cleaned train dataset
    dataset = OptoPupilDataset(split="train", config=None, augment=False)
    img_sample, mask_sample = dataset[0]  # img: [1, 192, 256], mask: [192, 256]

    # Form batch of size B=1
    if TORCH_AVAILABLE and isinstance(img_sample, torch.Tensor):
        img_batch = img_sample.unsqueeze(0)    # [1, 1, 192, 256]
        mask_batch = mask_sample.unsqueeze(0)  # [1, 192, 256]
        device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))
        img_batch = img_batch.to(device)
        mask_batch = mask_batch.to(device)
        device_name = str(device).upper()
    else:
        img_batch = np.expand_dims(img_sample, axis=0)    # [1, 1, 192, 256]
        mask_batch = np.expand_dims(mask_sample, axis=0)  # [1, 192, 256]
        device_name = "CPU (NumPy Engine)"

    # 2. Instantiate Model & Summary
    model = OptoPupilUNet(config)
    if TORCH_AVAILABLE and isinstance(model, torch.nn.Module):
        model.to(device)
        model.eval()

    summary = get_model_summary(model)

    # 3. Measure Forward Pass
    t0 = time.perf_counter()
    if TORCH_AVAILABLE and isinstance(model, torch.nn.Module):
        with torch.no_grad():
            logits = model(img_batch)
    else:
        logits = model(img_batch)
    t1 = time.perf_counter()
    forward_ms = (t1 - t0) * 1000.0

    # 4. Validate Logits Integrity
    if TORCH_AVAILABLE and isinstance(logits, torch.Tensor):
        logits_np = logits.detach().cpu().numpy()
        has_nan = bool(torch.isnan(logits).any().item())
        has_inf = bool(torch.isinf(logits).any().item())
        nan_count = int(torch.isnan(logits).sum().item())
        inf_count = int(torch.isinf(logits).sum().item())
        out_shape = list(logits.shape)
        in_shape = list(img_batch.shape)
        mask_shape = list(mask_batch.shape)
        pred = torch.argmax(logits, dim=1).detach().cpu().numpy()
    else:
        logits_np = logits
        has_nan = bool(np.isnan(logits_np).any())
        has_inf = bool(np.isinf(logits_np).any())
        nan_count = int(np.sum(np.isnan(logits_np)))
        inf_count = int(np.sum(np.isinf(logits_np)))
        out_shape = list(logits_np.shape)
        in_shape = list(img_batch.shape)
        mask_shape = list(mask_batch.shape)
        pred = np.argmax(logits_np, axis=1)

    # Structural assertions
    assert in_shape == [1, 1, 192, 256], f"Unexpected input shape: {in_shape}"
    assert out_shape == [1, 4, 192, 256], f"Unexpected output shape: {out_shape}"
    assert mask_shape == [1, 192, 256], f"Unexpected mask shape: {mask_shape}"
    assert not has_nan, "NaN values detected in model output logits!"
    assert not has_inf, "Inf values detected in model output logits!"

    # 5. Compute Compound Loss
    loss_fn = CombinedPupilLoss(config=config)
    if TORCH_AVAILABLE and isinstance(loss_fn, torch.nn.Module):
        loss_val, loss_breakdown = loss_fn(logits, mask_batch)
        loss_float = float(loss_val.item())
    else:
        loss_val, loss_breakdown = loss_fn(logits_np, mask_batch)
        loss_float = float(loss_val)

    assert not math.isnan(loss_float), "Computed loss is NaN!"
    assert not math.isinf(loss_float), "Computed loss is Inf!"
    assert loss_float > 0, f"Loss must be strictly positive, got {loss_float}"

    # 6. Validate Prediction Integrity
    pred_shape = list(pred.shape)
    assert pred_shape == [1, 192, 256], f"Unexpected prediction shape: {pred_shape}"
    pred_unique = sorted(list(np.unique(pred)))
    assert set(pred_unique).issubset({0, 1, 2, 3}), f"Invalid prediction class indices: {pred_unique}"

    results = {
        "input_shape": in_shape,
        "output_shape": out_shape,
        "ground_truth_shape": mask_shape,
        "predicted_classes_found": pred_unique,
        "total_parameters": summary["total_parameters"],
        "trainable_parameters": summary["trainable_parameters"],
        "model_size_mb": summary["model_size_mb"],
        "forward_pass_ms": round(forward_ms, 2),
        "device": device_name,
        "loss": round(loss_float, 4),
        "loss_breakdown": loss_breakdown,
        "nan_count": nan_count,
        "inf_count": inf_count,
        "forward_pass_status": "PASS",
        "loss_computation_status": "PASS",
        "prediction_shape_status": "PASS",
        "overall_status": "READY FOR TRAINING"
    }
    return results


def overfit_single_batch_demo(
    model: OptoPupilUNet,
    img_batch: Any,
    mask_batch: Any,
    num_steps: int = 20,
    lr: float = 1e-3
) -> List[float]:
    """
    Diagnostic utility to verify that the model and loss can overfit a single tiny batch.
    (Optional helper function; NOT called automatically during test runs).
    """
    if not TORCH_AVAILABLE:
        print("Overfit test requires PyTorch installation.")
        return []

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = CombinedPupilLoss()
    losses = []

    model.train()
    for step in range(num_steps):
        optimizer.zero_grad()
        logits = model(img_batch)
        loss, _ = loss_fn(logits, mask_batch)
        loss.backward()
        optimizer.step()
        losses.append(float(loss.item()))

    return losses


def main():
    results = run_model_sanity_test(verbose=True)

    print("=" * 60)
    print("MODEL ARCHITECTURE TEST")
    print("=" * 60)
    print(f"\nInput:\n{results['input_shape']}")
    print(f"\nOutput:\n{results['output_shape']}")
    print(f"\nGround truth:\n{results['ground_truth_shape']}")
    print(f"\nPredicted classes:\n0–3")
    print(f"\nParameters:\n{results['total_parameters']:,} ({results['model_size_mb']} MB)")
    print(f"\nDevice:\n{results['device']} ({results['forward_pass_ms']} ms)")
    print(f"\nLoss:\n{results['loss']:.4f} (CE: {results['loss_breakdown']['loss_ce']:.4f}, Dice: {results['loss_breakdown']['loss_dice']:.4f})")
    print(f"\nNaN:\n{results['nan_count']}")
    print(f"\nInf:\n{results['inf_count']}")
    print(f"\nForward pass:\n{results['forward_pass_status']}")
    print(f"\nLoss computation:\n{results['loss_computation_status']}")
    print(f"\nPrediction shape:\n{results['prediction_shape_status']}")
    print(f"\nStatus:\n{results['overall_status']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
