import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Container, Typography, Paper, List, ListItem, ListItemText,
    Button, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import { Home, CheckCircle, Cancel, Refresh, HowToReg } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';

interface PendingUser {
    id: number;
    fullName: string;
    createdAt: string;
}

const PendingApprovalsPage: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            setUsers(await authService.getPendingUsers());
        } catch {
            setError('Не удалось загрузить список');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const approve = async (id: number) => {
        setBusyId(id);
        try { await authService.approveUser(id); setUsers((p) => p.filter((u) => u.id !== id)); }
        catch { setError('Не удалось подтвердить'); }
        finally { setBusyId(null); }
    };
    const reject = async (id: number, name: string) => {
        if (!window.confirm(`Отклонить вход «${name}»? Пользователь не сможет войти, пока не запросит снова.`)) return;
        setBusyId(id);
        try { await authService.rejectUser(id); setUsers((p) => p.filter((u) => u.id !== id)); }
        catch { setError('Не удалось отклонить'); }
        finally { setBusyId(null); }
    };

    return (
        <Container maxWidth="md" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Tooltip title="На главную"><IconButton onClick={() => navigate('/dashboard')}><Home /></IconButton></Tooltip>
                <HowToReg color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h4" sx={{ flexGrow: 1 }}>Подтверждение входа</Typography>
                <Tooltip title="Обновить"><IconButton onClick={load}><Refresh /></IconButton></Tooltip>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Новые пользователи входят по паролю школы, но их первый вход должен подтвердить администратор.
                После подтверждения вход разрешён навсегда.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : users.length === 0 ? (
                <Alert severity="success">Нет запросов на подтверждение.</Alert>
            ) : (
                <Paper variant="outlined">
                    <List>
                        {users.map((u) => (
                            <ListItem
                                key={u.id}
                                divider
                                secondaryAction={
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                                            disabled={busyId === u.id} onClick={() => approve(u.id)}>Подтвердить</Button>
                                        <Button size="small" variant="outlined" color="error" startIcon={<Cancel />}
                                            disabled={busyId === u.id} onClick={() => reject(u.id, u.fullName)}>Отклонить</Button>
                                    </Box>
                                }
                            >
                                <ListItemText
                                    primary={u.fullName}
                                    secondary={`Запрос: ${new Date(u.createdAt).toLocaleString('ru-RU')}`}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            )}
        </Container>
    );
};

export default PendingApprovalsPage;
