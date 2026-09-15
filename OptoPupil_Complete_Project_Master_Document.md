# OPTO PUPIL --- COMPLETE PROJECT MASTER DOCUMENT

## VMEDITHON 3.0 \| VSquared \| Bio × Engineering

> **Zero-Hardware Quantitative Pupillary Light Reflex Screening**

**Project:** OptoPupil\
**Platform:** Responsive Progressive Web App (PWA)\
**Primary devices:** Laptop + mobile browser\
**Development/testing:** Chrome + Chrome DevTools mobile emulation\
**Core domains:** Computer Vision + ML + Signal Processing + Web/PWA +
Safety Engineering + Grounded AI

------------------------------------------------------------------------

# 1. Executive Summary

OptoPupil is a browser-based, zero-specialized-hardware pupillary light
reflex (PLR) screening system.

The concept is to use:

-   a standard laptop or mobile camera to observe the eyes,
-   the device display to provide a controlled light stimulus,
-   ML-based face/eye landmark detection,
-   computer vision for pupil localization/measurement,
-   signal processing for PLR time-series analysis,
-   an ML model for a defined classification/quality task,
-   a deterministic safety/red-flag engine,
-   and a grounded AI assistant for first-aid/escalation guidance.

The same PWA is intended to provide the complete workflow on both
desktop and mobile layouts.

The key principle is:

> **The system is a screening/decision-support prototype, not a
> diagnostic device.**

The submitted proposal describes iris-ratio calibration, bilateral PLR
tracking, latency, maximum constriction velocity, amplitude and
bilateral asymmetry. It also identifies doctors, emergency teams, sports
medics and rural clinics as target users.

------------------------------------------------------------------------

# 2. IMPORTANT PROJECT-STATUS CLARIFICATION

The proposal presentation describes a "working browser prototype," but
the actual project status discussed for the hackathon is:

> **The prototype has not yet been built.**

Therefore, the hackathon objective is to implement the working
proof-of-concept from the proposed architecture.

Do not claim that a feature already works until it has actually been
implemented and tested.

A truthful pitch formulation is:

> "The submitted proposal defined the architecture and intended
> workflow. During the hackathon, we are implementing that architecture
> as a working browser-based proof of concept."

------------------------------------------------------------------------

# 3. Problem

Pupillary assessment is often performed subjectively using a penlight or
visual observation.

Subtle changes in pupil dynamics can contain useful neurological
information, but conventional quantitative pupillometers can require
specialized hardware.

This creates an accessibility problem for:

-   emergency environments,
-   rural/low-resource settings,
-   field environments,
-   sports medicine,
-   rapid triage.

OptoPupil aims to make quantitative PLR screening more accessible by
using hardware that already exists in common computing devices.

------------------------------------------------------------------------

# 4. Proposed Solution

OptoPupil transforms a standard device into a software-based pupillary
screening system.

Core concept:

``` text
Standard Camera
      +
Standard Display
      ↓
OptoPupil PWA
      ↓
Face / Eye Detection
      ↓
Pupil Tracking
      ↓
Controlled Light Stimulus
      ↓
Bilateral PLR Recording
      ↓
Quantitative PLR Analysis
      ↓
ML / Reliability Analysis
      ↓
Safety Engine
      ↓
Grounded AI Guidance
```

------------------------------------------------------------------------

# 5. Core User Workflow

``` text
OPEN OPTO PUPIL
      ↓
START SCREENING
      ↓
CAMERA PERMISSION
      ↓
FACE DETECTION
      ↓
EYE / IRIS LOCALIZATION
      ↓
CALIBRATION
      ↓
BASELINE RECORDING
      ↓
CONTROLLED LIGHT STIMULUS
      ↓
BILATERAL PLR RECORDING
      ↓
PUPIL TIME-SERIES
      ↓
SIGNAL PROCESSING
      ↓
PLR METRICS
      ↓
RELIABILITY CHECK
      ↓
PATIENT / INJURY CONTEXT
      ↓
SAFETY / RED-FLAG ENGINE
      ↓
AI FIRST-AID COPILOT
      ↓
FINAL SCREENING VIEW / REPORT
```

------------------------------------------------------------------------

# 6. Device Strategy

## One PWA --- two responsive experiences

We are NOT building:

-   a desktop application plus a separate mobile application,
-   or a desktop dashboard with a mobile companion.

We are building:

> **One responsive OptoPupil PWA with the complete functionality
> available on both laptop and mobile layouts.**

Architecture:

``` text
                    OPTO PUPIL PWA
                          │
             ┌────────────┴────────────┐
             │                         │
         DESKTOP                     MOBILE
         Layout                      Layout
             │                         │
         Laptop Camera             Phone Camera
         Laptop Display            Phone Display
             │                         │
             └────────────┬────────────┘
                          ↓
                   SAME CORE LOGIC
                          ↓
                    SAME CV ENGINE
                          ↓
                    SAME ML ENGINE
                          ↓
                  SAME SAFETY ENGINE
                          ↓
                   SAME AI ENGINE
```

------------------------------------------------------------------------

# 7. Mobile Development Strategy

No physical phone is required for the main responsive UI-development
loop.

Use:

**Chrome DevTools → Device Toolbar → Mobile viewport**

This allows testing:

-   responsive layouts,
-   mobile navigation,
-   cards,
-   charts,
-   controls,
-   typography,
-   spacing,
-   portrait layouts,
-   touch-sized controls.

However, actual camera behavior should still be tested on real hardware
before the final demo if possible.

------------------------------------------------------------------------

# 8. Why PWA

A PWA gives us:

