import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    Tabs,
    Tab,
    Alert,
    CircularProgress,
    useTheme,
} from '@mui/material';
import { useAppDispatch } from '../hooks/useRedux';
import { loginStart, loginSuccess, loginFailure } from '../store/slices/authSlice';
import { authService } from '../services/auth.service';
import RoleSelectionDialog from '../components/auth/RoleSelectionDialog';

// Всегда приводим ошибку к строке — иначе объект/массив из ответа сервера
// уронит рендер Alert (нельзя рисовать объект как React-child → белый экран).
const extractLoginError = (err: any): string => {
    const m = err?.response?.data?.message;
    if (typeof m === 'string' && m.trim()) return m;
    if (Array.isArray(m)) return m.filter(Boolean).join(', ');
    if (m && typeof m === 'object' && typeof m.message === 'string') return m.message;
    if (err && !err.response) return 'Не удалось связаться с сервером. Проверьте подключение.';
    return 'Неверный логин или пароль.';
};

const LoginPage: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [tabValue, setTabValue] = useState(0);
    const [fullName, setFullName] = useState('');
    const [schoolPassword, setSchoolPassword] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showRoleDialog, setShowRoleDialog] = useState(false);
    // ИСПРАВЛЕНИЕ: Храним флаг, что пользователь новый (без категорий)
    const [isNewUser, setIsNewUser] = useState(false);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setError('');
    };

    const handleLoginSuccess = async (response: any) => {
        const user = {
            id: response.sessionId,
            sessionId: response.sessionId,
            schoolId: response.schoolId,
            schoolName: response.schoolName,
            fullName: response.fullName,
            isAdmin: response.isAdmin,
            sessionToken: response.sessionToken,
            categories: response.categories || [],
        };

        dispatch(loginSuccess(user));

        // ИСПРАВЛЕНИЕ: Проверяем категории и показываем диалог для новых пользователей
        const hasCategories = response.categories && response.categories.length > 0;

        if (!hasCategories) {
            setIsNewUser(true);
            setShowRoleDialog(true);
        } else {
            navigate('/dashboard');
        }
    };

    const handleGuestLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        dispatch(loginStart());

        try {
            const response = await authService.loginGuest({
                fullName,
                schoolPassword,
            });
            if (response?.pendingApproval) {
                const msg = response.message || 'Ваш вход ожидает подтверждения администратором школы.';
                setError(msg);
                dispatch(loginFailure(msg));
                return;
            }
            await handleLoginSuccess(response);
        } catch (err: any) {
            const errorMessage = extractLoginError(err);
            setError(errorMessage);
            dispatch(loginFailure(errorMessage));
        } finally {
            setLoading(false);
        }
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        dispatch(loginStart());

        try {
            const response = await authService.loginAdmin({
                fullName,
                adminPassword,
                schoolPassword,
            });
            await handleLoginSuccess(response);
        } catch (err: any) {
            const errorMessage = extractLoginError(err);
            setError(errorMessage);
            dispatch(loginFailure(errorMessage));
        } finally {
            setLoading(false);
        }
    };

    const handleRoleDialogClose = () => {
        setShowRoleDialog(false);
        setIsNewUser(false);
        navigate('/dashboard');
    };

    const handleRoleDialogSave = () => {
        setShowRoleDialog(false);
        setIsNewUser(false);
        navigate('/dashboard');
    };

    return (
        <>
            {/* Фон страницы: мягкое свечение, чтобы белая карточка входа
                не висела на пустом листе. */}
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    py: { xs: 4, sm: 6 },
                    background: isDark
                        ? 'radial-gradient(1200px 600px at 50% -10%, rgba(91,141,239,0.18) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, #12141a 0%, #171a21 100%)'
                        : 'radial-gradient(1200px 600px at 50% -10%, rgba(91,141,239,0.22) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #f4f7ff 0%, #eef2fa 100%)',
                }}
            >
                <Container maxWidth="sm">
                    <Paper
                        elevation={0}
                        sx={{
                            width: '100%',
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                            boxShadow: isDark
                                ? '0 24px 60px rgba(0,0,0,0.55)'
                                : '0 24px 60px rgba(31,54,110,0.14)',
                        }}
                    >
                        {/* Шапка с логотипом. Верхняя грань знака почти белая,
                            поэтому кладём его на слегка подкрашенную подложку —
                            на чистом белом фоне она бы просто исчезла. */}
                        <Box
                            sx={{
                                px: 4,
                                pt: { xs: 4, sm: 5 },
                                pb: { xs: 3, sm: 3.5 },
                                textAlign: 'center',
                                background: isDark
                                    ? 'linear-gradient(180deg, rgba(91,141,239,0.16) 0%, rgba(91,141,239,0) 100%)'
                                    : 'linear-gradient(180deg, #e9f0ff 0%, rgba(233,240,255,0) 100%)',
                            }}
                        >
                            <Box
                                component="img"
                                src={isDark ? '/plantakt-logo-dark.png' : '/plantakt-logo.png'}
                                alt="ПланТакт"
                                sx={{
                                    display: 'block',
                                    mx: 'auto',
                                    height: { xs: 44, sm: 54 },
                                    width: 'auto',
                                    maxWidth: '100%',
                                    objectFit: 'contain',
                                    userSelect: 'none',
                                }}
                            />
                            <Typography
                                variant="body2"
                                sx={{ mt: 1.5, color: 'text.secondary' }}
                            >
                                Задачи, расписание и мероприятия — в одном месте
                            </Typography>
                        </Box>

                        <Box sx={{ px: { xs: 3, sm: 4 }, pb: { xs: 3, sm: 4 } }}>
                        <Tabs
                            value={tabValue}
                            onChange={handleTabChange}
                            variant="fullWidth"
                            sx={{ mb: 3 }}
                        >
                            <Tab label="Гость" />
                            <Tab label="Администратор" />
                        </Tabs>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {tabValue === 0 ? (
                            <form onSubmit={handleGuestLogin}>
                                <TextField
                                    label="ФИО"
                                    variant="outlined"
                                    fullWidth
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    sx={{ mb: 2 }}
                                    placeholder="Иванов Иван Иванович"
                                />
                                <TextField
                                    label="Пароль школы"
                                    type="password"
                                    variant="outlined"
                                    fullWidth
                                    required
                                    value={schoolPassword}
                                    onChange={(e) => setSchoolPassword(e.target.value)}
                                    sx={{ mb: 3 }}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    size="large"
                                    disabled={loading}
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Войти'}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleAdminLogin}>
                                <TextField
                                    label="ФИО"
                                    variant="outlined"
                                    fullWidth
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    sx={{ mb: 2 }}
                                />
                                <TextField
                                    label="Пароль администратора"
                                    type="password"
                                    variant="outlined"
                                    fullWidth
                                    required
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    sx={{ mb: 2 }}
                                />
                                <TextField
                                    label="Пароль школы"
                                    type="password"
                                    variant="outlined"
                                    fullWidth
                                    required
                                    value={schoolPassword}
                                    onChange={(e) => setSchoolPassword(e.target.value)}
                                    sx={{ mb: 3 }}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    size="large"
                                    disabled={loading}
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Войти как администратор'}
                                </Button>
                            </form>
                        )}
                        </Box>
                    </Paper>
                </Container>
            </Box>

            {/* Диалог выбора ролей */}
            <RoleSelectionDialog
                open={showRoleDialog}
                onClose={handleRoleDialogClose}
                onSave={handleRoleDialogSave}
            />
        </>
    );
};

export default LoginPage;
