import React, { useState } from 'react';
import {
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
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { scheduleService } from '../../services/schedule.service';

interface ExportModalProps {
    open: boolean;
    onClose: () => void;
    versionId: number;
}

const ExportModal: React.FC<ExportModalProps> = ({ open, onClose, versionId }) => {
    const [format, setFormat] = useState<'xlsx' | 'html'>('xlsx');
    const [view, setView] = useState<'class' | 'teacher' | 'room'>('class');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        try {
            setLoading(true);
            setError(null);

            const blob = await scheduleService.exportSchedule(versionId, { format, view });

            const ext = format === 'xlsx' ? 'xlsx' : 'html';
            const mimeType = format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/html';

            const file = new Blob([blob], { type: mimeType });
            const url = window.URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schedule_${new Date().toISOString().split('T')[0]}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

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
            <DialogTitle>Экспорт расписания</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                    <InputLabel>Формат</InputLabel>
                    <Select value={format} label="Формат" onChange={(e) => setFormat(e.target.value as any)}>
                        <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
                        <MenuItem value="html">HTML (для печати)</MenuItem>
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel>Группировка</InputLabel>
                    <Select value={view} label="Группировка" onChange={(e) => setView(e.target.value as any)}>
                        <MenuItem value="class">По классам</MenuItem>
                        <MenuItem value="teacher">По учителям</MenuItem>
                        <MenuItem value="room">По кабинетам</MenuItem>
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={handleExport}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <Download />}
                >
                    Скачать
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExportModal;
