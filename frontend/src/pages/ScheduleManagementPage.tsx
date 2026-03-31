import React, { useState, useEffect, useCallback } from 'react';
import { getAverageDifficulty } from '../utils/sanpinDifficulty';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    CircularProgress,
    Alert,
    Snackbar,
    Collapse,
    Tooltip,
    FormControlLabel,
    Checkbox,
    ToggleButton,
    ToggleButtonGroup,
    Popover,
    List as MuiList,
    ListItemButton,
    ListItemText,
    ListItemIcon as MuiListItemIcon,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    ArrowBack,
    School,
    Person,
    MenuBook,
    MeetingRoom,
    Home,
    KeyboardArrowDown,
    KeyboardArrowUp,
    GroupWork,
    AccessTime,
    Schedule,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { scheduleService } from '../services/schedule.service';
import { INSTITUTION_TYPES, getTerms } from '../utils/institutionTypes';
import {
    SchoolClass,
    ClassGroup,
    Teacher,
    Subject,
    Room,
    RoomType,
    SanpinCategory,
    BellSchedule,
    TeacherAvailability,
    DAYS_OF_WEEK,
} from '../types/schedule';

// ==================== Tab Panel ====================
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
        {value === index && children}
    </div>
);

// ==================== Классы (FIX #4 + #7) ====================
const ClassesTab: React.FC<{ onError: (msg: string) => void; onSuccess: (msg: string) => void }> = ({ onError, onSuccess }) => {
    const [items, setItems] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SchoolClass | null>(null);
    // FIX #4: gradeLevel и studentsCount как строки, чтобы пользователь мог удалить содержимое
    const [form, setForm] = useState({ name: '', gradeLevel: '', studentsCount: '', color: '#2196F3', shift: '' as string });

    // Subgroups state
    const [expandedClassId, setExpandedClassId] = useState<number | null>(null);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupClassId, setGroupClassId] = useState<number | null>(null);
    const [groupForm, setGroupForm] = useState({ name: '', studentsCount: '' });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await scheduleService.getClasses();
            setItems(Array.isArray(data) ? data : data.classes || []);
        } catch {
            onError('Ошибка загрузки классов');
        } finally {
            setLoading(false);
        }
    }, [onError]);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        // FIX #4: Пустые строки по умолчанию, чтобы легко было набирать
        setForm({ name: '', gradeLevel: '', studentsCount: '25', color: '#2196F3', shift: '' });
        setDialogOpen(true);
    };

    const openEdit = (item: SchoolClass) => {
        setEditing(item);
        setForm({
            name: item.name,
            gradeLevel: String(item.gradeLevel),
            studentsCount: String(item.studentsCount),
            color: item.color,
            shift: item.shift ? String(item.shift) : '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        const payload = {
            name: form.name,
            gradeLevel: Number(form.gradeLevel) || 1,
            studentsCount: Number(form.studentsCount) || 25,
            color: form.color,
            shift: form.shift ? Number(form.shift) : undefined,
        };
        try {
            if (editing) {
                await scheduleService.updateClass(editing.id, payload);
                onSuccess('Класс обновлён');
            } else {
                await scheduleService.createClass(payload);
                onSuccess('Класс создан');
            }
            setDialogOpen(false);
            load();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Ошибка сохранения');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить класс?')) return;
        try {
            await scheduleService.deleteClass(id);
            onSuccess('Класс удалён');
            load();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Ошибка удаления');
        }
    };

    const toggleExpand = (classId: number) => {
        setExpandedClassId(expandedClassId === classId ? null : classId);
    };

    const openGroupCreate = (classId: number) => {
        setGroupClassId(classId);
        setGroupForm({ name: '', studentsCount: '' });
        setGroupDialogOpen(true);
    };

    const handleGroupSave = async () => {
        if (!groupClassId || !groupForm.name.trim()) return;
        try {
            await scheduleService.addClassGroup(
                groupClassId,
                groupForm.name.trim(),
                groupForm.studentsCount ? Number(groupForm.studentsCount) : undefined
            );
            onSuccess('Подгруппа создана');
            setGroupDialogOpen(false);
            load();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Ошибка создания подгруппы');
        }
    };

    const handleGroupDelete = async (groupId: number) => {
        if (!window.confirm('Удалить подгруппу?')) return;
        try {
            await scheduleService.removeClassGroup(groupId);
            onSuccess('Подгруппа удалена');
            load();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Ошибка удаления подгруппы');
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Добавить класс</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 40 }} />
                            <TableCell>Цвет</TableCell>
                            <TableCell>Название</TableCell>
                            <TableCell>Параллель</TableCell>
                            <TableCell>Учеников</TableCell>
                            <TableCell>Смена</TableCell>
                            <TableCell>Подгруппы</TableCell>
                            <TableCell align="right">Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">Классы не добавлены</Typography>
                            </TableCell></TableRow>
                        ) : items.map((item) => (
                            <React.Fragment key={item.id}>
                                <TableRow hover>
                                    <TableCell sx={{ width: 40, p: 0.5 }}>
                                        <IconButton size="small" onClick={() => toggleExpand(item.id)}>
                                            {expandedClassId === item.id ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                                        </IconButton>
                                    </TableCell>
                                    <TableCell><Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: item.color }} /></TableCell>
                                    <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography></TableCell>
                                    <TableCell>{item.gradeLevel}</TableCell>
                                    <TableCell>{item.studentsCount}</TableCell>
                                    <TableCell>
                                        {item.shift ? (
                                            <Chip label={`${item.shift} смена`} size="small" color={item.shift === 1 ? 'primary' : 'secondary'} variant="outlined" />
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {item.groups && item.groups.length > 0 ? (
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {item.groups.map((g) => (
                                                    <Chip key={g.id} label={g.name} size="small" variant="outlined" icon={<GroupWork sx={{ fontSize: 14 }} />} />
                                                ))}
                                            </Box>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => openEdit(item)}><Edit fontSize="small" /></IconButton>
                                        <IconButton size="small" onClick={() => handleDelete(item.id)} color="error"><Delete fontSize="small" /></IconButton>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell colSpan={8} sx={{ p: 0, borderBottom: expandedClassId === item.id ? undefined : 'none' }}>
                                        <Collapse in={expandedClassId === item.id} timeout="auto" unmountOnExit>
                                            <Box sx={{ px: 4, py: 2, bgcolor: 'grey.50' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="subtitle2" color="text.secondary">Подгруппы класса {item.name}</Typography>
                                                    <Button size="small" startIcon={<Add />} onClick={() => openGroupCreate(item.id)}>Добавить подгруппу</Button>
                                                </Box>
                                                {(!item.groups || item.groups.length === 0) ? (
                                                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                        Подгруппы не созданы. Подгруппы нужны для предметов, которые изучаются не всем классом (иностранные языки, информатика, технология).
                                                    </Typography>
                                                ) : (
                                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                        {item.groups.map((group) => (
                                                            <Chip key={group.id} label={`${group.name}${group.studentsCount ? ` (${group.studentsCount} уч.)` : ''}`} onDelete={() => handleGroupDelete(group.id)} icon={<GroupWork />} variant="outlined" />
                                                        ))}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Диалог класса */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editing ? 'Редактировать класс' : 'Добавить класс'}</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ mt: 2, mb: 2 }} placeholder="Например: 5А" />
                    {/* FIX #4: Параллель как текстовое поле — пользователь может удалить значение */}
                    <TextField fullWidth label="Параллель (1-11)" type="number" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} sx={{ mb: 2 }} inputProps={{ min: 1, max: 11 }} placeholder="1" />
                    <TextField fullWidth label="Количество учеников" type="number" value={form.studentsCount} onChange={(e) => setForm({ ...form, studentsCount: e.target.value })} sx={{ mb: 2 }} placeholder="25" />
                    {/* FIX #7: Выбор смены */}
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Смена</InputLabel>
                        <Select value={form.shift} label="Смена" onChange={(e) => setForm({ ...form, shift: e.target.value as string })}>
                            <MenuItem value="">Единое время (без смен)</MenuItem>
                            <MenuItem value="1">1 смена</MenuItem>
                            <MenuItem value="2">2 смена</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField fullWidth label="Цвет" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>Сохранить</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог подгруппы */}
            <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Добавить подгруппу</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Название подгруппы" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} sx={{ mt: 2, mb: 2 }} placeholder="Группа 1, Англ. язык" />
                    <TextField fullWidth label="Количество учеников (необязательно)" type="number" value={groupForm.studentsCount} onChange={(e) => setGroupForm({ ...groupForm, studentsCount: e.target.value })} inputProps={{ min: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGroupDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleGroupSave} disabled={!groupForm.name.trim()}>Создать</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// ==================== Учителя ====================
const TeachersTab: React.FC<{ onError: (msg: string) => void; onSuccess: (msg: string) => void }> = ({ onError, onSuccess }) => {
    const [items, setItems] = useState<Teacher[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Teacher | null>(null);
    const [form, setForm] = useState({ fullName: '', shortName: '', email: '', phone: '', color: '#4CAF50', subjectIds: [] as number[] });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [teachersData, subjectsData] = await Promise.all([
                scheduleService.getTeachers(),
                scheduleService.getSubjects(),
            ]);
            setItems(Array.isArray(teachersData) ? teachersData : teachersData.teachers || []);
            setSubjects(Array.isArray(subjectsData) ? subjectsData : subjectsData.subjects || []);
        } catch {
            onError('Ошибка загрузки учителей');
        } finally {
            setLoading(false);
        }
    }, [onError]);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setEditing(null); setForm({ fullName: '', shortName: '', email: '', phone: '', color: '#4CAF50', subjectIds: [] }); setDialogOpen(true); };
    const openEdit = (item: Teacher) => { setEditing(item); setForm({ fullName: item.fullName, shortName: item.shortName, email: item.email || '', phone: item.phone || '', color: item.color, subjectIds: item.subjects?.map(s => s.id) || [] }); setDialogOpen(true); };

    const handleSave = async () => {
        try {
            if (editing) { await scheduleService.updateTeacher(editing.id, form); onSuccess('Учитель обновлён'); }
            else { await scheduleService.createTeacher(form); onSuccess('Учитель создан'); }
            setDialogOpen(false); load();
        } catch (err: any) { onError(err.response?.data?.message || 'Ошибка сохранения'); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить учителя?')) return;
        try { await scheduleService.deleteTeacher(id); onSuccess('Учитель удалён'); load(); }
        catch (err: any) { onError(err.response?.data?.message || 'Ошибка удаления'); }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Добавить учителя</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Цвет</TableCell>
                            <TableCell>ФИО</TableCell>
                            <TableCell>Краткое имя</TableCell>
                            <TableCell>Предметы</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell align="right">Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">Учителя не добавлены</Typography></TableCell></TableRow>
                        ) : items.map((item) => (
                            <TableRow key={item.id} hover>
                                <TableCell><Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: item.color }} /></TableCell>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{item.fullName}</Typography></TableCell>
                                <TableCell>{item.shortName}</TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {item.subjects?.map(s => <Chip key={s.id} label={s.shortName} size="small" />)}
                                    </Box>
                                </TableCell>
                                <TableCell>{item.email || '—'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => openEdit(item)}><Edit fontSize="small" /></IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(item.id)} color="error"><Delete fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editing ? 'Редактировать учителя' : 'Добавить учителя'}</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="ФИО" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} sx={{ mt: 2, mb: 2 }} />
                    <TextField fullWidth label="Краткое имя" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} sx={{ mb: 2 }} placeholder="Иванов И.И." />
                    <TextField fullWidth label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} sx={{ mb: 2 }} />
                    <TextField fullWidth label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} sx={{ mb: 2 }} />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Предметы</InputLabel>
                        <Select multiple value={form.subjectIds} label="Предметы" onChange={(e) => setForm({ ...form, subjectIds: e.target.value as number[] })}
                            renderValue={(sel) => (sel as number[]).map(id => subjects.find(s => s.id === id)?.shortName || id).join(', ')}>
                            {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField fullWidth label="Цвет" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!form.fullName.trim() || !form.shortName.trim()}>Сохранить</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// ==================== Предметы ====================
