import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';

// ============================================================
//  MEMORIAS DE SANTA MARTA — EL ANCÓN
//  "La reconstrucción 3D no pretende ser fiel:
//   pretende ser la imagen de una memoria que ya llegó distorsionada."
//  — Propuesta, Pedro José Jiménez Martínez
// ============================================================

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

// --- Escena y Grupos ---
const scene = new THREE.Scene();

// --- Audio ---
const listener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();

// Mapeo de archivos de audio por escena
const AUDIO_FILES = {
  ancon:     '/audio/mixkit-sea-waves-with-birds-loop-1185.wav',
  variedades: ['/audio/freesound_community-small-film-projector-26188.mp3', '/audio/freesound_community-people-talking-in-cinema-before-movie-starts-65662.mp3'],
  juegos:    '/audio/freesound_community-quiet-park-6781.mp3',
  rueda:     '/audio/freesound_community-a-gentle-breeze-wind-4-14681.mp3',
  dunlop:    '/audio/freesound_community-quiet-park-6781.mp3',
};

let currentAmbience = null;
let currentAudioSources = [];

function stopAmbience() {
  currentAudioSources.forEach(src => { try { src.stop(); } catch(e) {} });
  currentAudioSources = [];
  if (currentAmbience) {
    try { currentAmbience.context.close(); } catch(e) {}
    currentAmbience = null;
  }
}

function startSceneAmbience(sceneName) {
  stopAmbience();
  console.log('🎵 Cambiando ambiente a:', sceneName);

  // El Hub mantiene sonido procedural (abstracto)
  if (sceneName === 'hub') {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(45, audioCtx.currentTime);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    currentAmbience = { context: audioCtx, osc };
    return;
  }

  // Cargar archivos de audio para los demás espacios
  const files = AUDIO_FILES[sceneName];
  if (!files) return;

  const fileArray = Array.isArray(files) ? files : [files];

  fileArray.forEach((file, idx) => {
    audioLoader.load(file, (buffer) => {
      const sound = new THREE.Audio(listener);
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(idx === 0 ? 0.5 : 0.25);
      sound.play();
      currentAudioSources.push(sound);
    }, undefined, (err) => {
      console.error('Error cargando audio:', file, err);
    });
  });
}

const hubGroup  = new THREE.Group();
const anconGroup = new THREE.Group();
const variedadesGroup = new THREE.Group();
const polvorinGroup = new THREE.Group();
const dunlopGroup = new THREE.Group();
const juegosGroup = new THREE.Group();

// --- Cámara ---
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0, 1.6, 8);
camera.add(listener);

// --- Post-procesamiento ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.9;
bloomPass.strength = 0.15;
bloomPass.radius = 0.1;
composer.addPass(bloomPass);

composer.setSize(window.innerWidth, window.innerHeight);

let carruselPivot;
const aircraftGroupArray = [];
const ruedaGroup = new THREE.Group();
let ruedaWheelPivot;
const ruedaCabinsArray = [];

// Placeholders de Teatro Variedades para prevenir fallos en el ciclo de renderizado
let isMoviePlaying = false;
let projectionBeam = null;
const projectorPointLight = new THREE.PointLight(0xffffff, 0, 10);
const movieCanvas = document.createElement('canvas');
movieCanvas.width = 640; movieCanvas.height = 400;
const movieCtx = movieCanvas.getContext('2d');
const movieTexture = new THREE.CanvasTexture(movieCanvas);
let movieTexNeedsUpdate = true;
const slideImages = [];
const slideUrls = ['/coliseo_mayor.jpg','/11150850_834729173230397_2710019065453318108_n.jpg'];
let slidesLoaded = false;
function loadAllSlides() {
  if (slidesLoaded) return;
  slidesLoaded = true;
  slideUrls.forEach(url => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { movieTexNeedsUpdate = true; };
    img.src = url;
    slideImages.push(img);
  });
}
const subtitles = [
  'EL TEATRO VARIEDADES — CINE COLOMBIA',
  'FAMILIAS TRAÍAN SUS MECEDORAS',
  'ZONA TECHADA CON SILLAS INDIVIDUALES',
  'PATIO AL AIRE LIBRE BAJO LAS ESTRELLAS',
  'EL CINE ERA EL GRAN ESPECTÁCULO POPULAR',
  'MEMORIAS DE UNA CIUDAD QUE YA NO EXISTE'
];
function drawStandbyScreen() {
  movieCtx.fillStyle = '#0d0d1a';
  movieCtx.fillRect(0, 0, 640, 400);
  movieCtx.fillStyle = '#ffdd88';
  movieCtx.font = 'bold 32px monospace';
  movieCtx.textAlign = 'center';
  movieCtx.fillText('TEATRO VARIEDADES', 320, 160);
  movieCtx.fillStyle = '#8866cc';
  movieCtx.font = '18px monospace';
  movieCtx.fillText('PRESIONE INTERRUPTOR', 320, 220);
  movieTexture.needsUpdate = true;
}
function updateMovieScreen(time) {
  const elapsed = time * 0.001;
  const slideDuration = 4;
  const idx = Math.floor(elapsed / slideDuration) % slideImages.length;
  movieCtx.fillStyle = '#0a0a12';
  movieCtx.fillRect(0, 0, 640, 400);
  if (slideImages[idx] && slideImages[idx].complete && slideImages[idx].naturalWidth) {
    const img = slideImages[idx];
    const as = img.width / img.height;
    const ca = 640 / 400;
    let dw, dh, dx, dy;
    if (as > ca) { dw = 640; dh = 640 / as; dx = 0; dy = (400 - dh) / 2; }
    else { dw = 400 * as; dh = 400; dx = (640 - dw) / 2; dy = 0; }
    movieCtx.filter = 'grayscale(100%) brightness(1.1) contrast(1.1)';
    movieCtx.drawImage(img, dx, dy, dw, dh);
    movieCtx.filter = 'none';
  }
  movieCtx.fillStyle = 'rgba(255,255,255,0.04)';
  if (Math.random() < 0.4) {
    for (let i = 0; i < 2; i++) {
      movieCtx.beginPath();
      movieCtx.arc(Math.random() * 640, Math.random() * 400, Math.random() * 2 + 0.5, 0, Math.PI * 2);
      movieCtx.fill();
    }
  }
  if (Math.random() < 0.25) {
    movieCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    movieCtx.lineWidth = 1;
    const lx = Math.random() * 640;
    movieCtx.beginPath();
    movieCtx.moveTo(lx, 0);
    movieCtx.lineTo(lx + (Math.random() - 0.5) * 10, 400);
    movieCtx.stroke();
  }
  const subIdx = idx % subtitles.length;
  movieCtx.fillStyle = 'rgba(0,0,0,0.6)';
  movieCtx.fillRect(0, 340, 640, 50);
  movieCtx.fillStyle = '#ffeecc';
  movieCtx.font = 'bold 16px monospace';
  movieCtx.textAlign = 'center';
  movieCtx.fillText(subtitles[subIdx], 320, 370);
  movieTexture.needsUpdate = true;
}
function toggleMovie() { isMoviePlaying = !isMoviePlaying; loadAllSlides(); }

scene.add(hubGroup);

// --- Controles ---
const controls = new PointerLockControls(camera, document.body);

let currentScene = 'hub';

// ============================================================
//  MATERIALES COMPARTIDOS
// ============================================================
const MAT = {
  magentaWire: new THREE.MeshBasicMaterial({ color: 0xff00cc, wireframe: true, transparent: true, opacity: 0.5 }),
  cyanWire:    new THREE.MeshBasicMaterial({ color: 0x00ffee, wireframe: true, transparent: true, opacity: 0.4 }),
  darkWood:    new THREE.MeshStandardMaterial({ color: 0x3a200e, roughness: 0.9, flatShading: true }),
  silhouette:  new THREE.MeshStandardMaterial({ color: 0x1a0830, roughness: 0.9, flatShading: true }),
  sand:        new THREE.MeshStandardMaterial({ color: 0x9a6a8a, roughness: 1.0 }),
};

// ============================================================
//  HUB — Cuarto oscuro de entrada
// ============================================================
{
  // Niebla del hub
  scene.fog = new THREE.FogExp2(0x04040f, 0.06);

  // Piso de rejilla — grid infinito de memoria
  const grid = new THREE.GridHelper(80, 80, 0x1a003a, 0x0d001a);
  grid.position.y = 0;
  hubGroup.add(grid);

  // Paredes abstractas (cuarto oscuro)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x07051a, roughness: 1, side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 22), wallMat);
  room.position.y = 4;
  hubGroup.add(room);

  // Luz ambiental mínima
  const hubAmb = new THREE.AmbientLight(0x0a0520, 1.5);
  hubGroup.add(hubAmb);

  // Luz de neón magenta puntual
  const hubLight = new THREE.PointLight(0xc0006a, 2.5, 18);
  hubLight.position.set(0, 4, -4);
  hubGroup.add(hubLight);

  // Función para crear portales en el Hub con texto
  function createHubPortal(name, target, x, z, wireColor, coreColor) {
    const pGeo = new THREE.OctahedronGeometry(1.4, 0);
    const pWireMat = new THREE.MeshBasicMaterial({ color: wireColor, wireframe: true });
    const pMesh = new THREE.Mesh(pGeo, pWireMat);
    pMesh.position.set(x, 2.2, z);
    pMesh.userData = { isPortal: true, target: target };

    const cMat = new THREE.MeshBasicMaterial({ color: coreColor });
    const cMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), cMat);
    cMesh.userData = pMesh.userData;
    pMesh.add(cMesh);
    hubGroup.add(pMesh);

    // Etiqueta de texto mediante canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    
    // Fondo oscuro para legibilidad
    ctx.fillStyle = 'rgba(4, 4, 15, 0.85)';
    ctx.fillRect(0, 0, 256, 64);
    
    // Borde de neón
    ctx.strokeStyle = '#' + wireColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    // Texto VT323
    ctx.font = 'bold 36px "VT323", monospace';
    ctx.fillStyle = '#' + wireColor.toString(16).padStart(6, '0');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.toUpperCase(), 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const lGeo = new THREE.PlaneGeometry(2.0, 0.5);
    const lMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const lMesh = new THREE.Mesh(lGeo, lMat);
    lMesh.position.set(x, 0.6, z);
    hubGroup.add(lMesh);

    scene._hubPortals = scene._hubPortals || [];
    scene._hubPortals.push(pMesh);

    scene._hubInteractables = scene._hubInteractables || [];
    scene._hubInteractables.push(pMesh, cMesh);
  }

  // 5 portales en semicírculo
  // Ancón
  createHubPortal('Ancón', 'ancon', -5.63, -3.25, 0x00b4b4, 0xc0006a);
  // Teatro Variedades
  createHubPortal('Variedades', 'variedades', -2.22, -6.11, 0xffaa00, 0xbb00cc);
  // Gimnasio Kid Dunlop
  createHubPortal('Dunlop', 'dunlop', 0, -7.5, 0xff4444, 0x220000);
  // Juegos Polideportivo
  createHubPortal('Juegos', 'juegos', 2.22, -6.11, 0xddee33, 0x228811);
  // La Rueda y el Avión
  createHubPortal('Rueda y Avión', 'rueda', 5.63, -3.25, 0xbbddff, 0x0033cc);
}

// ============================================================
//  EL ANCÓN — Reconstrucción desde la memoria deteriorada
// ============================================================

// --- Iluminación: vivid vaporwave ---
const ambLight = new THREE.AmbientLight(0xff88cc, 1.2);
anconGroup.add(ambLight);

// Sol de atardecer lateral — el sol que nunca termina de caer
const sunLight = new THREE.DirectionalLight(0xff6090, 2.5);
sunLight.position.set(-15, 12, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 80;
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 25;
sunLight.shadow.camera.bottom = -10;
anconGroup.add(sunLight);

// Luz de relleno desde el cielo — violeta suave
const skyFill = new THREE.DirectionalLight(0xaa44ff, 1.0);
skyFill.position.set(10, 15, -5);
anconGroup.add(skyFill);

// --- Cielo nocturno — casi negro con tinte morado profundo ---
const skyGeo = new THREE.SphereGeometry(180, 16, 8);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor:    { value: new THREE.Color(0x2a0060) },  // Púrpura profundo arriba
    midColor:    { value: new THREE.Color(0xcc0055) },  // Magenta en el horizonte
    bottomColor: { value: new THREE.Color(0xff8844) },  // Naranja-coral abajo
  },
  vertexShader: `
    varying vec3 vPos;
    void main() {
      vPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 bottomColor;
    varying vec3 vPos;
    void main() {
      float h = normalize(vPos).y;
      vec3 col = mix(bottomColor, midColor, smoothstep(-0.1, 0.2, h));
      col = mix(col, topColor, smoothstep(0.2, 0.7, h));
      gl_FragColor = vec4(col, 1.0);
    }
  `
});
anconGroup.add(new THREE.Mesh(skyGeo, skyMat));

