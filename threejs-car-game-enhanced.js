// threejs-car-game-enhanced.js
// ---------- Scene ----------
const scene = new THREE.Scene();

// Sky and fog
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, -12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(-10, 20, -10);
dirLight.castShadow = true;
scene.add(dirLight);

// ---------- Road ----------
const ROAD_WIDTH = 8;
const LANE_X = [-2.6, 0, 2.6];

// Road group for infinite scrolling
const roadGroup = new THREE.Group();
scene.add(roadGroup);

// Road mesh
const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, 1000);
const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.z = 0;
roadGroup.add(road);

// Lane lines
const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const LINE_WIDTH = 0.2;
const LINE_LENGTH = 4;
const laneLines = [];
for (let z = -500; z < 500; z += 10) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(LINE_WIDTH, LINE_LENGTH), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.01, z);
  roadGroup.add(line);
  laneLines.push(line);
}

// Grass
const grassGeo = new THREE.PlaneGeometry(50, 1000);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x2b9c34 });
const gleft = new THREE.Mesh(grassGeo, grassMat);
gleft.rotation.x = -Math.PI / 2;
gleft.position.set(-ROAD_WIDTH / 2 - 25, 0, 0);
scene.add(gleft);
const gright = gleft.clone();
gright.position.x = ROAD_WIDTH / 2 + 25;
scene.add(gright);

// ---------- Player Car ----------
const player = new THREE.Group();
player.position.set(0, 0.7, 0);

// Car body
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4), bodyMat);
body.position.y = 0.35;
player.add(body);

// Cabin
const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333366 });
const cabinGeo = new THREE.BoxGeometry(1.4, 0.6, 1.8);
cabinGeo.translate(0, 0.3, -0.1);
const cabin = new THREE.Mesh(cabinGeo, cabinMat);
cabin.position.set(0, 0.65, -0.2);
player.add(cabin);

// Bumper
const bumperMat = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 0.5), bumperMat);
bumper.position.set(0, 0.2, 2.25);
player.add(bumper);

// Headlights
const headMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffcc, emissiveIntensity: 0 });
const leftHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.05), headMat);
leftHead.position.set(-0.6, 0.3, 2.5);
const rightHead = leftHead.clone();
rightHead.position.x = 0.6;
player.add(leftHead, rightHead);

const headPoint = new THREE.PointLight(0xfff2cc, 0, 10, 2);
headPoint.position.set(0, 0.6, 2.5);
player.add(headPoint);

// Taillights
const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xaa0000, emissiveIntensity: 1 });
const leftTail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.05), tailMat);
leftTail.position.set(-0.6, 0.3, -2.25);
const rightTail = leftTail.clone();
rightTail.position.x = 0.6;
player.add(leftTail, rightTail);

// Wheels
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 20);
wheelGeo.rotateZ(Math.PI / 2);
const wheels = [];
const wheelPos = [
  [-0.8, 0.2, 1.5],
  [0.8, 0.2, 1.5],
  [-0.8, 0.2, -1.5],
  [0.8, 0.2, -1.5],
];
wheelPos.forEach(p => {
  const tire = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x111111 }));
  tire.position.set(p[0], p[1], p[2]);
  player.add(tire);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  hub.rotation.z = Math.PI / 2;
  hub.position.copy(tire.position);
  player.add(hub);

  wheels.push(tire);
});
scene.add(player);

// ---------- Game State ----------
let keys = {};
let lastTime = performance.now();
let velocity = 0;
const MAX_SPEED = 1.8;
const ACCEL = 0.02;
const BRAKE = 0.04;
const FRICTION = 0.01;
const STEER = 0.15;

let enemies = [];
let lastSpawn = 0;
let baseSpawnInterval = 1500;
let spawnInterval = baseSpawnInterval;
let baseEnemySpeed = 0.15;
let enemySpeed = baseEnemySpeed;
let score = 0;
let gameOver = false;

// ---------- HUD ----------
const scoreEl = document.getElementById("score");
const speedEl = document.getElementById("speed");
const overlay = document.getElementById("overlay");

