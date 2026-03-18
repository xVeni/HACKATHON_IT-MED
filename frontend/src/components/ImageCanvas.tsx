import React, { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { updatePointPosition } from '../store/medicalSlice';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface CanvasProps {
  onPointDragEnd: () => void;
}

const ImageCanvas: React.FC<CanvasProps> = ({ onPointDragEnd }) => {
  const dispatch = useDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { imageBase64, imageWidth, imageHeight } = useSelector((state: RootState) => state.analysis);
  const { points, points_18, isEditing, measurements, diagnosis, viewMode } = useSelector((state: RootState) => state.medical);
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  // Центрирование картинки при загрузке
  useEffect(() => {
    if (!imageBase64 || !containerRef.current || !imageWidth || !imageHeight) return;
    
    const container = containerRef.current;
    const containerRatio = container.clientWidth / container.clientHeight;
    const imgRatio = imageWidth / imageHeight;
    
    let initialScale = 1;
    if (imgRatio > containerRatio) {
      initialScale = container.clientWidth / imageWidth;
    } else {
      initialScale = container.clientHeight / imageHeight;
    }
    
    initialScale *= 0.9; // Небольшие отступы
    setScale(initialScale);
    
    setPosition({
      x: (container.clientWidth - imageWidth * initialScale) / 2,
      y: (container.clientHeight - imageHeight * initialScale) / 2
    });
  }, [imageBase64, imageWidth, imageHeight]);

  const handleWheel = (e: React.WheelEvent | WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = (e as WheelEvent).deltaY * -zoomSensitivity;
    let newScale = scale + delta;
    
    if (newScale < 0.1) newScale = 0.1;
    if (newScale > 10) newScale = 10;
    
    // Зум к центру контейнера, а не к мыши для простоты (или можно к мыши)
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const mouseX = (e as React.MouseEvent).clientX - rect.left;
      const mouseY = (e as React.MouseEvent).clientY - rect.top;
      
      const newX = mouseX - (mouseX - position.x) * (newScale / scale);
      const newY = mouseY - (mouseY - position.y) * (newScale / scale);
      
      setPosition({ x: newX, y: newY });
    }
    
    setScale(newScale);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel as any, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel as any);
    }
  }, [scale, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || !isEditing || (e.button === 0 && !draggingPointId && !(e.target as HTMLElement).closest('.point-marker'))) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingPointId && isEditing && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Логические координаты
      const logicalX = (mouseX - position.x) / scale;
      const logicalY = (mouseY - position.y) / scale;
      
      dispatch(updatePointPosition({
        id: draggingPointId,
        x: Math.max(0, Math.min(imageWidth || 1000, Math.round(logicalX))),
        y: Math.max(0, Math.min(imageHeight || 1000, Math.round(logicalY)))
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (draggingPointId) {
      onPointDragEnd(); // Сохранение при отпускании точки
    }
    setDraggingPointId(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Helper для точек
  const activePoints = viewMode === 'module2' ? points_18 : viewMode === 'module1' ? points : [];
  const pts = Object.fromEntries(activePoints.map(p => [p.id, p]));

  const renderCurve = (pointIds: string[], status: string | undefined, defaultColor: string) => {
    const validPts = pointIds.map(id => pts[id]).filter(Boolean);
    if (validPts.length < 2) return null;
    const color = status === 'normal' ? 'rgba(34, 197, 94, 0.8)' : status === 'subluxation' ? 'rgba(239, 68, 68, 0.8)' : defaultColor;
    const pathData = `M ${validPts.map(p => `${p.x},${p.y}`).join(' L ')}`;
    return <path d={pathData} stroke={color} strokeWidth={4 / scale} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden rounded-xl bg-black/5 dark:bg-black/20"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: isDragging ? 'grabbing' : (isEditing ? 'crosshair' : 'grab'),
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div 
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: imageWidth ? `${imageWidth}px` : '100%',
          height: imageHeight ? `${imageHeight}px` : '100%',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* Изображение */}
        {imageBase64 && (
          <img 
            src={imageBase64} 
            alt="Снимок пациента" 
            draggable="false"
            style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        )}
        
        {/* SVG для отрисовки линий */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          {/* MODULE 1 (6 points) SVG Rendering */}
          {viewMode === 'module1' && (
            <React.Fragment>
              {/* 1. Hilgenreiner line (purple dashed) passing through Y L and Y R (which are p3 and p4 now) */}
              {pts.p3 && pts.p4 && (() => {
                const dx = pts.p4.x - pts.p3.x;
                const dy = pts.p4.y - pts.p3.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const extendDist = 2000;
                const dirX = length === 0 ? 1 : dx / length;
                const dirY = length === 0 ? 0 : dy / length;
                
                const startX = pts.p3.x - dirX * extendDist;
                const startY = pts.p3.y - dirY * extendDist;
                const endX = pts.p4.x + dirX * extendDist;
                const endY = pts.p4.y + dirY * extendDist;
    
                return (
                  <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="rgba(168, 85, 247, 0.7)" strokeWidth={3 / scale} strokeDasharray={`${5/scale}, ${5/scale}`} />
                );
              })()}
    
              {/* 2. Acetabular angles (green) */}
              {pts.p3 && pts.p1 && (
                <React.Fragment>
                  <line x1={pts.p3.x} y1={pts.p3.y} x2={pts.p1.x} y2={pts.p1.y} stroke="rgba(34, 197, 94, 0.8)" strokeWidth={3 / scale} />
                  {measurements && (
                    <text x={(pts.p3.x + pts.p1.x) / 2 - 20/scale} y={(pts.p3.y + pts.p1.y) / 2 - 10/scale} fill="rgba(34, 197, 94, 1)" fontSize={16/scale} fontWeight="bold" style={{textShadow: '1px 1px 2px #000'}}>
                      α {measurements.acetabular_angle_left}°
                    </text>
                  )}
                </React.Fragment>
              )}
              {pts.p4 && pts.p2 && (
                <React.Fragment>
                  <line x1={pts.p4.x} y1={pts.p4.y} x2={pts.p2.x} y2={pts.p2.y} stroke="rgba(34, 197, 94, 0.8)" strokeWidth={3 / scale} />
                  {measurements && (
                    <text x={(pts.p4.x + pts.p2.x) / 2 + 10/scale} y={(pts.p4.y + pts.p2.y) / 2 - 10/scale} fill="rgba(34, 197, 94, 1)" fontSize={16/scale} fontWeight="bold" style={{textShadow: '1px 1px 2px #000'}}>
                      α {measurements.acetabular_angle_right}°
                    </text>
                  )}
                </React.Fragment>
              )}
    
              {/* 3. Distance h and d projections */}
              {pts.p3 && pts.p4 && (pts.p5 || pts.p6) && (() => {
                const dx = pts.p4.x - pts.p3.x;
                const dy = pts.p4.y - pts.p3.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length === 0) return null;
                
                const ux = dx / length;
                const uy = dy / length;
                
                const elements = [];
                
                if (pts.p5) {
                  const v5x = pts.p5.x - pts.p3.x;
                  const v5y = pts.p5.y - pts.p3.y;
                  const d_projL = v5x * ux + v5y * uy;
                  const intL_x = pts.p3.x + d_projL * ux;
                  const intL_y = pts.p3.y + d_projL * uy;
                  elements.push(
                    <React.Fragment key="left-hd">
                      <line x1={intL_x} y1={intL_y} x2={pts.p5.x} y2={pts.p5.y} stroke="rgba(56, 189, 248, 0.8)" strokeWidth={2 / scale} />
                      <line x1={pts.p3.x} y1={pts.p3.y} x2={intL_x} y2={intL_y} stroke="rgba(250, 204, 21, 0.8)" strokeWidth={4 / scale} />
                      {measurements && (
                        <>
                          <text x={intL_x - 30/scale} y={(intL_y + pts.p5.y)/2} fill="rgba(56, 189, 248, 1)" fontSize={14/scale} fontWeight="bold" style={{textShadow: '1px 1px 2px #000'}}>h={measurements.h_distance_left}</text>
                          <text x={(pts.p3.x + intL_x)/2} y={intL_y + 15/scale} fill="rgba(250, 204, 21, 1)" fontSize={14/scale} fontWeight="bold" style={{textShadow: '1px 1px 2px #000', textAnchor: 'middle'}}>d={measurements.d_distance_left}</text>
                        </>
                      )}
                    </React.Fragment>
                  );
                }
                if (pts.p6) {
                  const v6x = pts.p6.x - pts.p4.x;
                  const v6y = pts.p6.y - pts.p4.y;
                  const d_projR = v6x * ux + v6y * uy;
                  const intR_x = pts.p4.x + d_projR * ux;
                  const intR_y = pts.p4.y + d_projR * uy;
                  elements.push(
                    <React.Fragment key="right-hd">
                      <line x1={intR_x} y1={intR_y} x2={pts.p6.x} y2={pts.p6.y} stroke="rgba(56, 189, 248, 0.8)" strokeWidth={2 / scale} />
                      <line x1={pts.p4.x} y1={pts.p4.y} x2={intR_x} y2={intR_y} stroke="rgba(250, 204, 21, 0.8)" strokeWidth={4 / scale} />
                      {measurements && (
                        <>
                          <text x={intR_x + 10/scale} y={(intR_y + pts.p6.y)/2} fill="rgba(56, 189, 248, 1)" fontSize={14/scale} fontWeight="bold" style={{textShadow: '1px 1px 2px #000'}}>h={measurements.h_distance_right}</text>
                          <text x={(pts.p4.x + intR_x)/2} y={intR_y + 15/scale} fill="rgba(250, 204, 21, 1)" fontSize={14/scale} fontWeight="bold" style={{textShadow: '1px 1px 2px #000', textAnchor: 'middle'}}>d={measurements.d_distance_right}</text>
                        </>
                      )}
                    </React.Fragment>
                  );
                }
                return elements;
              })()}
            </React.Fragment>
          )}

          {/* MODULE 2 (18 points) SVG Rendering */}
          {viewMode === 'module2' && (
            <React.Fragment>
              {renderCurve(['ШН-Л', 'ШП-Л', 'ТН-Л'], diagnosis?.shenton_left, 'rgba(56, 189, 248, 0.8)')}
              {renderCurve(['ШН-П', 'ШЛ-П', 'ТН-П'], diagnosis?.shenton_right, 'rgba(56, 189, 248, 0.8)')}
              {renderCurve(['ТВ-Л', 'ТБ-Л', 'ШЛВ-Л'], diagnosis?.calve_left, 'rgba(168, 85, 247, 0.8)')}
              {renderCurve(['ТВ-П', 'ТБ-П', 'ШЛВ-П'], diagnosis?.calve_right, 'rgba(168, 85, 247, 0.8)')}
            </React.Fragment>
          )}
        </svg>

        {/* Точки разметки */}
        {activePoints.map(point => {
          const isDraggingThis = draggingPointId === point.id;
          const labels: Record<string, string> = {
            p1: 'Roof L', p2: 'Roof R',
            p3: 'Y L', p4: 'Y R',
            p5: 'h/d L', p6: 'h/d R'
          };
          
          return (
            <React.Fragment key={point.id}>
              {/* Невидимая область для легкого клика по точке */}
              <div 
                className="point-marker"
                style={{
                  position: 'absolute',
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  width: `${30 / scale}px`,
                  height: `${30 / scale}px`,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  cursor: isEditing ? 'grab' : 'default',
                  zIndex: isDraggingThis ? 20 : 10,
                  pointerEvents: isEditing ? 'auto' : 'none'
                }}
                onMouseDown={(e) => {
                  if (e.button === 0 && isEditing) {
                    e.stopPropagation();
                    setDraggingPointId(point.id);
                  }
                }}
              >
                {/* Видимая точка */}
                <div style={{
                  position: 'absolute',
                  left: '50%', top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `${12 / scale}px`,
                  height: `${12 / scale}px`,
                  background: isDraggingThis ? '#facc15' : '#22c55e',
                  border: `${2 / scale}px solid #fff`,
                  borderRadius: '50%',
                  boxShadow: isDraggingThis ? '0 0 10px #facc15' : '0 0 5px rgba(0,0,0,0.5)'
                }} />
              </div>

              {/* Лейбл точки */}
              <div style={{
                position: 'absolute',
                left: `${point.x + 10/scale}px`,
                top: `${point.y - 10/scale}px`,
                color: '#fff',
                fontSize: `${12/scale}px`,
                fontWeight: 'bold',
                textShadow: '1px 1px 2px #000',
                pointerEvents: 'none',
                zIndex: 11
              }}>
                {labels[point.id] || point.id}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Инструменты масштаба (в стиле присланного UI) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full flex gap-4 text-white z-50">
        <button 
          className="hover:text-primary transition-colors" 
          onClick={() => setScale(s => Math.max(0.1, s - 0.2))}
          title="Отдалить"
        >
          <ZoomOut size={20} />
        </button>
        <span className="font-mono flex items-center min-w-[50px] justify-center text-sm">
          {Math.round(scale * 100)}%
        </span>
        <button 
          className="hover:text-primary transition-colors" 
          onClick={() => setScale(s => Math.min(10, s + 0.2))}
          title="Приблизить"
        >
          <ZoomIn size={20} />
        </button>
        <div className="w-px bg-white/20 mx-1"></div>
        <button 
          className="hover:text-primary transition-colors flex items-center gap-2 text-sm" 
          onClick={toggleFullscreen}
          title="Во весь экран"
        >
          <Maximize size={18} />
          <span className="hidden sm:inline">Во весь экран</span>
        </button>
      </div>
    </div>
  );
};

export default ImageCanvas;