// --- Agua — negra, casi opaca, con shimmer de neón ---
const waterGeo = new THREE.PlaneGeometry(180, 120, 48, 32);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x1a0a30,
  roughness: 0.04,
  metalness: 0.7,
  transparent: true,
  opacity: 0.88,
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.set(0, -0.05, 50);
waterMesh.receiveShadow = true;
waterMesh.userData = {
  isMemory: true,
  memoryTitle: 'EL BARRIO ANCÓN',
  memoryText: 'Barrio de pescadores ubicado entre el puerto marítimo y las vías férreas del tren bananero. Conformado por tres calles: El Mangle, Tinglado y Taganguilla. Originalmente campamento de obreros jamaicanos que construyeron el ferrocarril y muelles. En la década de 1920, pescadores samarios ocuparon las casas de madera abandonadas. Fue el barrio más tradicional de Santa Marta, por donde llegaba la música de Curazao y Aruba. Sus fiestas de la Virgen del Carmen eran un acontecimiento cultural con procesión de lanchas por el mar. Desapareció en la década de 1970 con la expansión de Puertos de Colombia.',
  memoryImg: '/11150850_834729173230397_2710019065453318108_n.jpg'
};
anconGroup.add(waterMesh);

// Hit area invisible más grande para facilitar el clic en la memoria del Ancón
const hitAreaAncon = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 30),
  new THREE.MeshBasicMaterial({ visible: false })
);
hitAreaAncon.rotation.x = -Math.PI / 2;
hitAreaAncon.position.set(0, 1, 20);
hitAreaAncon.userData = waterMesh.userData;
hitAreaAncon.traverse(child => { if (child.isMesh) child.userData = waterMesh.userData; });
anconGroup.add(hitAreaAncon);

// --- Orilla — arena oscura sin color ---
const shoreGeo = new THREE.PlaneGeometry(70, 18, 40, 10);
// Ondular levemente el suelo
const shoreVerts = shoreGeo.attributes.position;
for (let i = 0; i < shoreVerts.count; i++) {
  shoreVerts.setZ(i, (Math.random() - 0.5) * 0.05);
}
shoreGeo.computeVertexNormals();
const shoreMesh = new THREE.Mesh(shoreGeo, MAT.sand);
shoreMesh.rotation.x = -Math.PI / 2;
shoreMesh.position.set(0, 0, 3);
shoreMesh.receiveShadow = true;
anconGroup.add(shoreMesh);

// ============================================================
//  MONTAÑA — Punta de Betín: silueta al fondo, perfilada en magenta
//  La memoria no recuerda los detalles: solo la silueta
// ============================================================
function buildMountainSilhouette(cx, cz, w, h, depth, col) {
  const pts = [];
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const px = (t - 0.5) * w;
    const py = h
      * Math.pow(Math.sin(Math.PI * t), 0.7)
      * (0.75 + 0.35 * Math.sin(t * Math.PI * 2.8 + 0.5))
      + (Math.random() * h * 0.08);
    pts.push(new THREE.Vector2(px, Math.max(0, py)));
  }
  pts.push(new THREE.Vector2(w * 0.5, 0));
  pts.push(new THREE.Vector2(-w * 0.5, 0));

  const shape = new THREE.Shape(pts);
  const extGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });

  // Base sólida (silueta negra)
  const solidMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true });
  const solid = new THREE.Mesh(extGeo, solidMat);
  solid.castShadow = true;

  // Contorno magenta (línea de horizonte — lo que la memoria sí conserva)
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xc0006a, wireframe: true, transparent: true, opacity: 0.18 });
  const wire = new THREE.Mesh(extGeo, wireMat);
  wire.scale.set(1.002, 1.002, 1.002);

  const g = new THREE.Group();
  g.add(solid);
  g.add(wire);
  g.position.set(cx - w * 0.5, 0, cz);
  anconGroup.add(g);
}

buildMountainSilhouette(28, -22, 40, 20, 14, 0x1a0830);
buildMountainSilhouette(10, -26, 28, 14, 9,  0x250d40);
// Cerros de San Martín (izquierda)
buildMountainSilhouette(-24, -20, 34, 12, 8, 0x1a0830);
// Lomas bajas al centro
buildMountainSilhouette(2, -20, 22, 7, 6, 0x200a38);

// ============================================================
//  CASAS — Fachadas abstractas
//  Sin ventanas completas, sin detalles. La memoria no las recuerda exactas.
// ============================================================
function buildHouse(x, z, w, h, d, rotY = 0) {
  const g = new THREE.Group();

  // Cuerpo
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x3a1a50, roughness: 0.8, flatShading: true })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);

  // Contorno magenta tenue
  const wireBody = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.01, h + 0.01, d + 0.01),
    new THREE.MeshBasicMaterial({ color: 0xc0006a, wireframe: true, transparent: true, opacity: 0.12 })
  );
  wireBody.position.y = h / 2;
  g.add(wireBody);

  // Techo a dos aguas (prisma triangular extruido)
  const roofShape = new THREE.Shape([
    new THREE.Vector2(-w / 2 - 0.3, 0),
    new THREE.Vector2(0, h * 0.45),
    new THREE.Vector2(w / 2 + 0.3, 0),
  ]);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.4, bevelEnabled: false });
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshStandardMaterial({ color: 0x280840, roughness: 0.8, flatShading: true })
  );
  roof.position.set(-0, h, -d / 2 - 0.2);
  roof.castShadow = true;
  g.add(roof);

  // Ventanas — rectángulos oscuros que casi no se distinguen del cuerpo
  const winMat = new THREE.MeshBasicMaterial({ color: 0x000005 });
  [[- w * 0.25, h * 0.55], [w * 0.25, h * 0.55]].forEach(([wx, wy]) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.18, h * 0.22), winMat);
    win.position.set(wx, wy, d / 2 + 0.01);
    g.add(win);
  });

  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  anconGroup.add(g);
}

// Fila de casas — tres calles del Ancón: el Mangle, Tinglado, Taganguilla
buildHouse(-14, -5, 6, 4.5, 5, 0);
buildHouse(-6,  -6, 5, 3.8, 4, 0.05);
buildHouse(2,   -5, 7, 5.0, 6, -0.05);
buildHouse(10,  -4, 5, 4.2, 4.5, 0.08);
buildHouse(17,  -6, 6, 3.6, 5, -0.1);
buildHouse(-20, -4, 8, 5.5, 7, 0.04);

// ============================================================
//  CANOAS — Siluetas varadas en la orilla
//  Geometría simple extruida: la forma sí se recuerda, los colores no
// ============================================================
function buildCanoe(x, z, rotY = 0) {
  const pts = [
    new THREE.Vector2(-1.8, 0),
    new THREE.Vector2(-1.2, 0.28),
    new THREE.Vector2(0, 0.38),
    new THREE.Vector2(1.2, 0.28),
    new THREE.Vector2(1.8, 0),
  ];
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 1 });
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a1040, roughness: 0.8, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.castShadow = true;

  const wireMat = new THREE.MeshBasicMaterial({ color: 0x00b4b4, wireframe: true, transparent: true, opacity: 0.2 });
  const wire = new THREE.Mesh(geo, wireMat);
  wire.rotation.x = -Math.PI / 2;

  const g = new THREE.Group();
  g.add(mesh);
  g.add(wire);
  g.position.set(x, 0.01, z);
  g.rotation.y = rotY;

  anconGroup.add(g);
}

buildCanoe(-9,  5.5, 0.2);
buildCanoe(-5,  6.0, -0.15);
buildCanoe( 3,  5.8, 0.35);
buildCanoe( 9,  5.2, -0.3);
buildCanoe( 14, 6.5, 0.1);


