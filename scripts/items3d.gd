class_name Items3D
extends RefCounted
## Процедурные 3D-модели предметов v2.1: детализированная мебель клетки, посуда, поилка, домик со сквозным входом, переноска.
## Начало координат — точка опоры на поверхности, «перед» смотрит в +Z.

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
			s.metallic = 0.72
			s.roughness = 0.30
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
	t.ring_segments = 10
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
	var segs := 20
	var rings := 12
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
	# Мягкие валики-окантовки по краям туннеля
	var trim := mat(Color(0.92, 0.88, 0.80), 0.92, "fabric")
	torus(p, r * 0.90, r * 1.09, trim, pos + Vector3(-length / 2, r, 0), Vector3(0, 0, PI / 2))
	torus(p, r * 0.90, r * 1.09, trim, pos + Vector3(length / 2, r, 0), Vector3(0, 0, PI / 2))
	return mi

## Провисающее полотно гамака (ткань)
static func cloth(p: Node3D, w: float, d: float, sag: float, m: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var nx := 14
	var nz := 10
	var pts := []
	for i in nx + 1:
		var row := []
		for j in nz + 1:
			var u := float(i) / nx
			var v := float(j) / nz
			var y := -sag * sin(u * PI) * (0.62 + 0.38 * sin(v * PI))
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
	var mi := box(p, Vector3(0.07, len, 0.035), m, mid)
	var dir := (to - from).normalized()
	if absf(dir.dot(Vector3.UP)) < 0.999:
		mi.basis = Basis(Quaternion(Vector3.UP, dir))
	var metal := mat(Color(0.72, 0.73, 0.75), 0.28, "metal")
	torus(p, 0.045, 0.085, metal, to, Vector3(PI / 2, 0, 0))
	torus(p, 0.04, 0.07, metal, from, Vector3(PI / 2, 0, 0))

# ---------------------------------------------------------------------
## Создать модель предмета. hang_up — расстояние до точки подвеса (для подвесных).
static func make(item_id: String, color_idx := 0, hang_up := 3.0) -> Node3D:
	var root := Node3D.new()
	root.name = item_id
	var it: Dictionary = Data.ITEMS.get(item_id, {})
	var cols: Array = it.get("colors", ["#c9a36b"])
	var col := Color(cols[color_idx % cols.size()])
	var wood := mat(col, 0.72, "wood")
	var wood_dark := mat(col.darkened(0.20), 0.74, "wood")
	var wood_in := mat(col.darkened(0.45), 0.92)
	var dark := mat(Color(0.14, 0.10, 0.08), 0.98)
	match item_id:
		"wood_house":
			# Уютный деревянный домик с реальным сквозным входом, тёмным интерьером, свесами крыши и окошком!
			# Основание/пол внутри
			box(root, Vector3(2.16, 0.08, 1.76), wood_dark, Vector3(0, 0.04, 0))
			# Задняя и боковые стенки
			box(root, Vector3(2.16, 1.18, 0.12), wood, Vector3(0, 0.63, -0.84))
			box(root, Vector3(0.12, 1.18, 1.78), wood, Vector3(-1.02, 0.63, 0))
			box(root, Vector3(0.12, 1.18, 1.78), wood, Vector3(1.02, 0.63, 0))
			# Тёмная глубина внутри домика (утоплена, не выступает вперёд!)
			box(root, Vector3(1.90, 1.08, 0.06), wood_in, Vector3(0, 0.60, -0.74))
			# Передняя стенка из отдельных панелей вокруг настоящего арочного входа (вход в центре-справа)
			box(root, Vector3(0.76, 1.18, 0.12), wood, Vector3(-0.68, 0.63, 0.84))
			box(root, Vector3(0.48, 1.18, 0.12), wood, Vector3(0.84, 0.63, 0.84))
			box(root, Vector3(0.92, 0.36, 0.12), wood, Vector3(0.15, 1.04, 0.84))
			# Деревянный наличник над входом
			box(root, Vector3(0.94, 0.08, 0.16), wood_dark, Vector3(0.15, 0.87, 0.86))
			# Небольшое окошко слева с аккуратной рамкой (на глубине стены, без выступающих чёрных пятен!)
			box(root, Vector3(0.36, 0.36, 0.14), wood_dark, Vector3(-0.66, 0.74, 0.85))
			box(root, Vector3(0.26, 0.26, 0.15), dark, Vector3(-0.66, 0.74, 0.85))
			box(root, Vector3(0.04, 0.26, 0.16), wood, Vector3(-0.66, 0.74, 0.85))
			box(root, Vector3(0.26, 0.04, 0.16), wood, Vector3(-0.66, 0.74, 0.85))
			# Боковые фронтоны под двускатной крышей (скаты идут по ±Z, поэтому фронтоны на торцах x = ±1.02!)
			box(root, Vector3(0.12, 0.28, 1.42), wood, Vector3(-1.02, 1.32, 0))
			box(root, Vector3(0.12, 0.24, 0.72), wood, Vector3(-1.02, 1.56, 0))
			box(root, Vector3(0.12, 0.28, 1.42), wood, Vector3(1.02, 1.32, 0))
			box(root, Vector3(0.12, 0.24, 0.72), wood, Vector3(1.02, 1.56, 0))
			# Двускатная крыша со свесами и коньком
			box(root, Vector3(2.48, 0.12, 1.44), wood_dark, Vector3(0, 1.54, 0.54), Vector3(0.56, 0, 0))
			box(root, Vector3(2.48, 0.12, 1.44), wood_dark, Vector3(0, 1.54, -0.54), Vector3(-0.56, 0, 0))
			cyl(root, 0.08, 0.08, 2.50, wood_dark, Vector3(0, 1.90, 0), Vector3(0, 0, PI / 2), 12)
		"sleeping_pouch":
			var fab := mat(col, 0.94, "fabric")
			var plush := mat(Color(0.95, 0.91, 0.84), 0.96, "fabric")
			cyl(root, 0.36, 0.94, 1.48, fab, Vector3(0, 0.74, 0), Vector3.ZERO, 24)
			sph(root, Vector3(0.94, 0.14, 0.94), fab, Vector3(0, 0.04, 0))
			cyl(root, 0.38, 0.38, 0.06, dark, Vector3(0, 0.60, 0.76), Vector3(1.32, 0, 0))
			torus(root, 0.36, 0.50, plush, Vector3(0, 0.60, 0.79), Vector3(1.32, 0, 0))
			var sm := mat(Color(0.42, 0.52, 0.40), 0.82)
			strap(root, Vector3(-0.30, 1.42, 0), Vector3(-0.42, hang_up, 0), sm)
			strap(root, Vector3(0.30, 1.42, 0), Vector3(0.42, hang_up, 0), sm)
		"hammock", "hammock_double":
			var fab2 := mat(col, 0.94, "fabric")
			var trim2 := mat(Color(0.95, 0.91, 0.84), 0.94, "fabric")
			var layers := 2 if item_id == "hammock_double" else 1
			var sm2 := mat(col.darkened(0.28), 0.82)
			for l in layers:
				var y := 0.35 + l * 1.0
				cloth(root, 2.55, 1.78, 0.44, fab2, Vector3(0, y, 0))
				# Аккуратные боковые канты ткани
				box(root, Vector3(2.58, 0.04, 0.06), trim2, Vector3(0, y, -0.89))
				box(root, Vector3(2.58, 0.04, 0.06), trim2, Vector3(0, y, 0.89))
				for cx in [-1.28, 1.28]:
					for cz in [-0.88, 0.88]:
						strap(root, Vector3(cx, y, cz), Vector3(cx * 1.08, hang_up if l == layers - 1 else y + 1.0, cz * 0.92), sm2)
		"tunnel", "tunnel_long":
			var length := 2.55 if item_id == "tunnel" else 3.45
			tube(root, 0.48, length, mat(col, 0.94, "fabric"), Vector3.ZERO, 0.0 if item_id == "tunnel" else 0.38)
		"bridge":
			var n := 10
			for i in n:
				var u := float(i) / (n - 1)
				var x := (u - 0.5) * 2.75
				var y := 0.14 + 0.44 * sin(u * PI)
				cyl(root, 0.11, 0.11, 1.28, wood if i % 2 == 0 else wood_dark, Vector3(x, y, 0), Vector3(PI / 2, 0, 0), 10)
			for z in [-0.58, 0.58]:
				for i in 5:
					var u2 := float(i) / 4.0
					cyl(root, 0.045, 0.045, 0.42, wood_dark, Vector3((u2 - 0.5) * 2.55, 0.34 + 0.44 * sin(u2 * PI) + 0.18, z), Vector3.ZERO, 8)
		"foraging_box":
			var card := mat(Color(0.75, 0.58, 0.38), 0.92)
			var card_d := mat(Color(0.62, 0.46, 0.28), 0.94)
			box(root, Vector3(1.68, 0.08, 1.28), card_d, Vector3(0, 0.04, 0))
			box(root, Vector3(1.68, 0.76, 0.07), card, Vector3(0, 0.38, 0.61))
			box(root, Vector3(1.68, 0.76, 0.07), card, Vector3(0, 0.38, -0.61))
			box(root, Vector3(0.07, 0.76, 1.28), card, Vector3(0.81, 0.38, 0))
			box(root, Vector3(0.07, 0.76, 1.28), card, Vector3(-0.81, 0.38, 0))
			for hx in [-0.42, 0.42]:
				cyl(root, 0.14, 0.14, 0.09, dark, Vector3(hx, 0.40, 0.62), Vector3(PI / 2, 0, 0), 14)
			var rng := RandomNumberGenerator.new()
			rng.seed = 7
			for i in 26:
				var c2: Color = [Color(0.56, 0.68, 0.48), Color(0.92, 0.89, 0.80), Color(0.76, 0.82, 0.66)][i % 3]
				box(root, Vector3(0.24, 0.03, 0.08), mat(c2, 0.92), Vector3(rng.randf_range(-0.66, 0.66), rng.randf_range(0.32, 0.60), rng.randf_range(-0.46, 0.46)), Vector3(rng.randf() * 3, rng.randf() * 3, rng.randf() * 3))
		"puzzle_feeder":
			box(root, Vector3(1.88, 0.26, 0.84), wood, Vector3(0, 0.13, 0))
			box(root, Vector3(1.94, 0.06, 0.90), wood_dark, Vector3(0, 0.03, 0))
			for i in 3:
				var lx := -0.58 + i * 0.58
				cyl(root, 0.23, 0.23, 0.08, mat(col.lightened(0.08), 0.7, "wood"), Vector3(lx, 0.30, 0), Vector3.ZERO, 16)
				sph(root, Vector3(0.075, 0.075, 0.075), wood_dark, Vector3(lx, 0.40, 0))
		"chew_sticks":
			var bark := mat(Color(0.48, 0.34, 0.20), 0.9, "wood")
			var core := mat(Color(0.84, 0.74, 0.56), 0.85)
			var pos := [Vector3(-0.20, 0.09, 0), Vector3(0.0, 0.09, 0), Vector3(0.20, 0.09, 0), Vector3(-0.10, 0.24, 0), Vector3(0.10, 0.24, 0)]
			for p in pos:
				cyl(root, 0.085, 0.085, 1.05, bark, p, Vector3(PI / 2, 0.08 * p.x, 0), 10)
				cyl(root, 0.065, 0.065, 1.07, core, p, Vector3(PI / 2, 0.08 * p.x, 0), 10)
		"nesting_paper":
			var rng2 := RandomNumberGenerator.new()
			rng2.seed = 3
			var paper := mat(col, 0.95)
			for i in 36:
				var a := rng2.randf() * TAU
				var rr := rng2.randf() * 0.52
				box(root, Vector3(0.32, 0.02, 0.07), paper, Vector3(cos(a) * rr, 0.03 + rng2.randf() * 0.28 * (1.0 - rr), sin(a) * rr), Vector3(rng2.randf() * 2, rng2.randf() * 3, rng2.randf() * 2))
		"ball":
			var bm := mat(col, 0.88, "wood")
			for i in 4:
				torus(root, 0.24, 0.30, bm, Vector3(0, 0.30, 0), Vector3(i * PI / 4, i * 0.7, 0))
		"platform":
			box(root, Vector3(2.75, 0.14, 1.55), wood, Vector3(0, -0.07, 0))
			box(root, Vector3(2.75, 0.28, 0.08), wood_dark, Vector3(0, 0.08, 0.74))
			for bx in [-1.1, 1.1]:
				box(root, Vector3(0.10, 0.85, 0.10), mat(Color(0.45, 0.44, 0.42), 0.35, "metal"), Vector3(bx, -0.45, -0.65), Vector3(0.55, 0, 0))
		"wheel":
			var wm := mat(col, 0.55)
			var stand := mat(Color(0.38, 0.36, 0.34), 0.38, "metal")
			cyl(root, 1.55, 1.55, 0.06, wm, Vector3(0, 1.72, -0.44), Vector3(PI / 2, 0, 0), 32)
			var ring := tube_ring(root, 1.55, 0.88, wm)
			ring.position = Vector3(0, 1.72, 0)
			cyl(root, 0.16, 0.16, 0.22, stand, Vector3(0, 1.72, -0.48), Vector3(PI / 2, 0, 0), 16)
			box(root, Vector3(0.18, 1.72, 0.18), stand, Vector3(0, 0.86, -0.60))
			box(root, Vector3(1.65, 0.12, 1.05), stand, Vector3(0, 0.06, -0.32))
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
	for j in 12:
		var a := TAU * j / 12.0
		var b := BoxMesh.new()
		b.size = Vector3(0.05, 0.05, w)
		var s := MeshInstance3D.new()
		s.mesh = b
		s.material_override = mat(Color(0.55, 0.54, 0.52))
		s.position = Vector3(r * 0.98 * cos(a), r * 0.98 * sin(a), 0)
		mi.add_child(s)
	return mi

## Глазурованная керамическая миска с кормом (строго компактная, все кусочки внутри чаши!)
static func bowl() -> Node3D:
	var root := Node3D.new()
	root.name = "FoodBowl"
	var cer := mat(Color(0.28, 0.52, 0.46), 0.30)
	var cer_in := mat(Color(0.86, 0.83, 0.77), 0.38)
	# Внешняя стенка миски + скруглённый бортик + утопленное дно
	cyl(root, 0.70, 0.58, 0.30, cer, Vector3(0, 0.15, 0), Vector3.ZERO, 28)
	torus(root, 0.56, 0.72, cer, Vector3(0, 0.30, 0))
	cyl(root, 0.56, 0.56, 0.04, cer_in, Vector3(0, 0.26, 0), Vector3.ZERO, 24)
	# Гранулы корма строго внутри радиуса 0.46
	var food := Node3D.new()
	food.name = "food"
	root.add_child(food)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var pm := mat(Color(0.50, 0.34, 0.21), 0.88)
	var pm2 := mat(Color(0.42, 0.29, 0.18), 0.90)
	for i in 34:
		var a := rng.randf() * TAU
		var rr := sqrt(rng.randf()) * 0.44
		var b := box(food, Vector3(0.11, 0.085, 0.11), pm if i % 2 == 0 else pm2, Vector3(cos(a) * rr, 0.31 + rng.randf() * 0.11 * (1.0 - rr / 0.5), sin(a) * rr), Vector3(rng.randf() * 3, rng.randf() * 3, 0))
		b.set_meta("idx", i)
	# Овощи (морковка, брокколи, огурчик)
	var veg := Node3D.new()
	veg.name = "veg"
	root.add_child(veg)
	cyl(veg, 0.045, 0.075, 0.26, mat(Color(0.92, 0.48, 0.14), 0.65), Vector3(-0.18, 0.40, 0.08), Vector3(0, 0, 1.38), 12)
	sph(veg, Vector3(0.11, 0.09, 0.11), mat(Color(0.26, 0.52, 0.24), 0.75), Vector3(0.14, 0.40, -0.14))
	cyl(veg, 0.11, 0.11, 0.05, mat(Color(0.66, 0.82, 0.52), 0.65), Vector3(0.20, 0.39, 0.16), Vector3.ZERO, 14)
	# Фрукты (черника и долька яблока)
	var fruit := Node3D.new()
	fruit.name = "fruit"
	root.add_child(fruit)
	sph(fruit, Vector3.ONE * 0.07, mat(Color(0.24, 0.28, 0.62), 0.38), Vector3(-0.02, 0.40, 0.20))
	sph(fruit, Vector3.ONE * 0.07, mat(Color(0.24, 0.28, 0.62), 0.38), Vector3(0.10, 0.40, 0.24))
	box(fruit, Vector3(0.22, 0.09, 0.10), mat(Color(0.92, 0.86, 0.68), 0.65), Vector3(-0.14, 0.40, 0.22), Vector3(0, 0.4, 0))
	return root

static func update_bowl(b: Node3D, pellets: float, veg: int, fruit: int) -> void:
	var food := b.get_node("food")
	var n := int(ceil(pellets / 100.0 * food.get_child_count()))
	for c in food.get_children():
		c.visible = int(c.get_meta("idx")) < n
	b.get_node("veg").visible = veg > 0
	b.get_node("fruit").visible = fruit > 0

## Поилка снаружи правой стенки (носик с шариком аккуратно входит внутрь клетки по -X)
static func bottle() -> Node3D:
	var root := Node3D.new()
	root.name = "WaterBottle"
	var glass := mat(Color(0.84, 0.92, 0.96, 0.42), 0.12)
	cyl(root, 0.31, 0.31, 1.78, glass, Vector3(0, 2.26, 0), Vector3.ZERO, 20)
	var water := cyl(root, 0.26, 0.26, 1.56, mat(Color(0.42, 0.72, 0.88, 0.66), 0.12), Vector3(0, 2.16, 0), Vector3.ZERO, 20)
	water.name = "water"
	var cap := mat(Color(0.30, 0.50, 0.39), 0.42)
	var metal := mat(Color(0.78, 0.80, 0.82), 0.24, "metal")
	cyl(root, 0.34, 0.34, 0.28, cap, Vector3(0, 3.24, 0), Vector3.ZERO, 20)
	cyl(root, 0.34, 0.22, 0.34, cap, Vector3(0, 1.24, 0), Vector3.ZERO, 20)
	# Металлический носик с шариком внутрь клетки
	cyl(root, 0.05, 0.05, 1.05, metal, Vector3(-0.42, 0.90, 0), Vector3(0, 0, -0.88), 12)
	sph(root, Vector3.ONE * 0.055, metal, Vector3(-0.82, 0.56, 0))
	# Надёжный держатель на прутьях снаружи
	torus(root, 0.31, 0.36, cap, Vector3(0, 2.35, 0))
	box(root, Vector3(0.18, 0.46, 0.44), cap, Vector3(-0.34, 2.35, 0))
	return root

static func update_bottle(b: Node3D, level: float) -> void:
	var w: MeshInstance3D = b.get_node("water")
	var l := clampf(level / 100.0, 0.02, 1.0)
	w.scale = Vector3(1, l, 1)
	w.position.y = 1.38 + 0.78 * l

## Аккуратный лоток с низким передним бортиком и гранулами
static func litter_tray() -> Node3D:
	var root := Node3D.new()
	root.name = "LitterTray"
	var pl := mat(Color(0.46, 0.58, 0.49), 0.48)
	var pl_rim := mat(Color(0.38, 0.50, 0.41), 0.45)
	box(root, Vector3(1.96, 0.08, 1.66), pl, Vector3(0, 0.04, 0))
	box(root, Vector3(1.96, 0.42, 0.10), pl, Vector3(0, 0.21, 0.79))
	box(root, Vector3(1.96, 0.86, 0.10), pl, Vector3(0, 0.43, -0.79))
	box(root, Vector3(0.10, 0.86, 1.66), pl, Vector3(0.93, 0.43, 0))
	box(root, Vector3(0.10, 0.86, 1.66), pl, Vector3(-0.93, 0.43, 0))
	# Верхний декоративный кант лотка
	box(root, Vector3(2.04, 0.08, 0.14), pl_rim, Vector3(0, 0.86, -0.79))
	box(root, Vector3(0.14, 0.08, 1.72), pl_rim, Vector3(0.93, 0.86, 0))
	box(root, Vector3(0.14, 0.08, 1.72), pl_rim, Vector3(-0.93, 0.86, 0))
	var fill := box(root, Vector3(1.76, 0.20, 1.46), mat(Color(0.80, 0.75, 0.65), 0.95), Vector3(0, 0.18, 0))
	fill.name = "fill"
	return root

## Рука игрока (мягкая, стилизованная)
static func hand() -> Node3D:
	var root := Node3D.new()
	var skin := mat(Color(0.94, 0.78, 0.66), 0.62)
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
	sph(root, Vector3(0.6, 0.25, 0.6), mat(Color(0.72, 0.80, 0.86), 0.9, "fabric"), Vector3(0, 0.22, 1.15))
	return root

## Картонный домик-переноска из зоомагазина (для вступительной кат-сцены)
static func carrier_box() -> Node3D:
	var root := Node3D.new()
	root.name = "CarrierBox"
	var kraft := mat(Color(0.68, 0.50, 0.32), 0.90)
	var kraft_trim := mat(Color(0.56, 0.40, 0.25), 0.92)
	var kraft_in := mat(Color(0.46, 0.33, 0.20), 0.95)
	var band := mat(Color(0.30, 0.50, 0.38), 0.78)
	var dark := mat(Color(0.16, 0.11, 0.08), 0.95)
	var bed := mat(Color(0.84, 0.76, 0.62), 0.95)

	# Дно + мягкая подстилка внутри
	box(root, Vector3(2.45, 0.10, 1.85), kraft_trim, Vector3(0, 0.05, 0))
	box(root, Vector3(2.25, 0.10, 1.65), bed, Vector3(0, 0.12, 0))

	# 4 стенки коробки (аккуратная высота 1.25, чтобы крыску отлично было видно при открытии!)
	box(root, Vector3(2.45, 1.24, 0.09), kraft, Vector3(0, 0.67, 0.88))
	box(root, Vector3(2.45, 1.24, 0.09), kraft, Vector3(0, 0.67, -0.88))
	box(root, Vector3(0.09, 1.24, 1.85), kraft, Vector3(-1.18, 0.67, 0))
	box(root, Vector3(0.09, 1.24, 1.85), kraft, Vector3(1.18, 0.67, 0))
	box(root, Vector3(2.26, 1.12, 0.03), kraft_in, Vector3(0, 0.64, -0.82))

	# Декоративная зелёная полоска зоомагазина + отверстия вентиляции
	box(root, Vector3(2.49, 0.22, 0.11), band, Vector3(0, 0.30, 0.88))
	box(root, Vector3(2.49, 0.22, 0.11), band, Vector3(0, 0.30, -0.88))
	box(root, Vector3(0.11, 0.22, 1.89), band, Vector3(-1.18, 0.30, 0))
	box(root, Vector3(0.11, 0.22, 1.89), band, Vector3(1.18, 0.30, 0))
	for hx in [-0.66, 0.0, 0.66]:
		cyl(root, 0.10, 0.10, 0.12, dark, Vector3(hx, 0.88, 0.88), Vector3(PI / 2, 0, 0), 14)
		cyl(root, 0.10, 0.10, 0.12, dark, Vector3(hx, 0.88, -0.88), Vector3(PI / 2, 0, 0), 14)
	for hz in [-0.38, 0.38]:
		cyl(root, 0.10, 0.10, 0.12, dark, Vector3(-1.18, 0.88, hz), Vector3(0, 0, PI / 2), 14)
		cyl(root, 0.10, 0.10, 0.12, dark, Vector3(1.18, 0.88, hz), Vector3(0, 0, PI / 2), 14)

	# Две открывающиеся створки крышки-домика (шарниры по краям z = ±0.88)
	var flap_back := Node3D.new()
	flap_back.name = "FlapBack"
	flap_back.position = Vector3(0, 1.29, -0.88)
	box(flap_back, Vector3(2.44, 0.07, 0.98), kraft, Vector3(0, 0.22, 0.44), Vector3(-0.44, 0, 0))
	box(flap_back, Vector3(1.05, 0.28, 0.07), kraft_trim, Vector3(0, 0.56, 0.84))
	root.add_child(flap_back)

	var flap_front := Node3D.new()
	flap_front.name = "FlapFront"
	flap_front.position = Vector3(0, 1.29, 0.88)
	box(flap_front, Vector3(2.44, 0.07, 0.98), kraft, Vector3(0, 0.22, -0.44), Vector3(0.44, 0, 0))
	box(flap_front, Vector3(1.05, 0.28, 0.07), kraft_trim, Vector3(0, 0.56, -0.84))
	root.add_child(flap_front)

	return root
