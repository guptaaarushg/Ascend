import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";

export type HoloMilestone = {
  year: number;
  title: string;
  description: string;
  skills?: string[];
  resources?: string[];
  opportunity_ids?: string[];
  why_you?: string;
  action_steps?: string[];
  targets?: string[];
  checkpoint?: string;
  school_year?: string | null;
  stage?: string | null;
};

type SceneColors = { primary: string; secondary: string; stage: string };

const fallbackColors: SceneColors = { primary: "#e05a47", secondary: "#8da27e", stage: "#14110f" };

function useSceneColors() {
  const [colors, setColors] = useState(fallbackColors);
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    setColors({
      primary: read("--hologram-primary", fallbackColors.primary),
      secondary: read("--hologram-secondary", fallbackColors.secondary),
      stage: read("--hologram-stage", fallbackColors.stage),
    });
  }, []);
  return colors;
}

/** Spiral path that rises upward, like a staircase of years. */
function buildPoints(count: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = t * Math.PI * 1.6 - Math.PI * 0.8;
    pts.push(new THREE.Vector3(Math.sin(angle) * 3.2, -1.2 + t * 3.0, Math.cos(angle) * 2.2 - 0.6));
  }
  return pts;
}

/** Glowing tube path; the completed portion fills in smoothly. */
function PathTube({ curve, progress, colors }: { curve: THREE.Curve<THREE.Vector3>; progress: number; colors: SceneColors }) {
  const base = useMemo(() => new THREE.TubeGeometry(curve, 240, 0.03, 10, false), [curve]);
  const filled = useMemo(() => new THREE.TubeGeometry(curve, 240, 0.055, 12, false), [curve]);
  const shown = useRef(0);
  const total = filled.index ? filled.index.count : 0;
  useFrame((_, raw) => {
    shown.current = THREE.MathUtils.damp(shown.current, progress, 3, Math.min(raw, 0.05));
    filled.setDrawRange(0, Math.floor(total * shown.current / 6) * 6);
  });
  return (
    <>
      <mesh geometry={base}>
        <meshBasicMaterial color={colors.secondary} transparent opacity={0.35} />
      </mesh>
      <mesh geometry={filled}>
        <meshBasicMaterial color={colors.primary} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Light pulses travelling along the path. */
function FlowParticles({ curve, color, count = 40 }: { curve: THREE.Curve<THREE.Vector3>; color: string; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Array.from({ length: count }, (_, i) => i / count), [count]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    offsets.forEach((o, i) => {
      const t = (o + clock.elapsedTime * 0.04) % 1;
      dummy.position.copy(curve.getPointAt(t));
      dummy.scale.setScalar(0.5 + Math.sin(t * Math.PI) * 0.8);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function MilestoneNode({
  position, index, milestone, active, complete, colors, onSelect,
}: {
  position: THREE.Vector3; index: number; milestone: HoloMilestone; active: boolean; complete: boolean; colors: SceneColors; onSelect: () => void;
}) {
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const target = active ? 1.35 + Math.sin(t * 2.6) * 0.06 : hovered ? 1.15 : 0.9;
    if (core.current) {
      core.current.scale.setScalar(THREE.MathUtils.damp(core.current.scale.x, target, 7, dt));
      core.current.rotation.y += dt * (active ? 1.2 : 0.3);
      core.current.rotation.x += dt * 0.2;
    }
    if (shell.current) {
      shell.current.rotation.y -= dt * 0.4;
      const s = THREE.MathUtils.damp(shell.current.scale.x, active ? 1 : 0.001, 6, dt);
      shell.current.scale.setScalar(s);
    }
    const ringScale = active ? 1 : 0.001;
    for (const [r, speed] of [[ringA, 0.9], [ringB, -0.6]] as const) {
      if (!r.current) continue;
      r.current.rotation.z += dt * speed;
      r.current.scale.setScalar(THREE.MathUtils.damp(r.current.scale.x, ringScale, 5, dt));
    }
    if (beam.current) {
      const m = beam.current.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, active ? 0.22 + Math.sin(t * 3) * 0.05 : 0, 5, dt);
    }
  });

  const lit = active || complete;
  return (
    <group position={position}>
      <mesh
        ref={core}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color={lit ? colors.primary : colors.secondary}
          emissive={lit ? colors.primary : colors.secondary}
          emissiveIntensity={active ? 1.4 : lit ? 0.6 : 0.25}
          metalness={0.6}
          roughness={0.2}
          flatShading
        />
      </mesh>
      <mesh ref={shell} scale={0.001}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshBasicMaterial color={colors.primary} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh ref={ringA} rotation-x={Math.PI / 2} scale={0.001}>
        <torusGeometry args={[0.8, 0.012, 8, 96]} />
        <meshBasicMaterial color={colors.primary} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} rotation-x={Math.PI / 2.6} rotation-y={0.5} scale={0.001}>
        <torusGeometry args={[1.0, 0.008, 8, 96]} />
        <meshBasicMaterial color={colors.secondary} toneMapped={false} />
      </mesh>
      {/* Projection beam down to the base plate */}
      <mesh ref={beam} position-y={-(position.y + 2.2) / 2}>
        <cylinderGeometry args={[0.02, 0.5, position.y + 2.2, 24, 1, true]} />
        <meshBasicMaterial color={colors.primary} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html center position={[0, 0.75, 0]} distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all duration-500"
          style={{
            background: active ? colors.primary : "rgba(20,17,15,0.75)",
            color: "#fdfbf7",
            border: `1px solid ${active ? colors.primary : "rgba(253,251,247,0.2)"}`,
            opacity: active || hovered ? 1 : 0.7,
            transform: `scale(${active ? 1.1 : 1})`,
          }}
        >
          Year {milestone.year}{active ? ` · ${milestone.title.length > 28 ? milestone.title.slice(0, 27) + "…" : milestone.title}` : ""}
          <span className="sr-only">Step {index + 1}</span>
        </div>
      </Html>
    </group>
  );
}

/** Projector base: rotating rings and a scanning disc. */
function ProjectorBase({ colors }: { colors: SceneColors }) {
  const outer = useRef<THREE.Group>(null);
  const scan = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    if (outer.current) outer.current.rotation.z += dt * 0.15;
    if (scan.current) {
      const s = (clock.elapsedTime * 0.35) % 1;
      scan.current.scale.setScalar(0.2 + s * 4.8);
      (scan.current.material as THREE.MeshBasicMaterial).opacity = (1 - s) * 0.5;
    }
  });
  return (
    <group position-y={-2.2} rotation-x={-Math.PI / 2}>
      <mesh>
        <circleGeometry args={[5.2, 96]} />
        <meshStandardMaterial color={colors.stage} metalness={0.7} roughness={0.35} />
      </mesh>
      <group ref={outer}>
        {[2.2, 3.4, 4.8].map((r, i) => (
          <mesh key={r} position-z={0.01}>
            <ringGeometry args={[r, r + (i === 2 ? 0.05 : 0.02), 128, 1, 0, Math.PI * (1.2 + i * 0.3)]} />
            <meshBasicMaterial color={i === 1 ? colors.primary : colors.secondary} transparent opacity={0.6} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={scan} position-z={0.02}>
        <ringGeometry args={[0.95, 1, 96]} />
        <meshBasicMaterial color={colors.primary} transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Flies the camera to the active milestone, then hands control back to the user. */
function CameraRig({ target, enabled }: { target: THREE.Vector3; enabled: boolean }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null };
  const flying = useRef(0);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    flying.current = enabled ? 1.6 : 0;
  }, [target, enabled]);
  useFrame((_, raw) => {
    if (!controls || flying.current <= 0) return;
    const dt = Math.min(raw, 0.05);
    flying.current -= dt;
    controls.target.lerp(target, 1 - Math.exp(-4 * dt));
    const dir = camera.position.clone().sub(controls.target).normalize();
    desired.copy(target).addScaledVector(dir, 8.5);
    desired.y = Math.max(desired.y, target.y + 2.2);
    camera.position.lerp(desired, 1 - Math.exp(-2.5 * dt));
    controls.update();
  });
  return null;
}

function IntroCamera() {
  const { camera } = useThree();
  const t = useRef(0);
  useFrame((_, raw) => {
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + Math.min(raw, 0.05) / 2.2);
    const e = 1 - Math.pow(1 - t.current, 3);
    camera.position.set(Math.sin((1 - e) * 2.4) * (16 - e * 7), 9 - e * 5, Math.cos((1 - e) * 2.4) * (16 - e * 7));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function RoadmapScene({
  milestones, active, onSelect, autoRotate, colors, reduceMotion,
}: {
  milestones: HoloMilestone[]; active: number; onSelect: (i: number) => void; autoRotate: boolean; colors: SceneColors; reduceMotion: boolean;
}) {
  const points = useMemo(() => buildPoints(milestones.length), [milestones.length]);
  const curve = useMemo(
    () => (points.length > 1 ? new THREE.CatmullRomCurve3(points, false, "centripetal") : new THREE.LineCurve3(points[0], points[0].clone().add(new THREE.Vector3(0, 0.01, 0)))),
    [points],
  );
  const progress = milestones.length > 1 ? active / (milestones.length - 1) : 1;

  return (
    <>
      <color attach="background" args={[colors.stage]} />
      <fog attach="fog" args={[colors.stage, 10, 26]} />
      <ambientLight intensity={0.35} />
      <pointLight position={points[active]?.toArray() ?? [0, 0, 0]} intensity={18} distance={6} color={colors.primary} />
      <directionalLight position={[4, 8, 5]} intensity={1.1} />
      <Environment>
        <Lightformer intensity={1.5} position={[0, 5, 2]} scale={[10, 3, 1]} />
        <Lightformer intensity={1} color={colors.primary} position={[-5, 1, -2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer intensity={0.8} color={colors.secondary} position={[5, 0, 1]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
      </Environment>

      <Stars radius={40} depth={20} count={1200} factor={2.5} saturation={0} fade speed={reduceMotion ? 0 : 0.6} />
      <Sparkles count={70} scale={[10, 6, 8]} size={2.2} speed={reduceMotion ? 0 : 0.3} color={colors.secondary} opacity={0.7} />

      <PathTube curve={curve} progress={progress} colors={colors} />
      {!reduceMotion && milestones.length > 1 && <FlowParticles curve={curve} color={colors.primary} />}
      {points.map((p, i) => (
        <MilestoneNode
          key={`${milestones[i].year}-${milestones[i].title}-${i}`}
          position={p}
          index={i}
          milestone={milestones[i]}
          active={i === active}
          complete={i < active}
          colors={colors}
          onSelect={() => onSelect(i)}
        />
      ))}
      <ProjectorBase colors={colors} />

      {!reduceMotion && <IntroCamera />}
      <CameraRig target={points[active] ?? points[0]} enabled={!reduceMotion} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={16}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.9}
        autoRotate={autoRotate}
        autoRotateSpeed={0.8}
      />
    </>
  );
}

export function HologramRoadmap({ milestones, opportunityTitles = {} }: { milestones: HoloMilestone[]; opportunityTitles?: Record<string, string> }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const colors = useSceneColors();
  const count = milestones.length;

  useEffect(() => { setActive(0); setPlaying(false); }, [milestones]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!playing || reduceMotion || count < 2) return;
    const id = window.setInterval(() => setActive((c) => (c + 1) % count), 3800);
    return () => window.clearInterval(id);
  }, [playing, reduceMotion, count]);

  if (count === 0) {
    return <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">No roadmap steps were returned.</div>;
  }

  const milestone = milestones[active] ?? milestones[0];
  const go = (index: number) => { setActive((index + count) % count); setPlaying(false); };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Interactive 3D life path">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Interactive roadmap</p>
          <h3 className="mt-1 text-lg font-semibold">Explore your path in 3D</h3>
          <p className="mt-1 text-sm text-muted-foreground">Drag to rotate, scroll or pinch to zoom, and tap any milestone to fly to it.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => go(active - 1)} aria-label="Previous milestone">Previous</Button>
          <Button size="sm" onClick={() => setPlaying((v) => !v)} aria-pressed={playing}>{playing ? "Pause" : "Play path"}</Button>
          <Button size="sm" variant="outline" onClick={() => go(active + 1)} aria-label="Next milestone">Next</Button>
        </div>
      </div>

      <div
        className="relative h-[380px] sm:h-[520px]"
        style={{ background: colors.stage }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { go(active - 1); e.preventDefault(); }
          if (e.key === "ArrowRight") { go(active + 1); e.preventDefault(); }
          if (e.key === " ") { setPlaying((v) => !v); e.preventDefault(); }
        }}
        tabIndex={0}
        role="application"
        aria-label="3D roadmap. Use left and right arrows to change milestones, space to play."
      >
        <Canvas dpr={[1, 1.75]} camera={{ position: [0, 4, 9], fov: 48 }} gl={{ antialias: true }}>
          <RoadmapScene milestones={milestones} active={active} onSelect={go} autoRotate={playing && !reduceMotion} colors={colors} reduceMotion={reduceMotion} />
        </Canvas>

        {/* Floating detail panel that re-animates on every step */}
        <div key={active} className="pointer-events-none absolute bottom-3 left-3 right-3 animate-fade-in sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-sm">
          <div className="rounded-xl border p-4 backdrop-blur-md" style={{ background: "rgba(20,17,15,0.72)", borderColor: "rgba(224,90,71,0.45)", color: "#fdfbf7" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: colors.primary }}>
              Year {milestone.year}{milestone.school_year ? ` · ${milestone.school_year}` : ""}{milestone.stage ? ` · ${milestone.stage}` : ""} · Step {active + 1} of {count}
            </p>
            <p className="mt-1 text-base font-semibold leading-snug">{milestone.title}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: "rgba(253,251,247,0.15)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((active + 1) / count) * 100}%`, background: colors.primary }} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30 p-4 sm:p-6">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Roadmap milestones">
          {milestones.map((item, index) => (
            <Button
              key={`${item.year}-${item.title}-${index}`}
              size="sm"
              variant={index === active ? "default" : "outline"}
              onClick={() => go(index)}
              className="shrink-0"
              aria-current={index === active ? "step" : undefined}
            >
              Year {item.year}
            </Button>
          ))}
        </div>
        <div key={active} className="grid animate-fade-in gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Year {milestone.year}{milestone.school_year ? ` · ${milestone.school_year}` : ""}{milestone.stage ? ` · ${milestone.stage}` : ""}</p>
            <h4 className="mt-1 text-xl font-semibold sm:text-2xl">{milestone.title}</h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{milestone.description}</p>
            {milestone.why_you && <p className="mt-3 rounded-lg bg-primary/5 p-3 text-sm"><span className="font-medium text-primary">Why this fits you: </span>{milestone.why_you}</p>}
            {(milestone.action_steps?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-foreground">Your action steps</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{milestone.action_steps?.map((a) => <li key={a}>{a}</li>)}</ol>
              </div>
            )}
            {(milestone.targets?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-foreground">Programs and goals to target</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{milestone.targets?.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
            {milestone.checkpoint && <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">You are on track if: </span>{milestone.checkpoint}</p>}
          </div>
          <div className="space-y-3">
            {(milestone.skills?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground">Skills to build</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {milestone.skills?.map((s) => <span key={s} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">{s}</span>)}
                </div>
              </div>
            )}
            {(milestone.resources?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground">Use these resources</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{milestone.resources?.join(" · ")}</p>
              </div>
            )}
            {(milestone.opportunity_ids?.filter((id) => opportunityTitles[id]).length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground">Opportunities for this step</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {milestone.opportunity_ids?.filter((id) => opportunityTitles[id]).map((id) => (
                    <a key={id} href={`/opportunity/${id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{opportunityTitles[id]}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
