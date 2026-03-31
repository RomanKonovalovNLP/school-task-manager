import React from 'react';
import { Box, IconButton, Typography, Paper } from '@mui/material';
import { ArrowBack, ArrowForward, Today } from '@mui/icons-material';

interface WeekNavigatorProps {
    currentWeekStart: Date;
    onWeekChange: (newStart: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    weekNumber?: number | null; // 1=нечётная, 2=чётная
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function formatDate(d: Date): string {
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

const WeekNavigator: React.FC<WeekNavigatorProps> = ({
    currentWeekStart, onWeekChange, minDate, maxDate, weekNumber,
}) => {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const canGoBack = !minDate || currentWeekStart > getMonday(minDate);
    const canGoForward = !maxDate || weekEnd < maxDate;

    const goBack = () => {
        const newStart = new Date(currentWeekStart);
        newStart.setDate(newStart.getDate() - 7);
        onWeekChange(newStart);
    };

    const goForward = () => {
        const newStart = new Date(currentWeekStart);
        newStart.setDate(newStart.getDate() + 7);
        onWeekChange(newStart);
    };

    const goToday = () => {
        onWeekChange(getMonday(new Date()));
    };

    // Проверяем, текущая ли это неделя
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isCurrentWeek = today >= currentWeekStart && today <= weekEnd;

    return (
        <Paper sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: 2 }}>
            <IconButton size="small" onClick={goBack} disabled={!canGoBack}>
                <ArrowBack fontSize="small" />
            </IconButton>

            <Box sx={{ textAlign: 'center', minWidth: 200 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                    {formatDate(currentWeekStart)} — {formatDate(weekEnd)}
                    {currentWeekStart.getFullYear() !== weekEnd.getFullYear()
                        ? ` ${weekEnd.getFullYear()}`
                        : ` ${currentWeekStart.getFullYear()}`}
                </Typography>
                {weekNumber && (
                    <Typography variant="caption" sx={{
                        color: weekNumber === 1 ? '#1565c0' : '#c62828',
                        fontWeight: 500,
                    }}>
                        {weekNumber === 1 ? 'I неделя (нечётная)' : 'II неделя (чётная)'}
                    </Typography>
                )}
            </Box>

            <IconButton size="small" onClick={goForward} disabled={!canGoForward}>
                <ArrowForward fontSize="small" />
            </IconButton>

            {!isCurrentWeek && (
                <IconButton size="small" onClick={goToday} title="К текущей неделе">
                    <Today fontSize="small" />
                </IconButton>
            )}
        </Paper>
    );
};

export { getMonday };
export default WeekNavigator;