-   one codebase,
-   responsive UI,
-   browser access,
-   installability,
-   HTTPS deployment,
-   no native Android/iOS application requirement,
-   no Play Store/App Store dependency,
-   easy demo access through a URL/QR code.

`vite-plugin-pwa` provides Vite integration for web app manifests and
service-worker/offline capabilities.

Official repository:

https://github.com/vite-pwa/vite-plugin-pwa

For the hackathon, prioritize:

1.  installable PWA,
2.  responsive interface,
3.  HTTPS,
4.  camera reliability.

Do not spend large amounts of time on sophisticated offline
functionality unless the core system is already complete.

------------------------------------------------------------------------

# 9. Technical Architecture

``` text
                         OPTO PUPIL PWA
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
      Camera                Display                Patient
        │                   Stimulus                 Data
        │                      │                      │
        └──────────────┬───────┴──────────┬───────────┘
                       ↓                  ↓
                 MediaPipe ML        Stimulus Controller
                       ↓                  ↓
                Face / Eye ROI            │
                       ↓                  │
                   OpenCV                 │
                       ↓                  │
                Pupil Detection           │
                       └────────┬─────────┘
                                ↓
                        Pupil Time-Series
                                ↓
                        Signal Processing
                                ↓
                          PLR Features
                                ↓
                 ┌──────────────┼──────────────┐
                 ↓              ↓              ↓
               Rules           ML          Reliability
                 │              │              │
                 └──────────────┼──────────────┘
                                ↓
                         Safety Engine
                                ↓
                       Grounded AI Layer
                                ↓
                     First-Aid / Escalation
                                ↓
                          Full Dashboard
```

------------------------------------------------------------------------

# 10. Technology Stack

## Frontend

-   React
-   Vite
-   Tailwind CSS

## PWA

-   `vite-plugin-pwa`

## Camera

-   Browser MediaDevices API
-   `getUserMedia()`

## Computer Vision

-   MediaPipe
-   OpenCV.js

## ML

Development:

-   Python
-   pandas
-   NumPy
-   scikit-learn
-   optionally XGBoost

Runtime:

-   FastAPI + Python model, OR
-   browser inference using ONNX Runtime Web / TensorFlow.js

## Charts

-   Recharts or another lightweight chart library

## AI

-   Gemini API / Google AI Studio

## Optional persistence

-   Supabase

## Deployment

-   Netlify or Vercel

## Source control

-   GitHub

------------------------------------------------------------------------

# 11. Free Resources

## MediaPipe

MediaPipe Face Landmarker uses ML models for face landmark detection and
supports web/JavaScript applications.

Official:

https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker

Web guide:

https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js

It accepts image/video/live-stream inputs and outputs 3D facial
landmarks and related results.

------------------------------------------------------------------------

## OpenCV.js

OpenCV.js provides browser-side computer-vision functionality.

Official:

https://docs.opencv.org/

Use it for:

-   eye-region processing,
-   grayscale conversion,
-   filtering,
-   thresholding,
-   contour detection,
-   candidate extraction,
-   geometric measurements,
-   image quality calculations.

------------------------------------------------------------------------

## Browser Camera API

Use:

``` javascript
navigator.mediaDevices.getUserMedia()
```

Camera access requires permission and, in production, a secure context
such as HTTPS.

------------------------------------------------------------------------

## PWA

`vite-plugin-pwa`:

https://github.com/vite-pwa/vite-plugin-pwa

------------------------------------------------------------------------

## ML

scikit-learn:

https://scikit-learn.org/

XGBoost:

https://xgboost.readthedocs.io/

TensorFlow.js:

https://www.tensorflow.org/js

ONNX Runtime Web:

https://onnxruntime.ai/docs/get-started/with-javascript/web.html

------------------------------------------------------------------------

## AI

Gemini API:

https://ai.google.dev/

Current Gemini API pricing documents a free tier for selected models and
Google AI Studio access, with model/rate limitations depending on the
model.

Pricing:

https://ai.google.dev/gemini-api/docs/pricing

Rate limits:

https://ai.google.dev/gemini-api/docs/rate-limits

For a hackathon, use the free tier conservatively and avoid
unnecessarily large prompts or continuous AI calls.

------------------------------------------------------------------------

## Supabase

Supabase Free currently provides a free Postgres database and free usage
quotas including 500 MB database size, 1 GB storage and 50,000 monthly
active users; free projects can pause after inactivity.

Pricing:

https://supabase.com/pricing

For the hackathon, Supabase is optional.

------------------------------------------------------------------------

## Netlify

Netlify currently offers a \$0 Free plan with a monthly credit limit and
HTTPS/custom domains/CDN capabilities.

Pricing:

https://www.netlify.com/pricing/

For an existing Netlify workflow, keep using it rather than introducing
unnecessary deployment complexity.

------------------------------------------------------------------------

# 12. Computer Vision Pipeline

The CV pipeline is one of the highest-risk components.

``` text
Webcam Frame
     ↓
MediaPipe
     ↓
Face landmarks
     ↓
Eye landmarks / iris region
     ↓
Eye ROI extraction
     ↓
OpenCV preprocessing
     ↓
Pupil candidate detection
     ↓
Pupil geometry
     ↓
Pupil diameter
```

------------------------------------------------------------------------

# 13. Pupil Detection

A possible classical CV pipeline:

``` text
Eye ROI
  ↓
Grayscale
  ↓
Contrast normalization
  ↓
Noise reduction
  ↓
Thresholding / segmentation
  ↓
Candidate contours
  ↓
Geometric filtering
  ↓
Pupil candidate
  ↓
Circle / ellipse estimate
```

Possible candidate features:

