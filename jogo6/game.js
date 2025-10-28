// =================================================================
// --- 1. CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS ---
// =================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const livesDisplay = document.getElementById('lives');
const scoreDisplay = document.getElementById('score');
const speedDisplay = document.getElementById('speed');
const jumpsDisplay = document.getElementById('jumps');

// Elementos do Menu e Controle do Loop
const menuScreen = document.getElementById('menuScreen');
const startButton = document.getElementById('startButton');
const highScoreDisplay = document.getElementById('highScore');
let isMenuOpen = true; 
let highScore = 0; 
let animationFrameId = null; 

let lives = 3; 
let score = 0;
let distance = 0; // Para pontuação por avanço
const BASE_RIVER_SPEED = 3.0; // Velocidade base inicial
let RIVER_SPEED = BASE_RIVER_SPEED; 
let gameOver = false;
let obstacles = [];

// Temporizadores e Cooldowns
let lastWaterfallTime = 0;
const WATERFALL_COOLDOWN_MS = 5000; 

const SPEED_INCREASE_INTERVAL_MS = 15000; 
let waterfallSpeedBoostTimer = 0; // Timer para o boost de cachoeira

// Variável para calcular a dificuldade (tempo total de jogo)
let gameStartTime = 0; 

// Pulo com Cooldown
const MAX_JUMPS = 3;
let currentJumps = MAX_JUMPS;
const JUMP_COOLDOWN_SECONDS = 180; 
let cooldownStartTime = 0;
let isCooldownActive = false;
const JUMP_STAMINA_COST = 50; 

// Estado das teclas
const keys = {
    up: false, down: false, left: false, right: false, space: false, jump: false
};

// Animação do Rio
let waterLineYOffset = 0;
const WATER_LINE_HEIGHT = 50; 
const RIVER_COLOR = '#005f88';
const LINE_COLOR_1 = 'rgba(255, 255, 255, 0.3)';
const LINE_COLOR_2 = 'rgba(0, 179, 255, 0.4)';


// =================================================================
// --- 2. CARREGAMENTO DE IMAGENS ---
// =================================================================
const images = {};

function loadImage(name, src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            images[name] = img;
            resolve();
        };
        img.onerror = () => {
            console.warn(`Erro ao carregar imagem: ${src}. Usando placeholder.`);
            reject(); 
        };
    });
}

const imageLoadPromises = [
    loadImage('kayak_normal', 'sprite_player.png'),
    loadImage('kayak_flipped', 'sprite_player_invertido.png'),
    loadImage('log', 'sprite_tronco.png'),
    loadImage('fish', 'sprite_peixe.png'),
    loadImage('fisherman', 'sprite_barco1.png'),
    loadImage('waterfall', 'sprite_cachoeira.png'),
    loadImage('rock', 'sprite_rock.png'), 
    loadImage('whirlpool', 'sprite_redemoinho.png'), 
    loadImage('starfish', 'sprite_starfish.png'),
    loadImage('lowbridge', 'sprite_ponte_baixa.png'), 
];

// =================================================================
// --- 3. CLASSES KAYAK E OBSTACLE ---
// =================================================================

class Kayak {
    constructor(x, y, width, height) {
        this.initialWidth = width; this.initialHeight = height; this.x = x; this.y = y; this.width = width; this.height = height;
        this.speedX = 0; this.speedY = 0; this.maxSpeed = 5; 
        this.isFlipped = false; 
        
        // Pulo (Mecânica da Revisão)
        this.isJumping = false; this.jumpProgress = 0; this.jumpDuration = 120; 
        this.jumpHeightMultiplier = 0.5; this.jumpScaleFactor = 1.5; this.jumpYOffset = 0; 
        
        // Animação de Mergulho (Dip)
        this.isDipping = false; 
        this.dipProgress = 0; 
        this.dipDuration = 60; 
        this.dipScaleFactor = 0.8; 

        // Dano
        this.isInvulnerable = false; this.invulnerabilityTimer = 0; this.flickerCounter = 0; 
        
        // Rotação no Dano (360 Spin)
        this.isRotating = false; 
        this.rotationTimer = 0; 
        this.rotationAngle = 0; 
        this.rotationDuration = 45; 

        this.maxStamina = 150; 
        this.stamina = this.maxStamina; 
        this.staminaDrainRate = 1.5; 
        this.staminaChargeRate = 1.0; 
    }

