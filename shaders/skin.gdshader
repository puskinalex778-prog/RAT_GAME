shader_type spatial;
// Кожа: ушки, лапки, хвост, нос. Мягкий подповерхностный оттенок + кольца на хвосте.
uniform vec3 skin_col : source_color = vec3(0.93, 0.68, 0.66);
uniform float rings = 0.0;
uniform float translucency = 0.3;
void fragment() {
	vec3 c = skin_col;
	if (rings > 0.0) {
		c *= 0.92 + 0.08 * sin(UV.y * 90.0);
	}
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
	c = mix(c, c * vec3(1.15, 1.0, 0.95) + vec3(0.06, 0.02, 0.02), fres * translucency * 2.0);
	ALBEDO = c;
	ROUGHNESS = 0.55;
	SPECULAR = 0.35;
}
