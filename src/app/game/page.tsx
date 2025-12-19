'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.8;
const FRICTION = 0.8;
const TILE_SIZE = 40;

// Larry's properties
const LARRY_WIDTH = 32;
const LARRY_HEIGHT = 48;
const LARRY_SPEED = 5;
const LARRY_JUMP_FORCE = -15;
const LARRY_BIG_HEIGHT = 64;

// Colors
const COLORS = {
  sky: '#5c94fc',
  ground: '#8B4513',
  brick: '#c84c0c',
  questionBlock: '#ffc107',
  questionBlockHit: '#8B4513',
  pipe: '#00a800',
  pipeDark: '#008000',
  coin: '#ffd700',
  larryShirt: '#1e90ff',
  larryPants: '#4169e1',
  larrySkin: '#ffdab9',
  larryHair: '#8b4513',
  goomba: '#8B4513',
  goombaFeet: '#000',
  koopa: '#00a800',
  koopaShell: '#f0e68c',
  mushroom: '#ff0000',
  mushroomSpots: '#fff',
  star: '#ffd700',
  flagPole: '#808080',
  flag: '#00ff00',
  castle: '#808080',
  cloud: '#fff',
  bush: '#228b22',
  hill: '#6b8e23',
};

// Entity types
type EntityType = 'brick' | 'question' | 'ground' | 'pipe' | 'flag' | 'castle';
type EnemyType = 'goomba' | 'koopa';
type PowerUpType = 'mushroom' | 'star' | 'coin';

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  type: EntityType;
  hit?: boolean;
  contents?: PowerUpType;
}

interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  type: EnemyType;
  vx: number;
  vy: number;
  dead: boolean;
  deadTimer?: number;
  isShell?: boolean;
  shellMoving?: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PowerUpType;
  vx: number;
  vy: number;
  emerging?: boolean;
  emergeY?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface Larry {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facingRight: boolean;
  big: boolean;
  star: boolean;
  starTimer: number;
  invincible: boolean;
  invincibleTimer: number;
  dead: boolean;
  won: boolean;
  animFrame: number;
}