-   area,
-   circularity,
-   aspect ratio,
-   darkness,
-   boundary contrast,
-   distance from iris center,
-   temporal stability.

Do not lock in a specific algorithm before testing real webcam footage.

------------------------------------------------------------------------

# 14. ML vs Computer Vision

This distinction is important.

## Computer Vision

Used for:

> "Where is the pupil and how large is it?"

## Signal Processing

Used for:

> "How did the pupil diameter change over time?"

## ML

Used for:

> "Given the measurements/features, what pattern or quality category
> does this recording represent?"

## Generative AI

Used for:

> "How should the observed information and patient context be explained
> and translated into grounded first-aid/escalation guidance?"

This separation makes the architecture much more defensible.

------------------------------------------------------------------------

# 15. Calibration

The proposal includes iris-ratio calibration.

The core idea:

``` text
Pupil pixels
      ÷
Iris reference pixels
      ↓
Scale estimate
      ↓
Physical-size estimate
```

Example concept:

``` text
Pupil = 75 px
Iris reference = 250 px
Ratio = 0.30
```

A physical estimate then depends on the calibration assumption.

## Important limitation

A standard webcam does not inherently know physical scale.

Therefore:

-   document the calibration assumption,
-   do not claim clinical-grade millimeter accuracy,
-   distinguish pixel measurement from estimated physical measurement,
-   validate the calibration experimentally.

------------------------------------------------------------------------

# 16. Controlled Light Stimulus

The device display acts as the stimulus source.

Conceptually:

``` text
BASELINE
    ↓
Dark/neutral state
    ↓
CONTROLLED FLASH
    ↓
Pupil constriction
    ↓
Recovery
```

Record the exact stimulus timestamp.

This timestamp is essential for latency calculation.

------------------------------------------------------------------------

# 17. Bilateral PLR

The system tracks:

-   left pupil,
-   right pupil.

When one side is stimulated, the system can observe:

-   direct response,
-   consensual response.

The output should include bilateral comparison.

------------------------------------------------------------------------

# 18. PLR Metrics

## Pupil Diameter

Current estimated pupil size.

------------------------------------------------------------------------

## Latency

Concept:

``` text
Latency =
Response onset time - stimulus time
```

The exact response-onset detection threshold must be defined in
implementation.

------------------------------------------------------------------------

## Amplitude

Prototype definition:

``` text
Amplitude =
Baseline diameter - Minimum diameter
```

Percentage version:

``` text
Percentage constriction =
((Baseline - Minimum) / Baseline) × 100
```

------------------------------------------------------------------------

## Maximum Constriction Velocity (MCV)

Given pupil diameter D(t):

``` text
Velocity = dD/dt
```

During constriction the derivative is negative.

MCV can be defined as the maximum magnitude of the negative derivative
over the chosen constriction interval.

The exact implementation must be documented.

------------------------------------------------------------------------

## Bilateral Asymmetry

Compare left/right response characteristics.

Potential comparisons:

-   amplitude difference,
-   latency difference,
-   MCV difference,
-   normalized waveform difference.

Do not invent a clinical threshold.

The exact asymmetry formula should be explicitly defined in code and
documentation.

------------------------------------------------------------------------

# 19. Signal Processing

Raw webcam measurements will contain noise.

Pipeline:

``` text
Raw measurements
      ↓
Validity filtering
      ↓
Outlier handling
      ↓
Smoothing
      ↓
Short-gap handling
      ↓
Derivative calculation
      ↓
Feature extraction
```

Do not interpolate long missing sections.

If the data is unreliable:

> **Screening inconclusive**

is better than fabricating a result.

------------------------------------------------------------------------

# 20. Reliability Engine

OptoPupil should contain a dedicated reliability layer.

Potential name:

> **OptoPupil Reliability Engine**

It monitors:

-   face detection,
-   eye visibility,
-   iris detection,
-   pupil boundary quality,
-   frame continuity,
-   head movement,
-   brightness,
-   blur,
-   temporal stability.

Example:

``` text
Tracking confidence: 94%
```

Possible states:

``` text
95–100% → Excellent
80–95%  → Good
60–80%  → Unstable
<60%    → Recalibration
```

These thresholds are engineering examples and must be tuned
experimentally rather than presented as medical standards.

------------------------------------------------------------------------

# 21. Fallback Mechanism

``` text
Tracking
   ↓
Quality check
   ↓
Reliable?
 ┌─┴──────────────┐
YES               NO
 │                 │
 ↓                 ↓
Analyze        Recovery
                 ↓
             Reacquire
                 ↓
             Recalibrate
                 ↓
                Retry
                 ↓
         Still unreliable?
            ┌────┴────┐
           YES        NO
            ↓          ↓
       Inconclusive  Continue
```

Never use fallback logic to invent measurements.

Fallback exists to recover from unreliable computer vision.

------------------------------------------------------------------------

# 22. Deliberate Failure Demo

A powerful demo:

1.  Start screening.
2.  Track the pupils.
3.  Ask the user to move their face.
4.  Tracking quality drops.
5.  OptoPupil displays:
    -   "Tracking quality degraded."
    -   "Please reposition your face."
6.  Reacquisition occurs.
7.  Screening resumes.

This demonstrates engineering robustness.

------------------------------------------------------------------------

# 23. YOUR ML RESPONSIBILITY

The ML workstream should be a real component.

Recommended primary task:

> **PLR response-pattern classification or measurement-quality
> classification.**

Do not simply add the word "AI" to the project.

------------------------------------------------------------------------

# 24. ML Architecture

``` text
Pupil time-series
       ↓
Signal processing
       ↓
Feature extraction
       ↓
Feature vector
       ↓
ML model
       ↓
Prediction
       ↓
Dashboard
```

