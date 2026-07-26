import React, { useState, useEffect } from 'react';
import {
    AppBar, Toolbar, Typography, Button, Box, IconButton,
    useMediaQuery, useTheme, Drawer, List, ListItem,
    ListItemButton, ListItemIcon, ListItemText, Divider, Tooltip,
} from '@mui/material';
import {
    Logout, Menu as MenuIcon, AdminPanelSettings,
    Dashboard as DashboardIcon, Assessment, Category,
    AccountCircle, Event as EventIcon, CalendarMonth, Close, People, Brightness4, Brightness7,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { logout } from '../../store/slices/authSlice';
import { authService } from '../../services/auth.service';
import NotificationBell from '../notifications/NotificationBell';
import { useColorMode } from '../../theme/colorMode';

const Header: React.FC = () => {
    const { user } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [pendingCount, setPendingCount] = useState(0);
    const colorMode = useColorMode();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleLogout = async () => {
        try { await authService.logout(); }
        catch (e) { console.error('Logout error:', e); }
        finally { dispatch(logout()); navigate('/login'); }
    };

    const isActive = (p: string) => location.pathname.startsWith(p);
    const go = (p: string) => { navigate(p); setDrawerOpen(false); };

    useEffect(() => {
        if (!user?.isAdmin) return;
        let alive = true;
        const load = () => authService.getPendingCount().then((r) => { if (alive) setPendingCount(r.count || 0); }).catch(() => {});
        load();
        const t = setInterval(load, 60000);
        return () => { alive = false; clearInterval(t); };
    }, [user]);

    const navItems = [
        { label: 'Задачи', icon: <DashboardIcon />, path: '/dashboard', show: true },
        { label: 'Мероприятия', icon: <EventIcon />, path: '/events', show: true },
        { label: 'Расписание', icon: <CalendarMonth />, path: '/schedule', show: true },
        { label: 'Статистика', icon: <Assessment />, path: '/statistics', show: !!user?.isAdmin },
        { label: 'Категории', icon: <Category />, path: '/admin/categories', show: !!user?.isAdmin },
        { label: pendingCount > 0 ? `Пользователи (${pendingCount})` : 'Пользователи', icon: <People />, path: '/users', show: !!user?.isAdmin },
    ].filter(i => i.show);

    return (
        <>
            <AppBar position="sticky">
                <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, gap: 1 }}>
                    {isMobile && (
                        <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)}>
                            <MenuIcon />
                        </IconButton>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => navigate('/dashboard')}>
                        <img src="/plantakt-icon.png" alt="ПланТакт" style={{ height: 28, width: 28, marginRight: 6 }} />
                        {!isMobile && (
                            <Typography variant="h6" component="span"
                                sx={{ fontWeight: 500, textTransform: 'lowercase', whiteSpace: 'nowrap' }}>
                                плантакт
                            </Typography>
                        )}
                    </Box>
                    {!isMobile && user?.schoolName && (
                        <Tooltip title={user.schoolName}>
                            <Typography variant="body2"
                                sx={{ opacity: 0.8, borderLeft: '1px solid rgba(255,255,255,0.3)', pl: 1.5,
                                    maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
                                {user.schoolName}
                            </Typography>
                        </Tooltip>
                    )}
                    {!isMobile && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1, ml: 1 }}>
                            {navItems.map(item => (
                                <Button key={item.path} color="inherit" size="small" startIcon={item.icon}
                                    onClick={() => navigate(item.path)}
                                    sx={{ bgcolor: isActive(item.path) ? 'rgba(255,255,255,0.1)' : 'transparent', whiteSpace: 'nowrap', px: 1.5 }}>
                                    {item.label}
                                </Button>
                            ))}
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexShrink: 0 }}>
                        <NotificationBell />
                        <Tooltip title={colorMode.mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
                            <IconButton color="inherit" onClick={colorMode.toggle}>
                                {colorMode.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                            </IconButton>
                        </Tooltip>
                        {!isMobile && (
                            <IconButton color="inherit" onClick={() => navigate('/profile')} title="Профиль">
                                <AccountCircle />
                            </IconButton>
                        )}
                        {!isMobile && (
                            <Tooltip title={`${user?.fullName}${user?.isAdmin ? ' (Администратор)' : ''}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 160, overflow: 'hidden' }}>
                                    <Typography variant="body2"
                                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {user?.fullName}
                                    </Typography>
                                    {user?.isAdmin && <AdminPanelSettings sx={{ ml: 0.5, fontSize: '1rem', flexShrink: 0 }} />}
                                </Box>
                            </Tooltip>
                        )}
                        <IconButton color="inherit" onClick={handleLogout} title="Выход"><Logout /></IconButton>
                    </Box>
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <Box sx={{ width: 280 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img src="/plantakt-icon.png" alt="" style={{ height: 32, width: 32 }} />
                            <Typography variant="h6" sx={{ fontWeight: 500, textTransform: 'lowercase' }}>плантакт</Typography>
                        </Box>
                        <IconButton onClick={() => setDrawerOpen(false)}><Close /></IconButton>
                    </Box>
                    <Box sx={{ px: 2, pb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{user?.fullName}</Typography>
                        {user?.schoolName && <Typography variant="body2" color="text.secondary">{user.schoolName}</Typography>}
                        {user?.isAdmin && (
                            <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <AdminPanelSettings sx={{ fontSize: 14 }} /> Администратор
                            </Typography>
                        )}
                    </Box>
                    <Divider />
                    <List>
                        {navItems.map(i => (
                            <ListItem key={i.path} disablePadding>
                                <ListItemButton selected={isActive(i.path)} onClick={() => go(i.path)}>
                                    <ListItemIcon>{i.icon}</ListItemIcon>
                                    <ListItemText primary={i.label} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                    <Divider />
                    <List>
                        <ListItem disablePadding>
                            <ListItemButton onClick={() => go('/profile')}>
                                <ListItemIcon><AccountCircle /></ListItemIcon>
                                <ListItemText primary="Профиль" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleLogout}>
                                <ListItemIcon><Logout /></ListItemIcon>
                                <ListItemText primary="Выход" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
            </Drawer>
        </>
    );
};

export default Header;