// ============================================================
//  GIMNASIO KID DUNLOP — Coliseo Menor
//  "Jose Dolores Erebrie, el gran pugilista samario"
// ============================================================
const dunlopGroup3 = new THREE.Group();
{
  // --- Iluminación: interior industrial ---
  const dunlopAmb = new THREE.AmbientLight(0xccbbaa, 0.8);
  dunlopGroup3.add(dunlopAmb);

  const dunlopSun = new THREE.DirectionalLight(0xffeedd, 1.2);
  dunlopSun.position.set(5, 10, 8);
  dunlopSun.castShadow = true;
  dunlopSun.shadow.mapSize.set(1024, 1024);
  dunlopGroup3.add(dunlopSun);

  // Luz cálida de foco sobre el ring
  const ringSpot = new THREE.PointLight(0xffcc88, 2.0, 15);
  ringSpot.position.set(0, 6, 0);
  dunlopGroup3.add(ringSpot);

  // Luz tenue roja de las paredes
  const wallGlow = new THREE.PointLight(0xff2200, 0.4, 20);
  wallGlow.position.set(-8, 3, -5);
  dunlopGroup3.add(wallGlow);

  // --- Cielo / Techo ---
  const skyGeo = new THREE.SphereGeometry(80, 12, 8);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x0a0808) },
      bottomColor: { value: new THREE.Color(0x1a1010) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `
  });
  dunlopGroup3.add(new THREE.Mesh(skyGeo, skyMat));

  // --- Piso de madera ---
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85, flatShading: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  dunlopGroup3.add(floor);

  // --- Paredes: patrón blanco/rojo/azul ---
  // Pared trasera (detrás del ring)
  const backWallGroup = new THREE.Group();
  dunlopGroup3.add(backWallGroup);

  const createColoredWall = (width, height, z, color) => {
    const geo = new THREE.BoxGeometry(width, height, 0.3);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
    const wall = new THREE.Mesh(geo, mat);
    wall.position.set(0, height / 2, z);
    wall.receiveShadow = true;
    return wall;
  };

  // Pared trasera z = -12
  backWallGroup.add(createColoredWall(24, 4.5, -12, 0xeeeeee));  // Blanco arriba
  backWallGroup.add(createColoredWall(24, 1.5, -12, 0xcc2222));  // Rojo medio
  backWallGroup.add(createColoredWall(24, 1.5, -12, 0x2244aa));  // Azul abajo
  backWallGroup.children[0].position.y = 6.25;
  backWallGroup.children[1].position.y = 3.5;
  backWallGroup.children[2].position.y = 1.5;

  // Pared lateral izquierda x = -12
  [-12, 12].forEach(xPos => {
    const sideGroup = new THREE.Group();
    dunlopGroup3.add(sideGroup);
    const w1 = createColoredWall(24, 4.5, 0, 0xeeeeee);
    const w2 = createColoredWall(24, 1.5, 0, 0xcc2222);
    const w3 = createColoredWall(24, 1.5, 0, 0x2244aa);
    w1.position.y = 6.25;
    w2.position.y = 3.5;
    w3.position.y = 1.5;
    w1.rotation.y = Math.PI / 2;
    w2.rotation.y = Math.PI / 2;
    w3.rotation.y = Math.PI / 2;
    w1.position.x = xPos;
    w2.position.x = xPos;
    w3.position.x = xPos;
    sideGroup.add(w1, w2, w3);
  });

  // --- Ventanas superiores (celosías) ---
  const ventMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (let x = -10; x <= 10; x += 5) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), ventMat);
    vent.position.set(x, 7.5, -11.8);
    dunlopGroup3.add(vent);
  }

  // --- Techo con vigas metálicas ---
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.7 });
  for (let z = -10; z <= 10; z += 5) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.15, 0.15), beamMat);
    beam.position.set(0, 8.5, z);
    dunlopGroup3.add(beam);
  }
  // Vigas transversales
  for (let x = -10; x <= 10; x += 5) {
    const beamT = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 20), beamMat);
    beamT.position.set(x, 8.5, 0);
    dunlopGroup3.add(beamT);
  }
  // Plancha de techo
  const roofPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, side: THREE.DoubleSide })
  );
  roofPlate.rotation.x = Math.PI / 2;
  roofPlate.position.y = 8.5;
  dunlopGroup3.add(roofPlate);

  // --- RING DE BOXEO ---
  const ringGroup = new THREE.Group();
  ringGroup.position.set(0, 0, 0);
  dunlopGroup3.add(ringGroup);

  // Plataforma de madera del ring
  const ringPlatform = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.5, 7),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8, flatShading: true })
  );
  ringPlatform.position.y = 0.25;
  ringPlatform.receiveShadow = true;
  ringPlatform.castShadow = true;
  ringGroup.add(ringPlatform);

  // Esquinas del ring (4 postes dorados)
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.8, roughness: 0.3 });
  const cornerPositions = [[-3.2, -3.2], [3.2, -3.2], [3.2, 3.2], [-3.2, 3.2]];
  cornerPositions.forEach(([cx, cz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8), cornerMat);
    post.position.set(cx, 2.25, cz);
    post.castShadow = true;
    ringGroup.add(post);
  });

  // Cuerdas del ring (4 niveles, 3 colores: rojo, amarillo, azul)
  const ropeColors = [0xcc2222, 0xddcc22, 0x2244aa, 0xcc2222];
  ropeColors.forEach((color, i) => {
    const ropeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const ropeY = 1.2 + i * 0.7;

    // 4 lados del ring
    [[-3.2, 3.2, -3.2, -3.2], [3.2, 3.2, -3.2, -3.2], [-3.2, 3.2, 3.2, 3.2], [-3.2, 3.2, 3.2, 3.2]].forEach(([x1, x2, z1, z2], side) => {
      const ropeGeo = new THREE.CylinderGeometry(0.025, 0.025, 6.4, 4);
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.rotation.z = Math.PI / 2;
      if (side < 2) {
        rope.position.set(0, ropeY, side === 0 ? -3.2 : 3.2);
      } else {
        rope.rotation.y = Math.PI / 2;
        rope.position.set(side === 2 ? -3.2 : 3.2, ropeY, 0);
      }
      ringGroup.add(rope);
    });
  });

  // --- SACOS DE BOXEO ---
  const sacosGroup = new THREE.Group();
  dunlopGroup3.add(sacosGroup);

  function createSaco(x, y, z, color, scale = 1) {
    const sacoMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
    // Cuerpo del saco (cilindro redondeado)
    const saco = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3 * scale, 0.35 * scale, 1.6 * scale, 10),
      sacoMat
    );
    saco.position.set(x, y, z);
    saco.castShadow = true;
    sacosGroup.add(saco);
    // Cadena de suspensión
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 });
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.5, 4), chainMat);
    chain.position.set(x, y + 1.6 * scale + 1.25, z);
    sacosGroup.add(chain);
    // Gancho
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 8, Math.PI), chainMat);
    hook.position.set(x, y + 1.6 * scale + 2.5, z);
    sacosGroup.add(hook);
    return saco;
  }

  // Sacos pegados al techo (como en las imágenes)
  createSaco(-6, 3.5, -2, 0xcc1111, 1.2);   // Rojo Everlast
  createSaco(-3, 3.2, -4, 0x111111, 1.0);   // Negro
  createSaco(6, 3.5, 1, 0x111111, 1.1);     // Negro grande
  createSaco(8, 3.3, -3, 0x228833, 0.9);    // Verde

  // --- MEMORIA: Ring como nodo interactivo ---
  ringGroup.userData = {
    isMemory: true,
    memoryTitle: 'GIMNASIO KID DUNLOP',
    memoryText: 'El Gimnasio Kid Dunlop, ubicado en el Coliseo Menor de Santa Marta, fue el templo del boxeo samario. Aquí entrenó Jose Dolores Erebrie, "Kid Dunlop", el gran pugilista colombiano que en 1950 se preparó para la pelea del título nacional. Generaciones de boxeadores sudaron en este ring de cuerdas rojas, amarillas y azules.',
    memoryImg: '/dunlop/download (1).png'
  };
  ringGroup.traverse(c => { if (c.isMesh) c.userData = ringGroup.userData; });

  // --- MEMORIA: Memorial Kid Dunlop (foto antigua en la pared) ---
  const loader = new THREE.TextureLoader();
  const dunlopTex = loader.load('/dunlop/kid_dunlop.png');
  const memorialGeo = new THREE.PlaneGeometry(2.5, 3);
  const memorialMat = new THREE.MeshBasicMaterial({ map: dunlopTex });
  const memorial = new THREE.Mesh(memorialGeo, memorialMat);
  memorial.position.set(0, 4, -11.7);
  dunlopGroup3.add(memorial);

  memorial.userData = {
    isMemory: true,
    memoryTitle: 'KID DUNLOP',
    memoryText: 'Jose Dolores Erebrie, conocido como "Kid Dunlop", fue el gran pugilista de Santa Marta. En esta foto de 1950, tomada por el Archivo del Diario El Heraldo, se le ve en su gimnasio de entrenamiento antes de la pelea por el título nacional. Su legado vive en cada boxeador que pasó por el Coliseo Menor.',
    memoryImg: '/dunlop/kid_dunlop.png'
  };

  // --- MEMORIA: Fachada del Coliseo Menor ---
  const facadeTex = loader.load('/dunlop/download.png');
  const facadeGeo = new THREE.PlaneGeometry(6, 4);
  const facadeMat2 = new THREE.MeshBasicMaterial({ map: facadeTex });
  const facadePic = new THREE.Mesh(facadeGeo, facadeMat2);
  facadePic.position.set(-8, 4.5, -11.7);
  dunlopGroup3.add(facadePic);

  facadePic.userData = {
    isMemory: true,
    memoryTitle: 'COLISEO MENOR',
    memoryText: 'El Coliseo Menor, también conocido como Indeportes, fue la sede del Gimnasio Kid Dunlop. Su fachada blanca con franjas rojas y azules era un ícono del deporte samario. Aquí se formaron campeones nacionales de boxeo durante décadas.',
    memoryImg: '/dunlop/download.png'
  };
}

// ============================================================
//  TEATRO VARIEDADES — El cinema de la memoria
// ============================================================
{
  // Iluminación: atardecer cálido del Caribe
  const varAmb = new THREE.AmbientLight(0xff99aa, 1.0);
  variedadesGroup.add(varAmb);

  const varSun = new THREE.DirectionalLight(0xff66aa, 1.8);
  varSun.position.set(10, 15, 10);
  varSun.castShadow = true;
  varSun.shadow.mapSize.set(1024, 1024);
  variedadesGroup.add(varSun);

  // Cielo nocturno vaporwave estrellado
  const varSkyGeo2 = new THREE.SphereGeometry(120, 16, 8);
  const varSkyMat2 = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x0a0520) },
      midColor:    { value: new THREE.Color(0x280540) },
      bottomColor: { value: new THREE.Color(0x400030) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.1, 0.2, h));
        col = mix(col, topColor, smoothstep(0.2, 0.7, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  variedadesGroup.add(new THREE.Mesh(varSkyGeo2, varSkyMat2));

  // Estrellas de neón sobre el patio al aire libre
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 400;
  const starsPos = new Float32Array(starsCount * 3);
  const starsColor = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount; i++) {
    const radius = 100 + Math.random() * 10;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(1 - 2 * Math.random());
    starsPos[i*3]   = radius * Math.sin(phi) * Math.cos(theta);
    starsPos[i*3+1] = Math.abs(radius * Math.sin(phi) * Math.sin(theta));
    starsPos[i*3+2] = radius * Math.cos(phi);
    const c = new THREE.Color();
    const rand = Math.random();
    if (rand < 0.2) c.setHex(0x00ffee);
    else if (rand < 0.4) c.setHex(0xff00cc);
    else c.setHex(0xffffff);
    starsColor[i*3] = c.r; starsColor[i*3+1] = c.g; starsColor[i*3+2] = c.b;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
  starsGeo.setAttribute('color', new THREE.BufferAttribute(starsColor, 3));
  variedadesGroup.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({
    size: 0.8, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true
  })));

  // Piso de cemento rústico
  const varFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 40),
    new THREE.MeshStandardMaterial({ color: 0x22112a, roughness: 0.95 })
  );
  varFloor.rotation.x = -Math.PI / 2;
  varFloor.receiveShadow = true;
  variedadesGroup.add(varFloor);

  // Muros del contorno (laterales)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b0a24, roughness: 0.9, flatShading: true });
  [
    [-10, 4, 3,  0.4, 8, 34],
    [ 10, 4, 3,  0.4, 8, 34]
  ].forEach(([x, y, z, w, h, d]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    wall.receiveShadow = true;
    variedadesGroup.add(wall);
  });

  // Gran muro de proyección frontal con texto "TEATRO VARIEDADES" (reemplaza al muro de fondo)
  const screenWall = new THREE.Mesh(
    new THREE.BoxGeometry(22, 10, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x1b0a24, roughness: 0.9, flatShading: true })
  );
  screenWall.position.set(0, 5, -15.0);
  screenWall.userData = {
    isMemory: true,
    memoryTitle: 'TEATRO VARIEDADES',
    memoryText: 'Teatro Variedades, filial de Cine Colombia. Ubicado entre calles 11 y 12 con carrera cuarta. Dividido en dos partes: la zona techada con abanicos y sillas individuales, y la zona descubierta más cerca del telón, separada por una paredilla con púas. Una función vespertina y dos nocturnas. 1,300 asientos.',
    memoryImg: '/images (9).jpg'
  };
  variedadesGroup.add(screenWall);

  // Hit area invisible más grande para facilitar el clic en la memoria del Teatro
  const hitAreaVariedades = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitAreaVariedades.position.set(0, 5, -14);
  hitAreaVariedades.userData = screenWall.userData;
  hitAreaVariedades.traverse(child => { if (child.isMesh) child.userData = screenWall.userData; });
  variedadesGroup.add(hitAreaVariedades);

  // Franja amarilla superior con nombre del teatro
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 1024; bannerCanvas.height = 128;
  const bCtx = bannerCanvas.getContext('2d');
  bCtx.fillStyle = '#e8d87f';
  bCtx.fillRect(0, 0, 1024, 128);
  bCtx.fillStyle = '#cc0022';
  bCtx.font = 'bold 64px monospace';
  bCtx.textAlign = 'center';
  bCtx.fillText('TEATRO VARIEDADES', 512, 90);
  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(22, 2.5, 0.1),
    new THREE.MeshBasicMaterial({ map: bannerTex })
  );
  banner.position.set(0, 9, -14.65);
  variedadesGroup.add(banner);

  // Pantalla de proyección (canvas dinámico con userData de memoria)
  const screenMat = new THREE.MeshBasicMaterial({ map: movieTexture });
  const screenPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5.5),
    screenMat
  );
  screenPlane.position.set(0, 5, -14.6);
  screenPlane.userData = {
    isMemory: true,
    memoryTitle: 'TEATRO VARIEDADES',
    memoryText: 'Teatro Variedades, filial de Cine Colombia. Ubicado entre calles 11 y 12 con carrera cuarta. Dividido en dos partes: la zona techada con abanicos y sillas individuales, y la zona descubierta más cerca del telón, separada por una paredilla con púas. Una función vespertina y dos nocturnas. 1,300 asientos.',
    memoryImg: '/images (9).jpg'
  };
  drawStandbyScreen();
  variedadesGroup.add(screenPlane);

  // Marco dorado de la pantalla
  const screenFrame = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 6.3, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xddaa33, roughness: 0.4, metalness: 0.5 })
  );
  screenFrame.position.set(0, 5, -14.65);
  variedadesGroup.add(screenFrame);

  // Escenario elevado de concreto
  const stageMesh = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.6, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a1a30, roughness: 0.95, flatShading: true })
  );
  stageMesh.position.set(0, 0.3, -11);
  stageMesh.receiveShadow = true;
  variedadesGroup.add(stageMesh);

  // Muro divisor entre zona delantera (patio) y zona techada (butacas)
  const divWall = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1b0a24, roughness: 0.9, flatShading: true })
  );
  divWall.position.set(0, 0.6, 1);
  variedadesGroup.add(divWall);

  // Púas abstractas sobre el muro divisor
  const puyaMat = new THREE.MeshBasicMaterial({ color: 0x00ffee, transparent: true, opacity: 0.6 });
  const puyaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6);
  for (let x = -10; x <= 10; x += 2.5) {
    const puya = new THREE.Mesh(puyaGeo, puyaMat);
    puya.position.set(x, 1.5, 1);
    variedadesGroup.add(puya);
  }

  // Sillas individuales en filas (zona techada posterior), mirando a la pantalla
  const seatMatMag  = new THREE.MeshStandardMaterial({ color: 0xc0006a, roughness: 0.8 });
  const seatMatCyan = new THREE.MeshStandardMaterial({ color: 0x00b4b4, roughness: 0.8 });
  const legMat3 = new THREE.MeshStandardMaterial({ color: 0x110022 });

  const rowsZ = [2, 5, 8, 11];
  const colsX = [-8, -6, -4, -2.5, 2.5, 4, 6, 8];
  rowsZ.forEach((z, rIdx) => {
    colsX.forEach((x, cIdx) => {
      const g = new THREE.Group();
      const mat = ((rIdx + cIdx) % 2 === 0) ? seatMatMag : seatMatCyan;

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat);
      seat.position.y = 0.4;
      g.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), mat);
      back.position.set(0, 0.9, 0.2);
      g.add(back);

      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), legMat3);
        leg.position.set((i%2===0?0.2:-0.2), 0.2, (i<2?0.2:-0.2));
        g.add(leg);
      }
      g.position.set(x, 0, z);
      variedadesGroup.add(g);
    });
  });

  // Estructura del techo zona techada (posterior)
  const roofStructure = new THREE.Group();
  const beamMat2 = new THREE.MeshStandardMaterial({ color: 0x4d0099, roughness: 0.5, metalness: 0.8 });

  for (let z = 13; z <= 19; z += 6) {
    const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.0), beamMat2);
    colL.position.set(-9.6, 2.5, z);
    roofStructure.add(colL);
    const colR = colL.clone(); colR.position.x = 9.6;
    roofStructure.add(colR);
  }

  const roofCover = new THREE.Mesh(
    new THREE.PlaneGeometry(21, 6),
    new THREE.MeshBasicMaterial({ color: 0x00ffee, wireframe: true, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  );
  roofCover.rotation.x = -Math.PI / 2;
  roofCover.position.set(0, 5, 16);
  roofStructure.add(roofCover);

  for (let z = 13; z <= 19; z += 6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20.2, 0.15, 0.15), beamMat2);
    beam.position.set(0, 5, z);
    roofStructure.add(beam);
  }

  // Viga central longitudinal para los ventiladores
  const centralBeam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 6), beamMat2);
  centralBeam.position.set(0, 5, 16);
  roofStructure.add(centralBeam);

  variedadesGroup.add(roofStructure);

  // Lámparas de pared (8 total, 4 por lado)
  const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const wallLampData = [];
  [-1, 1].forEach(side => {
    [ -10, -2, 6, 14 ].forEach(lz => {
      const lg = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), lampBaseMat);
      base.position.set(0, -0.1, 0);
      lg.add(base);
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xff8800, emissiveIntensity: 1.2 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulbMat);
      bulb.position.set(0, 0.1, 0);
      lg.add(bulb);
      const pl = new THREE.PointLight(0xffaa55, 1.5, 6);
      pl.position.set(0, 0.1, 0);
      lg.add(pl);
      lg.position.set(side * 9.75, 4.5, lz);
      variedadesGroup.add(lg);
      wallLampData.push({ group: lg, bulb, light: pl, on: true, mat: bulbMat });
    });
  });
  variedadesGroup.wallLamps = wallLampData;

  // Cabina de proyección trasera (empotrada en la pared de fondo)
  const booth = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 3),
    new THREE.MeshStandardMaterial({ color: 0x2a1535, roughness: 0.9, flatShading: true })
  );
  booth.position.set(0, 4.5, 21.0);
  variedadesGroup.add(booth);
  // Ventana de proyección
  const boothWin = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x111122 })
  );
  boothWin.position.set(0, 5, 19.75);
  variedadesGroup.add(boothWin);

  // Haz de luz del proyector (punta estrecha en la ventana del proyector, base ancha en la pantalla)
  if (!projectionBeam) {
    const beamConeGeo = new THREE.ConeGeometry(4.0, 35, 16, 1, true);
    beamConeGeo.rotateX(Math.PI / 2); // Rotar 90 grados para que la punta apunte en dirección -Z
    beamConeGeo.translate(0, 0, -17.5); // Desplazar para situar el origen (0,0,0) en la punta del cono
    projectionBeam = new THREE.Mesh(beamConeGeo, new THREE.MeshBasicMaterial({
      color: 0xccddff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    }));
  }
  projectionBeam.position.set(0, 5, 19.75);
  variedadesGroup.add(projectionBeam);
  // Luz puntual del proyector
  projectorPointLight.position.set(0, 5, 19.75);
  variedadesGroup.add(projectorPointLight);

  // Pared trasera (entrada) a z=20 para tapar el hueco de los laterales
  const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1b0a24, roughness: 0.9, flatShading: true });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 0.4), backWallMat);
  backWall.position.set(0, 4, 20.0);
  backWall.receiveShadow = true;
  variedadesGroup.add(backWall);

  // Partículas de polvo flotante (motes de polvo que brillan en el haz de luz del proyector)
  const vpCount = 80;
  const vpGeo = new THREE.BufferGeometry();
  const vpPos = new Float32Array(vpCount * 3);
  for (let i = 0; i < vpCount; i++) {
    vpPos[i*3]   = (Math.random() - 0.5) * 16;
    vpPos[i*3+1] = Math.random() * 7 + 0.5;
    vpPos[i*3+2] = Math.random() * 34 - 14.5; // Distribuido a lo largo del haz de luz
  }
  vpGeo.setAttribute('position', new THREE.BufferAttribute(vpPos, 3));
  const vpParticles = new THREE.Points(vpGeo, new THREE.PointsMaterial({
    color: 0xffeedd, // Blanco cálido reflectante
    size: 0.15,      // Tamaño visible de motes de polvo
    transparent: true,
    opacity: 0,      // Apagados/invisibles al inicio
    sizeAttenuation: true
  }));
  variedadesGroup.add(vpParticles);
  variedadesGroup._particles = vpParticles;
  variedadesGroup._particlePositions = vpPos;

  // Interruptor de película (pared izquierda cerca de la entrada)
  const switchGroup = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
  const switchBox = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.08), boxMat);
  switchGroup.add(switchBox);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), ledMat);
  led.position.set(0, 0.1, 0.05);
  switchGroup.add(led);
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.15, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xcccccc })
  );
  lever.position.set(0, -0.02, 0.05);
  switchGroup.add(lever);
  switchGroup.position.set(-9.75, 1.6, 15);
  switchGroup.rotation.y = Math.PI / 2; // Apunta hacia el centro del teatro (+X)
  switchGroup.userData = { isSwitch: true };
  switchGroup.traverse(c => { if (c.isMesh) c.userData = switchGroup.userData; });
  variedadesGroup.add(switchGroup);
  variedadesGroup.switchLED = led;
  variedadesGroup.switchLever = lever;
}

// ============================================================
//  EL POLVORÍN — La estación de tren que ya no existe
// ============================================================
{
  // Iluminación: luz de estación de noche, verdosa-industrial
  const polAmb = new THREE.AmbientLight(0x0a1a10, 1.0);
  polvorinGroup.add(polAmb);

  const polMain = new THREE.DirectionalLight(0x88ffcc, 1.5);
  polMain.position.set(5, 12, 8);
  polMain.castShadow = true;
  polMain.shadow.mapSize.set(1024, 1024);
  polMain.shadow.camera.left = -25;
  polMain.shadow.camera.right = 25;
  polMain.shadow.camera.top = 20;
  polMain.shadow.camera.bottom = -10;
  polvorinGroup.add(polMain);

  const polFill = new THREE.PointLight(0x00ff88, 0.8, 30);
  polFill.position.set(-8, 4, 0);
  polvorinGroup.add(polFill);

  // Cielo — noche industrial con tinte verde
  const polSkyGeo = new THREE.SphereGeometry(150, 12, 8);
  const polSkyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x020d08) },
      bottomColor: { value: new THREE.Color(0x0e241b) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `
  });
  polvorinGroup.add(new THREE.Mesh(polSkyGeo, polSkyMat));

  // Suelo de adoquines / concreto de la estación
  const polFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x1a2a1e, roughness: 1.0 })
  );
  polFloor.rotation.x = -Math.PI / 2;
  polFloor.receiveShadow = true;
  polvorinGroup.add(polFloor);

  // Rieles del tren (dos filas)
  const railMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.9 });
  [-0.71, 0.71].forEach(rx => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 40), railMat);
    rail.position.set(rx, 0.06, 0);
    polvorinGroup.add(rail);
  });

  // Durmientes (traviesas) del tren
  const tiesMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 1.0 });
  for (let i = -10; i <= 10; i++) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.22), tiesMat);
    tie.position.set(0, 0.05, i * 1.2);
    polvorinGroup.add(tie);
  }

  // Edificio de la estación (El Polvorín)
  const buildMat = new THREE.MeshStandardMaterial({ color: 0x1e3028, roughness: 0.8, flatShading: true });
  const polStation = new THREE.Group();
  polvorinGroup.add(polStation);

  // Cuerpo principal
  const stationBody = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 6), buildMat);
  stationBody.position.set(0, 2.5, -9);
  stationBody.castShadow = true;
  polStation.add(stationBody);

  // Techo a dos aguas
  const roofShape2 = new THREE.Shape([
    new THREE.Vector2(-8.5, 0),
    new THREE.Vector2(0, 2.5),
    new THREE.Vector2(8.5, 0),
  ]);
  const roofGeo2 = new THREE.ExtrudeGeometry(roofShape2, { depth: 6.4, bevelEnabled: false });
  const stationRoof = new THREE.Mesh(roofGeo2, new THREE.MeshStandardMaterial({ color: 0x0e1e14, roughness: 0.9, flatShading: true }));
  stationRoof.position.set(-8.5, 5, -12.2);
  stationRoof.castShadow = true;
  polStation.add(stationRoof);

  // Arcadas de la fachada
  const arcMat = new THREE.MeshStandardMaterial({ color: 0x2a4535, roughness: 0.7, flatShading: true });
  [-5, 0, 5].forEach(ax => {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.5, 0.3), arcMat);
    arch.position.set(ax, 1.75, -6.05);
    polStation.add(arch);
    // Hueco de puerta
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.0, 0.35), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    door.position.set(ax, 1.5, -6.05);
    polStation.add(door);
  });

  // Chimenea
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, flatShading: true })
  );
  chimney.position.set(5, 9, -9);
  chimney.castShadow = true;
  polvorinGroup.add(chimney);

  polStation.userData = {
    isMemory: true,
    memoryTitle: 'EL POLVORÍN — ESTACIÓN DE TREN',
    memoryText: 'El Polvorín fue la primera estación del ferrocarril de Santa Marta, inaugurado en 1887. Fue el primer ferrocarril de Colombia. Sus instalaciones, incluyendo bodegas y talleres, constituyeron el motor económico de la ciudad durante décadas antes de que el tren dejara de operar.',
    memoryImg: null
  };
  polStation.traverse(c => { if (c.isMesh) c.userData = polStation.userData; });

  // Lámparas de la estación (postes con luz cálida)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x445544, roughness: 0.6 });
  [-6, 6].forEach(lx => {
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), lampMat);
    lampPost.position.set(lx, 2.5, 2);
    lampPost.castShadow = true;
    polvorinGroup.add(lampPost);

    const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xddffcc }));
    lampHead.position.set(lx, 5.2, 2);
    polvorinGroup.add(lampHead);

    const lampLight = new THREE.PointLight(0x88ffaa, 1.2, 8);
    lampLight.position.set(lx, 5.2, 2);
    polvorinGroup.add(lampLight);
  });

  // Partículas de vapor/humo de tren
  const ppCount = 100;
  const ppGeo = new THREE.BufferGeometry();
  const ppPos = new Float32Array(ppCount * 3);
  for (let i = 0; i < ppCount; i++) {
    ppPos[i*3]   = (Math.random() - 0.5) * 30;
    ppPos[i*3+1] = Math.random() * 6 + 0.5;
    ppPos[i*3+2] = (Math.random() - 0.5) * 30;
  }
  ppGeo.setAttribute('position', new THREE.BufferAttribute(ppPos, 3));
  const ppMat = new THREE.PointsMaterial({ color: 0x00ff88, size: 0.07, transparent: true, opacity: 0.45 });
  const ppParticles = new THREE.Points(ppGeo, ppMat);
  polvorinGroup.add(ppParticles);
  polvorinGroup._particles = ppParticles;
  polvorinGroup._particlePositions = ppPos;
}

