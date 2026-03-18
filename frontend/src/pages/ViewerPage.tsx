import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { setEditing, updateMeasurements, setViewMode } from '../store/medicalSlice';
import { api } from '../services/api';
import ImageCanvas from '../components/ImageCanvas';
import MeasurementsPanel from '../components/MeasurementsPanel';
import { 
  ArrowLeft, Edit2, Check, Loader2, 
  PanelRightClose, PanelRightOpen,
  Maximize, Download, Printer, Info, Plus
} from 'lucide-react';

const ViewerPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { imageBase64, imageWidth, imageHeight, pixelSpacing, warning, ageMonths, gender } = useSelector((state: RootState) => state.analysis);
  const { points, isEditing, viewMode } = useSelector((state: RootState) => state.medical);
  
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [showStudentInfo, setShowStudentInfo] = useState(false);
  
  const viewerRef = useRef<HTMLDivElement>(null);

  // Redirect if no image
  React.useEffect(() => {
    if (!imageBase64) {
      navigate('/upload');
    }
  }, [imageBase64, navigate]);

  const handlePointDragEnd = async () => {
    if (!isEditing) return;
    
    setIsRecalculating(true);
    try {
      const result = await api.recalculate({
        points,
        image_width: imageWidth || 512,
        image_height: imageHeight || 512,
        pixel_spacing: pixelSpacing || undefined,
        age_months: ageMonths || undefined,
        gender: gender || undefined
      });
      
      dispatch(updateMeasurements({
        measurements: result.measurements,
        diagnosis: result.diagnosis,
        abnormalParameters: result.abnormal_parameters,
        thresholds: result.thresholds
      }));
    } catch (err) {
      console.error("Failed to recalculate:", err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const toggleEdit = () => {
    dispatch(setEditing(!isEditing));
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSave = () => {
    if (!imageBase64) return;
    // Временное решение для сохранения оригинального изображения с наложенными данными.
    // Для более сложной логики (с отрисовкой SVG/HTML в Canvas) требуется html2canvas. 
    // Пока создадим простую ссылку на скачивание базового изображения.
    const link = document.createElement('a');
    link.href = imageBase64;
    link.download = `hip_dysplasia_analysis_${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!imageBase64) return null;

  return (
    <div ref={viewerRef} className="flex flex-col w-full h-screen overflow-hidden bg-background">
      {/* Navbar / Header - Игнорируется при печати */}
      <header className="glass px-6 py-4 flex items-center justify-between z-10 shrink-0 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 hover:bg-white/20 dark:hover:bg-black/20 p-2 rounded-lg transition-colors font-medium text-primary"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Новый файл</span>
          </button>
          
          <div className="h-6 w-px bg-foreground/20"></div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-2">
             <button onClick={() => setIsPanelVisible(!isPanelVisible)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors" title={isPanelVisible ? "Скрыть панель" : "Показать расчеты"}>
               {isPanelVisible ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
             </button>
             <button onClick={handleFullscreen} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors" title="Во весь экран">
               <Maximize size={20} />
             </button>
             <button onClick={handleSave} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors" title="Сохранить снимок">
               <Download size={20} />
             </button>
             <button onClick={handlePrint} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors" title="Печать отчета">
               <Printer size={20} />
             </button>
             <button onClick={() => setShowStudentInfo(true)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-secondary" title="Справка для студентов">
               <Info size={20} />
             </button>
             
             {/* Пример табы "Вкладки" функционала (визуальный) */}
             <div className="h-6 w-px bg-foreground/20 ml-2"></div>
             
             {/* View Mode Switcher */}
             <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 ml-2 text-sm font-medium">
               <button 
                 onClick={() => dispatch(setViewMode('module1'))}
                 className={`px-3 py-1 rounded-md transition-shadow ${viewMode === 'module1' ? 'bg-white dark:bg-black shadow' : 'hover:text-primary'}`}
               >
                 6 точек
               </button>
               <button 
                 onClick={() => dispatch(setViewMode('module2'))}
                 className={`px-3 py-1 rounded-md transition-shadow ${viewMode === 'module2' ? 'bg-white dark:bg-black shadow' : 'hover:text-primary'}`}
               >
                 18 точек
               </button>
               <button 
                 onClick={() => dispatch(setViewMode('hidden'))}
                 className={`px-3 py-1 rounded-md transition-shadow ${viewMode === 'hidden' ? 'bg-white dark:bg-black shadow' : 'hover:text-primary'}`}
               >
                 Скрыть
               </button>
             </div>
             <div className="h-6 w-px bg-foreground/20 ml-2"></div>

             <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 ml-2 text-sm font-medium">
                <div className="px-3 py-1 bg-white dark:bg-black shadow rounded-md cursor-default">
                  Снимок #1
                </div>
                <button onClick={() => navigate('/upload')} className="px-3 py-1 hover:text-primary transition-colors flex items-center gap-1">
                  <Plus size={14} /> Открыть еще
                </button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mr-16"> {/* mr-16 to avoid theme toggle */}
          {isRecalculating && (
            <div className="flex items-center gap-2 text-primary text-sm font-medium animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              <span>Перерасчет...</span>
            </div>
          )}
          
          <button
            onClick={toggleEdit}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isEditing 
                ? 'bg-primary text-white shadow-lg' 
                : 'glass hover:bg-white/40 dark:hover:bg-black/40'
            }`}
          >
            {isEditing ? (
              <>
                <Check size={18} />
                <span>Готово</span>
              </>
            ) : (
              <>
                <Edit2 size={18} />
                <span>Редактировать точки</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-col flex-1 overflow-hidden p-4 gap-4 print:p-0">
        {warning && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 p-3 rounded-xl text-sm flex items-center justify-center gap-2 shrink-0 print:hidden">
            <span className="font-bold">⚠️</span>
            {warning}
          </div>
        )}
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden gap-4">
          {/* Left: Interactive Canvas */}
          <div className="flex-1 rounded-2xl overflow-hidden glass shadow-lg flex flex-col relative print:shadow-none print:border-none">
            {isEditing && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-bold z-10 shadow-lg pointer-events-none animate-pulse print:hidden">
                Режим редактирования: перетащите точки
              </div>
            )}
            <ImageCanvas onPointDragEnd={handlePointDragEnd} />
          </div>

          {/* Right: Measurements Panel */}
          {isPanelVisible && (
            <div className="w-full md:w-[400px] lg:w-[450px] shrink-0 overflow-y-auto glass rounded-2xl p-6 shadow-lg print:shadow-none print:w-full print:h-auto print:overflow-visible print:border-t-2">
              <MeasurementsPanel />
            </div>
          )}
        </div>
      </main>
      
      {/* Модальное окно для студентов */}
      {showStudentInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
           <div className="glass bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-2xl w-full shadow-2xl relative">
              <button onClick={() => setShowStudentInfo(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white">✕</button>
              <h2 className="text-2xl font-bold mb-4 text-primary flex items-center gap-2"><Info /> Справка по триаде Путти</h2>
              <div className="space-y-4 text-foreground/80">
                <p>Триада Путти включает три основных рентгенологических признака врожденного вывиха бедра:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Смещение проксимального конца бедра</strong> кнаружи и кверху по отношению к вертлужной впадине. Оценивается по пересечению линии Омбредана и Перкина.</li>
                  <li><strong>Запоздалое появление ядра окостенения</strong> головки бедренной кости (или его гипоплазия).</li>
                  <li><strong>Скошенность крыши вертлужной впадини</strong> (увеличение ацетабулярного угла). В норме: новорожденные - до 30°, 1 год - до 25°, старше 2 лет - до 20°.</li>
                </ul>
                <div className="bg-primary/10 p-4 rounded-lg mt-4 text-sm">
                  <strong>Подсказка по точкам на экране:</strong><br/>
                  Y L / Y R — Y-образные хрящи (через них строится линия Хильгенрейнера).<br/>
                  Roof L / Roof R — Наружный край крыши вертлужной впадины.<br/>
                  h/d L / h/d R — Истинный край (или центр) головки бедра для оценки смещения (h, d).
                </div>
              </div>
              <button 
                onClick={() => setShowStudentInfo(false)}
                className="mt-6 w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors"
              >
                Понятно
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;