// ---------- Input ----------
window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// ---------- Enemy Car ----------
function makeEnemyCar() {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4), bodyMat);
  body.position.y = 0.35;
  car.add(body);

  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x222244 });
  const cabinGeo = new THREE.BoxGeometry(1.4, 0.6, 1.8);
  cabinGeo.translate(0, 0.3, -0.1);
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.65, -0.2);
  car.add(cabin);

  const bumperMat = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 0.5), bumperMat);
  bumper.position.set(0, 0.2, 2.25);
  car.add(bumper);

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPos = [
    [-0.8, 0.2, 1.5],
    [0.8, 0.2, 1.5],
    [-0.8, 0.2, -1.5],
    [0.8, 0.2, -1.5],
  ];
  wheelPos.forEach(p => {
    const tire = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x111111 }));
    tire.position.set(p[0], p[1], p[2]);
    car.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(tire.position);
    car.add(hub);
  });

  car.rotation.y = Math.PI;
  scene.add(car);
  return car;
}

// ---------- Game Over ----------
function endGame() {
  gameOver = true;
  overlay.innerHTML = `
    <h1>Game Over</h1>
    <p>Final Score: ${Math.floor(score)}</p>
    <button onclick="restart()">Restart</button>
  `;
  overlay.style.display = "flex";
}

window.restart = function () {
  enemies.forEach(e => scene.remove(e));
  enemies = [];
  player.position.set(0, 0.7, 0);
  velocity = 0;
  score = 0;
  gameOver = false;
  overlay.style.display = "none";
};

// ---------- Animate ----------
function animate(now) {
  requestAnimationFrame(animate);
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  if (!gameOver) {
    // Input
    if (keys["ArrowUp"]) velocity += ACCEL;
    if (keys["ArrowDown"]) velocity -= BRAKE;
    if (!keys["ArrowUp"] && !keys["ArrowDown"]) {
      if (velocity > 0) velocity = Math.max(0, velocity - FRICTION);
      if (velocity < 0) velocity = Math.min(0, velocity + FRICTION);
    }
    velocity = Math.max(0, Math.min(MAX_SPEED, velocity));

    if (keys["ArrowLeft"]) player.position.x += STEER;
    if (keys["ArrowRight"]) player.position.x -= STEER;
    player.position.x = Math.max(-2.8, Math.min(2.8, player.position.x));

    player.position.z += velocity * 20 * delta;

    // Move road to simulate infinite scrolling
    roadGroup.position.z = -player.position.z;

    // Camera follow
    const desired = new THREE.Vector3(player.position.x, player.position.y + 5, player.position.z - 12);
    camera.position.lerp(desired, 0.1);
    camera.lookAt(player.position.x, player.position.y, player.position.z + 5);

    // Wheels rotate
    wheels.forEach(w => { w.rotation.x -= velocity * 5; });

    headMat.emissiveIntensity = velocity > 0.2 ? 1.2 : 0;
    headPoint.intensity = velocity > 0.2 ? 0.9 : 0;

    // Spawn enemies
    if (now - lastSpawn > spawnInterval) {
      const enemy = makeEnemyCar();
      enemy.position.set(LANE_X[Math.floor(Math.random() * 3)], 0.7, player.position.z + 80);
      enemies.push(enemy);
      lastSpawn = now;
    }

    // Move enemies
    enemies.forEach((e, i) => {
      e.position.z -= enemySpeed * 60 * delta;

      if (e.position.z < player.position.z - 10) {
        scene.remove(e);
        enemies.splice(i, 1);
      }

      const pBox = new THREE.Box3().setFromObject(player);
      const eBox = new THREE.Box3().setFromObject(e);
      if (pBox.intersectsBox(eBox)) endGame();
    });

    spawnInterval = Math.max(500, baseSpawnInterval - score * 2);
    enemySpeed = baseEnemySpeed + Math.min(0.3, score / 2000);

    score += delta * 10;
    scoreEl.innerText = "Score: " + Math.floor(score);
    speedEl.innerText = "Speed: " + velocity.toFixed(2);
  }

  renderer.render(scene, camera);
}

animate(performance.now());
