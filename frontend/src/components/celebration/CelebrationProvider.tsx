import React, { createContext, useCallback, useContext, useState } from 'react';
import MascotCelebration, { CelebrationVariant } from './MascotCelebration';

interface CelebrationOptions {
    message: string;
    subtitle?: string;
    variant?: CelebrationVariant;
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
            <MascotCelebration
                key={state.key}
                open={state.open}
                message={state.opts.message}
                subtitle={state.opts.subtitle}
                variant={state.opts.variant}
                onClose={handleClose}
            />
        </CelebrationContext.Provider>
    );
};
