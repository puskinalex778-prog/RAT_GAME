shader_type spatial;
render_mode depth_draw_opaque, cull_back;
uniform vec3 col : source_color = vec3(0.74, 0.58, 0.38);
varying vec3 wp;
void vertex() { wp = VERTEX; }
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void fragment() {
	float g = sin((wp.x + wp.z * 0.2) * 22.0 + sin(wp.y * 3.0 + wp.z * 4.0) * 2.0) * 0.5 + 0.5;
	float n = h(floor(wp.xz * 30.0));
	vec3 c = col * (0.86 + 0.12 * g + 0.04 * n);
	ALBEDO = c;
	ROUGHNESS = 0.72;
	SPECULAR = 0.18;
}
