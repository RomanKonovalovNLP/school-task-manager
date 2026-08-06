import React, { createContext, useCallback, useContext, useState } from 'react';
import SuccessCelebration, { CelebrationVariant, CelebrationLines } from './MascotCelebration';

interface CelebrationOptions {
    /** Текст для скринридеров (и запасной вариант, если строки не заданы) */
    message: string;
    subtitle?: string;
    variant?: CelebrationVariant;
    /** Три строки подписи: обычная / выделенная / обычная */
    lines?: CelebrationLines;
}

const CelebrationContext = createContext<(o: CelebrationOptions) => void>(() => {});

export const useCelebration = () => useContext(CelebrationContext);

export const CelebrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<{ open: boolean; opts: CelebrationOptions; key: number }>({
        open: false,
        opts: { message: '' },
        key: 0,
    });

    const celebrate = useCallback((o: CelebrationOptions) => {
        setState((s) => ({ open: true, opts: o, key: s.key + 1 }));
    }, []);

    const handleClose = useCallback(() => setState((s) => ({ ...s, open: false })), []);

    return (
        <CelebrationContext.Provider value={celebrate}>
            {children}
            <SuccessCelebration
                key={state.key}
                open={state.open}
                message={state.opts.message}
                subtitle={state.opts.subtitle}
                variant={state.opts.variant}
                lines={state.opts.lines}
                onClose={handleClose}
            />
        </CelebrationContext.Provider>
    );
};
