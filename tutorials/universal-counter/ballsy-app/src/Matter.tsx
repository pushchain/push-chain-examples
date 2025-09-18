import React, { useEffect, useRef } from 'react';

// Define Matter.js types
declare global {
  interface Window {
    Matter: any;
  }
  
  // Extend HTMLElement to include matterBody property
  interface HTMLElement {
    matterBody?: any;
  }
}

// Access Matter.js from the global window object
const Matter = window.Matter;

// Blockchain colors - exported for use in other components
export const ETHEREUM_COLOR = '#627EEA';
export const SOLANA_COLOR = '#15EAAC';
export const PUSH_CHAIN_COLOR = '#D548EC';

interface MatterProps {
  physicBodyRefs?: React.RefObject<HTMLElement>[];
  fullScreen?: boolean;
}

// Function to add a specific blockchain ball - exported for use in App.tsx
export const addBlockchainBall = (color: string) => {
  // Get the Matter engine instance from window if available
  if (!window.matterEngine || !window.matterContainer) return;
  
  const engine = window.matterEngine;
  const container = window.matterContainer;
  const width = container.clientWidth;
  
  // Create a ball with the blockchain color
  const ball = Matter.Bodies.circle(
    Math.random() * width * 0.8,
    -30, // Start above the canvas
    Math.random() * 15 + 10,
    {
      restitution: 0.9, // Higher bounciness
      friction: 0.001, // Lower friction for smoother movement
      frictionAir: 0.001, // Lower air friction
      density: 0.002, // Lower density makes it easier to move
      render: {
        fillStyle: color,
        strokeStyle: '#FFFFFF',
        lineWidth: 1,
      },
    }
  );
  
  Matter.Composite.add(engine.world, ball);
};

// Function to add multiple blockchain balls at once - exported for use in App.tsx
export const addMultipleBlockchainBalls = (color: string, count: number) => {
  // Get the Matter engine instance from window if available
  if (!window.matterEngine || !window.matterContainer || count <= 0) return;
  
  const engine = window.matterEngine;
  const container = window.matterContainer;
  const width = container.clientWidth;
  
  // Add balls with a slight delay between each one
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const ball = Matter.Bodies.circle(
        Math.random() * width * 0.8,
        -30 - (i * 5), // Start above the canvas, staggered heights
        Math.random() * 10 + 8, // Slightly smaller size for multiple balls
        {
          restitution: 0.9, // Higher bounciness
          friction: 0.001, // Lower friction for smoother movement
          frictionAir: 0.001, // Lower air friction
          density: 0.002, // Lower density makes it easier to move
          render: {
            fillStyle: color,
            strokeStyle: '#FFFFFF',
            lineWidth: 1,
          },
        }
      );
      
      Matter.Composite.add(engine.world, ball);
    }, i * 50); // 50ms delay between each ball
  };
};

// Add global references for the engine and container
declare global {
  interface Window {
    matterEngine?: any;
    matterContainer?: HTMLDivElement;
  }
}