const SANPIN_LABELS: Record<string, string> = {
    'математика': 'Математика', 'иностранный_язык': 'Иностранный язык', 'физика': 'Физика',
    'химия': 'Химия', 'русский_язык': 'Русский язык', 'литература': 'Литература',
    'биология': 'Биология', 'информатика': 'Информатика', 'география': 'География',
    'история': 'История', 'обществознание': 'Обществознание', 'астрономия': 'Астрономия',
    'музыка': 'Музыка', 'изо': 'ИЗО', 'технология': 'Технология',
    'физкультура': 'Физкультура', 'другое': 'Другое',
};

const SubjectsTab: React.FC<{ onError: (msg: string) => void; onSuccess: (msg: string) => void }> = ({ onError, onSuccess }) => {
    const [items, setItems] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Subject | null>(null);
    const [form, setForm] = useState({ name: '', shortName: '', color: '#FF9800', sanpinCategory: 'другое', difficulty: '5' });

    const load = useCallback(async () => {
        try { setLoading(true); const data = await scheduleService.getSubjects(); setItems(Array.isArray(data) ? data : data.subjects || []); }
        catch { onError('Ошибка загрузки предметов'); }
        finally { setLoading(false); }
    }, [onError]);
    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setEditing(null); setForm({ name: '', shortName: '', color: '#FF9800', sanpinCategory: 'другое', difficulty: '5' }); setDialogOpen(true); };
    const openEdit = (item: Subject) => { setEditing(item); setForm({ name: item.name, shortName: item.shortName, color: item.color, sanpinCategory: item.sanpinCategory || 'другое', difficulty: String(item.difficulty || 5) }); setDialogOpen(true); };

    const handleSave = async () => {
        try {
            const payload = { ...form, difficulty: Number(form.difficulty) || 5, sanpinCategory: form.sanpinCategory as SanpinCategory };
            if (editing) { await scheduleService.updateSubject(editing.id, payload); onSuccess('Предмет обновлён'); }
            else { await scheduleService.createSubject(payload); onSuccess('Предмет создан'); }
            setDialogOpen(false); load();
        } catch (err: any) { onError(err.response?.data?.message || 'Ошибка сохранения'); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить предмет?')) return;
        try { await scheduleService.deleteSubject(id); onSuccess('Предмет удалён'); load(); }
        catch (err: any) { onError(err.response?.data?.message || 'Ошибка удаления'); }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Добавить предмет</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead><TableRow>
                        <TableCell>Цвет</TableCell><TableCell>Название</TableCell><TableCell>Краткое</TableCell>
                        <TableCell>Категория СанПиН</TableCell><TableCell>Сложность</TableCell><TableCell align="right">Действия</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">Предметы не добавлены</Typography></TableCell></TableRow>
                        ) : items.map((item) => (
                            <TableRow key={item.id} hover>
                                <TableCell><Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: item.color }} /></TableCell>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography></TableCell>
                                <TableCell>{item.shortName}</TableCell>
                                <TableCell>{SANPIN_LABELS[item.sanpinCategory] || item.sanpinCategory || '—'}</TableCell>
                                <TableCell>{item.difficulty || '—'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => openEdit(item)}><Edit fontSize="small" /></IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(item.id)} color="error"><Delete fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editing ? 'Редактировать предмет' : 'Добавить предмет'}</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ mt: 2, mb: 2 }} />
                    <TextField fullWidth label="Краткое название" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} sx={{ mb: 2 }} />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Категория СанПиН</InputLabel>
                        <Select value={form.sanpinCategory} label="Категория СанПиН" onChange={(e) => {
                            const cat = e.target.value;
                            const diff = getAverageDifficulty(cat);
                            setForm({ ...form, sanpinCategory: cat, difficulty: String(diff) });
                        }}>
                            {Object.entries(SANPIN_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField fullWidth label="Сложность (1-13)" type="number" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} sx={{ mb: 2 }} inputProps={{ min: 1, max: 13 }} />
                    <TextField fullWidth label="Цвет" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!form.name.trim() || !form.shortName.trim()}>Сохранить</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// ==================== Кабинеты ====================