------------------------------------------------------------------------

# 25. Candidate ML Tasks

## Option A --- PLR Response Pattern Classification

Input:

-   latency,
-   amplitude,
-   MCV,
-   baseline,
-   minimum diameter,
-   recovery,
-   bilateral asymmetry.

Possible output:

``` text
NORMAL-LIKE
REDUCED RESPONSE PATTERN
ASYMMETRIC RESPONSE PATTERN
INCONCLUSIVE
```

This should not be described as a medical diagnosis.

------------------------------------------------------------------------

## Option B --- Measurement Quality Classification

Input:

-   landmark stability,
-   pupil circularity,
-   missing-frame ratio,
-   head movement,
-   brightness,
-   blur,
-   tracking continuity.

Output:

``` text
GOOD
ACCEPTABLE
POOR
```

This can directly control the fallback system.

------------------------------------------------------------------------

## Option C --- Pupil Candidate Validation

``` text
Candidate pupil regions
       ↓
ML classifier
       ↓
Pupil / not pupil
```

This can reduce false detections from:

-   reflections,
-   eyelashes,
-   iris boundaries,
-   shadows.

------------------------------------------------------------------------

## Option D --- PLR Waveform Classification

Input the full time-series.

Possible models:

-   1D CNN,
-   LSTM/GRU,
-   classical ML on engineered temporal features.

For a small hackathon dataset, start with classical models.

------------------------------------------------------------------------

# 26. Dataset Problem

This is the most important ML issue.

We need:

``` text
X = features
y = defensible ground-truth label
```

Do NOT:

-   invent labels,
-   randomly label recordings,
-   call an eye-image dataset a concussion dataset,
-   claim clinical accuracy without appropriate clinical ground truth.

------------------------------------------------------------------------

# 27. Relevant Dataset / Research Sources

## PupilEXT

Open-source pupillometry platform/datasets:

https://github.com/openPupil/Open-PupilEXT

Best use:

-   pupil detection,
-   segmentation,
-   tracking,
-   CV validation.

It should not automatically be treated as a clinical concussion dataset.

------------------------------------------------------------------------

## OpenNeuro / NEMAR pupillometry

OpenNeuro:

https://openneuro.org/

NEMAR:

https://www.nemar.org/

These platforms contain pupillometry datasets that can be useful for
signal-processing and ML experiments.

However, cognitive-task pupillometry is not equivalent to clinical
PLR/TBI data.

------------------------------------------------------------------------

## PopEYE

https://zenodo.org/

Useful for ocular-image/eye-state research.

Not a PLR/TBI diagnosis dataset.

------------------------------------------------------------------------

# 28. Important Published ML Evidence

A published cohort study evaluated smartphone pupillometry and machine
learning for acute mild traumatic brain injury.

The study used PLR parameters including:

-   latency,
-   percent change,
-   maximum diameter,
-   minimum diameter,
-   mean constriction velocity,
-   maximum constriction velocity.

It compared models including:

-   random forest,
-   k-nearest neighbors,
-   support vector machine,
-   logistic regression.

The reported best-performing model in that study was a random forest
using the PLR parameters above, with reported overall accuracy of 93.5%,
sensitivity of 96.2%, specificity of 90.9% and F1 of 93.7% under the
study's validation setup.

Source:

https://pmc.ncbi.nlm.nih.gov/articles/PMC12671303/

### CRITICAL

These numbers belong to that published study.

They are NOT OptoPupil results.

We must never put those numbers on the OptoPupil dashboard or claim that
OptoPupil achieves them.

------------------------------------------------------------------------

# 29. Recommended ML Model Order

Start with:

1.  Logistic Regression
2.  Random Forest
3.  SVM
4.  XGBoost

Compare them.

Only consider deep learning if:

-   sufficient data exists,
-   labels are good,
-   the simpler models are insufficient,
-   and the additional complexity is justified.

------------------------------------------------------------------------

# 30. Why Random Forest Is a Strong Baseline

Random Forest works well with:

-   tabular features,
-   nonlinear relationships,
-   mixed feature scales,
-   relatively small datasets,
-   limited training time.

It also provides useful feature-importance information.

Potential feature importance visualization:

``` text
Latency              ███████████
Amplitude            █████████
MCV                  ████████
Asymmetry            ███████
Recovery time        █████
Tracking quality     ████
```

The actual values must come from the trained model.

------------------------------------------------------------------------

# 31. ML Features

Potential feature schema:

  Feature                  Description
  ------------------------ -------------------------------------
  baseline_left            Baseline left pupil diameter
  baseline_right           Baseline right pupil diameter
  min_left                 Minimum left diameter
  min_right                Minimum right diameter
  amplitude_left           Left constriction amplitude
  amplitude_right          Right constriction amplitude
  constriction_pct_left    Left percentage constriction
  constriction_pct_right   Right percentage constriction
  latency_left             Left response latency
  latency_right            Right response latency
  mcv_left                 Left maximum constriction velocity
  mcv_right                Right maximum constriction velocity
  recovery_time_left       Left recovery time
  recovery_time_right      Right recovery time
  asymmetry                Bilateral asymmetry
  missing_frame_ratio      Recording quality
  landmark_jitter          Landmark stability
  brightness               Lighting measure

------------------------------------------------------------------------

# 32. Training Data Format

Example time-series:

``` csv
session_id,subject_id,time,stimulus,left_pupil_px,right_pupil_px,brightness
S001,P001,0.00,0,82,81,0.42
S001,P001,0.10,0,81,80,0.43
S001,P001,0.20,1,79,78,0.89
```