//  JUEGOS DEL POLIDEPORTIVO — El Carrusel de Aviones
// ============================================================
{
  // --- Iluminación: atardecer retro cálido ---
  const juegosAmb = new THREE.AmbientLight(0x5a3a60, 1.4); // Luz de ambiente morada
  juegosGroup.add(juegosAmb);

  // Sol poniente naranja-amarillo intenso
  const juegosSun = new THREE.DirectionalLight(0xff7a33, 2.5);
  juegosSun.position.set(-20, 15, 10);
  juegosSun.castShadow = true;
  juegosSun.shadow.mapSize.set(1024, 1024);
  juegosSun.shadow.camera.left = -20;
  juegosSun.shadow.camera.right = 20;
  juegosSun.shadow.camera.top = 20;
  juegosSun.shadow.camera.bottom = -10;
  juegosGroup.add(juegosSun);

  // Cielo degradado de atardecer
  const juegosSkyGeo = new THREE.SphereGeometry(150, 16, 8);
  const juegosSkyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x1b003a) }, // Morado profundo arriba
      midColor:    { value: new THREE.Color(0x8a2060) }, // Magenta en el horizonte
      bottomColor: { value: new THREE.Color(0xffaa44) }, // Naranja-dorado abajo
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.1, 0.25, h));
        col = mix(col, topColor, smoothstep(0.25, 0.75, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  juegosGroup.add(new THREE.Mesh(juegosSkyGeo, juegosSkyMat));

  // Suelo de arena del parque infantil
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x9a8570, roughness: 1.0 });
  const juegosGround = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), sandMat);
  juegosGround.rotation.x = -Math.PI / 2;
  juegosGround.receiveShadow = true;
  juegosGroup.add(juegosGround);

  // Bordillo de concreto circular alrededor del juego
  const curbGeo = new THREE.RingGeometry(8.5, 9.0, 32);
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.9, flatShading: true });
  const curb = new THREE.Mesh(curbGeo, concreteMat);
  curb.rotation.x = -Math.PI / 2;
  curb.position.y = 0.01;
  curb.receiveShadow = true;
  juegosGroup.add(curb);

  // Cerca circular metálica alrededor del carrusel (radio 9.2)
  const fenceRadius = 9.2;
  const fenceHeight = 2.0;
  const numPosts = 16;
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, fenceHeight, 6);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5, metalness: 0.8 });

  for (let i = 0; i < numPosts; i++) {
    const angle = (i / numPosts) * Math.PI * 2;
    const x = Math.cos(angle) * fenceRadius;
    const z = Math.sin(angle) * fenceRadius;
    const post = new THREE.Mesh(postGeo, metalMat);
    post.position.set(x, fenceHeight / 2, z);
    post.castShadow = true;
    juegosGroup.add(post);
  }

  // Malla metálica traslúcida (cuadrícula hecha con wireframe)
  const meshCylGeo = new THREE.CylinderGeometry(fenceRadius, fenceRadius, fenceHeight - 0.1, 32, 8, true);
  const meshCylMat = new THREE.MeshBasicMaterial({
    color: 0x8899aa,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide
  });
  const meshCyl = new THREE.Mesh(meshCylGeo, meshCylMat);
  meshCyl.position.y = fenceHeight / 2;
  juegosGroup.add(meshCyl);

  // Pasamanos superior de la cerca (anillo)
  const handrailGeo = new THREE.TorusGeometry(fenceRadius, 0.04, 6, 48);
  const handrail = new THREE.Mesh(handrailGeo, metalMat);
  handrail.rotation.x = Math.PI / 2;
  handrail.position.y = fenceHeight;
  juegosGroup.add(handrail);

  // --- Carrusel de Aviones ---
  carruselPivot = new THREE.Group();
  carruselPivot.position.set(0, 0, 0);
  juegosGroup.add(carruselPivot);

  // 1. Eje Central (Mástil)
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.28, 4.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.9 })
  );
  mast.position.y = 2.4;
  mast.castShadow = true;
  juegosGroup.add(mast);

  // Engranajes/Cuerpo mecánico en la base
  const gearBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.9, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.8, metalness: 0.7, flatShading: true })
  );
  gearBase.position.y = 0.4;
  gearBase.castShadow = true;
  juegosGroup.add(gearBase);

  // 2. Cabina superior (Domo) que gira
  const domeGroup = new THREE.Group();
  domeGroup.position.set(0, 4.4, 0);
  carruselPivot.add(domeGroup);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 1.2, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0e5db, roughness: 0.6, flatShading: true })
  );
  cap.position.y = 0.35;
  cap.castShadow = true;
  domeGroup.add(cap);

  const domeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x2d3238, roughness: 0.7 })
  );
  domeBase.position.y = 0.0;
  domeBase.castShadow = true;
  domeGroup.add(domeBase);

  // 3. Brazos Metálicos Truss
  const armGroup = new THREE.Group();
  carruselPivot.add(armGroup);

  const numArms = 6;
  const armLength = 6.8;
  const armMat = new THREE.MeshStandardMaterial({ color: 0xeeb422, roughness: 0.4, metalness: 0.4, flatShading: true }); // Amarillo brillante

  // Colores para los 6 aviones
  const planeColors = [
    0x103d8b, // 0: Azul marino (con amarillo en cabina)
    0x942921, // 1: Rojo ladrillo
    0xeaeaea, // 2: Blanco/crema
    0x145c32, // 3: Verde oscuro (con alas amarillas)
    0xe35e14, // 4: Naranja
    0x2570b2, // 5: Azul claro
  ];

  const cabinSupportGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4);

  for (let i = 0; i < numArms; i++) {
    const angle = (i / numArms) * Math.PI * 2;
    const pivotArm = new THREE.Group();
    pivotArm.rotation.y = angle;
    armGroup.add(pivotArm);

    // Brazos principales convergentes (truss)
    const arm1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, armLength, 6),
      armMat
    );
    arm1.rotation.x = Math.PI * 0.38; // Inclinado hacia abajo
    arm1.position.set(0.12, 2.5, -armLength * 0.35);
    arm1.castShadow = true;
    pivotArm.add(arm1);

    const arm2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, armLength, 6),
      armMat
    );
    arm2.rotation.x = Math.PI * 0.38;
    arm2.position.set(-0.12, 2.5, -armLength * 0.35);
    arm2.castShadow = true;
    pivotArm.add(arm2);

    // Cable tensor superior
    const cableGeo = new THREE.CylinderGeometry(0.01, 0.01, armLength - 1.0, 4);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.rotation.x = Math.PI * 0.42;
    cable.position.set(0, 3.2, -armLength * 0.3);
    pivotArm.add(cable);

    // 4. Los Aviones
    const planePivot = new THREE.Group();
    planePivot.position.set(0, 0.7, -6.1);
    pivotArm.add(planePivot);
    
    aircraftGroupArray.push(planePivot);

    // Crear el Avión 3D
    const planeColor = planeColors[i];
    const pMat = new THREE.MeshStandardMaterial({ color: planeColor, roughness: 0.25, metalness: 0.15 });

    // Fuselaje
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.55, 1.8);
    const fuselage = new THREE.Mesh(bodyGeo, pMat);
    fuselage.castShadow = true;
    planePivot.add(fuselage);

    // Nariz
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0a500, roughness: 0.3 })
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, 1.15);
    planePivot.add(nose);

    // Alas
    const wingGeo = new THREE.BoxGeometry(2.1, 0.05, 0.45);
    const wings = new THREE.Mesh(wingGeo, pMat);
    wings.position.set(0, -0.05, 0.15);
    wings.castShadow = true;
    planePivot.add(wings);

    // Timón vertical
    const tailVerticalGeo = new THREE.BoxGeometry(0.05, 0.5, 0.35);
    const tailVertical = new THREE.Mesh(tailVerticalGeo, pMat);
    tailVertical.position.set(0, 0.45, -0.7);
    tailVertical.castShadow = true;
    planePivot.add(tailVertical);

    // Alas horizontales traseras
    const tailHorizontalGeo = new THREE.BoxGeometry(0.75, 0.04, 0.25);
    const tailHorizontal = new THREE.Mesh(tailHorizontalGeo, pMat);
    tailHorizontal.position.set(0, 0.2, -0.7);
    tailHorizontal.castShadow = true;
    planePivot.add(tailHorizontal);

    // Detalles específicos
    if (i === 0) { // Azul y amarillo
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.2, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.3 })
      );
      canopy.position.set(0, 0.35, -0.1);
      planePivot.add(canopy);
    } else if (i === 3) { // Verde y alas amarillas
      wings.material = new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.3 });
    } else {
      const windshield = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.35),
        new THREE.MeshBasicMaterial({ color: 0x111122, side: THREE.DoubleSide })
      );
      windshield.position.set(0, 0.32, 0.4);
      windshield.rotation.x = -Math.PI / 4;
      planePivot.add(windshield);
    }

    // Soporte de suspensión del avión
    const cs1 = new THREE.Mesh(cabinSupportGeo, armMat);
    cs1.position.set(0.2, 0.25, 0.3);
    planePivot.add(cs1);
    const cs2 = new THREE.Mesh(cabinSupportGeo, armMat);
    cs2.position.set(-0.2, 0.25, 0.3);
    planePivot.add(cs2);
    const cs3 = new THREE.Mesh(cabinSupportGeo, armMat);
    cs3.position.set(0.2, 0.25, -0.3);
    planePivot.add(cs3);
    const cs4 = new THREE.Mesh(cabinSupportGeo, armMat);
    cs4.position.set(-0.2, 0.25, -0.3);
    planePivot.add(cs4);

    // Metadatos de memoria
    planePivot.userData = {
      isMemory: true,
      memoryTitle: 'LOS AVIONES DEL POLIDEPORTIVO',
      memoryText: 'Una de las atracciones más recordadas del antiguo parque infantil del Polideportivo. Estos aviones de fibra de vidrio de colores vibrantes suspendidos por brazos metálicos giraban y hacían soñar a los niños samarios con volar sobre la bahía. Un fragmento de felicidad de la infancia de las décadas de 1970 y 1980.',
      memoryImg: '/juegos_aviones1.png'
    };
    planePivot.traverse(child => {
      if (child.isMesh) child.userData = planePivot.userData;
    });
  }

  // --- Banco de Madera del Parque (Interactivo) ---
  const benchGroup = new THREE.Group();
  benchGroup.position.set(-3.5, 0, 6.0);
  benchGroup.rotation.y = Math.PI * 0.15;
  juegosGroup.add(benchGroup);

  const ironMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.8, metalness: 0.7 });
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.8), ironMat);
  leg1.position.set(-0.9, 0.35, 0);
  leg1.castShadow = true;
  benchGroup.add(leg1);

  const leg2 = leg1.clone();
  leg2.position.set(0.9, 0.35, 0);
  benchGroup.add(leg2);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a431d, roughness: 0.9, flatShading: true });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.65), woodMat);
  seat.position.set(0, 0.68, 0);
  seat.castShadow = true;
  benchGroup.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.05), woodMat);
  backrest.position.set(0, 1.1, -0.3);
  backrest.rotation.x = -Math.PI * 0.05;
  backrest.castShadow = true;
  benchGroup.add(backrest);

  const backLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), ironMat);
  backLeg1.position.set(-0.8, 0.9, -0.3);
  benchGroup.add(backLeg1);
  const backLeg2 = backLeg1.clone();
  backLeg2.position.set(0.8, 0.9, -0.3);
  benchGroup.add(backLeg2);

  benchGroup.userData = {
    isMemory: true,
    memoryTitle: 'EL PARQUE DEL POLIDEPORTIVO',
    memoryText: 'El parque infantil del Polideportivo de Santa Marta fue el epicentro de la recreación familiar durante décadas. Rodeado de árboles de mango y arena, albergaba columpios, resbaladeros de metal y este icónico carrusel de aviones. Aunque hoy la modernización ha cambiado el espacio, los recuerdos de las tardes de domingo permanecen intactos.',
    memoryImg: '/juegos_aviones2.png'
  };
  benchGroup.traverse(child => {
    if (child.isMesh) child.userData = benchGroup.userData;
  });

  // --- Vegetación e Entorno (Árboles de Mango) ---
  function buildPlaygroundTree(x, z, scale = 1.0) {
    const tg = new THREE.Group();
    const tm = new THREE.MeshStandardMaterial({ color: 0x3d2a17, roughness: 0.95 });
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.22 * scale, 5.0 * scale, 7), tm);
    tr.position.y = 2.5 * scale;
    tr.castShadow = true;
    tg.add(tr);

    const lm = new THREE.MeshStandardMaterial({ color: 0x225c28, roughness: 0.8, flatShading: true });
    [1.1, 0.8, 0.5].forEach((r, li) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry((r + 0.5) * scale, 8, 6), lm);
      c.position.y = (4.5 - li * 0.7) * scale;
      c.castShadow = true;
      tg.add(c);
    });
    tg.position.set(x, 0, z);
    juegosGroup.add(tg);
  }

  buildPlaygroundTree(-7, -7, 1.2);
  buildPlaygroundTree(8, -6, 1.1);
  buildPlaygroundTree(-9, 5, 0.95);
  buildPlaygroundTree(9, 6, 1.05);

  // Siluetas abstractas (Columpio)
  const swingGroup = new THREE.Group();
  swingGroup.position.set(5.5, 0, -5.0);
  swingGroup.rotation.y = -Math.PI / 6;
  juegosGroup.add(swingGroup);

  const structureMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
  const postLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), structureMat);
  postLeft.rotation.z = Math.PI * 0.08;
  postLeft.position.set(-1.2, 1.25, 0);
  swingGroup.add(postLeft);

  const postRight = postLeft.clone();
  postRight.rotation.z = -Math.PI * 0.08;
  postRight.position.set(1.2, 1.25, 0);
  swingGroup.add(postRight);

  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), structureMat);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(0, 2.45, 0);
  swingGroup.add(topBar);

  // --- Partículas de polvo flotando ---
  {
    const pCount = 120;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i*3]   = (Math.random()-0.5)*24;
      pPos[i*3+1] = Math.random()*5;
      pPos[i*3+2] = (Math.random()-0.5)*24;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xffcc88, size: 0.04, transparent: true, opacity: 0.5, sizeAttenuation: true });
    const particles = new THREE.Points(pGeo, pMat);
    juegosGroup.add(particles);
    juegosGroup._particles = particles;
    juegosGroup._particlePositions = pPos;
  }
}