const ROOM_TYPE_LABELS: Record<string, string> = {
    regular: 'Обычный', computer: 'Компьютерный', laboratory: 'Лаборатория', gym: 'Спортзал',
    workshop: 'Мастерская', music: 'Музыкальный', art: 'Рисование', assembly: 'Актовый зал', library: 'Библиотека',
};

const RoomsTab: React.FC<{ onError: (msg: string) => void; onSuccess: (msg: string) => void }> = ({ onError, onSuccess }) => {
    const [items, setItems] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Room | null>(null);
    const [form, setForm] = useState({ name: '', capacity: '30', floor: '', type: 'regular' });

    const load = useCallback(async () => {
        try { setLoading(true); const data = await scheduleService.getRooms(); setItems(Array.isArray(data) ? data : data.rooms || []); }
        catch { onError('Ошибка загрузки кабинетов'); }
        finally { setLoading(false); }
    }, [onError]);
    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setEditing(null); setForm({ name: '', capacity: '30', floor: '', type: 'regular' }); setDialogOpen(true); };
    const openEdit = (item: Room) => { setEditing(item); setForm({ name: item.name, capacity: String(item.capacity), floor: item.floor ? String(item.floor) : '', type: item.type }); setDialogOpen(true); };

    const handleSave = async () => {
        try {
            const payload = { name: form.name, capacity: Number(form.capacity) || 30, floor: form.floor ? Number(form.floor) : undefined, type: form.type as RoomType };
            if (editing) { await scheduleService.updateRoom(editing.id, payload); onSuccess('Кабинет обновлён'); }
            else { await scheduleService.createRoom(payload); onSuccess('Кабинет создан'); }
            setDialogOpen(false); load();
        } catch (err: any) { onError(err.response?.data?.message || 'Ошибка сохранения'); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить кабинет?')) return;
        try { await scheduleService.deleteRoom(id); onSuccess('Кабинет удалён'); load(); }
        catch (err: any) { onError(err.response?.data?.message || 'Ошибка удаления'); }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Добавить кабинет</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead><TableRow>
                        <TableCell>Название</TableCell><TableCell>Тип</TableCell><TableCell>Вместимость</TableCell>
                        <TableCell>Этаж</TableCell><TableCell align="right">Действия</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="text.secondary">Кабинеты не добавлены</Typography></TableCell></TableRow>
                        ) : items.map((item) => (
                            <TableRow key={item.id} hover>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography></TableCell>
                                <TableCell>{ROOM_TYPE_LABELS[item.type] || item.type}</TableCell>
                                <TableCell>{item.capacity}</TableCell>
                                <TableCell>{item.floor || '—'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => openEdit(item)}><Edit fontSize="small" /></IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(item.id)} color="error"><Delete fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editing ? 'Редактировать кабинет' : 'Добавить кабинет'}</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ mt: 2, mb: 2 }} />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Тип</InputLabel>
                        <Select value={form.type} label="Тип" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField fullWidth label="Вместимость" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} sx={{ mb: 2 }} />
                    <TextField fullWidth label="Этаж" type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>Сохранить</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// ==================== FIX #5, #6: Расписание звонков ====================
