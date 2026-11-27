shader_type spatial;
uniform vec3 col : source_color = vec3(0.80, 0.70, 0.56);
uniform vec3 col2 : source_color = vec3(0.70, 0.60, 0.46);
uniform float radius = 1.0;
varying vec3 wp;
void vertex() { wp = VERTEX; }
void fragment() {
	float r = length(wp.xz) / radius;
	float rings = 0.5 + 0.5 * sin(r * 160.0);
	float weave = 0.5 + 0.5 * sin(atan(wp.z, wp.x) * 220.0);
	vec3 c = mix(col, col2, rings * 0.5 + weave * 0.15);
	c = mix(c, col2 * 0.85, smoothstep(0.92, 0.95, r));
	ALBEDO = c;
	ROUGHNESS = 1.0;
}
