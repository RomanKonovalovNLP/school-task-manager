import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Container, Typography, Paper, List, ListItem, ListItemText,
    Button, CircularProgress, Alert, IconButton, Tooltip, Tabs, Tab, Chip,
} from '@mui/material';
import { Home, CheckCircle, Cancel, Refresh, People, Block } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';

interface UserRow {
    id: number;
    fullName: string;
    approved: boolean;
    createdAt: string;
}

const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [tab, setTab] = useState(0);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            setUsers(await authService.getAllUsers());
        } catch {
            setError('Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const approve = async (id: number) => {
        setBusyId(id);
        try { await authService.approveUser(id); setUsers((p) => p.map((u) => (u.id === id ? { ...u, approved: true } : u))); }
        catch { setError('Не удалось подтвердить'); }
        finally { setBusyId(null); }
    };
    const revoke = async (id: number) => {
        setBusyId(id);
        try { await authService.revokeUser(id); setUsers((p) => p.map((u) => (u.id === id ? { ...u, approved: false } : u))); }
        catch { setError('Не удалось отозвать доступ'); }
        finally { setBusyId(null); }
    };
    const reject = async (id: number, name: string) => {
        if (!window.confirm(`Удалить пользователя «${name}»? Его история выполнения будет удалена, при следующем входе потребуется подтверждение.`)) return;
        setBusyId(id);
        try { await authService.rejectUser(id); setUsers((p) => p.filter((u) => u.id !== id)); }
        catch { setError('Не удалось удалить'); }
        finally { setBusyId(null); }
    };

    const pending = users.filter((u) => !u.approved);
    const list = tab === 0 ? users : pending;

    const renderActions = (u: UserRow) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
            {!u.approved ? (
                <>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                        disabled={busyId === u.id} onClick={() => approve(u.id)}>Подтвердить</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<Cancel />}
                        disabled={busyId === u.id} onClick={() => reject(u.id, u.fullName)}>Отклонить</Button>
                </>
            ) : (
                <Button size="small" variant="outlined" color="warning" startIcon={<Block />}
                    disabled={busyId === u.id} onClick={() => revoke(u.id)}>Отозвать доступ</Button>
            )}
        </Box>
    );

    return (
        <Container maxWidth="md" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Tooltip title="На главную"><IconButton onClick={() => navigate('/dashboard')}><Home /></IconButton></Tooltip>
                <People color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h4" sx={{ flexGrow: 1 }}>Пользователи</Typography>
                <Tooltip title="Обновить"><IconButton onClick={load}><Refresh /></IconButton></Tooltip>
            </Box>

            <Paper sx={{ mb: 2 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label={`Все пользователи (${users.length})`} />
                    <Tab label={`Подтверждение входа (${pending.length})`} />
                </Tabs>
            </Paper>

            {tab === 1 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Новые пользователи входят по паролю школы, но их первый вход должен подтвердить администратор.
                    После подтверждения вход разрешён навсегда.
                </Typography>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : list.length === 0 ? (
                <Alert severity={tab === 1 ? 'success' : 'info'}>
                    {tab === 1 ? 'Нет запросов на подтверждение.' : 'Пользователей пока нет.'}
                </Alert>
            ) : (
                <Paper variant="outlined">
                    <List>
                        {list.map((u) => (
                            <ListItem key={u.id} divider secondaryAction={renderActions(u)}>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {u.fullName}
                                            <Chip size="small" label={u.approved ? 'Подтверждён' : 'Ожидает'}
                                                color={u.approved ? 'success' : 'warning'} variant="outlined" />
                                        </Box>
                                    }
                                    secondary={`Первый вход: ${new Date(u.createdAt).toLocaleString('ru-RU')}`}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            )}
        </Container>
    );
};

export default UsersPage;