    drawStaminaBar() {
        const barWidth = this.initialWidth; const barHeight = 5; 
        const barX = this.x;
        const barY = this.y - 10 - this.jumpYOffset; 
        
        const currentBarWidth = (this.stamina / this.maxStamina) * barWidth;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; 
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = this.stamina > 30 ? 'lime' : 'red'; 
        ctx.fillRect(barX, barY, currentBarWidth, barHeight);
        
        ctx.strokeStyle = 'white'; 
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    draw() {
        let currentSprite = this.isFlipped ? images.kayak_flipped : images.kayak_normal;
        
        if (currentSprite) { 
            ctx.save();
            
            // Lógica de Rotação (360 Spin)
            if (this.isRotating) {
                ctx.translate(this.x + this.initialWidth / 2, this.y + this.initialHeight / 2 - this.jumpYOffset);
                ctx.rotate(this.rotationAngle);
                
                if (!this.isInvulnerable || this.flickerCounter % 4 < 2) {
                    ctx.drawImage(currentSprite, -this.initialWidth / 2, -this.initialHeight / 2, this.initialWidth, this.initialHeight);
                }
                
                // Desenha a barra de stamina em coordenadas relativas
                const barWidth = this.initialWidth; const barHeight = 5; 
                const currentBarWidth = (this.stamina / this.maxStamina) * barWidth;
                const barX = -this.initialWidth / 2;
                const barY = -this.initialHeight / 2 - 10;
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.fillStyle = this.stamina > 30 ? 'lime' : 'red'; ctx.fillRect(barX, barY, currentBarWidth, barHeight);
                ctx.strokeStyle = 'white'; ctx.strokeRect(barX, barY, barWidth, barHeight);
                
                ctx.restore();
                return; 
            }
            
            // Lógica de Desenho Normal (sem rotação)
            
            if (!this.isInvulnerable || this.flickerCounter % 4 < 2) {
                let drawX = this.x; let drawY = this.y; 
                let drawW = this.initialWidth; let drawH = this.initialHeight;
                
                if (this.isJumping || this.isDipping) {
                    const progress = this.isJumping ? this.jumpProgress : this.dipProgress;
                    const curve = Math.sin(progress * Math.PI);
                    
                    let currentScale = 1.0;
                    
                    if (this.isJumping) {
                        // Pulo: Aumenta escala
                        const scaleMultiplier = this.jumpScaleFactor;
                        currentScale = 1 + (curve * (scaleMultiplier - 1));
                    } else if (this.isDipping) { 
                        // Mergulho: Diminui escala
                        const scaleMultiplier = this.dipScaleFactor; 
                        currentScale = 1 - (curve * (1 - scaleMultiplier)); 
                    }
                    
                    drawW = this.initialWidth * currentScale; 
                    drawH = this.initialHeight * currentScale;
                    drawX = this.x - (drawW - this.initialWidth) / 2; 
                    drawY = this.y - (drawH - this.initialHeight); 
                }
                
                ctx.drawImage(currentSprite, drawX, drawY, drawW, drawH);
            }
            
            this.drawStaminaBar(); 
            ctx.restore();
            
        } else {
            ctx.fillStyle = this.isFlipped ? 'gray' : 'red'; ctx.fillRect(this.x, this.y, this.initialWidth, this.initialHeight); 
        }
    }

    update() {
        
        // Lógica de Rotação (360 Spin)
        if (this.isRotating) {
            this.rotationTimer--;
            this.rotationAngle += (2 * Math.PI) / this.rotationDuration; 
            this.flickerCounter++;
            
            if (this.rotationTimer <= 0) {
                this.isRotating = false;
                this.rotationAngle = 0;
                this.invulnerabilityTimer = 30; // Tempo de invulnerabilidade após o giro
            }
            return; 
        }

        // PULO COM CONTADOR
        if (keys.jump && !this.isJumping && !this.isFlipped && currentJumps > 0) { 
            this.isJumping = true; this.jumpProgress = 0; currentJumps--; keys.jump = false; 
            if (currentJumps === 0) {
                isCooldownActive = true; cooldownStartTime = Date.now();
            }
        }
        
        // Lógica da Animação de Pulo
        if (this.isJumping) {
            this.dipProgress = 0; 
            this.isDipping = false; 
            
            this.jumpProgress += 1 / this.jumpDuration; 
            if (this.jumpProgress >= 1) {
                this.isJumping = false; this.jumpProgress = 0; this.jumpYOffset = 0; 
            } else {
                const jumpCurve = Math.sin(this.jumpProgress * Math.PI);
                this.jumpYOffset = jumpCurve * (this.initialHeight * this.jumpHeightMultiplier);
            }
        } 
        
        // Lógica da Animação de Mergulho (Dip)
        if (this.isDipping) {
            this.jumpProgress = 0; 
            this.isJumping = false; 
            
            this.dipProgress += 1 / this.dipDuration; 
            if (this.dipProgress >= 1) {
                this.isDipping = false; this.dipProgress = 0; 
            }
        }
        
        // Se nenhuma animação estiver ativa, resetar offsets
        if (!this.isJumping) {
            this.jumpYOffset = 0;
        } 


        // MOVIMENTO
        this.speedY = (!this.isJumping && !this.isDipping) ? (keys.up ? -this.maxSpeed : (keys.down ? this.maxSpeed : 0)) : 0;
        this.y += this.speedY;
        this.speedX = keys.left ? -this.maxSpeed : (keys.right ? this.maxSpeed : 0);
        this.x += this.speedX;

        // STAMINA (Mergulho)
        if (keys.space && this.stamina > 0 && !this.isJumping && !this.isDipping) { 
            this.stamina = Math.max(0, this.stamina - this.staminaDrainRate); 
            this.isFlipped = true;
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaChargeRate); 
            this.isFlipped = false;
        }
        
        // INVULNERABILIDADE
        if (this.isInvulnerable) {
            this.invulnerabilityTimer--; this.flickerCounter++;
            if (this.invulnerabilityTimer <= 0) { this.isInvulnerable = false; this.flickerCounter = 0; }
        }
        
        // LIMITES DA TELA
        this.x = Math.max(0, Math.min(this.x, canvas.width - this.initialWidth)); 
        this.y = Math.max(0, Math.min(this.y, canvas.height - this.initialHeight)); 
        speedDisplay.textContent = RIVER_SPEED.toFixed(1);
    }
}

