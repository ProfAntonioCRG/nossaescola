// Configuração do Canvas e Contexto
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const fullscreenBtn = document.getElementById("fullscreenBtn");

// Garante que o canvas possa receber foco do teclado
canvas.setAttribute("tabindex", "0");
// Aplica um leve contorno visual apenas quando focado (opcional, remova se preferir)
canvas.style.outline = "none"; 

// Força o foco no canvas ao carregar a página e ao clicar nele
window.addEventListener("load", () => canvas.focus());
canvas.addEventListener("click", () => canvas.focus());

// Resolução interna fixa do jogo (estilo retrô)
canvas.width = 640;
canvas.height = 480;

// Estados do Jogo
let speed = 0;
const maxSpeed = 15;
const accel = 0.2;
const breaking = 0.4;
const decel = 0.1;
let playerX = 0; // Posição horizontal do jogador (-1 a 1)
let position = 0; // Distância percorrida na estrada
let score = 0;
let gameOver = false;

// Controles
const keys = { Left: false, Right: false, Up: false, Down: false };

// Configurações da Estrada pseudo-3D
const roadWidth = 2000;
const segmentLength = 200;
const rumbleLength = 3;
const cameraDepth = 0.8;
const cameraHeight = 1000;
const drawDistance = 100;

// Gerar a pista com curvas e retas
const segments = [];
function createRoad() {
    for (let i = 0; i < 500; i++) {
        let curve = 0;
        if (i > 50 && i < 100) curve = 2;    // Curva suave à direita
        if (i > 150 && i < 220) curve = -3;  // Curva fechada à esquerda
        if (i > 300 && i < 380) curve = 4;   // Curva acentuada à direita

        segments.push({
            index: i,
            p1: { world: { x: 0, y: 0, z: i * segmentLength }, screen: { x: 0, y: 0, w: 0 } },
            p2: { world: { x: 0, y: 0, z: (i + 1) * segmentLength }, screen: { x: 0, y: 0, w: 0 } },
            curve: curve,
            color: Math.floor(i / rumbleLength) % 2 ? { road: '#4A4A4A', grass: '#008000', rumble: '#FFF' } 
                                                    : { road: '#424242', grass: '#006400', rumble: '#8B0000' }
        });
    }
}
createRoad();
const trackLength = segments.length * segmentLength;

// Carros Adversários
const cars = [];
function spawnCars() {
    for (let i = 20; i < segments.length - 10; i += 15) {
        cars.push({
            offset: (Math.random() * 1.6) - 0.8, // Posição na pista (-0.8 a 0.8)
            z: i * segmentLength,
            speed: 5 + Math.random() * 4,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            width: 400
        });
    }
}
spawnCars();

// Ouvintes de Teclado Atualizados (Prevenindo bugs de letras maiúsculas)
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') { keys.Left = true; e.preventDefault(); }
    if (key === 'arrowright' || key === 'd') { keys.Right = true; e.preventDefault(); }
    if (key === 'arrowup' || key === 'w') { keys.Up = true; e.preventDefault(); }
    if (key === 'arrowdown' || key === 's') { keys.Down = true; e.preventDefault(); }
});

window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') keys.Left = false;
    if (key === 'arrowright' || key === 'd') keys.Right = false;
    if (key === 'arrowup' || key === 'w') keys.Up = false;
    if (key === 'arrowdown' || key === 's') keys.Down = false;
});

// Mecânica de Projeção 3D para 2D
function project(p, cameraX, cameraZ, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraHeight;
    p.camera.z = (p.world.z || 0) - cameraZ;
    
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((canvas.width / 2) + (p.screen.scale * p.camera.x * canvas.width / 2));
    p.screen.y = Math.round((canvas.height / 2) - (p.screen.scale * p.camera.y * canvas.height / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * canvas.width / 2);
}

// Renderizar Segmento da Estrada
function drawSegment(c, p1, p2) {
    // Grama
    ctx.fillStyle = c.grass;
    ctx.fillRect(0, p2.screen.y, canvas.width, p1.screen.y - p2.screen.y);
    
    // Zebra / Rumble
    let r1 = p1.screen.w * 0.1;
    let r2 = p2.screen.w * 0.1;
    ctx.fillStyle = c.rumble;
    ctx.beginPath();
    ctx.moveTo(p1.screen.x - p1.screen.w - r1, p1.screen.y); ctx.lineTo(p1.screen.x - p1.screen.w, p1.screen.y);
    ctx.lineTo(p2.screen.x - p2.screen.w, p2.screen.y); ctx.lineTo(p2.screen.x - p2.screen.w - r2, p2.screen.y);
    ctx.moveTo(p1.screen.x + p1.screen.w + r1, p1.screen.y); ctx.lineTo(p1.screen.x + p1.screen.w, p1.screen.y);
    ctx.lineTo(p2.screen.x + p2.screen.w, p2.screen.y); ctx.lineTo(p2.screen.x + p2.screen.w + r2, p2.screen.y);
    ctx.fill();

    // Estrada Principal
    ctx.fillStyle = c.road;
    ctx.beginPath();
    ctx.moveTo(p1.screen.x - p1.screen.w, p1.screen.y);
    ctx.lineTo(p1.screen.x + p1.screen.w, p1.screen.y);
    ctx.lineTo(p2.screen.x + p2.screen.w, p2.screen.y);
    ctx.lineTo(p2.screen.x - p2.screen.w, p2.screen.y);
    ctx.fill();
}

// Desenhar Carros (Adversários e Jogador)
function drawVehicle(x, y, scale, color, isPlayer = false) {
    let w = 50 * scale * (canvas.width / 2);
    let h = 30 * scale * (canvas.width / 2);
    
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - w / 2 - 4, y - h + 5, 5, h - 8);
    ctx.fillRect(x + w / 2 - 1, y - h + 5, 5, h - 8);
    
    if (isPlayer) {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(x - w / 2, y - h - 4, w, 4);
    }
}

