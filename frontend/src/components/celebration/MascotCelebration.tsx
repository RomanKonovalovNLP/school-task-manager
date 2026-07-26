import React, { useEffect, useMemo } from 'react';

export type CelebrationVariant = 'task' | 'event' | 'complete';

interface Props {
    open: boolean;
    message: string;
    subtitle?: string;
    variant?: CelebrationVariant;
    onClose: () => void;
}

const ACCENTS: Record<CelebrationVariant, { accent: string; confetti: string[]; badge: string }> = {
    task: { accent: '#58cc02', badge: '📝', confetti: ['#58cc02', '#89e219', '#ffc800', '#1cb0f6', '#ff9600'] },
    event: { accent: '#1cb0f6', badge: '📅', confetti: ['#1cb0f6', '#84d8ff', '#58cc02', '#ffc800', '#ce82ff'] },
    complete: { accent: '#ffc800', badge: '🎉', confetti: ['#ffc800', '#ff9600', '#58cc02', '#1cb0f6', '#ff4b4b', '#ce82ff'] },
};

const MascotCelebration: React.FC<Props> = ({ open, message, subtitle, variant = 'task', onClose }) => {
    const cfg = ACCENTS[variant];

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(onClose, 3400);
        return () => clearTimeout(t);
    }, [open, onClose]);

    // Конфетти генерируем один раз на показ
    const confetti = useMemo(() => {
        const n = variant === 'complete' ? 46 : 30;
        return Array.from({ length: n }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 0.6,
            duration: 1.6 + Math.random() * 1.4,
            size: 6 + Math.random() * 8,
            color: cfg.confetti[i % cfg.confetti.length],
            rot: Math.random() * 360,
            round: Math.random() > 0.6,
        }));
    }, [variant, cfg.confetti, open]);

    if (!open) return null;

    return (
        <div className="mascotOverlay" onClick={onClose} role="dialog" aria-label={message}>
            <style>{CSS}</style>
            <div className="mascotStage" onClick={(e) => e.stopPropagation()}>
                {/* Конфетти */}
                <div className="mascotConfetti">
                    {confetti.map((c) => (
                        <span
                            key={c.id}
                            style={{
                                left: `${c.left}%`,
                                width: c.size,
                                height: c.round ? c.size : c.size * 0.5,
                                background: c.color,
                                borderRadius: c.round ? '50%' : 2,
                                animationDelay: `${c.delay}s`,
                                animationDuration: `${c.duration}s`,
                                transform: `rotate(${c.rot}deg)`,
                            }}
                        />
                    ))}
                </div>

                {/* Реплика */}
                <div className="mascotBubble" style={{ borderColor: cfg.accent }}>
                    <span className="mascotBadge">{cfg.badge}</span>
                    <div className="mascotMsg" style={{ color: cfg.accent }}>{message}</div>
                    {subtitle && <div className="mascotSub">{subtitle}</div>}
                    <div className="mascotBubbleTail" style={{ borderTopColor: '#fff' }} />
                </div>

                {/* Совёнок */}
                <div className="mascotOwl">
                    <Owl variant={variant} />
                </div>
            </div>
        </div>
    );
};

const Owl: React.FC<{ variant: CelebrationVariant }> = ({ variant }) => {
    const body = '#58cc02';
    const bodyDark = '#46a302';
    const belly = '#d7ffb8';
    const beak = '#ff9600';
    return (
        <svg viewBox="0 0 200 210" width="180" height="189" className="owlSvg">
            {/* сияние сзади */}
            <circle cx="100" cy="110" r="92" className="owlGlow" fill={variant === 'complete' ? '#fff3c4' : '#eaffd6'} />
            {/* лапки */}
            <g fill={beak}>
                <path d="M78 188 q-4 12 -14 12 M78 188 q0 13 -0 15 M78 188 q4 12 12 12" stroke={beak} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M122 188 q-4 12 -12 12 M122 188 q0 13 0 15 M122 188 q4 12 14 12" stroke={beak} strokeWidth="5" fill="none" strokeLinecap="round" />
            </g>
            {/* уши-кисточки */}
            <g fill={bodyDark}>
                <path d="M62 44 L74 74 L50 70 Z" />
                <path d="M138 44 L126 74 L150 70 Z" />
            </g>
            {/* тело */}
            <ellipse cx="100" cy="112" rx="66" ry="72" fill={body} />
            <ellipse cx="100" cy="126" rx="42" ry="50" fill={belly} />
            {/* крылья */}
            <g className="owlWing owlWingL" style={{ transformOrigin: '46px 96px' }}>
                <ellipse cx="40" cy="118" rx="16" ry="34" fill={bodyDark} />
            </g>
            <g className="owlWing owlWingR" style={{ transformOrigin: '154px 96px' }}>
                <ellipse cx="160" cy="118" rx="16" ry="34" fill={bodyDark} />
            </g>
            {/* глаза */}
            <g>
                <circle cx="76" cy="92" r="27" fill="#fff" stroke={bodyDark} strokeWidth="3" />
                <circle cx="124" cy="92" r="27" fill="#fff" stroke={bodyDark} strokeWidth="3" />
                <circle className="owlPupil" cx="76" cy="94" r="12" fill="#3a3a3a" />
                <circle className="owlPupil" cx="124" cy="94" r="12" fill="#3a3a3a" />
                <circle cx="81" cy="89" r="4" fill="#fff" />
                <circle cx="129" cy="89" r="4" fill="#fff" />
                {/* веки для моргания */}
                <rect className="owlLid" x="49" y="65" width="54" height="27" rx="13" fill={body} style={{ transformOrigin: '76px 92px' }} />
                <rect className="owlLid" x="97" y="65" width="54" height="27" rx="13" fill={body} style={{ transformOrigin: '124px 92px' }} />
            </g>
            {/* щёчки */}
            <circle cx="60" cy="118" r="8" fill="#ff8fa3" opacity="0.55" />
            <circle cx="140" cy="118" r="8" fill="#ff8fa3" opacity="0.55" />
            {/* клюв */}
            <path d="M100 104 L112 116 L100 126 L88 116 Z" fill={beak} />
        </svg>
    );
};

