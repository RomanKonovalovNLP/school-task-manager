import React from 'react';
import { Box, Container } from '@mui/material';
import Header from './Header';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <Container
                maxWidth="xl"
                sx={{ flexGrow: 1, py: 3, display: 'flex', flexDirection: 'column' }}
            >
                {children}
            </Container>
        </Box>
    );
};

export default MainLayout;