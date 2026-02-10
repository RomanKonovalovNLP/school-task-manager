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
    Box,
    Typography,
    CircularProgress,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { scheduleService } from '../../services/schedule.service';

interface ExportModalProps {
    open: boolean;
    onClose: () => void;
    versionId: number;
}

const ExportModal: React.FC<ExportModalProps> = ({ open, onClose, versionId }) => {
    const [format, setFormat] = useState<'xlsx' | 'pdf' | 'html'>('xlsx');
    const [view, setView] = useState<'class' | 'teacher' | 'room'>('class');
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        try {
            setLoading(true);
            const blob = await scheduleService.exportSchedule(versionId, { format, view });
            
            // Скачиваем файл
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schedule.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            onClose();
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Экспорт расписания</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Формат</InputLabel>
                        <Select
                            value={format}
                            label="Формат"
                            onChange={(e) => setFormat(e.target.value as any)}
                        >
                            <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
                            <MenuItem value="html">HTML</MenuItem>
                            <MenuItem value="pdf">PDF</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel>Вид</InputLabel>
                        <Select
                            value={view}
                            label="Вид"
                            onChange={(e) => setView(e.target.value as any)}
                        >
                            <MenuItem value="class">По классам</MenuItem>
                            <MenuItem value="teacher">По учителям</MenuItem>
                            <MenuItem value="room">По кабинетам</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={handleExport}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <Download />}
                >
                    {loading ? 'Экспорт...' : 'Скачать'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExportModal;
