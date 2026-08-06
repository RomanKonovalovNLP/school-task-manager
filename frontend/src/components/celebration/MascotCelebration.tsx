import React, { useEffect, useMemo } from 'react';

export type CelebrationVariant = 'task' | 'event' | 'complete' | 'plan';

/** Три строки подписи: обычная / выделенная / обычная */
export type CelebrationLines = [string, string, string];

interface Props {
    open: boolean;
    /** Текст для скринридеров и запасной вариант подписи */
    message: string;
    subtitle?: string;
    variant?: CelebrationVariant;
    /** Явные строки подписи; если не заданы — берутся из варианта */
    lines?: CelebrationLines;
    onClose: () => void;
}

/** Подписи по умолчанию для каждого события */
const DEFAULT_LINES: Record<CelebrationVariant, CelebrationLines> = {
    task: ['ЗАДАЧА', 'УСПЕШНО', 'СОЗДАНА'],
    complete: ['ЗАДАЧА', 'УСПЕШНО', 'ВЫПОЛНЕНА'],
    plan: ['ПЛАН', 'УСПЕШНО', 'ВЫПОЛНЕН'],
    event: ['МЕРОПРИЯТИЕ', 'УСПЕШНО', 'СОЗДАНО'],
};

/** Цвета карточек, выезжающих из-под основной (как в шапке сообщества) */
const STACK_COLORS: Record<CelebrationVariant, [string, string]> = {
    task: ['#6BA1FF', '#8E7BFF'],
    complete: ['#6BA1FF', '#4FC3A1'],
    plan: ['#6BA1FF', '#C77BFF'],
    event: ['#6BA1FF', '#FFB74D'],
};

const SuccessCelebration: React.FC<Props> = ({
    open,
    message,
    subtitle,
    variant = 'task',
    lines,
    onClose,
}) => {
    const text = useMemo<CelebrationLines>(
        () => lines || DEFAULT_LINES[variant] || DEFAULT_LINES.task,
        [lines, variant],
    );
    const [stackA, stackB] = STACK_COLORS[variant] || STACK_COLORS.task;

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(onClose, 2600);
        return () => clearTimeout(t);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="ptOverlay" onClick={onClose} role="dialog" aria-label={message}>
            <style>{CSS}</style>

            <div className="ptStage" onClick={(e) => e.stopPropagation()}>
                {/* Карточки, выезжающие из-под основной */}
                <div className="ptGhost ptGhost2" style={{ background: `linear-gradient(180deg, #ffffff 0%, ${stackB} 100%)` }} />
                <div className="ptGhost ptGhost1" style={{ background: `linear-gradient(180deg, #ffffff 0%, ${stackA} 100%)` }} />

                {/* Основная карточка */}
                <div className="ptCard">
                    <div className="ptInner">
                        <span className="ptDot" />

                        <div className="ptText">
                            <div className="ptLine ptLineMuted ptDelay1">{text[0]}</div>
                            <div className="ptLine ptLineBright ptDelay2">{text[1]}</div>
                            <div className="ptLine ptLineMuted ptDelay3">{text[2]}</div>
                        </div>

                        {/* Галочка рисуется штрихом */}
                        <svg className="ptCheck" viewBox="0 0 120 80" aria-hidden="true">
                            <path
                                d="M10 44 L44 70 L110 8"
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* Искра в стиле шапки */}
                        <svg className="ptSpark" viewBox="0 0 100 100" aria-hidden="true">
                            <path
                                d="M50 0 C54 32 68 46 100 50 C68 54 54 68 50 100 C46 68 32 54 0 50 C32 46 46 32 50 0 Z"
                                fill="#ffffff"
                            />
                        </svg>
                    </div>
                </div>

                {subtitle && <div className="ptSubtitle">{subtitle}</div>}
            </div>
        </div>
    );
};

