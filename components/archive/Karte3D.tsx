"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Atom, AtomCategory } from "@/lib/atoms/types";
import { CATMETA } from "@/lib/atoms/data";
import type { Mode } from "@/lib/atoms/compose";

const CATEGORY_Y: Record<AtomCategory, number> = {
  authority: 55,
  causality: 18,
  adjudication: -18,
  epistemic: -55,
};

const RELATIONS: [string, string, AtomCategory][] = [
  ["constitution", "monopoly", "authority"],
  ["monopoly", "marker", "authority"],
  ["constitution", "melderecht", "authority"],
  ["monopoly", "verify", "adjudication"],
  ["verify", "oracle", "adjudication"],
  ["commit_precedent", "pr_tribunal", "adjudication"],
  ["unknown", "semantic", "causality"],
  ["worldlaws", "semantic", "causality"],
  ["realm", "recursive", "epistemic"],
  ["inherit", "verify", "causality"],
  ["single_file", "constitution", "authority"],
  ["pr_tribunal", "unknown", "adjudication"],
];

function hexColor(css: string): number {
  return new THREE.Color(css).getHex();
}

export function Karte3D({
  atoms,
  mode,
  onHover,
  onLeave,
}: {
  atoms: Atom[];
  mode: Mode;
  onHover: (e: React.MouseEvent, atom: Atom) => void;
  onLeave: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.set(120, 90, 210);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minDistance = 60;
    controls.maxDistance = 600;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const point = new THREE.PointLight(0xb78a3e, 1.2, 800);
    point.position.set(150, 150, 150);
    scene.add(point);

    // faint reference rings, one per category "floor"
    (Object.keys(CATEGORY_Y) as AtomCategory[]).forEach((cat) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(68, 70, 48),
        new THREE.MeshBasicMaterial({ color: hexColor(CATMETA[cat].color), transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = CATEGORY_Y[cat];
      scene.add(ring);
    });

    const grouped: Record<AtomCategory, Atom[]> = { authority: [], causality: [], adjudication: [], epistemic: [] };
    atoms.forEach((a) => grouped[a.cat].push(a));
    const maxCount = Math.max(1, ...atoms.map((a) => a.count ?? 1));

    const positions = new Map<string, THREE.Vector3>();
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeAtoms = new Map<THREE.Mesh, Atom>();

    (Object.keys(grouped) as AtomCategory[]).forEach((cat) => {
      const arr = grouped[cat];
      const n = arr.length;
      const y = CATEGORY_Y[cat];
      arr.forEach((a, i) => {
        const angle = n === 1 ? 0 : (i / n) * Math.PI * 2;
        const radius = 69;
        const pos = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        positions.set(a.id, pos);

        const scale = mode === "meta" ? 0.7 + ((a.count ?? 1) / maxCount) * 0.9 : 1;
        const geometry = new THREE.SphereGeometry(5 * scale, 20, 20);
        const color = hexColor(CATMETA[a.cat].color);
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: a.hyp ? 0.15 : 0.35,
          wireframe: a.hyp,
          transparent: true,
          opacity: a.hyp ? 0.55 : 0.95,
          roughness: 0.4,
          metalness: 0.2,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(pos);
        scene.add(mesh);
        nodeMeshes.push(mesh);
        nodeAtoms.set(mesh, a);
      });
    });

    RELATIONS.forEach(([s, t, cat]) => {
      const p0 = positions.get(s);
      const p1 = positions.get(t);
      if (!p0 || !p1) return;
      const a = atoms.find((x) => x.id === s);
      const b = atoms.find((x) => x.id === t);
      const hyp = !!(a?.hyp || b?.hyp);
      const mid = p0.clone().add(p1).multiplyScalar(0.5).add(new THREE.Vector3(0, 14, 0));
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
      const points = curve.getPoints(24);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = hyp
        ? new THREE.LineDashedMaterial({ color: 0x7c8290, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.6 })
        : new THREE.LineBasicMaterial({ color: hexColor(CATMETA[cat].color), transparent: true, opacity: 0.65 });
      const line = new THREE.Line(geometry, material);
      if (hyp) line.computeLineDistances();
      scene.add(line);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;

    function onPointerMove(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh;
        hovered = mesh;
        const atom = nodeAtoms.get(mesh);
        if (atom) {
          onHover({ clientX: ev.clientX, clientY: ev.clientY } as unknown as React.MouseEvent, atom);
        }
        renderer.domElement.style.cursor = "pointer";
      } else if (hovered) {
        hovered = null;
        onLeave();
        renderer.domElement.style.cursor = "default";
      }
    }
    function onPointerLeaveDom() {
      if (hovered) {
        hovered = null;
        onLeave();
      }
    }
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeaveDom);

    let raf = 0;
    function animate() {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeaveDom);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atoms, mode]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", aspectRatio: "520 / 420", minHeight: 260, borderRadius: 10, overflow: "hidden", cursor: "grab" }}
    />
  );
}
