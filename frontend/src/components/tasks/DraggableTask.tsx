import React, { useRef, useState, useCallback } from 'react';
import { Box, Card, CardContent, Typography, IconButton, Chip, Badge, Tooltip } from '@mui/material';
import { Delete, Visibility, Layers } from '@mui/icons-material';
import { Rnd } from 'react-rnd';
import { Task } from '../../types';
import { getPriorityColor, formatDeadline } from '../../utils/taskHelpers';

interface DraggableTaskProps {
  task: Task;
  position: { x: number; y: number };
  zIndex: number;
  isInGroup: boolean;
  groupId: number | null;
  groupSize: number;
  onDragStart: (taskId: number) => void;
  onDrag: (taskId: number, x: number, y: number) => void;
  onDragStop: (taskId: number, x: number, y: number) => void;
  onClick: () => void;
  onGroupClick?: (groupId: number) => void;
  onDelete: () => void;
  isHighlighted?: boolean;
}

const DraggableTask: React.FC<DraggableTaskProps> = ({
  task,
  position,
  zIndex,
  isInGroup,
  groupId,
  groupSize,
  onDragStart,
  onDrag,
  onDragStop,
  onClick,
  onGroupClick,
  onDelete,
  isHighlighted = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs для отслеживания состояния drag
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseDownTimeRef = useRef(0);

  const handleDragStart = useCallback((_e: any, d: any) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartPosRef.current = { x: d.x, y: d.y };
    setIsDragging(true);
    onDragStart(task.id);
  }, [task.id, onDragStart]);

  const handleDrag = useCallback((_e: any, data: any) => {
    // Проверяем, было ли реальное перемещение (более 5 пикселей)
    const distance = Math.sqrt(
      Math.pow(data.x - dragStartPosRef.current.x, 2) +
      Math.pow(data.y - dragStartPosRef.current.y, 2)
    );
    
    if (distance > 5) {
      hasDraggedRef.current = true;
    }
    
    onDrag(task.id, data.x, data.y);
  }, [task.id, onDrag]);

  const handleDragStop = useCallback((_e: any, data: any) => {
    const wasDragged = hasDraggedRef.current;
    
    isDraggingRef.current = false;
    setIsDragging(false);
    
    onDragStop(task.id, data.x, data.y);
    
    // Сбрасываем флаг перетаскивания с небольшой задержкой
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 100);
  }, [task.id, onDragStop]);

  // ✅ ИСПРАВЛЕНИЕ: Упрощенная логика клика
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Если было реальное перетаскивание - игнорируем клик
    if (hasDraggedRef.current) {
      return;
    }
    
    // Если сейчас идет drag - игнорируем
    if (isDraggingRef.current) {
      return;
    }

    // Проверяем, что клик был коротким (менее 200мс между mousedown и click)
    const clickDuration = Date.now() - mouseDownTimeRef.current;
    if (clickDuration > 500) {
      return;
    }

    // Игнорируем клики только по кнопкам (не по всем MUI компонентам)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.MuiIconButton-root')) {
      return;
    }

    // Открываем модалку
    if (isInGroup && onGroupClick && groupId) {
      onGroupClick(groupId);
    } else {
      onClick();
    }
  }, [isInGroup, onGroupClick, groupId, onClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownTimeRef.current = Date.now();
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete();
  }, [onDelete]);

  // ✅ ИСПРАВЛЕНИЕ: Клик по иконке группы
  const handleGroupIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (groupId && onGroupClick) {
      onGroupClick(groupId);
    }
  }, [groupId, onGroupClick]);

  const viewCount = task.views?.length || 0;
  const priorityColor = getPriorityColor(task.priority);

  return (
    <Rnd
      position={position}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      enableResizing={false}
      bounds="parent"
      style={{
        zIndex: isDragging ? 9999 : zIndex + 100,
      }}
    >
      <Box 
        sx={{ position: 'relative' }}
        onMouseDown={handleMouseDown}
      >
        {/* Подложки для визуализации группы */}
        {isInGroup &&
          Array.from({ length: Math.min(groupSize - 1, 3) }).map((_, index) => (
            <Box
              key={index}
              sx={{
                position: 'absolute',
                top: (index + 1) * 6,
                left: (index + 1) * 6,
                width: 280,
                height: 200,
                bgcolor: '#fff',
                borderRadius: 2,
                border: '2px solid #e0e0e0',
                boxShadow: 1,
                zIndex: -(index + 1),
                pointerEvents: 'none',
              }}
            />
          ))}

        {/* Основная карточка таски */}
        <Card
          onClick={handleCardClick}
          sx={{
            width: 280,
            height: 200,
            cursor: isDragging ? 'grabbing' : 'pointer',
            border: `3px solid ${priorityColor}`,
            borderRadius: 2,
            boxShadow: isHighlighted
              ? '0 0 20px rgba(33, 150, 243, 0.8)'
              : isDragging
                ? 6
                : 2,
            transform: isHighlighted ? 'scale(1.03)' : 'scale(1)',
            bgcolor: isHighlighted ? 'rgba(33, 150, 243, 0.1)' : '#fff',
            userSelect: 'none',
            transition: 'box-shadow 0.2s, transform 0.2s',
            '&:hover': {
              boxShadow: isDragging ? 6 : 4,
            },
          }}
        >
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Заголовок и действия */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: 16,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {task.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {isInGroup && groupId && (
                  <Tooltip title={`Группа из ${groupSize} задач. Нажмите чтобы открыть`}>
                    <IconButton 
                      size="small" 
                      onClick={handleGroupIconClick}
                      sx={{ p: 0.5 }}
                    >
                      <Badge badgeContent={groupSize} color="primary">
                        <Layers fontSize="small" color="primary" />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                )}
                {viewCount > 0 && (
                  <Tooltip
                    title={`Просмотрели: ${task.views?.map((v) => v.viewerName).join(', ')}`}
                  >
                    <Badge badgeContent={viewCount} color="info" sx={{ cursor: 'default' }}>
                      <Visibility fontSize="small" />
                    </Badge>
                  </Tooltip>
                )}
                <IconButton
                  size="small"
                  onClick={handleDeleteClick}
                  sx={{ p: 0.5 }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            {/* Описание */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                mb: 1,
              }}
            >
              {task.description || 'Нет описания'}
            </Typography>

            {/* Категории */}
            {task.assigneeCategories && task.assigneeCategories.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                {task.assigneeCategories.slice(0, 2).map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11, pointerEvents: 'none' }}
                  />
                ))}
                {task.assigneeCategories.length > 2 && (
                  <Chip
                    label={`+${task.assigneeCategories.length - 2}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11, pointerEvents: 'none' }}
                  />
                )}
              </Box>
            )}

            {/* Футер */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {task.creatorName}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: priorityColor,
                }}
              >
                {formatDeadline(task.deadline)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Rnd>
  );
};

export default DraggableTask;
