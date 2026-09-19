import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Container, Typography, Paper, List, ListItem,
    Button, CircularProgress, Alert, IconButton, Tooltip, Tabs, Tab, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, Divider, Table, TableBody,
    TableCell, TableHead, TableRow,
} from '@mui/material';
import { Home, CheckCircle, Cancel, Refresh, People, Block, Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { usersService, UserRow, UserCard } from '../services/users.service';

const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const weekTypeLabel = (weekType: string): string => {
    if (weekType === 'odd') return ' · I нед.';
    if (weekType === 'even') return ' · II нед.';
    return '';
};

const hoursLabel = (hours: number): string => {
    const mod10 = hours % 10;
    const mod100 = hours % 100;
    if (mod10 === 1 && mod100 !== 11) return `${hours} час`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${hours} часа`;
    return `${hours} часов`;
};

/** Короткая строка ролей для списка: категории и предметы с часами. */
const RoleChips: React.FC<{ user: UserRow }> = ({ user }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {user.categories.map((c) => (
            <Chip key={c} size="small" label={c} variant="outlined" />
        ))}
        {user.load.map((l) => (
            <Chip
                key={l.subject}
                size="small"
                color="primary"
                variant="outlined"
                label={`${l.subject} · ${l.hours} ч`}
            />
        ))}
        {user.categories.length === 0 && user.load.length === 0 && (
            <Typography variant="caption" color="text.secondary">
                Роли не указаны
            </Typography>
        )}
    </Box>
);

const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [tab, setTab] = useState(0);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [versionName, setVersionName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    // Карточка выбранного пользователя
    const [card, setCard] = useState<UserCard | null>(null);
    const [cardLoading, setCardLoading] = useState(false);
    const [cardOpen, setCardOpen] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const data = await usersService.getOverview();
            setUsers(data.users);
            setVersionName(data.scheduleVersion?.name || null);
        } catch {
            setError('Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCard = async (id: number) => {
        setCardOpen(true); setCardLoading(true); setCard(null);
        try {
            setCard(await usersService.getCard(id));
        } catch {
            setError('Не удалось загрузить карточку пользователя');
            setCardOpen(false);
        } finally {
            setCardLoading(false);
        }
    };

    const patchUser = (id: number, approved: boolean) => {
        setUsers((p) => p.map((u) => (u.id === id ? { ...u, approved } : u)));
        setCard((c) => (c && c.id === id ? { ...c, approved } : c));
    };

    const approve = async (id: number) => {
        setBusyId(id);
        try { await authService.approveUser(id); patchUser(id, true); }
        catch { setError('Не удалось подтвердить'); }
        finally { setBusyId(null); }
    };
    const revoke = async (id: number) => {
        setBusyId(id);
        try { await authService.revokeUser(id); patchUser(id, false); }
        catch { setError('Не удалось отозвать доступ'); }
        finally { setBusyId(null); }
    };
    const reject = async (id: number, name: string) => {
        if (!window.confirm(`Удалить пользователя «${name}»? Его история выполнения будет удалена, при следующем входе потребуется подтверждение.`)) return;
        setBusyId(id);
        try {
            await authService.rejectUser(id);
            setUsers((p) => p.filter((u) => u.id !== id));
            setCardOpen(false);
        }
        catch { setError('Не удалось удалить'); }
        finally { setBusyId(null); }
    };

    const pending = users.filter((u) => !u.approved);
    const list = tab === 0 ? users : pending;

    const renderActions = (u: { id: number; fullName: string; approved: boolean }) => (
        <Box sx={{ display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
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

    // Уроки в карточке группируем по дням недели
    const lessonsByDay = (c: UserCard) => {
        const map = new Map<number, UserCard['lessons']>();
        c.lessons.forEach((l) => {
            const day = map.get(l.dayOfWeek) || [];
            day.push(l);
            map.set(l.dayOfWeek, day);
        });
        return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    };

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

            {tab === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {versionName
                        ? `Часы нагрузки взяты из расписания «${versionName}». Нажмите на человека, чтобы открыть карточку.`
                        : 'Расписание ещё не создано, поэтому часы нагрузки не показаны. Нажмите на человека, чтобы открыть карточку.'}
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
                    <List disablePadding>
                        {list.map((u) => (
                            <ListItem
                                key={u.id}
                                divider
                                onClick={() => openCard(u.id)}
                                sx={{
                                    cursor: 'pointer',
                                    alignItems: 'flex-start',
                                    gap: 2,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{u.fullName}</Typography>
                                        <Chip size="small" label={u.approved ? 'Подтверждён' : 'Ожидает'}
                                            color={u.approved ? 'success' : 'warning'} variant="outlined" />
                                        {u.isAdmin && <Chip size="small" label="Администратор" color="primary" />}
                                    </Box>
                                    <RoleChips user={u} />
                                </Box>

                                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                    {u.totalHours > 0 && (
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                            {u.totalHours} ч/нед
                                        </Typography>
                                    )}
                                    {renderActions(u)}
                                </Box>
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            )}

            {/* Карточка пользователя */}
            <Dialog open={cardOpen} onClose={() => setCardOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>{card?.fullName || 'Карточка пользователя'}</Box>
                    <IconButton onClick={() => setCardOpen(false)}><Close /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {cardLoading || !card ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip size="small" label={card.approved ? 'Доступ подтверждён' : 'Ожидает подтверждения'}
                                    color={card.approved ? 'success' : 'warning'} variant="outlined" />
                                {card.isAdmin && <Chip size="small" label="Администратор" color="primary" />}
                                {card.teacher && <Chip size="small" label={`В расписании: ${card.teacher.shortName}`} />}
                                <Chip size="small" variant="outlined"
                                    label={`Первый вход: ${new Date(card.createdAt).toLocaleDateString('ru-RU')}`} />
                            </Box>

                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Роли и нагрузка</Typography>
                                {card.categories.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                                        {card.categories.map((c) => <Chip key={c} size="small" label={c} variant="outlined" />)}
                                    </Box>
                                )}
                                {card.load.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {card.teacher
                                            ? 'В активном расписании нагрузка не назначена.'
                                            : 'Карточки учителя в расписании нет, поэтому часы не рассчитаны.'}
                                    </Typography>
                                ) : (
                                    <>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Предмет</TableCell>
                                                    <TableCell>Классы</TableCell>
                                                    <TableCell align="right">Часов в неделю</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {card.load.map((l) => (
                                                    <TableRow key={l.subject}>
                                                        <TableCell>{l.subject}</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>
                                                            {l.classes.join(', ') || '—'}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 600 }}>{l.hours}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                                            Итого: {hoursLabel(card.totalHours)} в неделю
                                        </Typography>
                                    </>
                                )}
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Уроки на неделю</Typography>
                                {card.lessons.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Уроков в активном расписании нет.
                                    </Typography>
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {lessonsByDay(card).map(([day, lessons]) => (
                                            <Box key={day}>
                                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                    {DAY_NAMES[day] || `День ${day}`}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {lessons.map((l, i) => (
                                                        <Chip
                                                            key={`${day}-${l.lessonNumber}-${i}`}
                                                            size="small"
                                                            variant="outlined"
                                                            label={`${l.lessonNumber}. ${l.subject}${l.className ? ` · ${l.className}` : ''}${l.room ? ` · каб. ${l.room}` : ''}${weekTypeLabel(l.weekType)}`}
                                                        />
                                                    ))}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Задачи</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1 }}>
                                    {[
                                        { label: 'Назначено', value: card.taskStats.assigned },
                                        { label: 'Выполнено', value: card.taskStats.completed },
                                        { label: 'В срок', value: card.taskStats.onTime },
                                        { label: 'С опозданием', value: card.taskStats.late },
                                        { label: 'Просрочено', value: card.taskStats.overdue },
                                        { label: 'Создал сам', value: card.taskStats.created },
                                    ].map((s) => (
                                        <Paper key={s.label} variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>{s.value}</Typography>
                                            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                                        </Paper>
                                    ))}
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Доля выполненных задач: {card.taskStats.completionRate}%
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    {card && renderActions(card)}
                    <Box sx={{ flexGrow: 1 }} />
                    <Button onClick={() => setCardOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default UsersPage;