const CSS = `
.mascotOverlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;
  background:rgba(20,24,20,0.28);backdrop-filter:blur(2px);animation:mascotFade .25s ease;cursor:pointer;}
.mascotStage{position:relative;display:flex;flex-direction:column;align-items:center;cursor:default;}
.mascotOwl{animation:owlPop .6s cubic-bezier(.18,1.5,.4,1) both, owlBob 2.2s ease-in-out .6s infinite;}
.owlSvg{display:block;filter:drop-shadow(0 10px 18px rgba(0,0,0,.18));}
.owlGlow{animation:glowPulse 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
.owlWing{transform-box:fill-box;}
.owlWingL{animation:wingWaveL 1s ease-in-out infinite;}
.owlWingR{animation:wingWaveR 1s ease-in-out infinite;}
.owlLid{transform-box:fill-box;animation:blink 3.4s ease-in-out infinite;}
.owlPupil{transform-box:fill-box;transform-origin:center;animation:pupil 3.4s ease-in-out infinite;}
.mascotBubble{position:relative;background:#fff;border:3px solid #58cc02;border-radius:18px;padding:12px 20px;margin-bottom:10px;
  text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.15);animation:bubblePop .5s cubic-bezier(.18,1.4,.4,1) .15s both;max-width:320px;}
.mascotBadge{font-size:26px;display:block;line-height:1;margin-bottom:2px;animation:badgeSpin .6s ease .2s both;}
.mascotMsg{font-weight:800;font-size:18px;font-family:'Segoe UI',system-ui,sans-serif;}
.mascotSub{margin-top:2px;color:#777;font-size:13px;font-family:'Segoe UI',system-ui,sans-serif;}
.mascotBubbleTail{position:absolute;left:50%;bottom:-12px;transform:translateX(-50%);width:0;height:0;
  border-left:12px solid transparent;border-right:12px solid transparent;border-top:12px solid #fff;
  filter:drop-shadow(0 2px 0 rgba(0,0,0,.06));}
.mascotConfetti{position:absolute;inset:-40px -60px 0;pointer-events:none;overflow:visible;}
.mascotConfetti span{position:absolute;top:-24px;display:block;animation-name:confettiFall;animation-timing-function:linear;
  animation-iteration-count:1;animation-fill-mode:forwards;}
@keyframes mascotFade{from{opacity:0}to{opacity:1}}
@keyframes owlPop{0%{transform:scale(0) rotate(-12deg)}70%{transform:scale(1.12) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
@keyframes owlBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes wingWaveL{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-26deg)}}
@keyframes wingWaveR{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(26deg)}}
@keyframes blink{0%,90%,100%{transform:scaleY(0)}94%{transform:scaleY(1)}}
@keyframes pupil{0%,40%,100%{transform:translateX(0)}55%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
@keyframes glowPulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.08);opacity:.75}}
@keyframes bubblePop{0%{transform:scale(0) translateY(8px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes badgeSpin{0%{transform:scale(0) rotate(-40deg)}100%{transform:scale(1) rotate(0)}}
@keyframes confettiFall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(360px) rotate(540deg);opacity:0}}
@media (prefers-reduced-motion: reduce){
  .mascotOwl,.owlWingL,.owlWingR,.owlLid,.owlPupil,.owlGlow,.mascotConfetti span{animation:none !important}
}
`;

export default MascotCelebration;
