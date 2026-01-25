import React from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    IconButton,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Logout,
    Menu as MenuIcon,
    AdminPanelSettings,
    Dashboard as DashboardIcon,
    Assessment,
    Category,
    AccountCircle,
    Event as EventIcon,  // НОВОЕ: Иконка мероприятий
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { logout } from '../../store/slices/authSlice';
import { authService } from '../../services/auth.service';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const { user } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            dispatch(logout());
            navigate('/login');
        }
    };

    // Проверка активного роута
    const isActive = (path: string) => location.pathname === path;

    return (
        <AppBar position="sticky">
            <Toolbar>
                {isMobile && onMenuClick && (
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={onMenuClick}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                )}

                <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
                    {user?.schoolName || 'Таск-менеджер'}
                </Typography>

                {/* НАВИГАЦИОННОЕ МЕНЮ */}
                {!isMobile && (
                    <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
                        <Button
                            color="inherit"
                            startIcon={<DashboardIcon />}
                            onClick={() => navigate('/dashboard')}
                            sx={{
                                bgcolor: isActive('/dashboard') ? 'rgba(255,255,255,0.1)' : 'transparent',
                            }}
                        >
                            Задачи
                        </Button>

                        {/* НОВОЕ: Кнопка Мероприятия */}
                        <Button
                            color="inherit"
                            startIcon={<EventIcon />}
                            onClick={() => navigate('/events')}
                            sx={{
                                bgcolor: isActive('/events') ? 'rgba(255,255,255,0.1)' : 'transparent',
                            }}
                        >
                            Мероприятия
                        </Button>

                        {/* Статистика - только для админов */}
                        {user?.isAdmin && (
                            <Button
                                color="inherit"
                                startIcon={<Assessment />}
                                onClick={() => navigate('/statistics')}
                                sx={{
                                    bgcolor: isActive('/statistics') ? 'rgba(255,255,255,0.1)' : 'transparent',
                                }}
                            >
                                Статистика
                            </Button>
                        )}

                        {user?.isAdmin && (
                            <Button
                                color="inherit"
                                startIcon={<Category />}
                                onClick={() => navigate('/admin/categories')}
                                sx={{
                                    bgcolor: isActive('/admin/categories') ? 'rgba(255,255,255,0.1)' : 'transparent',
                                }}
                            >
                                Категории
                            </Button>
                        )}
                    </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
                    {/* NotificationBell */}
                    <NotificationBell />

                    {/* Кнопка профиля */}
                    {!isMobile && (
                        <Button
                            color="inherit"
                            startIcon={<AccountCircle />}
                            onClick={() => navigate('/profile')}
                        >
                            Профиль
                        </Button>
                    )}

                    {/* Для мобильных - иконка */}
                    {isMobile && (
                        <IconButton
                            color="inherit"
                            onClick={() => navigate('/profile')}
                        >
                            <AccountCircle />
                        </IconButton>
                    )}

                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        <Typography variant="body2">
                            {user?.fullName}
                            {user?.isAdmin && (
                                <AdminPanelSettings
                                    sx={{ ml: 1, verticalAlign: 'middle', fontSize: '1.2rem' }}
                                />
                            )}
                        </Typography>
                    </Box>

                    <Button
                        color="inherit"
                        startIcon={<Logout />}
                        onClick={handleLogout}
                    >
                        {!isMobile && 'Выход'}
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Header;
