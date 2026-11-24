class_name Items3D
extends RefCounted
## Процедурные 3D-модели предметов. Начало координат — точка опоры на поверхности, «перед» смотрит в +Z.

static var _mats := {}
static var _wood: Shader
static var _fabric: Shader

static func mat(c: Color, rough := 0.8, kind := "") -> Material:
	var key := "%s_%s_%s" % [c.to_html(), rough, kind]
	if _mats.has(key):
		return _mats[key]
	var m: Material
	if kind == "wood":
		if _wood == null:
			_wood = load("res://shaders/wood.gdshader")
		var sm := ShaderMaterial.new()
		sm.shader = _wood
		sm.set_shader_parameter("col", c)
		m = sm
	elif kind == "fabric":
		if _fabric == null:
			_fabric = load("res://shaders/fabric.gdshader")
		var fm := ShaderMaterial.new()
		fm.shader = _fabric
		fm.set_shader_parameter("col", c)
		m = fm
	else:
		var s := StandardMaterial3D.new()
		s.albedo_color = c
		s.roughness = rough
		if c.a < 0.99:
			s.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		if kind == "metal":
			s.metallic = 0.8
			s.roughness = 0.3
		if kind == "double":
			s.cull_mode = BaseMaterial3D.CULL_DISABLED
		m = s
	_mats[key] = m
	return m