Feature dataset:

``` csv
session_id,subject_id,baseline_left,baseline_right,min_left,min_right,amplitude_left,amplitude_right,latency_left,latency_right,mcv_left,mcv_right,asymmetry,tracking_quality,label
S001,P001,4.52,4.48,3.71,3.82,0.81,0.66,0.24,0.29,2.1,1.7,0.18,0.96,NORMAL
```

------------------------------------------------------------------------

# 33. Critical ML Validation Rule

If multiple recordings come from the same person:

**Do not randomly distribute recordings from the same subject across
train and test.**

Otherwise the model can learn subject-specific characteristics.

Use subject-level splitting:

``` text
TRAIN
Subject A
Subject B
Subject C
Subject D

TEST
Subject E
Subject F
```

Use methods such as:

-   GroupShuffleSplit,
-   GroupKFold.

------------------------------------------------------------------------

# 34. ML Evaluation

Use:

-   accuracy,
-   precision,
-   recall,
-   F1-score,
-   confusion matrix,
-   ROC-AUC where appropriate.

Never invent metrics.

------------------------------------------------------------------------

# 35. AI First-Aid Integration

The proposed enhancement is an AI first-aid assistant, especially useful
when screening is performed after an injury such as a possible
concussion.

Input:

``` text
Objective PLR measurements
+
Manual patient context
```

Manual context can include:

-   mechanism of injury,
-   time since injury,
-   loss of consciousness,
-   vomiting,
-   confusion/disorientation,
-   severe/worsening headache,
-   drowsiness/difficulty waking,
-   seizure,
-   memory loss,
-   neck pain,
-   dizziness,
-   free-text notes.

------------------------------------------------------------------------

# 36. Safety Architecture

Do NOT use a generative model as the sole emergency decision-maker.

Use:

``` text
Objective measurements
+
Manual symptoms
        ↓
Deterministic safety/red-flag engine
        ↓
AI explanation / guidance
```

The safety engine should be able to trigger emergency escalation
independently of the LLM.

------------------------------------------------------------------------

# 37. Red-Flag Examples

CDC lists danger signs after head injury including:

-   seizures,
-   repeated vomiting,
-   worsening headache,
-   increasing confusion,
-   inability to wake,
-   weakness/numbness/decreased coordination,
-   slurred speech,
-   unequal pupils.

CDC:

https://www.cdc.gov/heads-up/signs-symptoms/index.html

Adult mild-TBI/concussion information:

https://www.cdc.gov/traumatic-brain-injury/signs-symptoms/index.html

The exact clinical rules used in the application should be sourced and
documented.

------------------------------------------------------------------------

# 38. AI First-Aid UI

Suggested card:

``` text
┌──────────────────────────────────────┐
│ AI FIRST-AID COPILOT                 │
├──────────────────────────────────────┤
│ PRIORITY: HIGH                       │
│                                      │
│ OBSERVATIONS                         │
│ • PLR recording completed            │
│ • Bilateral asymmetry observed       │
│ • Vomiting reported                  │
│                                      │
│ IMMEDIATE ACTION                     │
│ Seek urgent medical evaluation.      │
│                                      │
│ DO NOT                                │
│ • Leave the person unattended        │
│ • Ignore worsening symptoms          │
│                                      │
│ WHY                                  │
│ Explanation grounded in references   │
│                                      │
│ ⚠ Screening assistance only.        │
│   Not a diagnosis.                  │
└──────────────────────────────────────┘
```

------------------------------------------------------------------------

# 39. Grounded AI

The AI should not freestyle medical advice.

Recommended:

``` text
Patient information
+
OptoPupil measurements
+
Authoritative medical guidance
        ↓
LLM
        ↓
Concise guidance
```

For the hackathon, the knowledge base can be small and curated rather
than an enormous RAG system.

Use authoritative sources such as:

-   CDC,
-   official health agencies,
-   recognized clinical guidance.

------------------------------------------------------------------------

# 40. What the AI Should NOT Do

It should NOT:

-   diagnose concussion,
-   prescribe medication,
-   fabricate medical measurements,
-   override emergency rules,
-   claim clinical validation,
-   turn a low-confidence CV result into a definitive finding.

------------------------------------------------------------------------

# 41. Dashboard Design

The UI should look like a **clinical measurement cockpit**, not a
generic SaaS dashboard.

Core live information:

``` text
LEFT PUPIL
4.21 mm

RIGHT PUPIL
4.18 mm

LATENCY
0.24 s

MCV
...

AMPLITUDE
...

ASYMMETRY
...

TRACKING QUALITY
94%
```

Central graph:

``` text
Pupil Diameter
      │
4.5 ┤──────╲
4.3 ┤       ╲
4.1 ┤        ╲
3.9 ┤         ╲___
3.7 ┤             ╲__
    └────────────────── Time
           ↑
        Stimulus
```

------------------------------------------------------------------------

# 42. Mobile Dashboard

On mobile, stack the same information vertically:

``` text
OPTO PUPIL
──────────────
Camera View
──────────────
Tracking Quality
──────────────
Left Pupil
──────────────
Right Pupil
──────────────
PLR Graph
──────────────
Latency
──────────────
Amplitude
──────────────
MCV
──────────────
Asymmetry
──────────────
Patient Context
──────────────
AI First-Aid
```

No feature should exist only on desktop.

------------------------------------------------------------------------

# 43. Recommended Project Structure

