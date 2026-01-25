import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    Chip,
    Divider,
    CircularProgress,
} from '@mui/material';
import { Edit, AccountCircle } from '@mui/icons-material';
import { useAppSelector } from '../hooks/useRedux';
import MainLayout from '../components/layout/MainLayout';
import RoleSelectionDialog from '../components/auth/RoleSelectionDialog';
import { filtersService } from '../services/filters.service';

const ProfilePage: React.FC = () => {
    const { user } = useAppSelector((state) => state.auth);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [userCategories, setUserCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserCategories();
    }, []);

    const loadUserCategories = async () => {
        setLoading(true);
        try {
            const { categories } = await filtersService.getMyCategories();
            setUserCategories(categories);
        } catch (err) {
            console.error('Failed to load user categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRolesSaved = async () => {
        setRoleDialogOpen(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);

        // Перезагружаем категории
        await loadUserCategories();
    };

    return (
        <MainLayout>
            <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <AccountCircle sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Typography variant="h4">Профиль пользователя</Typography>
                </Box>

                {showSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        Ваши категории успешно обновлены!
                    </Alert>
                )}

                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Основная информация
                        </Typography>

                        <Box sx={{ mt: 2 }}>
                            <Typography color="text.secondary" variant="body2">
                                ФИО
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                                {user?.fullName}
                            </Typography>

                            <Typography color="text.secondary" variant="body2">
                                Школа
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                                {user?.schoolName}
                            </Typography>

                            <Typography color="text.secondary" variant="body2">
                                Роль в системе
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                                {user?.isAdmin ? 'Администратор' : 'Пользователь'}
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="h6" gutterBottom>
                            Мои категории
                        </Typography>

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : userCategories.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                                {userCategories.map((category) => (
                                    <Chip
                                        key={category}
                                        label={category}
                                        color="primary"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        ) : (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                У вас пока не выбраны категории. Нажмите кнопку ниже, чтобы выбрать.
                            </Alert>
                        )}

                        <Button
                            variant="outlined"
                            startIcon={<Edit />}
                            onClick={() => setRoleDialogOpen(true)}
                            sx={{ mt: 3 }}
                        >
                            {userCategories.length > 0 ? 'Изменить мои категории' : 'Выбрать категории'}
                        </Button>
                    </CardContent>
                </Card>

                <Box sx={{ mt: 3 }}>
                    <Alert severity="info">
                        <Typography variant="body2">
                            <strong>Зачем нужны категории?</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Категории определяют, какие уведомления о задачах вы будете получать.
                            Вы увидите только те задачи, которые относятся к выбранным вами категориям.
                        </Typography>
                    </Alert>
                </Box>
            </Box>

            <RoleSelectionDialog
                open={roleDialogOpen}
                onClose={() => setRoleDialogOpen(false)}
                onSave={handleRolesSaved}
            />
        </MainLayout>
    );
};

export default ProfilePage;