# Video Grid Studio

> **Spatial video splitter and seamless frame-accurate reassembler.**  
> A production-ready, client-side static web application designed for high-precision video wall matrix slicing, multi-screen installations, and mathematical grid reassembly without temporal segmentation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Static Hosting](https://img.shields.io/badge/deployment-GitHub%20Pages%20Ready-success.svg)
![FFmpeg.wasm](https://img.shields.io/badge/FFmpeg.wasm-v0.12-purple.svg)
![Test Suite](https://img.shields.io/badge/Vitest-100%25%20Passing-brightgreen.svg)

---

## 🚀 Key Highlights & Philosophy

Unlike standard video cutters that slice clips sequentially over time, **Video Grid Studio** spatially divides each video frame into an $R \times C$ matrix of independent, full-duration videos. Each resulting tile starts at time $t=0$, runs the full duration of the original clip, and preserves source presentation timestamps.

The companion **Reverse Reassembler** reconstructs the original full-frame master from those tiles with exact pixel coordinates, zero border resampling, sub-frame presentation clock synchronization, and single-source master audio preservation.

---

## 📐 Deterministic Geometric Formulation

To guarantee zero pixel overlap, zero gaps, and deterministic partitioning across arbitrary resolutions (including odd dimensions like $1921 \times 1081$):

For an input video of coded width $W$ and height $H$, divided into $R$ rows and $C$ columns:

$$x_0(c) = \left\lfloor \frac{c \cdot W}{C} \right\rfloor, \quad x_1(c) = \left\lfloor \frac{(c + 1) \cdot W}{C} \right\rfloor$$

$$y_0(r) = \left\lfloor \frac{r \cdot H}{R} \right\rfloor, \quad y_1(r) = \left\lfloor \frac{(r + 1) \cdot H}{R} \right\rfloor$$

$$\text{Tile Width} = x_1(c) - x_0(c), \quad \text{Tile Height} = y_1(r) - y_0(r)$$

### Geometric Invariants
1. **Exact Partitioning**: Every pixel $(x, y) \in [0, W) \times [0, H)$ belongs to **exactly one** tile.
2. **Dimension Conservation**:
   $$\sum_{c=0}^{C-1} (x_1(c) - x_0(c)) = W, \quad \sum_{r=0}^{R-1} (y_1(r) - y_0(r)) = H$$
3. **Bounded Discrepancy**: On non-divisible dimensions, adjacent tiles differ by at most 1 pixel.

---

## 🛠 Features & Capabilities

### 1. Spatial Video Splitting
- **Input Formats**: MP4, WebM, MOV, MKV via browser HTML5 Media & FFmpeg.wasm pipelines.
- **Grid Presets**: 2×2 (4), 3×3 (9), 4×4 (16), 5×5 (25), 3×5 (15), plus custom row/col counts.
- **Asymmetric Grid Cuts**: Support for custom proportional column and row divisions.
- **Quality Modes**:
  - **Fast**: H.264 ultrafast, CRF 26 for rapid drafts.
  - **High Quality**: H.264 medium, CRF 18 for pristine spatial fidelity.
  - **Lossless**: CRF 0 / lossless pipeline for verification.
- **Audio Preservation**: Master stereo audio extracted **once** into `master_audio.aac`; audio is **not** duplicated in each tile to prevent phase smearing or excessive archive size.
- **Export Options**: Individual tile downloads, or **Download All ZIP** containing all tiles, audio, and a self-describing `manifest.json`.

### 2. Reverse Reassembly & Compositing
- **Automated Archive Ingestion**: Import ZIP archives containing `manifest.json` and tile videos with automatic alignment and checksum validation.
- **Manual Mapping**: Flexible tile mapping when manifest is absent or modified.
- **Frame-Accurate Master Clock**: Slaves all tile streams to a single monotonic presentation clock with drift detection and sub-frame correction.
- **Interactive Split/Rejoin Demonstration**: Visual slider separating tiles in 2D/3D space and snapping them back seamlessly into full-frame composition.
- **Full-Resolution Export**: Seamless multi-stream compositing via FFmpeg `xstack` with audio track multiplexing.

### 3. Precision Verification & Seam Inspector
- **Frame Difference Metrics**: Computes live Peak Signal-to-Noise Ratio (PSNR in dB), Structural Similarity Index (SSIM), Mean Squared Error (MSE), and maximum pixel error.
- **Seam Error Heatmap**: Amplified false-color visualizer highlighting boundary quantization and chroma subsampling shifts.
- **Split-Screen Wipe**: Interactive before/after scrubber slider.

### 4. Video Wall & Physical Display Matrix
- **Bezel Compensation**: Adjust horizontal and vertical display gap offsets.
- **Calibration Patterns**: SMPTE color bars, high-contrast alignment grids, and center crosshairs.
- **Per-Tile Image Tuning**: Independent brightness, contrast, saturation, rotation, and horizontal/vertical flip per tile.

---

## 🧪 Acceptance Test Suite

The project includes an automated test suite powered by [Vitest](https://vitest.dev). All tests run locally and in GitHub Actions CI:

```bash
npm test
```

### Verified Acceptance Criteria:
- ✅ **1920×1080 @ 30fps Source**: $3 \times 3$ grid yields exactly nine $640 \times 360$ tiles, each running full duration, reconstructing to $1920 \times 1080$.
- ✅ **4×4 and Custom 3×5 Grids**: Reconstruct without any geometric gaps or overlaps.
- ✅ **1921×1081 Odd Dimension Benchmark**: Validates that all 2,076,601 pixels are covered exactly once, and tiles differ by at most 1 pixel.
- ✅ **Deterministic Hashing**: SHA-256 calculation for every tile with manifest verification.
- ✅ **Master Presentation Clock**: Precise forward/backward single-frame stepping ($\pm 1/\text{fps}$) and seeking.
- ✅ **Seam Quality Metrics**: Lossless pipeline verifies zero MSE / 100 dB PSNR; lossy pipeline reports accurate metrics without claiming byte identity.

---

## 💻 Local Setup & Development

### Prerequisites
- Node.js 18+ (tested on Node 20 & 24)
- npm or pnpm

### Quickstart

1. **Clone the repository**:
   ```bash
   git clone https://github.com/USERNAME/video-grid-studio.git
   cd video-grid-studio
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Run automated test suite**:
   ```bash
   npm test
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🌐 GitHub Pages Deployment Guide

**Video Grid Studio** is designed as a 100% static client-side web application. It requires zero server backend.

### Automatic Deployment with GitHub Actions

1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/USERNAME/video-grid-studio.git
   git branch -M main
   git push -u origin main
   ```

2. In your repository on GitHub:
   - Navigate to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.

3. On every push to `main`, the included `.github/workflows/deploy.yml` workflow will:
   - Checkout code and setup Node.js.
   - Run the automated Vitest acceptance test suite.
   - Build the production bundle into `dist/`.
   - Publish live to `https://USERNAME.github.io/video-grid-studio/`.

---

## 🔒 Cross-Origin Isolation & WASM Support

Multi-threaded WebAssembly in modern browsers requires **Cross-Origin Opener Policy** (`same-origin`) and **Cross-Origin Embedder Policy** (`require-corp`).

- **Built-in `coi-serviceworker`**: Video Grid Studio bundles a self-registering service worker (`public/coi-serviceworker.js`) that injects these headers transparently on static hosting environments like GitHub Pages.
- **Single-Threaded Fallback**: If cross-origin isolation is not enabled or SharedArrayBuffer is restricted, the app automatically switches to the bundled single-threaded WASM core.
- **Offline Self-Contained Assets**: FFmpeg WASM binaries (`ffmpeg-core.js` and `ffmpeg-core.wasm`) are bundled locally under `public/ffmpeg/` to ensure offline capability and eliminate third-party CDN reliance.

---

## 📄 License

MIT License. Designed and engineered for production video wall and grid operations.
