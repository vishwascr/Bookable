import { useState } from 'react';

// Mascot component: Panda with reading glasses, reading an orange book, holding bamboo, sitting on a purple pastel cloud.
// Supports custom image if provided via props/asset, with a rich standalone SVG as default/fallback.
export default function Mascot({ src = '/mascot.png', size = 'md', className = '', alt = 'Bookable Panda Mascot' }) {
  const [imgFailed, setImgFailed] = useState(false);

  // If a raster image is supplied and loads successfully, render it
  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={alt}
        className={`mascot-img mascot-${size} ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Crisp, scalable pastel SVG illustration
  const dimensions = {
    sm: { width: 90, height: 80 },
    md: { width: 140, height: 125 },
    lg: { width: 200, height: 180 },
  }[size] || { width: 140, height: 125 };

  return (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mascot-svg mascot-${size} ${className}`}
      role="img"
      aria-label={alt}
    >
      <defs>
        {/* Cloud Gradient */}
        <linearGradient id="cloudGrad" x1="40" y1="130" x2="160" y2="175" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2D4F8" />
          <stop offset="1" stopColor="#C4ACED" />
        </linearGradient>
        {/* Soft Shadow */}
        <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#7B5BA8" floodOpacity="0.15" />
        </filter>
        {/* Orange Book Gradient */}
        <linearGradient id="bookCover" x1="45" y1="85" x2="85" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB380" />
          <stop offset="1" stopColor="#F57E42" />
        </linearGradient>
        {/* Bamboo Gradient */}
        <linearGradient id="bambooGrad" x1="135" y1="65" x2="148" y2="115" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A2E3B8" />
          <stop offset="1" stopColor="#5EBA84" />
        </linearGradient>
      </defs>

      {/* Sparkles / Magic Stars */}
      <path d="M30 115 L32 110 L34 115 L39 117 L34 119 L32 124 L30 119 L25 117 Z" fill="#FDE49B" opacity="0.9" />
      <path d="M172 90 L174 86 L176 90 L180 91 L176 92 L174 96 L172 92 L168 91 Z" fill="#F8C1D9" opacity="0.85" />
      <circle cx="166" cy="128" r="2.5" fill="#FFE18F" opacity="0.7" />

      {/* --- PASTEL PURPLE CLOUD --- */}
      <g filter="url(#softGlow)">
        {/* Bottom / background cloud puffs */}
        <ellipse cx="65" cy="152" rx="35" ry="20" fill="url(#cloudGrad)" />
        <ellipse cx="135" cy="152" rx="35" ry="20" fill="url(#cloudGrad)" />
        <ellipse cx="100" cy="156" rx="48" ry="22" fill="url(#cloudGrad)" />
        <ellipse cx="42" cy="148" rx="22" ry="16" fill="url(#cloudGrad)" />
        <ellipse cx="158" cy="148" rx="22" ry="16" fill="url(#cloudGrad)" />
        {/* Cloud top highlight puffs */}
        <ellipse cx="78" cy="144" rx="26" ry="15" fill="#EDE4FB" />
        <ellipse cx="122" cy="144" rx="26" ry="15" fill="#EDE4FB" />
        <ellipse cx="100" cy="145" rx="32" ry="14" fill="#F5F0FD" />
      </g>

      {/* --- PANDA TAIL --- */}
      <ellipse cx="66" cy="125" rx="8" ry="7" fill="#3D414A" />

      {/* --- PANDA FEET (Sitting cross-legged) --- */}
      <ellipse cx="68" cy="135" rx="14" ry="10" fill="#3D414A" />
      <ellipse cx="68" cy="134" rx="6" ry="4" fill="#585D6A" />
      <circle cx="63" cy="130" r="2" fill="#585D6A" />
      <circle cx="68" cy="129" r="2" fill="#585D6A" />
      <circle cx="73" cy="130" r="2" fill="#585D6A" />

      <ellipse cx="132" cy="135" rx="14" ry="10" fill="#3D414A" />
      <ellipse cx="132" cy="134" rx="6" ry="4" fill="#585D6A" />
      <circle cx="127" cy="130" r="2" fill="#585D6A" />
      <circle cx="132" cy="129" r="2" fill="#585D6A" />
      <circle cx="137" cy="130" r="2" fill="#585D6A" />

      {/* --- PANDA BODY --- */}
      <ellipse cx="100" cy="115" rx="33" ry="27" fill="#FAFAF8" />
      {/* Charcoal belly band / shoulders */}
      <path d="M72 105 C72 92, 128 92, 128 105 C124 116, 76 116, 72 105 Z" fill="#3D414A" />
      {/* Soft tummy highlight */}
      <ellipse cx="100" cy="120" rx="18" ry="14" fill="#FFFFFF" />

      {/* --- PANDA EARS --- */}
      <circle cx="73" cy="46" r="13" fill="#3D414A" />
      <circle cx="73" cy="46" r="7" fill="#F8B8C6" opacity="0.8" />
      <circle cx="127" cy="46" r="13" fill="#3D414A" />
      <circle cx="127" cy="46" r="7" fill="#F8B8C6" opacity="0.8" />

      {/* --- PANDA HEAD --- */}
      <ellipse cx="100" cy="68" rx="32" ry="26" fill="#FAFAF8" />

      {/* Eye Patches (Signature Panda Patches tilted inward) */}
      <ellipse cx="86" cy="66" rx="9" ry="11" transform="rotate(-15 86 66)" fill="#3D414A" />
      <ellipse cx="114" cy="66" rx="9" ry="11" transform="rotate(15 114 66)" fill="#3D414A" />

      {/* Friendly Eyes with Catchlights */}
      <ellipse cx="87" cy="65" rx="4" ry="5" fill="#1C1E24" />
      <circle cx="85.5" cy="63" r="1.8" fill="#FFFFFF" />
      <circle cx="88.5" cy="67" r="0.9" fill="#FFFFFF" />

      <ellipse cx="113" cy="65" rx="4" ry="5" fill="#1C1E24" />
      <circle cx="111.5" cy="63" r="1.8" fill="#FFFFFF" />
      <circle cx="114.5" cy="67" r="0.9" fill="#FFFFFF" />

      {/* Cute Rosy Pastel Cheeks */}
      <ellipse cx="78" cy="74" rx="6" ry="4" fill="#F9B3C2" opacity="0.65" />
      <ellipse cx="122" cy="74" rx="6" ry="4" fill="#F9B3C2" opacity="0.65" />

      {/* Little Button Nose & Happy Mouth */}
      <path d="M97 73 Q100 70 103 73 Q100 76 97 73 Z" fill="#3D414A" />
      <path d="M97 76 Q100 79 100 81" stroke="#3D414A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M96 79 Q100 82 104 79" stroke="#3D414A" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* --- READING GLASSES (Gold / Honey Wireframe) --- */}
      {/* Left Lens Frame */}
      <circle cx="86" cy="66" r="10.5" stroke="#E69C3D" strokeWidth="2" fill="#EAF6FF" fillOpacity="0.25" />
      {/* Right Lens Frame */}
      <circle cx="114" cy="66" r="10.5" stroke="#E69C3D" strokeWidth="2" fill="#EAF6FF" fillOpacity="0.25" />
      {/* Bridge */}
      <path d="M96.5 65 Q100 63 103.5 65" stroke="#E69C3D" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Glass frame temple side lines */}
      <path d="M75.5 65 L71 63" stroke="#E69C3D" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M124.5 65 L129 63" stroke="#E69C3D" strokeWidth="1.8" strokeLinecap="round" />
      {/* Lens reflection gleams */}
      <path d="M81 61 Q86 59 90 62" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
      <path d="M109 61 Q114 59 118 62" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />

      {/* --- LEFT HAND & ORANGE BOOK --- */}
      {/* Left Arm reaching forward */}
      <path d="M74 95 C66 98, 62 108, 69 115 C74 120, 80 114, 82 108 Z" fill="#3D414A" />

      {/* Open Orange Book */}
      <g filter="url(#softGlow)">
        {/* Book back/cover */}
        <path d="M48 94 Q64 97 80 93 L80 117 Q64 121 48 116 Z" fill="url(#bookCover)" />
        <path d="M80 93 Q96 97 112 94 L112 117 Q96 121 80 117 Z" fill="url(#bookCover)" />
        {/* Book spine curve */}
        <path d="M79 92 L81 92 L81 118 L79 118 Z" fill="#D95C20" />
        {/* Open cream pages */}
        <path d="M50 96 Q65 99 79 96 L79 115 Q65 118 50 114 Z" fill="#FFFBF5" />
        <path d="M81 96 Q95 99 110 96 L110 114 Q95 118 81 115 Z" fill="#FFFBF5" />
        {/* Printed text lines on pages */}
        <line x1="55" y1="100" x2="74" y2="100" stroke="#E2C19E" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="55" y1="104" x2="72" y2="104" stroke="#E2C19E" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="55" y1="108" x2="74" y2="108" stroke="#E2C19E" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="86" y1="100" x2="105" y2="100" stroke="#E2C19E" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="86" y1="104" x2="103" y2="104" stroke="#E2C19E" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="86" y1="108" x2="105" y2="108" stroke="#E2C19E" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* Panda Paws holding book edge */}
      <circle cx="68" cy="116" r="4.5" fill="#3D414A" />
      <circle cx="94" cy="116" r="4.5" fill="#3D414A" />

      {/* --- RIGHT HAND & BAMBOO STALK --- */}
      {/* Bamboo Stalk held in right hand */}
      <g>
        {/* Segment 1 */}
        <line x1="140" y1="62" x2="143" y2="76" stroke="url(#bambooGrad)" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="141.5" cy="76" rx="4" ry="1.5" fill="#4B996C" />
        {/* Segment 2 */}
        <line x1="143" y1="78" x2="146" y2="94" stroke="url(#bambooGrad)" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="144.5" cy="94" rx="4" ry="1.5" fill="#4B996C" />
        {/* Segment 3 */}
        <line x1="146" y1="96" x2="149" y2="114" stroke="url(#bambooGrad)" strokeWidth="5.5" strokeLinecap="round" />

        {/* Bamboo Fresh Leaves */}
        {/* Top leaf 1 */}
        <path d="M140 62 Q130 55 125 58 Q132 64 140 62 Z" fill="#8CE0A7" />
        {/* Top leaf 2 */}
        <path d="M141 60 Q146 50 154 52 Q148 60 141 60 Z" fill="#72CE90" />
        {/* Mid leaf */}
        <path d="M144 76 Q156 70 162 74 Q154 80 144 76 Z" fill="#8CE0A7" />
        {/* Lower leaf */}
        <path d="M143 78 Q132 75 128 80 Q137 83 143 78 Z" fill="#5EBA84" />
      </g>

      {/* Right Arm & Paw holding bamboo */}
      <path d="M125 96 C134 98, 142 102, 146 108 C144 114, 137 117, 131 113 Z" fill="#3D414A" />
      <circle cx="144" cy="106" r="5" fill="#3D414A" />
    </svg>
  );
}
