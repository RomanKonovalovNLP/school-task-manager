import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Container,
    Tabs,
    Tab,
} from '@mui/material';
import { AdminPanelSettings, Lock } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../services/superAdmin.service';

const SuperAdminLoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(0);
    
    // Login state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Setup state
    const [setupKey, setSetupKey] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await superAdminService.login(username, password);
            navigate('/super-admin/dashboard');
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Ошибка входа';
            setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        } finally {
            setLoading(false);
        }
    };

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        if (newPassword.length < 12) {
            setError('Пароль должен быть минимум 12 символов');
            return;
        }

        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('Пароль должен содержать заглавные, строчные буквы и цифры');
            return;
        }

        setLoading(true);

        try {
            await superAdminService.setup(setupKey, newUsername, newPassword);
            setSuccess('Супер-админ успешно создан! Теперь вы можете войти.');
            setActiveTab(0);
            setUsername(newUsername);
            setNewUsername('');
            setNewPassword('');
            setConfirmPassword('');
            setSetupKey('');
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Ошибка настройки';
            setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#1a1a2e',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            }}
        >
            <Container maxWidth="sm">
                <Paper
                    elevation={24}
                    sx={{
                        p: 4,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.95)',
                    }}
                >
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <AdminPanelSettings sx={{ fontSize: 60, color: 'primary.main' }} />
                        <Typography variant="h4" fontWeight="bold" gutterBottom>
                            Админ-панель разработчика
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Управление школами и администраторами
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    {success && (
                        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                            {success}
                        </Alert>
                    )}

                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        variant="fullWidth"
                        sx={{ mb: 3 }}
                    >
                        <Tab label="Вход" icon={<Lock />} iconPosition="start" />
                        <Tab label="Первая настройка" icon={<AdminPanelSettings />} iconPosition="start" />
                    </Tabs>

                    {activeTab === 0 && (
                        <form onSubmit={handleLogin}>
                            <TextField
                                fullWidth
                                label="Имя пользователя"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                margin="normal"
                                required
                                autoFocus
                            />
                            <TextField
                                fullWidth
                                label="Пароль"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                margin="normal"
                                required
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={loading}
                                sx={{ mt: 3 }}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Войти'}
                            </Button>
                        </form>
                    )}

                    {activeTab === 1 && (
                        <form onSubmit={handleSetup}>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Первичная настройка доступна только если в системе нет
                                супер-админов. Вам потребуется ключ установки из переменных
                                окружения сервера (SUPER_ADMIN_SETUP_KEY).
                            </Alert>
                            <TextField
                                fullWidth
                                label="Ключ установки"
                                type="password"
                                value={setupKey}
                                onChange={(e) => setSetupKey(e.target.value)}
                                margin="normal"
                                required
                                helperText="Из переменной окружения SUPER_ADMIN_SETUP_KEY"
                            />
                            <TextField
                                fullWidth
                                label="Имя пользователя"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                margin="normal"
                                required
                            />
                            <TextField
                                fullWidth
                                label="Пароль"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                margin="normal"
                                required
                                helperText="Минимум 12 символов, заглавные и строчные буквы, цифры"
                            />
                            <TextField
                                fullWidth
                                label="Подтвердите пароль"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                margin="normal"
                                required
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={loading}
                                sx={{ mt: 3 }}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Создать супер-админа'}
                            </Button>
                        </form>
                    )}

                    <Box sx={{ mt: 3, textAlign: 'center' }}>
                        <Button
                            color="inherit"
                            onClick={() => navigate('/login')}
                        >
                            Вернуться к обычному входу
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default SuperAdminLoginPage;
