# FUSE Creatine - Premium Product Image Specifications

## Brand Guidelines for Product Images

### Color Palette
- **Primary**: Pure White (#FFFFFF) - Capsule base color
- **Accent**: FUSE Red (#FF3B30) - Subtle highlights, logo accents
- **Background**: Deep Black (#000000) to Dark Charcoal (#0A0A0A)
- **Secondary**: Soft Gray (#E5E5E5) - Shadows and depth

### Product Design Concept
- **Shape**: Dodecahedron (12-sided geometric shape) with honeycomb/hexagonal surface texture
- **Material**: Matte white ceramic/porcelain finish with subtle sheen
- **Branding**: "FUSE" debossed elegantly into one face
- **Texture**: Each pentagon face features a honeycomb micro-pattern inspired by bee panels

---

## Image 1: Hero Product Shot (Primary)

### Specifications
- **Dimensions**: 2816 x 1536 px (current format)
- **Aspect Ratio**: 16:9 (hero display)
- **File**: `og-image.png`

### AI Image Generation Prompts

#### Midjourney Prompt
```
Premium product photography of a white matte ceramic dodecahedron capsule with honeycomb hexagonal surface texture, "FUSE" elegantly debossed on one face, floating against pure black background, dramatic rim lighting with subtle red accent glow, pharmaceutical luxury aesthetic, soft shadows, studio lighting, 8k, photorealistic, minimal, high-end supplement packaging --ar 16:9 --v 6 --style raw
```

#### DALL-E 3 Prompt
```
A stunning product photograph of a geometric white matte dodecahedron supplement capsule with a honeycomb hexagonal micro-texture on each face. The word "FUSE" is subtly debossed into one pentagon face. The capsule floats against a pure black studio background with dramatic rim lighting. A subtle red glow (#FF3B30) accents the edges. Ultra-premium pharmaceutical aesthetic, clean, minimal, professional studio product photography.
```

#### Stable Diffusion Prompt
```
(masterpiece, best quality, ultra detailed, professional product photography:1.4), white matte ceramic dodecahedron supplement capsule, honeycomb hexagonal surface texture, "FUSE" debossed branding, pure black background, dramatic studio rim lighting, subtle red accent glow, pharmaceutical luxury, soft shadows, 8k resolution, commercial photography, minimal aesthetic, floating product shot
Negative: text, watermark, low quality, blurry, grainy
```

---

## Image 2: Packaging Box Shot

### Specifications
- **Dimensions**: 2816 x 1536 px
- **Style**: Premium unboxing experience

### AI Image Generation Prompts

#### Midjourney Prompt
```
Luxury matte black packaging box with magnetic closure, slightly open revealing white honeycomb-textured dodecahedron capsules arranged in custom foam insert, "FUSE" logo in subtle red (#FF3B30) on box lid, premium supplement packaging, pharmaceutical elegance, studio lighting, dark moody background, high-end product photography, 8k --ar 16:9 --v 6 --style raw
```

#### DALL-E 3 Prompt
```
A luxurious matte black magnetic closure box, partially opened to reveal 4 white geometric dodecahedron supplement capsules with honeycomb texture, nestled in custom black foam insert. The box lid features "FUSE" in elegant red (#FF3B30). Premium pharmaceutical packaging aesthetic, dramatic studio lighting against dark background, high-end supplement brand photography.
```

---

## Image 3: Lifestyle Coffee Scene

### Specifications
- **Dimensions**: 2816 x 1536 px
- **Style**: Premium lifestyle usage

### AI Image Generation Prompts

#### Midjourney Prompt
```
Minimalist lifestyle product photography, white honeycomb-textured dodecahedron capsule dissolving elegantly in premium black coffee cup, steam rising, dark marble surface, morning light through window, one capsule beside the cup, luxury supplement ritual, clean modern aesthetic, warm tones, 8k photorealistic --ar 16:9 --v 6 --style raw
```

#### DALL-E 3 Prompt
```
A premium lifestyle photograph showing a white geometric honeycomb-textured supplement capsule gently dissolving in a sleek black ceramic coffee cup. Soft morning light illuminates the scene. A single capsule sits beside the cup on a dark marble surface. Steam rises from the coffee. Ultra-premium, clean, minimal aesthetic. Professional product photography.
```

---

## Image 4: Product Array/Collection

### Specifications
- **Dimensions**: 2816 x 1536 px
- **Style**: Multiple capsules composition

### AI Image Generation Prompts

#### Midjourney Prompt
```
Geometric arrangement of five white matte honeycomb-textured dodecahedron capsules, scattered artfully on reflective black surface, one capsule shows "FUSE" debossed logo, dramatic overhead lighting, subtle red rim glow, premium supplement product photography, clean minimal luxury aesthetic, pharmaceutical elegance, 8k --ar 16:9 --v 6 --style raw
```

---

## Image 5: Social Media OG Image

### Specifications
- **Dimensions**: 1200 x 630 px (optimal for social sharing)
- **Style**: Hero with branding overlay space

### AI Image Generation Prompts

#### Midjourney Prompt
```
Centered product photography of single white matte honeycomb dodecahedron capsule, "FUSE" visible on face, pure black background, dramatic lighting from above, subtle red accent glow on edges, negative space on left for text overlay, premium pharmaceutical supplement, ultra clean, 8k --ar 1.9:1 --v 6 --style raw
```

---

## Technical Specifications for Final Assets

### Hero Image (og-image.png)
- **Resolution**: 2816 x 1536 px
- **Format**: PNG with transparency OR solid black background
- **Color Space**: sRGB
- **Usage**: Hero section, product showcase, social sharing

### Logo Image
- **Resolution**: 512 x 512 px minimum
- **Format**: PNG with transparency
- **Usage**: Schema.org, favicons

### File Optimization
- Compress with TinyPNG/ImageOptim
- Enable lazy loading
- Include WebP versions for modern browsers

---

## Design System Integration

### CSS Variables for Consistency
```css
:root {
  --fuse-red: #ff3b30;
  --fuse-red-light: #ff6961;
  --fuse-white: #ffffff;
  --fuse-black: #000000;
}
```

### Hover Effects (Existing)
- Drop shadow: `0 12px 40px rgba(0,0,0,0.7)`
- Red glow: `0 0 24px rgba(255, 59, 48, 0.1)`
- Scale: `1.02` on hover
- Lift: `translateY(-4px)`

---

## Capsule Design Reference

### Physical Specifications
- **Shape**: Regular dodecahedron (12 pentagonal faces)
- **Size**: Approximately 15mm diameter (scaled for visual impact)
- **Surface**: Each pentagon face has micro-honeycomb hexagonal pattern
- **Finish**: Matte white with subtle pearl sheen
- **Branding**: "FUSE" debossed (not printed) into one face
- **Edge treatment**: Soft beveled edges with subtle red edge-glow effect

### Honeycomb Pattern Detail
- Regular hexagonal pattern filling each pentagonal face
- Subtle depth to hexagons (0.5mm impression)
- Creates premium tactile appearance
- References bee panel geometry while maintaining pharmaceutical elegance

---

## Recommended Tools for Generation

1. **Midjourney v6** - Best for photorealistic product shots
2. **DALL-E 3** - Good for specific compositional control
3. **Adobe Firefly** - Brand-safe commercial usage
4. **Stable Diffusion XL** - High customization with ControlNet

### Post-Processing Workflow
1. Generate base image with AI
2. Upscale with Topaz Gigapixel or Real-ESRGAN
3. Color correct to match brand palette
4. Add subtle red glow in Photoshop
5. Export at required resolutions
6. Optimize for web
