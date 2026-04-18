import { useMemo } from "react";

const CHARMS = ["💖", "✨", "🌸", "💗", "🫶", "💞", "🌷", "💘", "💕", "🪷", "🤍", "🌹"];

export default function FloatingHearts() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        id: index,
        left: `${5 + index * 8}%`,
        size: `${0.8 + Math.random() * 0.6}rem`,
        duration: `${10 + Math.random() * 10}s`,
        delay: `${Math.random() * 14}s`,
        rotate: `${Math.random() > 0.5 ? 14 : -14}deg`,
        charm: CHARMS[index % CHARMS.length],
      })),
    []
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          style={{
            position: "absolute",
            bottom: "-20px",
            left: particle.left,
            fontSize: particle.size,
            opacity: 0,
            animation: `floatUp ${particle.duration} linear infinite`,
            animationDelay: particle.delay,
            filter: "drop-shadow(0 10px 18px rgba(232,96,138,.16))",
            transform: `rotate(${particle.rotate})`,
          }}
        >
          {particle.charm}
        </div>
      ))}
    </div>
  );
}
