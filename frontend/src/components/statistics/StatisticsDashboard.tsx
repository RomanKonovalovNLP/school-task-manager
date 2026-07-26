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
    DateRange,
} from '@mui/icons-material';
import {
    statisticsService,
    Statistics,
    TrendData,
    CategoryStatistics,
    CreatorStatistics,
    UserStatisticsResponse,
    TasksCompletionResponse,
    WeeklyStatisticsResponse,
} from '../../services/statistics.service';
import { exportService } from '../../services/export.service';
import { getPriorityColor } from '../../utils/taskHelpers';
import MainLayout from '../layout/MainLayout';

// Цвета для графиков
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
// Берём цвета из общего помощника, иначе диаграммы расходятся с карточками задач
// (в частности, зелёный теперь означает «выполнено», а несрочные — синие)
const PRIORITY_COLORS: Record<string, string> = {
    urgent: getPriorityColor('urgent'),
    medium: getPriorityColor('medium'),
    low: getPriorityColor('low'),
    overdue: getPriorityColor('overdue'),
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

// Выносная подпись PieChart: текст за пределами круга, чтобы подписи не накладывались
const RADIAN = Math.PI / 180;
const renderPieLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name } = props;
    if (!percent || percent < 0.04) return null; // совсем мелкие сектора не подписываем
    const r = outerRadius + 16;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="#555" fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {`${name} ${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// Заглушка, когда данных для графика ещё нет
const EmptyChart: React.FC<{ text: string }> = ({ text }) => (
    <Box
        sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            px: 2,
        }}
    >
        <Typography variant="body2" color="text.secondary">
            {text}
        </Typography>
    </Box>
);

// Единый размер карточек с графиками: все четыре одинаковой высоты и ширины
const CHART_HEIGHT = 320;
const CHART_CARD_SX = {
    p: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
} as const;

export default function StatisticsDashboard() {
    const [statistics, setStatistics] = useState<Statistics | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [categoryStats, setCategoryStats] = useState<CategoryStatistics | null>(null);
    const [creatorStats, setCreatorStats] = useState<CreatorStatistics | null>(null);
    const [userStats, setUserStats] = useState<UserStatisticsResponse | null>(null);
    const [tasksCompletion, setTasksCompletion] = useState<TasksCompletionResponse | null>(null);
    const [weeklyStats, setWeeklyStats] = useState<WeeklyStatisticsResponse | null>(null);
    const [weeksRange, setWeeksRange] = useState(8);
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
                const [users, tasks, weekly] = await Promise.all([
                    statisticsService.getUserStatistics(),
                    statisticsService.getTasksCompletionStatistics(),
                    statisticsService.getWeeklyStatistics(weeksRange),
                ]);
                setUserStats(users);
                setTasksCompletion(tasks);
                setWeeklyStats(weekly);
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
    }, [weeksRange]);

    useEffect(() => {
        loadStatistics();
    }, [loadStatistics]);

    const handleExportClose = () => {
        setExportAnchor(null);
    };

    const [exporting, setExporting] = useState(false);

    const runExport = async (fn: () => Promise<void>) => {
        setExportAnchor(null);
        setExporting(true);
        try {
            await fn();
        } catch (e) {
            setError('Не удалось выполнить экспорт');
        } finally {
            setExporting(false);
        }
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
                            startIcon={exporting ? <CircularProgress size={18} /> : <FileDownload />}
                            onClick={(e) => setExportAnchor(e.currentTarget)}
                            disabled={exporting}
                        >
                            Экспорт
                        </Button>
                        <Menu
                            anchorEl={exportAnchor}
                            open={Boolean(exportAnchor)}
                            onClose={handleExportClose}
                        >
                            <MenuItem onClick={() => runExport(() => exportService.exportStatisticsToExcel())}>
                                Статистика (Excel)
                            </MenuItem>
                            <MenuItem onClick={() => runExport(() => exportService.exportTasksToExcel())}>
                                Задачи (Excel)
                            </MenuItem>
                            <MenuItem onClick={() => runExport(() => exportService.exportTasksToCSV())}>
                                Задачи (CSV)
                            </MenuItem>
                        </Menu>
                    </Box>
                </Box>

                {/* Табы */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                        <Tab label="Общая статистика" icon={<Assessment />} iconPosition="start" />
                        {userStats && <Tab label="По пользователям" icon={<Person />} iconPosition="start" />}
                        {tasksCompletion && <Tab label="По задачам" icon={<School />} iconPosition="start" />}
                        {weeklyStats && <Tab label="По неделям" icon={<DateRange />} iconPosition="start" />}
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

                    {/* Графики — одинаковая сетка, чтобы карточки были равны по размеру */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                            gap: 3,
                            alignItems: 'stretch',
                        }}
                    >
                        {/* Тренды */}
                        <Paper sx={CHART_CARD_SX}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUp /> Тренды за 30 дней
                            </Typography>
                            <Box sx={{ flexGrow: 1, height: CHART_HEIGHT }}>
                                {trendChartData.length === 0 ? (
                                    <EmptyChart text="Данных пока нет. Снимок статистики сохраняется автоматически каждую ночь — график появится завтра." />
                                ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis allowDecimals={false} width={40} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="total" name="Всего" stroke="#8884d8" />
                                        <Line type="monotone" dataKey="completed" name="Выполнено" stroke="#82ca9d" />
                                        <Line type="monotone" dataKey="overdue" name="Просрочено" stroke="#ff7300" />
                                    </LineChart>
                                </ResponsiveContainer>
                                )}
                            </Box>
                        </Paper>

                        {/* Распределение по приоритетам */}
                        <Paper sx={CHART_CARD_SX}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Assessment /> По приоритетам
                            </Typography>
                            <Box sx={{ flexGrow: 1, height: CHART_HEIGHT }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                                        <Pie
                                            data={priorityData}
                                            cx="50%"
                                            cy="45%"
                                            labelLine={false}
                                            label={renderPieLabel}
                                            outerRadius={80}
                                            dataKey="value"
                                            minAngle={4}
                                        >
                                            {priorityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: any, name: any) => [value, name]} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>

                        {/* По категориям */}
                        <Paper sx={CHART_CARD_SX}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Category /> По категориям
                            </Typography>
                            <Box sx={{ flexGrow: 1, height: CHART_HEIGHT }}>
                                {categoryData.length === 0 ? (
                                    <EmptyChart text="Нет задач, назначенных на категории" />
                                ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} />
                                        <RechartsTooltip />
                                        <Bar dataKey="count" name="Задач" fill="#8884d8" />
                                    </BarChart>
                                </ResponsiveContainer>
                                )}
                            </Box>
                        </Paper>

                        {/* По создателям */}
                        <Paper sx={CHART_CARD_SX}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Person /> По создателям
                            </Typography>
                            <Box sx={{ flexGrow: 1, height: CHART_HEIGHT }}>
                                {creatorData.length === 0 ? (
                                    <EmptyChart text="Пока никто не создавал задачи" />
                                ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={creatorData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={60} angle={-20} textAnchor="end" />
                                        <YAxis allowDecimals={false} width={40} />
                                        <RechartsTooltip />
                                        <Bar dataKey="count" name="Задач">
                                            {creatorData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                )}
                            </Box>
                        </Paper>
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
                                        <Typography color="text.secondary" gutterBottom>Полностью выполнено</Typography>
                                        <Typography variant="h4" color="success.main">
                                            {tasksCompletion.summary.fullyCompletedTasks}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            выполнили все исполнители
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 150px', minWidth: 150 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>Частично</Typography>
                                        <Typography variant="h4" color="warning.main">
                                            {tasksCompletion.summary.tasksWithCompletions - tasksCompletion.summary.fullyCompletedTasks}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            выполнили не все
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 150px', minWidth: 150 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>Без выполнений</Typography>
                                        <Typography variant="h4" color="error.main">
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
                                                    <TableCell align="right">Выполнено</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {tasksCompletion.byPriority.overdue.slice(0, 10).map((task) => (
                                                    <TableRow key={task.taskId}>
                                                        <TableCell>{task.title}</TableCell>
                                                        <TableCell>{task.creatorName}</TableCell>
                                                        <TableCell align="right">
                                                            <Chip
                                                                size="small"
                                                                label={`${task.completionCount}/${task.expectedCount}`}
                                                                color={task.isFullyCompleted ? 'success' : task.completionCount > 0 ? 'warning' : 'default'}
                                                                variant={task.isFullyCompleted ? 'filled' : 'outlined'}
                                                            />
                                                        </TableCell>
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
                                                    <TableCell align="right">Выполнено</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {tasksCompletion.byPriority.urgent.slice(0, 10).map((task) => (
                                                    <TableRow key={task.taskId}>
                                                        <TableCell>{task.title}</TableCell>
                                                        <TableCell>{task.creatorName}</TableCell>
                                                        <TableCell align="right">
                                                            <Chip
                                                                size="small"
                                                                label={`${task.completionCount}/${task.expectedCount}`}
                                                                color={task.isFullyCompleted ? 'success' : task.completionCount > 0 ? 'warning' : 'default'}
                                                                variant={task.isFullyCompleted ? 'filled' : 'outlined'}
                                                            />
                                                        </TableCell>
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

                {/* Статистика по неделям (Tab 3) */}
                {weeklyStats && (
                    <TabPanel value={tabValue} index={3}>
                        {/* Карточки итогов прошлой недели */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                            <Box sx={{ flex: '1 1 220px', minWidth: 220 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>
                                            Выполнено за прошлую неделю
                                        </Typography>
                                        <Typography variant="h4">{weeklyStats.summary.lastWeekCompletions}</Typography>
                                        {weeklyStats.summary.prevWeekCompletions > 0 && (
                                            <Typography
                                                variant="body2"
                                                color={
                                                    weeklyStats.summary.deltaCompletions >= 0
                                                        ? 'success.main'
                                                        : 'error.main'
                                                }
                                            >
                                                {weeklyStats.summary.deltaCompletions >= 0 ? '+' : ''}
                                                {weeklyStats.summary.deltaCompletions} к позапрошлой неделе
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 220px', minWidth: 220 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>
                                            Доля выполненных в срок
                                        </Typography>
                                        <Typography variant="h4" color="primary.main">
                                            {weeklyStats.summary.lastWeekOnTimeRate}%
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            за прошлую неделю
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                            <Box sx={{ flex: '1 1 220px', minWidth: 220 }}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom>
                                            Лучшая неделя периода
                                        </Typography>
                                        <Typography variant="h5">
                                            {weeklyStats.summary.bestWeekLabel || '—'}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Box>

                        {/* Переключатель глубины периода */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            <Typography variant="body2" color="text.secondary">
                                Период:
                            </Typography>
                            {[4, 8, 12, 26].map((w) => (
                                <Chip
                                    key={w}
                                    size="small"
                                    label={`${w} нед.`}
                                    color={weeksRange === w ? 'primary' : 'default'}
                                    variant={weeksRange === w ? 'filled' : 'outlined'}
                                    onClick={() => setWeeksRange(w)}
                                />
                            ))}
                        </Box>

                        {/* График по неделям */}
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Динамика по неделям
                                </Typography>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={weeklyStats.weeks}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                        <YAxis allowDecimals={false} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Bar dataKey="onTimeCompletions" name="Выполнено в срок" stackId="c" fill="#4CAF50" />
                                        <Bar dataKey="lateCompletions" name="Выполнено с опозданием" stackId="c" fill="#FFA500" />
                                        <Bar dataKey="createdTasks" name="Создано задач" fill="#1976d2" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Таблица по неделям */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Показатели по неделям
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Неделя</TableCell>
                                                <TableCell align="right">Создано</TableCell>
                                                <TableCell align="right">Сроки</TableCell>
                                                <TableCell align="right">Выполнено</TableCell>
                                                <TableCell align="right">В срок</TableCell>
                                                <TableCell align="right">Активных людей</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {[...weeklyStats.weeks].reverse().map((w) => (
                                                <TableRow key={w.weekStart}>
                                                    <TableCell>
                                                        {w.label}
                                                        {w.isCurrent && (
                                                            <Chip size="small" label="текущая" sx={{ ml: 1 }} />
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">{w.createdTasks}</TableCell>
                                                    <TableCell align="right">{w.deadlines}</TableCell>
                                                    <TableCell align="right">{w.completions}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip
                                                            size="small"
                                                            label={`${w.onTimeRate}%`}
                                                            color={
                                                                w.completions === 0
                                                                    ? 'default'
                                                                    : w.onTimeRate >= 80
                                                                      ? 'success'
                                                                      : w.onTimeRate >= 50
                                                                        ? 'warning'
                                                                        : 'error'
                                                            }
                                                            variant={w.completions === 0 ? 'outlined' : 'filled'}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">{w.activeUsers}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    «Выполнено» — отметки о выполнении, сделанные на этой неделе. «Сроки» — сколько
                                    дедлайнов приходилось на неделю. Каждый понедельник в 6:00 пользователи получают
                                    личную сводку за прошедшую неделю.
                                </Typography>
                            </CardContent>
                        </Card>
                    </TabPanel>
                )}
            </Box>
        </MainLayout>
    );
}