// Level data generator
function generateLevel(levelNum: number): {
  entities: Entity[];
  enemies: Enemy[];
  coins: { x: number; y: number; collected: boolean }[];
  startX: number;
  endX: number;
} {
  const entities: Entity[] = [];
  const enemies: Enemy[] = [];
  const coins: { x: number; y: number; collected: boolean }[] = [];

  const levelLength = 3200 + levelNum * 800;

  // Ground
  for (let x = 0; x < levelLength; x += TILE_SIZE) {
    // Add gaps in ground for pits
    const isPit = (x > 600 && x < 720) ||
                  (x > 1400 && x < 1560) ||
                  (x > 2200 + levelNum * 200 && x < 2360 + levelNum * 200);

    if (!isPit) {
      entities.push({
        x,
        y: CANVAS_HEIGHT - TILE_SIZE * 2,
        width: TILE_SIZE,
        height: TILE_SIZE * 2,
        type: 'ground',
      });
    }
  }

  // Question blocks with contents
  const questionBlocks = [
    { x: 320, y: CANVAS_HEIGHT - TILE_SIZE * 6, contents: 'coin' as PowerUpType },
    { x: 400, y: CANVAS_HEIGHT - TILE_SIZE * 6, contents: 'mushroom' as PowerUpType },
    { x: 440, y: CANVAS_HEIGHT - TILE_SIZE * 6, contents: 'coin' as PowerUpType },
    { x: 480, y: CANVAS_HEIGHT - TILE_SIZE * 6, contents: 'coin' as PowerUpType },
    { x: 400, y: CANVAS_HEIGHT - TILE_SIZE * 10, contents: 'star' as PowerUpType },
    { x: 1000, y: CANVAS_HEIGHT - TILE_SIZE * 6, contents: 'mushroom' as PowerUpType },
    { x: 1600, y: CANVAS_HEIGHT - TILE_SIZE * 6, contents: 'coin' as PowerUpType },
    { x: 2000, y: CANVAS_HEIGHT - TILE_SIZE * 8, contents: 'mushroom' as PowerUpType },
  ];

  questionBlocks.forEach(qb => {
    entities.push({
      x: qb.x,
      y: qb.y,
      width: TILE_SIZE,
      height: TILE_SIZE,
      type: 'question',
      hit: false,
      contents: qb.contents,
    });
  });

  // Brick blocks
  const brickPositions = [
    { x: 360, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 520, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 800, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 840, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 880, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 920, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 1200, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 1240, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 1280, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 1800, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
    { x: 1840, y: CANVAS_HEIGHT - TILE_SIZE * 6 },
  ];

  brickPositions.forEach(bp => {
    entities.push({
      x: bp.x,
      y: bp.y,
      width: TILE_SIZE,
      height: TILE_SIZE,
      type: 'brick',
    });
  });

  // Pipes
  const pipePositions = [
    { x: 560, height: 2 },
    { x: 920, height: 3 },
    { x: 1320, height: 2 },
    { x: 1720, height: 4 },
    { x: 2400, height: 2 },
  ];

  pipePositions.forEach(pp => {
    entities.push({
      x: pp.x,
      y: CANVAS_HEIGHT - TILE_SIZE * 2 - pp.height * TILE_SIZE,
      width: TILE_SIZE * 2,
      height: pp.height * TILE_SIZE,
      type: 'pipe',
    });
  });

  // Floating platforms
  for (let i = 0; i < 3 + levelNum; i++) {
    const platformX = 1000 + i * 400;
    for (let j = 0; j < 4; j++) {
      entities.push({
        x: platformX + j * TILE_SIZE,
        y: CANVAS_HEIGHT - TILE_SIZE * (8 + (i % 3)),
        width: TILE_SIZE,
        height: TILE_SIZE,
        type: 'brick',
      });
    }
  }

  // Enemies - Goombas
  const goombaPositions = [
    { x: 440, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 640, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 900, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 1100, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 1300, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 1500, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 1900, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
    { x: 2100, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 32 },
  ];

  goombaPositions.forEach(gp => {
    enemies.push({
      x: gp.x,
      y: gp.y,
      width: 32,
      height: 32,
      type: 'goomba',
      vx: -1.5 - levelNum * 0.3,
      vy: 0,
      dead: false,
    });
  });

  // Koopas
  const koopaPositions = [
    { x: 760, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 40 },
    { x: 1600, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 40 },
    { x: 2300, y: CANVAS_HEIGHT - TILE_SIZE * 2 - 40 },
  ];

  koopaPositions.forEach(kp => {
    enemies.push({
      x: kp.x,
      y: kp.y,
      width: 32,
      height: 40,
      type: 'koopa',
      vx: -1.2 - levelNum * 0.2,
      vy: 0,
      dead: false,
      isShell: false,
      shellMoving: false,
    });
  });

  // Coins floating
  const coinPositions = [
    { x: 200, y: CANVAS_HEIGHT - TILE_SIZE * 5 },
    { x: 240, y: CANVAS_HEIGHT - TILE_SIZE * 5 },
    { x: 280, y: CANVAS_HEIGHT - TILE_SIZE * 5 },
    { x: 720, y: CANVAS_HEIGHT - TILE_SIZE * 4 },
    { x: 1050, y: CANVAS_HEIGHT - TILE_SIZE * 9 },
    { x: 1090, y: CANVAS_HEIGHT - TILE_SIZE * 9 },
    { x: 1450, y: CANVAS_HEIGHT - TILE_SIZE * 9 },
    { x: 1490, y: CANVAS_HEIGHT - TILE_SIZE * 9 },
    { x: 1850, y: CANVAS_HEIGHT - TILE_SIZE * 9 },
  ];

  coinPositions.forEach(cp => {
    coins.push({ x: cp.x, y: cp.y, collected: false });
  });

  // Flag pole at the end
  entities.push({
    x: levelLength - 200,
    y: CANVAS_HEIGHT - TILE_SIZE * 12,
    width: 10,
    height: TILE_SIZE * 10,
    type: 'flag',
  });

  // Castle
  entities.push({
    x: levelLength - 100,
    y: CANVAS_HEIGHT - TILE_SIZE * 2 - TILE_SIZE * 4,
    width: TILE_SIZE * 4,
    height: TILE_SIZE * 4,
    type: 'castle',
  });

  return {
    entities,
    enemies,
    coins,
    startX: 100,
    endX: levelLength,
  };
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover' | 'levelcomplete'>('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);

  // Game refs to persist across renders
  const gameLoopRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const larryRef = useRef<Larry>({
    x: 100,
    y: CANVAS_HEIGHT - TILE_SIZE * 2 - LARRY_HEIGHT,
    width: LARRY_WIDTH,
    height: LARRY_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: false,
    facingRight: true,
    big: false,
    star: false,
    starTimer: 0,
    invincible: false,
    invincibleTimer: 0,
    dead: false,
    won: false,
    animFrame: 0,
  });
  const cameraRef = useRef({ x: 0 });
  const levelDataRef = useRef(generateLevel(1));
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const animCounterRef = useRef(0);

  // Draw Larry
  const drawLarry = useCallback((ctx: CanvasRenderingContext2D, larry: Larry, camera: { x: number }) => {
    const screenX = larry.x - camera.x;
    const screenY = larry.y;

    // Invincibility flashing
    if (larry.invincible && Math.floor(larry.invincibleTimer / 5) % 2 === 0) {
      return;
    }

    ctx.save();

    // Star power rainbow effect
    if (larry.star) {
      const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'];
      const colorIndex = Math.floor(larry.starTimer / 5) % colors.length;
      ctx.shadowColor = colors[colorIndex];
      ctx.shadowBlur = 20;
    }

    // Flip if facing left
    if (!larry.facingRight) {
      ctx.translate(screenX + larry.width / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(screenX + larry.width / 2), 0);
    }

    const heightOffset = larry.big ? 16 : 0;

    // Hair (brown)
    ctx.fillStyle = COLORS.larryHair;
    ctx.beginPath();
    ctx.ellipse(screenX + larry.width / 2, screenY + 8, 14, 10, 0, Math.PI, 0);
    ctx.fill();

    // Head (skin)
    ctx.fillStyle = COLORS.larrySkin;
    ctx.beginPath();
    ctx.arc(screenX + larry.width / 2, screenY + 12, 12, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(screenX + larry.width / 2 + 4, screenY + 10, 2, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = COLORS.larrySkin;
    ctx.beginPath();
    ctx.ellipse(screenX + larry.width / 2 + 8, screenY + 14, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Blue shirt
    ctx.fillStyle = larry.star ?
      `hsl(${(larry.starTimer * 10) % 360}, 100%, 50%)` :
      COLORS.larryShirt;
    ctx.fillRect(screenX + 4, screenY + 22, larry.width - 8, larry.big ? 28 : 16);

    // Arms
    const armOffset = Math.sin(larry.animFrame * 0.3) * (larry.vx !== 0 ? 4 : 0);
    ctx.fillRect(screenX - 2, screenY + 24 + armOffset, 6, 12);
    ctx.fillRect(screenX + larry.width - 4, screenY + 24 - armOffset, 6, 12);

    // Hands
    ctx.fillStyle = COLORS.larrySkin;
    ctx.beginPath();
    ctx.arc(screenX + 1, screenY + 36 + armOffset, 4, 0, Math.PI * 2);
    ctx.arc(screenX + larry.width - 1, screenY + 36 - armOffset, 4, 0, Math.PI * 2);
    ctx.fill();

    // Blue pants
    ctx.fillStyle = COLORS.larryPants;
    const pantsY = larry.big ? screenY + 50 : screenY + 38;
    ctx.fillRect(screenX + 6, pantsY, larry.width - 12, larry.big ? 10 : 6);

    // Legs
    const legOffset = Math.sin(larry.animFrame * 0.5) * (larry.vx !== 0 ? 3 : 0);
    ctx.fillRect(screenX + 6, pantsY + (larry.big ? 10 : 6), 8, larry.big ? 12 : 8);
    ctx.fillRect(screenX + larry.width - 14, pantsY + (larry.big ? 10 : 6), 8, larry.big ? 12 : 8);

    // Shoes
    ctx.fillStyle = '#8B4513';
    const shoeY = larry.big ? screenY + 60 : screenY + 44;
    ctx.fillRect(screenX + 4, shoeY + legOffset, 10, 4);
    ctx.fillRect(screenX + larry.width - 14, shoeY - legOffset, 10, 4);

    ctx.restore();
  }, []);

  // Draw entities
  const drawEntity = useCallback((ctx: CanvasRenderingContext2D, entity: Entity, camera: { x: number }) => {
    const screenX = entity.x - camera.x;

    if (screenX < -TILE_SIZE || screenX > CANVAS_WIDTH + TILE_SIZE) return;

    switch (entity.type) {
      case 'ground':
        // Brown ground with texture
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(screenX, entity.y, entity.width, entity.height);

        // Grass on top
        ctx.fillStyle = '#228b22';
        ctx.fillRect(screenX, entity.y, entity.width, 8);

        // Ground detail lines
        ctx.strokeStyle = '#6b4423';
        ctx.lineWidth = 1;
        for (let i = 0; i < entity.width; i += 10) {
          ctx.beginPath();
          ctx.moveTo(screenX + i, entity.y + 10);
          ctx.lineTo(screenX + i + 5, entity.y + entity.height);
          ctx.stroke();
        }
        break;

      case 'brick':
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(screenX, entity.y, entity.width, entity.height);

        // Brick pattern
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, entity.y, entity.width, entity.height);

        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX, entity.y + entity.height / 2);
        ctx.lineTo(screenX + entity.width, entity.y + entity.height / 2);
        ctx.moveTo(screenX + entity.width / 2, entity.y);
        ctx.lineTo(screenX + entity.width / 2, entity.y + entity.height / 2);
        ctx.stroke();
        break;

      case 'question':
        ctx.fillStyle = entity.hit ? COLORS.questionBlockHit : COLORS.questionBlock;
        ctx.fillRect(screenX, entity.y, entity.width, entity.height);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, entity.y, entity.width, entity.height);

        if (!entity.hit) {
          // Question mark
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('?', screenX + entity.width / 2, entity.y + entity.height - 10);

          // Shimmer effect
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(screenX + 4, entity.y + 4, 8, 8);
        }
        break;

      case 'pipe':
        // Pipe body
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(screenX + 4, entity.y + TILE_SIZE, entity.width - 8, entity.height - TILE_SIZE);

        // Pipe top
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(screenX, entity.y, entity.width, TILE_SIZE);

        // Dark edge
        ctx.fillStyle = COLORS.pipeDark;
        ctx.fillRect(screenX, entity.y, 4, TILE_SIZE);
        ctx.fillRect(screenX + 4, entity.y + TILE_SIZE, 4, entity.height - TILE_SIZE);

        // Highlight
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenX + entity.width - 8, entity.y, 4, TILE_SIZE);

        // Pipe rim
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, entity.y, entity.width, TILE_SIZE);
        break;

      case 'flag':
        // Flag pole
        ctx.fillStyle = COLORS.flagPole;
        ctx.fillRect(screenX, entity.y, entity.width, entity.height);

        // Flag ball on top
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(screenX + entity.width / 2, entity.y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Flag
        ctx.fillStyle = COLORS.flag;
        ctx.beginPath();
        ctx.moveTo(screenX + entity.width, entity.y + 10);
        ctx.lineTo(screenX + entity.width + 50, entity.y + 30);
        ctx.lineTo(screenX + entity.width, entity.y + 50);
        ctx.closePath();
        ctx.fill();

        // Flag detail
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText('L', screenX + entity.width + 20, entity.y + 35);
        break;

      case 'castle':
        // Castle base
        ctx.fillStyle = COLORS.castle;
        ctx.fillRect(screenX, entity.y, entity.width, entity.height);

        // Castle door
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX + entity.width / 2 - 15, entity.y + entity.height - 50, 30, 50);

        // Castle windows
        ctx.fillRect(screenX + 15, entity.y + 20, 15, 20);
        ctx.fillRect(screenX + entity.width - 30, entity.y + 20, 15, 20);

        // Castle top crenellations
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = COLORS.castle;
          ctx.fillRect(screenX + i * (entity.width / 4), entity.y - 20, entity.width / 5, 20);
        }

        // Flag on castle
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(screenX + entity.width / 2, entity.y - 50, 3, 30);
        ctx.beginPath();
        ctx.moveTo(screenX + entity.width / 2 + 3, entity.y - 50);
        ctx.lineTo(screenX + entity.width / 2 + 25, entity.y - 40);
        ctx.lineTo(screenX + entity.width / 2 + 3, entity.y - 30);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }, []);

  // Draw enemy
  const drawEnemy = useCallback((ctx: CanvasRenderingContext2D, enemy: Enemy, camera: { x: number }) => {
    const screenX = enemy.x - camera.x;

    if (screenX < -TILE_SIZE || screenX > CANVAS_WIDTH + TILE_SIZE) return;

    if (enemy.type === 'goomba') {
      if (enemy.dead) {
        // Squished goomba
        ctx.fillStyle = COLORS.goomba;
        ctx.fillRect(screenX, enemy.y + enemy.height - 8, enemy.width, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX + 6, enemy.y + enemy.height - 6, 4, 2);
        ctx.fillRect(screenX + enemy.width - 10, enemy.y + enemy.height - 6, 4, 2);
      } else {
        // Goomba body
        ctx.fillStyle = COLORS.goomba;
        ctx.beginPath();
        ctx.ellipse(screenX + enemy.width / 2, enemy.y + enemy.height / 2 + 4, enemy.width / 2, enemy.height / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Goomba feet
        ctx.fillStyle = COLORS.goombaFeet;
        const footOffset = Math.sin(animCounterRef.current * 0.2) * 2;
        ctx.fillRect(screenX + 2, enemy.y + enemy.height - 6 + footOffset, 10, 6);
        ctx.fillRect(screenX + enemy.width - 12, enemy.y + enemy.height - 6 - footOffset, 10, 6);

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(screenX + enemy.width / 2 - 6, enemy.y + 10, 5, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(screenX + enemy.width / 2 + 6, enemy.y + 10, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + enemy.width / 2 - 5, enemy.y + 12, 2, 0, Math.PI * 2);
        ctx.arc(screenX + enemy.width / 2 + 7, enemy.y + 12, 2, 0, Math.PI * 2);
        ctx.fill();

        // Eyebrows (angry)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + enemy.width / 2 - 10, enemy.y + 4);
        ctx.lineTo(screenX + enemy.width / 2 - 2, enemy.y + 8);
        ctx.moveTo(screenX + enemy.width / 2 + 10, enemy.y + 4);
        ctx.lineTo(screenX + enemy.width / 2 + 2, enemy.y + 8);
        ctx.stroke();
      }
    } else if (enemy.type === 'koopa') {
      if (enemy.isShell) {
        // Shell
        ctx.fillStyle = COLORS.koopa;
        ctx.beginPath();
        ctx.ellipse(screenX + enemy.width / 2, enemy.y + 16, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shell pattern
        ctx.fillStyle = COLORS.koopaShell;
        ctx.beginPath();
        ctx.ellipse(screenX + enemy.width / 2, enemy.y + 16, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = COLORS.koopa;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + enemy.width / 2 - 8, enemy.y + 12);
        ctx.lineTo(screenX + enemy.width / 2 + 8, enemy.y + 20);
        ctx.moveTo(screenX + enemy.width / 2 + 8, enemy.y + 12);
        ctx.lineTo(screenX + enemy.width / 2 - 8, enemy.y + 20);
        ctx.stroke();
      } else {
        // Koopa body
        ctx.fillStyle = COLORS.koopa;

        // Shell (back)
        ctx.beginPath();
        ctx.ellipse(screenX + enemy.width / 2, enemy.y + 24, 14, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shell pattern
        ctx.fillStyle = COLORS.koopaShell;
        ctx.beginPath();
        ctx.ellipse(screenX + enemy.width / 2, enemy.y + 24, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#90EE90';
        ctx.beginPath();
        ctx.arc(screenX + enemy.width / 2 + (enemy.vx > 0 ? 8 : -8), enemy.y + 8, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(screenX + enemy.width / 2 + (enemy.vx > 0 ? 12 : -4), enemy.y + 6, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + enemy.width / 2 + (enemy.vx > 0 ? 13 : -3), enemy.y + 7, 2, 0, Math.PI * 2);
        ctx.fill();

        // Feet
        ctx.fillStyle = '#90EE90';
        const koopaFootOffset = Math.sin(animCounterRef.current * 0.2) * 3;
        ctx.fillRect(screenX + 4, enemy.y + enemy.height - 8 + koopaFootOffset, 10, 8);
        ctx.fillRect(screenX + enemy.width - 14, enemy.y + enemy.height - 8 - koopaFootOffset, 10, 8);
      }
    }
  }, []);

  // Draw power-up
  const drawPowerUp = useCallback((ctx: CanvasRenderingContext2D, powerUp: PowerUp, camera: { x: number }) => {
    const screenX = powerUp.x - camera.x;

    if (powerUp.type === 'mushroom') {
      // Mushroom cap
      ctx.fillStyle = COLORS.mushroom;
      ctx.beginPath();
      ctx.arc(screenX + powerUp.width / 2, powerUp.y + 10, 14, Math.PI, 0);
      ctx.fill();

      // White spots
      ctx.fillStyle = COLORS.mushroomSpots;
      ctx.beginPath();
      ctx.arc(screenX + powerUp.width / 2 - 6, powerUp.y + 6, 4, 0, Math.PI * 2);
      ctx.arc(screenX + powerUp.width / 2 + 6, powerUp.y + 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Stem
      ctx.fillStyle = '#fff';
      ctx.fillRect(screenX + powerUp.width / 2 - 8, powerUp.y + 10, 16, 14);

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(screenX + powerUp.width / 2 - 4, powerUp.y + 16, 2, 0, Math.PI * 2);
      ctx.arc(screenX + powerUp.width / 2 + 4, powerUp.y + 16, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerUp.type === 'star') {
      const pulse = Math.sin(animCounterRef.current * 0.2) * 2;

      // Star glow
      ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(animCounterRef.current * 0.1) * 0.2})`;
      ctx.beginPath();
      ctx.arc(screenX + powerUp.width / 2, powerUp.y + powerUp.height / 2, 20 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Star shape
      ctx.fillStyle = COLORS.star;
      ctx.beginPath();
      const cx = screenX + powerUp.width / 2;
      const cy = powerUp.y + powerUp.height / 2;
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + Math.cos(angle) * (12 + pulse);
        const y = cy + Math.sin(angle) * (12 + pulse);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Star eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerUp.type === 'coin') {
      const wobble = Math.sin(animCounterRef.current * 0.3) * 3;

      // Coin shine
      ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(screenX + powerUp.width / 2, powerUp.y + powerUp.height / 2, 14, 0, Math.PI * 2);
      ctx.fill();

      // Coin body
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.ellipse(screenX + powerUp.width / 2, powerUp.y + powerUp.height / 2, 10 + wobble, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Coin detail
      ctx.strokeStyle = '#daa520';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(screenX + powerUp.width / 2, powerUp.y + powerUp.height / 2, 6 + wobble * 0.5, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  // Draw coin
  const drawCoin = useCallback((ctx: CanvasRenderingContext2D, coin: { x: number; y: number; collected: boolean }, camera: { x: number }) => {
    if (coin.collected) return;

    const screenX = coin.x - camera.x;
    const wobble = Math.sin(animCounterRef.current * 0.2 + coin.x * 0.1);

    // Coin body
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.ellipse(screenX + 12, coin.y + 12, 8 * Math.abs(wobble) + 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(screenX + 10, coin.y + 8, 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Draw background elements
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, camera: { x: number }) => {
    // Sky
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Clouds (parallax)
    const cloudPositions = [100, 400, 700, 1100, 1500, 1900, 2300, 2700, 3100];
    cloudPositions.forEach((cloudX, i) => {
      const screenX = cloudX - camera.x * 0.3;
      const wrappedX = ((screenX % (CANVAS_WIDTH + 200)) + CANVAS_WIDTH + 200) % (CANVAS_WIDTH + 200) - 100;
      const cloudY = 60 + (i % 3) * 40;

      ctx.fillStyle = COLORS.cloud;
      ctx.beginPath();
      ctx.arc(wrappedX, cloudY, 30, 0, Math.PI * 2);
      ctx.arc(wrappedX + 30, cloudY - 10, 25, 0, Math.PI * 2);
      ctx.arc(wrappedX + 60, cloudY, 30, 0, Math.PI * 2);
      ctx.arc(wrappedX + 30, cloudY + 5, 20, 0, Math.PI * 2);
      ctx.fill();
    });

    // Hills (parallax)
    const hillPositions = [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000];
    hillPositions.forEach((hillX, i) => {
      const screenX = hillX - camera.x * 0.5;
      const wrappedX = ((screenX % (CANVAS_WIDTH + 400)) + CANVAS_WIDTH + 400) % (CANVAS_WIDTH + 400) - 200;
      const hillHeight = 60 + (i % 2) * 30;

      ctx.fillStyle = COLORS.hill;
      ctx.beginPath();
      ctx.moveTo(wrappedX - 100, CANVAS_HEIGHT - TILE_SIZE * 2);
      ctx.quadraticCurveTo(wrappedX, CANVAS_HEIGHT - TILE_SIZE * 2 - hillHeight, wrappedX + 100, CANVAS_HEIGHT - TILE_SIZE * 2);
      ctx.fill();
    });

    // Bushes
    const bushPositions = [150, 500, 850, 1200, 1550, 1900, 2250, 2600, 2950];
    bushPositions.forEach((bushX, i) => {
      const screenX = bushX - camera.x * 0.7;
      const wrappedX = ((screenX % (CANVAS_WIDTH + 300)) + CANVAS_WIDTH + 300) % (CANVAS_WIDTH + 300) - 150;

      ctx.fillStyle = COLORS.bush;
      ctx.beginPath();
      ctx.arc(wrappedX, CANVAS_HEIGHT - TILE_SIZE * 2 - 10, 20, Math.PI, 0);
      ctx.arc(wrappedX + 25, CANVAS_HEIGHT - TILE_SIZE * 2 - 15, 18, Math.PI, 0);
      ctx.arc(wrappedX + 50, CANVAS_HEIGHT - TILE_SIZE * 2 - 10, 20, Math.PI, 0);
      ctx.fill();
    });
  }, []);

  // Draw particles
  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, camera: { x: number }) => {
    particlesRef.current.forEach(particle => {
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.life / 30;
      ctx.fillRect(particle.x - camera.x, particle.y, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
  }, []);

  // Draw HUD
  const drawHUD = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';

    // Score
    ctx.fillText(`SCORE`, 20, 30);
    ctx.fillText(`${scoreRef.current.toString().padStart(6, '0')}`, 20, 55);

    // Coins
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(200, 42, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`x${levelDataRef.current.coins.filter(c => c.collected).length}`, 215, 50);

    // Level
    ctx.fillText(`WORLD`, 350, 30);
    ctx.fillText(`1-${level}`, 350, 55);

    // Lives
    ctx.fillText(`LARRY`, 500, 30);
    ctx.fillText(`x${livesRef.current}`, 500, 55);

    // High Score
    ctx.fillText(`HIGH SCORE`, 650, 30);
    ctx.fillText(`${highScore.toString().padStart(6, '0')}`, 650, 55);
  }, [level, highScore]);

  // Collision detection
  const checkCollision = useCallback((a: { x: number; y: number; width: number; height: number },
                                       b: { x: number; y: number; width: number; height: number }) => {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }, []);

  // Create particles
  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 1) * 8,
        life: 30,
        color,
        size: 4 + Math.random() * 4,
      });
    }
  }, []);

  // Hit block from below
  const hitBlock = useCallback((entity: Entity) => {
    if (entity.type === 'question' && !entity.hit) {
      entity.hit = true;

      if (entity.contents === 'coin') {
        scoreRef.current += 200;
        setScore(scoreRef.current);
        createParticles(entity.x + TILE_SIZE / 2, entity.y, COLORS.coin, 5);
      } else if (entity.contents === 'mushroom' || entity.contents === 'star') {
        // Spawn power-up
        powerUpsRef.current.push({
          x: entity.x,
          y: entity.y,
          width: 28,
          height: 28,
          type: entity.contents,
          vx: entity.contents === 'mushroom' ? 2 : 3,
          vy: 0,
          emerging: true,
          emergeY: entity.y - 28,
        });
      }
    } else if (entity.type === 'brick' && larryRef.current.big) {
      // Break brick
      const index = levelDataRef.current.entities.indexOf(entity);
      if (index > -1) {
        levelDataRef.current.entities.splice(index, 1);
        createParticles(entity.x + TILE_SIZE / 2, entity.y + TILE_SIZE / 2, COLORS.brick, 8);
        scoreRef.current += 50;
        setScore(scoreRef.current);
      }
    }
  }, [createParticles]);

  // Game update loop
  const updateGame = useCallback(() => {
    const larry = larryRef.current;
    const camera = cameraRef.current;
    const levelData = levelDataRef.current;
    const keys = keysRef.current;

    if (larry.dead || larry.won) return;

    animCounterRef.current++;

    // Larry movement
    if (keys.has('ArrowRight') || keys.has('KeyD')) {
      larry.vx = LARRY_SPEED;
      larry.facingRight = true;
    } else if (keys.has('ArrowLeft') || keys.has('KeyA')) {
      larry.vx = -LARRY_SPEED;
      larry.facingRight = false;
    } else {
      larry.vx *= FRICTION;
      if (Math.abs(larry.vx) < 0.1) larry.vx = 0;
    }

    // Jump
    if ((keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')) && larry.onGround) {
      larry.vy = LARRY_JUMP_FORCE;
      larry.onGround = false;
    }

    // Run (increase speed)
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
      larry.vx *= 1.5;
    }

    // Apply gravity
    larry.vy += GRAVITY;
    if (larry.vy > 15) larry.vy = 15;

    // Animation frame
    if (larry.vx !== 0) {
      larry.animFrame++;
    }

    // Update position
    larry.x += larry.vx;
    larry.y += larry.vy;

    // Keep Larry on screen (left boundary)
    if (larry.x < camera.x) {
      larry.x = camera.x;
      larry.vx = 0;
    }

    // Check if fallen into pit
    if (larry.y > CANVAS_HEIGHT + 100) {
      larry.dead = true;
      livesRef.current--;
      setLives(livesRef.current);

      if (livesRef.current <= 0) {
        setGameState('gameover');
      } else {
        // Respawn
        setTimeout(() => {
          larry.x = Math.max(100, camera.x);
          larry.y = CANVAS_HEIGHT - TILE_SIZE * 2 - larry.height;
          larry.vx = 0;
          larry.vy = 0;
          larry.dead = false;
          larry.big = false;
          larry.height = LARRY_HEIGHT;
          larry.invincible = true;
          larry.invincibleTimer = 120;
        }, 1000);
      }
      return;
    }

    // Entity collisions
    larry.onGround = false;

    levelData.entities.forEach(entity => {
      if (!checkCollision(larry, entity)) return;

      // Collision response
      const overlapX = Math.min(larry.x + larry.width - entity.x, entity.x + entity.width - larry.x);
      const overlapY = Math.min(larry.y + larry.height - entity.y, entity.y + entity.height - larry.y);

      if (overlapX < overlapY) {
        // Horizontal collision
        if (larry.x < entity.x) {
          larry.x = entity.x - larry.width;
        } else {
          larry.x = entity.x + entity.width;
        }
        larry.vx = 0;
      } else {
        // Vertical collision
        if (larry.y < entity.y) {
          // Landing on top
          larry.y = entity.y - larry.height;
          larry.vy = 0;
          larry.onGround = true;
        } else {
          // Hitting from below
          larry.y = entity.y + entity.height;
          larry.vy = 0;

          if (entity.type === 'question' || entity.type === 'brick') {
            hitBlock(entity);
          }
        }
      }
    });

    // Enemy collisions
    levelData.enemies.forEach(enemy => {
      if (enemy.dead && enemy.deadTimer && enemy.deadTimer <= 0) return;

      // Update enemy
      if (!enemy.dead) {
        enemy.x += enemy.vx;
        enemy.vy += GRAVITY * 0.5;
        enemy.y += enemy.vy;

        // Enemy-entity collision
        levelData.entities.forEach(entity => {
          if (checkCollision(enemy, entity)) {
            const overlapX = Math.min(enemy.x + enemy.width - entity.x, entity.x + entity.width - enemy.x);
            const overlapY = Math.min(enemy.y + enemy.height - entity.y, entity.y + entity.height - enemy.y);

            if (overlapX < overlapY) {
              enemy.vx *= -1;
              if (enemy.x < entity.x) {
                enemy.x = entity.x - enemy.width;
              } else {
                enemy.x = entity.x + entity.width;
              }
            } else {
              if (enemy.y < entity.y) {
                enemy.y = entity.y - enemy.height;
                enemy.vy = 0;
              }
            }
          }
        });

        // Enemy falls into pit
        if (enemy.y > CANVAS_HEIGHT + 100) {
          enemy.dead = true;
        }
      }

      // Larry-enemy collision
      if (checkCollision(larry, enemy) && !enemy.dead) {
        if (larry.star) {
          // Star power kills enemy
          enemy.dead = true;
          enemy.deadTimer = 30;
          scoreRef.current += 200;
          setScore(scoreRef.current);
          createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff0', 10);
        } else if (larry.vy > 0 && larry.y + larry.height < enemy.y + enemy.height / 2) {
          // Stomp enemy
          if (enemy.type === 'koopa' && !enemy.isShell) {
            enemy.isShell = true;
            enemy.vx = 0;
            enemy.height = 28;
            larry.vy = LARRY_JUMP_FORCE * 0.6;
            scoreRef.current += 100;
            setScore(scoreRef.current);
          } else if (enemy.isShell && !enemy.shellMoving) {
            // Kick shell
            enemy.shellMoving = true;
            enemy.vx = larry.x < enemy.x ? 8 : -8;
            scoreRef.current += 100;
            setScore(scoreRef.current);
          } else {
            enemy.dead = true;
            enemy.deadTimer = 30;
            larry.vy = LARRY_JUMP_FORCE * 0.6;
            scoreRef.current += 100;
            setScore(scoreRef.current);
          }
        } else if (!larry.invincible) {
          // Larry gets hit
          if (larry.big) {
            larry.big = false;
            larry.height = LARRY_HEIGHT;
            larry.invincible = true;
            larry.invincibleTimer = 120;
          } else {
            larry.dead = true;
            livesRef.current--;
            setLives(livesRef.current);

            if (livesRef.current <= 0) {
              setGameState('gameover');
            } else {
              setTimeout(() => {
                larry.x = Math.max(100, camera.x);
                larry.y = CANVAS_HEIGHT - TILE_SIZE * 2 - larry.height;
                larry.vx = 0;
                larry.vy = 0;
                larry.dead = false;
                larry.invincible = true;
                larry.invincibleTimer = 120;
              }, 1000);
            }
          }
        }
      }
    });

    // Update dead enemy timers
    levelData.enemies.forEach(enemy => {
      if (enemy.deadTimer && enemy.deadTimer > 0) {
        enemy.deadTimer--;
      }
    });

    // Power-up updates
    powerUpsRef.current.forEach((powerUp, index) => {
      if (powerUp.emerging) {
        powerUp.y -= 1;
        if (powerUp.y <= powerUp.emergeY!) {
          powerUp.emerging = false;
        }
        return;
      }

      powerUp.x += powerUp.vx;
      powerUp.vy += GRAVITY * 0.5;
      powerUp.y += powerUp.vy;

      // Power-up collision with entities
      levelData.entities.forEach(entity => {
        if (checkCollision(powerUp, entity)) {
          const overlapX = Math.min(powerUp.x + powerUp.width - entity.x, entity.x + entity.width - powerUp.x);
          const overlapY = Math.min(powerUp.y + powerUp.height - entity.y, entity.y + entity.height - powerUp.y);

          if (overlapX < overlapY) {
            powerUp.vx *= -1;
          } else if (powerUp.y < entity.y) {
            powerUp.y = entity.y - powerUp.height;
            powerUp.vy = 0;
          }
        }
      });

      // Power-up falls into pit
      if (powerUp.y > CANVAS_HEIGHT + 100) {
        powerUpsRef.current.splice(index, 1);
        return;
      }

      // Larry collects power-up
      if (checkCollision(larry, powerUp)) {
        if (powerUp.type === 'mushroom') {
          if (!larry.big) {
            larry.big = true;
            larry.height = LARRY_BIG_HEIGHT;
            larry.y -= 16;
          }
          scoreRef.current += 1000;
          setScore(scoreRef.current);
        } else if (powerUp.type === 'star') {
          larry.star = true;
          larry.starTimer = 600;
          scoreRef.current += 1000;
          setScore(scoreRef.current);
        } else if (powerUp.type === 'coin') {
          scoreRef.current += 200;
          setScore(scoreRef.current);
        }

        createParticles(powerUp.x, powerUp.y, '#fff', 8);
        powerUpsRef.current.splice(index, 1);
      }
    });

    // Coin collection
    levelData.coins.forEach(coin => {
      if (coin.collected) return;

      const coinBox = { x: coin.x, y: coin.y, width: 24, height: 24 };
      if (checkCollision(larry, coinBox)) {
        coin.collected = true;
        scoreRef.current += 200;
        setScore(scoreRef.current);
        createParticles(coin.x, coin.y, COLORS.coin, 5);
      }
    });

    // Star timer
    if (larry.star) {
      larry.starTimer--;
      if (larry.starTimer <= 0) {
        larry.star = false;
      }
    }

    // Invincibility timer
    if (larry.invincible) {
      larry.invincibleTimer--;
      if (larry.invincibleTimer <= 0) {
        larry.invincible = false;
      }
    }

    // Update particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.3;
      particle.life--;
      return particle.life > 0;
    });

    // Flag collision (level complete)
    const flag = levelData.entities.find(e => e.type === 'flag');
    if (flag && checkCollision(larry, flag)) {
      larry.won = true;
      scoreRef.current += 5000;
      setScore(scoreRef.current);

      // Update high score
      if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
      }

      setTimeout(() => {
        setGameState('levelcomplete');
      }, 2000);
    }

    // Camera follow
    const targetCameraX = larry.x - CANVAS_WIDTH / 3;
    camera.x = Math.max(0, Math.min(targetCameraX, levelData.endX - CANVAS_WIDTH));
  }, [checkCollision, createParticles, hitBlock, highScore]);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const larry = larryRef.current;
    const camera = cameraRef.current;
    const levelData = levelDataRef.current;

    // Draw background
    drawBackground(ctx, camera);

    // Draw entities
    levelData.entities.forEach(entity => drawEntity(ctx, entity, camera));

    // Draw coins
    levelData.coins.forEach(coin => drawCoin(ctx, coin, camera));

    // Draw power-ups
    powerUpsRef.current.forEach(powerUp => drawPowerUp(ctx, powerUp, camera));

    // Draw enemies
    levelData.enemies.forEach(enemy => drawEnemy(ctx, enemy, camera));

    // Draw particles
    drawParticles(ctx, camera);

    // Draw Larry
    if (!larry.dead || larry.y < CANVAS_HEIGHT + 100) {
      drawLarry(ctx, larry, camera);
    }

    // Draw HUD
    drawHUD(ctx);

    // Win message
    if (larry.won) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, CANVAS_HEIGHT / 2 - 50, CANVAS_WIDTH, 100);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL COMPLETE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
    }
  }, [drawBackground, drawEntity, drawCoin, drawPowerUp, drawEnemy, drawParticles, drawLarry, drawHUD]);

  // Game loop
  const gameLoop = useCallback(() => {
    updateGame();
    render();
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, render]);

  // Start game
  const startGame = useCallback((newLevel: number = 1, resetScore: boolean = true) => {
    // Reset Larry
    larryRef.current = {
      x: 100,
      y: CANVAS_HEIGHT - TILE_SIZE * 2 - LARRY_HEIGHT,
      width: LARRY_WIDTH,
      height: LARRY_HEIGHT,
      vx: 0,
      vy: 0,
      onGround: false,
      facingRight: true,
      big: false,
      star: false,
      starTimer: 0,
      invincible: false,
      invincibleTimer: 0,
      dead: false,
      won: false,
      animFrame: 0,
    };

    // Reset camera
    cameraRef.current = { x: 0 };

    // Generate level
    levelDataRef.current = generateLevel(newLevel);

    // Reset power-ups and particles
    powerUpsRef.current = [];
    particlesRef.current = [];

    // Reset score if new game
    if (resetScore) {
      scoreRef.current = 0;
      setScore(0);
      livesRef.current = 3;
      setLives(3);
    }

    setLevel(newLevel);
    setGameState('playing');
  }, []);

  // Next level
  const nextLevel = useCallback(() => {
    startGame(level + 1, false);
  }, [level, startGame]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);

      if (e.code === 'Escape') {
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Game loop management
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-white mb-4">
        <span className="text-blue-400">Larry&apos;s</span> Adventure
      </h1>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-4 border-gray-700 rounded-lg shadow-2xl"
        />

        {/* Menu Overlay */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg">
            <h2 className="text-5xl font-bold text-white mb-2">LARRY&apos;S</h2>
            <h2 className="text-5xl font-bold text-blue-400 mb-8">ADVENTURE</h2>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-24 relative">
                {/* Preview Larry */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-4 bg-amber-800 rounded-t-full"></div>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-[#ffdab9] rounded-full"></div>
                <div className="absolute top-7 left-1/2 -translate-x-1/2 w-7 h-5 bg-blue-500 rounded"></div>
                <div className="absolute top-11 left-1/2 -translate-x-1/2 w-6 h-3 bg-blue-700 rounded"></div>
                <div className="absolute top-14 left-1/2 -translate-x-1/2 w-6 h-2 bg-amber-800 rounded"></div>
              </div>
              <p className="text-xl text-gray-300">Featuring Larry in his signature blue shirt!</p>
            </div>
            <button
              onClick={() => startGame(1)}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-lg transition-colors shadow-lg"
            >
              START GAME
            </button>
            <div className="mt-8 text-gray-400 text-center">
              <p className="mb-2">Controls:</p>
              <p>← → or A D - Move</p>
              <p>↑ or W or SPACE - Jump</p>
              <p>SHIFT - Run</p>
              <p>ESC - Pause</p>
            </div>
          </div>
        )}

        {/* Paused Overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg">
            <h2 className="text-5xl font-bold text-white mb-8">PAUSED</h2>
            <button
              onClick={() => setGameState('playing')}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-lg transition-colors shadow-lg mb-4"
            >
              RESUME
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="px-8 py-4 bg-gray-500 hover:bg-gray-600 text-white text-xl font-bold rounded-lg transition-colors"
            >
              MAIN MENU
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg">
            <h2 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
            <p className="text-2xl text-white mb-2">Final Score: {score}</p>
            <p className="text-xl text-gray-400 mb-8">High Score: {highScore}</p>
            <button
              onClick={() => startGame(1)}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-lg transition-colors shadow-lg mb-4"
            >
              TRY AGAIN
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="px-8 py-4 bg-gray-500 hover:bg-gray-600 text-white text-xl font-bold rounded-lg transition-colors"
            >
              MAIN MENU
            </button>
          </div>
        )}

        {/* Level Complete Overlay */}
        {gameState === 'levelcomplete' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg">
            <h2 className="text-5xl font-bold text-yellow-400 mb-4">LEVEL {level} COMPLETE!</h2>
            <p className="text-2xl text-white mb-2">Score: {score}</p>
            <p className="text-xl text-gray-400 mb-8">Coins: {levelDataRef.current.coins.filter(c => c.collected).length}</p>
            <button
              onClick={nextLevel}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-lg transition-colors shadow-lg mb-4"
            >
              NEXT LEVEL
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="px-8 py-4 bg-gray-500 hover:bg-gray-600 text-white text-xl font-bold rounded-lg transition-colors"
            >
              MAIN MENU
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-500 mt-4 text-sm">
        A classic platformer adventure starring Larry!
      </p>
    </div>
  );
}