// Loop Principal do Jogo
function update() {
    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFF";
        ctx.font = "30px 'Courier New'";
        ctx.fillText("FIM DE JOGO!", canvas.width / 2 - 90, canvas.height / 2);
        return;
    }

    // 1. Atualizar Física do Jogador
    if (keys.Up) speed += accel;
    else if (keys.Down) speed -= breaking;
    else speed -= decel;
    
    speed = Math.max(0, Math.min(speed, maxSpeed));
    position += speed;
    if (position >= trackLength) position -= trackLength;

    // Curvatura e Movimento Lateral
    let playerSegment = segments[Math.floor(position / segmentLength) % segments.length];
    playerX -= (speed / maxSpeed) * playerSegment.curve * 0.007;

    if (keys.Left) playerX -= 0.04 * (speed / maxSpeed);
    if (keys.Right) playerX += 0.04 * (speed / maxSpeed);
    playerX = Math.max(-2, Math.min(playerX, 2));

    // 2. Renderizar Cenário (Céu)
    ctx.fillStyle = "#111133";
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#115522";
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // 3. Renderizar Pista Pseudo-3D
    let startSegment = Math.floor(position / segmentLength);
    let cameraX = playerX * roadWidth;
    let xOffset = 0;
    let dx = -playerSegment.curve;

    for (let n = 0; n < drawDistance; n++) {
        let segment = segments[(startSegment + n) % segments.length];
        let loop = (startSegment + n) >= segments.length ? trackLength : 0;

        segment.p1.camera = {}; segment.p1.screen = {};
        segment.p2.camera = {}; segment.p2.screen = {};

        segment.p1.world.x = xOffset;
        segment.p2.world.x = xOffset + dx;
        
        project(segment.p1, cameraX - xOffset, position - loop, roadWidth);
        project(segment.p2, cameraX - xOffset - dx, position - loop, roadWidth);

        xOffset += dx;
        dx += segment.curve;

        if ((segment.p1.camera.z <= cameraDepth) || (segment.p1.screen.y <= segment.p2.screen.y)) continue;

        drawSegment(segment.color, segment.p1, segment.p2);
    }

    // 4. Renderizar e Atualizar Carros Adversários
    cars.forEach(car => {
        car.z -= car.speed;
        if (car.z < 0) car.z += trackLength;

        let carSegment = segments[Math.floor(car.z / segmentLength) % segments.length];
        let loop = car.z > position ? -trackLength : 0;

        let p = { world: { x: car.offset * roadWidth, y: 0, z: car.z }, camera: {}, screen: {} };
        project(p, cameraX, position + loop, roadWidth);

        if (p.camera.z > cameraDepth && p.camera.z < drawDistance * segmentLength) {
            drawVehicle(p.screen.x, p.screen.y, p.screen.scale, car.color);
        }

        // Colisão
        if (Math.abs(car.z - position) < 250 && Math.abs(car.offset - playerX) < 0.3) {
            speed = 2;
            score = Math.max(0, score - 5);
        }
    });

    // 5. Desenhar Carro do Jogador
    drawVehicle(canvas.width / 2, canvas.height - 20, cameraDepth / 200, '#E51A1A', true);

    // 6. Placar e HUD
    score += Math.floor(speed / 5);
    ctx.fillStyle = "#FFF";
    ctx.font = "20px 'Courier New'";
    ctx.fillText(`PONTOS: ${score}`, 20, 40);
    ctx.fillText(`VEL: ${Math.floor(speed * 10)} KM/H`, canvas.width - 200, 40);

    // Mensagem informativa discreta se o jogo não estiver focado
    if (document.activeElement !== canvas) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.fillStyle = "#FFF";
        ctx.font = "14px 'Courier New'";
        ctx.fillText("CLIQUE NA TELA DO JOGO PARA JOGAR (ATIVAR TECLADO)", 100, canvas.height - 15);
    }

    requestAnimationFrame(update);
}

// Gerenciamento de Fullscreen
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            canvas.requestFullscreen().then(() => {
                setTimeout(() => canvas.focus(), 100); // Garante foco ao entrar em tela cheia
            }).catch(err => {
                alert(`Erro ao tentar ativar tela cheia: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });
}

// Inicia o Jogo
update();