static func box(p: Node3D, size: Vector3, m: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	p.add_child(mi)
	return mi

static func cyl(p: Node3D, rt: float, rb: float, h: float, m: Material, pos := Vector3.ZERO, rot := Vector3.ZERO, seg := 20) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = rt
	c.bottom_radius = rb
	c.height = h
	c.radial_segments = seg
	c.rings = 1
	mi.mesh = c
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	p.add_child(mi)
	return mi

static func sph(p: Node3D, r: Vector3, m: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	s.radial_segments = 16
	s.rings = 8
	mi.mesh = s
	mi.scale = r
	mi.material_override = m
	mi.position = pos
	p.add_child(mi)
	return mi

static func torus(p: Node3D, ri: float, ro: float, m: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = ri
	t.outer_radius = ro
	t.rings = 24
	t.ring_segments = 8
	mi.mesh = t
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	p.add_child(mi)
	return mi

## Открытая труба вдоль оси X (туннель)
static func tube(p: Node3D, r: float, length: float, m: Material, pos := Vector3.ZERO, bend := 0.0) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segs := 18
	var rings := 10
	for i in rings:
		for j in segs:
			var quad := []
			for d in [[0, 0], [1, 0], [1, 1], [0, 1]]:
				var u := float(i + d[0]) / rings
				var a := TAU * float(j + d[1]) / segs
				var x := (u - 0.5) * length
				var zoff := bend * sin(u * PI)
				quad.append(Vector3(x, r + r * sin(a), r * cos(a) + zoff))
			for k in [0, 1, 2, 0, 2, 3]:
				var v: Vector3 = quad[k]
				st.set_uv(Vector2(v.x, v.y))
				st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = m
	mi.position = pos
	p.add_child(mi)
	# кольца-окантовки
	torus(p, r * 0.92, r * 1.08, m, pos + Vector3(-length / 2, r, 0), Vector3(0, 0, PI / 2))
	torus(p, r * 0.92, r * 1.08, m, pos + Vector3(length / 2, r, 0), Vector3(0, 0, PI / 2))
	return mi

## Провисающее полотно гамака (ткань)
static func cloth(p: Node3D, w: float, d: float, sag: float, m: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var nx := 12
	var nz := 8
	var pts := []
	for i in nx + 1:
		var row := []
		for j in nz + 1:
			var u := float(i) / nx
			var v := float(j) / nz
			var y := -sag * sin(u * PI) * (0.6 + 0.4 * sin(v * PI))
			row.append(Vector3((u - 0.5) * w, y, (v - 0.5) * d))
		pts.append(row)
	for i in nx:
		for j in nz:
			var a: Vector3 = pts[i][j]
			var b: Vector3 = pts[i + 1][j]
			var c: Vector3 = pts[i + 1][j + 1]
			var e: Vector3 = pts[i][j + 1]
			for v in [a, b, c, a, c, e]:
				st.set_uv(Vector2(v.x, v.z))
				st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = m
	mi.position = pos
	p.add_child(mi)
	return mi

static func strap(p: Node3D, from: Vector3, to: Vector3, m: Material) -> void:
	var mid := (from + to) / 2.0
	var len := from.distance_to(to)
	var mi := box(p, Vector3(0.08, len, 0.04), m, mid)
	var dir := (to - from).normalized()
	if absf(dir.dot(Vector3.UP)) < 0.999:
		mi.basis = Basis(Quaternion(Vector3.UP, dir))
	var clip := torus(p, 0.05, 0.09, mat(Color(0.75, 0.76, 0.78), 0.3, "metal"), to, Vector3(PI / 2, 0, 0))
	clip.scale = Vector3.ONE

# ---------------------------------------------------------------------
## Создать модель предмета. hang_up — расстояние до точки подвеса (для подвесных).
static func make(item_id: String, color_idx := 0, hang_up := 3.0) -> Node3D:
	var root := Node3D.new()
	root.name = item_id
	var it: Dictionary = Data.ITEMS.get(item_id, {})
	var cols: Array = it.get("colors", ["#c9a36b"])
	var col := Color(cols[color_idx % cols.size()])
	var wood := mat(col, 0.7, "wood")
	var dark := mat(Color(0.12, 0.09, 0.07), 1.0)
	match item_id:
		"wood_house":
			box(root, Vector3(2.2, 1.25, 1.8), wood, Vector3(0, 0.625, 0))
			var roof := mat(col.darkened(0.15), 0.7, "wood")
			box(root, Vector3(2.5, 0.12, 1.35), roof, Vector3(0, 1.55, 0.5), Vector3(0.62, 0, 0))
			box(root, Vector3(2.5, 0.12, 1.35), roof, Vector3(0, 1.55, -0.5), Vector3(-0.62, 0, 0))
			box(root, Vector3(2.2, 0.55, 0.06), wood, Vector3(0, 1.45, 0.88), Vector3(0, 0, 0)).scale = Vector3(1, 1, 1)
			cyl(root, 0.42, 0.42, 0.06, dark, Vector3(0.1, 0.55, 0.91), Vector3(PI / 2, 0, 0))
			cyl(root, 0.18, 0.18, 0.06, dark, Vector3(-0.75, 0.75, 0.91), Vector3(PI / 2, 0, 0))
		"sleeping_pouch":
			var fab := mat(col, 0.95, "fabric")
			cyl(root, 0.35, 0.95, 1.5, fab, Vector3(0, 0.75, 0), Vector3.ZERO, 24)
			sph(root, Vector3(0.95, 0.12, 0.95), fab, Vector3(0, 0.02, 0))
			cyl(root, 0.4, 0.4, 0.06, dark, Vector3(0, 0.6, 0.78), Vector3(1.32, 0, 0))
			torus(root, 0.38, 0.5, mat(Color(0.96, 0.93, 0.86), 0.95, "fabric"), Vector3(0, 0.6, 0.8), Vector3(1.32, 0, 0))
			var sm := mat(Color(0.45, 0.55, 0.42), 0.8)
			strap(root, Vector3(-0.3, 1.45, 0), Vector3(-0.4, hang_up, 0), sm)
			strap(root, Vector3(0.3, 1.45, 0), Vector3(0.4, hang_up, 0), sm)
		"hammock", "hammock_double":
			var fab2 := mat(col, 0.95, "fabric")
			var layers := 2 if item_id == "hammock_double" else 1
			var sm2 := mat(col.darkened(0.3), 0.8)
			for l in layers:
				var y := 0.35 + l * 1.0
				cloth(root, 2.6, 1.8, 0.45, fab2, Vector3(0, y, 0))
				for cx in [-1.3, 1.3]:
					for cz in [-0.9, 0.9]:
						strap(root, Vector3(cx, y, cz), Vector3(cx * 1.1, hang_up if l == layers - 1 else y + 1.0, cz * 0.9), sm2)
		"tunnel", "tunnel_long":
			var length := 2.6 if item_id == "tunnel" else 3.6
			tube(root, 0.5, length, mat(col, 0.95, "fabric"), Vector3.ZERO, 0.0 if item_id == "tunnel" else 0.4)
		"bridge":
			var n := 9
			for i in n:
				var u := float(i) / (n - 1)
				var x := (u - 0.5) * 2.8
				var y := 0.15 + 0.45 * sin(u * PI)
				box(root, Vector3(0.28, 0.1, 1.3), wood, Vector3(x, y, 0), Vector3(0, 0, -cos(u * PI) * 0.5))
			for z in [-0.6, 0.6]:
				for i in 5:
					var u2 := float(i) / 4.0
					cyl(root, 0.04, 0.04, 0.4, wood, Vector3((u2 - 0.5) * 2.6, 0.35 + 0.45 * sin(u2 * PI) + 0.2, z))
		"foraging_box":
			var card := mat(Color(0.78, 0.62, 0.42), 0.95)
			box(root, Vector3(1.7, 0.06, 1.3), card, Vector3(0, 0.03, 0))
			box(root, Vector3(1.7, 0.8, 0.06), card, Vector3(0, 0.4, 0.62))
			box(root, Vector3(1.7, 0.8, 0.06), card, Vector3(0, 0.4, -0.62))
			box(root, Vector3(0.06, 0.8, 1.3), card, Vector3(0.82, 0.4, 0))
			box(root, Vector3(0.06, 0.8, 1.3), card, Vector3(-0.82, 0.4, 0))
			for hx in [-0.45, 0.45]:
				cyl(root, 0.15, 0.15, 0.07, dark, Vector3(hx, 0.38, 0.64), Vector3(PI / 2, 0, 0))
			var rng := RandomNumberGenerator.new()
			rng.seed = 7
			for i in 28:
				var c2 := [Color(0.62, 0.72, 0.55), Color(0.95, 0.93, 0.86), Color(0.8, 0.85, 0.72)][i % 3]
				box(root, Vector3(0.25, 0.03, 0.08), mat(c2), Vector3(rng.randf_range(-0.7, 0.7), rng.randf_range(0.35, 0.65), rng.randf_range(-0.5, 0.5)), Vector3(rng.randf() * 3, rng.randf() * 3, rng.randf() * 3))
		"puzzle_feeder":
			box(root, Vector3(1.9, 0.28, 0.85), wood, Vector3(0, 0.14, 0))
			for i in 3:
				var lx := -0.6 + i * 0.6
				cyl(root, 0.24, 0.24, 0.08, mat(col.lightened(0.1), 0.7, "wood"), Vector3(lx, 0.32, 0))
				cyl(root, 0.05, 0.05, 0.12, wood, Vector3(lx, 0.42, 0))
		"chew_sticks":
			var bark := mat(Color(0.5, 0.36, 0.22), 0.9, "wood")
			var pos := [Vector3(-0.2, 0.1, 0), Vector3(0, 0.1, 0), Vector3(0.2, 0.1, 0), Vector3(-0.1, 0.27, 0), Vector3(0.1, 0.27, 0)]
			for p in pos:
				cyl(root, 0.09, 0.09, 1.1, bark, p, Vector3(PI / 2, 0.1 * p.x, 0), 10)
		"nesting_paper":
			var rng2 := RandomNumberGenerator.new()
			rng2.seed = 3
			var paper := mat(col, 0.95)
			for i in 40:
				var a := rng2.randf() * TAU
				var rr := rng2.randf() * 0.55
				box(root, Vector3(0.35, 0.02, 0.07), paper, Vector3(cos(a) * rr, 0.03 + rng2.randf() * 0.3 * (1.0 - rr), sin(a) * rr), Vector3(rng2.randf() * 2, rng2.randf() * 3, rng2.randf() * 2))
		"ball":
			var bm := mat(col, 0.9, "wood")
			for i in 3:
				torus(root, 0.24, 0.3, bm, Vector3(0, 0.3, 0), Vector3(i * PI / 3, i * 0.8, 0))
		"platform":
			box(root, Vector3(2.8, 0.14, 1.6), wood, Vector3(0, -0.07, 0))
			box(root, Vector3(2.8, 0.3, 0.08), wood, Vector3(0, 0.08, 0.78))
			box(root, Vector3(0.1, 0.9, 0.1), mat(Color(0.7, 0.7, 0.72), 0.3, "metal"), Vector3(1.3, -0.5, -0.7), Vector3(0.6, 0, 0))
		"wheel":
			var wm := mat(col, 0.6)
			cyl(root, 1.6, 1.6, 0.06, wm, Vector3(0, 1.75, -0.45), Vector3(PI / 2, 0, 0), 32)
			var ring := tube_ring(root, 1.6, 0.9, wm)
			ring.position = Vector3(0, 1.75, 0)
			box(root, Vector3(0.2, 1.75, 0.2), wm, Vector3(0, 0.87, -0.6))
			box(root, Vector3(1.6, 0.12, 1.0), wm, Vector3(0, 0.06, -0.3))
			root.set_meta("spinner", ring)
	return root

static func tube_ring(p: Node3D, r: float, w: float, m: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segs := 36
	for j in segs:
		var a0 := TAU * j / segs
		var a1 := TAU * (j + 1) / segs
		var q := [Vector3(r * cos(a0), r * sin(a0), -w / 2), Vector3(r * cos(a1), r * sin(a1), -w / 2), Vector3(r * cos(a1), r * sin(a1), w / 2), Vector3(r * cos(a0), r * sin(a0), w / 2)]
		for k in [0, 2, 1, 0, 3, 2]:
			st.add_vertex(q[k])
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat(m.albedo_color if m is StandardMaterial3D else Color.WHITE, 0.6, "double")
	p.add_child(mi)
	# поперечные полоски для видимости вращения
	for j in 12:
		var a := TAU * j / 12.0
		var b := BoxMesh.new()
		b.size = Vector3(0.05, 0.05, w)
		var s := MeshInstance3D.new()
		s.mesh = b
		s.material_override = mat(Color(0.6, 0.6, 0.62))
		s.position = Vector3(r * 0.98 * cos(a), r * 0.98 * sin(a), 0)
		mi.add_child(s)
	return mi

## Миска с кормом
static func bowl() -> Node3D:
	var root := Node3D.new()
	var cer := mat(Color(0.36, 0.6, 0.55), 0.35)
	cyl(root, 0.72, 0.6, 0.32, cer, Vector3(0, 0.16, 0), Vector3.ZERO, 28)
	torus(root, 0.6, 0.74, cer, Vector3(0, 0.32, 0))
	cyl(root, 0.6, 0.6, 0.02, mat(Color(0.88, 0.86, 0.8), 0.5), Vector3(0, 0.33, 0))
	var food := Node3D.new()
	food.name = "food"
	root.add_child(food)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var pm := mat(Color(0.55, 0.38, 0.24), 0.9)
	for i in 36:
		var a := rng.randf() * TAU
		var rr := sqrt(rng.randf()) * 0.5
		var b := box(food, Vector3(0.12, 0.1, 0.12), pm, Vector3(cos(a) * rr, 0.36 + rng.randf() * 0.12 * (1.0 - rr), sin(a) * rr), Vector3(rng.randf() * 3, rng.randf() * 3, 0))
		b.set_meta("idx", i)
	var veg := Node3D.new()
	veg.name = "veg"
	root.add_child(veg)
	cyl(veg, 0.05, 0.08, 0.3, mat(Color(0.95, 0.5, 0.15)), Vector3(-0.2, 0.45, 0.1), Vector3(0, 0, 1.4))
	sph(veg, Vector3(0.12, 0.1, 0.12), mat(Color(0.3, 0.55, 0.25)), Vector3(0.15, 0.45, -0.15))
	cyl(veg, 0.12, 0.12, 0.05, mat(Color(0.75, 0.88, 0.6)), Vector3(0.25, 0.43, 0.2))
	var fruit := Node3D.new()
	fruit.name = "fruit"
	root.add_child(fruit)
	sph(fruit, Vector3.ONE * 0.08, mat(Color(0.25, 0.3, 0.65), 0.4), Vector3(0.0, 0.45, 0.25))
	sph(fruit, Vector3.ONE * 0.08, mat(Color(0.25, 0.3, 0.65), 0.4), Vector3(0.12, 0.45, 0.3))
	box(fruit, Vector3(0.25, 0.1, 0.12), mat(Color(0.95, 0.9, 0.75)), Vector3(-0.15, 0.45, 0.3), Vector3(0, 0.4, 0))
	return root

static func update_bowl(b: Node3D, pellets: float, veg: int, fruit: int) -> void:
	var food := b.get_node("food")
	var n := int(ceil(pellets / 100.0 * food.get_child_count()))
	for c in food.get_children():
		c.visible = int(c.get_meta("idx")) < n
	b.get_node("veg").visible = veg > 0
	b.get_node("fruit").visible = fruit > 0

## Поилка на стенке (ось носика смотрит в -X)
static func bottle() -> Node3D:
	var root := Node3D.new()
	var glass := mat(Color(0.85, 0.92, 0.95, 0.35), 0.1)
	cyl(root, 0.32, 0.32, 1.8, glass, Vector3(0, 2.3, 0))
	var water := cyl(root, 0.29, 0.29, 1.6, mat(Color(0.55, 0.78, 0.92, 0.55), 0.1), Vector3(0, 2.2, 0))
	water.name = "water"
	cyl(root, 0.34, 0.34, 0.3, mat(Color(0.45, 0.6, 0.48), 0.5), Vector3(0, 3.3, 0))
	cyl(root, 0.34, 0.25, 0.35, mat(Color(0.45, 0.6, 0.48), 0.5), Vector3(0, 1.25, 0))
	cyl(root, 0.06, 0.06, 0.8, mat(Color(0.8, 0.8, 0.82), 0.3, "metal"), Vector3(-0.25, 0.95, 0), Vector3(0, 0, -0.7))
	box(root, Vector3(0.1, 0.5, 0.4), mat(Color(0.45, 0.6, 0.48), 0.5), Vector3(0.3, 2.5, 0))
	return root

static func update_bottle(b: Node3D, level: float) -> void:
	var w: MeshInstance3D = b.get_node("water")
	var l := clampf(level / 100.0, 0.02, 1.0)
	w.scale = Vector3(1, l, 1)
	w.position.y = 1.4 + 0.8 * l

static func litter_tray() -> Node3D:
	var root := Node3D.new()
	var pl := mat(Color(0.62, 0.72, 0.64), 0.5)
	box(root, Vector3(2.0, 0.08, 1.7), pl, Vector3(0, 0.04, 0))
	box(root, Vector3(2.0, 0.55, 0.08), pl, Vector3(0, 0.28, 0.82))
	box(root, Vector3(2.0, 0.9, 0.08), pl, Vector3(0, 0.45, -0.82))
	box(root, Vector3(0.08, 0.9, 1.7), pl, Vector3(0.96, 0.45, 0))
	box(root, Vector3(0.08, 0.9, 1.7), pl, Vector3(-0.96, 0.45, 0))
	var fill := box(root, Vector3(1.85, 0.2, 1.55), mat(Color(0.93, 0.9, 0.82), 0.95), Vector3(0, 0.18, 0))
	fill.name = "fill"
	return root

## Рука игрока (мягкая, стилизованная)
static func hand() -> Node3D:
	var root := Node3D.new()
	var skin := mat(Color(0.96, 0.8, 0.68), 0.6)
	sph(root, Vector3(0.75, 0.22, 0.85), skin, Vector3(0, 0.2, 0))
	for i in 4:
		var x := -0.45 + i * 0.3
		var f := Node3D.new()
		f.position = Vector3(x, 0.22, -0.7)
		root.add_child(f)
		sph(f, Vector3(0.12, 0.11, 0.42), skin, Vector3(0, 0, -0.32 + absf(x) * 0.15))
	var th := Node3D.new()
	th.position = Vector3(0.7, 0.22, -0.2)
	th.rotation.y = -0.8
	root.add_child(th)
	sph(th, Vector3(0.13, 0.12, 0.38), skin, Vector3(0, 0, -0.25))
	sph(root, Vector3(0.6, 0.25, 0.6), mat(Color(0.75, 0.82, 0.88), 0.9, "fabric"), Vector3(0, 0.22, 1.15))
	return root
