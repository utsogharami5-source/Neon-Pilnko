import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { MultiplierValue } from '../types';
import { soundManager } from '../utils/SoundManager';

interface PlinkoBoardProps {
  rows: number;
  multipliers: MultiplierValue[];
  onLand: (index: number, multiplier: number, betAmount: number) => void;
  ballDropData: { id: string; amount: number } | null;
}

const PlinkoBoard: React.FC<PlinkoBoardProps> = ({ 
  rows, 
  multipliers, 
  onLand, 
  ballDropData
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  
  // Ref for the onLand callback to ensure we always call the latest version from inside the physics engine closure
  const onLandRef = useRef(onLand);
  useEffect(() => {
      onLandRef.current = onLand;
  }, [onLand]);

  // Track trails: Map<BodyID, Array<{x, y}>>
  const trailsRef = useRef<Map<number, Array<{x: number, y: number}>>>(new Map());
  
  // Track last hit for animation
  const activeBucketRef = useRef<{index: number, ts: number} | null>(null);
  const [activeBucket, setActiveBucket] = useState<{index: number, ts: number} | null>(null);
  
  // Board Shake State
  const [isShaking, setIsShaking] = useState(false);
  const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [scale, setScale] = useState(1);
  const [isDropping, setIsDropping] = useState(false);
  
  // Configuration - Scaled Up for Visibility
  const PEG_SPACING = 50; 
  // Dynamic Width Calculation
  // Reduced padding significantly to allow the board to "zoom in" more on mobile
  const minContentWidth = ((rows + 1) * PEG_SPACING); 
  const WIDTH = minContentWidth + 40; // Increased padding slightly for better centering

  const START_Y = 90; // Increased from 60 to create gap between hole and pegs
  const START_X = WIDTH / 2;
  const ROW_SPACING = 45; 
  const PEG_RADIUS = 5; 
  const BALL_RADIUS = 8; 
  
  // Visual Bucket Config - BIGGER BOXES WITH GAPS
  const VISUAL_BUCKET_GAP = 8; 
  const VISUAL_BUCKET_WIDTH = PEG_SPACING - VISUAL_BUCKET_GAP; // 42px
  const VISUAL_BUCKET_HEIGHT = 60; 
  
  // Dynamic Height based on rows
  const boardHeight = START_Y + (rows * ROW_SPACING) + 150; 

  // Handle Responsive Scaling
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
           const availWidth = parent.clientWidth;
           const availHeight = parent.clientHeight;
           
           // Calculate scale based on both width and height to fit perfectly
           const scaleX = availWidth / WIDTH; 
           const scaleY = availHeight / boardHeight; 
           
           // Choose the smaller scale to ensure it fits
           const newScale = Math.min(scaleX, scaleY);
           
           // Allow scaling up to 3x on large screens if there's space (Website Mode)
           setScale(Math.min(newScale, 3.0));
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); 
    
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current?.parentElement) {
        resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
    };
  }, [boardHeight, WIDTH]); // Re-calculate when board dimensions change

  // Initialize Engine
  useEffect(() => {
    if (!sceneRef.current) return;

    // PERFORMANCE: Cap pixel ratio at 2. Mobile devices with 3x or 4x are unnecessary for this game style and kill FPS.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const engine = Matter.Engine.create();
    // Gravity: Reduced to 1.2 for a slower, more deliberate fall
    engine.gravity.y = 1.2; 
    engine.gravity.scale = 0.001;
    
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: WIDTH,
        height: boardHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: pixelRatio,
      },
    });

    engineRef.current = engine;
    renderRef.current = render;

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    // Dynamic Physics Update Loop
    // This allows us to smoothly accelerate the ball instead of using a hard setTimeout
    Matter.Events.on(engine, 'beforeUpdate', () => {
        const bodies = Matter.Composite.allBodies(engine.world);
        bodies.forEach(body => {
            if (body.label === 'ball') {
                // Smoothly reduce air friction as the ball falls
                // Target friction is ~0.02 (Standard/Heavy feel)
                // Start friction is high (0.25)
                const targetFriction = 0.02;
                if (body.frictionAir > targetFriction) {
                    // Decay friction by ~2% per frame
                    // This creates the "The further it falls, the faster it goes" effect
                    body.frictionAir = body.frictionAir * 0.98; 
                }
            }
        });
    });

    // Render Loop for Trails
    Matter.Events.on(render, 'afterRender', () => {
        const ctx = render.context;
        const bodies = Matter.Composite.allBodies(engine.world);

        bodies.forEach(body => {
            if (body.label === 'ball') {
                let trail = trailsRef.current.get(body.id) || [];
                trail.unshift({ x: body.position.x, y: body.position.y });
                // PERFORMANCE: Reduce trail length slightly
                if (trail.length > 15) trail.pop();
                trailsRef.current.set(body.id, trail);
            }
        });

        // Cleanup trails for removed bodies
        trailsRef.current.forEach((_, id) => {
            if (!bodies.find(b => b.id === id)) {
                trailsRef.current.delete(id);
            }
        });

        // Draw Trails
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        trailsRef.current.forEach((trail) => {
            if (trail.length < 2) return;
            for (let i = 0; i < trail.length - 1; i++) {
                const p1 = trail[i];
                const p2 = trail[i+1];
                const alpha = Math.max(0, 1 - (i / trail.length));
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                
                ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.8})`; 
                ctx.lineWidth = BALL_RADIUS * 1.2 * alpha;
                
                ctx.stroke();
            }
        });
    });

    // Collision Logic
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        
        // Check for Peg Collision
        const peg = bodyA.label === 'peg' ? bodyA : bodyB.label === 'peg' ? bodyB : null;
        const ball = bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null;

        if (peg && ball) {
            soundManager.playPegHit();
        }

        // Check for Sensor Collision
        const sensor = bodyA.label.includes('sensor') ? bodyA : bodyB.label.includes('sensor') ? bodyB : null;
        
        if (sensor && ball) {
           const index = parseInt(sensor.label.split('-')[1]);
           const multiplier = parseFloat(sensor.label.split(':')[1]);
           
           // We store the bet amount in the 'plugin' property of the ball body
           const betAmount = (ball as any).plugin?.betAmount || 0;

           if (!ball.isStatic && !(ball as any).isProcessed) { 
             (ball as any).isProcessed = true; 
             Matter.World.remove(engine.world, ball);
             
             // Update ref and state
             const hit = { index, ts: Date.now() };
             activeBucketRef.current = hit;
             setActiveBucket(hit);
             
             // Trigger Shake Animation
             if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
             setIsShaking(true);
             shakeTimeoutRef.current = setTimeout(() => setIsShaking(false), 250);

             // Use the Ref to call the function to prevent stale closures
             if (onLandRef.current) {
                 onLandRef.current(index, multiplier, betAmount);
             }
           }
        }
      });
    });

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      if (render.canvas) render.canvas.remove();
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    };
  }, []); // Initial Engine Create

  // Re-build Board on Prop Change (Rows/Width changes)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Update canvas size safely handling Pixel Ratio to prevent "shifted" or "cropped" view
    if (renderRef.current) {
        // PERFORMANCE: Use the same capped pixel ratio
        const pr = renderRef.current.options.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
        
        renderRef.current.canvas.width = WIDTH * pr;
        renderRef.current.canvas.height = boardHeight * pr;
        renderRef.current.canvas.style.width = `${WIDTH}px`;
        renderRef.current.canvas.style.height = `${boardHeight}px`;
        
        renderRef.current.options.width = WIDTH;
        renderRef.current.options.height = boardHeight;
        
        // Update bounds to match new size
        renderRef.current.bounds.max.x = WIDTH;
        renderRef.current.bounds.max.y = boardHeight;
        
        // Trigger resize handler to update scale immediately
        if (containerRef.current) {
           const event = new Event('resize');
           window.dispatchEvent(event);
        }
    }

    Matter.World.clear(engine.world, false); 

    const bodies: Matter.Body[] = [];
    
    const lastRowIndex = rows - 1;
    const lastRowY = START_Y + lastRowIndex * ROW_SPACING;
    
    // --- PEGS ---
    for (let row = 0; row < rows; row++) {
      const pinsInRow = row + 3;
      const rowWidth = (pinsInRow - 1) * PEG_SPACING;
      // This centers the row exactly in the middle of WIDTH
      const rowX = (WIDTH - rowWidth) / 2;
      const rowY = START_Y + row * ROW_SPACING;

      for (let col = 0; col < pinsInRow; col++) {
        const x = rowX + col * PEG_SPACING;
        const pin = Matter.Bodies.circle(x, rowY, PEG_RADIUS, {
          isStatic: true,
          label: 'peg',
          render: { fillStyle: '#a855f7' }, // Neon Purple
          restitution: 0.1, // Drastically reduced restitution for "dead" impacts
          friction: 0.05 // Added friction to kill lateral momentum (biases center)
        });
        bodies.push(pin);
      }
    }

    // --- SENSORS & DIVIDERS ---
    const pinsInLastRow = lastRowIndex + 3;
    const lastRowWidth = (pinsInLastRow - 1) * PEG_SPACING;
    const lastRowX = (WIDTH - lastRowWidth) / 2;
    
    const sensorY = lastRowY + 50; 

    // Dividers
    for (let col = 0; col < pinsInLastRow; col++) {
        const x = lastRowX + col * PEG_SPACING;
        const dividerHeight = 80; 
        const divider = Matter.Bodies.rectangle(x, lastRowY + dividerHeight/2, 4, dividerHeight, {
            isStatic: true,
            render: { visible: false }, 
            friction: 0.05,
            label: 'divider'
        });
        bodies.push(divider);
    }

    // Sensors
    for (let i = 0; i < multipliers.length; i++) {
        const x = lastRowX + (i * PEG_SPACING) + (PEG_SPACING / 2);
        
        const sensor = Matter.Bodies.rectangle(x, sensorY, PEG_SPACING, 60, {
            isStatic: true,
            isSensor: true, 
            label: `sensor-${i}:${multipliers[i].value}`,
            render: { 
                visible: false,
                fillStyle: 'rgba(255, 0, 0, 0.2)'
            }
        });
        bodies.push(sensor);
    }

    // Walls - Position based on dynamic WIDTH
    const wallHeight = boardHeight * 2;
    const leftWall = Matter.Bodies.rectangle(-20, boardHeight/2, 40, wallHeight, { isStatic: true, render: { visible: false } });
    const rightWall = Matter.Bodies.rectangle(WIDTH + 20, boardHeight/2, 40, wallHeight, { isStatic: true, render: { visible: false } });
    bodies.push(leftWall, rightWall);

    Matter.World.add(engine.world, bodies);
  }, [rows, multipliers, boardHeight, WIDTH]); // Re-run when WIDTH changes


  // Handle Ball Drop
  useEffect(() => {
    if (ballDropData && engineRef.current) {
      setIsDropping(true);
      const timer = setTimeout(() => setIsDropping(false), 200); // Shorter flash

      const randomOffset = (Math.random() - 0.5) * 10; // Keeping narrow spawn window for difficulty
      
      // Spawn ball higher to fall through the hole
      const spawnY = START_Y - 90; 
      
      const ball = Matter.Bodies.circle(START_X + randomOffset, spawnY, BALL_RADIUS, {
        restitution: 0.2, // Reduced bounce
        friction: 0.01, // Increased friction to prevent sliding into wins
        // Initial high air friction makes it fall VERY slowly (like syrup)
        // The beforeUpdate loop will gradually reduce this, causing acceleration
        frictionAir: 0.25, 
        density: 0.08, // Very heavy
        label: 'ball',
        render: { fillStyle: '#ef4444' },
        plugin: { 
            betAmount: ballDropData.amount
        }
      });
      
      // Minimal downward velocity to start the motion
      Matter.Body.setVelocity(ball, { x: 0, y: 1 });

      Matter.World.add(engineRef.current.world, ball);
      
      return () => {
          clearTimeout(timer);
      };
    }
  }, [ballDropData, START_X]); 

  // Calculate position for visual overlay
  const lastRowY = START_Y + (rows - 1) * ROW_SPACING;
  const overlayY = lastRowY + 40; 

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden py-1 sm:py-4">
        {/* Scalable World Container */}
        <div 
            style={{ 
                width: WIDTH, 
                height: boardHeight, 
                transform: `scale(${scale})`, 
                transformOrigin: 'center center' 
            }} 
            className="relative shrink-0 transition-all duration-300 ease-in-out" 
        >
            {/* Shaker Wrapper - Isolates shake animation from scale transform */}
            <div className={`w-full h-full relative ${isShaking ? 'animate-shake' : ''}`}>
                
                {/* Drop Hole Visual - Now Semi-Transparent Glass Style */}
                <div 
                    className={`absolute z-20 rounded-full flex items-center justify-center transition-all duration-100
                        ${isDropping ? 'border-lime-400 scale-105 shadow-[0_0_30px_rgba(132,204,22,0.4)]' : 'border-slate-700 shadow-xl'}
                    `}
                    style={{
                        top: `${START_Y - 80}px`, // Position hole higher
                        left: '50%', // Centers relative to parent which has width WIDTH
                        width: '64px',
                        height: '64px',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(15, 23, 42, 0.4)', // Semi-transparent
                        backdropFilter: 'blur(2px)', 
                    }}
                >
                    {/* Inner Shadow for depth - Glass hole effect */}
                    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.8)] pointer-events-none"></div>
                    
                    {/* Flash Effect */}
                    {isDropping && (
                        <div className="absolute inset-0 rounded-full bg-lime-500/10 animate-ping pointer-events-none"></div>
                    )}
                </div>

                {/* Physics Canvas */}
                <div ref={sceneRef} className="absolute inset-0" />

                {/* 3D Multipliers Overlay */}
                <div 
                    className="absolute flex items-center justify-center z-20 pointer-events-none w-full"
                    style={{ 
                        top: `${overlayY}px`,
                        height: `${VISUAL_BUCKET_HEIGHT}px`,
                    }} 
                >
                    <div className="flex justify-center" style={{ gap: `${VISUAL_BUCKET_GAP}px` }}>
                        {multipliers.map((m, idx) => {
                            const isActive = activeBucket?.index === idx;
                            const key = `${idx}-${isActive ? activeBucket.ts : 'default'}`;
                            
                            return (
                                <div 
                                    key={key}
                                    className={`
                                        relative flex flex-col items-center justify-center
                                        transition-all duration-100 ease-out
                                        ${isActive ? 'animate-neon-flash z-30' : 'z-0'}
                                    `}
                                    style={{
                                        width: `${VISUAL_BUCKET_WIDTH}px`, 
                                        height: `${VISUAL_BUCKET_HEIGHT}px`, 
                                        // @ts-ignore
                                        '--glow-color': m.color 
                                    }}
                                >
                                    <div 
                                        className="w-full h-full rounded-[6px] flex items-center justify-center border-t border-white/20 shadow-lg"
                                        style={{
                                            backgroundColor: m.color,
                                            boxShadow: `0 4px 0 rgba(0,0,0,0.3), 0 0 15px ${m.color}40`,
                                        }}
                                    >
                                        <span className="text-[14px] sm:text-[16px] font-black text-[#1a0f05] leading-none drop-shadow-sm select-none">{m.value}x</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default PlinkoBoard;