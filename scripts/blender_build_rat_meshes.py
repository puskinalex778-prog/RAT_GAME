import bpy
import bmesh
import math
import os
from mathutils import Vector

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "godot_rat_home", "assets", "models"))
os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def export_obj(obj, filename):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    out_path = os.path.join(OUT_DIR, filename)
    # Writing raw Blender (X, Y, Z) verbatim into OBJ requires forward_axis='Y', up_axis='Z'
    bpy.ops.wm.obj_export(
        filepath=out_path,
        export_selected_objects=True,
        export_materials=False,
        export_normals=True,
        export_uv=True,
        forward_axis='Y',
        up_axis='Z',
        apply_modifiers=True,
    )
    print(f"Exported {out_path}")


def create_lofted_mesh(name, sections, ring_verts=16, subsurf_levels=1, belly_flat=0.14):
    """
    Creates a closed organic lofted mesh directly in Godot coordinates:
    sections: list of (z, cy, rx, ry, arch_top, cheek_bulge)
    from rear (+Z) to front (-Z).
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    rings = []

    for sec in sections:
        z, cy, rx, ry = sec[0], sec[1], sec[2], sec[3]
        arch = sec[4] if len(sec) > 4 else 0.0
        bulge = sec[5] if len(sec) > 5 else 0.0
        ring = []
        for i in range(ring_verts):
            ang = (i / ring_verts) * math.tau  # 0 = top (+Y), pi/2 = +X, pi = bottom (-Y)
            sx = math.sin(ang)
            sy = math.cos(ang)

            x = sx * rx
            y = sy * ry

            # Flatten underside gently for cozy rat belly / jaw
            if sy < 0:
                y *= (1.0 - belly_flat * abs(sy))
            else:
                y += arch * (sy ** 2)

            # Optional lower-cheek / whisker pad fullness
            if bulge > 0.0 and sy < 0.15 and sy > -0.65:
                x *= (1.0 + bulge * (1.0 - abs(sy + 0.25) * 1.5))

            v = bm.verts.new(Vector((x, cy + y, z)))
            ring.append(v)
        rings.append(ring)

    # Rear cap tip
    z0, cy0, rx0, ry0 = sections[0][0], sections[0][1], sections[0][2], sections[0][3]
    rear_tip = bm.verts.new(Vector((0.0, cy0, z0 + max(0.03, ry0 * 0.35))))
    # Front cap tip
    zn, cyn, rxn, ryn = sections[-1][0], sections[-1][1], sections[-1][2], sections[-1][3]
    front_tip = bm.verts.new(Vector((0.0, cyn, zn - max(0.025, ryn * 0.32))))

    # Stitch rings
    for r_idx in range(len(rings) - 1):
        r1 = rings[r_idx]
        r2 = rings[r_idx + 1]
        for i in range(ring_verts):
            ni = (i + 1) % ring_verts
            bm.faces.new((r1[i], r2[i], r2[ni], r1[ni]))

    # Cap rear & front cleanly
    for i in range(ring_verts):
        ni = (i + 1) % ring_verts
        bm.faces.new((rear_tip, rings[0][i], rings[0][ni]))
        bm.faces.new((front_tip, rings[-1][ni], rings[-1][i]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    # Smooth shading
    for poly in mesh.polygons:
        poly.use_smooth = True

    if subsurf_levels > 0:
        mod = obj.modifiers.new(name="Subsurf", type='SUBSURF')
        mod.levels = subsurf_levels
        mod.render_levels = subsurf_levels

    return obj


def build_rat_torso():
    clear_scene()
    # Rat-space torso: rear rump at +Z (~0.92), front shoulders/neck at -Z (~-0.78)
    # Pivot is at origin (0, 0, 0) in rat-space; RatModel offsets by SP = (0, 0.12, 0.58)
    sections = [
        # (z,     cy,   rx,   ry,  arch, bulge)
        (0.90,  0.40, 0.16, 0.15, 0.00, 0.00),  # tail root transition
        (0.76,  0.47, 0.36, 0.34, 0.02, 0.04),  # rear rump curve
        (0.54,  0.54, 0.50, 0.45, 0.05, 0.08),  # plump haunches (widest pear shape)
        (0.28,  0.55, 0.51, 0.46, 0.07, 0.05),  # arched lumbar back
        (0.02,  0.53, 0.46, 0.43, 0.06, 0.02),  # mid torso
        (-0.24, 0.50, 0.41, 0.39, 0.03, 0.00),  # ribcage
        (-0.48, 0.48, 0.35, 0.34, 0.01, 0.00),  # shoulders
        (-0.68, 0.53, 0.27, 0.26, 0.00, 0.00),  # neck blend
        (-0.80, 0.57, 0.18, 0.17, 0.00, 0.00),  # collar tucked inside head
    ]
    obj = create_lofted_mesh("RatTorso", sections, ring_verts=18, subsurf_levels=1, belly_flat=0.22)
    # Translate into SP-local coordinates so origin sits at SP = (0, 0.12, 0.58)
    for v in obj.data.vertices:
        v.co -= Vector((0.0, 0.12, 0.58))
    obj.data.update()
    export_obj(obj, "rat_torso.obj")


def build_rat_head():
    clear_scene()
    # Rat-space head: neck at z = -0.68, cranium around -0.96, eye area -1.14, tapered snout to -1.49
    # Shifted into NECK-local coordinates: NECK = (0, 0.62, -0.72)
    sections = [
        # (z,     cy,   rx,   ry,  arch, bulge)
        (-0.68, 0.60, 0.21, 0.20, 0.00, 0.00),  # neck base
        (-0.82, 0.67, 0.28, 0.26, 0.03, 0.08),  # back cranium
        (-0.98, 0.68, 0.30, 0.26, 0.04, 0.14),  # full rounded cheeks
        (-1.12, 0.65, 0.24, 0.21, 0.02, 0.10),  # eye sockets & brow
        (-1.26, 0.61, 0.17, 0.15, 0.01, 0.12),  # bridge & mystacial whisker pads
        (-1.38, 0.59, 0.11, 0.10, 0.00, 0.08),  # delicate tapered muzzle
        (-1.46, 0.59, 0.06, 0.055, 0.00, 0.00), # nose tip socket
    ]
    obj = create_lofted_mesh("RatHead", sections, ring_verts=16, subsurf_levels=1, belly_flat=0.16)
    for v in obj.data.vertices:
        v.co -= Vector((0.0, 0.62, -0.72))
    obj.data.update()
    export_obj(obj, "rat_head.obj")


def build_ear(filename, width, height, cup_depth):
    clear_scene()
    mesh = bpy.data.meshes.new("RatEar")
    obj = bpy.data.objects.new("RatEar", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    # Create a rounded cupped organic ear shell facing -Z (forward)
    rings_u = 14
    rings_v = 6
    verts_grid = []

    for iv in range(rings_v):
        t = iv / (rings_v - 1)  # 0 = center, 1 = outer rim
        row = []
        for iu in range(rings_u):
            ang = (iu / rings_u) * math.tau
            # Slightly pear/oval ear contour (narrower at bottom attach, wider & rounded at top)
            sx = math.cos(ang)
            sy = math.sin(ang)
            top_round = 1.0 + 0.15 * max(0.0, sy)
            x = sx * width * t * top_round
            y = (sy + 0.35) * height * t * 0.72
            # Concave cup curving forward (-Z) at outer edge
            z = (1.0 - t * t) * cup_depth
            row.append(bm.verts.new(Vector((x, y, z))))
        verts_grid.append(row)

    # Outer shell faces
    for iv in range(rings_v - 1):
        for iu in range(rings_u):
            nu = (iu + 1) % rings_u
            bm.faces.new((verts_grid[iv][iu], verts_grid[iv + 1][iu], verts_grid[iv + 1][nu], verts_grid[iv][nu]))

    # Close center hole
    center_v = bm.verts.new(Vector((0.0, 0.35 * height * 0.1, cup_depth)))
    for iu in range(rings_u):
        nu = (iu + 1) % rings_u
        bm.faces.new((center_v, verts_grid[0][iu], verts_grid[0][nu]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True

    solid = obj.modifiers.new(name="Solidify", type='SOLIDIFY')
    solid.thickness = 0.028
    solid.offset = 0.0

    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1

    export_obj(obj, filename)


def build_paw(filename, is_hind=False):
    clear_scene()
    mesh = bpy.data.meshes.new("RatPaw")
    obj = bpy.data.objects.new("RatPaw", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()

    def add_ellipsoid(center, scale):
        ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        for v in ret["verts"]:
            v.co = Vector((v.co.x * scale.x + center.x, v.co.y * scale.y + center.y, v.co.z * scale.z + center.z))

    palm = Vector((0.068, 0.032, 0.145 if is_hind else 0.072))
    add_ellipsoid(Vector((0.0, 0.0, 0.0)), palm)

    # 4 splayed delicate toes pointing -Z
    toe_angles = [-0.52, -0.17, 0.17, 0.52]
    toe_lengths = [0.068, 0.088, 0.088, 0.065] if is_hind else [0.052, 0.066, 0.066, 0.048]
    for ang, tlen in zip(toe_angles, toe_lengths):
        tx = math.sin(ang) * palm.x * 0.92
        tz = -palm.z * 0.72 - math.cos(ang) * tlen * 0.55
        add_ellipsoid(Vector((tx, -0.005, tz)), Vector((0.017, 0.014, tlen * 0.55)))
        # Cute rounded fingertip pad
        add_ellipsoid(Vector((tx * 1.12, -0.008, tz - tlen * 0.45)), Vector((0.015, 0.012, 0.018)))

    if is_hind:
        # Subtle inner 5th toe
        add_ellipsoid(Vector((palm.x * 0.92, -0.006, -palm.z * 0.25)), Vector((0.016, 0.013, 0.034)))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True

    export_obj(obj, filename)


def build_limb(filename, rx, ry, rz):
    clear_scene()
    sections = [
        (rz,   0.0, rx * 0.55, ry * 0.55),
        (rz * 0.4, 0.0, rx * 0.95, ry * 0.95),
        (-rz * 0.3, 0.0, rx * 0.85, ry * 0.88),
        (-rz,  0.0, rx * 0.50, ry * 0.52),
    ]
    obj = create_lofted_mesh("RatLimb", sections, ring_verts=12, subsurf_levels=1, belly_flat=0.0)
    export_obj(obj, filename)


if __name__ == "__main__":
    build_rat_torso()
    build_rat_head()
    build_ear("rat_ear_standard.obj", width=0.145, height=0.175, cup_depth=0.055)
    build_ear("rat_ear_dumbo.obj", width=0.205, height=0.195, cup_depth=0.072)
    build_paw("rat_front_paw.obj", is_hind=False)
    build_paw("rat_hind_paw.obj", is_hind=True)
    build_limb("rat_front_arm.obj", rx=0.082, ry=0.165, rz=0.092)
    build_limb("rat_hind_thigh.obj", rx=0.145, ry=0.195, rz=0.21)
    print("ALL BLENDER RAT MESHES GENERATED SUCCESSFULLY!")