// ============================================================
//  RUEDA DE LA FORTUNA Y EL AVIÓN COMERCIAL
// ============================================================
{
  // --- Iluminación: Sol brillante caribeño ---
  const ruedaAmb = new THREE.AmbientLight(0xddeeff, 1.3); // Luz de cielo azulada
  ruedaGroup.add(ruedaAmb);

  const ruedaSun = new THREE.DirectionalLight(0xfffae0, 2.8);
  ruedaSun.position.set(15, 25, 8);
  ruedaSun.castShadow = true;
  ruedaSun.shadow.mapSize.set(1024, 1024);
  ruedaSun.shadow.camera.left = -22;
  ruedaSun.shadow.camera.right = 22;
  ruedaSun.shadow.camera.top = 22;
  ruedaSun.shadow.camera.bottom = -10;
  ruedaGroup.add(ruedaSun);

  // Cielo diurno azul brillante
  const ruedaSkyGeo = new THREE.SphereGeometry(150, 16, 8);
  const ruedaSkyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x0077dd) },
      midColor:    { value: new THREE.Color(0x3ea8ff) },
      bottomColor: { value: new THREE.Color(0xdceeff) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.1, 0.3, h));
        col = mix(col, topColor, smoothstep(0.3, 0.8, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  ruedaGroup.add(new THREE.Mesh(ruedaSkyGeo, ruedaSkyMat));

  // Suelo de césped
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5a7d4a, roughness: 1.0 });
  const ruedaGround = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), grassMat);
  ruedaGround.rotation.x = -Math.PI / 2;
  ruedaGround.receiveShadow = true;
  ruedaGroup.add(ruedaGround);

  // Caminos de tierra
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x908270, roughness: 0.95 });
  const path1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 40), pathMat);
  path1.rotation.x = -Math.PI / 2;
  path1.position.set(0, 0.01, 10);
  path1.receiveShadow = true;
  ruedaGroup.add(path1);

  // --- Cerca Perimetral Verde y Portón Abierto ---
  const fenceZ = 12.0;
  const fenceHeight = 2.2;
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x1c4d2d, roughness: 0.7, flatShading: true }); // Verde oscuro

  // Postes de la cerca frontal
  for (let x = -20; x <= 20; x += 4) {
    if (Math.abs(x) < 3.0) continue; // Hueco para el portón en x = 0
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, fenceHeight, 6), greenMat);
    post.position.set(x, fenceHeight / 2, fenceZ);
    post.castShadow = true;
    ruedaGroup.add(post);
  }

  // Malla metálica frontal (wireframe verde)
  const fenceMeshGeo = new THREE.PlaneGeometry(16, fenceHeight - 0.2);
  const fenceMeshMat = new THREE.MeshBasicMaterial({ color: 0x225c38, wireframe: true, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const meshL = new THREE.Mesh(fenceMeshGeo, fenceMeshMat);
  meshL.position.set(-11, fenceHeight / 2, fenceZ);
  ruedaGroup.add(meshL);

  const meshR = new THREE.Mesh(fenceMeshGeo, fenceMeshMat);
  meshR.position.set(11, fenceHeight / 2, fenceZ);
  ruedaGroup.add(meshR);

  // Portones batientes verdes (abiertos hacia adentro)
  const gateGroupL = new THREE.Group();
  gateGroupL.position.set(-2.0, 0, fenceZ);
  gateGroupL.rotation.y = Math.PI * 0.45; // Abierto hacia adentro
  ruedaGroup.add(gateGroupL);

  const gateFrameL = new THREE.Mesh(new THREE.BoxGeometry(2.0, fenceHeight, 0.05), new THREE.MeshStandardMaterial({ color: 0x1c4d2d, wireframe: true }));
  gateFrameL.position.set(1.0, fenceHeight / 2, 0);
  gateGroupL.add(gateFrameL);

  const gateMeshL = new THREE.Mesh(new THREE.PlaneGeometry(2.0, fenceHeight - 0.2), fenceMeshMat);
  gateMeshL.position.set(1.0, fenceHeight / 2, 0);
  gateGroupL.add(gateMeshL);

  const gateGroupR = new THREE.Group();
  gateGroupR.position.set(2.0, 0, fenceZ);
  gateGroupR.rotation.y = -Math.PI * 0.45; // Abierto hacia adentro
  ruedaGroup.add(gateGroupR);

  const gateFrameR = new THREE.Mesh(new THREE.BoxGeometry(2.0, fenceHeight, 0.05), new THREE.MeshStandardMaterial({ color: 0x1c4d2d, wireframe: true }));
  gateFrameR.position.set(-1.0, fenceHeight / 2, 0);
  gateGroupR.add(gateFrameR);

  const gateMeshR = new THREE.Mesh(new THREE.PlaneGeometry(2.0, fenceHeight - 0.2), fenceMeshMat);
  gateMeshR.position.set(-1.0, fenceHeight / 2, 0);
  gateGroupR.add(gateMeshR);

  // --- LA RUEDA DE LA FORTUNA ---
  // Posicionada a la derecha: x = 5.5, z = 0
  const wheelBase = new THREE.Group();
  wheelBase.position.set(6.0, 0, -1.0);
  ruedaGroup.add(wheelBase);

  // Soporte en A (Triángulos laterales)
  const supportMat = new THREE.MeshStandardMaterial({ color: 0xaa7c11, roughness: 0.9, metalness: 0.2, flatShading: true }); // Amarillo oxidado
  const supportH = 7.0;

  [-1.0, 1.0].forEach(sidez => {
    const sz = sidez * 1.5;
    // Barra delantera
    const barF = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, supportH + 0.5, 6), supportMat);
    barF.rotation.x = -Math.PI * 0.12;
    barF.rotation.z = sidez * Math.PI * 0.08;
    barF.position.set(sidez * 0.3, supportH / 2, sz + 1.2);
    barF.castShadow = true;
    wheelBase.add(barF);

    // Barra trasera
    const barB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, supportH + 0.5, 6), supportMat);
    barB.rotation.x = Math.PI * 0.12;
    barB.rotation.z = sidez * Math.PI * 0.08;
    barB.position.set(sidez * 0.3, supportH / 2, sz - 1.2);
    barB.castShadow = true;
    wheelBase.add(barB);

    // Barra horizontal superior de unión lateral
    const sideTopBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), supportMat);
    sideTopBar.rotation.x = Math.PI / 2;
    sideTopBar.position.set(sidez * 0.6, supportH - 0.1, sz);
    wheelBase.add(sideTopBar);
  });

  // Eje Horizontal Central
  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 4.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x444448, roughness: 0.8, metalness: 0.9 })
  );
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, supportH - 0.1, 0);
  axle.castShadow = true;
  wheelBase.add(axle);

  // Rueda giratoria
  ruedaWheelPivot = new THREE.Group();
  ruedaWheelPivot.position.set(0, supportH - 0.1, 0);
  wheelBase.add(ruedaWheelPivot);

  // La Rueda Doble (Anillos y radios)
  const wheelRadius = 4.2;
  const wheelRingMat = new THREE.MeshStandardMaterial({ color: 0x66666e, roughness: 0.6, metalness: 0.7 });
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x77777a, roughness: 0.7 });

  [-1.0, 1.0].forEach(sidez => {
    const sz = sidez * 1.0;
    // Anillo Exterior
    const ringGeo = new THREE.TorusGeometry(wheelRadius, 0.05, 6, 32);
    const ring = new THREE.Mesh(ringGeo, wheelRingMat);
    ring.position.z = sz;
    ruedaWheelPivot.add(ring);

    // Anillo Interior (de refuerzo)
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius * 0.6, 0.04, 6, 24), wheelRingMat);
    innerRing.position.z = sz;
    ruedaWheelPivot.add(innerRing);

    // Radios (8 radios)
    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2;
      const spokeGeo = new THREE.CylinderGeometry(0.025, 0.025, wheelRadius, 4);
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.z = angle;
      spoke.position.set(Math.sin(angle) * wheelRadius / 2, -Math.cos(angle) * wheelRadius / 2, sz);
      spoke.castShadow = true;
      ruedaWheelPivot.add(spoke);
    }
  });

  // Barras transversales que conectan las dos ruedas paralelas
  for (let r = 0; r < 8; r++) {
    const angle = (r / 8) * Math.PI * 2;
    const x = Math.cos(angle) * wheelRadius;
    const y = Math.sin(angle) * wheelRadius;
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4), wheelRingMat);
    crossBar.rotation.x = Math.PI / 2;
    crossBar.position.set(x, y, 0);
    ruedaWheelPivot.add(crossBar);
  }

  // Las Cabinas (Cochas) - 8 cabinas colgantes
  const cabinColors = [
    0xda5d16, // Naranja
    0x1c662e, // Verde
    0x145db3, // Azul
    0xeaebeb, // Blanco
    0xeab116, // Amarillo
    0xda5d16, // Naranja 2
    0x1c662e, // Verde 2
    0x145db3, // Azul 2
  ];

  for (let r = 0; r < 8; r++) {
    const angle = (r / 8) * Math.PI * 2;
    const x = Math.cos(angle) * wheelRadius;
    const y = Math.sin(angle) * wheelRadius;

    // Pivote de la cabina (para mantenerla siempre vertical)
    const cabinPivot = new THREE.Group();
    // La posición es local a la rueda giratoria
    cabinPivot.position.set(x, y, 0);
    ruedaWheelPivot.add(cabinPivot);
    ruedaCabinsArray.push(cabinPivot);

    // Cabina física
    const color = cabinColors[r];
    const cMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, flatShading: true });

    // Cubeta / Asiento de la cocha
    const bucket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.9), cMat);
    bucket.position.y = -0.4;
    bucket.castShadow = true;
    cabinPivot.add(bucket);

    // Techo / Capota de la cocha
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.9), cMat);
    roof.position.y = 0.3;
    roof.castShadow = true;
    cabinPivot.add(roof);

    // Varillas laterales de suspensión que van al pivote (eje superior en y=0)
    const suspensionGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4);
    const suspensionL = new THREE.Mesh(suspensionGeo, wheelRingMat);
    suspensionL.position.set(0.48, -0.05, 0);
    cabinPivot.add(suspensionL);
    
    const suspensionR = suspensionL.clone();
    suspensionR.position.set(-0.48, -0.05, 0);
    cabinPivot.add(suspensionR);

    // Metadatos de interacción
    cabinPivot.userData = {
      isMemory: true,
      memoryTitle: 'LA RUEDA DE LA FORTUNA',
      memoryText: 'La rueda de la fortuna o "estrella" era una de las atracciones mecánicas permanentes del antiguo parque del Polideportivo. Su estructura metálica y sus coloridas cochas ofrecían a las familias samarias una vista elevada de las canchas y los cerros circundantes, convirtiéndose en un ícono de los domingos de recreación.',
      memoryImg: '/juegos_rueda.png'
    };
    cabinPivot.traverse(child => {
      if (child.isMesh) child.userData = cabinPivot.userData;
    });
  }

  // Plataforma de abordaje en la base (barandillas azules, cabina de madera)
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.9, flatShading: true });
  const platform = new THREE.Group();
  platform.position.set(0, 0, 0);
  wheelBase.add(platform);

  // Cimientos de concreto
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 3.8), concreteMat);
  foundation.position.set(0, 0.1, 0);
  foundation.receiveShadow = true;
  platform.add(foundation);

  // Escaleras de acceso
  const stepsMat = new THREE.MeshStandardMaterial({ color: 0x224488, roughness: 0.8 }); // Azul
  const steps = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), stepsMat);
  steps.position.set(0, 0.25, 2.2);
  steps.castShadow = true;
  platform.add(steps);

  // Cabina de control de madera a la izquierda
  const controlCabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.9 })); // Madera oscura
  controlCabin.position.set(-1.6, 0.75, 0.5);
  controlCabin.castShadow = true;
  wheelBase.add(controlCabin);

  // Techo inclinado de la cabina
  const controlRoof = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  controlRoof.position.set(-1.6, 1.5, 0.5);
  controlRoof.rotation.x = 0.1;
  controlRoof.castShadow = true;
  wheelBase.add(controlRoof);


  // --- EL AVIÓN COMERCIAL ESTACIONADO ---
  const planeGroup = new THREE.Group();
  planeGroup.position.set(-9.5, 0, -2.5);
  planeGroup.rotation.y = Math.PI * 0.08;
  ruedaGroup.add(planeGroup);

  const planeMat = new THREE.MeshStandardMaterial({ color: 0xeef2f7, roughness: 0.25, metalness: 0.1 }); // Blanco
  const blueStripeMat = new THREE.MeshStandardMaterial({ color: 0x1133aa, roughness: 0.3 }); // Franja azul

  // Fuselaje del Avión
  const bodyLen = 14.0;
  const bodyRad = 0.95;
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(bodyRad, bodyRad, bodyLen, 16), planeMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, bodyRad + 0.95, 0); // Elevado sobre el suelo
  fuselage.castShadow = true;
  planeGroup.add(fuselage);

  // Nariz del avión
  const nose = new THREE.Mesh(new THREE.SphereGeometry(bodyRad, 16, 16), planeMat);
  nose.scale.set(1.0, 1.0, 1.6);
  nose.position.set(0, bodyRad + 0.95, bodyLen / 2);
  nose.castShadow = true;
  planeGroup.add(nose);

  // Ventanillas de cabina oscuras
  const cockpitWindows = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x05050a }));
  cockpitWindows.position.set(0, bodyRad + 1.25, bodyLen / 2 + 0.65);
  cockpitWindows.rotation.x = -0.15;
  planeGroup.add(cockpitWindows);

  // Cola cónica
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(bodyRad, 3.2, 16), planeMat);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, bodyRad + 0.95, -bodyLen / 2 - 1.6);
  tailCone.castShadow = true;
  planeGroup.add(tailCone);

  // Franja azul pintada en el fuselaje
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(bodyRad + 0.01, bodyRad + 0.01, bodyLen, 16), blueStripeMat);
  stripe.rotation.x = Math.PI / 2;
  stripe.scale.set(1.0, 1.0, 0.15); // Solo una franja
  stripe.position.set(0, bodyRad + 0.92, 0);
  planeGroup.add(stripe);

  // Timón de cola vertical (Fin)
  const finGeo = new THREE.BoxGeometry(0.1, 3.2, 2.0);
  const fin = new THREE.Mesh(finGeo, planeMat);
  fin.position.set(0, bodyRad + 3.0, -bodyLen / 2 - 1.4);
  fin.rotation.x = -0.3; // Inclinado hacia atrás
  fin.castShadow = true;
  planeGroup.add(fin);

  // Timón horizontal de cola
  const stabilizerGeo = new THREE.BoxGeometry(3.6, 0.06, 1.2);
  const stabilizer = new THREE.Mesh(stabilizerGeo, planeMat);
  stabilizer.position.set(0, bodyRad + 2.8, -bodyLen / 2 - 1.8);
  stabilizer.rotation.x = -0.1;
  stabilizer.castShadow = true;
  planeGroup.add(stabilizer);

  // Alas principales (Ala izquierda y derecha)
  const wingSpan = 7.0;
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.08, 1.6), planeMat);
  wingL.rotation.y = Math.PI * 0.12; // Inclinada hacia atrás
  wingL.rotation.z = Math.PI * 0.05; // Diedro positivo
  wingL.position.set(-wingSpan / 2 - 0.4, bodyRad + 0.65, 0.5);
  wingL.castShadow = true;
  planeGroup.add(wingL);

  const wingR = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.08, 1.6), planeMat);
  wingR.rotation.y = -Math.PI * 0.12;
  wingR.rotation.z = -Math.PI * 0.05;
  wingR.position.set(wingSpan / 2 + 0.4, bodyRad + 0.65, 0.5);
  wingR.castShadow = true;
  planeGroup.add(wingR);

  // Turbinas bajo las alas
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
  [-1.0, 1.0].forEach(side => {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 1.6, 8), planeMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 2.8, bodyRad + 0.35, 0.8);
    engine.castShadow = true;
    planeGroup.add(engine);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), engineMat);
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.set(side * 2.8, bodyRad + 0.35, 0.8 - 0.9);
    planeGroup.add(nozzle);
  });

  // Tren de aterrizaje
  const strutsMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  const strutF = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), strutsMat);
  strutF.position.set(0, 0.95, bodyLen / 2 - 1.0);
  strutF.castShadow = true;
  planeGroup.add(strutF);
  const tireF = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 8), wheelMat);
  tireF.rotation.z = Math.PI / 2;
  tireF.position.set(0, 0.12, bodyLen / 2 - 1.0);
  planeGroup.add(tireF);

  [-1.0, 1.0].forEach(side => {
    const strutM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6), strutsMat);
    strutM.position.set(side * 1.5, 0.95, -1.0);
    strutM.castShadow = true;
    planeGroup.add(strutM);
    const tireM = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8), wheelMat);
    tireM.rotation.z = Math.PI / 2;
    tireM.position.set(side * 1.5, 0.17, -1.0);
    planeGroup.add(tireM);
  });

  // --- Escalerilla de abordaje transitable ---
  const stairsGroup = new THREE.Group();
  stairsGroup.position.set(-1.8, 0, 3.5);
  stairsGroup.rotation.y = -Math.PI * 0.15; // Apuntando hacia el fuselaje
  planeGroup.add(stairsGroup);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.6 });
  const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6), railMat);
  railL.rotation.x = Math.PI * 0.25; // 45 grados de inclinación
  railL.position.set(-0.55, 1.0, 0.9);
  railL.castShadow = true;
  stairsGroup.add(railL);

  const railR = railL.clone();
  railR.position.x = 0.55;
  stairsGroup.add(railR);

  // Escalones
  for (let s = 0; s < 6; s++) {
    const stepH = 0.28;
    const stepBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, stepH, 0.35), new THREE.MeshStandardMaterial({ color: 0x444448, roughness: 0.8 }));
    const sy = s * stepH + stepH / 2;
    const sz = 1.9 - s * 0.32;
    stepBox.position.set(0, sy, sz);
    stepBox.castShadow = true;
    stairsGroup.add(stepBox);
  }

  // Plataforma superior
  const topPlatform = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: 0x333336, roughness: 0.7 }));
  topPlatform.position.set(0, 6 * 0.28, 0.05);
  topPlatform.castShadow = true;
  stairsGroup.add(topPlatform);

  const platformSupport1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6 * 0.28, 6), railMat);
  platformSupport1.position.set(-0.5, (6 * 0.28) / 2, 0.05);
  stairsGroup.add(platformSupport1);
  const platformSupport2 = platformSupport1.clone();
  platformSupport2.position.x = 0.5;
  stairsGroup.add(platformSupport2);

  // Metadatos de interacción
  const planeMemoryData = {
    isMemory: true,
    memoryTitle: 'EL AVIÓN DEL POLIDEPORTIVO',
    memoryText: 'Un verdadero avión comercial de pasajeros, retirado de servicio, fue donado e instalado en el parque infantil del Polideportivo de Santa Marta. Los niños podían subir a bordo, explorar la cabina y jugar a ser pilotos. Se convirtió en uno de los elementos más singulares y queridos de la memoria urbana samaria antes de su posterior retiro.',
    memoryImg: '/juegos_rueda.png'
  };

  topPlatform.userData = planeMemoryData;
  fuselage.userData = planeMemoryData;
  nose.userData = planeMemoryData;

  // --- ÁRBOLES DE MANGO Y VEGETACIÓN CON FLORES ROJAS/ROSADAS ---
  function buildFlowerTree(x, z, scale = 1.0) {
    const tg = new THREE.Group();
    const tm = new THREE.MeshStandardMaterial({ color: 0x3c2a1c, roughness: 0.95 });
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, 4.5 * scale, 7), tm);
    tr.position.y = 2.25 * scale;
    tr.castShadow = true;
    tg.add(tr);

    const branch1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 2.0 * scale, 6), tm);
    branch1.rotation.z = Math.PI / 4;
    branch1.position.set(-0.5 * scale, 3.2 * scale, 0);
    tg.add(branch1);

    const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 2.0 * scale, 6), tm);
    branch2.rotation.z = -Math.PI / 4;
    branch2.position.set(0.5 * scale, 3.2 * scale, 0);
    tg.add(branch2);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x27591e, roughness: 0.8, flatShading: true });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xcc295c, roughness: 0.9, flatShading: true });

    const foliagePositions = [
      [0, 4.4, 0, 1.5],
      [-1.1, 3.9, 0, 1.2],
      [1.1, 3.9, 0, 1.2],
      [0, 4.0, 0.8, 1.1],
      [0, 4.0, -0.8, 1.1]
    ];

    foliagePositions.forEach(([fx, fy, fz, fr]) => {
      const leafMesh = new THREE.Mesh(new THREE.SphereGeometry(fr * scale, 8, 6), leafMat);
      leafMesh.position.set(fx * scale, fy * scale, fz * scale);
      leafMesh.castShadow = true;
      tg.add(leafMesh);

      for (let f = 0; f < 3; f++) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 4, 3), flowerMat);
        const fAngle = Math.random() * Math.PI * 2;
        flower.position.set(
          (fx + Math.cos(fAngle) * fr * 0.95) * scale,
          (fy + (Math.random() - 0.2) * fr * 0.8) * scale,
          (fz + Math.sin(fAngle) * fr * 0.95) * scale
        );
        tg.add(flower);
      }
    });

    tg.position.set(x, 0, z);
    ruedaGroup.add(tg);
  }

  buildFlowerTree(-5.5, 9.5, 1.35);
  buildFlowerTree(2.5, -9.0, 1.15);
  buildFlowerTree(11.0, -5.5, 1.2);
  buildFlowerTree(12.0, 4.0, 1.05);

  // --- Partículas de polen y polvo flotando ---
  {
    const pCount = 140;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i*3]   = (Math.random()-0.5)*36;
      pPos[i*3+1] = Math.random()*6;
      pPos[i*3+2] = (Math.random()-0.5)*30;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xffddaa, size: 0.04, transparent: true, opacity: 0.45, sizeAttenuation: true });
    const particles = new THREE.Points(pGeo, pMat);
    ruedaGroup.add(particles);
    ruedaGroup._particles = particles;
    ruedaGroup._particlePositions = pPos;
  }
}

