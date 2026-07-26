import React, { useState } from 'react';
import {
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Alert,
    Typography,
} from '@mui/material';
import { Download, Print } from '@mui/icons-material';
import { scheduleService } from '../../services/schedule.service';

interface ExportModalProps {
    open: boolean;
    onClose: () => void;
    versionId: number;
}

const ExportModal: React.FC<ExportModalProps> = ({ open, onClose, versionId }) => {
    const [format, setFormat] = useState<'xlsx' | 'html'>('html');
    const [view, setView] = useState<'master' | 'class' | 'teacher' | 'room'>('master');
    const [paper, setPaper] = useState<'a4' | 'a5'>('a4');
    const [subDate, setSubDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        try {
            setLoading(true);
            setError(null);

            const blob = await scheduleService.exportSchedule(versionId, { format, view, paper, date: subDate || undefined });

            if (format === 'html') {
                // Открываем в новой вкладке — там кнопка «Печать» и правильный размер листа
                const file = new Blob([blob], { type: 'text/html' });
                const url = window.URL.createObjectURL(file);
                window.open(url, '_blank');
                // URL освобождаем чуть позже, чтобы вкладка успела загрузиться
                setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            } else {
                const file = new Blob([blob], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
                const url = window.URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = `schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }

            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : 'Ошибка экспорта'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Экспорт и печать расписания</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                    <InputLabel>Что печатаем</InputLabel>
                    <Select value={view} label="Что печатаем" onChange={(e) => setView(e.target.value as any)}>
                        <MenuItem value="master">Общее по классам (одним листом)</MenuItem>
                        <MenuItem value="class">По классам (каждый на своём листе)</MenuItem>
                        <MenuItem value="teacher">По учителям</MenuItem>
                        <MenuItem value="room">По кабинетам</MenuItem>
                    </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Формат</InputLabel>
                    <Select value={format} label="Формат" onChange={(e) => setFormat(e.target.value as any)}>
                        <MenuItem value="html">Для печати (HTML → PDF из браузера)</MenuItem>
                        <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
                    </Select>
                </FormControl>

                {format === 'html' && (
                    <FormControl fullWidth>
                        <InputLabel>Размер листа</InputLabel>
                        <Select value={paper} label="Размер листа" onChange={(e) => setPaper(e.target.value as any)}>
                            <MenuItem value="a4">A4</MenuItem>
                            <MenuItem value="a5">A5</MenuItem>
                        </Select>
                    </FormControl>
                )}

                <TextField
                    fullWidth
                    type="date"
                    size="small"
                    label="Замены на дату (необязательно)"
                    InputLabelProps={{ shrink: true }}
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    helperText="Если выбрать дату — в расписании отобразятся замены этого дня"
                    sx={{ mt: 2 }}
                />

                {format === 'html' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        Откроется вкладка с готовым к печати расписанием. Нажмите «Печать» или Ctrl/⌘+P;
                        для общего листа выберите ориентацию «Альбомная».
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={handleExport}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : (format === 'html' ? <Print /> : <Download />)}
                >
                    {format === 'html' ? 'Открыть для печати' : 'Скачать'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExportModal;