const BellScheduleTab: React.FC<{ onError: (msg: string) => void; onSuccess: (msg: string) => void }> = ({ onError, onSuccess }) => {
    const [items, setItems] = useState<BellSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<number>(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<BellSchedule | null>(null);
    const [form, setForm] = useState({ lessonNumber: '', startTime: '08:30', endTime: '09:15', breakAfter: '10', name: '' });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await scheduleService.getBellSchedules();
            setItems(Array.isArray(data) ? data : data.bellSchedules || []);
        } catch {
            onError('Ошибка загрузки расписания звонков');
        } finally {
            setLoading(false);
        }
    }, [onError]);
    useEffect(() => { load(); }, [load]);

    const filteredItems = items.filter(b => (b.shift || 1) === selectedShift).sort((a, b) => a.lessonNumber - b.lessonNumber);

    const openCreate = () => {
        setEditing(null);
        const nextNum = filteredItems.length > 0 ? Math.max(...filteredItems.map(b => b.lessonNumber)) + 1 : 1;
        const lastEnd = filteredItems.length > 0 ? filteredItems[filteredItems.length - 1].endTime : (selectedShift === 1 ? '08:15' : '13:15');
        const lastBreak = filteredItems.length > 0 ? filteredItems[filteredItems.length - 1].breakAfter : 10;
        // Авто-подсчёт начала следующего урока
        const [h, m] = lastEnd.split(':').map(Number);
        const startMin = h * 60 + m + lastBreak;
        const startH = String(Math.floor(startMin / 60)).padStart(2, '0');
        const startM = String(startMin % 60).padStart(2, '0');
        const endMin = startMin + 45;
        const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
        const endM = String(endMin % 60).padStart(2, '0');
        setForm({ lessonNumber: String(nextNum), startTime: `${startH}:${startM}`, endTime: `${endH}:${endM}`, breakAfter: '10', name: '' });
        setDialogOpen(true);
    };

    const openEdit = (item: BellSchedule) => {
        setEditing(item);
        setForm({ lessonNumber: String(item.lessonNumber), startTime: item.startTime.slice(0, 5), endTime: item.endTime.slice(0, 5), breakAfter: String(item.breakAfter), name: item.name || '' });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            const payload = {
                lessonNumber: Number(form.lessonNumber),
                startTime: form.startTime,
                endTime: form.endTime,
                breakAfter: Number(form.breakAfter) || 10,
                name: form.name || undefined,
                shift: selectedShift,
            };
            if (editing) {
                await scheduleService.updateBellSchedule(editing.id, payload);
                onSuccess('Звонок обновлён');
            } else {
                await scheduleService.createBellSchedule(payload);
                onSuccess('Звонок добавлен');
            }
            setDialogOpen(false);
            load();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Ошибка сохранения');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить звонок?')) return;
        try { await scheduleService.deleteBellSchedule(id); onSuccess('Звонок удалён'); load(); }
        catch (err: any) { onError(err.response?.data?.message || 'Ошибка удаления'); }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                {/* FIX #6: Переключатель смен */}
                <ToggleButtonGroup value={selectedShift} exclusive onChange={(_, v) => v !== null && setSelectedShift(v)} size="small">
                    <ToggleButton value={1}>1 смена</ToggleButton>
                    <ToggleButton value={2}>2 смена</ToggleButton>
                </ToggleButtonGroup>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Добавить звонок</Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>№ урока</TableCell>
                            <TableCell>Начало</TableCell>
                            <TableCell>Конец</TableCell>
                            <TableCell>Перемена (мин)</TableCell>
                            <TableCell>Название</TableCell>
                            <TableCell align="right">Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredItems.length === 0 ? (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">Звонки для {selectedShift} смены не настроены</Typography>
                            </TableCell></TableRow>
                        ) : filteredItems.map((item) => (
                            <TableRow key={item.id} hover>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{item.lessonNumber}</Typography></TableCell>
                                <TableCell>{item.startTime.slice(0, 5)}</TableCell>
                                <TableCell>{item.endTime.slice(0, 5)}</TableCell>
                                <TableCell>{item.breakAfter} мин</TableCell>
                                <TableCell>{item.name || '—'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => openEdit(item)}><Edit fontSize="small" /></IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(item.id)} color="error"><Delete fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{editing ? 'Редактировать звонок' : 'Добавить звонок'}</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Номер урока" type="number" value={form.lessonNumber} onChange={(e) => setForm({ ...form, lessonNumber: e.target.value })} sx={{ mt: 2, mb: 2 }} inputProps={{ min: 1, max: 10 }} />
                    <TextField fullWidth label="Начало (ЧЧ:ММ)" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />
                    <TextField fullWidth label="Конец (ЧЧ:ММ)" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />
                    <TextField fullWidth label="Перемена после (мин)" type="number" value={form.breakAfter} onChange={(e) => setForm({ ...form, breakAfter: e.target.value })} sx={{ mb: 2 }} />
                    <TextField fullWidth label="Название (необязательно)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Большая перемена" />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!form.lessonNumber || !form.startTime || !form.endTime}>Сохранить</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// ==================== FIX #9: Предпочтения учителей ====================