class Obstacle {
    constructor(x, y, width, height, type) {
        this.x = x; this.y = y; this.width = width; this.height = height; this.type = type;
        this.renderWidth = width; this.renderHeight = height; this.renderX = x; this.renderY = y;

        if (type === 'whirlpool') {
            const RENDER_W = 483; const RENDER_H = 250;
            const centerX = this.x + (this.width / 2); 
            this.renderWidth = RENDER_W; this.renderHeight = RENDER_H;
            this.renderX = centerX - (RENDER_W / 2); this.renderY = this.y - (RENDER_H / 2);
        } else if (type === 'lowbridge') { 
            this.renderWidth = canvas.width; this.renderHeight = height; 
            this.renderX = 0; this.renderY = y;
        }
    }
    
    draw() {
        let imgToDraw = images[this.type];
        if (imgToDraw) {
            ctx.drawImage(imgToDraw, this.renderX, this.renderY, this.renderWidth, this.renderHeight);
        } else {
            ctx.fillStyle = (this.type === 'whirlpool') ? 'rgba(255, 0, 0, 0.4)' : (this.type === 'starfish' ? 'yellow' : (this.type === 'lowbridge' ? 'brown' : 'gray')); 
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(this.type, this.x + 5, this.y + this.height / 2);
        }
    }

    update() { 
        this.y += RIVER_SPEED; 
        this.renderY += RIVER_SPEED;
    }
}

const player = new Kayak(canvas.width / 2 - 40, canvas.height - 100, 80, 110);


// =================================================================
// --- 4. FUNÇÕES AUXILIARES ---
// =================================================================

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}

