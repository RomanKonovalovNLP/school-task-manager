import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Typography,
    Alert,
    CircularProgress,
    Box,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { filtersService } from '../../services/filters.service';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { updateUserCategories } from '../../store/slices/authSlice';

interface FilterCategory {
    id: number;
    categoryName: string;
    schoolId: number;
}

interface RoleSelectionDialogProps {
    open: boolean;
    onClose?: () => void;
    onSave?: () => void;
}

export const RoleSelectionDialog: React.FC<RoleSelectionDialogProps> = ({
    open,
    onClose,
    onSave,
}) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.auth);

    const [categories, setCategories] = useState<FilterCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Загружаем все категории
            const allCategories = await filtersService.getAll();
            setCategories(allCategories);

            // Загружаем выбранные категории пользователя
            try {
                const userCategoriesData = await filtersService.getMyCategories();

                // Находим ID категорий по именам
                const categoryIds = userCategoriesData.categories
                    .map((name: string) => {
                        const cat = allCategories.find((c) => c.categoryName === name);
                        return cat?.id;
                    })
                    .filter((id): id is number => id !== undefined);

                setSelectedCategories(categoryIds);
            } catch (err) {
                // Если пользователь еще не выбрал категории, это нормально
                console.log('No user categories yet');
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки категорий');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (categoryId: number) => {
        setSelectedCategories((prev) => {
            if (prev.includes(categoryId)) {
                return prev.filter((id) => id !== categoryId);
            } else {
                return [...prev, categoryId];
            }
        });
    };

    const handleSave = async () => {
        if (selectedCategories.length === 0) {
            setError('Выберите хотя бы одну роль');
            return;
        }

        setSaving(true);
        try {
            // Сохраняем категории на сервере
            await filtersService.setUserCategories(selectedCategories);

            // ✅ НОВОЕ: Обновляем Redux state
            const updatedCategoryNames = categories
                .filter((cat) => selectedCategories.includes(cat.id))
                .map((cat) => cat.categoryName);

            dispatch(updateUserCategories(updatedCategoryNames));

            // ✅ НОВОЕ: Обновляем localStorage
            if (user) {
                const updatedUser = {
                    ...user,
                    categories: updatedCategoryNames,
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }

            // Вызываем callback
            if (onSave) {
                onSave();
            }

            // Закрываем диалог
            if (onClose) {
                onClose();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Dialog open={open} maxWidth="sm" fullWidth>
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            disableEscapeKeyDown
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle color="primary" />
                    Выберите свои роли
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Выберите категории, к которым вы относитесь. Это нужно для получения
                    релевантных уведомлений о задачах.
                </Typography>

                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {categories.length === 0 ? (
                    <Alert severity="warning">
                        Категории не настроены. Обратитесь к администратору.
                    </Alert>
                ) : (
                    <FormGroup>
                        {categories.map((category) => (
                            <FormControlLabel
                                key={category.id}
                                control={
                                    <Checkbox
                                        checked={selectedCategories.includes(category.id)}
                                        onChange={() => handleToggle(category.id)}
                                        disabled={saving}
                                    />
                                }
                                label={category.categoryName}
                            />
                        ))}
                    </FormGroup>
                )}
            </DialogContent>
            <DialogActions>
                {onClose && (
                    <Button onClick={onClose} disabled={saving}>
                        Пропустить
                    </Button>
                )}
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving || selectedCategories.length === 0}
                >
                    {saving ? <CircularProgress size={24} /> : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RoleSelectionDialog;
