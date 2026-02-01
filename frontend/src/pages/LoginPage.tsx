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
} from '@mui/material';
import { useAppDispatch } from '../hooks/useRedux';
import { loginStart, loginSuccess, loginFailure } from '../store/slices/authSlice';
import { authService } from '../services/auth.service';
import RoleSelectionDialog from '../components/auth/RoleSelectionDialog';

const LoginPage: React.FC = () => {
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

        console.log('Login response categories:', response.categories);
        console.log('Has categories:', hasCategories);

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
            await handleLoginSuccess(response);
        } catch (err: any) {
            const errorMessage =
                err.response?.data?.message || 'Ошибка входа. Проверьте данные.';
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
            const errorMessage =
                err.response?.data?.message || 'Ошибка входа. Проверьте данные.';
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
            <Container maxWidth="sm">
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
                        <Typography variant="h4" component="h1" gutterBottom align="center">
                            СкулТакт
                        </Typography>

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

                        <Box sx={{ mt: 3 }}>
                            <Typography variant="caption" color="text.secondary" align="center" display="block">
                            </Typography>
                            <Typography variant="caption" color="text.secondary" align="center" display="block">
                            </Typography>
                            <Typography variant="caption" color="text.secondary" align="center" display="block">
                            </Typography>
                        </Box>
                    </Paper>
                </Box>
            </Container>

            {/* ИСПРАВЛЕНИЕ: Диалог выбора ролей */}
            <RoleSelectionDialog
                open={showRoleDialog}
                onClose={handleRoleDialogClose}
                onSave={handleRoleDialogSave}
            />
        </>
    );
};

export default LoginPage;