function causeDamage() {
    // ROTAÇÃO 360
    lives--; 
    livesDisplay.textContent = lives;
    
    // Inicia a rotação
    player.isRotating = true;
    player.rotationTimer = player.rotationDuration;
    player.rotationAngle = 0;
    player.isInvulnerable = true; 

    if (lives <= 0) { 
        gameOver = true; 
        if (score > highScore) { highScore = score; } 
    }
}

function handleCollision(obstacle, index) {
    
    // --- LÓGICA DE ITENS (Não causam dano) ---
    if (obstacle.type === 'starfish') {
        obstacles.splice(index, 1); // Starfish é consumível, deve ser removido.
        if (lives < 3) { lives++; livesDisplay.textContent = lives; } else { score += 50; distance += 50; }
        return; 
    }
    
    // Se o jogador estiver invulnerável (girando ou pós-giro), ignora a colisão de dano
    if (player.isRotating || player.isInvulnerable) return;
    
    // Se estiver em animação de pulo/mergulho, ignora se for desvio
    if (player.isJumping || player.isDipping) return;

    // --- LÓGICA DE DESVIO ---

    // LÓGICA 1: Cachoeira (Passagem AUTOMÁTICA)
    if (obstacle.type === 'waterfall') {
        // SUCESSO: Ativa o boost de velocidade e animação de Dip
        waterfallSpeedBoostTimer = 180; 
        player.isDipping = true;
        player.dipProgress = 0;
        // Não causa dano. Obstáculo permanece e rola para fora da tela.
        return;
    }
    
    // LÓGICA 2: Ponte Baixa (SÓ pode ser desviada com Mergulho/Flipped)
    if (obstacle.type === 'lowbridge') {
        if (player.isFlipped) {
            return; // Desvio com sucesso. Obstáculo permanece.
        }
        // FALHA: Passa para a colisão padrão (causa dano).
    }
    
    // LÓGICA 3: Pulo (Passa por cima)
    const isJumpable = obstacle.type !== 'whirlpool' && obstacle.type !== 'lowbridge';
    if (player.isJumping && isJumpable) { 
        return; // Desvio com sucesso. Obstáculo permanece.
    }
    
    // LÓGICA 4: Colisão Padrão (Tudo que sobrou, incluindo tentativa falha de mergulho, causa dano com rotação)
    causeDamage();
    obstacles.splice(index, 1); // Obstáculo removido após causar dano (simula destruição/desvio)
}

function isOverlapping(newObstacle) {
    const minDistance = 20; 
    for (const existingObstacle of obstacles) {
        const existingHitbox = {
            x: existingObstacle.x - minDistance, y: existingObstacle.y - minDistance,
            width: existingObstacle.width + (minDistance * 2), height: existingObstacle.height + (minDistance * 2)
        };
        const newHitbox = {
            x: newObstacle.x - minDistance, y: newObstacle.y - minDistance,
            width: newObstacle.width + (minDistance * 2), height: newObstacle.height + (minDistance * 2)
        };
        if (checkCollision(newHitbox, existingHitbox)) { return true; }
    }
    return false;
}

function createObstacle() {
    let width, height, x, type;
    const currentTime = Date.now();
    const RND = Math.random();
    
    if (currentTime - lastWaterfallTime > WATERFALL_COOLDOWN_MS && RND < 0.08) {
        type = 'waterfall'; lastWaterfallTime = currentTime; 
    } else if (RND < 0.03) { type = 'starfish'; } 
    else if (RND < 0.06) { type = 'lowbridge'; } 
    else if (RND < 0.09) { type = 'whirlpool'; } 
    else {
        const defaultTypes = ['log', 'log', 'log', 'log', 'rock', 'rock', 'fish', 'fisherman']; 
        type = defaultTypes[Math.floor(Math.random() * defaultTypes.length)];
    }
    
    switch (type) {
        case 'fish': width = 80; height = 38; break;
        case 'log':
            let baseWidth = 120; let baseHeight = 61;
            let scaleFactor = Math.random() * (1.5 - 0.8) + 0.8; 
            width = baseWidth * scaleFactor; height = baseHeight * scaleFactor; break;
        case 'fisherman': width = 51; height = 115; break;
        case 'waterfall': width = canvas.width; height = 97; x = 0; break;
        case 'rock': width = 40; height = 40; break;
        case 'whirlpool': width = 100; height = 100; break;
        case 'starfish': width = 60; height = 60; break;
        case 'lowbridge': width = canvas.width; height = 80; x = 0; break; 
        default: width = 50; height = 50; break;
    }

    let attempt = 0;
    let newObstacle;
    
    do {
        x = (type === 'waterfall' || type === 'lowbridge') ? 0 : Math.random() * (canvas.width - width);
        const y = -height; 
        newObstacle = { x, y, width, height, type };
        attempt++;
        if (attempt > 10) return; 
    } while (isOverlapping(newObstacle));

    obstacles.push(new Obstacle(newObstacle.x, newObstacle.y, newObstacle.width, newObstacle.height, newObstacle.type));
}

