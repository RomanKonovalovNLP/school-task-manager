import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    Chip,
    Tooltip,
    AppBar,
    Toolbar,
    Collapse,
    Grid,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    School,
    Person,
    Logout,
    ExpandMore,
    ExpandLess,
    Refresh,
    AdminPanelSettings,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    superAdminService,
    School as SchoolType,
    SchoolAdmin,
    SystemStats,
} from '../services/superAdmin.service';

const SuperAdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [schools, setSchools] = useState<SchoolType[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<SchoolType | null>(null);
    const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
    const [expandedSchoolId, setExpandedSchoolId] = useState<number | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Диалоги
    const [schoolDialogOpen, setSchoolDialogOpen] = useState(false);
    const [adminDialogOpen, setAdminDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'school' | 'admin'; id: number; name: string } | null>(null);
    
    // Формы
    const [schoolForm, setSchoolForm] = useState({ name: '', password: '' });
    const [adminForm, setAdminForm] = useState({ fullName: '', password: '' });
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, schoolsData] = await Promise.all([
                superAdminService.getStats(),
                superAdminService.getSchools(),
            ]);
            setStats(statsData);
            setSchools(schoolsData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!superAdminService.isAuthenticated()) {
            navigate('/super-admin/login');
            return;
        }
        loadData();
    }, [navigate, loadData]);

    const loadSchoolAdmins = async (schoolId: number) => {
        try {
            const admins = await superAdminService.getSchoolAdmins(schoolId);
            setSchoolAdmins(admins);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка загрузки админов');
        }
    };

    const handleExpandSchool = async (school: SchoolType) => {
        if (expandedSchoolId === school.id) {
            setExpandedSchoolId(null);
            setSchoolAdmins([]);
        } else {
            setExpandedSchoolId(school.id);
            setSelectedSchool(school);
            await loadSchoolAdmins(school.id);
        }
    };

    const handleLogout = async () => {
        await superAdminService.logout();
        navigate('/super-admin/login');
    };

    // ==================== ШКОЛЫ ====================

    const openSchoolDialog = (school?: SchoolType) => {
        if (school) {
            setEditMode(true);
            setEditId(school.id);
            setSchoolForm({ name: school.name, password: '' });
        } else {
            setEditMode(false);
            setEditId(null);
            setSchoolForm({ name: '', password: '' });
        }
        setSchoolDialogOpen(true);
    };

    const handleSaveSchool = async () => {
        try {
            if (editMode && editId) {
                await superAdminService.updateSchool(editId, {
                    name: schoolForm.name || undefined,
                    password: schoolForm.password || undefined,
                });
            } else {
                await superAdminService.createSchool(schoolForm.name, schoolForm.password);
            }
            setSchoolDialogOpen(false);
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка сохранения школы');
        }
    };

    // ==================== АДМИНЫ ====================

    const openAdminDialog = (admin?: SchoolAdmin) => {
        if (admin) {
            setEditMode(true);
            setEditId(admin.id);
            setAdminForm({ fullName: admin.fullName, password: '' });
        } else {
            setEditMode(false);
            setEditId(null);
            setAdminForm({ fullName: '', password: '' });
        }
        setAdminDialogOpen(true);
    };

    const handleSaveAdmin = async () => {
        if (!selectedSchool) return;
        
        try {
            if (editMode && editId) {
                await superAdminService.updateSchoolAdmin(editId, {
                    fullName: adminForm.fullName || undefined,
                    password: adminForm.password || undefined,
                });
            } else {
                await superAdminService.createSchoolAdmin(
                    selectedSchool.id,
                    adminForm.fullName,
                    adminForm.password
                );
            }
            setAdminDialogOpen(false);
            loadSchoolAdmins(selectedSchool.id);
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка сохранения админа');
        }
    };

    // ==================== УДАЛЕНИЕ ====================

    const openDeleteDialog = (type: 'school' | 'admin', id: number, name: string) => {
        setDeleteTarget({ type, id, name });
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        
        try {
            if (deleteTarget.type === 'school') {
                await superAdminService.deleteSchool(deleteTarget.id);
                if (expandedSchoolId === deleteTarget.id) {
                    setExpandedSchoolId(null);
                    setSchoolAdmins([]);
                }
            } else {
                await superAdminService.deleteSchoolAdmin(deleteTarget.id);
                if (selectedSchool) {
                    loadSchoolAdmins(selectedSchool.id);
                }
            }
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления');
        }
    };

    if (loading && !stats) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
            {/* Шапка */}
            <AppBar position="static" sx={{ bgcolor: '#1a1a2e' }}>
                <Toolbar>
                    <AdminPanelSettings sx={{ mr: 2 }} />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Админ-панель разработчика
                    </Typography>
                    <Button color="inherit" onClick={handleLogout} startIcon={<Logout />}>
                        Выйти
                    </Button>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {/* Статистика */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Card>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <School sx={{ fontSize: 48, color: 'primary.main' }} />
                                <Box>
                                    <Typography variant="h4">{stats?.totalSchools || 0}</Typography>
                                    <Typography color="text.secondary">Школ</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Card>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Person sx={{ fontSize: 48, color: 'success.main' }} />
                                <Box>
                                    <Typography variant="h4">{stats?.totalAdmins || 0}</Typography>
                                    <Typography color="text.secondary">Админов</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Список школ */}
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5">
                            <School sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Школы
                        </Typography>
                        <Box>
                            <IconButton onClick={loadData} sx={{ mr: 1 }}>
                                <Refresh />
                            </IconButton>
                            <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={() => openSchoolDialog()}
                            >
                                Добавить школу
                            </Button>
                        </Box>
                    </Box>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={50} />
                                    <TableCell>ID</TableCell>
                                    <TableCell>Название</TableCell>
                                    <TableCell>Админов</TableCell>
                                    <TableCell>Создана</TableCell>
                                    <TableCell align="right">Действия</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {schools.map((school) => (
                                    <React.Fragment key={school.id}>
                                        <TableRow
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleExpandSchool(school)}
                                        >
                                            <TableCell>
                                                <IconButton size="small">
                                                    {expandedSchoolId === school.id ? <ExpandLess /> : <ExpandMore />}
                                                </IconButton>
                                            </TableCell>
                                            <TableCell>{school.id}</TableCell>
                                            <TableCell>
                                                <Typography fontWeight="medium">{school.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={school.adminsCount}
                                                    size="small"
                                                    color={school.adminsCount > 0 ? 'success' : 'default'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {new Date(school.createdAt).toLocaleDateString('ru-RU')}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Редактировать">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openSchoolDialog(school);
                                                        }}
                                                    >
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Удалить">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDeleteDialog('school', school.id, school.name);
                                                        }}
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{ py: 0 }}>
                                                <Collapse in={expandedSchoolId === school.id}>
                                                    <Box sx={{ py: 2, px: 4, bgcolor: 'grey.50' }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                            <Typography variant="subtitle1" fontWeight="medium">
                                                                <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                                Админы школы "{school.name}"
                                                            </Typography>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                startIcon={<Add />}
                                                                onClick={() => openAdminDialog()}
                                                            >
                                                                Добавить админа
                                                            </Button>
                                                        </Box>
                                                        {schoolAdmins.length > 0 ? (
                                                            <Table size="small">
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell>ID</TableCell>
                                                                        <TableCell>ФИО</TableCell>
                                                                        <TableCell>Создан</TableCell>
                                                                        <TableCell align="right">Действия</TableCell>
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableBody>
                                                                    {schoolAdmins.map((admin) => (
                                                                        <TableRow key={admin.id}>
                                                                            <TableCell>{admin.id}</TableCell>
                                                                            <TableCell>{admin.fullName}</TableCell>
                                                                            <TableCell>
                                                                                {new Date(admin.createdAt).toLocaleDateString('ru-RU')}
                                                                            </TableCell>
                                                                            <TableCell align="right">
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => openAdminDialog(admin)}
                                                                                >
                                                                                    <Edit fontSize="small" />
                                                                                </IconButton>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    color="error"
                                                                                    onClick={() => openDeleteDialog('admin', admin.id, admin.fullName)}
                                                                                >
                                                                                    <Delete fontSize="small" />
                                                                                </IconButton>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        ) : (
                                                            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                                                                Нет админов. Добавьте первого админа для этой школы.
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                                {schools.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                            <Typography color="text.secondary">
                                                Нет школ. Создайте первую школу.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Container>

            {/* Диалог школы */}
            <Dialog open={schoolDialogOpen} onClose={() => setSchoolDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editMode ? 'Редактировать школу' : 'Добавить школу'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Название школы"
                        value={schoolForm.name}
                        onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                        margin="normal"
                        required={!editMode}
                    />
                    <TextField
                        fullWidth
                        label={editMode ? 'Новый пароль (оставьте пустым если не менять)' : 'Пароль'}
                        type="password"
                        value={schoolForm.password}
                        onChange={(e) => setSchoolForm({ ...schoolForm, password: e.target.value })}
                        margin="normal"
                        required={!editMode}
                        helperText="Пароль для гостевого входа в школу"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSchoolDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSaveSchool}>
                        {editMode ? 'Сохранить' : 'Создать'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог админа */}
            <Dialog open={adminDialogOpen} onClose={() => setAdminDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editMode ? 'Редактировать админа' : 'Добавить админа'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="ФИО"
                        value={adminForm.fullName}
                        onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                        margin="normal"
                        required={!editMode}
                    />
                    <TextField
                        fullWidth
                        label={editMode ? 'Новый пароль (оставьте пустым если не менять)' : 'Пароль'}
                        type="password"
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        margin="normal"
                        required={!editMode}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAdminDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSaveAdmin}>
                        {editMode ? 'Сохранить' : 'Создать'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог подтверждения удаления */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Подтверждение удаления</DialogTitle>
                <DialogContent>
                    <Typography>
                        Вы уверены, что хотите удалить{' '}
                        {deleteTarget?.type === 'school' ? 'школу' : 'админа'}{' '}
                        <strong>"{deleteTarget?.name}"</strong>?
                    </Typography>
                    {deleteTarget?.type === 'school' && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            Все данные школы (задачи, мероприятия, пользователи) будут удалены!
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" color="error" onClick={handleDelete}>
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SuperAdminDashboard;