``` text
optopupil/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── state/
│   │
│   ├── vision/
│   │   ├── faceDetection/
│   │   ├── irisDetection/
│   │   ├── pupilSegmentation/
│   │   └── trackingQuality/
│   │
│   ├── signal/
│   │   ├── smoothing/
│   │   ├── interpolation/
│   │   └── derivatives/
│   │
│   ├── plr/
│   │   ├── latency/
│   │   ├── amplitude/
│   │   ├── constrictionVelocity/
│   │   └── bilateralAsymmetry/
│   │
│   ├── fallback/
│   │   ├── qualityMonitor/
│   │   ├── recoveryManager/
│   │   ├── recalibration/
│   │   └── retryManager/
│   │
│   ├── safety/
│   │   └── redFlags/
│   │
│   └── ai/
│       ├── firstAid/
│       └── grounding/
│
├── ml/
│   ├── data/
│   ├── notebooks/
│   ├── src/
│   ├── models/
│   └── reports/
│
├── public/
│
├── package.json
├── vite.config.*
└── README.md
```

------------------------------------------------------------------------

# 44. ML Folder

``` text
ml/
├── data/
│   ├── raw/
│   ├── processed/
│   └── labels/
│
├── notebooks/
│   ├── 01_exploration.ipynb
│   ├── 02_preprocessing.ipynb
│   ├── 03_features.ipynb
│   ├── 04_training.ipynb
│   └── 05_evaluation.ipynb
│
├── src/
│   ├── preprocessing.py
│   ├── features.py
│   ├── train.py
│   ├── evaluate.py
│   └── inference.py
│
├── models/
│   └── optopupil_model.*
│
└── reports/
    ├── metrics.json
    ├── confusion_matrix.png
    └── feature_importance.png
```

------------------------------------------------------------------------

# 45. Runtime ML Options

## Option A --- Python backend

``` text
React
 ↓
FastAPI
 ↓
Python ML model
 ↓
Prediction
```

Advantages:

-   easiest Python ML integration,
-   scikit-learn/XGBoost support,
-   easy experimentation.

## Option B --- Browser inference

``` text
React
 ↓
Feature extraction
 ↓
ONNX / TensorFlow.js
 ↓
Prediction
```

Advantages:

-   low latency,
-   privacy-friendly,
-   no inference request required.

For a 24-hour hackathon, use whichever is simplest after the model is
trained.

------------------------------------------------------------------------

# 46. Deployment

Recommended:

``` text
GitHub
   ↓
Netlify
   ↓
HTTPS
   ↓
OptoPupil PWA
```

The Netlify Free plan currently provides free deployment capabilities
with a monthly credit limit.

Camera access in production requires HTTPS.

Deployment must be tested before the final demo.

------------------------------------------------------------------------

# 47. Optional Supabase

Only add it if time permits.

Possible data:

``` text
Patient/session ID
Timestamp
PLR metrics
ML result
Tracking quality
AI guidance
```

For the demo, local session state is sufficient.

Do not allow database work to delay the CV pipeline.

------------------------------------------------------------------------

# 48. Optional Voice

The browser Web Speech API can be used for speech synthesis.

Potential output:

> "OptoPupil screening complete."

or:

> "Tracking quality is low. Please reposition your face."

This is a polish feature.

It should not be built before the core system.

------------------------------------------------------------------------

# 49. 24-Hour Hackathon Plan

## Hours 0--2 --- Foundation

Build:

-   React/Vite app,
-   PWA setup,
-   responsive shell,
-   routes/state,
-   basic camera screen.

------------------------------------------------------------------------

## Hours 2--6 --- Computer Vision

Build:

-   camera stream,
-   MediaPipe,
-   face detection,
-   eye/iris localization,
-   eye ROI,
-   first pupil detection.

This is the highest-risk block.

------------------------------------------------------------------------

## Hours 6--9 --- Calibration + Stimulus

Build:

-   baseline,
-   iris-ratio calibration,
-   stimulus controller,
-   stimulus timestamp,
-   recording state.

------------------------------------------------------------------------

## Hours 9--12 --- PLR Analytics

Build:

-   time-series,
-   smoothing,
-   latency,
-   amplitude,
-   MCV,
-   bilateral comparison,
-   graph.

------------------------------------------------------------------------

## Hours 12--14 --- Dashboard

Build:

-   clinical cockpit,
-   metrics,
-   live tracking quality,
-   graph,
-   responsive mobile layout.

------------------------------------------------------------------------

## Hours 14--16 --- Patient Context

Add:

-   injury information,
-   symptoms,
-   manual entry.

------------------------------------------------------------------------

## Hours 16--19 --- AI

Build:

-   deterministic red flags,
-   grounded first-aid guidance,
-   AI response,
-   safety disclaimer.

------------------------------------------------------------------------

## Hours 19--21 --- Reliability

Build:

-   tracking confidence,
-   recovery,
-   recalibration,
-   retry,
-   inconclusive state.

------------------------------------------------------------------------

## Hours 21--22 --- Feature Freeze

STOP adding features.

------------------------------------------------------------------------

## Hours 22--23 --- Deployment

Test:

-   HTTPS,
-   camera permissions,
-   environment variables,
-   AI API,
-   CORS,
-   production build,
-   PWA behavior.

------------------------------------------------------------------------

## Hours 23--24 --- Demo Hardening

Perform at least 5--10 complete demo runs.

Test:

-   normal run,
-   poor positioning,
-   face movement,
-   lighting changes,
-   AI path,
-   red-flag path,
-   reload,
-   mobile viewport.

------------------------------------------------------------------------

# 50. Priority Tiers

## Tier 1 --- MUST WORK

-   camera,
-   MediaPipe,
-   pupil detection,
-   baseline,
-   stimulus,
-   PLR recording,
-   PLR graph,
-   metrics,
-   reliability indicator.