function drawRiverAnimation() {
    ctx.fillStyle = RIVER_COLOR; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    waterLineYOffset += RIVER_SPEED * 0.7; 
    if (waterLineYOffset >= WATER_LINE_HEIGHT) { waterLineYOffset = 0; }

    ctx.lineWidth = 1;
    for (let y = -WATER_LINE_HEIGHT; y < canvas.height + WATER_LINE_HEIGHT; y += WATER_LINE_HEIGHT) {
        // Linha 1 (Branca suave)
        ctx.strokeStyle = LINE_COLOR_1;
        ctx.beginPath();
        ctx.moveTo(0, y + waterLineYOffset);
        ctx.bezierCurveTo(canvas.width / 4, y + waterLineYOffset + 5, 
                           canvas.width * 3 / 4, y + waterLineYOffset - 5, 
                           canvas.width, y + waterLineYOffset);
        ctx.stroke();

        // Linha 2 (Azul neon)
        ctx.strokeStyle = LINE_COLOR_2; 
        ctx.beginPath();
        ctx.moveTo(0, y + waterLineYOffset + WATER_LINE_HEIGHT / 2);
        ctx.bezierCurveTo(canvas.width / 4, y + waterLineYOffset + WATER_LINE_HEIGHT / 2 - 5, 
                           canvas.width * 3 / 4, y + waterLineYOffset + WATER_LINE_HEIGHT / 2 + 5, 
                           canvas.width, y + waterLineYOffset + WATER_LINE_HEIGHT / 2);
        ctx.stroke();
    }
}

function checkSpeedIncrease() {
    const currentTime = Date.now();
    let currentSpeed = BASE_RIVER_SPEED; 
    
    // --- LÓGICA CORRIGIDA: Usa o tempo total de jogo ---
    const elapsedTime = currentTime - gameStartTime;
    
    // Calcula quantos aumentos de 0.5 deveriam ter ocorrido
    const speedIncreases = Math.floor(elapsedTime / SPEED_INCREASE_INTERVAL_MS);

    // A nova velocidade base é 3.0 + (aumentos * 0.5)
    currentSpeed = BASE_RIVER_SPEED + (speedIncreases * 0.5); 
    
    // Efeito do Boost de Cachoeira
    if (waterfallSpeedBoostTimer > 0) {
        currentSpeed += 2.0;
        waterfallSpeedBoostTimer--;
    }
    
    RIVER_SPEED = currentSpeed;
}

