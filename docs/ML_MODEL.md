# OptoPupil Pupil Segmentation Model

## Training Source
https://www.kaggle.com/code/jyotish1628/notebook64ebcbbf14

## Deployment Artifact
Path:
public/models/pupil_segmentation.onnx

## Model Specification
- Architecture: OptoPupilUNet / U-Net
- Parameters: 4,898,980
- Input: [1,1,192,256]
- Input type: Float32
- Output: [1,4,192,256]
- Output type: Float32
- Opset: 18
- Pupil segmentation class: 2
- Model size: approximately 18.751 MB
- External data dependencies: 0
- Self-contained: YES

## Validation
Validated results from the held-out validation evaluation:
- Best validation pupil Dice: 0.973164
- Best validation pupil IoU: 0.947803
- Mean diameter error: 1.649%
- Mean center error: 0.481 px
- Mean iris-ratio error: 1.882%

## Runtime
The browser deployment artifact is the self-contained ONNX model and is intended to be loaded locally by ONNX Runtime Web.

## Important Preprocessing Constraint
The trained model expects a 4:3 input:
256 × 192

The existing browser pipeline must NOT stretch a 1:1 square eye ROI directly into 256×192 because that would distort pupil geometry.
