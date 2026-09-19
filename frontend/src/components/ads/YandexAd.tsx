import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { ADS_ENABLED } from '../../config/ads';

declare global {
    interface Window {
        yaContextCb?: Array<() => void>;
        Ya?: any;
    }
}

/**
 * Счётчик нужен, чтобы у каждого экземпляра блока был свой контейнер.
 * В одностраничном приложении пользователь ходит между разделами, блок
 * монтируется заново, и если id контейнера повторится, реклама во второй
 * раз просто не отрисуется.
 */
let instanceCounter = 0;

export type AdVariant = 'plain' | 'card';

interface YandexAdProps {
    /** Идентификатор блока из кабинета РСЯ (R-A-XXXXXXXX-N) */
    blockId: string;
    /**
     * plain — блок сам по себе, с еле заметной подписью сверху;
     * card  — оформлен как карточка задачи, чтобы вписаться в сетку.
     */
    variant?: AdVariant;
    /** Вызывается, когда объявление действительно появилось */
    onAdShown?: () => void;
}

/**
 * Рекламный блок Яндекс.РСЯ.
 *
 * Пока объявление не пришло (нет подходящей рекламы, включён блокировщик,
 * медленная сеть), компонент не занимает места и не показывает ни рамки,
 * ни подписи: пустая карточка «Реклама» посреди задач выглядела бы поломкой.
 * Появление объявления ловим по изменению высоты контейнера — это надёжнее
 * колбэков рекламного скрипта, которые могут не прийти.
 */
const YandexAd: React.FC<YandexAdProps> = ({ blockId, variant = 'plain', onAdShown }) => {
    const containerId = useRef(`yandex_rtb_${blockId}_${++instanceCounter}`);
    const pushed = useRef(false);
    const [hasAd, setHasAd] = useState(false);

    useEffect(() => {
        if (!ADS_ENABLED) return;

        const renderTo = containerId.current;

        // Вызов кладём в очередь: если context.js ещё не загрузился,
        // он выполнит её сам, когда будет готов.
        if (!pushed.current) {
            pushed.current = true;
            window.yaContextCb = window.yaContextCb || [];
            window.yaContextCb.push(() => {
                try {
                    window.Ya?.Context?.AdvManager?.render({ blockId, renderTo });
                } catch {
                    /* реклама не критична для работы приложения */
                }
            });
        }

        const el = document.getElementById(renderTo);
        if (!el) return;

        const check = () => {
            if (el.offsetHeight > 10) setHasAd(true);
        };
        check();

        if (typeof ResizeObserver === 'undefined') {
            const timer = window.setInterval(check, 1000);
            const stop = window.setTimeout(() => window.clearInterval(timer), 20000);
            return () => { window.clearInterval(timer); window.clearTimeout(stop); };
        }

        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, [blockId]);

    useEffect(() => {
        if (hasAd) onAdShown?.();
    }, [hasAd, onAdShown]);

    if (!ADS_ENABLED) return null;

    const label = (
        <Typography
            variant="caption"
            sx={{ color: 'text.disabled', fontSize: '0.65rem', letterSpacing: 0.4, display: 'block' }}
        >
            Реклама
        </Typography>
    );

    if (variant === 'card') {
        return (
            <Paper
                elevation={0}
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    ...(hasAd
                        ? {
                              p: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderLeft: '4px solid',
                              borderLeftColor: 'text.disabled',
                              borderRadius: 1,
                          }
                        : { p: 0, border: 'none', bgcolor: 'transparent' }),
                }}
            >
                {hasAd && <Box sx={{ mb: 1 }}>{label}</Box>}
                <Box id={containerId.current} sx={{ width: '100%', flexGrow: 1 }} />
            </Paper>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {hasAd && <Box sx={{ mb: 0.5, textAlign: 'center' }}>{label}</Box>}
            <Box id={containerId.current} sx={{ width: '100%' }} />
        </Box>
    );
};

export default YandexAd;