function updateJumpCooldown() {
    if (!isCooldownActive) {
        jumpsDisplay.textContent = currentJumps; return;
    }
    const elapsedSeconds = Math.floor((Date.now() - cooldownStartTime) / 1000);
    const remainingSeconds = JUMP_COOLDOWN_SECONDS - elapsedSeconds;

    if (remainingSeconds <= 0) {
        currentJumps = MAX_JUMPS; isCooldownActive = false; jumpsDisplay.textContent = currentJumps;
    } else {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        jumpsDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
}


function resetGame() {
    lives = 3; 
    score = 0; 
    distance = 0;
    
    // Reset da velocidade e dos timers
    RIVER_SPEED = BASE_RIVER_SPEED; 
    gameStartTime = Date.now(); // FIX CRÍTICO: Inicia o cronômetro para o cálculo de dificuldade
    waterfallSpeedBoostTimer = 0; // FIX CRÍTICO: Reseta o boost de velocidade
    
    gameOver = false; 
    obstacles = [];
    
    livesDisplay.textContent = lives; 
    scoreDisplay.textContent = score; 
    speedDisplay.textContent = RIVER_SPEED.toFixed(1);
    
    // Resetar estados complexos do Kayak
    player.isInvulnerable = false; player.stamina = player.maxStamina; 
    player.isDipping = false; player.isJumping = false;
    player.isRotating = false; player.rotationTimer = 0;
    
    lastWaterfallTime = 0; 

    player.x = canvas.width / 2 - player.initialWidth / 2; 
    player.y = canvas.height - 100; 
    player.jumpYOffset = 0;
    
    currentJumps = MAX_JUMPS;
    isCooldownActive = false; 
    jumpsDisplay.textContent = currentJumps;

    isMenuOpen = false;
    if (menuScreen) { menuScreen.style.display = 'none'; }
}

function showMenu() {
    isMenuOpen = true;
    if (menuScreen) {
        if (score > highScore) { highScore = score; } 
        menuScreen.style.display = 'flex';
        highScoreDisplay.textContent = `Recorde: ${highScore}`;
    }
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}


// =================================================================
// --- 5. LÓGICA PRINCIPAL DO JOGO (gameLoop) ---
// =================================================================

function gameLoop() {
    
    if (isMenuOpen) { return; }
    
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '40px Arial Black'; ctx.textAlign = 'center';
        ctx.fillText('FIM DE JOGO!', canvas.width / 2, canvas.height / 2 - 20);
        // MENSAGEM: Pressionar ENTER ou ESC volta para o Menu
        ctx.font = '20px Arial'; ctx.fillText('Pressione ENTER para Menu', canvas.width / 2, canvas.height / 2 + 30);
        
        animationFrameId = requestAnimationFrame(gameLoop); 
        return; 
    }
    
    drawRiverAnimation(); 
    
    updateJumpCooldown(); 
    checkSpeedIncrease(); // Lógica de velocidade revisada
    player.update();
    
    if (Math.random() < 0.01 + (RIVER_SPEED * 0.005)) { createObstacle(); }

    const playerHitbox = { 
        x: player.x + 10, 
        y: player.y + 10 - player.jumpYOffset, 
        width: player.initialWidth - 20, 
        height: player.initialHeight - 20 
    };

    // Desenha obstáculos que devem ficar ATRÁS do jogador
    obstacles.forEach(obstacle => {
        if (obstacle.type !== 'lowbridge') {
            obstacle.draw();
        }
    });

    player.draw();

    // Desenha a ponte baixa DEPOIS do jogador (sempre por cima)
    obstacles.forEach(obstacle => {
        if (obstacle.type === 'lowbridge') {
            obstacle.draw();
        }
    });

    // Verifica Colisão e Atualiza Obstáculos
    obstacles.forEach((obstacle, index) => {
        obstacle.update();
        if (checkCollision(playerHitbox, obstacle)) { handleCollision(obstacle, index); }
    });

    // Filtra para remover apenas o que saiu da tela
    obstacles = obstacles.filter(obstacle => obstacle.y < canvas.height);
    distance += RIVER_SPEED * 0.1; 
    score = Math.floor(distance); 
    scoreDisplay.textContent = score;
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// =================================================================
// --- 6. CONTROLES (Event Listeners) ---
// =================================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true; 
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
    
    if (e.key === 'Shift' || e.key === 'e') keys.jump = true; 
    if (e.key === ' ') keys.space = true;
    
    // AÇÃO FINAL: ENTER ou ESC na tela de Game Over volta para o Menu
    if (gameOver && (e.key === 'Enter' || e.key === 'Escape')) { 
        showMenu(); 
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
    
    if (e.key === 'Shift' || e.key === 'e') keys.jump = false; 
    if (e.key === ' ') keys.space = false;
});

startButton.addEventListener('click', () => {
    if (isMenuOpen) {
        startGame();
    }
});


// =================================================================
// --- 7. INICIAR O JOGO ---
// =================================================================
function startGame() {
    resetGame();
    animationFrameId = requestAnimationFrame(gameLoop); 
}

Promise.all(imageLoadPromises.map(p => p.catch(e => e))) 
    .then(() => {
        console.log('Tentativa de carregamento de imagens concluída. Exibindo Menu.');
        showMenu();
        requestAnimationFrame(gameLoop); 
    });