shader_type spatial;
render_mode depth_draw_opaque, cull_back;
// Кожа: ушки, лапки, хвост, нос. Мягкий подповерхностный оттенок + кольца на хвосте.
uniform vec3 skin_col : source_color = vec3(0.90, 0.66, 0.64);
uniform float rings = 0.0;
uniform float translucency = 0.22;
void fragment() {
	vec3 c = skin_col;
	if (rings > 0.0) {
		c *= 0.92 + 0.08 * sin(UV.y * 90.0);
	}
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
	c = mix(c, min(vec3(0.96), c * vec3(1.10, 1.0, 0.96) + vec3(0.03, 0.01, 0.01)), fres * translucency * 1.4);
	ALBEDO = c;
	ROUGHNESS = 0.58;
	SPECULAR = 0.25;
}
