import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import ScheduleEditor from '../components/schedule/ScheduleEditor';

const ScheduleEditorPage: React.FC = () => {
    const { versionId } = useParams<{ versionId: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (!versionId) navigate('/schedule/admin');
    }, [versionId, navigate]);

    if (!versionId) return null;

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <ScheduleEditor versionId={Number(versionId)} onBack={() => navigate('/schedule/admin')} />
        </Box>
    );
};

export default ScheduleEditorPage;