// ============================================================
//  INTERACCIÓN — Sistema de Raycaster (crosshair al centro)
// ============================================================
const raycaster  = new THREE.Raycaster();
const centerVec  = new THREE.Vector2(0, 0);
const modal      = document.getElementById('memory-modal');
const modalTitle = document.getElementById('memory-title');
const modalContent = document.getElementById('memory-content');

window.addEventListener('click', () => {
  if (!controls.isLocked) return;
  raycaster.setFromCamera(centerVec, camera);
  
    let targets = [];
    if (currentScene === 'hub') targets = hubGroup.children;
    else if (currentScene === 'ancon') targets = anconGroup.children;
    else if (currentScene === 'variedades') targets = variedadesGroup.children;
    else if (currentScene === 'juegos') targets = juegosGroup.children;
    else if (currentScene === 'rueda') targets = ruedaGroup.children;
    else if (currentScene === 'dunlop') targets = dunlopGroup3.children;
  else if (currentScene === 'dunlop') targets = dunlopGroup3.children;


  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return;

  let hitObj = hits[0].object;
  let d = hitObj.userData;
  
  while (hitObj && !d.isPortal && !d.isSwitch && !d.isMemory && hitObj !== scene) {
    hitObj = hitObj.parent;
    if (hitObj) d = hitObj.userData;
  }

  if (!d) return;

  if (d.isPortal) {
    // Reanudar contexto de audio si está suspendido
    if (currentAmbience && currentAmbience.context && currentAmbience.context.state === 'suspended') {
      currentAmbience.context.resume();
    }

    const overlay = document.getElementById('scene-transition');
    overlay.classList.add('active');

    setTimeout(() => {
      if (d.target === 'ancon') {
        scene.remove(hubGroup);
        scene.add(anconGroup);
        scene.fog = new THREE.FogExp2(0x660033, 0.022);
        currentScene = 'ancon';
        startSceneAmbience('ancon');
        camera.position.set(0, 1.6, 9);
      } else if (d.target === 'variedades') {
        scene.remove(hubGroup);
        scene.add(variedadesGroup);
        scene.fog = new THREE.FogExp2(0x3d173d, 0.02);
        currentScene = 'variedades';
        startSceneAmbience('variedades');
        camera.position.set(0, 1.6, 15);
      } else if (d.target === 'juegos') {
        scene.remove(hubGroup);
        scene.add(juegosGroup);
        scene.fog = new THREE.FogExp2(0x4a2a40, 0.02);
        currentScene = 'juegos';
        startSceneAmbience('juegos');
        camera.position.set(0, 1.6, 10);
      } else if (d.target === 'rueda') {
        scene.remove(hubGroup);
        scene.add(ruedaGroup);
        scene.fog = new THREE.FogExp2(0x9bc2e6, 0.015);
        currentScene = 'rueda';
        startSceneAmbience('rueda');
        camera.position.set(0, 1.6, 15);
      } else if (d.target === 'dunlop') {
        scene.remove(hubGroup);
        scene.add(dunlopGroup3);
        scene.fog = new THREE.FogExp2(0x1a1a2e, 0.03);
        currentScene = 'dunlop';
        startSceneAmbience('dunlop');
        camera.position.set(0, 1.6, 12);
      }
      document.getElementById('ui-layer').classList.add('visible');

      setTimeout(() => {
        overlay.classList.remove('active');
      }, 200);
    }, 300);
  } else if (d.isSwitch) {
    toggleMovie();
  } else if (d.isMemory) {
    // Detener PointerLock para interactuar con el modal
    controls.unlock();
    
    // Configurar modal
    modalTitle.textContent = d.memoryTitle;
    typewriterEffect(modalContent, d.memoryText, 25);
    
    // Configurar imagen de recuerdo si existe
    const imgWrap = document.getElementById('memory-image-wrap');
    const imgEl = document.getElementById('memory-image');
    if (imgWrap && imgEl) {
      if (d.memoryImg) {
        imgEl.src = d.memoryImg;
        imgWrap.classList.add('has-img');
      } else {
        imgWrap.classList.remove('has-img');
      }
    }
    
    modal.classList.add('active');
  }
});