const MatterComponent: React.FC<MatterProps> = ({ physicBodyRefs = [], fullScreen = true }) => {
  // Create refs for scene container and Matter.js instances
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<any>(null);
  const renderRef = useRef<any>(null);
  const runnerRef = useRef<any>(null);
  
  // Function to update physics body positions based on DOM elements
  const updatePhysicsBodies = () => {
    if (!engineRef.current || !sceneRef.current || !physicBodyRefs || physicBodyRefs.length === 0) return;
    
    // Get canvas position for relative positioning
    const canvasRect = sceneRef.current.getBoundingClientRect();
    
    physicBodyRefs.forEach((ref: React.RefObject<HTMLElement>) => {
      if (ref && ref.current && ref.current.matterBody) {
        try {
          const element = ref.current;
          const body = element.matterBody;
          const rect = element.getBoundingClientRect();
          
          // Calculate position relative to the canvas
          const scrollX = window.scrollX || window.pageXOffset;
          const scrollY = window.scrollY || window.pageYOffset;
          
          // Account for scroll position and canvas position
          const x = rect.left + rect.width / 2 - canvasRect.left + scrollX;
          const y = rect.top + rect.height / 2 - canvasRect.top + scrollY;
          
          // Update the body position to match the element
          Matter.Body.setPosition(body, { x, y });
          
          // Update the body dimensions if needed
          const currentWidth = body.bounds.max.x - body.bounds.min.x;
          const currentHeight = body.bounds.max.y - body.bounds.min.y;
          
          if (Math.abs(currentWidth - rect.width) > 1 || Math.abs(currentHeight - rect.height) > 1) {
            const scaleX = rect.width / currentWidth;
            const scaleY = rect.height / currentHeight;
            
            if (isFinite(scaleX) && isFinite(scaleY) && scaleX > 0 && scaleY > 0) {
              Matter.Body.scale(body, scaleX, scaleY);
            }
          }
        } catch (err) {
          console.error('Error updating physics body:', err);
        }
      }
    });
  };

  // Setup Matter.js physics engine
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Create engine
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    
    const container = sceneRef.current;
    
    // Store references globally for the addBlockchainBall function
    window.matterEngine = engine;
    window.matterContainer = container;
    
    // Set dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Create renderer
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: 'white',
        pixelRatio: window.devicePixelRatio || 1,
      },
    });
    
    // Make sure canvas has proper styles
    if (render.canvas) {
      render.canvas.style.position = 'fixed';
      render.canvas.style.top = '0';
      render.canvas.style.left = '0';
      render.canvas.style.width = '100%';
      render.canvas.style.height = '100%';
      render.canvas.style.zIndex = '1';
      render.canvas.style.pointerEvents = 'auto'; // Enable pointer events for interaction
    }
    
    renderRef.current = render;
    
    // Create walls (bottom, left, right) - positioned outside the visible area
    const walls = [
      // Bottom wall - positioned just below the visible area
      Matter.Bodies.rectangle(
        width / 2,
        height + 25, // 25px below the bottom edge
        width + 100, // wider than the container
        50,
        { 
          isStatic: true,
          render: { fillStyle: '#2e2b44' }
        }
      ),
      // Left wall - positioned outside the left edge
      Matter.Bodies.rectangle(
        -25, // 25px outside the left edge
        height / 2,
        50,
        height + 100, // taller than the container
        { 
          isStatic: true,
          render: { fillStyle: '#2e2b44' }
        }
      ),
      // Right wall - positioned outside the right edge
      Matter.Bodies.rectangle(
        width + 25, // 25px outside the right edge
        height / 2,
        50,
        height + 100, // taller than the container
        { 
          isStatic: true,
          render: { fillStyle: '#2e2b44' }
        }
      ),
    ];
    
    // Add walls to the world
    Matter.Composite.add(engine.world, walls);
    
    // Create physics bodies from HTML elements using refs
    if (physicBodyRefs && physicBodyRefs.length > 0) {
      // Only create physics bodies if refs are provided and valid
      try {
        physicBodyRefs.forEach((ref: React.RefObject<HTMLElement>) => {
        if (ref.current) {
          const element = ref.current;
          const rect = element.getBoundingClientRect();
          const canvasRect = sceneRef.current.getBoundingClientRect();
          const scrollX = window.scrollX || window.pageXOffset;
          const scrollY = window.scrollY || window.pageYOffset;
          
          // Calculate position relative to the canvas
          const x = rect.left + rect.width / 2 - canvasRect.left + scrollX;
          const y = rect.top + rect.height / 2 - canvasRect.top + scrollY;
          
          // Create a rectangle body based on the element's dimensions and position
          const body = Matter.Bodies.rectangle(
            x,                      // x position (center) relative to canvas
            y,                      // y position (center) relative to canvas
            rect.width,             // width
            rect.height,            // height
            {
              isStatic: true,
              isHtmlElement: true,   // Custom property to identify HTML element bodies
              friction: 0.01,         // Low friction for smoother interactions
              frictionAir: 0.001,     // Low air friction
              restitution: 1.5,      // Some bounciness
              render: {
                fillStyle: 'rgba(0, 0, 0, 0.2)',  // Semi-transparent fill
                strokeStyle: '#ff0000',            // Red outline
                lineWidth: 2,                      // Visible border
                opacity: 0                       // Make it visible
              },
              // Store reference to the original element
              elementRef: ref
            }
          );
          
          // Store the body in the element for future reference
          element.matterBody = body;
          
          // Add the body to the world
          Matter.Composite.add(engine.world, body);
        }
      });
      } catch (err) {
        console.error('Error creating physics bodies from HTML elements:', err);
      }
    }
    
    // Create a runner
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);
    
    // Add mouse control for interactive play
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: true,
          strokeStyle: 'rgba(255,165,0,0.7)',
          lineWidth: 2
        }
      }
    });
    
    // Keep the mouse in sync with rendering
    render.mouse = mouse;
    
    // Add mouse constraint to world
    Matter.Composite.add(engine.world, mouseConstraint);
    
    // We already started the runner and renderer above, no need to run them again
    
    // Add initial balls with blockchain colors
    // for (let i = 0; i < 100; i++) {
    //   setTimeout(() => {
    //     // Determine which blockchain color to use (cycle through them)
    //     let color;
    //     const colorIndex = i % 3;
    //     if (colorIndex === 0) {
    //       color = ETHEREUM_COLOR; // Ethereum
    //     } else if (colorIndex === 1) {
    //       color = SOLANA_COLOR;   // Solana
    //     } else {
    //       color = PUSH_CHAIN_COLOR; // Push Chain
    //     }
        
    //     const ball = Matter.Bodies.circle(
    //       Math.random() * width * 0.8,
    //       -30, // Start above the canvas
    //       Math.random() * 20 + 10,
    //       {
    //         restitution: 0.8,
    //         render: {
    //           fillStyle: color,
    //           strokeStyle: '#FFFFFF',
    //           lineWidth: 1,
    //         },
    //       }
    //     );
    //     Matter.Composite.add(engine.world, ball);
    //   }, i * 200);
    // }
    
    // Handle window resize
    const handleResize = () => {
      if (!renderRef.current || !engineRef.current || !sceneRef.current) return;
      
      const render = renderRef.current;
      const engine = engineRef.current;
      const container = sceneRef.current;
      
      // Get new dimensions
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      
      // Update canvas dimensions
      render.options.width = newWidth;
      render.options.height = newHeight;
      render.canvas.width = newWidth;
      render.canvas.height = newHeight;
      
      // Remove all bodies except balls and HTML element bodies
      const nonWallBodies = engine.world.bodies.filter((body: any) => {
        // Keep balls and bodies associated with HTML elements
        return body.label !== 'Rectangle Body' || body.isHtmlElement === true;
      });
      
      // Clear the world and re-add only the non-wall bodies
      Matter.Composite.clear(engine.world, false);
      Matter.Composite.add(engine.world, nonWallBodies);
      
      // Create new walls positioned outside the visible area
      const newWalls = [
        // Bottom wall - positioned just below the visible area
        Matter.Bodies.rectangle(
          newWidth / 2,
          newHeight + 25, // 25px below the bottom edge
          newWidth + 100, // wider than the container
          50,
          { 
            isStatic: true,
            render: { fillStyle: '#2e2b44' }
          }
        ),
        // Left wall - positioned outside the left edge
        Matter.Bodies.rectangle(
          -25, // 25px outside the left edge
          newHeight / 2,
          50,
          newHeight + 100, // taller than the container
          { 
            isStatic: true,
            render: { fillStyle: '#2e2b44' }
          }
        ),
        // Right wall - positioned outside the right edge
        Matter.Bodies.rectangle(
          newWidth + 25, // 25px outside the right edge
          newHeight / 2,
          50,
          newHeight + 100, // taller than the container
          { 
            isStatic: true,
            render: { fillStyle: '#2e2b44' }
          }
        ),
      ];
      
      // Add the new walls
      Matter.Composite.add(engine.world, newWalls);
      
      // Update physics bodies for HTML elements
      updatePhysicsBodies();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Set up MutationObserver to watch for DOM changes
    const observers: MutationObserver[] = [];
    
    physicBodyRefs.forEach((ref: React.RefObject<HTMLElement>) => {
      if (ref.current) {
        const observer = new MutationObserver(() => {
          // Update physics bodies when DOM changes
          updatePhysicsBodies();
        });
        
        // Observe changes to attributes and subtree
        observer.observe(ref.current, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['style', 'class']
        });
        
        observers.push(observer);
      }
    });
    
    // Set up a periodic update for physics bodies
    const updateInterval = setInterval(updatePhysicsBodies, 100);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Clear the update interval
      clearInterval(updateInterval);
      
      // Disconnect all mutation observers
      observers.forEach(observer => observer.disconnect());
      
      if (renderRef.current) {
        Matter.Render.stop(renderRef.current);
        renderRef.current.canvas.remove();
      }
      
      if (runnerRef.current) {
        Matter.Runner.stop(runnerRef.current);
      }
      
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current);
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: fullScreen ? '100vh' : '100%' }}>
      <div 
        ref={sceneRef} 
        style={{ 
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #ccc',
          borderRadius: '8px',
          margin: '0 10px 10px 10px'
        }}
      />
    </div>
  );
};

export default MatterComponent;