const PREF_COLORS: Record<number, string> = {
    [-2]: '#ef5350', [-1]: '#ffab91', [0]: '#e0e0e0', [1]: '#a5d6a7', [2]: '#66bb6a',
};
const PREF_LABELS: Record<number, string> = {
    [-2]: 'Невозможно', [-1]: 'Нежелательно', [0]: 'Нейтрально', [1]: 'Хорошо', [2]: 'Предпочтительно',
};

const TeacherAvailabilityTab: React.FC<{ onError: (msg: string) => void; onSuccess: (msg: string) => void }> = ({ onError, onSuccess }) => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
    const [availability, setAvailability] = useState<TeacherAvailability[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
    const [popoverCell, setPopoverCell] = useState<{ day: number; lesson: number } | null>(null);

    const maxLessons = 8;
    const days = DAYS_OF_WEEK.filter(d => d.num <= 6);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const data = await scheduleService.getTeachers();
                const list = Array.isArray(data) ? data : data.teachers || [];
                setTeachers(list);
                if (list.length > 0) setSelectedTeacherId(list[0].id);
            } catch {
                onError('Ошибка загрузки учителей');
            } finally {
                setLoading(false);
            }
        })();
    }, [onError]);

    useEffect(() => {
        if (!selectedTeacherId) return;
        (async () => {
            try {
                const data = await scheduleService.getTeacherAvailability(selectedTeacherId);
                setAvailability(Array.isArray(data) ? data : data.availability || []);
            } catch {
                setAvailability([]);
            }
        })();
    }, [selectedTeacherId]);

    const getSlotPref = (day: number, lesson: number): number => {
        const slot = availability.find(a => a.dayOfWeek === day && a.lessonNumber === lesson);
        if (slot && !slot.isAvailable) return -2;
        return slot?.preference || 0;
    };

    const handleCellClick = (event: React.MouseEvent<HTMLElement>, day: number, lesson: number) => {
        setPopoverAnchor(event.currentTarget);
        setPopoverCell({ day, lesson });
    };

    const handleSelectPref = async (newPref: number) => {
        if (!selectedTeacherId || !popoverCell) return;
        const { day, lesson } = popoverCell;
        const isAvailable = newPref > -2;
        setPopoverAnchor(null); setPopoverCell(null);
        try {
            setSaving(true);
            await scheduleService.setTeacherAvailability(selectedTeacherId, { dayOfWeek: day, lessonNumber: lesson, isAvailable, preference: newPref });
            setAvailability(prev => {
                const filtered = prev.filter(a => !(a.dayOfWeek === day && a.lessonNumber === lesson));
                return [...filtered, { id: 0, teacherId: selectedTeacherId, dayOfWeek: day, lessonNumber: lesson, isAvailable, preference: newPref }];
            });
        } catch { onError('Ошибка сохранения предпочтения'); }
        finally { setSaving(false); }
    };

    const currentPopoverPref = popoverCell ? getSlotPref(popoverCell.day, popoverCell.lesson) : 0;

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

    return (
        <>
            <Box sx={{ mb: 2 }}>
                <FormControl sx={{ minWidth: 300 }}>
                    <InputLabel>Учитель</InputLabel>
                    <Select value={selectedTeacherId || ''} label="Учитель" onChange={(e) => setSelectedTeacherId(Number(e.target.value))}>
                        {teachers.map(t => <MenuItem key={t.id} value={t.id}>{t.fullName}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            {selectedTeacherId && (
                <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Нажмите на ячейку, чтобы переключить предпочтение. Эти настройки учитываются при автоматическом составлении расписания.
                    </Typography>

                    <TableContainer component={Paper} sx={{ maxWidth: 700 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Урок</TableCell>
                                    {days.map(d => <TableCell key={d.num} align="center">{d.short}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Array.from({ length: maxLessons }, (_, i) => i + 1).map(lesson => (
                                    <TableRow key={lesson}>
                                        <TableCell>{lesson}</TableCell>
                                        {days.map(d => {
                                            const pref = getSlotPref(d.num, lesson);
                                            return (
                                                <TableCell key={d.num} align="center" sx={{ p: 0.5 }}>
                                                    <Tooltip title={PREF_LABELS[pref] || 'Нейтрально'}>
                                                        <Box
                                                            onClick={(e) => handleCellClick(e, d.num, lesson)}
                                                            sx={{
                                                                width: 40,
                                                                height: 32,
                                                                bgcolor: PREF_COLORS[pref] || '#e0e0e0',
                                                                borderRadius: 1,
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                mx: 'auto',
                                                                transition: 'all 0.15s',
                                                                '&:hover': { opacity: 0.8 },
                                                            }}
                                                        >
                                                            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: pref <= -2 ? '#fff' : 'text.primary' }}>
                                                                {pref === -2 ? '✕' : pref > 0 ? `+${pref}` : pref < 0 ? pref : ''}
                                                            </Typography>
                                                        </Box>
                                                    </Tooltip>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Popover для выбора предпочтения */}
                    <Popover open={Boolean(popoverAnchor)} anchorEl={popoverAnchor}
                        onClose={() => { setPopoverAnchor(null); setPopoverCell(null); }}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'center' }}>
                        <MuiList dense sx={{ minWidth: 180, py: 0.5 }}>
                            {([2, 1, 0, -1, -2] as number[]).map((val) => (
                                <ListItemButton key={val} selected={currentPopoverPref === val} onClick={() => handleSelectPref(val)} sx={{ py: 0.5 }}>
                                    <MuiListItemIcon sx={{ minWidth: 28 }}>
                                        <Box sx={{ width: 16, height: 16, bgcolor: PREF_COLORS[val], borderRadius: 0.5, border: '1px solid rgba(0,0,0,0.1)' }} />
                                    </MuiListItemIcon>
                                    <ListItemText primary={PREF_LABELS[val]} primaryTypographyProps={{ variant: 'body2' }} />
                                </ListItemButton>
                            ))}
                        </MuiList>
                    </Popover>

                    {/* Легенда */}
                    <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                        {Object.entries(PREF_LABELS).map(([k, v]) => (
                            <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 16, height: 16, bgcolor: PREF_COLORS[Number(k)], borderRadius: 0.5 }} />
                                <Typography variant="caption">{v}</Typography>
                            </Box>
                        ))}
                    </Box>
                </>
            )}
        </>
    );
};

// ==================== Главная страница ====================
const ScheduleManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [tabIndex, setTabIndex] = useState(0);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

    // Тип учреждения
    const [institutionType, setInstitutionType] = useState(() => {
        try { return localStorage.getItem('plantakt_institution_type') || 'school'; }
        catch { return 'school'; }
    });
    const terms = getTerms(institutionType);

    const handleInstitutionChange = (type: string) => {
        setInstitutionType(type);
        try { localStorage.setItem('plantakt_institution_type', type); } catch {}
    };

    const handleError = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'error' });
    const handleSuccess = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'success' });

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Tooltip title="Назад к расписанию">
                    <IconButton onClick={() => navigate('/schedule')}>
                        <ArrowBack />
                    </IconButton>
                </Tooltip>
                <Typography variant="h5">Настройки для создания расписания</Typography>
            </Box>

            {/* Тип учреждения */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Тип учреждения</InputLabel>
                    <Select value={institutionType} label="Тип учреждения" onChange={(e) => handleInstitutionChange(e.target.value)}>
                        {INSTITUTION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                </FormControl>
                {institutionType !== 'school' && (
                    <Alert severity="info" sx={{ py: 0 }}>
                        {terms.lessonLabel} = {terms.defaultLessonDuration} мин ({terms.academicHoursPerLesson} акад. ч.) · Макс {terms.defaultMaxLessons} {terms.lessonLabelPlural.toLowerCase()} в день
                    </Alert>
                )}
            </Box>

            <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, v) => setTabIndex(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab icon={<School />} label={terms.classLabelPlural} iconPosition="start" />
                    <Tab icon={<Person />} label={terms.teacherLabelPlural} iconPosition="start" />
                    <Tab icon={<MenuBook />} label="Предметы" iconPosition="start" />
                    <Tab icon={<MeetingRoom />} label={terms.roomLabelPlural} iconPosition="start" />
                    <Tab icon={<AccessTime />} label="Звонки" iconPosition="start" />
                    <Tab icon={<Schedule />} label="Предпочтения" iconPosition="start" />
                </Tabs>
            </Paper>

            <TabPanel value={tabIndex} index={0}>
                <ClassesTab onError={handleError} onSuccess={handleSuccess} />
            </TabPanel>
            <TabPanel value={tabIndex} index={1}>
                <TeachersTab onError={handleError} onSuccess={handleSuccess} />
            </TabPanel>
            <TabPanel value={tabIndex} index={2}>
                <SubjectsTab onError={handleError} onSuccess={handleSuccess} />
            </TabPanel>
            <TabPanel value={tabIndex} index={3}>
                <RoomsTab onError={handleError} onSuccess={handleSuccess} />
            </TabPanel>
            <TabPanel value={tabIndex} index={4}>
                <BellScheduleTab onError={handleError} onSuccess={handleSuccess} />
            </TabPanel>
            <TabPanel value={tabIndex} index={5}>
                <TeacherAvailabilityTab onError={handleError} onSuccess={handleSuccess} />
            </TabPanel>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default ScheduleManagementPage;
