/* ── THREE.JS 3D ROTATING SHIELD ENGINE ──────────── */
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 13;

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const blueLight = new THREE.PointLight(0x0088ff, 3.5, 40);
blueLight.position.set(5, 5, 5);
scene.add(blueLight);

const chromeLight = new THREE.PointLight(0xffffff, 2.5, 40);
chromeLight.position.set(-5, -5, -2);
scene.add(chromeLight);

// Group Container
const group = new THREE.Group();
scene.add(group);

// Orbiting Torus Rings
const ringGeo1 = new THREE.TorusGeometry(3.2, 0.035, 16, 100);
const ringMat1 = new THREE.MeshStandardMaterial({
  color: 0x0088ff,
  emissive: 0x0055cc,
  emissiveIntensity: 0.8,
  roughness: 0.2
});
const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
ring1.rotation.x = Math.PI / 3;
group.add(ring1);

const ringGeo2 = new THREE.TorusGeometry(4.0, 0.02, 16, 100);
const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x0088ff, wireframe: true, transparent: true, opacity: 0.35 });
const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
ring2.rotation.y = Math.PI / 4;
group.add(ring2);

// Center 3D 'H' Shield Monolith
const shape = new THREE.Shape();
shape.moveTo(-1.8, 2);
shape.lineTo(-1.0, 2);
shape.lineTo(-1.0, 0.5);
shape.lineTo(1.0, 0.5);
shape.lineTo(1.0, 2);
shape.lineTo(1.8, 2);
shape.lineTo(1.8, -2);
shape.lineTo(1.0, -2);
shape.lineTo(1.0, -0.5);
shape.lineTo(-1.0, -0.5);
shape.lineTo(-1.0, -2);
shape.lineTo(-1.8, -2);
shape.closePath();

const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelSegments: 5, steps: 2, bevelSize: 0.1, bevelThickness: 0.1 };
const coreGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
coreGeo.center();

const chromeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.95 });
const blueMat = new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0044cc, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.5 });

const coreMesh = new THREE.Mesh(coreGeo, [chromeMat, blueMat]);
group.add(coreMesh);

const wireMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, wireframe: true, transparent: true, opacity: 0.35 });
const wireMesh = new THREE.Mesh(coreGeo, wireMat);
group.add(wireMesh);

// Particles
const particleCount = 180;
const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
  positions[i] = (Math.random() - 0.5) * 30;
  positions[i + 1] = (Math.random() - 0.5) * 30;
  positions[i + 2] = (Math.random() - 0.5) * 30;
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({ size: 0.045, color: 0x0088ff, transparent: true, opacity: 0.5 });
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// Interactive Drag-to-Rotate
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let dragVelocity = { x: 0, y: 0 };

window.addEventListener('pointerdown', (e) => {
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const deltaMove = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };
  dragVelocity.x = deltaMove.x * 0.005;
  dragVelocity.y = deltaMove.y * 0.005;
  group.rotation.y += dragVelocity.x;
  group.rotation.x += dragVelocity.y;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointerup', () => isDragging = false);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  if (!isDragging) {
    dragVelocity.x *= 0.95;
    dragVelocity.y *= 0.95;
    group.rotation.y += dragVelocity.x + 0.012; // Continuous 3D rotation
    group.rotation.x += dragVelocity.y;
  }

  ring1.rotation.z = elapsedTime * 0.2;
  ring2.rotation.z = -elapsedTime * 0.15;

  group.position.y = Math.sin(elapsedTime * 0.8) * 0.25;
  particles.rotation.y = elapsedTime * 0.015;

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* GSAP Entrance Timeline */
gsap.timeline({ defaults: { ease: 'power3.out' } })
  .to('#brandHeader', { opacity: 1, y: 0, duration: 1, delay: 0.3 })
  .to('#ctaPanel', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5');