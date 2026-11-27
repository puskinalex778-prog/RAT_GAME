shader_type spatial;
render_mode cull_disabled;
uniform vec3 col : source_color = vec3(0.5, 0.6, 0.5);
varying vec3 wp;
void vertex() { wp = VERTEX; }
void fragment() {
	float w = 0.5 + 0.5 * sin(wp.x * 60.0) * sin(wp.z * 60.0 + wp.y * 60.0);
	vec3 c = col * (0.9 + 0.1 * w);
	if (!FRONT_FACING) { c *= 0.85; }
	float fres = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 2.0);
	ALBEDO = c + fres * 0.08;
	ROUGHNESS = 0.95;
}