// Cerrar modal
let currentTypewriterTimer = null;
document.getElementById('close-modal-btn').addEventListener('click', () => {
  if (currentTypewriterTimer) {
    clearInterval(currentTypewriterTimer);
    currentTypewriterTimer = null;
  }
  modal.classList.remove('active');
  controls.lock();
});

// Sonido blip estilo Undertale
let blipCtx = null;
function playBlip() {
  try {
    if (!blipCtx) blipCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (blipCtx.state === 'suspended') blipCtx.resume();
    const osc = blipCtx.createOscillator();
    const gain = blipCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 + Math.random() * 200, blipCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, blipCtx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.06, blipCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, blipCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(blipCtx.destination);
    osc.start();
    osc.stop(blipCtx.currentTime + 0.05);
  } catch(e) {}
}

// Máquina de escribir
function typewriterEffect(el, text, speed = 28) {
  if (currentTypewriterTimer) clearInterval(currentTypewriterTimer);
  el.textContent = '';
  let i = 0;
  currentTypewriterTimer = setInterval(() => {
    el.textContent += text[i];
    if (text[i] !== ' ') playBlip();
    i++;
    if (i >= text.length) {
      clearInterval(currentTypewriterTimer);
      currentTypewriterTimer = null;
    }
  }, speed);
}

// ============================================================
//  CONTROLES DE MOVIMIENTO WASD
// ============================================================
const moveState = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', e => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp')    moveState.forward  = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft')  moveState.left     = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown')  moveState.backward = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.right    = true;
  if (e.code === 'Escape' && modal.classList.contains('active')) {
    if (currentTypewriterTimer) {
      clearInterval(currentTypewriterTimer);
      currentTypewriterTimer = null;
    }
    modal.classList.remove('active');
    controls.lock();
  }
});
document.addEventListener('keyup', e => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp')    moveState.forward  = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft')  moveState.left     = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown')  moveState.backward = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.right    = false;
});

// ============================================================
//  PANTALLA DE CARGA — Botón de entrada
// ============================================================
const loadingScreen = document.getElementById('loading-screen');
const crosshair     = document.getElementById('crosshair');
const vhsPlay       = document.getElementById('vhs-play');
const vhsRec        = document.getElementById('vhs-rec');
const uiLayer       = document.getElementById('ui-layer');

