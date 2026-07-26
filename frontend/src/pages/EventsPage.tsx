import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    CircularProgress,
    Alert,
    ToggleButton,
    ToggleButtonGroup,
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    Add,
    CalendarMonth,
    ViewList,
    Search,
    Event as EventIcon,
} from '@mui/icons-material';
import MainLayout from '../components/layout/MainLayout';
import EventCalendar from '../components/events/EventCalendar';
import EventCard from '../components/events/EventCard';
import CreateEventModal from '../components/events/CreateEventModal';
import EventDetailModal from '../components/events/EventDetailModal';
import { eventsService, Event } from '../services/events.service';
import { getEventEnd } from '../utils/eventHelpers';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { setCategories } from '../store/slices/filtersSlice';
import { filtersService } from '../services/filters.service';

type ViewMode = 'calendar' | 'list';

const EventsPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const { categories } = useAppSelector((state) => state.filters);

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('calendar');
    const [searchQuery, setSearchQuery] = useState('');

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [editEvent, setEditEvent] = useState<Event | null>(null);

    useEffect(() => {
        loadEvents();
        loadCategories();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await eventsService.getAll();
            setEvents(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка загрузки мероприятий');
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            if (categories.length === 0) {
                const data = await filtersService.getAll();
                dispatch(setCategories(data));
            }
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    };

    const handleViewModeChange = (_: any, newMode: ViewMode | null) => {
        if (newMode) {
            setViewMode(newMode);
        }
    };

    const handleDateSelect = (date: string, dayEvents: Event[]) => {
        console.log('Selected date:', date, 'Events:', dayEvents);
    };

    const handleEventClick = (event: Event) => {
        setSelectedEvent(event);
        setDetailModalOpen(true);
    };

    const handleCreateSuccess = () => {
        loadEvents();
        setCreateModalOpen(false);
        setEditEvent(null);
    };

    const handleEditEvent = () => {
        setEditEvent(selectedEvent);
        setDetailModalOpen(false);
        setCreateModalOpen(true);
    };

    const handleRefresh = async () => {
        await loadEvents();
        if (selectedEvent) {
            try {
                const updated = await eventsService.getById(selectedEvent.id);
                setSelectedEvent(updated);
            } catch (err) {
                setSelectedEvent(null);
                setDetailModalOpen(false);
            }
        }
    };

    const filteredEvents = events.filter((event) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            event.title.toLowerCase().includes(query) ||
            event.description?.toLowerCase().includes(query) ||
            event.creatorName.toLowerCase().includes(query) ||
            event.assigneeCategories?.some((cat) => cat.toLowerCase().includes(query))
        );
    });

    const now = new Date();

    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = new Date(a.startDate || a.eventDate);
        const dateB = new Date(b.startDate || b.eventDate);
        // Прошедшие уводим вниз (учитываем «весь день» — см. getEventEnd)
        const isPastA = getEventEnd(a) < now;
        const isPastB = getEventEnd(b) < now;

        if (isPastA && !isPastB) return 1;
        if (!isPastA && isPastB) return -1;
        return dateA.getTime() - dateB.getTime();
    });

    // F21: многодневные и «на весь день» считаются актуальными до конца последнего дня
    const upcomingEvents = sortedEvents.filter((e) => getEventEnd(e) >= now);
    const pastEvents = sortedEvents.filter((e) => getEventEnd(e) < now);

    if (loading) {
        return (
            <MainLayout>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <CircularProgress />
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
                        <EventIcon /> Мероприятия
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => {
                            setEditEvent(null);
                            setCreateModalOpen(true);
                        }}
                    >
                        Создать мероприятие
                    </Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {/* Панель инструментов */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={handleViewModeChange}
                        size="small"
                    >
                        <ToggleButton value="calendar">
                            <CalendarMonth sx={{ mr: 1 }} /> Календарь
                        </ToggleButton>
                        <ToggleButton value="list">
                            <ViewList sx={{ mr: 1 }} /> Список
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <TextField
                        size="small"
                        placeholder="Поиск мероприятий..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minWidth: 250 }}
                    />
                </Box>

                {/* Контент */}
                {viewMode === 'calendar' ? (
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {/* Календарь */}
                        <Box sx={{ flex: '1 1 300px', minWidth: 300, maxWidth: 400 }}>
                            <EventCalendar
                                events={events}
                                onDateSelect={handleDateSelect}
                                onEventClick={handleEventClick}
                            />
                        </Box>

                        {/* Список ближайших мероприятий */}
                        <Box sx={{ flex: '2 1 400px' }}>
                            <Typography variant="h6" gutterBottom>
                                Ближайшие мероприятия
                            </Typography>
                            {upcomingEvents.length === 0 ? (
                                <Alert severity="info">Нет запланированных мероприятий</Alert>
                            ) : (
                                <Box sx={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                                    gap: 2 
                                }}>
                                    {upcomingEvents.slice(0, 6).map((event) => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onClick={() => handleEventClick(event)}
                                        />
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>
                ) : (
                    <Box>
                        {/* Предстоящие мероприятия */}
                        <Typography variant="h6" gutterBottom>
                            Предстоящие мероприятия ({upcomingEvents.length})
                        </Typography>
                        {upcomingEvents.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 3 }}>
                                Нет запланированных мероприятий
                            </Alert>
                        ) : (
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                gap: 2, 
                                mb: 4 
                            }}>
                                {upcomingEvents.map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        onClick={() => handleEventClick(event)}
                                    />
                                ))}
                            </Box>
                        )}

                        {/* Прошедшие мероприятия */}
                        {pastEvents.length > 0 && (
                            <>
                                <Typography variant="h6" gutterBottom color="text.secondary">
                                    Прошедшие мероприятия ({pastEvents.length})
                                </Typography>
                                <Box sx={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                    gap: 2 
                                }}>
                                    {pastEvents.map((event) => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onClick={() => handleEventClick(event)}
                                        />
                                    ))}
                                </Box>
                            </>
                        )}
                    </Box>
                )}

                {/* Модалка создания/редактирования */}
                <CreateEventModal
                    open={createModalOpen}
                    onClose={() => {
                        setCreateModalOpen(false);
                        setEditEvent(null);
                    }}
                    onSuccess={handleCreateSuccess}
                    editEvent={editEvent}
                />

                {/* Модалка просмотра */}
                <EventDetailModal
                    open={detailModalOpen}
                    onClose={() => {
                        setDetailModalOpen(false);
                        setSelectedEvent(null);
                    }}
                    event={selectedEvent}
                    onRefresh={handleRefresh}
                    onEdit={handleEditEvent}
                />
            </Box>
        </MainLayout>
    );
};

export default EventsPage;
