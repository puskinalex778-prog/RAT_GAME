shader_type spatial;
// UV-привязанный шейдер шерсти для RatBody (rat_rigged.glb) в стиле мягкого бархата.
// u = 0.5 — линия хребта; u = 0 / 1 — животик; v = 0 — круп; v = 1 — кончик носа.

uniform int pattern = 2;
uniform vec3 base_col : source_color = vec3(0.96, 0.95, 0.92);
uniform vec3 mark_col : source_color = vec3(0.44, 0.45, 0.47);
uniform vec3 white_col : source_color = vec3(0.96, 0.95, 0.92);
uniform float rex = 0.0;
uniform float ticking = 0.0;
uniform float silver = 0.0;
uniform float seed = 0.3;
uniform float dirt = 0.0;
uniform float highlight = 0.0;
uniform sampler2D fur_bump_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D fur_rough_tex : filter_linear_mipmap, repeat_enable;

float hash2(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float vnoise2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
		mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

float fbm2(vec2 p) {
	return 0.55 * vnoise2(p) + 0.30 * vnoise2(p * 2.13) + 0.15 * vnoise2(p * 4.37);
}

vec3 coat_color(vec2 uv) {
	// Непрерывное расстояние от линии хребта через шов на животике;
	// glTF переворачивает UV.y (0 — нос, 1 — круп), поэтому инвертируем (v = 0 — круп, 1 — нос).
	float du = abs(fract(uv.x) - 0.5);
	float v = 1.0 - uv.y;
	vec2 seed_uv = vec2(du * 12.0 + seed * 5.7, v * 12.0 + seed * 3.1);
	float wob = 0.032 * (vnoise2(seed_uv) - 0.5);

	float belly = smoothstep(0.25, 0.37, du + wob);
	float head = smoothstep(0.67, 0.77, v + wob);
	float shoulders = smoothstep(0.53, 0.65, v + wob) * (1.0 - belly * 0.75);
	float dorsal_top = smoothstep(0.20, 0.09, du + wob * 0.6);
	float stripe = smoothstep(0.115, 0.048, du + wob * 0.65) * smoothstep(0.12, 0.22, v) * smoothstep(0.71, 0.58, v);
	float cap = smoothstep(0.68, 0.77, v + wob) * smoothstep(0.26, 0.11, du + wob * 0.5) * smoothstep(0.95, 0.84, v);

	vec3 c = base_col;
	if (pattern == 1) {
		c = mix(base_col, min(vec3(1.0), base_col * 1.24 + vec3(0.05)), belly * 0.72);
	} else if (pattern == 2) {
		c = mix(white_col, mark_col, stripe);
	} else if (pattern == 3) {
		c = mix(white_col, mark_col, max(stripe, cap));
	} else if (pattern == 4) {
		float hood = max(head * smoothstep(0.98, 0.88, v), shoulders);
		c = mix(white_col, mark_col, max(hood, stripe));
	} else if (pattern == 5) {
		c = mix(base_col, white_col, belly);
	} else if (pattern == 6) {
		float patches = smoothstep(0.49, 0.57, fbm2(vec2(du * 7.5 + seed * 4.1, v * 8.0 + seed * 2.3))) * (1.0 - belly);
		float hood = max(head * smoothstep(0.96, 0.85, v), shoulders * dorsal_top);
		c = mix(white_col, mark_col, max(patches, hood * 0.92));
	} else if (pattern == 7) {
		float spots = smoothstep(0.72, 0.77, vnoise2(vec2(du * 24.0 + seed * 6.0, v * 26.0))) * (1.0 - belly * 0.75);
		float hspots = head * smoothstep(0.73, 0.78, vnoise2(vec2(du * 18.0 + 2.5, v * 20.0 + seed)));
		c = mix(white_col, mark_col, max(spots, hspots));
	} else if (pattern == 8) {
		float hood = max(head * smoothstep(0.98, 0.88, v), shoulders);
		c = mix(white_col, mark_col, hood);
	} else if (pattern == 9) {
		float snout_pt = smoothstep(0.76, 0.96, v + wob * 0.5);
		float rump_pt = smoothstep(0.24, 0.04, v + wob * 0.5);
		float limb_pt = smoothstep(0.29, 0.42, du) * smoothstep(0.68, 0.30, v) * 0.55;
		c = mix(base_col, mark_col, clamp(snout_pt + rump_pt * 0.65 + limb_pt, 0.0, 1.0));
	} else if (pattern == 10) {
		float snout_pt = smoothstep(0.81, 0.97, v + wob * 0.4);
		float rump_pt = smoothstep(0.18, 0.02, v + wob * 0.4) * 0.5;
		c = mix(white_col, mark_col, clamp(snout_pt + rump_pt, 0.0, 1.0));
	} else {
		c = mix(base_col, min(vec3(1.0), base_col * 1.12 + vec3(0.03)), belly * 0.48);
	}

	if (ticking > 0.0) {
		float tk = fbm2(vec2(uv.x * 65.0 + seed, uv.y * 42.0));
		c *= mix(vec3(1.0), mix(vec3(0.58, 0.52, 0.46), vec3(1.16, 1.05, 0.90), step(0.52, tk)), 0.42 * ticking);
		c = mix(c, vec3(0.80, 0.72, 0.58), belly * 0.55 * ticking);
	}
	if (silver > 0.0) {
		float sv = step(0.78, fbm2(vec2(uv.x * 55.0 + seed * 3.0, uv.y * 38.0)));
		c = mix(c, vec3(0.88, 0.89, 0.92), sv * 0.32 * silver);
	}
	return c;
}

void fragment() {
	vec2 tex_uv = UV * vec2(2.0, 2.0);
	float fur_b = texture(fur_bump_tex, tex_uv).r;
	float fur_r = texture(fur_rough_tex, tex_uv).r;

	vec3 col = coat_color(UV);
	// Мягкий направленный ворс + лёгкие завитки рекса
	float wave = rex * (0.5 + 0.5 * sin(UV.y * 55.0 + 4.5 * vnoise2(UV * 12.0)));
	col *= mix(0.92, 1.04, fur_b) * (1.0 - 0.09 * wave);

	// Нежный бархатистый ореол по силуэту (sheen)
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.3);
	col = mix(col, min(vec3(1.0), col * 1.24 + vec3(0.06)), fres * 0.42);
	col = mix(col, col * vec3(0.86, 0.82, 0.76), dirt);
	col += highlight * vec3(0.11, 0.09, 0.03) * (0.45 + fres);

	ALBEDO = col;
	ROUGHNESS = clamp(mix(0.78, 0.96, fur_r) - 0.10 * rex, 0.45, 0.98);
	SPECULAR = 0.22;
}