let isTransitioning = false;

document.getElementById('enter-portal-btn').addEventListener('click', () => {
  // Iniciar audio ambiental
  try {
    if (!currentAmbience) {
      startSceneAmbience('hub');
    }
  } catch (e) {
    console.error("Error al iniciar el audio:", e);
  }

  isTransitioning = true;
  if (document.activeElement) document.activeElement.blur();
  document.body.focus();
  loadingScreen.style.opacity = '0';
  loadingScreen.style.transition = 'opacity 0.8s';
  setTimeout(() => { 
    loadingScreen.style.display = 'none'; 
    isTransitioning = false;
  }, 820);
  controls.lock();
});

controls.addEventListener('lock', () => {
  crosshair.style.display = 'block';
  vhsPlay.style.display   = 'block';
  vhsRec.style.display    = 'block';
});

controls.addEventListener('unlock', () => {
  crosshair.style.display = 'none';
  vhsPlay.style.display   = 'none';
  vhsRec.style.display    = 'none';
  if (!modal.classList.contains('active') && !isTransitioning) {
    loadingScreen.style.display  = 'flex';
    loadingScreen.style.opacity  = '1';
    loadingScreen.style.transition = 'opacity 0.4s';
    uiLayer.classList.remove('visible');
    
    // Mostrar/ocultar botón de rebobinar según la escena
    const rewindBtn = document.getElementById('rewind-btn');
    if (rewindBtn) {
      if (currentScene === 'hub') {
        rewindBtn.style.display = 'none';
      } else {
        rewindBtn.style.display = 'inline-block';
      }
    }
  }
});

// Lógica del botón de Rebobinar (volver al Hub)
const rewindBtn = document.getElementById('rewind-btn');
if (rewindBtn) {
  rewindBtn.addEventListener('click', () => {
    isTransitioning = true;
    if (document.activeElement) document.activeElement.blur();
    document.body.focus();

    const overlay = document.getElementById('scene-transition');
    overlay.classList.add('active');

    setTimeout(() => {
      if (currentScene !== 'hub') {
        if (currentScene === 'ancon') scene.remove(anconGroup);
        else if (currentScene === 'variedades') scene.remove(variedadesGroup);
        else if (currentScene === 'juegos') scene.remove(juegosGroup);
        else if (currentScene === 'rueda') scene.remove(ruedaGroup);
        else if (currentScene === 'dunlop') scene.remove(dunlopGroup3);
        
        scene.add(hubGroup);
        scene.fog = new THREE.FogExp2(0x04040f, 0.06);
        currentScene = 'hub';
        startSceneAmbience('hub');
        camera.position.set(0, 1.6, 8);
        camera.rotation.set(0, 0, 0);
      }
      
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.8s';
      setTimeout(() => { 
        loadingScreen.style.display = 'none'; 
        isTransitioning = false;
      }, 820);

      setTimeout(() => {
        overlay.classList.remove('active');
      }, 200);

      controls.lock();
    }, 300);
  });
}

// Fallback para bloquear controles si el usuario hace clic en el canvas del juego
window.addEventListener('click', () => {
  if (!controls.isLocked && loadingScreen.style.display === 'none' && !modal.classList.contains('active')) {
    controls.lock();
  }
});

// ============================================================
//  RESIZE
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  LOOP DE ANIMACIÓN
// ============================================================
const velocity  = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.05);
  prevTime = time;
  const t = time * 0.001;

  // --- Movimiento WASD ---
  if (controls.isLocked) {
    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    const speed = 5.0;
    velocity.x = direction.x * speed;
    velocity.z = direction.z * speed;

    controls.moveRight(velocity.x * delta);
    controls.moveForward(velocity.z * delta);

    camera.position.y = 1.6;

    // Límites de exploración
    if (currentScene === 'ancon') {
      camera.position.x = Math.max(-22, Math.min(22, camera.position.x));
      camera.position.z = Math.max(-3, Math.min(12, camera.position.z));
    } else if (currentScene === 'variedades') {
      camera.position.x = Math.max(-9.5, Math.min(9.5, camera.position.x));
      camera.position.z = Math.max(-11.0, Math.min(17.5, camera.position.z));
    } else if (currentScene === 'juegos') {
      camera.position.x = Math.max(-12, Math.min(12, camera.position.x));
      camera.position.z = Math.max(-12, Math.min(12, camera.position.z));
    } else if (currentScene === 'rueda') {
      camera.position.x = Math.max(-20, Math.min(20, camera.position.x));
      camera.position.z = Math.max(-20, Math.min(20, camera.position.z));
    } else if (currentScene === 'dunlop') {
      camera.position.x = Math.max(-10, Math.min(10, camera.position.x));
      camera.position.z = Math.max(-5, Math.min(15, camera.position.z));
    } else { // hub
      camera.position.x = Math.max(-9, Math.min(9, camera.position.x));
      camera.position.z = Math.max(-7, Math.min(10, camera.position.z));
    }
  }

  // --- Animar portales del hub ---
  if (currentScene === 'hub' && scene._hubPortals) {
    scene._hubPortals.forEach(p => {
      p.rotation.y += 0.45 * delta;
      p.rotation.x += 0.28 * delta;
    });
  }

  // --- Animar agua ---
  if (currentScene === 'ancon') {
    const verts = waterGeo.attributes.position;
    for (let i = 0; i < verts.count; i++) {
      const ox = verts.getX(i);
      const oz = verts.getY(i);
      verts.setZ(i,
        Math.sin(ox * 0.3 + t * 0.6)  * 0.06 +
        Math.cos(oz * 0.25 + t * 0.5) * 0.04
      );
    }
    verts.needsUpdate = true;

    // Las luces puntuales ahora son solo de acento, no principales
    // El sol y el relleno son constantes — sin cambio en loop

    // Partículas flotando lentamente
    const pp = anconGroup._particles;
    if (pp) {
      const pos = anconGroup._particlePositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += delta * 0.08;
        if (pos[i * 3 + 1] > 5.5) pos[i * 3 + 1] = 0.1;
        pos[i * 3] += Math.sin(t + i) * delta * 0.015;
      }
      pp.geometry.attributes.position.needsUpdate = true;
    }
  }

  // --- Animar Teatro Variedades ---
  if (currentScene === 'variedades') {
    const wl = variedadesGroup.wallLamps;
    const sLED = variedadesGroup.switchLED;
    const sLever = variedadesGroup.switchLever;
    const pp = variedadesGroup._particles;
    if (isMoviePlaying) {
      if (projectionBeam) projectionBeam.material.opacity = 0.07 + Math.sin(t * 45) * 0.03 + Math.random() * 0.04;
      projectorPointLight.intensity = 5.0 + Math.sin(t * 35) * 1.5 + Math.random() * 1.0;
      updateMovieScreen(time);
      if (wl) wl.forEach(({ mat, light }) => { mat.emissiveIntensity = 0; mat.color.setHex(0x444444); light.intensity = 0; });
      if (sLED) sLED.material.color.setHex(0x00ff00);
      if (sLever) sLever.rotation.x = 0.5;
      if (pp) pp.material.opacity = 0.5 + Math.sin(t * 15) * 0.15 + Math.random() * 0.1; // Brillo trémulo de partículas
    } else {
      if (projectionBeam) projectionBeam.material.opacity = 0;
      projectorPointLight.intensity = 0;
      drawStandbyScreen();
      if (wl) wl.forEach(({ mat, light }) => { mat.emissiveIntensity = 1.2; mat.color.setHex(0xffdd88); light.intensity = 1.5; });
      if (sLED) sLED.material.color.setHex(0xff0000);
      if (sLever) sLever.rotation.x = -0.5;
      if (pp) pp.material.opacity = 0.0; // Polvo invisible con proyector apagado
    }

    // Animar partículas de polvo flotando en el haz del proyector
    if (pp) {
      const pos = variedadesGroup._particlePositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 2] -= delta * 0.5;
        if (pos[i * 3 + 2] < -15) {
          pos[i * 3 + 2] = 19.5; // Resetea al proyector (z=19.75)
        }
        pos[i * 3] += Math.sin(t * 1.5 + i) * delta * 0.05;
        pos[i * 3 + 1] += Math.cos(t * 1.2 + i) * delta * 0.03;
      }
      pp.geometry.attributes.position.needsUpdate = true;
    }
  }

  // --- Animar Juegos del Polideportivo ---
  if (currentScene === 'juegos') {
    if (carruselPivot) {
      carruselPivot.rotation.y = t * 0.15; // Rotación lenta y majestuosa
    }
    
    // Vaivén e inclinación de los aviones
    aircraftGroupArray.forEach((plane, idx) => {
      // Oscilación vertical suave e independiente para cada avión
      plane.position.y = 0.7 + Math.sin(t * 1.8 + idx * 1.0) * 0.12;
      
      // Cabeceo (rotación leve en X para inclinación de nariz)
      plane.rotation.x = Math.sin(t * 2.2 + idx * 1.0) * 0.06;
      
      // Balanceo lateral (rotación en Z para inclinación centrífuga + balanceo)
      // Agregamos una inclinación fija hacia afuera de 0.05 rad y un balanceo
      plane.rotation.z = Math.cos(t * 1.8 + idx * 1.0) * 0.04 - 0.05;
    });

    // Partículas de polvo brillante flotando
    const pp = juegosGroup._particles;
    if (pp) {
      const pos = juegosGroup._particlePositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += delta * 0.08;
        if (pos[i * 3 + 1] > 5.0) pos[i * 3 + 1] = 0.1;
        pos[i * 3] += Math.sin(t * 0.5 + i) * delta * 0.015;
      }
      pp.geometry.attributes.position.needsUpdate = true;
    }
  }

  // --- Animar Rueda de la Fortuna ---
  if (currentScene === 'rueda') {
    if (ruedaWheelPivot) {
      // Rotar la rueda principal lentamente en su eje horizontal (Z local)
      ruedaWheelPivot.rotation.z = t * 0.12;
      
      // Auto-enderezar las cochas (cabinas)
      ruedaCabinsArray.forEach(cabin => {
        cabin.rotation.z = -ruedaWheelPivot.rotation.z;
      });
    }

    // Partículas de polvo y polen flotando
    const pp = ruedaGroup._particles;
    if (pp) {
      const pos = ruedaGroup._particlePositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += delta * 0.085;
        if (pos[i * 3 + 1] > 6.0) pos[i * 3 + 1] = 0.1;
        pos[i * 3] += Math.sin(t * 0.4 + i) * delta * 0.015;
      }
      pp.geometry.attributes.position.needsUpdate = true;
    }
  }

  // --- Sistema Dinámico de Etiquetas en Mira ---
  if (controls.isLocked) {
    raycaster.setFromCamera(centerVec, camera);
    let targets = [];
    if (currentScene === 'hub') targets = hubGroup.children;
    else if (currentScene === 'ancon') targets = anconGroup.children;
    else if (currentScene === 'variedades') targets = variedadesGroup.children;
    // else if (currentScene === 'polvorin') targets = polvorinGroup.children;
    // else if (currentScene === 'dunlop') targets = dunlopGroup.children;
    else if (currentScene === 'juegos') targets = juegosGroup.children;
    else if (currentScene === 'rueda') targets = ruedaGroup.children;
    
    const hits = raycaster.intersectObjects(targets, true);
    let foundInteractable = false;
    let labelText = '';
    
    if (hits.length) {
      let hitObj = hits[0].object;
      let d = hitObj.userData;
      
      while (hitObj && !d.isPortal && !d.isSwitch && !d.isMemory && hitObj !== scene) {
        hitObj = hitObj.parent;
        if (hitObj) d = hitObj.userData;
      }
      
      if (d) {
        if (d.isPortal) {
          foundInteractable = true;
          if (d.target === 'ancon') labelText = 'ENTRAR A EL ANCÓN';
          else if (d.target === 'variedades') labelText = 'ENTRAR A TEATRO VARIEDADES';
          // else if (d.target === 'polvorin') labelText = 'ENTRAR A EL POLVORÍN';
          // else if (d.target === 'dunlop') labelText = 'ENTRAR A GIMNASIO DUNLOP';
          else if (d.target === 'juegos') labelText = 'ENTRAR A JUEGOS DEL POLIDEPORTIVO';
          else if (d.target === 'rueda') labelText = 'ENTRAR A LA LA RUEDA Y EL AVIÓN';
          else if (d.target === 'dunlop') labelText = 'ENTRAR A GIMNASIO DUNLOP';
        } else if (d.isSwitch) {
          foundInteractable = true;
          labelText = isMoviePlaying ? 'APAGAR PROYECTOR' : 'INICIAR PELÍCULA';
        } else if (d.isMemory) {
          foundInteractable = true;
          labelText = `RECONSTRUIR RECUERDO: ${d.memoryTitle}`;
        }
      }
    }
    
    const crosshairLabel = document.getElementById('crosshair-label');
    if (crosshairLabel) {
      if (foundInteractable) {
        crosshairLabel.textContent = labelText;
        crosshairLabel.style.display = 'block';
      } else {
        crosshairLabel.style.display = 'none';
      }
    }
  }

  composer.render();
}

animate();
