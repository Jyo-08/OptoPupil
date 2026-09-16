# OptoPupil

## Zero-Hardware Quantitative Pupillary Light Reflex Screening

OptoPupil is a browser-based computer vision application designed to explore quantitative pupillary light reflex (PLR) screening using only a standard device camera and display.

The project aims to reduce the dependency on specialized pupillometry hardware by establishing a camera-based vision pipeline capable of detecting and tracking ocular landmarks in real time. The current implementation represents the first computer vision milestone of the system, focusing on reliable eye and iris localization, tracking quality assessment, and real-time visualization.

Developed for **VMEDITHON 3.0**.

---

## Resources

| Resource                  | Link                                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| Live Deployed Application | https://optopupil.vercel.app/                                            |
| Kaggle Notebook           | https://www.kaggle.com/code/jyotish1628/notebook64ebcbbf14/notebook      |
| Kaggle Real Dataset       | https://www.kaggle.com/datasets/itguides/pupil-eye-and-iris-segmentation |

---

## Overview

The pupillary light reflex is the change in pupil size in response to changes in light intensity. Quantitative analysis of this response can provide useful information for research and screening applications.

Traditional pupillometry systems commonly rely on specialized hardware. OptoPupil investigates whether a standard camera-based setup can provide a practical foundation for accessible, software-driven PLR screening.

The current system establishes the computer vision infrastructure required for future quantitative pupil-response analysis.

### Current Pipeline

```text
Device Camera
      |
      v
Camera Stream
      |
      v
MediaPipe Face Landmarker
      |
      v
Eye and Iris Landmark Extraction
      |
      v
Geometric Measurements
      |
      v
Tracking Quality Evaluation
      |
      v
Real-Time Visualization
```

---

## Current Capabilities

### Camera Acquisition

OptoPupil uses the browser's native MediaDevices API to access the device camera.

The camera module provides:

* Camera permission handling
* Dynamic resolution detection
* Camera lifecycle management
* Automatic media-track cleanup
* Support for desktop and mobile devices

### Real-Time Face and Eye Tracking

The project integrates **MediaPipe Tasks Vision Face Landmarker** to obtain facial and ocular landmarks directly in the browser.

The vision pipeline operates locally in the browser and is designed for real-time processing using WebAssembly and GPU acceleration where supported.

### Ocular Landmark Extraction

The current implementation extracts:

* Left eye contour landmarks
* Right eye contour landmarks
* Left iris center
* Right iris center
* Iris perimeter landmarks
* Normalized interpupillary distance

The eye geometry is represented using structured landmark data, allowing additional measurements to be incorporated into the pipeline.

### Tracking Quality Evaluation

OptoPupil continuously evaluates the quality of the detected vision data.

The tracking engine categorizes the current state as:

* `GOOD`
* `DEGRADED`
* `LOST`

The interface also provides positioning guidance when tracking quality decreases, helping users maintain a suitable position relative to the camera.

### Real-Time Visualization

The camera stream is combined with a canvas-based visualization layer that displays the detected ocular landmarks and tracking information.

The rendering pipeline is designed to operate independently from the React rendering cycle, reducing unnecessary component re-renders during continuous vision processing.

### Responsive Application

OptoPupil uses a unified application architecture for different device classes, with interfaces designed around both desktop and mobile viewport configurations.

---

## Technology Stack

| Layer           | Technology                     |
| --------------- | ------------------------------ |
| Frontend        | React 19                       |
| Language        | TypeScript                     |
| Build Tool      | Vite                           |
| Styling         | Tailwind CSS                   |
| Icons           | Lucide                         |
| Computer Vision | MediaPipe Tasks Vision         |
| Rendering       | HTML Canvas                    |
| Platform        | Progressive Web App            |
| Camera Access   | Browser MediaDevices API       |
| Vision Runtime  | WebAssembly / GPU acceleration |

---

## Architecture

The project separates camera acquisition, computer vision processing, tracking evaluation, visualization, and interface components.

```text
src/
├── camera/
│   ├── types.ts
│   └── useCamera.ts
│
├── components/
│   ├── common/
│   │   └── StatusBadge.tsx
│   │
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   │
│   └── vision/
│       ├── CameraView.tsx
│       └── TrackingPanel.tsx
│
├── hooks/
│   └── useVisionPipeline.ts
│
├── pages/
│   ├── LandingPage.tsx
│   └── VisionPage.tsx
│
├── types/
│   └── vision.ts
│
├── vision/
│   ├── eyes/
│   │   ├── indices.ts
│   │   └── EyeExtractor.ts
│   │
│   ├── face/
│   │   ├── FaceLandmarkerService.ts
│   │   └── types.ts
│   │
│   └── tracking/
│       └── TrackingEvaluator.ts
│
├── App.tsx
├── index.css
└── main.tsx
```

