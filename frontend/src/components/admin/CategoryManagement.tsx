import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Typography,
    Alert,
    CircularProgress,
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { filtersService } from '../../services/filters.service';
import MainLayout from '../layout/MainLayout';

interface FilterCategory {
    id: number;
    categoryName: string;
    schoolId: number;
}

export const CategoryManagement: React.FC = () => {
    const [categories, setCategories] = useState<FilterCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<FilterCategory | null>(null);
    const [categoryName, setCategoryName] = useState('');

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const data = await filtersService.getAll();
            setCategories(data);
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки категорий');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (category?: FilterCategory) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.categoryName);
        } else {
            setEditingCategory(null);
            setCategoryName('');
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingCategory(null);
        setCategoryName('');
    };

    const handleSave = async () => {
        if (!categoryName.trim()) {
            setError('Введите название категории');
            return;
        }

        try {
            if (editingCategory) {
                // Обновление
                await filtersService.update(editingCategory.id, categoryName);
            } else {
                // Создание
                await filtersService.create(categoryName);
            }
            await loadCategories();
            handleCloseDialog();
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка сохранения');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить эту категорию? Все задачи с этой категорией останутся.')) {
            return;
        }

        try {
            await filtersService.delete(id);
            await loadCategories();
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления');
        }
    };

    const handleSeedCategories = async () => {
        try {
            await filtersService.seedCategories();
            await loadCategories();
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка создания категорий');
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <Box sx={{ p: 3 }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 3,
                    }}
                >
                    <Typography variant="h5">Управление категориями</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {categories.length === 0 && (
                            <Button variant="outlined" onClick={handleSeedCategories}>
                                Создать дефолтные
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => handleOpenDialog()}
                        >
                            Добавить категорию
                        </Button>
                    </Box>
                </Box>

                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {categories.length === 0 ? (
                    <Alert severity="info">
                        Нет категорий. Создайте дефолтные категории или добавьте свои.
                    </Alert>
                ) : (
                    <List>
                        {categories.map((category) => (
                            <ListItem key={category.id} divider>
                                <ListItemText
                                    primary={category.categoryName}
                                    secondary={`ID: ${category.id}`}
                                />
                                <ListItemSecondaryAction>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleOpenDialog(category)}
                                        sx={{ mr: 1 }}
                                    >
                                        <Edit />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleDelete(category.id)}
                                    >
                                        <Delete />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}

                {/* Диалог создания/редактирования */}
                <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Название категории"
                            fullWidth
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder="Например: Учителя"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Отмена</Button>
                        <Button onClick={handleSave} variant="contained">
                            Сохранить
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </MainLayout>
    );
};

export default CategoryManagement;
