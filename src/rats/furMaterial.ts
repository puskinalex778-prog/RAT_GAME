import * as THREE from 'three';

/**
 * Матовый материал шерсти: высокий roughness, мягкий rim/fresnel-эффект «пушистости».
 * Shell-слои — те же материалы со смещением вершин вдоль нормали и альфа-тестом.
 */

function injectRim(shader: THREE.WebGLProgramParametersWithUniforms, strength: number) {
  shader.uniforms.uRim = { value: strength };
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uRim;')
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        vec3 vdir = normalize(vViewPosition);
        float fres = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += diffuseColor.rgb * fres * uRim;
      }`,
    );
}

export function createFurMaterial(map: THREE.Texture, normalMap: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.92,
    metalness: 0,
  });
  m.onBeforeCompile = (shader) => injectRim(shader, 0.42);
  m.customProgramCacheKey = () => 'fur-body';
  return m;
}

export function createShellMaterial(
  map: THREE.Texture,
  alpha: THREE.Texture,
  offset: number,
  layer: number,
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaMap: alpha,
    alphaTest: 0.5,
    transparent: false,
    roughness: 1,
    metalness: 0,
    side: THREE.FrontSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShell = { value: offset };
    shader.uniforms.uShade = { value: 1.0 + layer * 0.06 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uShell;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(objectNormal) * uShell;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uShade;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= uShade;')
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        {
          // без волосков на глазах и кончике носа
          vec2 uvE = vAlphaMapUv;
          float e1 = length((uvE - vec2(0.33, 0.85)) * vec2(1.0, 1.4));
          float e2 = length((uvE - vec2(0.67, 0.85)) * vec2(1.0, 1.4));
          if (min(e1, e2) < 0.055 || uvE.y > 0.95) diffuseColor.a = 0.0;
        }`,
      );
    injectRim(shader, 0.55);
  };
  m.customProgramCacheKey = () => `fur-shell-${layer}`;
  return m;
}
