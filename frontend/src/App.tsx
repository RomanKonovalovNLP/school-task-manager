import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { store } from './store/store';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import EventsPage from './pages/EventsPage';
import { useAppDispatch, useAppSelector } from './hooks/useRedux';
import { restoreSession } from './store/slices/authSlice';
import StatisticsDashboard from './components/statistics/StatisticsDashboard';
import CategoryManagement from './components/admin/CategoryManagement';
import RoleSelectionDialog from './components/auth/RoleSelectionDialog';
import SuperAdminLoginPage from './pages/SuperAdminLoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ScheduleDashboard from './pages/ScheduleDashboard';
import ScheduleEditorPage from './pages/ScheduleEditorPage';
import ScheduleManagementPage from './pages/ScheduleManagementPage';
import ScheduleViewPage from './pages/ScheduleViewPage';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

// Компонент для защищённых роутов
const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({
    children,
}) => {
    const { isAuthenticated } = useAppSelector((state) => state.auth);
    return isAuthenticated ? children : <Navigate to="/login" />;
};

// Компонент для публичных роутов (перенаправление если уже авторизован)
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({
    children,
}) => {
    const { isAuthenticated } = useAppSelector((state) => state.auth);
    return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

// Компонент для защищённых роутов админа
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({
    children,
}) => {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    if (!user?.isAdmin) {
        return <Navigate to="/dashboard" />;
    }

    return children;
};

// Компонент-обёртка для проверки категорий
const CategoryCheckWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAppSelector((state) => state.auth);
    const [showCategoryDialog, setShowCategoryDialog] = useState(false);

    useEffect(() => {
        // Проверяем, есть ли у пользователя категории
        if (isAuthenticated && user) {
            const hasCategories = user.categories && user.categories.length > 0;
            if (!hasCategories) {
                setShowCategoryDialog(true);
            }
        }
    }, [isAuthenticated, user]);

    const handleCategoryDialogClose = () => {
        setShowCategoryDialog(false);
    };

    const handleCategoryDialogSave = () => {
        setShowCategoryDialog(false);
    };

    return (
        <>
            {children}
            <RoleSelectionDialog
                open={showCategoryDialog}
                onClose={handleCategoryDialogClose}
                onSave={handleCategoryDialogSave}
            />
        </>
    );
};

const AppContent: React.FC = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        document.title = 'ПланТакт';

        // Восстановить сессию из localStorage
        const userStr = localStorage.getItem('user');
        const sessionToken = store.getState().auth.sessionToken;

        if (userStr && sessionToken) {
            try {
                const user = JSON.parse(userStr);
                dispatch(restoreSession(user));
            } catch (error) {
                console.error('Failed to restore session:', error);
                localStorage.removeItem('user');
                localStorage.removeItem('sessionToken');
            }
        }
    }, [dispatch]);

    return (
        <BrowserRouter>
            <Routes>
                {/* Маршруты супер-админа (без обёртки CategoryCheckWrapper) */}
                <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
                <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />

                {/* Публичный роут логина */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <LoginPage />
                        </PublicRoute>
                    }
                />

                {/* Защищённые роуты с проверкой категорий */}
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <CategoryCheckWrapper>
                                <DashboardPage />
                            </CategoryCheckWrapper>
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/events"
                    element={
                        <PrivateRoute>
                            <CategoryCheckWrapper>
                                <EventsPage />
                            </CategoryCheckWrapper>
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/statistics"
                    element={
                        <PrivateRoute>
                            <CategoryCheckWrapper>
                                <StatisticsDashboard />
                            </CategoryCheckWrapper>
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/admin/categories"
                    element={
                        <AdminRoute>
                            <CategoryCheckWrapper>
                                <CategoryManagement />
                            </CategoryCheckWrapper>
                        </AdminRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <PrivateRoute>
                            <CategoryCheckWrapper>
                                <ProfilePage />
                            </CategoryCheckWrapper>
                        </PrivateRoute>
                    }
                />
                {/* Расписание — просмотр для ВСЕХ пользователей */}
                <Route
                    path="/schedule"
                    element={
                        <PrivateRoute>
                            <CategoryCheckWrapper>
                                <ScheduleViewPage />
                            </CategoryCheckWrapper>
                        </PrivateRoute>
                    }
                />
                {/* Управление расписаниями — только для админов */}
                <Route
                    path="/schedule/admin"
                    element={
                        <AdminRoute>
                            <CategoryCheckWrapper>
                                <ScheduleDashboard />
                            </CategoryCheckWrapper>
                        </AdminRoute>
                    }
                />
                <Route
                    path="/schedule/manage"
                    element={
                        <AdminRoute>
                            <CategoryCheckWrapper>
                                <ScheduleManagementPage />
                            </CategoryCheckWrapper>
                        </AdminRoute>
                    }
                />
                <Route
                    path="/schedule/editor/:versionId"
                    element={
                        <AdminRoute>
                            <CategoryCheckWrapper>
                                <ScheduleEditorPage />
                            </CategoryCheckWrapper>
                        </AdminRoute>
                    }
                />
                <Route
                    path="/schedule/view/:versionId"
                    element={
                        <PrivateRoute>
                            <CategoryCheckWrapper>
                                <ScheduleViewPage />
                            </CategoryCheckWrapper>
                        </PrivateRoute>
                    }
                />
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
        </BrowserRouter>
    );
};

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <AppContent />
            </ThemeProvider>
        </Provider>
    );
};

export default App;
