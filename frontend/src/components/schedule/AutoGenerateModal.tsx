import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Slider,
    FormControl,
    FormControlLabel,
    RadioGroup,
    Radio,
    Switch,
    TextField,
    Alert,
    Divider,
    Chip,
    LinearProgress,
} from '@mui/material';
import {
    PlayArrow,
    Settings,
    Speed,
    AccessTime,
    Balance,
} from '@mui/icons-material';
import { AutoGenerateOptions } from '../../types/schedule';

interface AutoGenerateModalProps {
    open: boolean;
    onClose: () => void;
    onGenerate: (options: AutoGenerateOptions) => void;
    unplacedCount: number;
    isGenerating?: boolean;
}

const AutoGenerateModal: React.FC<AutoGenerateModalProps> = ({
    open,
    onClose,
    onGenerate,
    unplacedCount,
    isGenerating = false,
}) => {
    const [mode, setMode] = useState<'full' | 'fill_gaps' | 'optimize'>('full');
    const [respectLocked, setRespectLocked] = useState(true);
    const [timeout, setTimeout] = useState(60);
    const [priorities, setPriorities] = useState({
        minimizeWindows: 8,
        teacherPreferences: 5,
        roomPreferences: 3,
        evenDistribution: 7,
    });

    const handlePriorityChange = (key: keyof typeof priorities, value: number) => {
        setPriorities((prev) => ({ ...prev, [key]: value }));
    };

    const handleGenerate = () => {
        onGenerate({
            mode,
            respectLocked,
            timeout,
            priorities,
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlayArrow color="primary" />
                    Автоматическое составление расписания
                </Box>
            </DialogTitle>

            <DialogContent>
                {isGenerating ? (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                        <LinearProgress sx={{ mb: 2 }} />
                        <Typography>Составление расписания...</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Это может занять до {timeout} секунд
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Информация о текущем состоянии */}
                        <Alert severity="info" sx={{ mb: 3 }}>
                            {unplacedCount > 0 ? (
                                <>
                                    <strong>{unplacedCount}</strong> нагрузок ещё не размещено в расписании
                                </>
                            ) : (
                                'Вся нагрузка уже размещена. Можно оптимизировать расписание.'
                            )}
                        </Alert>

                        {/* Режим работы */}
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Режим работы
                        </Typography>
                        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as any)}>
                                <FormControlLabel
                                    value="full"
                                    control={<Radio />}
                                    label={
                                        <Box>
                                            <Typography variant="body2">Полное составление</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Очистить и составить расписание заново
                                            </Typography>
                                        </Box>
                                    }
                                />
                                <FormControlLabel
                                    value="fill_gaps"
                                    control={<Radio />}
                                    label={
                                        <Box>
                                            <Typography variant="body2">Заполнить пробелы</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Разместить только нераспределённую нагрузку
                                            </Typography>
                                        </Box>
                                    }
                                />
                                <FormControlLabel
                                    value="optimize"
                                    control={<Radio />}
                                    label={
                                        <Box>
                                            <Typography variant="body2">Оптимизировать</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Улучшить текущее расписание без полной перестройки
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </RadioGroup>
                        </FormControl>

                        <Divider sx={{ my: 2 }} />

                        {/* Настройки */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Settings fontSize="small" />
                            <Typography variant="subtitle2">Настройки</Typography>
                        </Box>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={respectLocked}
                                    onChange={(e) => setRespectLocked(e.target.checked)}
                                />
                            }
                            label="Сохранять заблокированные уроки"
                            sx={{ mb: 2 }}
                        />

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" gutterBottom>
                                Максимальное время работы: {timeout} сек
                            </Typography>
                            <Slider
                                value={timeout}
                                onChange={(_, v) => setTimeout(v as number)}
                                min={10}
                                max={300}
                                step={10}
                                marks={[
                                    { value: 10, label: '10с' },
                                    { value: 60, label: '1м' },
                                    { value: 180, label: '3м' },
                                    { value: 300, label: '5м' },
                                ]}
                            />
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        {/* Приоритеты */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Balance fontSize="small" />
                            <Typography variant="subtitle2">Приоритеты оптимизации</Typography>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" gutterBottom>
                                Минимизация окон: {priorities.minimizeWindows}
                            </Typography>
                            <Slider
                                value={priorities.minimizeWindows}
                                onChange={(_, v) => handlePriorityChange('minimizeWindows', v as number)}
                                min={0}
                                max={10}
                                marks
                            />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" gutterBottom>
                                Предпочтения учителей: {priorities.teacherPreferences}
                            </Typography>
                            <Slider
                                value={priorities.teacherPreferences}
                                onChange={(_, v) => handlePriorityChange('teacherPreferences', v as number)}
                                min={0}
                                max={10}
                                marks
                            />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" gutterBottom>
                                Предпочтения кабинетов: {priorities.roomPreferences}
                            </Typography>
                            <Slider
                                value={priorities.roomPreferences}
                                onChange={(_, v) => handlePriorityChange('roomPreferences', v as number)}
                                min={0}
                                max={10}
                                marks
                            />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" gutterBottom>
                                Равномерность нагрузки: {priorities.evenDistribution}
                            </Typography>
                            <Slider
                                value={priorities.evenDistribution}
                                onChange={(_, v) => handlePriorityChange('evenDistribution', v as number)}
                                min={0}
                                max={10}
                                marks
                            />
                        </Box>
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={isGenerating}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    startIcon={<PlayArrow />}
                >
                    {isGenerating ? 'Составление...' : 'Составить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AutoGenerateModal;
