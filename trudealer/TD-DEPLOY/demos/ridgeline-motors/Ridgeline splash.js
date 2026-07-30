/* ── THREE.JS 3D ROTATING ENGINE ─────────────────── */
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 13;

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const orangeLight = new THREE.PointLight(0xff6d00, 3.5, 40);
orangeLight.position.set(5, 5, 5);
scene.add(orangeLight);

const chromeLight = new THREE.PointLight(0xffffff, 2.5, 40);
chromeLight.position.set(-5, -5, -2);
scene.add(chromeLight);

// 3D Emblem Container Group
const group = new THREE.Group();
scene.add(group);

// 1. Orbiting Orange Neon Torus Rings
const ringGeo1 = new THREE.TorusGeometry(3.2, 0.035, 16, 100);
const ringMat1 = new THREE.MeshStandardMaterial({
  color: 0xff6d00,
  emissive: 0xff3d00,
  emissiveIntensity: 0.8,
  roughness: 0.2
});
const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
ring1.rotation.x = Math.PI / 3;
group.add(ring1);

const ringGeo2 = new THREE.TorusGeometry(4.0, 0.02, 16, 100);
const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xff6d00, wireframe: true, transparent: true, opacity: 0.35 });
const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
ring2.rotation.y = Math.PI / 4;
group.add(ring2);

// 2. Center 3D Dual-Material Shield Core (Black Chrome + Lava Orange Glass)
const shape = new THREE.Shape();
shape.moveTo(0, 2);
shape.lineTo(-1.8, 0.5);
shape.lineTo(-1.2, -1.8);
shape.lineTo(0, -2.5);
shape.lineTo(1.2, -1.8);
shape.lineTo(1.8, 0.5);
shape.closePath();

const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelSegments: 5, steps: 2, bevelSize: 0.1, bevelThickness: 0.1 };
const coreGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
coreGeo.center();

// Black Chrome Material (Left Face Accent)
const chromeMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.1,
  metalness: 0.95,
});

// Lava Orange Glass Material (Right Face Accent)
const orangeMat = new THREE.MeshStandardMaterial({
  color: 0xff6d00,
  emissive: 0xff3d00,
  emissiveIntensity: 0.4,
  roughness: 0.15,
  metalness: 0.5,
});

const coreMesh = new THREE.Mesh(coreGeo, [chromeMat, orangeMat]);
group.add(coreMesh);

// Outer Wireframe Overlay
const wireMat = new THREE.MeshBasicMaterial({ color: 0xff6d00, wireframe: true, transparent: true, opacity: 0.35 });
const wireMesh = new THREE.Mesh(coreGeo, wireMat);
group.add(wireMesh);

// 3. Floating Micro Particle Stars
const particleCount = 200;
const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
  positions[i] = (Math.random() - 0.5) * 30;
  positions[i + 1] = (Math.random() - 0.5) * 30;
  positions[i + 2] = (Math.random() - 0.5) * 30;
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({ size: 0.045, color: 0xff6d00, transparent: true, opacity: 0.5 });
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// Interactive Mouse Physics & Pointer Drag
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

// 3D Render & Continuous Rotation Animation Loop
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

  group.position.y = Math.sin(elapsedTime * 0.8) * 0.25; // Floating animation
  particles.rotation.y = elapsedTime * 0.015;

  renderer.render(scene, camera);
}

animate();

// Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ── GSAP ENTRANCE ANIMATIONS ────────────────────── */
gsap.timeline({ defaults: { ease: 'power3.out' } })
  .to('#brandHeader', { opacity: 1, y: 0, duration: 1, delay: 0.3 })
  .to('#ctaPanel', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5');

/* ── CANVAS WEBM VIDEO RECORDING ENGINE ──────────── */
const recordBtn = document.getElementById('recordBtn');
let mediaRecorder;
let recordedChunks = [];

recordBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;

  recordedChunks = [];
  const stream = canvas.captureStream(60); // Record 60 FPS
  
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  } catch (e) {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Ridgeway-Motors-3D-Rotation-Loop.webm';
    a.click();

    recordBtn.classList.remove('recording');
    recordBtn.innerText = '🎥 Record 3D Rotation Video (WebM)';
  };

  mediaRecorder.start();
  recordBtn.classList.add('recording');
  recordBtn.innerText = '🔴 Recording 3D Rotation (6s)...';

  // Record a perfect 6-second rotation loop
  setTimeout(() => {
    mediaRecorder.stop();
  }, 6000);
});