### Vision Pipeline

The vision pipeline is coordinated through `useVisionPipeline.ts`.

At runtime, the pipeline:

1. Captures frames from the device camera.
2. Passes frames to the MediaPipe Face Landmarker.
3. Retrieves facial and ocular landmarks.
4. Extracts eye contours and iris geometry.
5. Computes normalized ocular measurements.
6. Evaluates tracking quality.
7. Renders the results through the canvas visualization layer.

This separation allows the computer vision components to evolve independently from the user interface.

---

## Getting Started

### Prerequisites

Make sure the following are installed:

* Node.js 18 or later
* npm
* A modern browser with WebAssembly and WebGL support
* A device with an accessible camera

Supported modern browsers include Chrome, Edge, Safari, and Firefox, subject to browser-specific camera and WebGL capabilities.

### Installation

Clone the repository:

```bash
git clone https://github.com/Jyo-08/OptoPupil.git
```

Navigate to the project directory:

```bash
cd OptoPupil
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local development URL displayed by Vite in your browser.

### Production Build

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## Privacy

OptoPupil is designed around browser-based computer vision processing.

The current vision pipeline processes camera frames within the application environment and does not require a dedicated external pupillometry device.

Users should review the browser's camera permission settings before running the application.

---

## Development Roadmap

The current implementation establishes the computer vision foundation for OptoPupil. Future development can extend this foundation toward quantitative PLR analysis.

Potential development stages include:

### Phase 1 — Computer Vision Foundation

* Camera acquisition
* Face and eye landmark detection
* Iris localization
* Tracking quality evaluation
* Real-time visualization

**Status: Implemented**

### Phase 2 — Pupil Measurement

* Pupil boundary estimation
* Pupil diameter estimation
* Temporal pupil-size tracking
* Blink and occlusion handling
* Measurement stabilization

### Phase 3 — PLR Analysis

* Controlled illumination protocol
* Baseline pupil measurement
* Light-stimulus response tracking
* Constriction amplitude
* Latency estimation
* Recovery dynamics
* Temporal response curves

### Phase 4 — Screening Interface

* Structured screening workflow
* Measurement summaries
* Session-based results
* Quality-control indicators
* Exportable measurement reports

### Phase 5 — Validation

* Comparison against established pupillometry measurements
* Dataset-based evaluation
* Accuracy and repeatability analysis
* Device and lighting-condition testing
* Clinical research validation

---

## Limitations

OptoPupil is currently a research-oriented prototype and should not be considered a replacement for validated clinical pupillometry equipment.

Camera quality, ambient illumination, subject positioning, motion, occlusion, display characteristics, and browser performance can influence computer vision measurements.

The current implementation establishes the infrastructure for quantitative analysis but does not constitute a clinically validated diagnostic system.

---

## Clinical Disclaimer

OptoPupil is an experimental prototype developed for **VMEDITHON 3.0** and is intended for research, screening-assistance, and decision-support exploration.

It is **not a clinically validated medical diagnostic device** and must not be used as a substitute for professional medical examination, diagnosis, or treatment.

Any future clinical application would require appropriate validation, controlled testing, regulatory assessment, and evaluation against established medical instruments.

---

## Project Documentation

The repository includes additional project documentation covering the overall OptoPupil system architecture and development plan.

Refer to:

```text
OptoPupil_Complete_Project_Master_Document.md
```

for the broader project specification.

---

## Contributing

Contributions are welcome as the project evolves.

Potential areas for contribution include:

* Pupil segmentation and measurement
* Computer vision robustness
* Lighting normalization
* PLR signal processing
* Performance optimization
* Mobile browser compatibility
* Accessibility
* Testing and validation
* Documentation

For substantial changes, open an issue first to discuss the proposed implementation.

---


## Project Status

**Current Stage:** Computer Vision Foundation

**Application Type:** Browser-based Computer Vision / Health Technology Prototype

**Primary Focus:** Zero-hardware quantitative pupillary light reflex screening

**Development Status:** Active Prototype

