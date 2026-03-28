# Moon Display Design Recommendations

**Issue:** LUN-25 — "the main moon image in sky feels boring and flat"

**Current State:** SVG-based procedural moon with geometric approximations
**Goal:** More realistic, visually engaging moon that feels alive and authentic

---

## 1. Problem Analysis

### What Makes the Current Moon Feel Flat

| Issue | Current Approach | Why It Falls Short |
|-------|-----------------|-------------------|
| **Surface texture** | Geometric ellipses for maria | Real lunar terrain is irregular, organic |
| **Crater detail** | 16 programmatic circles | Actual moon has thousands of overlapping features |
| **Color palette** | Warm cream (#f5e6c8) | Real moon is cooler gray with subtle color variations |
| **Lighting** | Static gradient at 30% offset | Doesn't respond to phase angle |
| **Terminator** | Sharp mathematical curve | Real shadow boundary is soft, has topographic variation |
| **Highland contrast** | Minimal differentiation | Highlands vs maria should pop more |

### What's Already Working

- Phase calculation and illumination curve
- Basic 3D sphere shading concept
- Outer glow for atmosphere
- Earthshine on dark side (subtle touch)
- Maria placement approximating real positions

---

## 2. Recommended Approaches (Prioritized)

### Option A: Photorealistic Texture Map (Recommended)

**Description:** Replace SVG procedurals with actual NASA lunar imagery as texture.

**Pros:**
- Instantly authentic appearance
- Consistent with app's cosmic theme
- Rich detail at any zoom level
- Recognizable crater patterns (Tycho, Copernicus, etc.)

**Cons:**
- Requires image asset (~50-150KB optimized)
- Need to handle phase masking over image
- Slightly more complex implementation

**Implementation:**
1. Obtain high-quality full moon image (NASA public domain)
2. Optimize to ~800px (web-optimized PNG or WebP)
3. Apply phase mask overlay to reveal correct illumination
4. Add terminator gradient for soft shadow edge
5. Keep outer glow and earthshine from current implementation

**Files to modify:**
- `src/components/MoonFace.jsx` (replace SVG with img + CSS mask)
- `public/` (add moon texture asset)

**Estimated effort:** 4-6 hours engineering

---

### Option B: Enhanced SVG with Organic Shapes

**Description:** Keep SVG approach but add more realistic, hand-traced features.

**Pros:**
- No new assets required
- Scalable to any size
- Full control over styling

**Cons:**
- More complex SVG paths
- Still won't match photorealism
- Higher maintenance burden

**Implementation:**
1. Trace actual maria boundaries from reference photos
2. Add dozens more craters with varied sizes
3. Create ray systems from Tycho/Copernicus
4. Add highland region definition
5. Soften terminator with blur + gradient
6. Adjust color palette to cooler grays

**Estimated effort:** 8-12 hours design + engineering

---

### Option C: WebGL/Canvas Rendering

**Description:** Use procedural 3D rendering for realistic lighting.

**Pros:**
- Dynamic lighting responds to phase
- Could animate subtle features
- Most technically impressive

**Cons:**
- Highest complexity
- Performance concerns on mobile
- Overkill for this use case

**Not recommended for current scope.**

---

## 3. Design Specifications (Option A)

### Moon Texture Requirements

```
Source: NASA/USGS Lunar Reconnaissance Orbiter imagery (public domain)
Resolution: 800x800px minimum
Format: WebP (with PNG fallback)
Compression: 75-80% quality
Target size: < 80KB
Orientation: Standard (Mare Imbrium upper-left, Tycho lower-center)
```

### Color Adjustments

Current warm cream should shift to authentic lunar gray:

```css
/* Current */
--moon-light: #f5e6c8;

/* Proposed */
--moon-highland: #d8d4cc;  /* Bright highlands */
--moon-maria: #8a8580;      /* Dark maria regions */
--moon-shadow: #12121a;     /* Shadow side */
--moon-earthshine: rgba(100, 120, 140, 0.04);  /* Cooler blue tint */
```

### Phase Masking Approach

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│    [Moon Texture Image]                                      │
│            │                                                 │
│            ▼                                                 │
│    [CSS clip-path or SVG mask]                              │
│            │                                                 │
│            ▼ (based on phase 0-1)                           │
│    [Terminator gradient overlay]                             │
│            │                                                 │
│            ▼                                                 │
│    [Outer glow + earthshine]                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Terminator Softening

The shadow edge (terminator) should use a soft gradient rather than a hard line:

```css
/* Add to terminator overlay */
background: linear-gradient(
  to right,
  rgba(0, 0, 0, 0) 0%,
  rgba(0, 0, 0, 0.3) 30%,
  rgba(0, 0, 0, 0.7) 60%,
  rgba(0, 0, 0, 1) 100%
);
width: 20%; /* Of moon diameter */
```

### Subtle Animation

Add gentle "breathing" to the moon glow (already exists in tap hint):

```css
@keyframes moon-pulse {
  0%, 100% { filter: drop-shadow(0 0 35px rgba(245, 230, 200, 0.25)); }
  50% { filter: drop-shadow(0 0 45px rgba(245, 230, 200, 0.35)); }
}

.moon-container {
  animation: moon-pulse 8s ease-in-out infinite;
}
```

---

## 4. Implementation Tasks for Engineering

### P0 — Core Moon Update

1. **Obtain and optimize moon texture**
   - Download NASA LRO full moon image
   - Crop to perfect circle
   - Optimize as WebP (~800px, <80KB)
   - Add as `public/moon-texture.webp`

2. **Refactor MoonFace.jsx**
   - Replace SVG rendering with `<img>` + CSS
   - Implement phase mask using `clip-path` or canvas
   - Port terminator calculation to CSS gradient overlay
   - Keep outer glow and earthshine effects

3. **Update color tokens**
   - Shift moon-related colors to cooler gray palette
   - Update glow color to match

### P1 — Polish

4. **Add subtle pulse animation**
   - 8s cycle, very subtle glow expansion
   - Respects `prefers-reduced-motion`

5. **Add limb darkening**
   - Radial gradient overlay, darker at edges
   - Creates more 3D spherical appearance

6. **Test across phases**
   - New moon (no render or minimal glow)
   - Crescent (thin slice)
   - Quarter (half)
   - Gibbous (most lit)
   - Full (complete texture visible)

### P2 — Optional Enhancements

7. **Libration variation**
   - Moon rocks slightly (±6°) over lunar month
   - Could subtly shift texture position

8. **Touch interaction**
   - Scale up slightly on press
   - Haptic feedback on native

---

## 5. Accessibility Notes

- **Screen readers:** Add `aria-label` with phase description (per LUN-27)
- **Reduced motion:** Disable pulse animation
- **Alt text:** "Moon at {phase}% illumination, {phase name}"

---

## 6. Reference Assets

**NASA Public Domain Moon Images:**
- [Lunar Reconnaissance Orbiter](https://svs.gsfc.nasa.gov/4720) — CGI Moon Kit
- [USGS Lunar Map](https://astrogeology.usgs.gov/search/map/Moon/Clementine/UVVIS/Lunar_Clementine_UVVIS_750nm_Global_Mosaic_118m_v2)

**Color Reference:**
- Apollo 11 photographs show moon as neutral gray, not cream
- Maria are darker basalt, highlands are brighter anorthosite

---

## 7. Summary

**Recommendation:** Proceed with **Option A (Photorealistic Texture Map)**

This provides the highest visual impact for moderate engineering effort. The current SVG approach is clever but inherently limited—no amount of procedural circles will match the organic complexity of actual lunar terrain.

The texture approach also aligns with the app's cosmic authenticity: users are connecting with the *real* moon, so showing them the *real* moon reinforces that connection.

---

## 8. Implementation Notes (Added 2026-03-28)

**Status:** ✅ Implemented (commit f1a479b)

The photorealistic texture approach was implemented with a warm golden color palette instead of the cooler gray tones originally proposed. This decision maintains visual harmony with Luna Loops' warm cream theme (#f5e6c8).

**Actual implementation:**
- Sepia(25%) + saturate(1.3) filter for warmth
- Golden color overlay radial gradient
- Warm outer glow (#FFD778, #FFC864)
- Gold-tinted rim highlight and atmospheric edge
- MiniMoon uses warm gold gradient (#f5d88a to #d4b060)

**Design rationale:**
While astronomically accurate moons are neutral gray, the warm golden treatment:
1. Maintains consistency with the app's existing color language
2. Evokes the emotional warmth users associate with moonlight
3. Creates a more inviting, less clinical feel

This is a valid creative interpretation that prioritizes brand cohesion over strict realism.

---

*Document created: 2026-03-28*
*Last updated: 2026-03-28*
*Author: UX Designer (LUN-25)*
