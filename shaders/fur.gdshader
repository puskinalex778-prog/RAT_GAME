shader_type spatial;
// Процедурная шерсть декоративной крысы: рисунок окраса считается в «пространстве крысы»,
// поэтому полоса, капюшон, пятна и пойнты совпадают на всех частях тела.

uniform int pattern = 0;
uniform vec3 base_col : source_color = vec3(0.5);
uniform vec3 mark_col : source_color = vec3(0.5);
uniform vec3 white_col : source_color = vec3(0.96, 0.95, 0.92);
uniform vec3 part_origin = vec3(0.0);
uniform vec3 part_scale = vec3(1.0);
uniform float rex = 0.0;
uniform float ticking = 0.0;
uniform float silver = 0.0;
uniform float seed = 0.0;
uniform float shell = 0.0;      // >0 — внешняя «пушистая» оболочка
uniform float dirt = 0.0;
uniform float highlight = 0.0;  // подсветка выбранного питомца

varying vec3 rp;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
				   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
			   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
				   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
	return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1) + 0.15 * vnoise(p * 4.3);
}

void vertex() {
	rp = part_origin + VERTEX * part_scale;
	if (shell > 0.0) {
		VERTEX += NORMAL * shell;
	}
}

vec3 coat(vec3 p) {
	vec3 sp = p + vec3(seed * 13.1, seed * 7.7, seed * 3.3);
	float wob = 0.05 * (vnoise(p * 5.0 + seed) - 0.5);
	float belly = smoothstep(0.40, 0.28, p.y + wob);
	float head = smoothstep(-0.70, -0.82, p.z + wob);
	float shoulders = smoothstep(-0.30, -0.48, p.z + wob);
	float back_top = smoothstep(0.62, 0.74, p.y + wob);
	float stripe = smoothstep(0.22, 0.15, abs(p.x) + wob) * back_top * smoothstep(-0.62, -0.45, p.z) * smoothstep(1.05, 0.85, p.z);
	float cap = head * smoothstep(0.62, 0.74, p.y + 0.12 * (p.z + 1.0) + wob) * smoothstep(-1.42, -1.25, p.z);
	vec3 c = base_col;
	if (pattern == 1) {
		c = mix(base_col, base_col * 1.25 + vec3(0.06), belly * 0.7);
	} else if (pattern == 2) {
		c = mix(white_col, mark_col, stripe);
	} else if (pattern == 3) {
		c = mix(white_col, mark_col, max(stripe, cap));
	} else if (pattern == 4) {
		float hood = max(head, shoulders * (1.0 - belly * 0.85));
		c = mix(white_col, mark_col, max(hood, stripe));
	} else if (pattern == 5) {
		c = mix(base_col, white_col, belly);
	} else if (pattern == 6) {
		float patches = smoothstep(0.50, 0.56, fbm(sp * 2.2)) * (1.0 - belly);
		float hood = max(head * smoothstep(-1.38, -1.2, p.z), shoulders * back_top);
		c = mix(white_col, mark_col, max(patches, hood * 0.9));
	} else if (pattern == 7) {
		float spots = smoothstep(0.74, 0.78, vnoise(sp * 11.0)) * (1.0 - belly * 0.7);
		float headspot = head * smoothstep(0.74, 0.78, vnoise(sp * 9.0 + 3.0));
		c = mix(white_col, mark_col, max(spots, headspot));
	} else if (pattern == 8) {
		float hood = max(head, shoulders * (1.0 - belly * 0.85));
		c = mix(white_col, mark_col, hood);
	} else if (pattern == 9) {
		float pt = smoothstep(-1.15, -1.45, p.z) + 0.55 * smoothstep(0.45, 1.1, p.z) + 0.35 * smoothstep(0.25, 0.08, p.y);
		pt += 0.25 * head;
		c = mix(base_col, mark_col, clamp(pt, 0.0, 1.0));
	} else if (pattern == 10) {
		float pt = smoothstep(-1.28, -1.5, p.z) + 0.25 * smoothstep(0.7, 1.15, p.z) + 0.3 * smoothstep(0.2, 0.06, p.y);
		c = mix(white_col, mark_col, clamp(pt, 0.0, 1.0));
	} else {
		c = mix(base_col, base_col * 1.12 + vec3(0.03), belly * 0.5);
	}
	// агути: тикированные волоски
	if (ticking > 0.0) {
		float t = hash(floor(sp * 70.0));
		c *= mix(vec3(1.0), (t > 0.55 ? vec3(0.55, 0.52, 0.5) : vec3(1.12, 1.04, 0.92)), 0.35 * ticking);
		c = mix(c, vec3(0.80, 0.72, 0.58), belly * 0.6 * ticking);
	}
	// серебристая: отдельные светлые волоски
	if (silver > 0.0) {
		float s = step(0.82, hash(floor(sp * 60.0)));
		c = mix(c, vec3(0.88, 0.88, 0.9), s * 0.3 * silver);
	}
	return c;
}

void fragment() {
	vec3 p = rp;
	// направление волосков: вдоль тела + мелкая вариация; у рекса — волны
	float strands = hash(floor(vec3(p.x * 90.0, p.y * 90.0, p.z * 28.0)));
	float waves = rex * (0.5 + 0.5 * sin(p.z * 34.0 + 6.0 * vnoise(p * 9.0)));
	vec3 col = coat(p);
	col *= 0.9 + 0.16 * strands - 0.12 * waves;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
	col = mix(col, col * 1.35 + vec3(0.05), fres * 0.55);
	col = mix(col, col * vec3(0.85, 0.82, 0.76), dirt);
	col += highlight * vec3(0.10, 0.08, 0.02) * (0.5 + fres);
	if (shell > 0.0) {
		float n = hash(floor(vec3(p.x * 70.0, p.y * 70.0, p.z * 40.0 + rex * sin(p.y * 40.0))));
		if (n < 0.55 + 0.3 * (1.0 - fres)) {
			discard;
		}
	}
	ALBEDO = col;
	ROUGHNESS = 0.92 - 0.15 * rex;
	SPECULAR = 0.25;
}
