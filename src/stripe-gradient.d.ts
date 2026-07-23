declare module 'stripe-gradient' {
  export class Gradient {
    constructor(...args: any[]);
    el: HTMLCanvasElement;
    cssVarRetries: number;
    maxCssVarRetries: number;
    angle: number;
    isLoadedClass: boolean;
    isScrolling: boolean;
    shaderFiles: {
      vertex: string;
      noise: string;
      blend: string;
      fragment: string;
    };
    vertexShader: string;
    sectionColors: number[][];
    computedCanvasStyle: CSSStyleDeclaration;
    conf: {
      presetName: string;
      wireframe: boolean;
      density: number[];
      zoom: number;
      rotation: number;
      playing: boolean;
    };
    uniforms: {
      u_time: any;
      u_shadow_power: any;
      u_darken_top: any;
      u_active_colors: {
        value: number[];
        update: () => void;
      };
      u_global: {
        value: {
          noiseFreq: any;
          noiseSpeed: {
            value: number;
          };
        };
      };
      u_vertDeform: {
        value: {
          incline: {
            value: number;
          };
          noiseAmp: {
            value: number;
          };
          noiseSpeed: {
            value: number;
          };
          noiseFlow: {
            value: number;
          };
          noiseSeed: {
            value: number;
          };
        };
      };
      u_baseColor: {
        value: number[];
      };
      u_waveLayers: {
        value: Array<{
          value: {
            color: {
              value: number[];
            };
            noiseFreq: any;
            noiseSpeed: any;
            noiseFlow: any;
            noiseSeed: any;
            noiseFloor: any;
            noiseCeil: any;
          };
        }>;
      };
    };
    t: number;
    last: number;
    width: number;
    minWidth: number;
    height: number;
    xSegCount: number;
    ySegCount: number;
    mesh: any;
    material: any;
    geometry: any;
    minigl: any;
    amp: number;
    seed: number;
    freqX: number;
    freqY: number;
    freqDelta: number;
    activeColors: number[];
    isMouseDown: boolean;
    resize: () => void;
    animate: (timestamp: number) => void;
    pause: () => void;
    play: () => void;
    initGradient: (selector: string) => this;
    connect: () => Promise<void>;
    disconnect: () => void;
    initMaterial: () => any;
    initMesh: () => void;
    initGradientColors: () => void;
    waitForCssVars: () => void;
    updateFrequency: (val: number) => void;
    toggleColor: (index: number) => void;
  }
}
