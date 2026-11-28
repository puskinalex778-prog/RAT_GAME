shader_type spatial;
render_mode depth_draw_opaque, cull_back;
uniform vec3 col : source_color = vec3(0.66, 0.54, 0.39);
uniform float dirt = 0.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void fragment() {
	vec2 cell = floor(wp.xz * 10.0);
	float n = h(cell);
	vec2 f = fract(wp.xz * 10.0) - 0.5;
	float flake = smoothstep(0.5, 0.28, length(f + (vec2(h(cell + 1.3), h(cell + 7.1)) - 0.5) * 0.42));
	vec3 c = col * (0.80 + 0.18 * n) * (0.88 + 0.12 * flake);
	c = mix(c, c * vec3(0.80, 0.76, 0.68), dirt * step(0.6, h(cell + 3.0)));
	ALBEDO = c;
	ROUGHNESS = 0.98;
	SPECULAR = 0.05;
}