## Tier 2 --- SHOULD WORK

-   manual context,
-   safety engine,
-   AI first-aid,
-   fallback,
-   ML model.

## Tier 3 --- ONLY IF TIME

-   PDF report,
-   history,
-   authentication,
-   advanced database,
-   offline mode,
-   voice,
-   advanced animations,
-   extra ML models.

------------------------------------------------------------------------

# 51. Where We Should Focus MOST

Recommended engineering attention:

``` text
35%  Computer vision / pupil tracking
25%  PLR measurement / signal processing
15%  Calibration + reliability
10%  Dashboard / UX
10%  AI first-aid
 5%  Deployment / polish
```

For your personal ML responsibility, however:

``` text
Dataset + labels
       ↓
Feature engineering
       ↓
Baseline models
       ↓
Validation
       ↓
Best model
       ↓
Runtime integration
```

------------------------------------------------------------------------

# 52. What NOT to Build

Do not spend hackathon time on:

-   authentication,
-   complex user management,
-   elaborate admin dashboards,
-   huge database architecture,
-   native mobile apps,
-   training a giant deep-learning model from scratch,
-   multiple AI agents,
-   complicated offline architecture,
-   excessive animation,
-   unnecessary microservices.

------------------------------------------------------------------------

# 53. The Highest-Risk Technical Areas

## Risk 1 --- Pupil detection

If the pupil cannot be reliably extracted, everything downstream fails.

## Risk 2 --- Webcam quality

Consumer cameras have:

-   autofocus,
-   exposure changes,
-   motion blur,
-   limited frame rate,
-   reflections.

## Risk 3 --- Calibration

Pixel-to-mm conversion must be carefully qualified.

## Risk 4 --- Stimulus consistency

Display brightness and environmental lighting vary.

## Risk 5 --- ML labels

A model cannot be scientifically meaningful without defensible labels.

## Risk 6 --- Medical overclaiming

Do not present a prototype as a clinically validated diagnostic system.

------------------------------------------------------------------------

# 54. Demo Story

The best demo sequence:

``` text
1. Open OptoPupil
       ↓
2. Start screening
       ↓
3. Camera finds face
       ↓
4. Eyes detected
       ↓
5. Calibration
       ↓
6. Baseline captured
       ↓
7. Controlled light stimulus
       ↓
8. Live bilateral pupil response
       ↓
9. PLR waveform appears
       ↓
10. Metrics populate
       ↓
11. ML / quality result appears
       ↓
12. Enter injury context
       ↓
13. Safety engine evaluates red flags
       ↓
14. AI First-Aid Copilot explains next steps
       ↓
15. Deliberately move face
       ↓
16. Tracking quality drops
       ↓
17. Recovery / recalibration
       ↓
18. Screening resumes
```

This demonstrates the entire engineering story.

------------------------------------------------------------------------

# 55. Pitch Positioning

Strong framing:

> **"OptoPupil turns an ordinary camera and display into a
> software-based quantitative PLR screening system."**

Then explain:

> "We combine ML-based ocular landmark detection, computer vision,
> signal processing and a dedicated ML layer to turn pupil dynamics into
> measurable screening information."

Then:

> "A deterministic safety engine handles critical red flags, while a
> grounded AI copilot translates the findings and patient context into
> actionable first-aid and escalation guidance."

Avoid:

> "Our AI diagnoses concussion."

------------------------------------------------------------------------

# 56. Scientific / Clinical Positioning

Use:

-   screening,
-   triage support,
-   quantitative measurement,
-   response pattern,
-   decision support,
-   proof of concept.

Avoid:

-   diagnosis,
-   clinically proven,
-   medical-grade,
-   concussion detector,
-   guaranteed accuracy.

The proposal's own roadmap places clinical validation after prototype
development.

------------------------------------------------------------------------

# 57. Strong Technical Differentiators

The project can be differentiated by combining:

### 1. Zero specialized hardware

Standard camera + display.

### 2. Bilateral PLR

Both pupils are tracked.

### 3. Quantitative time-series

Not just:

> "pupils constricted."

Instead:

-   latency,
-   amplitude,
-   MCV,
-   asymmetry.

### 4. Reliability-aware CV

The system knows when it cannot trust its own measurement.

### 5. ML

A trained model performs a defined classification/quality task.

### 6. Safety-first AI

Rules handle critical red flags; AI explains rather than improvises
emergency decisions.

### 7. Cross-device PWA

Same workflow on laptop and mobile.

------------------------------------------------------------------------

# 58. Strongest ML Story

A technically strong explanation:

> "OptoPupil uses ML at multiple levels. MediaPipe provides ML-based
> ocular landmark localization, while our custom ML layer operates on
> quantitative PLR and tracking features extracted from the recorded
> response. The custom model is trained for a clearly defined
> classification task rather than being presented as an unsupported
> diagnostic model. A deterministic safety layer independently handles
> critical red flags."

------------------------------------------------------------------------

# 59. Strongest Reliability Story

> "The system does not assume every webcam frame is trustworthy.
> OptoPupil continuously evaluates tracking quality. If the measurement
> becomes unreliable, the system attempts recovery and recalibration. If
> confidence cannot be restored, it reports the screening as
> inconclusive rather than generating a fabricated medical result."

This is an important engineering principle.

------------------------------------------------------------------------

# 60. Strongest AI Story

> "The AI is not the emergency decision-maker. Objective measurements
> and patient context first pass through a deterministic safety layer.
> The grounded AI layer then explains the findings, provides appropriate
> first-aid information and recommends escalation when the safety rules
> indicate it."

------------------------------------------------------------------------

