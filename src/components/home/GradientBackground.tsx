import { useEffect, useRef } from 'react';
import pkg from 'stripe-gradient';
const { Gradient } = pkg;

/**
 * Color presets for light / dark mode.
 * Light: soft oceanic blue-lavender tones
 * Dark:  deep purple-magenta-cyan (Siri Glowtime style)
 */
const THEME_COLORS = {
  light: {
    colors: ['#e8eaf6', '#90a4f4', '#b388ff', '#80d8ff'],
    amp: 320,
    speed: 8,
    angle: -0.35,
    darkenTop: false,
  },
  dark: {
    colors: ['#0c001a', '#5c00a3', '#ae0086', '#00bfff'],
    amp: 320,
    speed: 8,
    angle: -0.35,
    darkenTop: false,
  },
} as const;

function hexToRGBVec3(hex: string): number[] {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export default function GradientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradientRef = useRef<Gradient | null>(null);

  // Detect current theme from <html> class
  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function getPreset() {
    return isDark() ? THEME_COLORS.dark : THEME_COLORS.light;
  }

  // Apply color preset to live WebGL uniforms
  function applyPreset(grad: Gradient, preset: typeof THEME_COLORS.dark) {
    if (!grad.uniforms) return;

    // Base color (color 1)
    if (grad.uniforms.u_baseColor) {
      grad.uniforms.u_baseColor.value = hexToRGBVec3(preset.colors[0]);
    }

    // Wave layer colors (colors 2-4)
    if (grad.uniforms.u_waveLayers?.value) {
      preset.colors.forEach((color, i) => {
        if (i > 0 && grad.uniforms.u_waveLayers.value[i - 1]?.value?.color) {
          grad.uniforms.u_waveLayers.value[i - 1].value.color.value = hexToRGBVec3(color);
        }
      });
    }

    // Amplitude
    if (grad.uniforms.u_vertDeform?.value?.noiseAmp) {
      grad.uniforms.u_vertDeform.value.noiseAmp.value = preset.amp;
    }

    // Speed
    if (grad.uniforms.u_global?.value?.noiseSpeed) {
      grad.uniforms.u_global.value.noiseSpeed.value = 5e-7 * preset.speed;
    }

    // Angle
    if (grad.uniforms.u_vertDeform?.value?.incline) {
      grad.uniforms.u_vertDeform.value.incline.value =
        Math.sin(preset.angle) / Math.cos(preset.angle);
    }

    // Darken top
    if (grad.uniforms.u_darken_top) {
      grad.uniforms.u_darken_top.value = preset.darkenTop ? 1.0 : 0.0;
    }
  }

  // 1. Initialize WebGL canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preset = getPreset();
    canvas.style.setProperty('--gradient-color-1', preset.colors[0]);
    canvas.style.setProperty('--gradient-color-2', preset.colors[1]);
    canvas.style.setProperty('--gradient-color-3', preset.colors[2]);
    canvas.style.setProperty('--gradient-color-4', preset.colors[3]);

    try {
      const grad = new Gradient();
      grad.initGradient('#home-gradient-canvas');
      gradientRef.current = grad;

      // Apply full preset after init
      requestAnimationFrame(() => applyPreset(grad, preset));
    } catch (e) {
      console.warn('WebGL gradient init failed:', e);
    }

    return () => {
      if (gradientRef.current) {
        gradientRef.current.disconnect();
        gradientRef.current = null;
      }
    };
  }, []);

  // 2. Watch theme changes via MutationObserver on <html> class
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const grad = gradientRef.current;
      if (!grad) return;
      applyPreset(grad, getPreset());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // 3. Handle resize
  useEffect(() => {
    const handleResize = () => gradientRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      id="home-gradient-canvas"
      ref={canvasRef}
      data-transition-in
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        zIndex: 0,
        transformOrigin: 'top left',
        transform: 'scale(1.4) translate3d(-5%, -5%, 0)',
      }}
    />
  );
}
