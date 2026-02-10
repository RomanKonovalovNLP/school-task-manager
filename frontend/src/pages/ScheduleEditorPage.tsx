import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, IconButton, Tooltip } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import ScheduleEditor from '../components/schedule/ScheduleEditor';

const ScheduleEditorPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    if (!id) {
        navigate('/schedule');
        return null;
    }

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Кнопка назад */}
            <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1000 }}>
                <Tooltip title="Назад к списку">
                    <IconButton onClick={() => navigate('/schedule')}>
                        <ArrowBack />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Редактор */}
            <ScheduleEditor versionId={Number(id)} />
        </Box>
    );
};

export default ScheduleEditorPage;