# 61. What Must Be True Before We Claim Success

The minimum successful prototype is:

``` text
Camera works
        +
Face/eyes detected
        +
Pupil tracked
        +
Stimulus controlled
        +
Pupil response recorded
        +
PLR metrics calculated
        +
Graph shown
        +
Reliability state shown
```

Then:

``` text
Manual patient context
        +
Safety rules
        +
AI guidance
```

Then:

``` text
ML model
        +
Runtime inference
```

The order matters.

------------------------------------------------------------------------

# 62. Final Product Architecture

``` text
                         ┌─────────────────────┐
                         │   OPTO PUPIL PWA    │
                         └──────────┬──────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
             LAPTOP VIEW                         MOBILE VIEW
                  │                                   │
             Camera + Display                    Camera + Display
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    ↓
                           MEDIA PIPE ML
                                    ↓
                         FACE / EYE LANDMARKS
                                    ↓
                              OPENCV.JS
                                    ↓
                          PUPIL SEGMENTATION
                                    ↓
                          PUPIL TIME-SERIES
                                    ↓
                          SIGNAL PROCESSING
                                    ↓
                        ┌───────────┴───────────┐
                        │                       │
                  PLR ANALYTICS            QUALITY
                        │                       │
                  ┌─────┼─────┐                ↓
                  │     │     │            FALLBACK
               Latency Amp    MCV              │
                  │     │     │                │
                  └─────┼─────┘                │
                        ↓                      │
                  BILATERAL DATA ←─────────────┘
                        ↓
                   CUSTOM ML
                        ↓
                 PATTERN / QUALITY
                        ↓
               PATIENT CONTEXT
                        ↓
               SAFETY / RED FLAGS
                        ↓
                 GROUNDED AI
                        ↓
               FIRST-AID GUIDANCE
                        ↓
                  FULL REPORT
```

------------------------------------------------------------------------

# 63. Final Development Philosophy

The project should follow this rule:

> **Measurement first. Intelligence second. AI third.**

Meaning:

``` text
Reliable pixels
      ↓
Reliable measurements
      ↓
Reliable features
      ↓
Reliable ML
      ↓
Reliable safety logic
      ↓
Useful AI explanation
```

If the first layer is unreliable, no amount of AI can fix it.

------------------------------------------------------------------------

# 64. Immediate Action Plan

Before asking Antigravity to build the entire system:

### Step 1

Create the PWA foundation.

### Step 2

Test camera.

### Step 3

Integrate MediaPipe.

### Step 4

Get eye ROI.

### Step 5

Get pupil candidate.

### Step 6

Display a live pupil measurement.

### Step 7

Record a time-series.

### Step 8

Implement stimulus.

### Step 9

Calculate PLR features.

### Step 10

Build reliability.

### Step 11

Create the ML dataset.

### Step 12

Train ML model.

### Step 13

Integrate ML inference.

### Step 14

Build safety rules.

### Step 15

Integrate grounded AI.

### Step 16

Polish dashboard.

### Step 17

Deploy.

### Step 18

Run complete demo repeatedly.

------------------------------------------------------------------------

# 65. Reference Links

## Core engineering

-   MediaPipe Face Landmarker:
    https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker

-   MediaPipe Web:
    https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js

-   OpenCV: https://docs.opencv.org/

-   Vite PWA: https://github.com/vite-pwa/vite-plugin-pwa

## ML

-   scikit-learn: https://scikit-learn.org/

-   XGBoost: https://xgboost.readthedocs.io/

-   TensorFlow.js: https://www.tensorflow.org/js

-   ONNX Runtime Web:
    https://onnxruntime.ai/docs/get-started/with-javascript/web.html

## AI

-   Gemini API: https://ai.google.dev/

-   Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing

-   Gemini rate limits:
    https://ai.google.dev/gemini-api/docs/rate-limits

## Data

-   OpenNeuro: https://openneuro.org/

-   NEMAR: https://www.nemar.org/

-   PupilEXT: https://github.com/openPupil/Open-PupilEXT

## Deployment

-   Netlify: https://www.netlify.com/pricing/

-   Supabase: https://supabase.com/pricing

## Medical reference

-   CDC concussion signs:
    https://www.cdc.gov/heads-up/signs-symptoms/index.html

-   CDC mild TBI:
    https://www.cdc.gov/traumatic-brain-injury/signs-symptoms/index.html

## Relevant research

-   Smartphone Pupillometry and Machine Learning for Acute mTBI:
    https://pmc.ncbi.nlm.nih.gov/articles/PMC12671303/

------------------------------------------------------------------------

# 66. One-Sentence Definition

> **OptoPupil is a responsive, zero-hardware PWA that uses a standard
> camera and display to capture bilateral pupillary light reflex
> dynamics, quantify the response using computer vision and signal
> processing, apply a defined ML model to the extracted data, detect
> unreliable recordings, and provide safety-first, grounded AI guidance
> for screening and triage support.**

------------------------------------------------------------------------

# 67. The Winning Principle

Do not try to win because the project has the most features.

Win because the judges can see:

``` text
REAL CAMERA
     ↓
REAL EYE
     ↓
REAL PUPIL TRACKING
     ↓
REAL TIME-SERIES
     ↓
REAL PLR METRICS
     ↓
REAL ML INFERENCE
     ↓
REAL RELIABILITY HANDLING
     ↓
REAL SAFETY LOGIC
     ↓
REAL AI EXPLANATION
```

**Stability \> features.**

**Valid measurements \> impressive claims.**

**Defensible ML \> fake AI.**

**Safety \> automation.**

**A working demo \> a huge architecture diagram.**