const CSS = `
.ptOverlay{
  position:fixed; inset:0; z-index:2000;
  display:flex; align-items:center; justify-content:center;
  background:rgba(18,22,30,0.32); backdrop-filter:blur(3px);
  animation:ptFade .22s ease both; cursor:pointer;
}
.ptStage{
  position:relative; cursor:default;
  display:flex; flex-direction:column; align-items:center; gap:18px;
}

/* ---------- карточки ---------- */
.ptCard{
  position:relative; z-index:3;
  width:260px; height:260px; border-radius:58px;
  background:#5B8DEF;
  padding:14px;
  box-shadow:0 24px 60px rgba(30,60,120,.35);
  animation:ptCardIn .62s cubic-bezier(.2,1.25,.35,1) both;
}
.ptInner{
  position:relative; width:100%; height:100%;
  border-radius:46px; background:#2B2B2B; overflow:hidden;
  padding:26px 24px;
  display:flex; flex-direction:column; justify-content:space-between;
}

/* карточки-«тени», выезжающие вправо-вниз */
.ptGhost{
  position:absolute; top:0; left:0;
  width:260px; height:260px; border-radius:58px;
  box-shadow:0 18px 44px rgba(30,60,120,.22);
}
.ptGhost1{ z-index:2; animation:ptGhost1In .68s cubic-bezier(.2,1.2,.35,1) .06s both; }
.ptGhost2{ z-index:1; animation:ptGhost2In .74s cubic-bezier(.2,1.2,.35,1) .12s both; }

/* ---------- содержимое ---------- */
.ptDot{
  position:absolute; top:20px; right:22px;
  width:11px; height:11px; border-radius:50%; background:#fff;
  animation:ptDotIn .4s ease .5s both;
}
.ptText{ display:flex; flex-direction:column; gap:2px; }
.ptLine{
  font-family:'Segoe UI', system-ui, -apple-system, sans-serif;
  font-weight:800; font-size:23px; line-height:1.18;
  letter-spacing:.4px; white-space:nowrap;
}
.ptLineMuted{ color:#9A9A9A; }
.ptLineBright{ color:#fff; }
.ptDelay1{ animation:ptLineIn .42s ease .26s both; }
.ptDelay2{ animation:ptLineIn .42s ease .36s both; }
.ptDelay3{ animation:ptLineIn .42s ease .46s both; }

.ptCheck{
  width:96px; height:64px; margin-left:-2px;
}
.ptCheck path{
  stroke-dasharray:190; stroke-dashoffset:190;
  animation:ptDraw .55s cubic-bezier(.6,.1,.3,1) .58s forwards;
}

.ptSpark{
  position:absolute; right:-10px; bottom:-14px;
  width:96px; height:96px; opacity:.14;
  animation:ptSparkIn .8s ease .3s both;
}

.ptSubtitle{
  color:#fff; font-size:15px; font-weight:500; text-align:center;
  max-width:300px; text-shadow:0 2px 10px rgba(0,0,0,.4);
  animation:ptLineIn .4s ease .7s both;
}

/* ---------- движение ---------- */
@keyframes ptFade{ from{opacity:0} to{opacity:1} }

@keyframes ptCardIn{
  0%{ opacity:0; transform:translateY(46px) scale(.86); }
  100%{ opacity:1; transform:translateY(0) scale(1); }
}
@keyframes ptGhost1In{
  0%{ opacity:0; transform:translate(0,40px) scale(.9); }
  100%{ opacity:1; transform:translate(26px,26px) scale(.97); }
}
@keyframes ptGhost2In{
  0%{ opacity:0; transform:translate(0,40px) scale(.9); }
  100%{ opacity:1; transform:translate(48px,48px) scale(.94); }
}
@keyframes ptLineIn{
  0%{ opacity:0; transform:translateY(10px); }
  100%{ opacity:1; transform:translateY(0); }
}
@keyframes ptDotIn{
  0%{ opacity:0; transform:scale(.2); }
  100%{ opacity:1; transform:scale(1); }
}
@keyframes ptDraw{ to{ stroke-dashoffset:0; } }
@keyframes ptSparkIn{
  0%{ opacity:0; transform:scale(.4) rotate(-25deg); }
  60%{ opacity:.22; }
  100%{ opacity:.14; transform:scale(1) rotate(0deg); }
}

/* На узких экранах — компактнее */
@media (max-width:420px){
  .ptCard, .ptGhost{ width:220px; height:220px; border-radius:50px; }
  .ptInner{ border-radius:40px; padding:22px 20px; }
  .ptLine{ font-size:20px; }
  .ptCheck{ width:82px; height:56px; }
}

/* Уважаем системную настройку «меньше движения» */
@media (prefers-reduced-motion:reduce){
  .ptCard,.ptGhost1,.ptGhost2,.ptLine,.ptDot,.ptSpark,.ptSubtitle{ animation-duration:.01ms !important; }
  .ptCheck path{ stroke-dashoffset:0; animation:none; }
}
`;

export default SuccessCelebration;
