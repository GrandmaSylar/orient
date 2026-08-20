import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, Coins, BookOpen, CreditCard, 
  TrendingUp, FileText, Percent, Wallet 
} from 'lucide-react';

const iconsList = [
  GraduationCap, Coins, BookOpen, CreditCard, 
  TrendingUp, FileText, Percent, Wallet
];

// Programmatically generate 38 icons with smaller sizes (16px to 22px) and random positions
const generatedIcons = Array.from({ length: 38 }, (_, i) => {
  const Icon = iconsList[i % iconsList.length];
  const topVal = Math.random() * 90 + 5; // 5% to 95%
  const leftVal = Math.random() * 90 + 5; // 5% to 95%
  const size = Math.floor(Math.random() * 6) + 16; // Small sizes: 16px - 22px
  const delay = `${(Math.random() * 4).toFixed(1)}s`;
  const duration = `${(Math.random() * 4 + 4).toFixed(1)}s`;
  const anim = `float${(i % 3) + 1}`;
  return { icon: Icon, topVal, leftVal, size, delay, duration, anim };
});

export const FloatingBackground: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 }); // Start off-screen

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      zIndex: 0,
      pointerEvents: 'none',
      userSelect: 'none'
    }}>
      {generatedIcons.map((item, idx) => {
        const IconComponent = item.icon;
        
        // Calculate absolute position based on window viewport
        const iconX = (item.leftVal / 100) * window.innerWidth;
        const iconY = (item.topVal / 100) * window.innerHeight;
        
        const dx = mousePos.x - iconX;
        const dy = mousePos.y - iconY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const maxRadius = 160; // Interaction radius (small around cursor)
        let tx = 0;
        let ty = 0;
        
        if (distance < maxRadius) {
          const force = (maxRadius - distance) / maxRadius;
          const depthFactor = ((idx % 3) + 1) * 12; // 12px, 24px, 36px push
          // Calculate angle to push icon away from the cursor
          const angle = Math.atan2(dy, dx);
          tx = Math.cos(angle) * force * depthFactor;
          ty = Math.sin(angle) * force * depthFactor;
        }

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: `${item.topVal}%`,
              left: `${item.leftVal}%`,
              transform: `translate(${tx}px, ${ty}px)`,
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{
              opacity: 0.32,
              color: 'var(--text-tertiary)',
              animation: `${item.anim} ${item.duration} ease-in-out infinite alternate`,
              animationDelay: item.delay,
            }}>
              <IconComponent size={item.size} strokeWidth={1.5} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
