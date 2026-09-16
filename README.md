# OptoPupil

> **Zero-Hardware Quantitative Pupillary Light Reflex (PLR) Screening**  
> *Developed for VMEDITHON 3.0*
>
> # Links
> Live deployed link - https://optopupil.vercel.app/
> - Kaggle notebook link - https://www.kaggle.com/code/jyotish1628/notebook64ebcbbf14/notebook
> - Kaggle real dataset link - https://www.kaggle.com/datasets/itguides/pupil-eye-and-iris-segmentation

OptoPupil is a browser-based screening application that uses a standard device camera and display to capture and analyze pupillary light reflex dynamics without requiring specialized pupillometer hardware.

---

## Milestone 1: Computer Vision Foundation

This repository contains the first working Computer Vision (CV) milestone of OptoPupil:

- **Browser Camera Module**: Reusable `useCamera` hook leveraging the native `navigator.mediaDevices.getUserMedia` API with lifecycle track clean-up and dynamic resolution detection.
- **MediaPipe Tasks Vision**: Real-time in-browser `FaceLandmarker` integration running via WebAssembly and GPU acceleration.
- **Ocular & Iris Extraction**:
  - Left and right eye contour boundaries (16-point anatomical contour).
  - Left and right iris center landmarks (indices 468 & 473) and 4-point perimeter boundaries.
  - Normalized interpupillary distance calculation.
- **Tracking Quality Engine**: Real-time evaluation of detection state (`GOOD`, `DEGRADED`, `LOST`) with actionable clinical positioning guidance.
- **Live Canvas Visualization**: 60 FPS hardware-accelerated canvas overlay with zero React re-render overhead.
- **Responsive Architecture**: One unified PWA codebase tailored for desktop (1280×800) and mobile (390×844) viewports.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide Icons
- **Computer Vision**: `@mediapipe/tasks-vision`
- **Platform**: Progressive Web App (PWA)

---

## Project Structure

```
src/
├── camera/
│   ├── types.ts              # Camera status and resolution types
│   └── useCamera.ts          # MediaDevices hook with lifecycle management
├── components/
│   ├── common/
│   │   └── StatusBadge.tsx   # Live status badges (GOOD / DEGRADED / LOST)
│   ├── layout/
│   │   ├── Header.tsx        # Topbar with branding and pipeline indicator
│   │   └── Footer.tsx        # Privacy and clinical disclaimers
│   └── vision/
│       ├── CameraView.tsx    # Video & Canvas viewport overlay
│       └── TrackingPanel.tsx # Real-time CV diagnostics & guidance
├── hooks/
│   └── useVisionPipeline.ts  # rAF loop coordinating FaceLandmarker & extractors
├── pages/
│   ├── LandingPage.tsx       # Clinical hero and core pillars
│   └── VisionPage.tsx        # Live Computer Vision milestone interface
├── types/
│   └── vision.ts             # Landmark, ocular, and tracking quality data contracts
├── vision/
│   ├── eyes/
│   │   ├── indices.ts        # Centralized MediaPipe landmark indices
│   │   └── EyeExtractor.ts   # Bilateral eye contour & iris geometric extractor
│   ├── face/
│   │   ├── FaceLandmarkerService.ts # Singleton MediaPipe Tasks Vision service
│   │   └── types.ts
│   └── tracking/
│       └── TrackingEvaluator.ts     # Real-time tracking quality evaluator
├── App.tsx
├── index.css
└── main.tsx
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Modern browser with WebAssembly & WebGL support (Chrome, Edge, Safari, Firefox)

### Installation
```bash
# Clone the repository
git clone https://github.com/Jyo-08/OptoPupil.git
cd OptoPupil

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

---

## Clinical Disclaimer

OptoPupil is an experimental prototype created for VMEDITHON 3.0. It is intended for **screening assistance and decision-support research only** and is **not** a clinically validated medical diagnosis or diagnostic medical device.
