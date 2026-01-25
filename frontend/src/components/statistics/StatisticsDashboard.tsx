import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Alert,
    Menu,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Tabs,
    Tab,
} from '@mui/material';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import {
    Assessment,
    TrendingUp,
    Category,
    Person,
    FileDownload,
    ExpandMore,
    School,
} from '@mui/icons-material';
import {
    statisticsService,
    Statistics,
    TrendData,
    CategoryStatistics,
    CreatorStatistics,
    UserStatisticsResponse,
    TasksCompletionResponse,
} from '../../services/statistics.service';
import MainLayout from '../layout/MainLayout';

// Цвета для графиков
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#f44336',
    medium: '#ff9800',
    low: '#4caf50',
    overdue: '#9c27b0',
};

// Компонент для сетки (замена Grid)
const GridContainer: React.FC<{ children: React.ReactNode; spacing?: number }> = ({ children, spacing = 3 }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', margin: -spacing / 2 }}>
        {React.Children.map(children, child => (
            <Box sx={{ padding: spacing / 2 }}>{child}</Box>
        ))}
    </Box>
);

const GridItem: React.FC<{ 
    children: React.ReactNode; 
    xs?: number; 
    sm?: number; 
    md?: number;
}> = ({ children, xs = 12, sm, md }) => {
    const getWidth = (cols: number) => `${(cols / 12) * 100}%`;
    return (
        <Box sx={{
            width: { xs: getWidth(xs), sm: sm ? getWidth(sm) : undefined, md: md ? getWidth(md) : undefined },
            flexShrink: 0,
        }}>
            {children}
        </Box>
    );
};

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`statistics-tabpanel-${index}`}
            aria-labelledby={`statistics-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

// Простой label для PieChart
const renderPieLabel = (entry: { name?: string; percent?: number }) => {
    const name = entry.name || '';
    const percent = entry.percent || 0;
    return `${name} ${(percent * 100).toFixed(0)}%`;
};

export default function StatisticsDashboard() {
    const [statistics, setStatistics] = useState<Statistics | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [categoryStats, setCategoryStats] = useState<CategoryStatistics | null>(null);
    const [creatorStats, setCreatorStats] = useState<CreatorStatistics | null>(null);
    const [userStats, setUserStats] = useState<UserStatisticsResponse | null>(null);
    const [tasksCompletion, setTasksCompletion] = useState<TasksCompletionResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);

    // Меню экспорта
    const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);

    const loadStatistics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [stats, trendData, categories, creators] = await Promise.all([
                statisticsService.getStatistics(),
                statisticsService.getTrends(30),
                statisticsService.getCategoryStatistics(),
                statisticsService.getCreatorStatistics(),
            ]);

            setStatistics(stats);
            setTrends(trendData);
            setCategoryStats(categories);
            setCreatorStats(creators);

            // Пробуем загрузить админ-статистику (может быть недоступна)
            try {
                const [users, tasks] = await Promise.all([
                    statisticsService.getUserStatistics(),
                    statisticsService.getTasksCompletionStatistics(),
                ]);
                setUserStats(users);
                setTasksCompletion(tasks);
            } catch {
                // Админ-статистика недоступна - это нормально для обычных пользователей
            }
        } catch (err: unknown) {
            console.error('Error loading statistics:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки статистики';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatistics();
    }, [loadStatistics]);

    const handleExportClose = () => {
        setExportAnchor(null);
    };

    // Подготовка данных для графиков
    const priorityData = statistics ? [
        { name: 'Срочный', value: statistics.tasksByPriority.urgent, color: PRIORITY_COLORS.urgent },
        { name: 'Средний', value: statistics.tasksByPriority.medium, color: PRIORITY_COLORS.medium },
        { name: 'Низкий', value: statistics.tasksByPriority.low, color: PRIORITY_COLORS.low },
        { name: 'Просрочен', value: statistics.tasksByPriority.overdue, color: PRIORITY_COLORS.overdue },
    ] : [];

    const categoryData = categoryStats?.categories.map((cat, index) => ({
        name: cat.name,
        count: cat.count,
        fill: COLORS[index % COLORS.length],
    })) || [];

    const creatorData = creatorStats?.creators.slice(0, 10).map((creator, index) => ({
        name: creator.name.split(' ').slice(0, 2).join(' '),
        count: creator.count,
        fill: COLORS[index % COLORS.length],
    })) || [];

    const trendChartData = trends.map((t) => ({
        date: new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        total: t.totalTasks,
        completed: t.completedTasks,
        overdue: t.overdueTasks,
    }));

    if (loading) {
        return (
            <MainLayout>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <CircularProgress size={60} />
                </Box>
            </MainLayout>
        );
    }

    if (error) {
        return (
            <MainLayout>
                <Box sx={{ p: 3 }}>
                    <Alert severity="error" action={
                        <Button color="inherit" size="small" onClick={loadStatistics}>
                            Повторить
                        </Button>
                    }>
                        {error}
                    </Alert>
                </Box>
            </MainLayout>
        );
    }

    if (!statistics) {
        return (
            <MainLayout>
                <Box sx={{ p: 3 }}>
                    <Alert severity="info">Нет данных для отображения</Alert>
                </Box>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <Box sx={{ p: 3 }}>
                {/* Заголовок */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Assessment /> Статистика
                    </Typography>
                    <Box>
                        <Button
                            variant="outlined"
                            startIcon={<FileDownload />}
                            onClick={(e) => setExportAnchor(e.currentTarget)}
                            disabled
                        >
                            Экспорт
                        </Button>
                        <Menu
                            anchorEl={exportAnchor}
                            open={Boolean(exportAnchor)}
                            onClose={handleExportClose}
                        >
                            <MenuItem disabled>Excel (.xlsx)</MenuItem>
                            <MenuItem disabled>CSV (.csv)</MenuItem>
                            <MenuItem disabled>PDF (.pdf)</MenuItem>
                        </Menu>
                    </Box>
                </Box>

                {/* Табы */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                        <Tab label="Общая статистика" icon={<Assessment />} iconPosition="start" />
                        {userStats && <Tab label="По пользователям" icon={<Person />} iconPosition="start" />}
                        {tasksCompletion && <Tab label="По задачам" icon={<School />} iconPosition="start" />}
                    </Tabs>
                </Box>

                {/* Общая статистика (Tab 0) */}
                <TabPanel value={tabValue} index={0}>
                    {/* Карточки с основными показателями */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                        <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                            <Card>
                                <CardContent>
                                    <Typography color="text.secondary" gutterBottom>Всего задач</Typography>
                                    <Typography variant="h4">{statistics.totalTasks}</Typography>
                                </CardContent>
                            </Card>
                        </Box>
                        <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                            <Card>
                                <CardContent>
                                    <Typography color="text.secondary" gutterBottom>Выполнено</Typography>
                                    <Typography variant="h4" color="success.main">{statistics.completedTasks}</Typography>
                                </CardContent>
                            </Card>
                        </Box>
                        <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                            <Card>
                                <CardContent>
                                    <Typography color="text.secondary" gutterBottom>Просрочено</Typography>
                                    <Typography variant="h4" color="error.main">{statistics.overdueTasks}</Typography>
                                </CardContent>
                            </Card>
                        </Box>
                        <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                            <Card>
                                <CardContent>
                                    <Typography color="text.secondary" gutterBottom>Процент выполнения</Typography>
                                    <Typography variant="h4" color="primary.main">
                                        {statistics.completionRate.toFixed(1)}%
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    </Box>

                    {/* Графики */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {/* Тренды */}
                        <Box sx={{ flex: '2 1 500px', minWidth: 300 }}>
                            <Paper sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TrendingUp /> Тренды за 30 дней
                                </Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={trendChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="total" name="Всего" stroke="#8884d8" />
                                        <Line type="monotone" dataKey="completed" name="Выполнено" stroke="#82ca9d" />
                                        <Line type="monotone" dataKey="overdue" name="Просрочено" stroke="#ff7300" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Box>

                        {/* Распределение по приоритетам */}
                        <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                            <Paper sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom>По приоритетам</Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={priorityData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={renderPieLabel}
                                            outerRadius={80}
                                            dataKey="value"
                                        >
                                            {priorityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Box>

                        {/* По категориям */}
                        <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
                            <Paper sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Category /> По категориям
                                </Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={categoryData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} />
                                        <RechartsTooltip />
                                        <Bar dataKey="count" name="Задач" fill="#8884d8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Box>

                        {/* По создателям */}
                        <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
                            <Paper sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Person /> По создателям
                                </Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={creatorData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Bar dataKey="count" name="Задач">
                                            {creatorData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Box>
                    </Box>
                </TabPanel>

                {/* По пользователям (Tab 1) - только если есть данные */}
                {userStats && (
                    <TabPanel value={tabValue} index={1}>
                        {/* Сводка */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>
                                            Всего пользователей
                                        </Typography>
                                        <Typography variant="h4">{userStats.summary.totalUsers}</Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>
                                            Всего выполнений
                                        </Typography>
                                        <Typography variant="h4" color="success.main">
                                            {userStats.summary.totalCompletions}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>
                                            Среднее на пользователя
                                        </Typography>
                                        <Typography variant="h4" color="primary.main">
                                            {userStats.summary.avgCompletionsPerUser.toFixed(1)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Box>

                        {/* Таблица пользователей */}
                        <Paper>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Пользователь</TableCell>
                                            <TableCell align="right">Выполнено задач</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {userStats.users.map((user) => (
                                            <TableRow key={user.userId}>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Person fontSize="small" />
                                                        {user.fullName}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip
                                                        size="small"
                                                        label={user.completedTasksCount}
                                                        color="success"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </TabPanel>
                )}

                {/* По задачам (Tab 2) - только если есть данные */}
                {tasksCompletion && (
                    <TabPanel value={tabValue} index={userStats ? 2 : 1}>
                        {/* Сводка */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                            <Box sx={{ flex: '1 1 150px', minWidth: 150 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>Всего задач</Typography>
                                        <Typography variant="h4">
                                            {tasksCompletion.summary.totalTasks}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 150px', minWidth: 150 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>С выполнениями</Typography>
                                        <Typography variant="h4" color="success.main">
                                            {tasksCompletion.summary.tasksWithCompletions}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 150px', minWidth: 150 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>Без выполнений</Typography>
                                        <Typography variant="h4" color="warning.main">
                                            {tasksCompletion.summary.tasksWithoutCompletions}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 150px', minWidth: 150 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>Среднее выполнений</Typography>
                                        <Typography variant="h4" color="primary.main">
                                            {tasksCompletion.summary.avgCompletionsPerTask.toFixed(1)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Box>

                        {/* По приоритетам */}
                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="h6">Просроченные ({tasksCompletion.byPriority.overdue.length})</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {tasksCompletion.byPriority.overdue.length > 0 ? (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Задача</TableCell>
                                                    <TableCell>Создатель</TableCell>
                                                    <TableCell align="right">Выполнений</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {tasksCompletion.byPriority.overdue.slice(0, 10).map((task) => (
                                                    <TableRow key={task.taskId}>
                                                        <TableCell>{task.title}</TableCell>
                                                        <TableCell>{task.creatorName}</TableCell>
                                                        <TableCell align="right">{task.completionCount}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography color="text.secondary">Нет просроченных задач</Typography>
                                )}
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="h6">Срочные ({tasksCompletion.byPriority.urgent.length})</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {tasksCompletion.byPriority.urgent.length > 0 ? (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Задача</TableCell>
                                                    <TableCell>Создатель</TableCell>
                                                    <TableCell align="right">Выполнений</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {tasksCompletion.byPriority.urgent.slice(0, 10).map((task) => (
                                                    <TableRow key={task.taskId}>
                                                        <TableCell>{task.title}</TableCell>
                                                        <TableCell>{task.creatorName}</TableCell>
                                                        <TableCell align="right">{task.completionCount}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography color="text.secondary">Нет срочных задач</Typography>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </TabPanel>
                )}
            </Box>
        </MainLayout>
    );
}
